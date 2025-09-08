import { InvoiceData } from './gmail';

export interface PaymentPolicy {
  maxPerPayment: number;
  maxPerDay: number;
  maxPerWeek: number;
  maxPerMonth: number;
  allowedHours: {
    start: number; // 0-23
    end: number;   // 0-23
  };
  allowedWeekdays: number[]; // 0-6 (Sunday-Saturday)
  trustedDomains: string[];
  trustedVendors: string[];
  blockedVendors: string[];
  requireManualApproval: {
    amountThreshold: number;
    unknownVendor: boolean;
    outsideBusinessHours: boolean;
  };
  retryPolicy: {
    maxRetries: number;
    retryDelay: number; // minutes
  };
}

export interface VendorTrustInfo {
  domain: string;
  trustScore: number; // 0-100
  paymentHistory: PaymentHistoryItem[];
  easVerified: boolean;
  whitelisted: boolean;
  blacklisted: boolean;
  riskFactors: string[];
}

export interface PaymentHistoryItem {
  date: string;
  amount: number;
  success: boolean;
  invoiceNumber: string;
}

export interface PolicyEvaluationResult {
  approved: boolean;
  requiresManualApproval: boolean;
  reason: string;
  riskScore: number; // 0-100
  violations: string[];
  recommendations: string[];
}

export interface SpendingLimits {
  dailySpent: number;
  weeklySpent: number;
  monthlySpent: number;
  lastPaymentDate?: string;
}

export class PaymentPolicyEvaluator {
  private policy: PaymentPolicy;
  private vendorTrustCache = new Map<string, VendorTrustInfo>();

  constructor(policy: PaymentPolicy) {
    this.policy = policy;
  }

  /**
   * 支払いポリシーを評価
   */
  async evaluatePayment(
    invoice: InvoiceData,
    currentSpending: SpendingLimits,
    currentTime: Date = new Date()
  ): Promise<PolicyEvaluationResult> {
    const violations: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    // 1. 金額制限チェック
    const amountCheck = this.checkAmountLimits(invoice, currentSpending);
    if (!amountCheck.passed) {
      violations.push(...amountCheck.violations);
      riskScore += amountCheck.riskScore;
    }

    // 2. 時間制限チェック
    const timeCheck = this.checkTimeRestrictions(currentTime);
    if (!timeCheck.passed) {
      violations.push(...timeCheck.violations);
      riskScore += timeCheck.riskScore;
    }

    // 3. ベンダー信頼度チェック
    const vendorCheck = await this.checkVendorTrust(invoice);
    if (!vendorCheck.passed) {
      violations.push(...vendorCheck.violations);
      riskScore += vendorCheck.riskScore;
    }
    recommendations.push(...vendorCheck.recommendations);

    // 4. 手動承認が必要かチェック
    const requiresManualApproval = this.checkManualApprovalRequired(
      invoice,
      vendorCheck.trustInfo,
      timeCheck.passed
    );

    // 5. 最終判定
    const approved = violations.length === 0 && !requiresManualApproval;

    return {
      approved,
      requiresManualApproval,
      reason: this.generateReason(approved, requiresManualApproval, violations),
      riskScore: Math.min(riskScore, 100),
      violations,
      recommendations,
    };
  }

  /**
   * 金額制限チェック
   */
  private checkAmountLimits(
    invoice: InvoiceData,
    currentSpending: SpendingLimits
  ): {
    passed: boolean;
    violations: string[];
    riskScore: number;
  } {
    const violations: string[] = [];
    let riskScore = 0;

    // 1回あたりの上限
    if (invoice.amount > this.policy.maxPerPayment) {
      violations.push(`Amount ${invoice.amount} exceeds per-payment limit ${this.policy.maxPerPayment}`);
      riskScore += 30;
    }

    // 日次上限
    if (currentSpending.dailySpent + invoice.amount > this.policy.maxPerDay) {
      violations.push(`Daily spending limit would be exceeded`);
      riskScore += 25;
    }

    // 週次上限
    if (currentSpending.weeklySpent + invoice.amount > this.policy.maxPerWeek) {
      violations.push(`Weekly spending limit would be exceeded`);
      riskScore += 20;
    }

    // 月次上限
    if (currentSpending.monthlySpent + invoice.amount > this.policy.maxPerMonth) {
      violations.push(`Monthly spending limit would be exceeded`);
      riskScore += 20;
    }

    return {
      passed: violations.length === 0,
      violations,
      riskScore,
    };
  }

