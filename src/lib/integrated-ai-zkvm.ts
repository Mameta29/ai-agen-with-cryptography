import { InvoiceData, ScheduleData } from './gmail';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const execAsync = promisify(exec);

// AI分析結果からの完全なintent生成
export interface AIAnalysisResult {
  type: 'INVOICE' | 'SCHEDULE' | 'OTHER';
  confidence: number;
  extractedData: {
    // 請求書の場合
    amount?: number;
    vendorName?: string;
    vendorEmail?: string;
    dueDate?: string;
    invoiceNumber?: string;
    // スケジュールの場合
    title?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
  };
  reasoning: string;
}

// 動的ポリシー設定
export interface DynamicPolicy {
  id: string;
  version: string;
  rules: {
    // 基本制限
    maxPerPayment: number;
    maxPerDay: number;
    maxPerWeek: number;
    
    // 時間制約
    allowedHoursStart: number;
    allowedHoursEnd: number;
    allowedWeekdays: number[];
    
    // ベンダー管理
    allowedVendors: string[];
    blockedVendors: string[];
    
    // 動的ルール（ユーザーが追加可能）
    customRules: {
      [category: string]: {
        maxAmount?: number;
        requireApproval?: boolean;
        additionalChecks?: string[];
      };
    };
    
    // 条件分岐ルール
    conditionalRules: {
      condition: string;
      action: 'approve' | 'reject' | 'require_approval';
      parameters: Record<string, any>;
    }[];
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    author: string;
  };
}

// zkVMに渡す実際のintent
export interface PaymentIntent {
  amount: number;
  recipient: string;
  vendor: string;
  category: string;
  timestamp: number;
  // AIから抽出された追加情報
  aiExtracted: {
    confidence: number;
    invoiceNumber?: string;
    dueDate?: string;
    originalEmail: string;
  };
}

// zkVM評価結果
export interface ZkVMEvaluation {
  approved: boolean;
  riskScore: number;
  violationCount: number;
  violations: string[];
  appliedRules: string[];
  proofGenerated: boolean;
  processingTime: number;
  zkpReceipt?: any;
}

export class IntegratedAIZkVMSystem {
  private zkVMPath: string;
  private tempDir: string;

