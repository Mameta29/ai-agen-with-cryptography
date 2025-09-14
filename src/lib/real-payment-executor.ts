import { createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

export interface PaymentRequest {
  to: string;
  amount: number; // JPY amount
  reason: string;
  intentHash: string;
  policyHash: string;
  zkpProof?: any;
}

export interface PaymentResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  gasUsed?: bigint;
  actualAmount?: string;
  timestamp: number;
}

/**
 * 実際のブロックチェーン送金実行システム
 * 指定されたアドレスに実際にETHを送金します
 */
export class RealPaymentExecutor {
  private walletClient: any;
  private account: any;
  private whitelistedAddresses: string[];

  constructor() {
    // 環境変数から秘密鍵を読み取り
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY環境変数が設定されていません');
    }

    // ホワイトリストアドレス
    this.whitelistedAddresses = [
      '0xE2F2E032B02584e81437bA8Df18F03d6771F9d23',
      '0xF2431b618B5b02923922c525885DBfFcdb9DE853',
    ];

    // アカウント作成
    this.account = privateKeyToAccount(privateKey as `0x${string}`);
    
    // ウォレットクライアント作成
    this.walletClient = createWalletClient({
      account: this.account,
      chain: sepolia,
      transport: http(process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/your_key'),
    });

    console.log('💳 実際の送金システム初期化完了');
    console.log(`📍 送金元アドレス: ${this.account.address}`);
    console.log(`🏦 ホワイトリスト: ${this.whitelistedAddresses.join(', ')}`);
  }

  /**
   * 実際の送金実行
   */
  async executePayment(request: PaymentRequest): Promise<PaymentResult> {
    console.log('💸 実際の送金実行開始...');
    console.log(`📍 送金先: ${request.to}`);
    console.log(`💰 金額: ${request.amount}円相当`);
    
    const startTime = Date.now();

    try {
      // 1. ホワイトリストチェック
      if (!this.whitelistedAddresses.includes(request.to)) {
        throw new Error(`送金先がホワイトリストにありません: ${request.to}`);
      }

      // 2. JPYをETHに変換（簡易レート: 1ETH = 300,000JPY）
      const ethAmount = request.amount / 300000;
      const weiAmount = parseEther(ethAmount.toString());

      console.log(`🔄 変換: ${request.amount}円 → ${ethAmount}ETH`);

      // 3. 残高チェック
      const balance = await this.walletClient.getBalance({
        address: this.account.address,
      });
      
      console.log(`💰 現在残高: ${formatEther(balance)}ETH`);

      if (balance < weiAmount) {
        throw new Error(`残高不足: ${formatEther(balance)}ETH < ${ethAmount}ETH`);
      }

      // 4. 実際の送金実行
      console.log('🚀 ブロックチェーン送金実行中...');
      
      const hash = await this.walletClient.sendTransaction({
        to: request.to as `0x${string}`,
        value: weiAmount,
        data: `0x${Buffer.from(JSON.stringify({
          reason: request.reason,
          intentHash: request.intentHash,
          policyHash: request.policyHash,
          timestamp: Date.now(),
        })).toString('hex')}`,
      });

      console.log(`✅ 送金完了! トランザクションハッシュ: ${hash}`);

      // 5. トランザクション確認待機
      console.log('⏳ トランザクション確認待機中...');
      const receipt = await this.walletClient.waitForTransactionReceipt({ hash });

      console.log(`🎉 送金確認完了! ガス使用量: ${receipt.gasUsed}`);

      return {
        success: true,
        transactionHash: hash,
        gasUsed: receipt.gasUsed,
        actualAmount: `${ethAmount}ETH`,
        timestamp: Date.now(),
      };

    } catch (error) {
      console.error('❌ 送金実行エラー:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 残高確認
   */
  async getBalance(): Promise<string> {
    try {
      const balance = await this.walletClient.getBalance({
        address: this.account.address,
      });
      return formatEther(balance);
    } catch (error) {
      console.error('残高取得エラー:', error);
      return '0';
    }
  }

  /**
   * ホワイトリストアドレス確認
   */
  isWhitelisted(address: string): boolean {
    return this.whitelistedAddresses.includes(address);
  }

  /**
   * 送金可能性チェック
   */
  async canExecutePayment(request: PaymentRequest): Promise<{
    canExecute: boolean;
    reason: string;
    estimatedGas?: bigint;
  }> {
    try {
      // ホワイトリストチェック
      if (!this.isWhitelisted(request.to)) {
        return {
          canExecute: false,
          reason: `送金先がホワイトリストにありません: ${request.to}`,
        };
      }

      // 残高チェック
      const balance = await this.walletClient.getBalance({
        address: this.account.address,
      });

      const ethAmount = request.amount / 300000;
      const weiAmount = parseEther(ethAmount.toString());

      if (balance < weiAmount) {
        return {
          canExecute: false,
          reason: `残高不足: ${formatEther(balance)}ETH < ${ethAmount}ETH`,
        };
      }

      // ガス見積もり
      const estimatedGas = await this.walletClient.estimateGas({
        to: request.to as `0x${string}`,
        value: weiAmount,
        account: this.account,
      });

      return {
        canExecute: true,
        reason: '送金実行可能',
        estimatedGas,
      };

    } catch (error) {
      return {
        canExecute: false,
        reason: `送金可能性チェックエラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * システム情報取得
   */
  getSystemInfo() {
    return {
      senderAddress: this.account.address,
      whitelistedAddresses: this.whitelistedAddresses,
      network: 'Ethereum Sepolia',
      rpcUrl: process.env.SEPOLIA_RPC_URL || 'default',
    };
  }
} 