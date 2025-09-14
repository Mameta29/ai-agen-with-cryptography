import { GmailService, GmailMessage, InvoiceData, ScheduleData } from './gmail';
import { CalendarService } from './calendar';
import { RealLocalAI, RealAIAnalysis } from './real-local-ai';
import { IntegratedAIZkVMSystem, DynamicPolicy, PaymentIntent, ZkVMEvaluation } from './integrated-ai-zkvm';
import { RealPaymentExecutor, PaymentRequest, PaymentResult } from './real-payment-executor';
import { ZkVMPolicyEngine } from './zkvm-policy-engine';
import { OAuth2Client } from 'google-auth-library';

export interface ProcessingResult {
  messageId: string;
  type: 'invoice' | 'schedule' | 'other';
  success: boolean;
  action: string;
  details?: {
    // AI Analysis
    aiAnalysis?: RealAIAnalysis;
    
    // Schedule processing
    calendarEventId?: string;
    calendarEventUrl?: string;
    
    // Invoice processing with integrated system
    paymentIntent?: PaymentIntent;
    dynamicPolicy?: DynamicPolicy;
    zkVMEvaluation?: ZkVMEvaluation;
    paymentResult?: PaymentResult;
    
    // Common
    error?: string;
    warnings?: string[];
    processingTime?: number;
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
  
  // Local AI configuration
  localAI: {
    enabled: boolean;
    apiUrl: string;
    model: string;
    fallbackToPatternMatching: boolean;
  };
  
  // zkVM configuration
  zkVM: {
    enabled: boolean;
    hostBinaryPath: string;
    timeout: number;
  };
  
  // Payment configuration
  payment: {
    enabled: boolean;
    network: string;
    whitelistedAddresses: string[];
    maxAmount: number;
  };
  
  // User policy settings
  userPolicy: {
    maxPerPayment: number;
    maxPerDay: number;
    maxPerWeek: number;
    allowedVendors: string[];
    allowedHours: { start: number; end: number };
    allowedWeekdays: number[];
    categoryRules: Record<string, { maxAmount: number; requireApproval: boolean }>;
    conditionalRules: Array<{
      condition: string;
      action: 'approve' | 'reject' | 'require_approval';
      parameters?: Record<string, any>;
    }>;
    minAIConfidence: number;
  };
}

export class EmailProcessor {
  private gmailService: GmailService;
  private calendarService: CalendarService;
  private localAI: RealLocalAI;
  private integratedSystem: IntegratedAIZkVMSystem;
  private paymentExecutor: RealPaymentExecutor;
  private config: ProcessingConfig;

  constructor(config: ProcessingConfig) {
    this.config = config;
    
    // Initialize services
    this.gmailService = new GmailService(config.gmailCredentials);
    this.calendarService = new CalendarService();
    
    // Initialize integrated AI system
    if (config.localAI.enabled) {
      this.localAI = new RealLocalAI();
    }
    
    // Initialize integrated zkVM system
    this.integratedSystem = new IntegratedAIZkVMSystem();
    
    // Initialize payment system
    if (config.payment.enabled) {
      this.paymentExecutor = new RealPaymentExecutor();
    }

    console.log('📧 Email Processor initialized with integrated AI + zkVM + Payment system');
  }

