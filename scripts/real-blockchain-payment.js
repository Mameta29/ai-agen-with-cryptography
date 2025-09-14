#!/usr/bin/env node

/**
 * 実際のブロックチェーン送金実行スクリプト
 * 指定されたアドレスに実際にETHを送金します
 */

// 環境変数を読み込み
require('dotenv').config({ path: '.env.local' });

const { createWalletClient, http, parseEther, formatEther, createPublicClient } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { sepolia } = require('viem/chains');
const crypto = require('crypto');

class RealBlockchainPayment {
  constructor() {
    // 環境変数チェック
    this.privateKey = process.env.PRIVATE_KEY;
    this.rpcUrl = process.env.SEPOLIA_RPC_URL;
    
    console.log('🔧 Environment check:');
    console.log(`   PRIVATE_KEY: ${this.privateKey ? '✅ Set' : '❌ Missing'}`);
    console.log(`   SEPOLIA_RPC_URL: ${this.rpcUrl ? '✅ Set' : '❌ Missing'}`);
    
    if (!this.privateKey || !this.rpcUrl) {
      throw new Error('PRIVATE_KEY and SEPOLIA_RPC_URL must be set in .env.local');
    }

    // ホワイトリストアドレス
    this.whitelistedAddresses = [
      '0xE2F2E032B02584e81437bA8Df18F03d6771F9d23',
      '0xF2431b618B5b02923922c525885DBfFcdb9DE853',
    ];

    // アカウント作成
    this.account = privateKeyToAccount(this.privateKey);
    
    // クライアント作成
    this.walletClient = createWalletClient({
      account: this.account,
      chain: sepolia,
      transport: http(this.rpcUrl),
    });

    this.publicClient = createPublicClient({
      chain: sepolia,
      transport: http(this.rpcUrl),
    });

    console.log('💳 実際のブロックチェーン送金システム初期化');
    console.log(`📍 送金元アドレス: ${this.account.address}`);
    console.log(`🌐 ネットワーク: Ethereum Sepolia`);
  }

  /**
   * 残高確認
   */
  async checkBalance() {
    try {
      const balance = await this.publicClient.getBalance({
        address: this.account.address,
      });
      
      const ethBalance = formatEther(balance);
      console.log(`💰 現在残高: ${ethBalance} ETH`);
      
      return { balance: ethBalance, wei: balance };
    } catch (error) {
      console.error('❌ 残高確認エラー:', error);
      return { balance: '0', wei: 0n };
    }
  }