  /**
   * 時間制限チェック
   */
  private checkTimeRestrictions(currentTime: Date): {
    passed: boolean;
    violations: string[];
    riskScore: number;
  } {
    const violations: string[] = [];
    let riskScore = 0;

    const hour = currentTime.getHours();
    const weekday = currentTime.getDay();

    // 営業時間チェック
    if (hour < this.policy.allowedHours.start || hour >= this.policy.allowedHours.end) {
      violations.push(`Payment outside allowed hours (${this.policy.allowedHours.start}-${this.policy.allowedHours.end})`);
      riskScore += 15;
    }

    // 曜日チェック
    if (!this.policy.allowedWeekdays.includes(weekday)) {
      violations.push(`Payment on non-allowed weekday`);
      riskScore += 10;
    }

    return {
      passed: violations.length === 0,
      violations,
      riskScore,
    };
  }

  /**
   * ベンダー信頼度チェック
   */
  private async checkVendorTrust(invoice: InvoiceData): Promise<{
    passed: boolean;
    violations: string[];
    recommendations: string[];
    riskScore: number;
    trustInfo: VendorTrustInfo;
  }> {
    const violations: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    // ベンダー情報を取得または生成
    const trustInfo = await this.getVendorTrustInfo(invoice.vendorEmail);

    // ブラックリストチェック
    if (trustInfo.blacklisted || this.policy.blockedVendors.includes(trustInfo.domain)) {
      violations.push(`Vendor is blacklisted`);
      riskScore += 50;
    }

    // ホワイトリストチェック
    if (!trustInfo.whitelisted && !this.policy.trustedVendors.includes(invoice.vendorName)) {
      riskScore += 20;
      recommendations.push(`Consider adding ${invoice.vendorName} to trusted vendors list`);
    }

    // 信頼スコアチェック
    if (trustInfo.trustScore < 50) {
      violations.push(`Vendor trust score too low: ${trustInfo.trustScore}`);
      riskScore += 25;
    } else if (trustInfo.trustScore < 70) {
      riskScore += 10;
      recommendations.push(`Vendor has moderate trust score: ${trustInfo.trustScore}`);
    }

    // EAS検証チェック
    if (!trustInfo.easVerified) {
      riskScore += 15;
      recommendations.push(`Vendor not verified on EAS`);
    }

    // 支払い履歴チェック
    if (trustInfo.paymentHistory.length === 0) {
      riskScore += 10;
      recommendations.push(`First payment to this vendor - consider manual review`);
    } else {
      const recentFailures = trustInfo.paymentHistory
        .slice(-5)
        .filter(p => !p.success).length;
      
      if (recentFailures > 2) {
        violations.push(`Too many recent payment failures: ${recentFailures}/5`);
        riskScore += 20;
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      recommendations,
      riskScore,
      trustInfo,
    };
  }

  /**
   * 手動承認が必要かチェック
   */
  private checkManualApprovalRequired(
    invoice: InvoiceData,
    trustInfo: VendorTrustInfo,
    timeRestrictionsPassed: boolean
  ): boolean {
    const { requireManualApproval } = this.policy;

    // 金額しきい値
    if (invoice.amount >= requireManualApproval.amountThreshold) {
      return true;
    }

    // 未知のベンダー
    if (requireManualApproval.unknownVendor && trustInfo.paymentHistory.length === 0) {
      return true;
    }

    // 営業時間外
    if (requireManualApproval.outsideBusinessHours && !timeRestrictionsPassed) {
      return true;
    }

    return false;
  }

  /**
   * ベンダー信頼情報を取得
   */
  private async getVendorTrustInfo(vendorEmail: string): Promise<VendorTrustInfo> {
    const domain = vendorEmail.split('@')[1]?.toLowerCase() || '';
    
    // キャッシュから確認
    const cacheKey = `${vendorEmail}:${domain}`;
    if (this.vendorTrustCache.has(cacheKey)) {
      return this.vendorTrustCache.get(cacheKey)!;
    }

    // 新しい信頼情報を生成
    const trustInfo: VendorTrustInfo = {
      domain,
      trustScore: this.calculateBaseTrustScore(domain, vendorEmail),
      paymentHistory: await this.getPaymentHistory(vendorEmail),
      easVerified: await this.checkEASVerification(vendorEmail),
      whitelisted: this.policy.trustedDomains.includes(domain),
      blacklisted: this.policy.blockedVendors.some(blocked => 
        vendorEmail.includes(blocked) || domain.includes(blocked)
      ),
      riskFactors: [],
    };

    // リスクファクターを計算
    trustInfo.riskFactors = this.calculateRiskFactors(trustInfo);

    // キャッシュに保存（5分間）
    this.vendorTrustCache.set(cacheKey, trustInfo);
    setTimeout(() => this.vendorTrustCache.delete(cacheKey), 5 * 60 * 1000);

    return trustInfo;
  }

  /**
   * 基本信頼スコアを計算
   */
  private calculateBaseTrustScore(domain: string, email: string): number {
    let score = 50; // 基準点

    // 有名ドメインボーナス
    const trustedDomains = ['gmail.com', 'outlook.com', 'yahoo.com', 'company.com'];
    if (trustedDomains.includes(domain)) {
      score += 20;
    }

    // TLDチェック
    if (domain.endsWith('.com') || domain.endsWith('.org') || domain.endsWith('.jp')) {
      score += 10;
    } else if (domain.endsWith('.tk') || domain.endsWith('.ml')) {
      score -= 20; // 怪しいTLD
    }

    // メールアドレスの構造チェック
    if (email.includes('noreply') || email.includes('no-reply')) {
      score += 5; // システムメール
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 支払い履歴を取得（モック実装）
   */
  private async getPaymentHistory(vendorEmail: string): Promise<PaymentHistoryItem[]> {
    // 実際の実装では、データベースから履歴を取得
    // 今回はモックデータを返す
    return [];
  }

  /**
   * EAS検証をチェック（モック実装）
   */
  private async checkEASVerification(vendorEmail: string): Promise<boolean> {
    // 実際の実装では、EASからベンダー情報を確認
    // 今回は常にfalseを返す
    return false;
  }

  /**
   * リスクファクターを計算
   */
  private calculateRiskFactors(trustInfo: VendorTrustInfo): string[] {
    const factors: string[] = [];

    if (trustInfo.trustScore < 30) {
      factors.push('Very low trust score');
    } else if (trustInfo.trustScore < 50) {
      factors.push('Low trust score');
    }

    if (!trustInfo.easVerified) {
      factors.push('Not verified on EAS');
    }

    if (trustInfo.paymentHistory.length === 0) {
      factors.push('No payment history');
    }

    const recentFailures = trustInfo.paymentHistory
      .slice(-10)
      .filter(p => !p.success).length;
    
    if (recentFailures > 3) {
      factors.push('Multiple recent payment failures');
    }

    return factors;
  }

  /**
   * 判定理由を生成
   */
  private generateReason(
    approved: boolean,
    requiresManualApproval: boolean,
    violations: string[]
  ): string {
    if (approved) {
      return 'Payment approved - all policy checks passed';
    }

    if (requiresManualApproval) {
      return 'Manual approval required due to policy settings';
    }

    if (violations.length > 0) {
      return `Payment rejected: ${violations.join(', ')}`;
    }

    return 'Payment status unclear';
  }

  /**
   * 現在の支出を計算
   */
  async getCurrentSpending(timeZone: string = 'Asia/Tokyo'): Promise<SpendingLimits> {
    // 実際の実装では、データベースから支出履歴を取得
    // 今回はモックデータを返す
    return {
      dailySpent: 0,
      weeklySpent: 0,
      monthlySpent: 0,
    };
  }

  /**
   * デフォルトポリシーを取得
   */
  static getDefaultPolicy(): PaymentPolicy {
    return {
      maxPerPayment: 100000, // 10万円
      maxPerDay: 500000,     // 50万円
      maxPerWeek: 2000000,   // 200万円
      maxPerMonth: 5000000,  // 500万円
      allowedHours: {
        start: 9,
        end: 18,
      },
      allowedWeekdays: [1, 2, 3, 4, 5], // 月-金
      trustedDomains: [
        'gmail.com', 'outlook.com', 'yahoo.com',
        'company.co.jp', 'corp.com'
      ],
      trustedVendors: [],
      blockedVendors: [],
      requireManualApproval: {
        amountThreshold: 200000, // 20万円以上
        unknownVendor: true,
        outsideBusinessHours: true,
      },
      retryPolicy: {
        maxRetries: 3,
        retryDelay: 30, // 30分
      },
    };
  }
} 