  /**
   * 新着メールを処理（統合システム使用）
   */
  async processNewEmails(): Promise<ProcessingResult[]> {
    try {
      console.log('📨 Processing new emails with integrated system...');

      const messages = await this.gmailService.getNewMessages();
      console.log(`📬 Found ${messages.length} new messages`);

      const results: ProcessingResult[] = [];
      
      for (const message of messages) {
        try {
          const result = await this.processMessage(message);
          results.push(result);
          
          // Add processing delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`❌ Error processing message ${message.id}:`, error);
          results.push({
            messageId: message.id,
            type: 'other',
            success: false,
            action: 'error',
            details: {
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        }
      }

      console.log(`✅ Processed ${results.length} messages`);
      return results;

    } catch (error) {
      console.error('❌ Failed to process emails:', error);
      throw error;
    }
  }

  /**
   * 個別メッセージの処理（統合システム）
   */
  private async processMessage(message: GmailMessage): Promise<ProcessingResult> {
    const startTime = Date.now();
    console.log(`📨 Processing message: ${message.id}`);
    
    // メール内容を抽出
    const { subject, body, from, attachments } = this.extractMessageContent(message);

    // セキュリティチェック
    const securityCheck = await this.gmailService.performSecurityCheck(message);
    if (securityCheck.phishingSuspected || securityCheck.riskScore > 0.95) {
      console.warn('⚠️ Security risk detected, blocking message');
      return {
        messageId: message.id,
        type: 'other',
        success: false,
        action: 'blocked_security',
        details: {
          warnings: ['Security risk detected']
        }
      };
    }

    // AI分析（ローカルAI使用）
    console.log('🤖 Analyzing with local AI...');
    const aiAnalysis = await this.localAI.analyzeEmail(body, subject);
    
    console.log(`📊 Classification: ${aiAnalysis.type} (confidence: ${aiAnalysis.confidence})`);

    // 分類に応じた処理
    switch (aiAnalysis.type) {
      case 'INVOICE':
        return await this.processInvoice(message, aiAnalysis, body, startTime);
      
      case 'SCHEDULE':
        return await this.processSchedule(message, aiAnalysis, body, startTime);
      
      default:
        return {
          messageId: message.id,
          type: 'other',
          success: true,
          action: 'classified_other',
          details: {
            aiAnalysis,
            processingTime: Date.now() - startTime,
          }
        };
    }
  }

  /**
   * 請求書処理（統合システム）
   */
  private async processInvoice(
    message: GmailMessage, 
    aiAnalysis: RealAIAnalysis, 
    emailContent: string,
    startTime: number
  ): Promise<ProcessingResult> {
    try {
      console.log('💳 Processing invoice with integrated system...');

      // Step 1: AIの結果からPaymentIntentを生成
      const paymentIntent = this.integratedSystem.generateIntentFromAI({
        type: aiAnalysis.type,
        confidence: aiAnalysis.confidence,
        extractedData: aiAnalysis.extractedData,
        reasoning: aiAnalysis.reasoning,
      }, emailContent);

      if (!paymentIntent) {
        return {
          messageId: message.id,
          type: 'invoice',
          success: false,
          action: 'intent_generation_failed',
          details: {
            aiAnalysis,
            error: 'Could not generate payment intent from AI analysis',
            processingTime: Date.now() - startTime,
          }
        };
      }

      // Step 2: 動的ポリシーを作成
      const dynamicPolicy = this.createUserPolicy();

      // Step 3: zkVMで統合評価
      const zkVMEvaluation = await this.integratedSystem.evaluateWithZkVM(
        paymentIntent,
        dynamicPolicy
      );

      console.log(`📊 Policy evaluation: ${zkVMEvaluation.approved ? 'APPROVED' : 'REJECTED'}`);

      // Step 4: 承認された場合の送金実行
      let paymentResult: PaymentResult | undefined;
      
      if (zkVMEvaluation.approved && this.config.payment.enabled) {
        console.log('💸 Executing payment...');
        
        const paymentRequest: PaymentRequest = {
          to: paymentIntent.recipient,
          amount: paymentIntent.amount,
          reason: `Automated payment: ${paymentIntent.aiExtracted.invoiceNumber}`,
          intentHash: this.generateHash(paymentIntent),
          policyHash: this.generateHash(dynamicPolicy),
          zkpProof: zkVMEvaluation.zkpReceipt,
        };

        paymentResult = await this.paymentExecutor.executePayment(paymentRequest);
        
        if (paymentResult.success) {
          console.log(`✅ Payment executed: ${paymentResult.transactionHash}`);
          
          // Add Gmail label
          await this.gmailService.addLabel(message.id, 'Paid (Automated)');
        }
      } else {
        console.log('❌ Payment not approved or payment system disabled');
      }

      return {
        messageId: message.id,
        type: 'invoice',
        success: true,
        action: zkVMEvaluation.approved ? 'payment_executed' : 'payment_rejected',
        details: {
          aiAnalysis,
          paymentIntent,
          dynamicPolicy,
          zkVMEvaluation,
          paymentResult,
          processingTime: Date.now() - startTime,
        }
      };

    } catch (error) {
      console.error('❌ Invoice processing error:', error);
      return {
        messageId: message.id,
        type: 'invoice',
        success: false,
        action: 'processing_error',
        details: {
          aiAnalysis,
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTime: Date.now() - startTime,
        }
      };
    }
  }

  /**
   * スケジュール処理
   */
  private async processSchedule(
    message: GmailMessage,
    aiAnalysis: RealAIAnalysis,
    emailContent: string,
    startTime: number
  ): Promise<ProcessingResult> {
    try {
      console.log('📅 Processing schedule...');

      if (!aiAnalysis.extractedData.title || !aiAnalysis.extractedData.startDate) {
        throw new Error('Insufficient schedule data extracted');
      }

      // Calendar event creation
      const eventData = {
        summary: aiAnalysis.extractedData.title,
        start: { dateTime: aiAnalysis.extractedData.startDate },
        end: { dateTime: aiAnalysis.extractedData.endDate || aiAnalysis.extractedData.startDate },
        location: aiAnalysis.extractedData.location,
      };

      const eventId = await this.calendarService.createEvent(eventData);
      
      // Add Gmail label
      await this.gmailService.addLabel(message.id, 'Scheduled');

      console.log(`✅ Calendar event created: ${eventId}`);

      return {
        messageId: message.id,
        type: 'schedule',
        success: true,
        action: 'calendar_event_created',
        details: {
          aiAnalysis,
          calendarEventId: eventId,
          processingTime: Date.now() - startTime,
        }
      };

    } catch (error) {
      console.error('❌ Schedule processing error:', error);
      return {
        messageId: message.id,
        type: 'schedule',
        success: false,
        action: 'processing_error',
        details: {
          aiAnalysis,
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTime: Date.now() - startTime,
        }
      };
    }
  }

  /**
   * ユーザーポリシーを動的ポリシーに変換
   */
  private createUserPolicy(): DynamicPolicy {
    return this.integratedSystem.createDynamicPolicy('main_user', this.config.userPolicy);
  }

  /**
   * メール内容抽出
   */
  private extractMessageContent(message: GmailMessage): {
    subject: string;
    body: string;
    from: string;
    attachments: Array<{ filename: string; mimeType: string; data: Buffer }>;
  } {
    const headers = message.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const from = headers.find(h => h.name === 'From')?.value || '';

    let body = '';
    const attachments: Array<{ filename: string; mimeType: string; data: Buffer }> = [];

    // Extract body content
    if (message.payload.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString();
    } else if (message.payload.parts) {
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body += Buffer.from(part.body.data, 'base64').toString();
        }
        
        // Handle attachments
        if (part.filename && part.body?.data) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            data: Buffer.from(part.body.data, 'base64')
          });
        }
      }
    }