  /**
   * 実際の送金実行
   */
  async executePayment(toAddress, jpyAmount, reason = 'AI Automated Payment') {
    console.log('\n💸 実際のブロックチェーン送金実行');
    console.log('-'.repeat(50));
    console.log(`📍 送金先: ${toAddress}`);
    console.log(`💰 金額: ${jpyAmount.toLocaleString()}円`);
    console.log(`📝 理由: ${reason}`);

    try {
      // 1. ホワイトリストチェック
      if (!this.whitelistedAddresses.includes(toAddress)) {
        throw new Error(`送金先がホワイトリストにありません: ${toAddress}`);
      }
      console.log('✅ ホワイトリストチェック通過');

      // 2. 残高確認
      const { balance, wei } = await this.checkBalance();
      
      // 3. JPY → ETH変換（1ETH = 300,000JPY）
      const ethAmount = jpyAmount / 300000;
      const weiAmount = parseEther(ethAmount.toString());
      
      console.log(`🔄 変換: ${jpyAmount.toLocaleString()}円 → ${ethAmount} ETH`);

      if (wei < weiAmount) {
        throw new Error(`残高不足: ${balance} ETH < ${ethAmount} ETH`);
      }

      // 4. ガス見積もり
      console.log('⛽ ガス見積もり中...');
      const estimatedGas = await this.publicClient.estimateGas({
        account: this.account,
        to: toAddress,
        value: weiAmount,
      });
      
      console.log(`⛽ 予想ガス: ${estimatedGas.toString()}`);

      // 5. 実際の送金実行
      console.log('🚀 トランザクション送信中...');
      
      const hash = await this.walletClient.sendTransaction({
        to: toAddress,
        value: weiAmount,
        data: `0x${Buffer.from(JSON.stringify({
          reason,
          jpyAmount,
          ethAmount,
          timestamp: Date.now(),
          automatedPayment: true,
        })).toString('hex')}`,
      });

      console.log(`📄 トランザクションハッシュ: ${hash}`);
      console.log(`🔗 Etherscan: https://sepolia.etherscan.io/tx/${hash}`);

      // 6. トランザクション確認待機
      console.log('⏳ トランザクション確認待機中...');
      
      const receipt = await this.publicClient.waitForTransactionReceipt({ 
        hash,
        timeout: 60000 // 60秒タイムアウト
      });

      console.log('🎉 送金確認完了!');
      console.log(`📊 ブロック番号: ${receipt.blockNumber}`);
      console.log(`⛽ 実際のガス使用量: ${receipt.gasUsed}`);
      console.log(`💎 送金額: ${ethAmount} ETH (${jpyAmount.toLocaleString()}円)`);

      return {
        success: true,
        transactionHash: hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        actualAmount: `${ethAmount} ETH`,
        jpyAmount: `${jpyAmount}円`,
        etherscanUrl: `https://sepolia.etherscan.io/tx/${hash}`,
        timestamp: Date.now(),
      };

    } catch (error) {
      console.error('❌ 送金実行エラー:', error);
      
      return {
        success: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 送金テスト（少額）
   */
  async testPayment() {
    console.log('🧪 実際の送金テスト実行');
    console.log('='.repeat(60));

    // テスト用少額送金（1,000円 = 0.0033ETH）
    const testAmount = 1000; // 1,000円
    const testAddress = this.whitelistedAddresses[0];

    console.log(`🎯 テスト送金: ${testAmount}円 → ${testAddress}`);

    const result = await this.executePayment(
      testAddress,
      testAmount,
      'Test payment from AI Gmail Automation System'
    );

    if (result.success) {
      console.log('\n🎉 テスト送金成功!');
      console.log(`🔗 確認URL: ${result.etherscanUrl}`);
      
      // 結果をファイルに保存
      const fs = require('fs');
      fs.writeFileSync('test-payment-result.json', JSON.stringify(result, null, 2));
      console.log('📄 結果保存: test-payment-result.json');
    } else {
      console.log('\n❌ テスト送金失敗');
      console.log(`エラー: ${result.error}`);
    }

    return result;
  }

  /**
   * 統合システムでの送金実行
   */
  async executeIntegratedPayment() {
    console.log('🔗 統合システムでの実際の送金実行');
    console.log('='.repeat(60));

    // AI分析をシミュレート
    const mockEmail = {
      subject: '【請求書】テストサービス利用料',
      content: `
テスト株式会社からの請求書

請求金額: 5,000円
サービス: テストサービス
請求書番号: TEST-2024-12-001
お支払期限: 2025年1月31日

少額テスト送金です。
      `.trim()
    };

    // AI分析結果
    const amountMatch = mockEmail.content.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
    const amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : 0;
    const vendorMatch = mockEmail.content.match(/([^\n]+株式会社)/);
    const vendor = vendorMatch ? vendorMatch[1] : 'テスト株式会社';

    console.log('🤖 AI分析結果:');
    console.log(`   金額: ${amount.toLocaleString()}円`);
    console.log(`   ベンダー: ${vendor}`);

    // Intent生成
    const intent = {
      amount,
      vendor,
      recipient: this.whitelistedAddresses[0],
    };

    // ポリシー評価（簡易版）
    const approved = amount <= 10000; // 1万円以下は自動承認
    console.log(`🔐 ポリシー評価: ${approved ? '✅ 承認' : '❌ 拒否'}`);

    if (approved) {
      // 実際の送金実行
      const result = await this.executePayment(
        intent.recipient,
        intent.amount,
        `AI自動支払い: ${vendor}`
      );

      return result;
    } else {
      console.log('❌ ポリシー評価で拒否されました');
      return { success: false, error: 'Policy rejected' };
    }
  }
}

// メイン実行
async function main() {
  try {
    const payment = new RealBlockchainPayment();
    
    const args = process.argv.slice(2);
    const command = args[0] || 'test';

    switch (command) {
      case 'balance':
        await payment.checkBalance();
        break;
        
      case 'test':
        await payment.testPayment();
        break;
        
      case 'integrated':
        await payment.executeIntegratedPayment();
        break;
        
      default:
        console.log('使用方法:');
        console.log('  node scripts/real-blockchain-payment.js balance   - 残高確認');
        console.log('  node scripts/real-blockchain-payment.js test      - テスト送金');
        console.log('  node scripts/real-blockchain-payment.js integrated - 統合送金');
    }

  } catch (error) {
    console.error('❌ 実行エラー:', error);
    
    if (error.message.includes('PRIVATE_KEY')) {
      console.log('\n🔧 解決方法:');
      console.log('1. .env.localファイルを確認');
      console.log('2. PRIVATE_KEY=your_private_key を設定');
      console.log('3. SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_key を設定');
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { RealBlockchainPayment }; 