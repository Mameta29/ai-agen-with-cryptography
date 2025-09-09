import { createWalletClient, createPublicClient, http, parseUnits, formatUnits, Address, encodeFunctionData } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { InvoiceData } from './gmail';

// JPYC Token ABI (ERC20の基本機能)
const JPYC_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

export interface PaymentTransaction {
  to: Address;
  amount: bigint;
  data: string;
  value: bigint;
  gas: bigint;
  gasPrice: bigint;
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  gasUsed?: bigint;
  blockNumber?: bigint;
}

export interface TokenInfo {
  address: Address;
  symbol: string;
  decimals: number;
  balance: bigint;
}

export class BlockchainService {
  private walletClient: any;
  private publicClient: any;
  private account: any;

  constructor(privateKey: string, rpcUrl: string) {
    // 秘密鍵の形式を正規化（0xプレフィックスを追加）
    const normalizedPrivateKey = privateKey.startsWith('0x') 
      ? privateKey 
      : `0x${privateKey}`;
    
    console.log('🔑 Private Key format check:', {
      original: privateKey.substring(0, 10) + '...',
      normalized: normalizedPrivateKey.substring(0, 10) + '...',
      length: normalizedPrivateKey.length
    });
    
    this.account = privateKeyToAccount(normalizedPrivateKey as `0x${string}`);
    
    this.publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain: sepolia,
      transport: http(rpcUrl),
    });

    console.log('Blockchain service initialized for account:', this.account.address);
  }

  /**
   * JPYCトークン情報を取得
   */
  async getTokenInfo(tokenAddress: Address): Promise<TokenInfo> {
    try {
      const [symbol, decimals, balance] = await Promise.all([
        this.publicClient.readContract({
          address: tokenAddress,
          abi: JPYC_ABI,
          functionName: 'symbol',
        }),
        this.publicClient.readContract({
          address: tokenAddress,
          abi: JPYC_ABI,
          functionName: 'decimals',
        }),
        this.publicClient.readContract({
          address: tokenAddress,
          abi: JPYC_ABI,
          functionName: 'balanceOf',
          args: [this.account.address],
        }),
      ]);

      const balanceFormatted = formatUnits(balance as bigint, decimals as number);
      console.log('💰 トークン情報取得:', { 
        symbol, 
        decimals, 
        balance: balance.toString(),
        balanceFormatted: balanceFormatted + ' ' + symbol
      });

      return {
        address: tokenAddress,
        symbol: symbol as string,
        decimals: decimals as number,
        balance: balance as bigint,
      };
    } catch (error) {
      console.error('Failed to get token info:', error);
      throw new Error(`Failed to get token info: ${error}`);
    }
  }

  /**
   * 支払いトランザクションを生成
   */
  async generatePaymentTransaction(
    invoice: InvoiceData,
    tokenAddress: Address,
    recipientAddress: Address
  ): Promise<PaymentTransaction> {
    try {
      // トークン情報を取得
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      
      // 金額を正しい単位に変換
      const amount = parseUnits(invoice.amount.toString(), tokenInfo.decimals);
      
      // 残高チェック
      if (tokenInfo.balance < amount) {
        throw new Error(
          `Insufficient balance: ${formatUnits(tokenInfo.balance, tokenInfo.decimals)} ${tokenInfo.symbol}, required: ${invoice.amount}`
        );
      }

      // transfer関数のdata encodingを準備
      console.log('🔧 ERC20 transfer関数エンコード:', {
        account: this.account.address,
        tokenAddress,
        recipientAddress,
        amount: amount.toString(),
        functionName: 'transfer'
      });
      
      // ERC20 transfer関数のデータをエンコード
      const data = encodeFunctionData({
        abi: JPYC_ABI,
        functionName: 'transfer',
        args: [recipientAddress, amount],
      });
      
      console.log('✅ transfer関数エンコード成功:', {
        data,
        dataLength: data.length
      });
      
      // simulateContractでトランザクションを検証
      await this.publicClient.simulateContract({
        account: this.account,
        address: tokenAddress,
        abi: JPYC_ABI,
        functionName: 'transfer',
        args: [recipientAddress, amount],
      });
      
      console.log('✅ simulateContract検証成功');

      // ガス見積もり
      const gasEstimate = await this.publicClient.estimateContractGas({
        account: this.account,
        address: tokenAddress,
        abi: JPYC_ABI,
        functionName: 'transfer',
        args: [recipientAddress, amount],
      });

      // ガス価格を取得（20%マージンを追加）
      const baseGasPrice = await this.publicClient.getGasPrice();
      const gasPrice = baseGasPrice + (baseGasPrice / BigInt(5)); // 20%増加

      console.log('🔧 トランザクション詳細:', {
        to: tokenAddress,
        recipient: recipientAddress,
        amount: amount.toString(),
        data,
        gasEstimate: gasEstimate.toString(),
        gasPrice: gasPrice.toString()
      });

      if (!data || data === '0x') {
        throw new Error('Failed to encode ERC20 transfer function data');
      }

      return {
        to: tokenAddress,
        amount,
        data,
        value: BigInt(0), // ERC20 transferは ETH value = 0
        gas: gasEstimate + (gasEstimate / BigInt(5)), // 20%のマージンを追加
        gasPrice,
      };
    } catch (error) {
      console.error('Failed to generate payment transaction:', error);
      throw new Error(`Failed to generate payment transaction: ${error}`);
    }
  }

  /**
   * トランザクションを実行
   */
  async executeTransaction(
    transaction: PaymentTransaction,
    invoice: InvoiceData
  ): Promise<TransactionResult> {
    try {
      console.log('Executing payment transaction:', {
        to: transaction.to,
        amount: transaction.amount.toString(),
        invoice: invoice.invoiceNumber,
      });

      // トランザクション送信
      const txHash = await this.walletClient.sendTransaction({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
        gas: transaction.gas,
        gasPrice: transaction.gasPrice,
      });

      console.log('Transaction sent:', txHash);

      // トランザクションの確認を待機
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 60_000, // 60秒でタイムアウト
      });

      console.log('Transaction confirmed:', {
        txHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        status: receipt.status,
      });

      if (receipt.status === 'reverted') {
        return {
          success: false,
          error: 'Transaction reverted',
          txHash,
        };
      }

      return {
        success: true,
        txHash,
        gasUsed: receipt.gasUsed,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error('Transaction execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 支払いを実行（高レベルAPI）
   */
  async executePayment(
    invoice: InvoiceData,
    tokenAddress: Address,
    recipientAddress?: Address
  ): Promise<TransactionResult> {
    try {
      // 受取先アドレスの決定
      let recipient = recipientAddress;
      
      if (!recipient && invoice.paymentAddress) {
        recipient = invoice.paymentAddress as Address;
      }
      
      if (!recipient) {
        throw new Error('No recipient address specified');
      }

      // アドレスの検証
      if (!this.isValidAddress(recipient)) {
        throw new Error(`Invalid recipient address: ${recipient}`);
      }

      // トランザクション生成
      const transaction = await this.generatePaymentTransaction(
        invoice,
        tokenAddress,
        recipient
      );

      // トランザクション実行
      const result = await this.executeTransaction(transaction, invoice);

      return result;
    } catch (error) {
      console.error('Payment execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * トランザクションの状態を確認
   */
  async getTransactionStatus(txHash: string): Promise<{
    status: 'pending' | 'success' | 'failed' | 'not_found';
    blockNumber?: bigint;
    gasUsed?: bigint;
    confirmations?: number;
  }> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });

      const latestBlock = await this.publicClient.getBlockNumber();
      const confirmations = Number(latestBlock - receipt.blockNumber);

      return {
        status: receipt.status === 'success' ? 'success' : 'failed',
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        confirmations,
      };
    } catch (error) {
      // トランザクションが見つからない場合
      if (error instanceof Error && error.message.includes('not found')) {
        return { status: 'not_found' };
      }

      // ペンディング状態の可能性
      try {
        const tx = await this.publicClient.getTransaction({
          hash: txHash as `0x${string}`,
        });
        
        if (tx) {
          return { status: 'pending' };
        }
      } catch {
        // トランザクション自体が存在しない
      }

      return { status: 'not_found' };
    }
  }

  /**
   * アドレスの妥当性をチェック
   */
  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * ガス価格を取得
   */
  async getCurrentGasPrice(): Promise<{
    gasPrice: bigint;
    gasPriceGwei: string;
  }> {
    const gasPrice = await this.publicClient.getGasPrice();
    return {
      gasPrice,
      gasPriceGwei: formatUnits(gasPrice, 9), // Gwei単位
    };
  }

  /**
   * アカウントのETH残高を取得
   */
  async getEthBalance(): Promise<{
    balance: bigint;
    balanceEth: string;
  }> {
    const balance = await this.publicClient.getBalance({
      address: this.account.address,
    });

    return {
      balance,
      balanceEth: formatUnits(balance, 18),
    };
  }

  /**
   * ネットワーク情報を取得
   */
  async getNetworkInfo(): Promise<{
    chainId: number;
    blockNumber: bigint;
    gasPrice: bigint;
  }> {
    const [chainId, blockNumber, gasPrice] = await Promise.all([
      this.publicClient.getChainId(),
      this.publicClient.getBlockNumber(),
      this.publicClient.getGasPrice(),
    ]);

    return {
      chainId,
      blockNumber,
      gasPrice,
    };
  }

  /**
   * トランザクション履歴を取得（簡易版）
   */
  async getRecentTransactions(limit: number = 10): Promise<Array<{
    hash: string;
    to: string;
    value: string;
    blockNumber: bigint;
    timestamp?: number;
  }>> {
    // 実際の実装では、Etherscan APIやThe Graphなどを使用
    // 今回は簡略化してモックデータを返す
    console.log(`Getting recent transactions for ${this.account.address} (limit: ${limit})`);
    return [];
  }

  /**
   * 支払い確認のためのイベントログを取得
   */
  async getPaymentEvents(
    tokenAddress: Address,
    fromBlock: bigint,
    toBlock: bigint = 'latest' as any
  ): Promise<Array<{
    from: Address;
    to: Address;
    amount: bigint;
    txHash: string;
    blockNumber: bigint;
  }>> {
    try {
      // Transfer イベントのログを取得
      const logs = await this.publicClient.getLogs({
        address: tokenAddress,
        event: {
          type: 'event',
          name: 'Transfer',
          inputs: [
            { type: 'address', name: 'from', indexed: true },
            { type: 'address', name: 'to', indexed: true },
            { type: 'uint256', name: 'value' },
          ],
        },
        fromBlock,
        toBlock,
      });

      return logs.map((log: any) => ({
        from: log.args.from,
        to: log.args.to,
        amount: log.args.value,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      }));
    } catch (error) {
      console.error('Failed to get payment events:', error);
      return [];
    }
  }
}

/**
 * ブロックチェーンサービスのファクトリー
 */
export class BlockchainServiceFactory {
  static create(config: {
    privateKey: string;
    rpcUrl: string;
  }): BlockchainService {
    return new BlockchainService(config.privateKey, config.rpcUrl);
  }

  static createFromEnv(): BlockchainService {
    const privateKey = process.env.PRIVATE_KEY;
    const rpcUrl = process.env.SEPOLIA_RPC_URL;

    if (!privateKey || !rpcUrl) {
      throw new Error('Missing required environment variables: PRIVATE_KEY, SEPOLIA_RPC_URL');
    }

    return new BlockchainService(privateKey, rpcUrl);
  }
} 