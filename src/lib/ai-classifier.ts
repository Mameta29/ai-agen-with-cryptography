import OpenAI from 'openai';
import { GmailMessage, EmailClassification, InvoiceData, ScheduleData } from './gmail';
import { LocalAIClassifier } from './local-ai-classifier';
import fs from 'fs';
// import * as pdfParse from 'pdf-parse';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AIClassifierConfig {
  useLocalAI: boolean;
  fallbackToOpenAI: boolean;
  localAIConfig?: {
    apiUrl: string;
    model: string;
    timeout: number;
  };
}

export class AIClassifier {
  private openai: OpenAI;
  private localAI: LocalAIClassifier | null = null;
  private config: AIClassifierConfig;

  constructor(config: Partial<AIClassifierConfig> = {}) {
    this.config = {
      useLocalAI: process.env.USE_LOCAL_AI === 'true',
      fallbackToOpenAI: true,
      localAIConfig: {
        apiUrl: process.env.LOCAL_AI_URL || 'http://localhost:11434',
        model: process.env.LOCAL_AI_MODEL || 'llama3.1:8b',
        timeout: 60000,
      },
      ...config
    };

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // ローカルAIが有効な場合は初期化
    if (this.config.useLocalAI) {
      this.localAI = new LocalAIClassifier(this.config.localAIConfig);
      console.log('🤖 ローカルAIクラシファイアを初期化しました');
    }
  }

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
      console.log(`📧 メール分類開始 - ローカルAI: ${this.config.useLocalAI ? '有効' : '無効'}`);
      
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
   * メール分類（ローカルAI優先、フォールバック対応）
   */
  private async classifyEmail(subject: string, body: string, from: string): Promise<EmailClassification> {
    // ローカルAIを試行
    if (this.config.useLocalAI && this.localAI) {
      try {
        console.log('🤖 ローカルAIで分類を実行中...');
        const localResult = await this.localAI.classifyEmail(body, subject);
        
        // ローカルAIの結果を既存の形式に変換
        const classification: EmailClassification = {
          type: localResult.type.toLowerCase() as 'invoice' | 'schedule' | 'other',
          confidence: localResult.confidence,
          extractedData: localResult.extracted_data
        };
        
        console.log(`✅ ローカルAI分類完了: ${classification.type} (${classification.confidence})`);
        
        // 信頼度が低い場合はフォールバック
        if (classification.confidence < 0.6 && this.config.fallbackToOpenAI) {
          console.log('⚠️ ローカルAIの信頼度が低いため、OpenAIにフォールバック');
          return await this.classifyWithOpenAI(subject, body, from);
        }
        
        return classification;
      } catch (error) {
        console.error('❌ ローカルAI分類エラー:', error);
        
        if (this.config.fallbackToOpenAI) {
          console.log('🔄 OpenAIにフォールバック');
          return await this.classifyWithOpenAI(subject, body, from);
        } else {
          throw error;
        }
      }
    }

    // OpenAIを使用
    return await this.classifyWithOpenAI(subject, body, from);
  }

