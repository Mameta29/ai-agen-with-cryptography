import OpenAI from 'openai';
import { GmailMessage, EmailClassification, InvoiceData, ScheduleData } from './gmail';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class AIClassifier {
  /**
   * メールを分類し、関連情報を抽出
   */
  async classifyAndExtract(
    subject: string,
    body: string,
    from: string,
    attachments: Array<{ filename: string; mimeType: string; data: Buffer }>
  ): Promise<EmailClassification> {
    try {
      // まず基本的な分類を実行
      const classification = await this.classifyEmail(subject, body, from);
      
      // 分類に応じて詳細な情報抽出を実行
      let extractedData = null;
      if (classification.type === 'invoice' && classification.confidence > 0.7) {
        extractedData = await this.extractInvoiceData(subject, body, attachments);
      } else if (classification.type === 'schedule' && classification.confidence > 0.7) {
        extractedData = await this.extractScheduleData(subject, body);
      }

      return {
        ...classification,
        extractedData,
      };
    } catch (error) {
      console.error('AI classification failed:', error);
      return {
        type: 'other',
        confidence: 0,
        extractedData: null,
      };
    }
  }

  /**
   * メールの基本分類
   */
  private async classifyEmail(
    subject: string,
    body: string,
    from: string
  ): Promise<{ type: 'invoice' | 'schedule' | 'other'; confidence: number }> {
    const prompt = `
以下のメールを分析し、「請求書」「予定/会議」「その他」のいずれかに分類してください。

件名: ${subject}
送信者: ${from}
本文: ${body.substring(0, 1000)}...

以下のJSON形式で回答してください：
{
  "type": "invoice" | "schedule" | "other",
  "confidence": 0.0-1.0の数値,
  "reasoning": "分類の理由"
}

分類基準：
- invoice: 請求書、支払い依頼、料金通知など
- schedule: 会議招待、予定調整、イベント案内など
- other: 上記以外
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    });

    try {
      const result = JSON.parse(response.choices[0].message.content || '{}');
      return {
        type: result.type || 'other',
        confidence: Math.min(Math.max(result.confidence || 0, 0), 1),
      };
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return { type: 'other', confidence: 0 };
    }
  }

  /**
   * 請求書データの抽出
   */
  private async extractInvoiceData(
    subject: string,
    body: string,
    attachments: Array<{ filename: string; mimeType: string; data: Buffer }>
  ): Promise<InvoiceData | null> {
    // 添付ファイルがある場合は簡単なテキスト抽出を試行
    let attachmentText = '';
    for (const attachment of attachments) {
      if (attachment.mimeType === 'text/plain') {
        attachmentText += attachment.data.toString('utf-8') + '\n';
      }
      // PDFやその他の形式は今回は簡略化
    }

    const prompt = `
以下の請求書メールから必要な情報を抽出してください。

件名: ${subject}
本文: ${body}
${attachmentText ? `添付ファイル内容: ${attachmentText}` : ''}

以下のJSON形式で回答してください：
{
  "invoiceNumber": "請求書番号",
  "amount": 数値（円単位）,
  "currency": "通貨コード（JPY等）",
  "dueDate": "YYYY-MM-DD形式の支払期日",
  "vendorName": "請求元の会社名",
  "vendorEmail": "請求元のメールアドレス",
  "paymentAddress": "暗号通貨アドレス（あれば）",
  "paymentURI": "支払いURI（あれば）"
}

不明な項目は null を設定してください。
金額は数値のみ（カンマや通貨記号は除く）で返してください。
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1000,
    });

    try {
      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // データ検証
      if (!result.invoiceNumber || !result.amount || !result.vendorName) {
        console.warn('Incomplete invoice data extracted');
        return null;
      }

      return {
        invoiceNumber: result.invoiceNumber,
        amount: parseInt(result.amount) || 0,
        currency: result.currency || 'JPY',
        dueDate: result.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        vendorName: result.vendorName,
        vendorEmail: result.vendorEmail || '',
        paymentAddress: result.paymentAddress || undefined,
        paymentURI: result.paymentURI || undefined,
      };
    } catch (parseError) {
      console.error('Failed to parse invoice extraction:', parseError);
      return null;
    }
  }

  /**
   * 予定データの抽出
   */
  private async extractScheduleData(
    subject: string,
    body: string
  ): Promise<ScheduleData | null> {
    const prompt = `
以下の予定・会議メールから必要な情報を抽出してください。

件名: ${subject}
本文: ${body}

以下のJSON形式で回答してください：
{
  "title": "イベント/会議のタイトル",
  "startDate": "YYYY-MM-DDTHH:mm:ss形式の開始日時",
  "endDate": "YYYY-MM-DDTHH:mm:ss形式の終了日時（あれば）",
  "location": "場所（あれば）",
  "meetingUrl": "会議URL（Zoom、Teams等があれば）",
  "description": "詳細説明"
}

不明な項目は null を設定してください。
日時は可能な限りISO 8601形式で返してください。
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1000,
    });

    try {
      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // データ検証
      if (!result.title || !result.startDate) {
        console.warn('Incomplete schedule data extracted');
        return null;
      }

      return {
        title: result.title,
        startDate: result.startDate,
        endDate: result.endDate || undefined,
        location: result.location || undefined,
        meetingUrl: result.meetingUrl || undefined,
        description: result.description || '',
      };
    } catch (parseError) {
      console.error('Failed to parse schedule extraction:', parseError);
      return null;
    }
  }

  /**
   * ルールベースの事前フィルタリング
   */
  preFilterEmail(subject: string, body: string, from: string): {
    shouldProcess: boolean;
    reason: string;
  } {
    const lowerSubject = subject.toLowerCase();
    const lowerBody = body.toLowerCase();
    const lowerFrom = from.toLowerCase();

    // 明らかなスパムやプロモーションを除外
    const spamKeywords = [
      'unsubscribe', 'promotion', 'advertisement', 'marketing',
      'sale', 'discount', 'offer', 'deal', 'win', 'lottery',
      'viagra', 'casino', 'loan', 'credit'
    ];

    for (const keyword of spamKeywords) {
      if (lowerSubject.includes(keyword) || lowerBody.includes(keyword)) {
        return {
          shouldProcess: false,
          reason: `Spam keyword detected: ${keyword}`,
        };
      }
    }

    // 請求書の可能性が高いキーワード
    const invoiceKeywords = [
      'invoice', '請求書', '請求', 'bill', '支払い', 'payment',
      '料金', 'charge', '決済', 'settlement', '振込'
    ];

    // 予定の可能性が高いキーワード
    const scheduleKeywords = [
      'meeting', '会議', 'appointment', '予定', 'schedule',
      'event', 'イベント', 'calendar', 'invite', '招待'
    ];

    const hasInvoiceKeyword = invoiceKeywords.some(keyword => 
      lowerSubject.includes(keyword) || lowerBody.includes(keyword)
    );

    const hasScheduleKeyword = scheduleKeywords.some(keyword =>
      lowerSubject.includes(keyword) || lowerBody.includes(keyword)
    );

    if (hasInvoiceKeyword || hasScheduleKeyword) {
      return {
        shouldProcess: true,
        reason: hasInvoiceKeyword ? 'Invoice keywords detected' : 'Schedule keywords detected',
      };
    }

    // その他の重要そうなメール
    const importantKeywords = [
      'urgent', '緊急', 'important', '重要', 'action required',
      'confirm', '確認', 'verify', '検証'
    ];

    const hasImportantKeyword = importantKeywords.some(keyword =>
      lowerSubject.includes(keyword) || lowerBody.includes(keyword)
    );

    return {
      shouldProcess: hasImportantKeyword,
      reason: hasImportantKeyword ? 'Important keywords detected' : 'No relevant keywords found',
    };
  }
}

/**
 * シングルトンインスタンス
 */
export const aiClassifier = new AIClassifier(); 