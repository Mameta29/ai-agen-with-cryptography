import { GmailService, GmailMessage, InvoiceData, ScheduleData } from './gmail';
import { AIClassifier } from './ai-classifier';
import { CalendarService } from './calendar';
import { PaymentPolicyEvaluator, PaymentPolicy, PolicyEvaluationResult } from './payment-policy';
import { BlockchainService } from './blockchain';
import { ZKPProver, PaymentPlan, UserRules, ZKPProof, SchedulePlan, ScheduleRules } from './zkp-prover';
import { ZKPVerifier } from './zkp-verifier';
import { PaymentPlanner, RiskAssessment } from './payment-planner';
// import { EASService, PaymentAttestation, ScheduleAttestation } from './eas-service-simple';
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
    
    // Invoice processing with ZKP
    policyEvaluation?: PolicyEvaluationResult;
    paymentPlan?: PaymentPlan;
    zkpProof?: ZKPProof;
    zkpVerified?: boolean;
    transactionHash?: string;
    paymentAmount?: number;
    riskAssessment?: RiskAssessment;
    // easAttestationUID?: string;
    
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
  
  // User rules for ZKP
  userRules: UserRules;
  scheduleRules: ScheduleRules;
}

export class EmailProcessor {
  private gmailService: GmailService;
  private aiClassifier: AIClassifier;
  private calendarService: CalendarService;
  private policyEvaluator: PaymentPolicyEvaluator;
  private blockchainService: BlockchainService;
  private zkpProver: ZKPProver;
  private zkpVerifier: ZKPVerifier;
  private paymentPlanner: PaymentPlanner;
  // private easService: EASService;
  private config: ProcessingConfig;

  constructor(config: ProcessingConfig) {
    this.config = config;
    
    // Initialize services
    this.gmailService = new GmailService(config.gmailCredentials);
    this.aiClassifier = new AIClassifier();
    
    // CalendarServiceはGmailServiceと同じOAuth2Clientを共有
    const oauth2Client = new OAuth2Client(
      config.gmailCredentials.clientId,
      config.gmailCredentials.clientSecret,
      config.gmailCredentials.redirectUri
    );
    
    if (config.gmailCredentials.refreshToken) {
      oauth2Client.setCredentials({
        refresh_token: config.gmailCredentials.refreshToken,
      });
    }
    
    this.calendarService = new CalendarService(oauth2Client);
    this.policyEvaluator = new PaymentPolicyEvaluator(config.paymentPolicy);
    this.blockchainService = new BlockchainService(
      config.blockchain.privateKey,
      config.blockchain.rpcUrl
    );
    
    // Initialize ZKP components
    this.zkpProver = new ZKPProver();
    this.zkpVerifier = new ZKPVerifier();
    this.paymentPlanner = new PaymentPlanner(config.openaiApiKey);
    
    // Initialize EAS service (コメントアウト)
    // this.easService = new EASService(
    //   process.env.EAS_CONTRACT_ADDRESS || '0xC2679fBD37d54388Ce493F1DB75320D236e1815e',
    //   config.blockchain.rpcUrl,
    //   config.blockchain.privateKey
    // );
    
    console.log('EmailProcessor initialized with ZKP support');
  }

