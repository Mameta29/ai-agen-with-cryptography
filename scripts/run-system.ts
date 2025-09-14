#!/usr/bin/env ts-node

/**
 * AI Gmail Automation System - Production Runner
 * Integrated Local AI + zkVM + Blockchain Payment System
 */

import { EmailProcessor, ProcessingConfig } from '../src/lib/email-processor';
import { RealLocalAI } from '../src/lib/real-local-ai';
import { ZkVMPolicyEngine } from '../src/lib/zkvm-policy-engine';
import { RealPaymentExecutor } from '../src/lib/real-payment-executor';

class SystemRunner {
  private processor: EmailProcessor;
  private config: ProcessingConfig;

  constructor() {
    // Load configuration from environment
    this.config = EmailProcessor.getDefaultConfig();
    this.processor = new EmailProcessor(this.config);
    
    console.log('🚀 AI Gmail Automation System initialized');
    console.log('🔧 Configuration loaded from environment variables');
  }

  /**
   * Run system health check
   */
  async checkSystemHealth(): Promise<void> {
    console.log('\n🔍 System Health Check');
    console.log('-'.repeat(50));

    const health = await this.processor.checkSystemHealth();
    
    console.log(`🤖 Local AI: ${health.localAI ? '✅ Online' : '❌ Offline'}`);
    console.log(`🔐 zkVM: ${health.zkVM ? '✅ Ready' : '❌ Error'}`);
    console.log(`💸 Payment: ${health.payment ? '✅ Ready' : '❌ Error'}`);
    console.log(`📧 Gmail: ${health.gmail ? '✅ Connected' : '❌ Disconnected'}`);

    const overallHealth = Object.values(health).every(status => status);
    console.log(`\n📊 Overall System Health: ${overallHealth ? '✅ Healthy' : '⚠️ Issues Detected'}`);

    if (!overallHealth) {
      console.log('\n⚠️ System Issues Detected:');
      if (!health.localAI) console.log('   - Local AI connection failed (will use fallback)');
      if (!health.zkVM) console.log('   - zkVM binary not available (will use manual evaluation)');
      if (!health.payment) console.log('   - Payment system not ready (insufficient balance or connection error)');
      if (!health.gmail) console.log('   - Gmail connection failed');
    }
  }

  /**
   * Process emails with integrated system
   */
  async processEmails(): Promise<void> {
    console.log('\n📧 Processing New Emails');
    console.log('-'.repeat(50));

    try {
      const results = await this.processor.processNewEmails();
      
      console.log(`\n📊 Processing Summary:`);
      console.log(`   Total: ${results.length} emails`);
      console.log(`   Successful: ${results.filter(r => r.success).length}`);
      console.log(`   Failed: ${results.filter(r => !r.success).length}`);
      
      const stats = {
        invoices: results.filter(r => r.type === 'invoice').length,
        schedules: results.filter(r => r.type === 'schedule').length,
        others: results.filter(r => r.type === 'other').length,
        paymentsExecuted: results.filter(r => r.action === 'payment_executed').length,
        zkVMProofs: results.filter(r => r.details?.zkVMEvaluation?.proofGenerated).length,
      };

      console.log(`\n📈 Detailed Statistics:`);
      console.log(`   📄 Invoices: ${stats.invoices}`);
      console.log(`   📅 Schedules: ${stats.schedules}`);
      console.log(`   📝 Others: ${stats.others}`);
      console.log(`   💸 Payments Executed: ${stats.paymentsExecuted}`);
      console.log(`   🔐 zkVM Proofs Generated: ${stats.zkVMProofs}`);

      // Display detailed results
      if (results.length > 0) {
        console.log(`\n📋 Detailed Results:`);
        results.forEach((result, index) => {
          console.log(`\n   ${index + 1}. Message ${result.messageId.substring(0, 8)}...`);
          console.log(`      Type: ${result.type}`);
          console.log(`      Action: ${result.action}`);
          console.log(`      Success: ${result.success ? '✅' : '❌'}`);
          
          if (result.details?.aiAnalysis) {
            console.log(`      AI Model: ${result.details.aiAnalysis.modelUsed}`);
            console.log(`      AI Confidence: ${result.details.aiAnalysis.confidence}`);
          }
          
          if (result.details?.zkVMEvaluation) {
            console.log(`      zkVM Proof: ${result.details.zkVMEvaluation.proofGenerated ? '✅' : '❌'}`);
            console.log(`      Policy Approved: ${result.details.zkVMEvaluation.approved ? '✅' : '❌'}`);
          }
          
          if (result.details?.paymentResult) {
            console.log(`      Payment: ${result.details.paymentResult.success ? '✅' : '❌'}`);
            if (result.details.paymentResult.transactionHash) {
              console.log(`      Tx Hash: ${result.details.paymentResult.transactionHash}`);
            }
          }
        });
      }

    } catch (error) {
      console.error('❌ Email processing failed:', error);
    }
  }

