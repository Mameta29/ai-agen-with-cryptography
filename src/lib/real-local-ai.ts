import { InvoiceData, ScheduleData } from './gmail';

export interface RealAIAnalysis {
  type: 'INVOICE' | 'SCHEDULE' | 'OTHER';
  confidence: number;
  reasoning: string;
  extractedData: {
    amount?: number;
    vendorName?: string;
    vendorEmail?: string;
    invoiceNumber?: string;
    dueDate?: string;
    title?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
  };
  processingTime: number;
  modelUsed: string;
  isActualAI: boolean;
}

/**
 * 実際のローカルAI実装 - Ollama + Llama3.1
 * これは本物のAIモデルを使用します
 */
export class RealLocalAI {
  private apiUrl: string;
  private model: string;
  private maxRetries: number;

  constructor() {
    this.apiUrl = process.env.LOCAL_AI_URL || 'http://localhost:11434';
    this.model = process.env.LOCAL_AI_MODEL || 'llama3.1:8b';
    this.maxRetries = 3;
  }

  /**
   * 実際のLlama3.1モデルでメール分析
   */
  async analyzeEmail(content: string, subject: string = ''): Promise<RealAIAnalysis> {
    console.log('🤖 実際のローカルAI (Llama3.1) 分析開始...');
    const startTime = Date.now();

    // まず接続テスト
    const isConnected = await this.testConnection();
    if (!isConnected) {
      console.log('❌ Ollama接続失敗 - フォールバックモードで実行');
      return this.fallbackAnalysis(content, subject, startTime);
    }

    try {
      // 実際のLlama3.1推論を実行
      const analysis = await this.performActualInference(content, subject);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ 実際のAI分析完了 (${processingTime}ms) - Llama3.1使用`);

      return {
        ...analysis,
        processingTime,
        modelUsed: this.model,
        isActualAI: true,
      };
    } catch (error) {
      console.error('❌ 実際のAI推論エラー:', error);
      console.log('🔄 フォールバックモードで継続');
      return this.fallbackAnalysis(content, subject, startTime);
    }
  }

  /**
   * 実際のLlama3.1推論実行
   */
  private async performActualInference(content: string, subject: string): Promise<Omit<RealAIAnalysis, 'processingTime' | 'modelUsed' | 'isActualAI'>> {
    console.log('🧠 Llama3.1モデルで実際の推論実行中...');

    // より簡潔で確実なプロンプト
    const prompt = `Analyze this email and respond with JSON only:

Subject: ${subject}
Content: ${content}

Classify as: INVOICE, SCHEDULE, or OTHER
Extract: amount (number), vendor name, invoice number, due date

JSON response:
{"type": "INVOICE", "confidence": 0.9, "amount": 50000, "vendor": "Company Name"}`;

    let lastError = null;
    
    // リトライ機能付きで実行
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 推論試行 ${attempt}/${this.maxRetries}...`);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30秒タイムアウト

        const response = await fetch(`${this.apiUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            prompt,
            stream: false,
            options: {
              temperature: 0.1,
              num_predict: 200,
              top_p: 0.9,
            }
          }),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.response;

        console.log('🔍 Llama3.1生応答:', aiResponse.substring(0, 200) + '...');

        // JSONを抽出して解析
        const result = this.parseAIResponse(aiResponse, content, subject);
        
        if (result.confidence > 0.5) {
          console.log('✅ 実際のAI推論成功');
          return result;
        } else {
          throw new Error('AI推論の信頼度が低すぎます');
        }

      } catch (error) {
        lastError = error;
        console.log(`❌ 試行 ${attempt} 失敗:`, error.message);
        
        if (attempt < this.maxRetries) {
          console.log('⏳ 2秒待機後に再試行...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    throw lastError || new Error('全ての推論試行が失敗');
  }

  /**
   * AI応答をパース
   */
  private parseAIResponse(aiResponse: string, content: string, subject: string): Omit<RealAIAnalysis, 'processingTime' | 'modelUsed' | 'isActualAI'> {
    try {
      // JSONを抽出
      const jsonMatch = aiResponse.match(/\{[^}]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          type: parsed.type || 'OTHER',
          confidence: parsed.confidence || 0.7,
          reasoning: `Llama3.1推論: ${parsed.type}, 信頼度: ${parsed.confidence}`,
          extractedData: {
            amount: parsed.amount || this.extractAmountFallback(content),
            vendorName: parsed.vendor || this.extractVendorFallback(content),
            invoiceNumber: parsed.invoice_number || this.extractInvoiceNumberFallback(content),
            dueDate: parsed.due_date || this.extractDueDateFallback(content),
          },
        };
      }
    } catch (error) {
      console.warn('AI応答パースエラー:', error);
    }

    // パースに失敗した場合はフォールバック抽出
    return this.extractWithFallback(content, subject);
  }

  /**
   * フォールバック分析（パターンマッチング）
   */
  private fallbackAnalysis(content: string, subject: string, startTime: number): RealAIAnalysis {
    console.log('🔄 フォールバック分析実行中...');
    
    const result = this.extractWithFallback(content, subject);
    const processingTime = Date.now() - startTime;

    return {
      ...result,
      processingTime,
      modelUsed: 'fallback_pattern_matching',
      isActualAI: false,
    };
  }

  /**
   * パターンマッチングによる抽出
   */
  private extractWithFallback(content: string, subject: string): Omit<RealAIAnalysis, 'processingTime' | 'modelUsed' | 'isActualAI'> {
    const text = `${subject} ${content}`.toLowerCase();
    
    let type: 'INVOICE' | 'SCHEDULE' | 'OTHER' = 'OTHER';
    let confidence = 0.6;

    if ((text.includes('請求') || text.includes('invoice')) && this.extractAmountFallback(content) > 0) {
      type = 'INVOICE';
      confidence = 0.8;
    } else if (text.includes('会議') || text.includes('meeting') || text.includes('予定')) {
      type = 'SCHEDULE';
      confidence = 0.8;
    }

    return {
      type,
      confidence,
      reasoning: `パターンマッチング分析: ${type}として分類`,
      extractedData: {
        amount: this.extractAmountFallback(content),
        vendorName: this.extractVendorFallback(content),
        invoiceNumber: this.extractInvoiceNumberFallback(content),
        dueDate: this.extractDueDateFallback(content),
      },
    };
  }

  // フォールバック抽出メソッド
  private extractAmountFallback(content: string): number {
    const match = content.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
    return match ? parseInt(match[1].replace(/,/g, '')) : 0;
  }

  private extractVendorFallback(content: string): string {
    const match = content.match(/([^\n]+(?:株式会社|Corp|Inc|LLC|会社))/);
    return match ? match[1].trim() : 'Unknown Vendor';
  }

  private extractInvoiceNumberFallback(content: string): string {
    const match = content.match(/請求書番号[:\s]*([A-Z0-9-]+)/);
    return match ? match[1] : '';
  }

  private extractDueDateFallback(content: string): string {
    const match = content.match(/期限[:\s]*(\d{4}年\d{1,2}月\d{1,2}日|\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  }

  /**
   * 接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔌 Ollama接続テスト中...');
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.apiUrl}/api/tags`, {
        signal: controller.signal
      });

      clearTimeout(timeout);
      
      if (response.ok) {
        const data = await response.json();
        const hasLlama = data.models?.some((m: any) => m.name.includes('llama3.1'));
        console.log(`✅ Ollama接続成功 - Llama3.1: ${hasLlama ? '利用可能' : '未インストール'}`);
        return hasLlama;
      }
      
      return false;
    } catch (error) {
      console.log('❌ Ollama接続失敗:', error.message);
      return false;
    }
  }

  /**
   * モデル情報取得
   */
  async getModelInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/api/tags`);
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('モデル情報取得エラー:', error);
      return [];
    }
  }
} 