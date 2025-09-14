import { InvoiceData, ScheduleData } from './gmail';

export interface EmailClassification {
  type: 'INVOICE' | 'SCHEDULE' | 'OTHER';
  confidence: number;
  extracted_data: InvoiceData | ScheduleData | null;
  reasoning: string;
}

export interface LocalAIConfig {
  apiUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

export class LocalAIClassifier {
  private config: LocalAIConfig;

  constructor(config?: Partial<LocalAIConfig>) {
    this.config = {
      apiUrl: process.env.LOCAL_AI_URL || 'http://localhost:11434',
      model: process.env.LOCAL_AI_MODEL || 'llama3.1:8b',
      temperature: 0.1,
      maxTokens: 1000,
      timeout: 30000,
      ...config
    };
  }

  /**
   * メールを分類し、関連データを抽出
   */
  async classifyEmail(emailContent: string, subject?: string): Promise<EmailClassification> {
    try {
      console.log('🤖 ローカルAIでメール分析を開始...');
      const startTime = Date.now();

      const prompt = this.buildClassificationPrompt(emailContent, subject);
      
      const response = await this.callOllama(prompt);
      const result = this.parseClassificationResult(response);

      const duration = Date.now() - startTime;
      console.log(`✅ ローカルAI分析完了 (${duration}ms)`);

      return result;
    } catch (error) {
      console.error('❌ ローカルAI分析エラー:', error);
      
      // フォールバック: 基本的なキーワード分析
      return this.fallbackClassification(emailContent, subject);
    }
  }

  /**
   * 請求書データの詳細抽出
   */
  async extractInvoiceDetails(emailContent: string): Promise<InvoiceData> {
    const prompt = this.buildInvoiceExtractionPrompt(emailContent);
    const response = await this.callOllama(prompt);
    return this.parseInvoiceData(response);
  }

  /**
   * スケジュールデータの詳細抽出
   */
  async extractScheduleDetails(emailContent: string): Promise<ScheduleData> {
    const prompt = this.buildScheduleExtractionPrompt(emailContent);
    const response = await this.callOllama(prompt);
    return this.parseScheduleData(response);
  }

  /**
   * Ollamaへのリクエスト送信
   */
  private async callOllama(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.apiUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt,
          stream: false,
          options: {
            temperature: this.config.temperature,
            num_predict: this.config.maxTokens,
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.response;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * 分類用プロンプト生成
   */
  private buildClassificationPrompt(emailContent: string, subject?: string): string {
    return `
あなたは優秀なメール分析AIです。以下のメールを分析し、JSON形式で結果を返してください。

分類タイプ:
- INVOICE: 請求書、支払い要求、料金通知
- SCHEDULE: 会議、予定、イベントの招待
- OTHER: その他

メール件名: ${subject || 'なし'}

メール本文:
${emailContent}

以下のJSON形式で回答してください:
{
  "type": "INVOICE|SCHEDULE|OTHER",
  "confidence": 0.95,
  "reasoning": "分類の理由を日本語で説明",
  "extracted_data": {
    // INVOICEの場合
    "amount": 50000,
    "vendorName": "会社名",
    "vendorEmail": "example@company.com",
    "dueDate": "2025-01-31",
    "invoiceNumber": "INV-2025-001",
    "currency": "JPY",
    
    // SCHEDULEの場合
    "title": "会議のタイトル",
    "startDate": "2025-01-15T10:00:00Z",
    "endDate": "2025-01-15T11:00:00Z",
    "location": "会議室A",
    "description": "会議の説明"
  }
}

重要: JSON以外の文字は出力しないでください。
`;
  }

  /**
   * 請求書抽出用プロンプト
   */
  private buildInvoiceExtractionPrompt(emailContent: string): string {
    return `
以下のメールから請求書情報を抽出し、JSON形式で返してください:

${emailContent}

{
  "invoiceNumber": "請求書番号",
  "amount": 金額（数値）,
  "currency": "JPY",
  "dueDate": "支払期日（YYYY-MM-DD形式）",
  "vendorName": "請求元会社名",
  "vendorEmail": "請求元メールアドレス",
  "paymentAddress": "支払い先アドレス（あれば）",
  "paymentURI": "支払いURI（あれば）"
}
`;
  }

  /**
   * スケジュール抽出用プロンプト
   */
  private buildScheduleExtractionPrompt(emailContent: string): string {
    return `
以下のメールからスケジュール情報を抽出し、JSON形式で返してください:

${emailContent}

{
  "title": "イベント/会議のタイトル",
  "startDate": "開始時刻（ISO 8601形式）",
  "endDate": "終了時刻（ISO 8601形式）",
  "location": "場所",
  "meetingUrl": "オンライン会議URL（あれば）",
  "description": "詳細説明"
}
`;
  }

  /**
   * 分類結果をパース
   */
  private parseClassificationResult(response: string): EmailClassification {
    try {
      // JSONの開始と終了を見つけて抽出
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSONが見つかりません');
      }

      const result = JSON.parse(jsonMatch[0]);
      
      return {
        type: result.type || 'OTHER',
        confidence: result.confidence || 0.5,
        extracted_data: result.extracted_data || null,
        reasoning: result.reasoning || 'AIによる分析結果'
      };
    } catch (error) {
      console.warn('AI応答のパースに失敗:', error);
      return {
        type: 'OTHER',
        confidence: 0.1,
        extracted_data: null,
        reasoning: 'パースエラーのため分類できませんでした'
      };
    }
  }

  /**
   * 請求書データをパース
   */
  private parseInvoiceData(response: string): InvoiceData {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      
      return {
        invoiceNumber: data.invoiceNumber || '',
        amount: data.amount || 0,
        currency: data.currency || 'JPY',
        dueDate: data.dueDate || '',
        vendorName: data.vendorName || 'Unknown Vendor',
        vendorEmail: data.vendorEmail || '',
        paymentAddress: data.paymentAddress,
        paymentURI: data.paymentURI
      };
    } catch (error) {
      console.warn('請求書データのパースに失敗:', error);
      return {
        invoiceNumber: '',
        amount: 0,
        currency: 'JPY',
        dueDate: '',
        vendorName: 'Parse Error',
        vendorEmail: ''
      };
    }
  }