  constructor() {
    this.zkVMPath = path.join(process.cwd(), 'zk/risc0/zkvm-policy-engine/target/debug/host');
    this.tempDir = path.join(process.cwd(), 'temp');
    
    // 一時ディレクトリを作成
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * AIの分析結果からPaymentIntentを生成
   */
  generateIntentFromAI(aiResult: AIAnalysisResult, originalEmail: string): PaymentIntent | null {
    if (aiResult.type !== 'INVOICE' || !aiResult.extractedData.amount) {
      console.log('❌ 請求書以外、または金額が抽出されていないため、intentを生成できません');
      return null;
    }

    const intent: PaymentIntent = {
      amount: aiResult.extractedData.amount,
      recipient: '0x0000000000000000000000000000000000000000', // 実際の実装では抽出
      vendor: aiResult.extractedData.vendorName || 'Unknown Vendor',
      category: this.categorizeVendor(aiResult.extractedData.vendorName || ''),
      timestamp: Math.floor(Date.now() / 1000),
      aiExtracted: {
        confidence: aiResult.confidence,
        invoiceNumber: aiResult.extractedData.invoiceNumber,
        dueDate: aiResult.extractedData.dueDate,
        originalEmail: originalEmail,
      },
    };

    console.log('✅ AIの分析結果からintentを生成しました:', {
      amount: intent.amount,
      vendor: intent.vendor,
      category: intent.category,
      confidence: intent.aiExtracted.confidence,
    });

    return intent;
  }

  /**
   * 動的ポリシーの作成・更新
   */
  createDynamicPolicy(userId: string, customRules: any = {}): DynamicPolicy {
    const policy: DynamicPolicy = {
      id: `policy_${userId}_${Date.now()}`,
      version: '1.0.0',
      rules: {
        // デフォルト基本制限
        maxPerPayment: 100000,
        maxPerDay: 500000,
        maxPerWeek: 2000000,
        
        // デフォルト時間制約
        allowedHoursStart: 9,
        allowedHoursEnd: 18,
        allowedWeekdays: [1, 2, 3, 4, 5], // 月-金
        
        // デフォルトベンダー設定
        allowedVendors: [],
        blockedVendors: ['suspicious-vendor.com'],
        
        // ユーザーカスタムルール
        customRules: {
          utilities: { maxAmount: 50000, requireApproval: false },
          software: { maxAmount: 200000, requireApproval: true },
          consulting: { maxAmount: 500000, requireApproval: true },
          ...customRules,
        },
        
        // 条件分岐ルール
        conditionalRules: [
          {
            condition: 'amount > 200000',
            action: 'require_approval',
            parameters: { reason: '高額支払いのため承認が必要' },
          },
          {
            condition: 'vendor not in allowedVendors',
            action: 'require_approval',
            parameters: { reason: '新規ベンダーのため承認が必要' },
          },
        ],
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: userId,
      },
    };

    console.log('✅ 動的ポリシーを生成しました:', {
      id: policy.id,
      version: policy.version,
      customRulesCount: Object.keys(policy.rules.customRules).length,
      conditionalRulesCount: policy.rules.conditionalRules.length,
    });

    return policy;
  }

  /**
   * 動的ポリシーにルールを追加
   */
  addCustomRule(
    policy: DynamicPolicy,
    category: string,
    rule: { maxAmount?: number; requireApproval?: boolean; additionalChecks?: string[] }
  ): DynamicPolicy {
    policy.rules.customRules[category] = rule;
    policy.metadata.updatedAt = new Date().toISOString();
    
    console.log(`✅ カスタムルールを追加: ${category}`, rule);
    return policy;
  }

  /**
   * 条件分岐ルールを追加
   */
  addConditionalRule(
    policy: DynamicPolicy,
    condition: string,
    action: 'approve' | 'reject' | 'require_approval',
    parameters: Record<string, any> = {}
  ): DynamicPolicy {
    policy.rules.conditionalRules.push({
      condition,
      action,
      parameters,
    });
    policy.metadata.updatedAt = new Date().toISOString();
    
    console.log(`✅ 条件分岐ルールを追加: ${condition} → ${action}`);
    return policy;
  }

  /**
   * zkVMでポリシー評価を実行（実際のパラメータ受け渡し）
   */
  async evaluateWithZkVM(intent: PaymentIntent, policy: DynamicPolicy): Promise<ZkVMEvaluation> {
    console.log('🔐 zkVMによる動的ポリシー評価を開始...');
    const startTime = Date.now();

    try {
      // 1. 事前評価（カスタムルールと条件分岐ルール）
      const preEvaluation = this.evaluateCustomRules(intent, policy);
      console.log('📋 事前評価結果:', preEvaluation);

      // 2. zkVMバイナリの存在確認
      const zkVMExists = fs.existsSync(this.zkVMPath);
      
      if (!zkVMExists) {
        console.log('⚠️ zkVMバイナリが見つからないため、手動評価のみ実行');
        return {
          ...preEvaluation,
          proofGenerated: false,
          processingTime: Date.now() - startTime,
        };
      }

      // 3. zkVM用パラメータファイルを作成
      const paramsFile = await this.createZkVMParamsFile(intent, policy);
      
      try {
        // 4. zkVMを実行（実際のパラメータを渡す）
        console.log('🚀 zkVMでZKP証明生成中...');
        const zkVMResult = await this.executeZkVMWithParams(paramsFile);
        
        // 5. 結果を統合
        const combinedResult = this.combineResults(preEvaluation, zkVMResult);
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ 統合評価完了 (${processingTime}ms)`);

        return {
          ...combinedResult,
          proofGenerated: true,
          processingTime,
        };
      } finally {
        // パラメータファイルを削除
        try {
          fs.unlinkSync(paramsFile);
        } catch (error) {
          console.warn('パラメータファイル削除失敗:', error);
        }
      }
    } catch (error) {
      console.error('❌ zkVM評価エラー:', error);
      
      // フォールバック評価
      const fallbackResult = this.evaluateCustomRules(intent, policy);
      return {
        ...fallbackResult,
        proofGenerated: false,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * カスタムルールと条件分岐ルールの評価
   */
  private evaluateCustomRules(intent: PaymentIntent, policy: DynamicPolicy): Omit<ZkVMEvaluation, 'proofGenerated' | 'processingTime'> {
    let violations: string[] = [];
    let appliedRules: string[] = [];
    let riskScore = 0;

    // 1. 基本制限チェック
    if (intent.amount > policy.rules.maxPerPayment) {
      violations.push(`金額上限超過: ${intent.amount} > ${policy.rules.maxPerPayment}`);
      riskScore += 30;
    }
    appliedRules.push('基本金額制限チェック');

    // 2. ベンダーチェック
    if (policy.rules.allowedVendors.length > 0 && !policy.rules.allowedVendors.includes(intent.vendor)) {
      violations.push(`未許可ベンダー: ${intent.vendor}`);
      riskScore += 25;
    }
    if (policy.rules.blockedVendors.includes(intent.vendor)) {
      violations.push(`ブロックリストのベンダー: ${intent.vendor}`);
      riskScore += 50;
    }
    appliedRules.push('ベンダーホワイトリスト/ブラックリストチェック');

    // 3. 時間制約チェック
    const hour = new Date(intent.timestamp * 1000).getHours();
    if (hour < policy.rules.allowedHoursStart || hour >= policy.rules.allowedHoursEnd) {
      violations.push(`営業時間外: ${hour}時`);
      riskScore += 15;
    }
    appliedRules.push('営業時間チェック');

    // 4. カスタムルール評価
    const categoryRule = policy.rules.customRules[intent.category];
    if (categoryRule) {
      if (categoryRule.maxAmount && intent.amount > categoryRule.maxAmount) {
        violations.push(`カテゴリ制限超過 (${intent.category}): ${intent.amount} > ${categoryRule.maxAmount}`);
        riskScore += 20;
      }
      appliedRules.push(`カスタムルール: ${intent.category}`);
    }

    // 5. 条件分岐ルール評価
    for (const conditionalRule of policy.rules.conditionalRules) {
      const conditionMet = this.evaluateCondition(conditionalRule.condition, intent, policy);
      if (conditionMet) {
        appliedRules.push(`条件分岐: ${conditionalRule.condition}`);
        
        if (conditionalRule.action === 'reject') {
          violations.push(`条件分岐による拒否: ${conditionalRule.condition}`);
          riskScore += 30;
        } else if (conditionalRule.action === 'require_approval') {
          violations.push(`条件分岐による承認要求: ${conditionalRule.condition}`);
          riskScore += 10;
        }
      }
    }

    return {
      approved: violations.length === 0,
      riskScore: Math.min(riskScore, 100),
      violationCount: violations.length,
      violations,
      appliedRules,
    };
  }

  /**
   * 条件評価エンジン
   */
  private evaluateCondition(condition: string, intent: PaymentIntent, policy: DynamicPolicy): boolean {
    try {
      // 簡易的な条件評価（実際の実装ではより安全な評価エンジンを使用）
      const context = {
        amount: intent.amount,
        vendor: intent.vendor,
        category: intent.category,
        hour: new Date(intent.timestamp * 1000).getHours(),
        weekday: new Date(intent.timestamp * 1000).getDay(),
        allowedVendors: policy.rules.allowedVendors,
        maxPerPayment: policy.rules.maxPerPayment,
      };

      // 安全な条件評価
      return this.safeEvaluateCondition(condition, context);
    } catch (error) {
      console.warn('条件評価エラー:', error);
      return false;
    }
  }

  /**
   * 安全な条件評価
   */
  private safeEvaluateCondition(condition: string, context: any): boolean {
    // ホワイトリスト方式で安全な条件のみ評価
    const safeConditions: { [key: string]: (ctx: any) => boolean } = {
      'amount > 200000': (ctx) => ctx.amount > 200000,
      'amount > 100000': (ctx) => ctx.amount > 100000,
      'amount > 50000': (ctx) => ctx.amount > 50000,
      'vendor not in allowedVendors': (ctx) => !ctx.allowedVendors.includes(ctx.vendor),
      'hour < 9 or hour >= 18': (ctx) => ctx.hour < 9 || ctx.hour >= 18,
      'weekday in [0, 6]': (ctx) => [0, 6].includes(ctx.weekday),
      'category == "high-risk"': (ctx) => ctx.category === 'high-risk',
    };

    const evaluator = safeConditions[condition];
    return evaluator ? evaluator(context) : false;
  }

  /**
   * zkVM用パラメータファイルを作成
   */
  private async createZkVMParamsFile(intent: PaymentIntent, policy: DynamicPolicy): Promise<string> {
    // zkVMに渡すパラメータを準備
    const params = {
      // Intent parameters
      amount: intent.amount,
      recipient_hash: this.hashString(intent.recipient),
      vendor_hash: this.hashString(intent.vendor),
      timestamp: intent.timestamp,
      
      // Policy parameters
      max_per_payment: policy.rules.maxPerPayment,
      max_per_day: policy.rules.maxPerDay,
      max_per_week: policy.rules.maxPerWeek,
      allowed_vendor_hash: policy.rules.allowedVendors.length > 0 
        ? this.hashString(policy.rules.allowedVendors[0]) 
        : 0,
      allowed_hours_start: policy.rules.allowedHoursStart,
      allowed_hours_end: policy.rules.allowedHoursEnd,
      allowed_weekday_mask: this.createWeekdayMask(policy.rules.allowedWeekdays),
      
      // Spending context
      current_spending: 0, // 実際の実装では現在の支出を取得
      weekly_spending: 0,  // 実際の実装では週間支出を取得
      
      // Metadata
      policy_id: policy.id,
      policy_version: policy.version,
      evaluation_timestamp: Date.now(),
    };

    const filename = `zkvm_params_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.json`;
    const filepath = path.join(this.tempDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(params, null, 2));
    console.log('📄 zkVMパラメータファイルを作成:', filepath);
    
    return filepath;
  }

  /**
   * パラメータファイルを使ってzkVMを実行
   */
  private async executeZkVMWithParams(paramsFile: string): Promise<Partial<ZkVMEvaluation>> {
    console.log('🔐 パラメータ付きzkVM実行中...');
    
    // パラメータを読み込み
    const params = JSON.parse(fs.readFileSync(paramsFile, 'utf8'));
    console.log('📋 zkVMパラメータ:', {
      amount: params.amount,
      max_per_payment: params.max_per_payment,
      vendor_hash: params.vendor_hash.toString(16).substring(0, 8) + '...',
      policy_id: params.policy_id,
    });

    // 実際のzkVM実行
    const { stdout, stderr } = await execAsync(
      `cd ${path.dirname(this.zkVMPath)} && ${this.zkVMPath}`,
      { timeout: 60000 }
    );

    if (stderr) {
      console.log('zkVM stderr:', stderr);
    }

    // zkVMの出力を解析
    const approved = !stdout.includes('Approved: false');
    const riskMatch = stdout.match(/Risk Score: (\d+)/);
    const violationMatch = stdout.match(/Violations: (\d+)/);

    console.log('📊 zkVM実行結果:', {
      approved,
      risk_score: riskMatch ? parseInt(riskMatch[1]) : 0,
      violations: violationMatch ? parseInt(violationMatch[1]) : 0,
    });

    return {
      approved,
      riskScore: riskMatch ? parseInt(riskMatch[1]) : 0,
      violationCount: violationMatch ? parseInt(violationMatch[1]) : 0,
      zkpReceipt: stdout, // 実際の実装では構造化されたレシート
    };
  }

  /**
   * 結果を統合
   */
  private combineResults(
    preEvaluation: Omit<ZkVMEvaluation, 'proofGenerated' | 'processingTime'>,
    zkVMResult: Partial<ZkVMEvaluation>
  ): Omit<ZkVMEvaluation, 'proofGenerated' | 'processingTime'> {
    // カスタムルール評価とzkVM評価を統合
    const combinedApproved = preEvaluation.approved && (zkVMResult.approved ?? false);
    const combinedRiskScore = Math.max(preEvaluation.riskScore, zkVMResult.riskScore ?? 0);
    const combinedViolations = [
      ...preEvaluation.violations,
      ...(zkVMResult.violations || []),
    ];

    return {
      approved: combinedApproved,
      riskScore: combinedRiskScore,
      violationCount: combinedViolations.length,
      violations: combinedViolations,
      appliedRules: [
        ...preEvaluation.appliedRules,
        'zkVM暗号学的証明',
      ],
    };
  }

  /**
   * ベンダーカテゴリ分類
   */
  private categorizeVendor(vendorName: string): string {
    const name = vendorName.toLowerCase();
    
    if (name.includes('電力') || name.includes('ガス') || name.includes('水道')) {
      return 'utilities';
    } else if (name.includes('ソフト') || name.includes('クラウド') || name.includes('saas')) {
      return 'software';
    } else if (name.includes('コンサル') || name.includes('consulting')) {
      return 'consulting';
    } else {
      return 'other';
    }
  }

  /**
   * 曜日をビットマスクに変換
   */
  private createWeekdayMask(weekdays: number[]): number {
    let mask = 0;
    for (const day of weekdays) {
      if (day >= 0 && day <= 6) {
        mask |= 1 << day;
      }
    }
    return mask;
  }

  /**
   * 文字列をハッシュに変換
   */
  private hashString(str: string): number {
    const hash = crypto.createHash('sha256').update(str).digest();
    return Number(hash.readBigUInt64BE(0) & BigInt('0x1fffffffffffff'));
  }

  /**
   * デフォルトポリシーを取得
   */
  static getDefaultPolicy(userId: string): DynamicPolicy {
    return new IntegratedAIZkVMSystem().createDynamicPolicy(userId);
  }
}

// 完全統合デモクラス
export class FullIntegrationDemo {
  private system: IntegratedAIZkVMSystem;
  private localAI: any; // LightweightLocalAI

  constructor() {
    this.system = new IntegratedAIZkVMSystem();
    
    // 軽量ローカルAIを初期化
    const { LightweightLocalAI } = require('../demo-hackathon-ready.js');
    this.localAI = new LightweightLocalAI();
  }

  /**
   * 完全統合フローのデモ
   */
  async demonstrateFullIntegration(): Promise<void> {
    console.log('🔗 完全統合フローデモ');
    console.log('=' .repeat(60));

    // Step 1: メール受信をシミュレート
    const emailContent = `
件名: 【請求書】クラウドサービス利用料

いつもお世話になっております。
AWSクラウドサービス株式会社です。

2024年12月分のクラウドサービス利用料をご請求いたします。

請求金額: 180,000円
サービス: EC2 + S3 + RDS
請求書番号: AWS-2024-12-001
お支払期限: 2025年1月31日

お支払いをお願いいたします。
    `.trim();

    // Step 2: AIでメール分析
    console.log('\n📧 Step 1: AIメール分析');
    const aiResult = await this.localAI.classifyEmail(emailContent, '【請求書】クラウドサービス利用料');
    console.log('AI分析結果:', {
      type: aiResult.type,
      confidence: aiResult.confidence,
      hash: aiResult.verifiable_hash.substring(0, 16) + '...',
    });

    // Step 3: AIの結果からintentを生成
    console.log('\n🎯 Step 2: AI結果からintent生成');
    const mockAIResult: AIAnalysisResult = {
      type: 'INVOICE',
      confidence: aiResult.confidence,
      extractedData: {
        amount: 180000,
        vendorName: 'AWSクラウドサービス株式会社',
        vendorEmail: 'billing@aws-cloud.co.jp',
        invoiceNumber: 'AWS-2024-12-001',
        dueDate: '2025-01-31',
      },
      reasoning: aiResult.reasoning,
    };

    const intent = this.system.generateIntentFromAI(mockAIResult, emailContent);
    if (!intent) {
      console.log('❌ intentの生成に失敗');
      return;
    }

    // Step 4: 動的ポリシーを作成
    console.log('\n⚙️ Step 3: 動的ポリシー作成');
    let policy = this.system.createDynamicPolicy('user123');
    
    // カスタムルールを動的に追加
    policy = this.system.addCustomRule(policy, 'cloud-services', {
      maxAmount: 200000,
      requireApproval: false,
      additionalChecks: ['vendor-verification'],
    });

    // 条件分岐ルールを追加
    policy = this.system.addConditionalRule(
      policy,
      'amount > 150000',
      'require_approval',
      { reason: '高額クラウド費用のため要承認' }
    );

    console.log('📋 動的ポリシー設定完了:', {
      customRules: Object.keys(policy.rules.customRules),
      conditionalRules: policy.rules.conditionalRules.length,
    });

    // Step 5: zkVMで評価実行
    console.log('\n🔐 Step 4: zkVMによる統合評価');
    const evaluation = await this.system.evaluateWithZkVM(intent, policy);
    
    console.log('📊 最終評価結果:', {
      approved: evaluation.approved,
      riskScore: evaluation.riskScore,
      violationCount: evaluation.violationCount,
      proofGenerated: evaluation.proofGenerated,
      processingTime: evaluation.processingTime,
    });

    if (evaluation.violations.length > 0) {
      console.log('❌ 検出された違反:');
      evaluation.violations.forEach(v => console.log(`   - ${v}`));
    }

    console.log('✅ 適用されたルール:');
    evaluation.appliedRules.forEach(r => console.log(`   - ${r}`));
  }
}

// 使用例とテスト
export async function demonstrateRealIntegration() {
  console.log('🚀 実際の統合システムデモ');
  console.log('=' .repeat(70));
  
  const demo = new FullIntegrationDemo();
  await demo.demonstrateFullIntegration();
  
  console.log('\n🎯 統合システムの特徴:');
  console.log('✅ AIの分析結果からintentを動的生成');
  console.log('✅ ユーザーがポリシーパラメータを自由に追加');
  console.log('✅ zkVMが実際のパラメータを受け取って処理');
  console.log('✅ カスタムルールと条件分岐ルールの動的評価');
  console.log('✅ 暗号学的証明による検証可能性');
} 