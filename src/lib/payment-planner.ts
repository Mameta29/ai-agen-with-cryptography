import OpenAI from 'openai';
import { InvoiceData } from './gmail';
import { PaymentPlan, UserRules } from './zkp-prover';

export interface RuleCompliance {
  isCompliant: boolean;
  violations: Array<{
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  confidence: number;
}

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high';
  factors: string[];
  score: number;
}

export class PaymentPlanner {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  /**
   * 請求書データから支払い計画を立案
   * @param {InvoiceData} invoiceData - 解析された請求書データ
   * @param {UserRules} userRules - ユーザー設定のルール
   * @returns {PaymentPlan} 支払い計画
   */
  async createPaymentPlan(invoiceData: InvoiceData, userRules: UserRules): Promise<PaymentPlan> {
    try {
      console.log('支払い計画立案を開始');
      console.log('請求書データ:', invoiceData);
      console.log('ユーザールール:', userRules);

      // 基本的な支払い計画を生成
      const basePlan = {
        toAddress: invoiceData.paymentAddress || this.generateMockAddress(invoiceData.vendorName),
        amount: invoiceData.amount,
        timestamp: Math.floor(Date.now() / 1000),
        invoiceNumber: invoiceData.invoiceNumber,
        description: `Payment for ${invoiceData.vendorName}`,
        companyName: invoiceData.vendorName
      };

      // 支払いタイミングの最適化
      const optimizedTiming = await this.optimizePaymentTiming(basePlan, userRules);

      const finalPlan: PaymentPlan = {
        ...basePlan,
        timestamp: optimizedTiming.recommendedTimestamp,
        confidence: 1.0, // ZKPで検証されるため固定
        recommendedAction: 'execute'
      };

      // リスク評価
      finalPlan.riskAssessment = await this.assessPaymentRisk(finalPlan, userRules);

      console.log('最終支払い計画:', finalPlan);
      
      return finalPlan;

    } catch (error) {
      console.error('支払い計画立案エラー:', error);
      throw error;
    }
  }

  /**
   * ルール適合性をチェック
   * @param {PaymentPlan} paymentPlan - 支払い計画
   * @param {UserRules} userRules - ユーザールール
   * @returns {RuleCompliance} 適合性チェック結果
   */
  async checkRuleCompliance(paymentPlan: PaymentPlan, userRules: UserRules): Promise<RuleCompliance> {
    const violations = [];
    let confidence = 1.0;

    // アドレスホワイトリストチェック
    if (!userRules.allowedAddresses.includes(paymentPlan.toAddress.toLowerCase())) {
      violations.push({
        type: 'address_not_whitelisted',
        message: `支払い先アドレス ${paymentPlan.toAddress} はホワイトリストに登録されていません`,
        severity: 'high' as const
      });
      confidence -= 0.4;
    }

    // 金額上限チェック
    if (paymentPlan.amount > userRules.maxAmount) {
      violations.push({
        type: 'amount_exceeds_limit',
        message: `支払い金額 ${paymentPlan.amount} が上限 ${userRules.maxAmount} を超えています`,
        severity: 'high' as const
      });
      confidence -= 0.5;
    }

    // 時間制限チェック
    const paymentHour = new Date(paymentPlan.timestamp * 1000).getHours();
    if (paymentHour < userRules.allowedTimeStart || paymentHour > userRules.allowedTimeEnd) {
      violations.push({
        type: 'time_restriction',
        message: `支払い時刻 ${paymentHour}時 が許可時間帯 ${userRules.allowedTimeStart}-${userRules.allowedTimeEnd}時 外です`,
        severity: 'medium' as const
      });
      confidence -= 0.2;
    }

    return {
      isCompliant: violations.length === 0,
      violations,
      confidence: Math.max(confidence, 0)
    };
  }

  /**
   * 支払いタイミングの最適化
   */
  private async optimizePaymentTiming(basePlan: any, userRules: UserRules) {
    const currentTime = Math.floor(Date.now() / 1000);
    const currentHour = new Date().getHours();

    // 許可時間内かチェック
    if (currentHour >= userRules.allowedTimeStart && currentHour <= userRules.allowedTimeEnd) {
      return {
        recommendedTimestamp: currentTime,
        reason: '現在時刻が許可時間内のため即座に実行'
      };
    }

    // 次の許可時間まで待機
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(userRules.allowedTimeStart, 0, 0, 0);

    return {
      recommendedTimestamp: Math.floor(tomorrow.getTime() / 1000),
      reason: `許可時間外のため明日 ${userRules.allowedTimeStart}時まで待機`
    };
  }

  /**
   * 支払いリスク評価
   */
  private async assessPaymentRisk(paymentPlan: PaymentPlan, userRules: UserRules): Promise<RiskAssessment> {
    const factors = [];
    let score = 0;

    // アドレスリスク
    if (!userRules.allowedAddresses.includes(paymentPlan.toAddress.toLowerCase())) {
      factors.push('未承認のアドレス');
      score += 30;
    }

    // 金額リスク
    if (paymentPlan.amount > userRules.maxAmount * 0.8) {
      factors.push('高額な支払い');
      score += 20;
    }

    // 時間リスク
    const paymentHour = new Date(paymentPlan.timestamp * 1000).getHours();
    if (paymentHour < userRules.allowedTimeStart || paymentHour > userRules.allowedTimeEnd) {
      factors.push('営業時間外');
      score += 15;
    }

    // 会社名の信頼度
    if (!userRules.trustedDomains.some(domain => 
      (paymentPlan.companyName || '').toLowerCase().includes(domain.toLowerCase())
    )) {
      factors.push('未知の会社');
      score += 10;
    }

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (score >= 50) riskLevel = 'high';
    else if (score >= 25) riskLevel = 'medium';

    return {
      riskLevel,
      factors,
      score
    };
  }

  /**
   * 会社名からEthereumアドレスを推測生成（デモ用）
   */
  private generateMockAddress(companyName: string): string {
    // 会社名のハッシュから決定論的にアドレスを生成（デモ用）
    const hash = this.simpleHash(companyName);
    return `0x${hash.substring(0, 40)}`;
  }

  /**
   * 簡易ハッシュ関数（デモ用）
   */
  private simpleHash(str: string): string {
    if (!str || typeof str !== 'string') {
      str = 'default';
    }
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return Math.abs(hash).toString(16).padStart(40, '0');
  }

  /**
   * テスト用のダミー支払い計画生成
   */
  generateDummyPlan(): PaymentPlan {
    return {
      toAddress: "0x1234567890123456789012345678901234567890",
      amount: 100,
      timestamp: Math.floor(Date.now() / 1000),
      invoiceNumber: "INV-2024-001",
      description: "テスト支払い",
      companyName: "Test Company",
      confidence: 1.0,
      recommendedAction: 'execute'
    };
  }
} 