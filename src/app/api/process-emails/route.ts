import { NextRequest, NextResponse } from 'next/server';
import { EmailProcessor, ProcessingConfig } from '@/lib/email-processor';
import { PaymentPolicy } from '@/lib/payment-policy';
import { UserRules } from '@/lib/zkp-prover';
import { Address } from 'viem';

// ZKP統合版のEmailProcessorを取得
function getEmailProcessor(): EmailProcessor {
  const config: ProcessingConfig = {
    gmailCredentials: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: process.env.GOOGLE_REDIRECT_URI!,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN!, // 実際の実装では、ユーザーごとに管理
    },
    openaiApiKey: process.env.OPENAI_API_KEY!,
    blockchain: {
      privateKey: process.env.PRIVATE_KEY!,
      rpcUrl: process.env.SEPOLIA_RPC_URL!,
      jpycTokenAddress: (process.env.JPYC_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,
    },
    paymentPolicy: {
      maxPerPayment: 100000, // 10万円
      maxPerDay: 500000,     // 50万円
      maxPerWeek: 2000000,   // 200万円
      allowedHours: { start: 9, end: 18 },
      trustedDomains: ['gmail.com', 'company.co.jp'],
      requireManualApproval: {
        amountThreshold: 200000, // 20万円以上
        unknownVendor: true,
        outsideBusinessHours: true,
      }
    } as PaymentPolicy,
    // ZKP用のユーザールール
    userRules: {
      allowedAddresses: [
        '0xF2431b618B5b02923922c525885DBfFcdb9DE853',
        '0xE2F2E032B02584e81437bA8Df18F03d6771F9d23'  // 実際のテストメール用アドレス
      ],
      maxAmount: 100000, // 10万円
      maxDailyAmount: 500000, // 50万円
      allowedTimeStart: 9,
      allowedTimeEnd: 18,
      trustedDomains: ['gmail.com', 'company.co.jp', 'trusted-vendor.com']
    } as UserRules,
    // スケジュール用のルール
    scheduleRules: {
      allowedTimeStart: 9,
      allowedTimeEnd: 18,
      allowedDaysOfWeek: [1, 2, 3, 4, 5], // 月-金
      maxMeetingDuration: 180, // 3時間
      blockedKeywords: ['confidential', 'secret', 'internal only', '機密', '秘密'],
      requireApprovalAfterHours: true
    }
  };

  return new EmailProcessor(config);
}

/**
 * POST /api/process-emails
 * ZKP統合版のメール処理を実行
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 ZKP統合版メール処理API開始');
    
    const processor = getEmailProcessor();
    
    // システム健全性チェック（簡略化）
    console.log('🔍 健全性チェックをスキップ - 直接処理開始');
    
    // ZKP統合版メール処理を実行
    const results = await processor.processNewEmails();
    
    // 結果の統計を計算
    const stats = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      byType: {
        invoice: results.filter(r => r.type === 'invoice').length,
        schedule: results.filter(r => r.type === 'schedule').length,
        other: results.filter(r => r.type === 'other').length,
      },
      zkpVerified: results.filter(r => r.details?.zkpVerified === true).length,
      paymentsExecuted: results.filter(r => r.action === 'zkp_verified_payment_executed').length,
    };
    
    console.log('📊 処理統計:', stats);
    
    return NextResponse.json({
      success: true,
      message: `${results.length}件のメールを処理しました（ZKP統合版）`,
      stats,
      results: results.map(result => ({
        messageId: result.messageId,
        type: result.type,
        success: result.success,
        action: result.action,
        zkpVerified: result.details?.zkpVerified,
        transactionHash: result.details?.transactionHash,
        paymentAmount: result.details?.paymentAmount,
        riskAssessment: result.details?.riskAssessment,
        error: result.details?.error,
        warnings: result.details?.warnings,
      })),
      healthCheck: { skipped: true }
    });
    
  } catch (error) {
    console.error('❌ ZKP統合版メール処理APIエラー:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'ZKP統合版メール処理中にエラーが発生しました'
    }, { status: 500 });
  }
}

/**
 * GET /api/process-emails
 * システム状態とZKP機能の確認
 */
export async function GET(request: NextRequest) {
  try {
    const processor = getEmailProcessor();
    const healthCheck = await processor.healthCheck();
    
    return NextResponse.json({
      success: true,
      message: 'ZKP統合版Gmail自動化システム',
      features: {
        gpt5Nano: true,
        zkpProofs: true,
        paymentPlanning: true,
        riskAssessment: true,
        blockchainIntegration: true,
      },
      healthCheck,
      config: {
        maxPaymentAmount: 100000,
        allowedTimeRange: '9:00-18:00',
        zkpEnabled: healthCheck.zkp,
        trustedDomains: ['gmail.com', 'company.co.jp', 'trusted-vendor.com'],
      }
    });
    
  } catch (error) {
    console.error('❌ システム状態確認エラー:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'システム状態の確認中にエラーが発生しました'
    }, { status: 500 });
  }
} 