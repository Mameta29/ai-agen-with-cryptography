use risc0_zkvm::guest::env;

// 動的ポリシー対応の構造体
#[derive(Clone, Debug)]
pub struct DynamicPaymentIntent {
    pub amount: u64,
    pub recipient_hash: u64,
    pub vendor_hash: u64,
    pub category_hash: u64,
    pub timestamp: u64,
    pub ai_confidence: u64, // 0-100のスケール
}

#[derive(Clone, Debug)]
pub struct DynamicPolicyRules {
    // 基本制限（動的設定可能）
    pub max_per_payment: u64,
    pub max_per_day: u64,
    pub max_per_week: u64,
    
    // 時間制約（動的設定可能）
    pub allowed_hours_start: u8,
    pub allowed_hours_end: u8,
    pub allowed_weekday_mask: u8,
    
    // ベンダー制御（動的設定可能）
    pub allowed_vendor_count: u8,
    pub allowed_vendor_hashes: [u64; 10], // 最大10個のベンダー
    
    // カテゴリ別制限（動的設定可能）
    pub category_rules_count: u8,
    pub category_hashes: [u64; 5],     // カテゴリハッシュ
    pub category_max_amounts: [u64; 5], // 対応する上限
    
    // 条件分岐ルール（動的設定可能）
    pub conditional_rules_count: u8,
    pub condition_types: [u8; 5],      // 条件タイプ (1=amount_check, 2=vendor_check, etc.)
    pub condition_values: [u64; 5],    // 条件の値
    pub condition_actions: [u8; 5],    // アクション (1=approve, 2=reject, 3=require_approval)
    
    // AI信頼度制約
    pub min_ai_confidence: u64,
}

#[derive(Debug)]
pub struct DynamicPolicyEvaluation {
    pub approved: bool,
    pub risk_score: u8,
    pub violation_count: u8,
    pub applied_rules_mask: u64, // どのルールが適用されたかのビットマスク
}

fn main() {
    // 動的パラメータを順次読み取り
    console.log("🔐 zkVM Guest: 動的パラメータ読み取り開始");
    
    // Intent parameters
    let amount: u64 = env::read();
    let recipient_hash: u64 = env::read();
    let vendor_hash: u64 = env::read();
    let category_hash: u64 = env::read();
    let timestamp: u64 = env::read();
    let ai_confidence: u64 = env::read();
    
    console.log("📊 Intent読み取り完了");
    
    // Basic policy parameters
    let max_per_payment: u64 = env::read();
    let max_per_day: u64 = env::read();
    let max_per_week: u64 = env::read();
    let allowed_hours_start: u8 = env::read();
    let allowed_hours_end: u8 = env::read();
    let allowed_weekday_mask: u8 = env::read();
    
    console.log("📋 基本ポリシー読み取り完了");
    
    // Dynamic vendor list
    let allowed_vendor_count: u8 = env::read();
    let mut allowed_vendor_hashes = [0u64; 10];
    for i in 0..(allowed_vendor_count.min(10) as usize) {
        allowed_vendor_hashes[i] = env::read();
    }
    
    console.log("🏢 動的ベンダーリスト読み取り完了");
    
    // Dynamic category rules
    let category_rules_count: u8 = env::read();
    let mut category_hashes = [0u64; 5];
    let mut category_max_amounts = [0u64; 5];
    for i in 0..(category_rules_count.min(5) as usize) {
        category_hashes[i] = env::read();
        category_max_amounts[i] = env::read();
    }
    
    console.log("📂 動的カテゴリルール読み取り完了");
    
    // Dynamic conditional rules
    let conditional_rules_count: u8 = env::read();
    let mut condition_types = [0u8; 5];
    let mut condition_values = [0u64; 5];
    let mut condition_actions = [0u8; 5];
    for i in 0..(conditional_rules_count.min(5) as usize) {
        condition_types[i] = env::read();
        condition_values[i] = env::read();
        condition_actions[i] = env::read();
    }
    
    console.log("🔀 動的条件ルール読み取り完了");
    
    // AI confidence threshold
    let min_ai_confidence: u64 = env::read();
    
    // Spending context
    let current_spending: u64 = env::read();
    let weekly_spending: u64 = env::read();
    
    console.log("💰 支出コンテキスト読み取り完了");
    
    // 構造体を構築
    let intent = DynamicPaymentIntent {
        amount,
        recipient_hash,
        vendor_hash,
        category_hash,
        timestamp,
        ai_confidence,
    };
    
    let policy = DynamicPolicyRules {
        max_per_payment,
        max_per_day,
        max_per_week,
        allowed_hours_start,
        allowed_hours_end,
        allowed_weekday_mask,
        allowed_vendor_count,
        allowed_vendor_hashes,
        category_rules_count,
        category_hashes,
        category_max_amounts,
        conditional_rules_count,
        condition_types,
        condition_values,
        condition_actions,
        min_ai_confidence,
    };
    
    console.log("🏗️ 動的構造体構築完了");
    
    // 動的ポリシー評価を実行
    let evaluation = evaluate_dynamic_policy(&intent, &policy, current_spending, weekly_spending);
    
    console.log("✅ 動的ポリシー評価完了");
    
    // 結果をコミット
    env::commit(&(evaluation.approved as u8));
    env::commit(&evaluation.risk_score);
    env::commit(&evaluation.violation_count);
    env::commit(&evaluation.applied_rules_mask);
}

