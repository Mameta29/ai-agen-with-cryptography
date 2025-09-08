import { NextRequest, NextResponse } from 'next/server';
import { EmailProcessor, ProcessingConfig } from '@/lib/email-processor';
import { PaymentPolicyEvaluator } from '@/lib/payment-policy';
import { Address } from 'viem';

// グローバルなEmailProcessorインスタンス（シングルトン）
let emailProcessor: EmailProcessor | null = null;

function getEmailProcessor(): EmailProcessor {
  if (!emailProcessor) {
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
      paymentPolicy: PaymentPolicyEvaluator.getDefaultPolicy(),
      options: {
        autoProcessSchedules: true,
        autoProcessPayments: false, // 安全のため、デフォルトは手動承認
        requireManualApprovalForPayments: true,
        sendReplyNotifications: true,
        maxProcessingTimeMs: 30000, // 30秒
      },
    };

    emailProcessor = new EmailProcessor(config);
  }

  return emailProcessor;
}

/**
 * POST /api/process-emails
 * 新着メールを処理
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { since, messageId } = body;

    const processor = getEmailProcessor();

    let results;
    if (messageId) {
      // 特定のメッセージを再処理
      const result = await processor.reprocessMessage(messageId);
      results = [result];
    } else {
      // 新着メールを処理
      const sinceDate = since ? new Date(since) : undefined;
      results = await processor.processNewEmails(sinceDate);
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    });
  } catch (error) {
    console.error('Email processing failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/process-emails/health
 * システムの健全性をチェック
 */
export async function GET(request: NextRequest) {
  try {
    const processor = getEmailProcessor();
    const health = await processor.healthCheck();

    return NextResponse.json({
      success: true,
      health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        health: {
          gmail: false,
          openai: false,
          calendar: false,
          blockchain: false,
          overall: false,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
} 