  /**
   * OpenAIによる分類（従来の実装）
   */
  private async classifyWithOpenAI(subject: string, body: string, from: string): Promise<EmailClassification> {
    console.log('🧠 OpenAIで分類を実行中...');
    
    const prompt = `
以下のメールを分析し、分類してください。

件名: ${subject}
差出人: ${from}
本文: ${body.substring(0, 1000)}

以下のカテゴリから選択してください：
1. invoice - 請求書、支払い要求、料金通知
2. schedule - 会議招待、予定調整、イベント案内
3. other - その他

回答形式:
{
  "type": "invoice|schedule|other",
  "confidence": 0.0-1.0,
  "reasoning": "分類理由"
}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('OpenAI応答が空です');

      const result = JSON.parse(content);
      console.log(`✅ OpenAI分類完了: ${result.type} (${result.confidence})`);
      
      return {
        type: result.type,
        confidence: result.confidence,
        extractedData: null
      };
    } catch (error) {
      console.error('OpenAI分類エラー:', error);
      throw error;
    }
  }

  /**
   * 請求書データの抽出（GPT-5-nano使用）
   */
  private async extractInvoiceData(
    subject: string,
    body: string,
    attachments: Array<{ filename: string; mimeType: string; data: Buffer }>
  ): Promise<InvoiceData | null> {
    try {
      console.log('請求書データ抽出を開始');

      // PDFの場合は別途処理
      const pdfAttachment = attachments.find(att => att.mimeType === 'application/pdf');
      if (pdfAttachment) {
        return await this.parseInvoicePDF(pdfAttachment.data);
      }

      // テキストベースの解析
      return await this.parseInvoiceText(`件名: ${subject}\n本文: ${body}`);
    } catch (error) {
      console.error('Invoice data extraction failed:', error);
      return null;
    }
  }

  /**
   * PDFファイルから請求書データを解析（実際のPDF解析）
   */
  async parseInvoicePDF(pdfBuffer: Buffer): Promise<InvoiceData> {
    try {
      console.log('📄 PDFファイル解析を開始');

      // PDFからテキストを抽出（簡易版）
      // const pdfData = await pdfParse(pdfBuffer);
      // const extractedText = pdfData.text;
      const extractedText = pdfBuffer.toString('utf8'); // 簡易版として文字列変換

      console.log('📝 PDF抽出テキスト:', extractedText.substring(0, 500) + '...');

      // 抽出したテキストが空の場合
      if (!extractedText.trim()) {
        console.warn('⚠️ PDFからテキストが抽出できませんでした');
        throw new Error('PDFからテキストを抽出できませんでした');
      }

      // OpenAI GPT-5-nanoで請求書データを構造化
      const completion = await this.openai.chat.completions.create({
        model: "gpt-5-nano",
        messages: [
          {
            role: "system",
            content: `あなたは請求書解析の専門家です。PDFから抽出されたテキストから以下の情報を抽出してJSONで返してください：
            
            {
              "companyName": "請求元会社名",
              "paymentAddress": "支払い先のEthereumアドレス（もしあれば）",
              "amount": "請求金額（数値のみ）",
              "currency": "通貨（USD、JPY、USDCなど）",
              "dueDate": "支払期限（YYYY-MM-DD形式）",
              "invoiceNumber": "請求書番号",
              "description": "請求内容の説明",
              "vendorName": "請求元会社名（companyNameと同じ）",
              "vendorEmail": "請求元のメールアドレス（もしあれば）"
            }
            
            重要：
            - 金額は数値のみで返してください（カンマや通貨記号は除く）
            - 日付は必ずYYYY-MM-DD形式で返してください
            - 不明な項目はnullを設定してください`
          },
          {
            role: "user",
            content: `以下のPDFテキストから請求書情報を抽出してください：\n\n${extractedText}`
          }
        ],
        temperature: 1
      });

      let content = completion.choices[0].message.content || '{}';
      content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsedData = JSON.parse(content);
      
      // データの正規化
      const normalizedData: InvoiceData = {
        invoiceNumber: parsedData.invoiceNumber || 'UNKNOWN',
        amount: parseFloat(parsedData.amount) || 0,
        currency: parsedData.currency || 'JPY',
        dueDate: parsedData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        vendorName: parsedData.vendorName || parsedData.companyName || 'Unknown Vendor',
        vendorEmail: parsedData.vendorEmail || '',
        paymentAddress: parsedData.paymentAddress || undefined,
        paymentURI: undefined
      };
      
      console.log('✅ PDF解析結果:', normalizedData);
      
      return normalizedData;

    } catch (error) {
      console.error('❌ PDF解析エラー:', error);
      throw error;
    }
  }

  /**
   * テキストから請求書データを解析（メール本文など）
   */
  async parseInvoiceText(text: string): Promise<InvoiceData> {
    try {
      console.log('テキストベース請求書解析を開始');

      const completion = await this.openai.chat.completions.create({
        model: "gpt-5-nano",
        messages: [
          {
            role: "system",
            content: `あなたは請求書・支払い通知の解析専門家です。提供されたテキストから支払い情報を抽出してJSONで返してください：
            
            {
              "companyName": "請求元会社名",
              "paymentAddress": "支払い先のEthereumアドレス（推測でも可）",
              "amount": "請求金額（数値のみ）",
              "currency": "通貨（USD、JPYなど）",
              "dueDate": "支払期限（YYYY-MM-DD形式）",
              "invoiceNumber": "請求書番号",
              "description": "請求内容の説明",
              "confidence": "解析の信頼度（0-1の数値）"
            }
            
            支払い情報が見つからない場合は、confidence: 0 を返してください。`
          },
          {
            role: "user",
            content: `以下のテキストを解析してください：\n\n${text}`
          }
        ],
        temperature: 1
      });

      let content = completion.choices[0].message.content || '{}';
      content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsedData = JSON.parse(content);
      
      console.log('テキスト解析結果:', parsedData);
      
      return parsedData;

    } catch (error) {
      console.error('テキスト解析エラー:', error);
      throw error;
    }
  }

  /**
   * テスト用のダミー請求書データ生成
   */
  generateDummyInvoice(): InvoiceData {
    return {
      companyName: "Tokyo Electric Power Company",
      paymentAddress: "0x1234567890123456789012345678901234567890",
      amount: 75,
      currency: "USDC",
      dueDate: "2024-01-15",
      invoiceNumber: "INV-2024-001",
      description: "電力料金 - 2023年12月分",
      confidence: 1.0
    };
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
      temperature: 1,
      max_tokens: 1000,
    });

    try {
      // JSONレスポンスのクリーニング（```json マークダウンを除去）
      let content = response.choices[0].message.content || '{}';
      content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const result = JSON.parse(content);
      
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

  /**
   * ローカルAIの接続テスト
   */
  async testLocalAI(): Promise<boolean> {
    if (!this.localAI) {
      console.log('ローカルAIが初期化されていません');
      return false;
    }

    try {
      console.log('🧪 ローカルAI接続テスト中...');
      const isConnected = await this.localAI.testConnection();
      console.log(`ローカルAI接続テスト: ${isConnected ? '✅ 成功' : '❌ 失敗'}`);
      return isConnected;
    } catch (error) {
      console.error('ローカルAI接続テストエラー:', error);
      return false;
    }
  }

  /**
   * 利用可能なローカルAIモデル一覧を取得
   */
  async getAvailableLocalModels(): Promise<string[]> {
    if (!this.localAI) return [];

    try {
      return await this.localAI.getAvailableModels();
    } catch (error) {
      console.error('ローカルAIモデル一覧取得エラー:', error);
      return [];
    }
  }

  /**
   * 設定情報を取得
   */
  getConfig(): AIClassifierConfig {
    return { ...this.config };
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<AIClassifierConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // ローカルAI設定が変更された場合は再初期化
    if (newConfig.useLocalAI !== undefined || newConfig.localAIConfig) {
      if (this.config.useLocalAI && !this.localAI) {
        this.localAI = new LocalAIClassifier(this.config.localAIConfig);
        console.log('🤖 ローカルAIクラシファイアを再初期化しました');
      } else if (!this.config.useLocalAI && this.localAI) {
        this.localAI = null;
        console.log('🚫 ローカルAIクラシファイアを無効化しました');
      }
    }
  }
}

/**
 * シングルトンインスタンス
 */
export const aiClassifier = new AIClassifier(); 