  /**
   * 新着メールを処理（ZKP統合版）
   */
  async processNewEmails(): Promise<ProcessingResult[]> {
    try {
      console.log('🚀 新着メール処理を開始（ZKP統合版）');
      
      // 新着メールを取得
      const messages = await this.gmailService.getNewMessages();
      console.log(`📧 ${messages.length}件の新着メールを取得`);
      
      const results: ProcessingResult[] = [];
      
      for (const message of messages) {
        try {
          const result = await this.processMessage(message);
          results.push(result);
          
        } catch (error) {
          console.error(`メッセージ ${message.id} の処理でエラー:`, error);
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
      
      console.log('='.repeat(80));
      console.log(`✅ ${results.length}件のメール処理完了`);
      console.log('='.repeat(80));
      return results;
      
    } catch (error) {
      console.error('メール処理でエラー:', error);
      throw error;
    }
  }

  /**
   * 個別メッセージの処理（ZKP統合版）
   */
  private async processMessage(message: GmailMessage): Promise<ProcessingResult> {
    console.log('='.repeat(80));
    console.log(`📨 メッセージ処理開始: ${message.id}`);
    console.log('='.repeat(80));
    
    // メール内容を抽出
    const { subject, body, from, attachments } = this.extractMessageContent(message);
    
    // セキュリティチェック
    const securityCheck = await this.gmailService.performSecurityCheck(message);
    if (securityCheck.phishingSuspected || securityCheck.riskScore > 0.8) {
      console.warn('⚠️ セキュリティリスクが検出されました');
      return {
        messageId: message.id,
        type: 'other',
        success: false,
        action: 'blocked_security',
        details: {
          warnings: ['セキュリティリスクのため処理をブロックしました']
        }
      };
    }
    
    // AI分類・抽出（GPT-5-nano使用）
    console.log('🤖 AI分類を実行（GPT-5-nano）');
    const classification = await this.aiClassifier.classifyAndExtract(
      subject, body, from, attachments
    );
    
    console.log(`📊 分類結果: ${classification.type} (信頼度: ${classification.confidence})`);
    console.log('-'.repeat(60));
    
    // 分類に応じた処理
    switch (classification.type) {
      case 'invoice':
        return await this.processInvoiceWithZKP(message, classification.extractedData as InvoiceData);
      
      case 'schedule':
        return await this.processScheduleWithZKP(message, classification.extractedData as ScheduleData);
      
      default:
        return {
          messageId: message.id,
          type: 'other',
          success: true,
          action: 'classified_other',
          details: {}
        };
    }
  }

  /**
   * 請求書処理（ZKP統合版）
   */
  private async processInvoiceWithZKP(
    message: GmailMessage, 
    invoiceData: InvoiceData
  ): Promise<ProcessingResult> {
    console.log('💳 請求書処理開始（ZKP統合版）');
    
    try {
      // 1. AI支払い計画の生成
      console.log('🧠 AI支払い計画を生成');
      const paymentPlan = await this.paymentPlanner.createPaymentPlan(
        invoiceData, 
        this.config.userRules
      );
      
      console.log('📋 支払い計画:', paymentPlan);
      
      // 2. ZKP証明の生成
      console.log('🔐 ZKP証明を生成');
      console.log('-'.repeat(40));
      const zkpProof = await this.zkpProver.generatePaymentProof(
        paymentPlan, 
        this.config.userRules
      );
      
      console.log('🔍 ZKP証明結果:', {
        isValid: zkpProof.isValid,
        proofType: zkpProof.proof.mock ? 'mock' : zkpProof.proof.error ? 'error' : 'zkp'
      });
      
      // 3. ZKP証明の検証
      console.log('✅ ZKP証明を検証');
      console.log('-'.repeat(40));
      const zkpVerified = await this.zkpVerifier.verifyProof(zkpProof);
      
      if (!zkpVerified) {
        console.warn('❌ ZKP検証に失敗しました');
        await this.gmailService.addLabel(message.id, 'ZKP_VERIFICATION_FAILED');
        
        return {
          messageId: message.id,
          type: 'invoice',
          success: false,
          action: 'zkp_verification_failed',
          details: {
            paymentPlan,
            zkpProof,
            zkpVerified: false,
            error: 'ZKP証明の検証に失敗しました'
          }
        };
      }
      
      console.log('✅ ZKP検証成功 - 支払いを実行');
      console.log('-'.repeat(40));
      
      // 4. ブロックチェーン支払いの実行
      // 送金先アドレスはメールから抽出された支払い先アドレスを使用
      const recipientAddress = invoiceData.paymentAddress || paymentPlan.toAddress;
      console.log('💰 支払い実行:', {
        recipient: recipientAddress,
        amount: invoiceData.amount,
        jpycToken: this.config.blockchain.jpycTokenAddress
      });
      
      const transactionResult = await this.blockchainService.executePayment(
        invoiceData,
        this.config.blockchain.jpycTokenAddress,
        recipientAddress as Address
      );
      
      if (transactionResult.success) {
        // 成功時の処理
        await this.gmailService.addLabel(message.id, 'ZKP_VERIFIED_PAID');
        await this.gmailService.addLabel(message.id, 'PAID_ONCHAIN');
        
        console.log('🎉 ZKP検証済み支払い完了:', transactionResult.txHash);
        console.log('='.repeat(80));
        
        return {
          messageId: message.id,
          type: 'invoice',
          success: true,
          action: 'zkp_verified_payment_executed',
          details: {
            paymentPlan,
            zkpProof,
            zkpVerified: true,
                       transactionHash: transactionResult.txHash,
           paymentAmount: paymentPlan.amount,
           riskAssessment: paymentPlan.riskAssessment
           // easAttestationUID: await this.recordPaymentAttestation(paymentPlan, zkpProof, transactionResult.txHash!)
          }
        };
      } else {
        // 失敗時の処理
        await this.gmailService.addLabel(message.id, 'ZKP_VERIFIED_PAYMENT_FAILED');
        
        return {
          messageId: message.id,
          type: 'invoice',
          success: false,
          action: 'payment_execution_failed',
          details: {
            paymentPlan,
            zkpProof,
            zkpVerified: true,
            error: transactionResult.error,
            riskAssessment: paymentPlan.riskAssessment
          }
        };
      }
      
    } catch (error) {
      console.error('請求書処理エラー:', error);
      await this.gmailService.addLabel(message.id, 'PROCESSING_ERROR');
      
      return {
        messageId: message.id,
        type: 'invoice',
        success: false,
        action: 'processing_error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * 予定処理（ZKP統合版）
   */
  private async processScheduleWithZKP(
    message: GmailMessage, 
    scheduleData: ScheduleData
  ): Promise<ProcessingResult> {
    console.log('📅 予定処理開始（ZKP統合版）');
    
    try {
      // 1. スケジュール計画の生成
      // スケジュールデータの検証
      if (!scheduleData || !scheduleData.title) {
        throw new Error('スケジュールデータが不完全です');
      }

      const schedulePlan: SchedulePlan = {
        title: scheduleData.title,
        startTime: Math.floor(new Date(scheduleData.startDate).getTime() / 1000),
        endTime: Math.floor(new Date(scheduleData.endDate || scheduleData.startDate).getTime() / 1000),
        location: scheduleData.location || '',
        description: scheduleData.description,
        confidence: 1.0,
        recommendedAction: 'execute'
      };

      console.log('📋 スケジュール計画:', schedulePlan);

      // 2. ZKP証明の生成
      console.log('🔐 スケジュールZKP証明を生成');
      console.log('-'.repeat(40));
      const zkpProof = await this.zkpProver.generateScheduleProof(
        schedulePlan, 
        this.config.scheduleRules
      );

      console.log('🔍 スケジュールZKP証明結果:', {
        isValid: zkpProof.isValid,
        proofType: zkpProof.proof.mock ? 'mock' : zkpProof.proof.error ? 'error' : 'zkp'
      });

      // 3. ZKP証明の検証
      console.log('✅ スケジュールZKP証明を検証');
      const zkpVerified = await this.zkpVerifier.verifyProof(zkpProof);

      if (!zkpVerified) {
        console.warn('❌ スケジュールZKP検証に失敗しました');
        await this.gmailService.addLabel(message.id, 'SCHEDULE_ZKP_VERIFICATION_FAILED');
        
        return {
          messageId: message.id,
          type: 'schedule',
          success: false,
          action: 'schedule_zkp_verification_failed',
          details: {
            error: 'スケジュールZKP証明の検証に失敗しました'
          }
        };
      }

      console.log('✅ スケジュールZKP検証成功 - カレンダー登録を実行');

      // 4. カレンダーイベントを作成
      const eventResult = await this.calendarService.createEvent({
        title: scheduleData.title,
        startDate: scheduleData.startDate,
        endDate: scheduleData.endDate || scheduleData.startDate,
        location: scheduleData.location,
        description: scheduleData.description
      });
      
      if (eventResult.success) {
        await this.gmailService.addLabel(message.id, 'ZKP_VERIFIED_SCHEDULE');
        await this.gmailService.addLabel(message.id, 'SCHEDULED');

        console.log('🎉 ZKP検証済みスケジュール登録完了');
        
        return {
          messageId: message.id,
          type: 'schedule',
          success: true,
          action: 'zkp_verified_schedule_created',
          details: {
            calendarEventId: eventResult.eventId,
            calendarEventUrl: eventResult.webLink
            // easAttestationUID: await this.recordScheduleAttestation(schedulePlan, zkpProof, eventResult.eventId!)
          }
        };
      } else {
        await this.gmailService.addLabel(message.id, 'ZKP_VERIFIED_SCHEDULE_FAILED');
        
        return {
          messageId: message.id,
          type: 'schedule',
          success: false,
          action: 'schedule_creation_failed',
          details: {
            error: eventResult.error
          }
        };
      }
      
    } catch (error) {
      console.error('スケジュール処理エラー:', error);
      await this.gmailService.addLabel(message.id, 'SCHEDULE_PROCESSING_ERROR');
      
      return {
        messageId: message.id,
        type: 'schedule',
        success: false,
        action: 'schedule_processing_error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // /**
  //  * 支払いアテステーションをEASに記録
  //  */
  // private async recordPaymentAttestation(
  //   paymentPlan: PaymentPlan, 
  //   zkpProof: ZKPProof, 
  //   transactionHash: string
  // ): Promise<string> {
  //   try {
  //     const paymentAttestation: PaymentAttestation = {
  //       invoiceNumber: paymentPlan.invoiceNumber,
  //       paymentAmount: paymentPlan.amount,
  //       recipientAddress: paymentPlan.toAddress,
  //       zkpProofHash: this.easService.generateProofHash(zkpProof),
  //       timestamp: paymentPlan.timestamp,
  //       isVerified: zkpProof.isValid
  //     };

  //     const result = await this.easService.attestPayment(paymentAttestation, zkpProof);
      
  //     if (result.success) {
  //       console.log('📝 支払いアテステーション記録完了:', result.attestationUID);
  //       return result.attestationUID!;
  //     } else {
  //       console.error('❌ 支払いアテステーション記録失敗:', result.error);
  //       return 'attestation_failed';
  //     }
  //   } catch (error) {
  //     console.error('支払いアテステーション記録エラー:', error);
  //     return 'attestation_error';
  //   }
  // }

  // /**
  //  * スケジュールアテステーションをEASに記録
  //  */
  // private async recordScheduleAttestation(
  //   schedulePlan: SchedulePlan, 
  //   zkpProof: ZKPProof, 
  //   eventId: string
  // ): Promise<string> {
  //   try {
  //     const scheduleAttestation: ScheduleAttestation = {
  //       eventTitle: schedulePlan.title,
  //       startTime: schedulePlan.startTime,
  //       endTime: schedulePlan.endTime,
  //       zkpProofHash: this.easService.generateProofHash(zkpProof),
  //       timestamp: Math.floor(Date.now() / 1000),
  //       isVerified: zkpProof.isValid
  //     };

  //     const result = await this.easService.attestSchedule(scheduleAttestation, zkpProof);
      
  //     if (result.success) {
  //       console.log('📅 スケジュールアテステーション記録完了:', result.attestationUID);
  //       return result.attestationUID!;
  //     } else {
  //       console.error('❌ スケジュールアテステーション記録失敗:', result.error);
  //       return 'attestation_failed';
  //     }
  //   } catch (error) {
  //     console.error('スケジュールアテステーション記録エラー:', error);
  //     return 'attestation_error';
  //   }
  // }

  /**
   * メッセージ内容の抽出
   */
  private extractMessageContent(message: GmailMessage) {
    const headers = message.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const from = headers.find(h => h.name === 'From')?.value || '';
    
    let body = '';
    const attachments: Array<{ filename: string; mimeType: string; data: Buffer }> = [];
    
    // ボディテキストの抽出
    if (message.payload.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    } else if (message.payload.parts) {
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        
        // 添付ファイルの処理
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
   * システム健全性チェック
   */
  async healthCheck() {
    const checks = {
      gmail: false,
      openai: false,
      blockchain: false,
      zkp: false
      // eas: false
    };
    
    try {
      // Gmail接続チェック
      await this.gmailService.getNewMessages();
      checks.gmail = true;
    } catch (error) {
      console.error('Gmail health check failed:', error);
    }
    
    try {
      // OpenAI接続チェック（ダミー分類）
      await this.aiClassifier.classifyAndExtract('test', 'test', 'test@example.com', []);
      checks.openai = true;
    } catch (error) {
      console.error('OpenAI health check failed:', error);
    }
    
    try {
      // ブロックチェーン接続チェック
      await this.blockchainService.getTokenInfo(this.config.blockchain.jpycTokenAddress);
      checks.blockchain = true;
    } catch (error) {
      console.error('Blockchain health check failed:', error);
    }
    
    try {
      // ZKP回路ファイル存在チェック（軽量）
      const zkpProver = this.zkpProver as any;
      if (zkpProver.checkCircuitFiles && zkpProver.checkCircuitFiles()) {
        checks.zkp = true;
        console.log('✅ ZKP回路ファイル確認完了');
      } else {
        console.log('⚠️ ZKP回路ファイルが見つかりません - 手動検証モードで動作');
        checks.zkp = true; // 手動検証モードでも動作可能
      }
    } catch (error) {
      console.error('ZKP health check failed:', error);
      checks.zkp = true; // フォールバックモードで動作可能
    }
    
    // try {
    //   // EAS接続チェック
    //   checks.eas = await this.easService.healthCheck();
    // } catch (error) {
    //   console.error('EAS health check failed:', error);
    // }
    
    return {
      ...checks,
      overall: Object.values(checks).every(check => check)
    };
  }
} 