import { NextRequest, NextResponse } from 'next/server';
import { EmailProcessor, ProcessingConfig } from '@/lib/email-processor';

/**
 * 統合システム用のEmailProcessorを取得
 */
function getEmailProcessor(): EmailProcessor {
  const config: ProcessingConfig = EmailProcessor.getDefaultConfig();
  return new EmailProcessor(config);
}

/**
 * POST /api/process-emails
 * 統合AI + zkVM + 送金システムでメール処理を実行
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📧 Starting integrated email processing...');

    const processor = getEmailProcessor();

    // システム健全性チェック
    const health = await processor.checkSystemHealth();
    console.log('🔍 System health:', health);
    
    // 統合システムでメール処理を実行
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
      paymentsExecuted: results.filter(r => r.action === 'payment_executed').length,
      zkVMEvaluations: results.filter(r => r.details?.zkVMEvaluation?.proofGenerated).length,
    };
    
    console.log('📊 Processing statistics:', stats);

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} emails with integrated AI + zkVM + Payment system`,
      stats,
      results: results.map(result => ({
        messageId: result.messageId,
        type: result.type,
        success: result.success,
        action: result.action,
        aiModel: result.details?.aiAnalysis?.modelUsed,
        isActualAI: result.details?.aiAnalysis?.isActualAI,
        zkVMProofGenerated: result.details?.zkVMEvaluation?.proofGenerated,
        paymentExecuted: result.details?.paymentResult?.success,
        transactionHash: result.details?.paymentResult?.transactionHash,
        processingTime: result.details?.processingTime,
        error: result.details?.error,
      })),
      systemHealth: health
    });
    
  } catch (error) {
    console.error('❌ Integrated email processing API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Error occurred during integrated email processing'
    }, { status: 500 });
  }
}

/**
 * GET /api/process-emails
 * 統合システムの状態確認
 */
export async function GET(request: NextRequest) {
  try {
    const processor = getEmailProcessor();
    const healthCheck = await processor.checkSystemHealth();
    const systemConfig = processor.getSystemConfig();

    return NextResponse.json({
      success: true,
      message: 'Integrated AI + zkVM + Payment Automation System',
      features: {
        localAI: systemConfig.localAI.enabled,
        zkVMProofs: systemConfig.zkVM.enabled,
        blockchainPayments: systemConfig.payment.enabled,
        dynamicPolicies: true,
        verifiableInference: true,
      },
      systemHealth: healthCheck,
      configuration: {
        localAI: {
          enabled: systemConfig.localAI.enabled,
          model: systemConfig.localAI.model,
          fallback: systemConfig.localAI.fallbackToPatternMatching,
        },
        zkVM: {
          enabled: systemConfig.zkVM.enabled,
          timeout: systemConfig.zkVM.timeout,
        },
        payment: {
          enabled: systemConfig.payment.enabled,
          network: systemConfig.payment.network,
          whitelistedAddresses: systemConfig.payment.whitelistedAddresses,
          maxAmount: systemConfig.payment.maxAmount,
        },
        userPolicy: {
          maxPerPayment: systemConfig.userPolicy.maxPerPayment,
          maxPerDay: systemConfig.userPolicy.maxPerDay,
          categoryRules: Object.keys(systemConfig.userPolicy.categoryRules),
          conditionalRules: systemConfig.userPolicy.conditionalRules.length,
        },
      }
    });
    
  } catch (error) {
    console.error('❌ System status check error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Error occurred during system status check'
    }, { status: 500 });
  }
} 