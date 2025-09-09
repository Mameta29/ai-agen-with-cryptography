import * as snarkjs from 'snarkjs';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { InvoiceData, ScheduleData } from './gmail';

const execAsync = promisify(exec);

export interface PaymentPlan {
  toAddress: string;
  amount: number;
  timestamp: number;
  invoiceNumber: string;
  description: string;
  companyName: string;
  confidence: number;
  recommendedAction: 'execute' | 'review' | 'reject';
  riskAssessment?: {
    riskLevel: 'low' | 'medium' | 'high';
    factors: string[];
    score: number;
  };
}

export interface SchedulePlan {
  title: string;
  startTime: number;
  endTime: number;
  location?: string;
  description: string;
  confidence: number;
  recommendedAction: 'execute' | 'review' | 'reject';
}

export interface UserRules {
  allowedAddresses: string[];
  maxAmount: number;
  maxDailyAmount: number;
  allowedTimeStart: number;
  allowedTimeEnd: number;
  trustedDomains: string[];
}

export interface ScheduleRules {
  allowedTimeStart: number; // 例: 9 (9時)
  allowedTimeEnd: number;   // 例: 18 (18時)
  allowedDaysOfWeek: number[]; // 0=日曜, 1=月曜, ..., 6=土曜
  maxMeetingDuration: number; // 最大会議時間（分）
  blockedKeywords: string[]; // ブロックするキーワード
  requireApprovalAfterHours: boolean; // 営業時間外は承認必要
}

export interface ZKPProof {
  proof: any;
  publicSignals: string[];
  isValid: boolean;
}

export class ZKPProver {
  private circuitWasmPath: string;
  private circuitZkeyPath: string;
  private verificationKeyPath: string;

  constructor() {
    // 環境変数から回路ファイルのパスを取得（オプション）
    const projectRoot = process.cwd();
    this.circuitWasmPath = process.env.ZKP_CIRCUIT_WASM_PATH || path.join(projectRoot, 'build/payment_rules_js/payment_rules.wasm');
    this.circuitZkeyPath = process.env.ZKP_CIRCUIT_ZKEY_PATH || path.join(projectRoot, 'build/payment_rules_0001.zkey');
    this.verificationKeyPath = process.env.ZKP_VERIFICATION_KEY_PATH || path.join(projectRoot, 'build/verification_key.json');
    
    console.log('🔧 ZKP回路ファイルパス:', {
      wasm: this.circuitWasmPath,
      zkey: this.circuitZkeyPath,
      vkey: this.verificationKeyPath
    });
  }