  /**
   * スケジュールデータをパース
   */
  private parseScheduleData(response: string): ScheduleData {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      
      return {
        title: data.title || 'Unknown Event',
        startDate: data.startDate || new Date().toISOString(),
        endDate: data.endDate || new Date(Date.now() + 3600000).toISOString(),
        location: data.location || '',
        meetingUrl: data.meetingUrl || '',
        description: data.description || ''
      };
    } catch (error) {
      console.warn('スケジュールデータのパースに失敗:', error);
      return {
        title: 'Parse Error',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 3600000).toISOString(),
        location: '',
        meetingUrl: '',
        description: 'パースエラー'
      };
    }
  }

  /**
   * フォールバック分類（AIが利用できない場合）
   */
  private fallbackClassification(emailContent: string, subject?: string): EmailClassification {
    const content = `${subject || ''} ${emailContent}`.toLowerCase();
    
    // 請求書キーワード
    const invoiceKeywords = ['請求', '支払', '料金', '金額', '円', 'yen', 'invoice', 'payment', 'bill'];
    const invoiceScore = invoiceKeywords.reduce((score, keyword) => 
      content.includes(keyword) ? score + 1 : score, 0);

    // スケジュールキーワード  
    const scheduleKeywords = ['会議', '予定', 'ミーティング', '打ち合わせ', 'meeting', 'schedule', '招待'];
    const scheduleScore = scheduleKeywords.reduce((score, keyword) => 
      content.includes(keyword) ? score + 1 : score, 0);

    if (invoiceScore > scheduleScore && invoiceScore > 0) {
      return {
        type: 'INVOICE',
        confidence: Math.min(invoiceScore * 0.2, 0.8),
        extracted_data: null,
        reasoning: 'キーワードベース分析による請求書判定'
      };
    } else if (scheduleScore > 0) {
      return {
        type: 'SCHEDULE',
        confidence: Math.min(scheduleScore * 0.2, 0.8),
        extracted_data: null,
        reasoning: 'キーワードベース分析によるスケジュール判定'
      };
    } else {
      return {
        type: 'OTHER',
        confidence: 0.5,
        extracted_data: null,
        reasoning: 'キーワードベース分析で特定のカテゴリに該当せず'
      };
    }
  }

  /**
   * 接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.config.apiUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('Ollama接続テスト失敗:', error);
      return false;
    }
  }

  /**
   * 利用可能なモデル一覧を取得
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/tags`);
      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      console.error('モデル一覧取得失敗:', error);
      return [];
    }
  }
} 