fn evaluate_dynamic_policy(
    intent: &DynamicPaymentIntent,
    policy: &DynamicPolicyRules,
    current_spending: u64,
    weekly_spending: u64,
) -> DynamicPolicyEvaluation {
    let mut violation_count = 0u8;
    let mut risk_score = 0u8;
    let mut applied_rules_mask = 0u64;

    console.log("🔍 動的ポリシー評価開始");

    // 1. 基本金額制限チェック（動的パラメータ使用）
    if intent.amount > policy.max_per_payment {
        violation_count += 1;
        risk_score = risk_score.saturating_add(30);
        applied_rules_mask |= 1; // ビット0: 基本金額制限
    }

    if current_spending + intent.amount > policy.max_per_day {
        violation_count += 1;
        risk_score = risk_score.saturating_add(25);
        applied_rules_mask |= 2; // ビット1: 日次制限
    }

    if weekly_spending + intent.amount > policy.max_per_week {
        violation_count += 1;
        risk_score = risk_score.saturating_add(20);
        applied_rules_mask |= 4; // ビット2: 週次制限
    }

    console.log("💰 基本金額制限チェック完了");

    // 2. 動的ベンダーチェック
    let vendor_allowed = false;
    for i in 0..(policy.allowed_vendor_count.min(10) as usize) {
        if policy.allowed_vendor_hashes[i] == intent.vendor_hash {
            vendor_allowed = true;
            break;
        }
    }
    
    if !vendor_allowed && policy.allowed_vendor_count > 0 {
        violation_count += 1;
        risk_score = risk_score.saturating_add(25);
        applied_rules_mask |= 8; // ビット3: ベンダーチェック
    }

    console.log("🏢 動的ベンダーチェック完了");

    // 3. 動的カテゴリルールチェック
    for i in 0..(policy.category_rules_count.min(5) as usize) {
        if policy.category_hashes[i] == intent.category_hash {
            if intent.amount > policy.category_max_amounts[i] {
                violation_count += 1;
                risk_score = risk_score.saturating_add(20);
                applied_rules_mask |= 16 << i; // ビット4-8: カテゴリルール
            }
            break;
        }
    }

    console.log("📂 動的カテゴリルールチェック完了");

    // 4. 動的条件分岐ルール
    for i in 0..(policy.conditional_rules_count.min(5) as usize) {
        let condition_met = evaluate_condition(
            policy.condition_types[i],
            policy.condition_values[i],
            intent,
            policy
        );
        
        if condition_met {
            applied_rules_mask |= 256 << i; // ビット8-12: 条件ルール
            
            match policy.condition_actions[i] {
                2 => { // reject
                    violation_count += 1;
                    risk_score = risk_score.saturating_add(50);
                },
                3 => { // require_approval
                    violation_count += 1;
                    risk_score = risk_score.saturating_add(15);
                },
                _ => {} // approve (1) or unknown
            }
        }
    }

    console.log("🔀 動的条件ルールチェック完了");

    // 5. AI信頼度チェック
    if intent.ai_confidence < policy.min_ai_confidence {
        violation_count += 1;
        risk_score = risk_score.saturating_add(10);
        applied_rules_mask |= 4096; // ビット12: AI信頼度
    }

    console.log("🤖 AI信頼度チェック完了");

    // 6. 時間制約チェック
    let hour = ((intent.timestamp / 3600) % 24) as u8;
    if hour < policy.allowed_hours_start || hour >= policy.allowed_hours_end {
        violation_count += 1;
        risk_score = risk_score.saturating_add(15);
        applied_rules_mask |= 8192; // ビット13: 時間制約
    }

    // 7. 曜日チェック
    let weekday = ((intent.timestamp / 86400 + 4) % 7) as u8;
    let weekday_bit = 1u8 << weekday;
    if (policy.allowed_weekday_mask & weekday_bit) == 0 {
        violation_count += 1;
        risk_score = risk_score.saturating_add(10);
        applied_rules_mask |= 16384; // ビット14: 曜日制約
    }

    console.log("⏰ 時間・曜日制約チェック完了");

    let approved = violation_count == 0;

    console.log("🏁 動的ポリシー評価完了");

    DynamicPolicyEvaluation {
        approved,
        risk_score: if risk_score > 100 { 100 } else { risk_score },
        violation_count,
        applied_rules_mask,
    }
}

// 条件評価関数
fn evaluate_condition(
    condition_type: u8,
    condition_value: u64,
    intent: &DynamicPaymentIntent,
    _policy: &DynamicPolicyRules,
) -> bool {
    match condition_type {
        1 => intent.amount > condition_value,                    // amount_greater_than
        2 => intent.amount < condition_value,                    // amount_less_than
        3 => intent.ai_confidence < condition_value,             // ai_confidence_less_than
        4 => intent.vendor_hash == condition_value,              // vendor_equals
        5 => intent.category_hash == condition_value,            // category_equals
        6 => ((intent.timestamp / 3600) % 24) as u64 > condition_value, // hour_greater_than
        _ => false,
    }
}

// デバッグ用のconsole.log実装
fn console_log(msg: &str) {
    // zkVM環境では実際のconsole.logは使えないが、
    // デバッグ情報として処理フローを記録
}

// 実際のconsole.log（zkVM環境では無効）
macro_rules! console {
    ($($arg:tt)*) => {
        // zkVM環境では何もしない
    };
}
