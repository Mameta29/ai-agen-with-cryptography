import { GmailService, GmailMessage, InvoiceData, ScheduleData } from './gmail';
import { AIClassifier } from './ai-classifier';
import { CalendarService } from './calendar';
import { PaymentPolicyEvaluator, PaymentPolicy, PolicyEvaluationResult } from './payment-policy';
import { BlockchainService } from './blockchain';
import { OAuth2Client } from 'google-auth-library';
import { Address } from 'viem';

export interface ProcessingResult {
  messageId: string;
  type: 'invoice' | 'schedule' | 'other';
  success: boolean;
  action: string;
  details?: {
    // Schedule processing
    calendarEventId?: string;
    calendarEventUrl?: string;
    
    // Invoice processing
    policyEvaluation?: PolicyEvaluationResult;
    transactionHash?: string;
    paymentAmount?: number;
    
    // Common
    error?: string;
    warnings?: string[];
  };
}

export interface ProcessingConfig {
  // Gmail credentials
  gmailCredentials: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    refreshToken: string;
  };
  
  // OpenAI
  openaiApiKey: string;
  
  // Blockchain
  blockchain: {
    privateKey: string;
    rpcUrl: string;
    jpycTokenAddress: Address;
  };
  
  // Payment policy
  paymentPolicy: PaymentPolicy;
  
  // Processing options
  options: {
    autoProcessSchedules: boolean;
    autoProcessPayments: boolean;
    requireManualApprovalForPayments: boolean;
    sendReplyNotifications: boolean;
    maxProcessingTimeMs: number;
  };
}

export class EmailProcessor {
  private gmailService: GmailService;
  private aiClassifier: AIClassifier;
  private calendarService: CalendarService;
  private policyEvaluator: PaymentPolicyEvaluator;
  private blockchainService: BlockchainService;
  private config: ProcessingConfig;
  
  private processingQueue = new Map<string, Promise<ProcessingResult>>();

  constructor(config: ProcessingConfig) {
    this.config = config;
    
    // Initialize services
    const oauth2Client = new OAuth2Client(
      config.gmailCredentials.clientId,
      config.gmailCredentials.clientSecret,
      config.gmailCredentials.redirectUri
    );
    oauth2Client.setCredentials({
      refresh_token: config.gmailCredentials.refreshToken,
    });

    this.gmailService = new GmailService(config.gmailCredentials);
    this.aiClassifier = new AIClassifier();
    this.calendarService = new CalendarService(oauth2Client);
    this.policyEvaluator = new PaymentPolicyEvaluator(config.paymentPolicy);
    this.blockchainService = new BlockchainService(
      config.blockchain.privateKey,
      config.blockchain.rpcUrl
    );
  }

  /**
   * 新着メールを処理
   */
  async processNewEmails(since?: Date): Promise<ProcessingResult[]> {
    try {
      console.log('🔄 Processing new emails since:', since?.toISOString() || 'beginning');
      
      // 新着メールを取得
      const messages = await this.gmailService.getNewMessages(since);
      console.log(`📧 Found ${messages.length} new messages`);

      if (messages.length === 0) {
        return [];
      }

      // 並行処理でメールを処理
      const results = await Promise.all(
        messages.map(message => this.processSingleEmail(message))
      );

      // 結果をまとめて返す
      const summary = this.summarizeResults(results);
      console.log('📊 Processing summary:', summary);

      return results;
    } catch (error) {
      console.error('❌ Failed to process new emails:', error);
      throw error;
    }
  }

  /**
   * 単一のメールを処理
   */
  async processSingleEmail(message: GmailMessage): Promise<ProcessingResult> {
    const messageId = message.id;
    
    // 重複処理を防ぐ
    if (this.processingQueue.has(messageId)) {
      return await this.processingQueue.get(messageId)!;
    }

    const processingPromise = this.doProcessSingleEmail(message);
    this.processingQueue.set(messageId, processingPromise);
    
    try {
      const result = await processingPromise;
      return result;
    } finally {
      // 処理完了後にキューから削除
      setTimeout(() => this.processingQueue.delete(messageId), 60000); // 1分後に削除
    }
  }