  /**
   * Display system configuration
   */
  displayConfiguration(): void {
    console.log('\n⚙️ System Configuration');
    console.log('-'.repeat(50));

    const config = this.processor.getSystemConfig();

    console.log('🤖 Local AI:');
    console.log(`   Enabled: ${config.localAI.enabled}`);
    console.log(`   Model: ${config.localAI.model}`);
    console.log(`   API URL: ${config.localAI.apiUrl}`);
    console.log(`   Fallback: ${config.localAI.fallbackToPatternMatching}`);

    console.log('\n🔐 zkVM:');
    console.log(`   Enabled: ${config.zkVM.enabled}`);
    console.log(`   Binary Path: ${config.zkVM.hostBinaryPath}`);
    console.log(`   Timeout: ${config.zkVM.timeout / 1000}s`);

    console.log('\n💸 Payment System:');
    console.log(`   Enabled: ${config.payment.enabled}`);
    console.log(`   Network: ${config.payment.network}`);
    console.log(`   Max Amount: ${config.payment.maxAmount.toLocaleString()}円`);
    console.log(`   Whitelisted Addresses: ${config.payment.whitelistedAddresses.length}`);
    config.payment.whitelistedAddresses.forEach(addr => {
      console.log(`     - ${addr}`);
    });

    console.log('\n⚙️ User Policy:');
    console.log(`   Max Per Payment: ${config.userPolicy.maxPerPayment.toLocaleString()}円`);
    console.log(`   Max Per Day: ${config.userPolicy.maxPerDay.toLocaleString()}円`);
    console.log(`   Max Per Week: ${config.userPolicy.maxPerWeek.toLocaleString()}円`);
    console.log(`   Allowed Hours: ${config.userPolicy.allowedHours.start}:00 - ${config.userPolicy.allowedHours.end}:00`);
    console.log(`   Category Rules: ${Object.keys(config.userPolicy.categoryRules).length}`);
    console.log(`   Conditional Rules: ${config.userPolicy.conditionalRules.length}`);
    console.log(`   Min AI Confidence: ${config.userPolicy.minAIConfidence}`);
  }

  /**
   * Run interactive mode
   */
  async runInteractive(): Promise<void> {
    console.log('🎯 AI Gmail Automation System - Interactive Mode');
    console.log('='.repeat(70));

    // Display configuration
    this.displayConfiguration();

    // Health check
    await this.checkSystemHealth();

    // Process emails
    await this.processEmails();

    console.log('\n🎉 System execution completed');
    console.log('='.repeat(70));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';

  const runner = new SystemRunner();

  switch (command) {
    case 'health':
      await runner.checkSystemHealth();
      break;
    
    case 'config':
      runner.displayConfiguration();
      break;
    
    case 'process':
      await runner.processEmails();
      break;
    
    case 'run':
    default:
      await runner.runInteractive();
      break;
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ System execution failed:', error);
    process.exit(1);
  });
}

export { SystemRunner }; 