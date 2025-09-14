import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const execAsync = promisify(exec);

export interface PaymentIntent {
  amount: number;
  recipient: string;
  timestamp: number;
  vendor: string;
}

export interface PolicyRules {
  maxPerPayment: number;
  maxPerDay: number;
  maxPerWeek: number;
  allowedVendors: string[];
  allowedHoursStart: number;
  allowedHoursEnd: number;
  allowedWeekdays: number[]; // 0=Sunday, 1=Monday, etc.
}

export interface PolicyEvaluation {
  approved: boolean;
  riskScore: number;
  violationCount: number;
  proofGenerated: boolean;
  processingTime: number;
}

export interface ZkVMConfig {
  hostBinaryPath?: string;
  timeout?: number;
  enableProofGeneration?: boolean;
}

export class ZkVMPolicyEngine {
  private config: Required<ZkVMConfig>;

  constructor(config: ZkVMConfig = {}) {
    this.config = {
      hostBinaryPath: config.hostBinaryPath || path.join(
        process.cwd(),
        'zk/risc0/zkvm-policy-engine/target/debug/host'
      ),
      timeout: config.timeout || 120000, // 2分
      enableProofGeneration: config.enableProofGeneration ?? true,
    };
  }

  /**
   * 支払い意図がポリシーに準拠しているかを検証し、ZKP証明を生成
   */
  async evaluatePaymentIntent(
    intent: PaymentIntent,
    policy: PolicyRules,
    currentSpending: number = 0,
    weeklySpending: number = 0
  ): Promise<PolicyEvaluation> {
    try {
      console.log('🔐 zkVM ポリシー評価を開始...');
      const startTime = Date.now();

      // バイナリファイルの存在確認
      if (!fs.existsSync(this.config.hostBinaryPath)) {
        throw new Error(`zkVM host binary not found: ${this.config.hostBinaryPath}`);
      }

      // zkVMが無効な場合は手動評価
      if (!this.config.enableProofGeneration) {
        console.log('⚠️ ZKP証明生成が無効 - 手動評価を実行');
        const manualResult = this.evaluateManually(intent, policy, currentSpending, weeklySpending);
        return {
          ...manualResult,
          proofGenerated: false,
          processingTime: Date.now() - startTime,
        };
      }

      // 一時的な入力ファイルを作成
      const inputData = this.prepareInputData(intent, policy, currentSpending, weeklySpending);
      const inputFile = await this.createTempInputFile(inputData);

      try {
        // zkVMホストプログラムを実行
        const result = await this.executeZkVMHost(inputFile);
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ zkVM評価完了 (${processingTime}ms)`);

        return {
          ...result,
          proofGenerated: true,
          processingTime,
        };
      } finally {
        // 一時ファイルを削除
        try {
          fs.unlinkSync(inputFile);
        } catch (error) {
          console.warn('一時ファイルの削除に失敗:', error);
        }
      }
    } catch (error) {
      console.error('zkVM評価エラー:', error);
      
      // フォールバック: 手動評価
      console.log('🔄 手動評価にフォールバック');
      const startTime = Date.now();
      const manualResult = this.evaluateManually(intent, policy, currentSpending, weeklySpending);
      
      return {
        ...manualResult,
        proofGenerated: false,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 手動でのポリシー評価（zkVMフォールバック）
   */
  private evaluateManually(
    intent: PaymentIntent,
    policy: PolicyRules,
    currentSpending: number,
    weeklySpending: number
  ): Pick<PolicyEvaluation, 'approved' | 'riskScore' | 'violationCount'> {
    let violationCount = 0;
    let riskScore = 0;

    // 1. 金額制限チェック
    if (intent.amount > policy.maxPerPayment) {
      violationCount++;
      riskScore += 30;
    }

    if (currentSpending + intent.amount > policy.maxPerDay) {
      violationCount++;
      riskScore += 25;
    }

    if (weeklySpending + intent.amount > policy.maxPerWeek) {
      violationCount++;
      riskScore += 20;
    }

    // 2. ベンダーホワイトリストチェック
    if (!policy.allowedVendors.includes(intent.vendor)) {
      violationCount++;
      riskScore += 25;
    }

    // 3. 時間制限チェック
    const hour = new Date(intent.timestamp * 1000).getHours();
    if (hour < policy.allowedHoursStart || hour >= policy.allowedHoursEnd) {
      violationCount++;
      riskScore += 15;
    }

    // 4. 曜日チェック
    const weekday = new Date(intent.timestamp * 1000).getDay();
    if (!policy.allowedWeekdays.includes(weekday)) {
      violationCount++;
      riskScore += 10;
    }

    return {
      approved: violationCount === 0,
      riskScore: Math.min(riskScore, 100),
      violationCount,
    };
  }

  /**
   * zkVMホスト用の入力データを準備
   */
  private prepareInputData(
    intent: PaymentIntent,
    policy: PolicyRules,
    currentSpending: number,
    weeklySpending: number
  ): any {
    // 文字列をハッシュに変換
    const recipientHash = this.hashString(intent.recipient);
    const vendorHash = this.hashString(intent.vendor);
    const allowedVendorHash = policy.allowedVendors.length > 0 
      ? this.hashString(policy.allowedVendors[0])
      : 0;

    // 曜日をビットマスクに変換
    let weekdayMask = 0;
    for (const day of policy.allowedWeekdays) {
      if (day < 8) {
        weekdayMask |= 1 << day;
      }
    }

    return {
      amount: intent.amount,
      recipientHash,
      timestamp: intent.timestamp,
      vendorHash,
      maxPerPayment: policy.maxPerPayment,
      maxPerDay: policy.maxPerDay,
      maxPerWeek: policy.maxPerWeek,
      allowedVendorHash,
      allowedHoursStart: policy.allowedHoursStart,
      allowedHoursEnd: policy.allowedHoursEnd,
      weekdayMask,
      currentSpending,
      weeklySpending,
    };
  }

  /**
   * 一時入力ファイルを作成
   */
  private async createTempInputFile(data: any): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filename = `zkvm_input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.json`;
    const filepath = path.join(tempDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    return filepath;
  }

  /**
   * zkVMホストプログラムを実行
   */
  private async executeZkVMHost(inputFile: string): Promise<Pick<PolicyEvaluation, 'approved' | 'riskScore' | 'violationCount'>> {
    // 注意: 実際の実装では、ホストプログラムを修正して入力ファイルを受け取るようにする必要があります
    // 現在はサンプル実行のみ
    
    const { stdout, stderr } = await execAsync(
      `cd ${path.dirname(this.config.hostBinaryPath)} && ${this.config.hostBinaryPath}`,
      { timeout: this.config.timeout }
    );

    if (stderr) {
      console.log('zkVM stderr:', stderr);
    }

    // 出力をパース（実際の実装では、ホストプログラムからJSON出力を受け取る）
    const lines = stdout.split('\n');
    let approved = false;
    let riskScore = 0;
    let violationCount = 0;

    for (const line of lines) {
      if (line.includes('Approved: true')) approved = true;
      if (line.includes('Risk Score:')) {
        const match = line.match(/Risk Score: (\d+)/);
        if (match) riskScore = parseInt(match[1]);
      }
      if (line.includes('Violations:')) {
        const match = line.match(/Violations: (\d+)/);
        if (match) violationCount = parseInt(match[1]);
      }
    }

    return {
      approved,
      riskScore,
      violationCount,
    };
  }

  /**
   * 文字列をハッシュに変換
   */
  private hashString(str: string): number {
    const hash = crypto.createHash('sha256').update(str).digest();
    // 最初の8バイトをu64として解釈し、JavaScriptのnumberに変換
    // BigInt literalを使わずに作成
    const maxSafeValue = BigInt('0x1fffffffffffff');
    return Number(hash.readBigUInt64BE(0) & maxSafeValue);
  }

  /**
   * 設定を取得
   */
  getConfig(): Required<ZkVMConfig> {
    return { ...this.config };
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<ZkVMConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * zkVMの利用可能性をチェック
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const exists = fs.existsSync(this.config.hostBinaryPath);
      if (!exists) {
        console.log('zkVM host binary not found:', this.config.hostBinaryPath);
        return false;
      }

      // 簡単な実行テスト
      const { stdout } = await execAsync(
        `${this.config.hostBinaryPath} --help || echo "help not available"`,
        { timeout: 5000 }
      );
      
      return stdout.length > 0;
    } catch (error) {
      console.error('zkVM availability check failed:', error);
      return false;
    }
  }

  /**
   * デフォルトポリシーを取得
   */
  static getDefaultPolicy(): PolicyRules {
    return {
      maxPerPayment: 100000, // 10万円
      maxPerDay: 500000,     // 50万円
      maxPerWeek: 2000000,   // 200万円
      allowedVendors: [],
      allowedHoursStart: 9,
      allowedHoursEnd: 18,
      allowedWeekdays: [1, 2, 3, 4, 5], // 月-金
    };
  }
} 