  /**
   * 支払いルール遵守の証明を生成
   */
  async generatePaymentProof(paymentPlan: PaymentPlan, userRules: UserRules): Promise<ZKPProof> {
    try {
      console.log('💳 ZKP支払い証明生成を開始...');
      
      // 回路ファイルの存在確認
      if (!this.checkCircuitFiles()) {
        console.warn('ZKP回路ファイルが見つからないため、ルール検証のみ実行');
        
        // 手動でルール検証を実行
        const isValid = this.validatePaymentRulesManually(paymentPlan, userRules);
        
        return {
          proof: { mock: true, validated: isValid, type: 'payment' },
          publicSignals: [isValid ? '1' : '0'],
          isValid: isValid
        };
      }
      
      // ZKP証明生成のロジック（既存のコード）
      const addressToNumber = (addr: string) => {
        if (!addr || typeof addr !== 'string' || addr.length < 42) {
          console.warn('無効なアドレス:', addr);
          return 0;
        }
        
        let hash = 0;
        const normalizedAddr = addr.toLowerCase();
        for (let i = 0; i < normalizedAddr.length; i++) {
          const char = normalizedAddr.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return Math.abs(hash) % (2**31);
      };

      const allowedAddressHashes = userRules.allowedAddresses.map(addr => addressToNumber(addr));
      
      // 回路は個別のアドレス入力を期待（配列ではない）
      const allowedHashes = allowedAddressHashes.slice(0, 3).concat(Array(Math.max(0, 3 - allowedAddressHashes.length)).fill(0));
      
      // タイムスタンプから時間を抽出（0-23）
      const paymentHour = new Date(paymentPlan.timestamp * 1000).getHours();
      
      const circuitInputs: Record<string, unknown> = {
        paymentAddress: addressToNumber(paymentPlan.toAddress),
        paymentAmount: Math.floor(paymentPlan.amount * 100),
        paymentTimestamp: paymentHour, // 時間値に変換
        allowedAddress1: allowedHashes[0] || 0,
        allowedAddress2: allowedHashes[1] || 0,
        allowedAddress3: allowedHashes[2] || 0,
        maxAmount: Math.floor(userRules.maxAmount * 100),
        minHour: userRules.allowedTimeStart,
        maxHour: userRules.allowedTimeEnd
      };

      console.log('回路入力:', circuitInputs);

      // ZKP回路ファイルが存在するかチェック
      if (!this.checkCircuitFiles()) {
        console.log('⚠️ ZKP回路ファイルが見つかりません - 手動検証にフォールバック');
        throw new Error('ZKP circuit files not found - using manual validation');
      }

      console.log('🔐 ZKP回路で証明を生成中...');
      console.log('📁 使用ファイル:', {
        wasm: this.circuitWasmPath,
        zkey: this.circuitZkeyPath,
        wasmExists: fs.existsSync(this.circuitWasmPath),
        zkeyExists: fs.existsSync(this.circuitZkeyPath)
      });
      
      // ワーカープロセスでZKP証明生成を実行
      console.log('⏱️ ワーカープロセスでZKP証明生成開始:', new Date().toISOString());
      
      try {
        const workerArgs = JSON.stringify({
          inputs: circuitInputs,
          wasmPath: this.circuitWasmPath,
          zkeyPath: this.circuitZkeyPath
        });
        
        const { stdout, stderr } = await execAsync(
          `node zkp-worker.js '${workerArgs}'`,
          { 
            timeout: 30000, // 30秒タイムアウト
            maxBuffer: 1024 * 1024 // 1MBバッファ
          }
        );
        
        if (stderr) {
          console.log('ワーカーstderr:', stderr);
        }
        
        console.log('ワーカーstdout raw:', JSON.stringify(stdout));
        
        // stdoutから最後の有効なJSONを抽出
        const lines = stdout.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        
        console.log('最後の行:', JSON.stringify(lastLine));
        const result = JSON.parse(lastLine);
        console.log('⏱️ ワーカーZKP証明生成完了:', new Date().toISOString());
        
        if (!result.success) {
          throw new Error(`ワーカープロセスエラー: ${result.error}`);
        }
        
        return {
          proof: result.proof,
          publicSignals: result.publicSignals,
          isValid: result.isValid
        };
        
      } catch (zkpError) {
        console.error('🚨 ワーカープロセスZKP実行エラー:', zkpError);
        console.error('エラー詳細:', {
          message: zkpError instanceof Error ? zkpError.message : 'Unknown error',
          stack: zkpError instanceof Error ? zkpError.stack : undefined
        });
        throw zkpError;
      }

      // この部分は上のreturnで到達不能

    } catch (error) {
      console.error('ZKP支払い証明生成エラー:', error);
      
      const isValid = this.validatePaymentRulesManually(paymentPlan, userRules);
      return {
        proof: { error: true, message: error instanceof Error ? error.message : 'Unknown error', type: 'payment' },
        publicSignals: [isValid ? '1' : '0'],
        isValid: isValid
      };
    }
  }

  /**
   * スケジュールルール遵守の証明を生成
   */
  async generateScheduleProof(schedulePlan: SchedulePlan, scheduleRules: ScheduleRules): Promise<ZKPProof> {
    try {
      console.log('📅 ZKPスケジュール証明生成を開始...');
      
      // 手動でルール検証を実行（ZKP回路は支払い用なので）
      const isValid = this.validateScheduleRulesManually(schedulePlan, scheduleRules);
      
      return {
        proof: { mock: true, validated: isValid, type: 'schedule' },
        publicSignals: [isValid ? '1' : '0'],
        isValid: isValid
      };

    } catch (error) {
      console.error('ZKPスケジュール証明生成エラー:', error);
      
      const isValid = this.validateScheduleRulesManually(schedulePlan, scheduleRules);
      return {
        proof: { error: true, message: error instanceof Error ? error.message : 'Unknown error', type: 'schedule' },
        publicSignals: [isValid ? '1' : '0'],
        isValid: isValid
      };
    }
  }

  /**
   * 手動でのスケジュールルール検証
   */
  private validateScheduleRulesManually(schedulePlan: SchedulePlan, scheduleRules: ScheduleRules): boolean {
          console.log('🔄 ZKP回路失敗 - スケジュールルール検証フォールバックを実行');
    
    const startDate = new Date(schedulePlan.startTime * 1000);
    const endDate = new Date(schedulePlan.endTime * 1000);
    
    // 時間制限チェック
    const startHour = startDate.getHours();
    const endHour = endDate.getHours();
    
    if (startHour < scheduleRules.allowedTimeStart || endHour > scheduleRules.allowedTimeEnd) {
      console.log('❌ 許可時間外の予定です:', `${startHour}:00-${endHour}:00`, 'not in', `${scheduleRules.allowedTimeStart}:00-${scheduleRules.allowedTimeEnd}:00`);
      return false;
    }
    
    // 曜日制限チェック
    const dayOfWeek = startDate.getDay();
    if (!scheduleRules.allowedDaysOfWeek.includes(dayOfWeek)) {
      console.log('❌ 許可されていない曜日です:', dayOfWeek, 'not in', scheduleRules.allowedDaysOfWeek);
      return false;
    }
    
    // 会議時間制限チェック
    const durationMinutes = (schedulePlan.endTime - schedulePlan.startTime) / 60;
    if (durationMinutes > scheduleRules.maxMeetingDuration) {
      console.log('❌ 会議時間が上限を超えています:', durationMinutes, '>', scheduleRules.maxMeetingDuration);
      return false;
    }
    
    // ブロックキーワードチェック
    const titleLower = schedulePlan.title.toLowerCase();
    const descriptionLower = schedulePlan.description.toLowerCase();
    
    for (const keyword of scheduleRules.blockedKeywords) {
      if (titleLower.includes(keyword.toLowerCase()) || descriptionLower.includes(keyword.toLowerCase())) {
        console.log('❌ ブロックキーワードが含まれています:', keyword);
        return false;
      }
    }
    
    console.log('✅ 全てのスケジュールルールに適合しています');
    return true;
  }

  /**
   * 手動でのルール検証（支払い用）
   */
  private validatePaymentRulesManually(paymentPlan: PaymentPlan, userRules: UserRules): boolean {
          console.log('🔄 ZKP回路失敗 - ルール検証フォールバックを実行');
    
    // アドレスホワイトリストチェック
    const addressAllowed = userRules.allowedAddresses.some(addr => 
      addr.toLowerCase() === paymentPlan.toAddress.toLowerCase()
    );
    if (!addressAllowed) {
      console.log('❌ アドレスがホワイトリストにありません:', paymentPlan.toAddress);
      console.log('📋 許可アドレス一覧:', userRules.allowedAddresses);
      return false;
    }
    
    // 金額上限チェック
    if (paymentPlan.amount > userRules.maxAmount) {
      console.log('❌ 金額が上限を超えています:', paymentPlan.amount, '>', userRules.maxAmount);
      return false;
    }
    
    // 時間制限チェック
    const currentHour = new Date(paymentPlan.timestamp * 1000).getHours();
    if (currentHour < userRules.allowedTimeStart || currentHour > userRules.allowedTimeEnd) {
      console.log('❌ 許可時間外です:', currentHour, 'not in', userRules.allowedTimeStart, '-', userRules.allowedTimeEnd);
      return false;
    }
    
    console.log('✅ 全ての支払いルールに適合しています');
    return true;
  }

  /**
   * 回路ファイルの存在確認
   */
  private checkCircuitFiles(): boolean {
    const wasmExists = fs.existsSync(this.circuitWasmPath);
    const zkeyExists = fs.existsSync(this.circuitZkeyPath);
    
    if (!wasmExists) {
      console.warn(`WASMファイルが見つかりません: ${this.circuitWasmPath}`);
    }
    if (!zkeyExists) {
      console.warn(`ZKEYファイルが見つかりません: ${this.circuitZkeyPath}`);
    }
    
    return wasmExists && zkeyExists;
  }

  /**
   * 証明データの詳細解析
   */
  analyzeProofResults(publicSignals: string[]) {
    return {
      isValid: publicSignals[0] === '1',
      addressValid: publicSignals[1] === '1',
      amountValid: publicSignals[2] === '1',
      timeValid: publicSignals[3] === '1'
    };
  }

  /**
   * テスト用のダミー証明生成
   */
  generateDummyProof(isValid: boolean = true): ZKPProof {
    return {
      proof: {
        pi_a: ["0x123", "0x456", "1"],
        pi_b: [["0x789", "0xabc"], ["0xdef", "0x012"], ["1", "0"]],
        pi_c: ["0x345", "0x678", "1"],
        protocol: "groth16",
        curve: "bn128"
      },
      publicSignals: [isValid ? "1" : "0", "1", "1", "1"],
      isValid
    };
  }

  /**
   * デフォルトのスケジュールルールを取得
   */
  static getDefaultScheduleRules(): ScheduleRules {
    return {
      allowedTimeStart: 9,
      allowedTimeEnd: 18,
      allowedDaysOfWeek: [1, 2, 3, 4, 5], // 月-金
      maxMeetingDuration: 180, // 3時間
      blockedKeywords: ['confidential', 'secret', 'internal only', '機密', '秘密'],
      requireApprovalAfterHours: true
    };
  }
} 