    return { subject, body, from, attachments };
  }

  /**
   * ハッシュ生成
   */
  private generateHash(data: any): string {
    return require('crypto').createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  /**
   * システム設定を取得
   */
  getSystemConfig() {
    return {
      localAI: this.config.localAI,
      zkVM: this.config.zkVM,
      payment: this.config.payment,
      userPolicy: this.config.userPolicy,
    };
  }

  /**
   * システム状態を確認
   */
  async checkSystemHealth(): Promise<{
    localAI: boolean;
    zkVM: boolean;
    payment: boolean;
    gmail: boolean;
  }> {
    const health = {
      localAI: false,
      zkVM: false,
      payment: false,
      gmail: false,
    };

    try {
      // Local AI health check
      if (this.localAI) {
        health.localAI = await this.localAI.testConnection();
      }

      // zkVM health check
      const zkVMEngine = new ZkVMPolicyEngine();
      health.zkVM = await zkVMEngine.checkAvailability();

      // Payment system health check
      if (this.paymentExecutor) {
        const balance = await this.paymentExecutor.getBalance();
        health.payment = parseFloat(balance) > 0;
      }

      // Gmail health check
      health.gmail = await this.gmailService.testConnection();

    } catch (error) {
      console.error('Health check error:', error);
    }

    return health;
  }

  /**
   * デフォルト設定を取得
   */
  static getDefaultConfig(): ProcessingConfig {
    return {
      gmailCredentials: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
      },
      localAI: {
        enabled: process.env.USE_LOCAL_AI === 'true',
        apiUrl: process.env.LOCAL_AI_URL || 'http://localhost:11434',
        model: process.env.LOCAL_AI_MODEL || 'llama3.1:8b',
        fallbackToPatternMatching: true,
      },
      zkVM: {
        enabled: true,
        hostBinaryPath: 'zk/risc0/zkvm-policy-engine/target/debug/host',
        timeout: 60000,
      },
      payment: {
        enabled: process.env.ENABLE_PAYMENTS === 'true',
        network: 'sepolia',
        whitelistedAddresses: [
          '0xE2F2E032B02584e81437bA8Df18F03d6771F9d23',
          '0xF2431b618B5b02923922c525885DBfFcdb9DE853',
        ],
        maxAmount: 1000000, // 100万円
      },
      userPolicy: {
        maxPerPayment: 200000,
        maxPerDay: 1000000,
        maxPerWeek: 5000000,
        allowedVendors: [],
        allowedHours: { start: 9, end: 18 },
        allowedWeekdays: [1, 2, 3, 4, 5],
        categoryRules: {
          'cloud-services': { maxAmount: 300000, requireApproval: false },
          'software': { maxAmount: 200000, requireApproval: true },
          'utilities': { maxAmount: 100000, requireApproval: false },
        },
        conditionalRules: [
          {
            condition: 'amount > 150000',
            action: 'require_approval',
            parameters: { reason: 'High amount requires approval' },
          },
          {
            condition: 'ai_confidence < 0.8',
            action: 'require_approval',
            parameters: { reason: 'Low AI confidence' },
          },
        ],
        minAIConfidence: 0.7,
      },
    };
  }
} 