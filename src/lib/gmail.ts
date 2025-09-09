import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { PubSub } from '@google-cloud/pubsub';

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
      filename?: string;
    }>;
  };
  internalDate: string;
}

export interface EmailClassification {
  type: 'invoice' | 'schedule' | 'other';
  confidence: number;
  extractedData: InvoiceData | ScheduleData | null;
}

export interface InvoiceData {
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: string;
  vendorName: string;
  vendorEmail: string;
  paymentAddress?: string;
  paymentURI?: string;
}

export interface ScheduleData {
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  meetingUrl?: string;
  description: string;
}

export interface SecurityCheck {
  dkimValid: boolean;
  spfValid: boolean;
  domainTrusted: boolean;
  phishingSuspected: boolean;
  riskScore: number;
}

export class GmailService {
  private oauth2Client: OAuth2Client;
  private gmail: any;
  private pubsub?: PubSub;

  constructor(credentials: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    refreshToken?: string;
  }) {
    this.oauth2Client = new OAuth2Client(
      credentials.clientId,
      credentials.clientSecret,
      credentials.redirectUri
    );

    if (credentials.refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: credentials.refreshToken,
      });
    }

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    // Pub/Sub setup for push notifications
    if (process.env.GOOGLE_PROJECT_ID) {
      this.pubsub = new PubSub({ projectId: process.env.GOOGLE_PROJECT_ID });
    }
  }

  /**
   * OAuth認証URLを生成
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  /**
   * 認証コードからトークンを取得
   */
  async getTokenFromCode(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  /**
   * Gmail Push通知を設定
   */
  async setupPushNotifications(topicName: string) {
    try {
      const response = await this.gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: `projects/${process.env.GOOGLE_PROJECT_ID}/topics/${topicName}`,
          labelIds: ['INBOX'],
        },
      });
      
      console.log('Push notifications setup:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to setup push notifications:', error);
      throw error;
    }
  }

  /**
   * 新着メールを取得（ポーリング用）
   */
  async getNewMessages(since?: Date): Promise<GmailMessage[]> {
    try {
      const query = since 
        ? `in:inbox after:${Math.floor(since.getTime() / 1000)}`
        : 'in:inbox';

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 10,
      });

      const messages: GmailMessage[] = [];
      
      if (response.data.messages) {
        for (const message of response.data.messages) {
          const fullMessage = await this.gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full',
          });
          messages.push(fullMessage.data);
        }
      }

      return messages;
    } catch (error) {
      console.error('Failed to get messages:', error);
      throw error;
    }
  }

  /**
   * メールのセキュリティチェック
   */
  async performSecurityCheck(message: GmailMessage): Promise<SecurityCheck> {
    const headers = message.payload.headers;
    const authResults = headers.find(h => h.name.toLowerCase() === 'authentication-results')?.value || '';
    const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
    
    // DKIM/SPF検証
    const dkimValid = authResults.includes('dkim=pass');
    const spfValid = authResults.includes('spf=pass');
    
    // ドメイン信頼度チェック
    const fromDomain = from.match(/@([^>]+)/)?.[1]?.toLowerCase() || '';
    const trustedDomains = [
      'gmail.com', 'outlook.com', 'yahoo.com',
      // 追加の信頼できるドメイン
    ];
    const domainTrusted = trustedDomains.some(domain => fromDomain.endsWith(domain));

    // 基本的なフィッシング検知
    const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
    const phishingKeywords = [
      'urgent', 'verify account', 'suspended', 'click here immediately',
      'limited time', 'act now', 'confirm identity'
    ];
    const phishingSuspected = phishingKeywords.some(keyword => 
      subject.toLowerCase().includes(keyword) || 
      message.snippet.toLowerCase().includes(keyword)
    );

    // リスクスコア計算（0-100）
    let riskScore = 0;
    if (!dkimValid) riskScore += 30;
    if (!spfValid) riskScore += 20;
    if (!domainTrusted) riskScore += 25;
    if (phishingSuspected) riskScore += 25;

    return {
      dkimValid,
      spfValid,
      domainTrusted,
      phishingSuspected,
      riskScore: Math.min(riskScore, 100),
    };
  }

  /**
   * メールの本文を取得
   */
  getEmailBody(message: GmailMessage): string {
    let body = '';

    if (message.payload.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    } else if (message.payload.parts) {
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    }

    return body;
  }

  /**
   * 添付ファイルを取得
   */
  async getAttachments(message: GmailMessage): Promise<Array<{
    filename: string;
    mimeType: string;
    data: Buffer;
  }>> {
    const attachments = [];

    if (message.payload.parts) {
      for (const part of message.payload.parts) {
        if (part.filename && part.body?.data) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType || 'application/octet-stream',
            data: Buffer.from(part.body.data, 'base64'),
          });
        }
      }
    }

    return attachments;
  }

  /**
   * メールにラベルを追加
   */
  async addLabel(messageId: string, labelName: string) {
    try {
      // まずラベルが存在するかチェック
      const labelsResponse = await this.gmail.users.labels.list({ userId: 'me' });
      let labelId = labelsResponse.data.labels?.find(
        (label: any) => label.name === labelName
      )?.id;

      // ラベルが存在しない場合は作成
      if (!labelId) {
        const createResponse = await this.gmail.users.labels.create({
          userId: 'me',
          requestBody: {
            name: labelName,
            labelListVisibility: 'labelShow',
            messageListVisibility: 'show',
          },
        });
        labelId = createResponse.data.id;
      }

      // メールにラベルを追加
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: [labelId],
        },
      });

      console.log(`Label "${labelName}" added to message ${messageId}`);
    } catch (error) {
      console.error('Failed to add label:', error);
      throw error;
    }
  }

  /**
   * メールに返信
   */
  async sendReply(messageId: string, threadId: string, replyText: string) {
    try {
      // 元のメッセージを取得して返信用のヘッダーを構築
      const originalMessage = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const headers = originalMessage.data.payload.headers;
      const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value;
      const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value;

      const rawMessage = [
        `To: ${from}`,
        `Subject: Re: ${subject}`,
        `In-Reply-To: ${messageId}`,
        `References: ${messageId}`,
        '',
        replyText,
      ].join('\n');

      const encodedMessage = Buffer.from(rawMessage).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          threadId,
          raw: encodedMessage,
        },
      });

      console.log(`Reply sent to message ${messageId}`);
    } catch (error) {
      console.error('Failed to send reply:', error);
      throw error;
    }
  }
}

/**
 * Pub/Subメッセージハンドラー
 */
export async function handlePubSubMessage(message: any) {
  try {
    const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
    console.log('Received Gmail push notification:', data);
    
    // ここで新着メッセージの処理をトリガー
    // 実際の実装では、キューやWebhookを通じて処理を開始
    
    return { success: true };
  } catch (error) {
    console.error('Failed to handle Pub/Sub message:', error);
    throw error;
  }
} 