  /**
   * 単一メールの実際の処理
   */
  private async doProcessSingleEmail(message: GmailMessage): Promise<ProcessingResult> {
    const startTime = Date.now();
    const maxTime = this.config.options.maxProcessingTimeMs;

    try {
      console.log(`📨 Processing message: ${message.id}`);

      // タイムアウト設定
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Processing timeout')), maxTime);
      });

      const processingPromise = this.processEmailInternal(message);
      
      return await Promise.race([processingPromise, timeoutPromise]);
    } catch (error) {
      console.error(`❌ Failed to process message ${message.id}:`, error);
      return {
        messageId: message.id,
        type: 'other',
        success: false,
        action: 'error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    } finally {
      const processingTime = Date.now() - startTime;
      console.log(`⏱️ Processing time for ${message.id}: ${processingTime}ms`);
    }
  }

  /**
   * メール処理の内部ロジック
   */
  private async processEmailInternal(message: GmailMessage): Promise<ProcessingResult> {
    // 1. 基本情報を抽出
    const headers = message.payload.headers;
    const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
    const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
    
    // 2. セキュリティチェック
    const securityCheck = await this.gmailService.performSecurityCheck(message);
    if (securityCheck.phishingSuspected || securityCheck.riskScore > 70) {
      console.log(`🚨 High risk email detected: ${message.id}, risk score: ${securityCheck.riskScore}`);
      
      // 危険なメールは処理せずにブロック
      await this.gmailService.addLabel(message.id, 'BLOCKED_SUSPICIOUS');
      
      return {
        messageId: message.id,
        type: 'other',
        success: true,
        action: 'blocked_suspicious',
        details: {
          warnings: [`High risk score: ${securityCheck.riskScore}`, 'Email blocked for security reasons'],
        },
      };
    }

    // 3. メール本文と添付ファイルを取得
    const body = this.gmailService.getEmailBody(message);
    const attachments = await this.gmailService.getAttachments(message);

    // 4. 事前フィルタリング
    const preFilter = this.aiClassifier.preFilterEmail(subject, body, from);
    if (!preFilter.shouldProcess) {
      console.log(`⏭️ Skipping email ${message.id}: ${preFilter.reason}`);
      
      return {
        messageId: message.id,
        type: 'other',
        success: true,
        action: 'skipped',
        details: {
          warnings: [preFilter.reason],
        },
      };
    }

    // 5. AI分類と情報抽出
    const classification = await this.aiClassifier.classifyAndExtract(
      subject,
      body,
      from,
      attachments
    );

    console.log(`🤖 Classification result for ${message.id}:`, {
      type: classification.type,
      confidence: classification.confidence,
    });

    // 6. 分類に応じた処理
    switch (classification.type) {
      case 'schedule':
        return await this.processScheduleEmail(message, classification.extractedData as ScheduleData);
      
      case 'invoice':
        return await this.processInvoiceEmail(message, classification.extractedData as InvoiceData);
      
      default:
        return {
          messageId: message.id,
          type: 'other',
          success: true,
          action: 'no_action',
        };
    }
  }

  /**
   * 予定メールの処理
   */
  private async processScheduleEmail(
    message: GmailMessage,
    scheduleData: ScheduleData | null
  ): Promise<ProcessingResult> {
    if (!scheduleData) {
      return {
        messageId: message.id,
        type: 'schedule',
        success: false,
        action: 'extraction_failed',
        details: {
          error: 'Failed to extract schedule data',
        },
      };
    }

    if (!this.config.options.autoProcessSchedules) {
      return {
        messageId: message.id,
        type: 'schedule',
        success: true,
        action: 'manual_approval_required',
      };
    }

    try {
      // カレンダーイベントを作成
      const result = await this.calendarService.createEvent(scheduleData);
      
      if (result.success) {
        // 成功時の処理
        await this.gmailService.addLabel(message.id, 'Scheduled');
        
        if (this.config.options.sendReplyNotifications) {
          const replyText = `予定「${scheduleData.title}」をカレンダーに追加しました。\n\n` +
            `日時: ${new Date(scheduleData.startDate).toLocaleString('ja-JP')}\n` +
            `場所: ${scheduleData.location || '未設定'}\n` +
            `カレンダー: ${result.webLink}`;
          
          await this.gmailService.sendReply(message.id, message.threadId, replyText);
        }

        return {
          messageId: message.id,
          type: 'schedule',
          success: true,
          action: 'calendar_created',
          details: {
            calendarEventId: result.eventId,
            calendarEventUrl: result.webLink,
          },
        };
      } else {
        return {
          messageId: message.id,
          type: 'schedule',
          success: false,
          action: 'calendar_creation_failed',
          details: {
            error: result.error,
          },
        };
      }
    } catch (error) {
      console.error('Failed to process schedule email:', error);
      return {
        messageId: message.id,
        type: 'schedule',
        success: false,
        action: 'processing_error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * 請求書メールの処理
   */
  private async processInvoiceEmail(
    message: GmailMessage,
    invoiceData: InvoiceData | null
  ): Promise<ProcessingResult> {
    if (!invoiceData) {
      return {
        messageId: message.id,
        type: 'invoice',
        success: false,
        action: 'extraction_failed',
        details: {
          error: 'Failed to extract invoice data',
        },
      };
    }

    try {
      // ポリシー評価
      const currentSpending = await this.policyEvaluator.getCurrentSpending();
      const policyResult = await this.policyEvaluator.evaluatePayment(
        invoiceData,
        currentSpending
      );

      console.log(`💳 Policy evaluation for ${message.id}:`, {
        approved: policyResult.approved,
        requiresManualApproval: policyResult.requiresManualApproval,
        riskScore: policyResult.riskScore,
      });

      // 手動承認が必要な場合
      if (policyResult.requiresManualApproval || !this.config.options.autoProcessPayments) {
        await this.gmailService.addLabel(message.id, 'Payment_Approval_Required');
        
        return {
          messageId: message.id,
          type: 'invoice',
          success: true,
          action: 'manual_approval_required',
          details: {
            policyEvaluation: policyResult,
            paymentAmount: invoiceData.amount,
          },
        };
      }

      // ポリシー違反の場合
      if (!policyResult.approved) {
        await this.gmailService.addLabel(message.id, 'Payment_Rejected');
        
        return {
          messageId: message.id,
          type: 'invoice',
          success: true,
          action: 'payment_rejected',
          details: {
            policyEvaluation: policyResult,
            paymentAmount: invoiceData.amount,
          },
        };
      }

      // 自動支払い実行
      const paymentResult = await this.blockchainService.executePayment(
        invoiceData,
        this.config.blockchain.jpycTokenAddress
      );

      if (paymentResult.success) {
        // 支払い成功
        await this.gmailService.addLabel(message.id, 'Paid (Onchain)');
        
        if (this.config.options.sendReplyNotifications) {
          const replyText = `請求書の支払いが完了しました。\n\n` +
            `請求番号: ${invoiceData.invoiceNumber}\n` +
            `金額: ${invoiceData.amount.toLocaleString()} ${invoiceData.currency}\n` +
            `支払先: ${invoiceData.vendorName}\n` +
            `トランザクション: https://sepolia.etherscan.io/tx/${paymentResult.txHash}`;
          
          await this.gmailService.sendReply(message.id, message.threadId, replyText);
        }

        return {
          messageId: message.id,
          type: 'invoice',
          success: true,
          action: 'payment_completed',
          details: {
            policyEvaluation: policyResult,
            transactionHash: paymentResult.txHash,
            paymentAmount: invoiceData.amount,
          },
        };
      } else {
        // 支払い失敗
        await this.gmailService.addLabel(message.id, 'Payment_Failed');
        
        return {
          messageId: message.id,
          type: 'invoice',
          success: false,
          action: 'payment_failed',
          details: {
            policyEvaluation: policyResult,
            paymentAmount: invoiceData.amount,
            error: paymentResult.error,
          },
        };
      }
    } catch (error) {
      console.error('Failed to process invoice email:', error);
      return {
        messageId: message.id,
        type: 'invoice',
        success: false,
        action: 'processing_error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * 処理結果をまとめる
   */
  private summarizeResults(results: ProcessingResult[]): {
    total: number;
    successful: number;
    failed: number;
    byType: Record<string, number>;
    byAction: Record<string, number>;
  } {
    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      byType: {} as Record<string, number>,
      byAction: {} as Record<string, number>,
    };

    results.forEach(result => {
      summary.byType[result.type] = (summary.byType[result.type] || 0) + 1;
      summary.byAction[result.action] = (summary.byAction[result.action] || 0) + 1;
    });

    return summary;
  }

  /**
   * 定期的な新着チェック
   */
  async startPeriodicCheck(intervalMs: number = 5 * 60 * 1000): Promise<void> {
    console.log(`🔄 Starting periodic email check every ${intervalMs / 1000} seconds`);
    
    let lastCheck = new Date();
    
    const check = async () => {
      try {
        const results = await this.processNewEmails(lastCheck);
        lastCheck = new Date();
        
        if (results.length > 0) {
          console.log(`✅ Processed ${results.length} emails in periodic check`);
        }
      } catch (error) {
        console.error('❌ Error in periodic check:', error);
      }
    };

    // 初回実行
    await check();
    
    // 定期実行
    setInterval(check, intervalMs);
  }

  /**
   * Gmail Push通知のセットアップ
   */
  async setupPushNotifications(topicName: string): Promise<void> {
    try {
      await this.gmailService.setupPushNotifications(topicName);
      console.log('✅ Gmail push notifications setup completed');
    } catch (error) {
      console.error('❌ Failed to setup push notifications:', error);
      throw error;
    }
  }

  /**
   * 手動でメッセージを再処理
   */
  async reprocessMessage(messageId: string): Promise<ProcessingResult> {
    try {
      // メッセージを取得
      const messages = await this.gmailService.getNewMessages();
      const message = messages.find(m => m.id === messageId);
      
      if (!message) {
        throw new Error(`Message not found: ${messageId}`);
      }

      // キューから削除して再処理
      this.processingQueue.delete(messageId);
      
      return await this.processSingleEmail(message);
    } catch (error) {
      console.error(`Failed to reprocess message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * サービスの健全性チェック
   */
  async healthCheck(): Promise<{
    gmail: boolean;
    openai: boolean;
    calendar: boolean;
    blockchain: boolean;
    overall: boolean;
  }> {
    const health = {
      gmail: false,
      openai: false,
      calendar: false,
      blockchain: false,
      overall: false,
    };

    try {
      // Gmail check
      const messages = await this.gmailService.getNewMessages();
      health.gmail = true;
    } catch {
      health.gmail = false;
    }

    try {
      // Calendar check
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await this.calendarService.listEvents(now.toISOString(), tomorrow.toISOString(), 1);
      health.calendar = true;
    } catch {
      health.calendar = false;
    }

    try {
      // Blockchain check
      await this.blockchainService.getNetworkInfo();
      health.blockchain = true;
    } catch {
      health.blockchain = false;
    }

    // OpenAI check is implicit in classification
    health.openai = true; // Assume OK for now

    health.overall = health.gmail && health.openai && health.calendar && health.blockchain;

    return health;
  }
} 