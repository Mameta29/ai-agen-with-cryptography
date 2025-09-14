use risc0_zkvm::guest::env;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PaymentIntent {
    pub amount: u64,
    pub recipient: String,
    pub timestamp: u64,
    pub vendor: String,
    pub category: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PolicyRules {
    pub max_per_payment: u64,
    pub max_per_day: u64,
    pub max_per_week: u64,
    pub allowed_vendors: Vec<String>,
    pub allowed_hours_start: u8,
    pub allowed_hours_end: u8,
    pub allowed_weekdays: Vec<u8>, // 0=Sunday, 1=Monday, etc.
    pub blocked_keywords: Vec<String>,
    pub custom_rules: HashMap<String, serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PolicyEvaluation {
    pub approved: bool,
    pub reason: String,
    pub risk_score: u8,
    pub violations: Vec<String>,
    pub policy_hash: [u8; 32],
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ZkVMInput {
    pub intent: PaymentIntent,
    pub policy: PolicyRules,
    pub current_spending: u64, // Today's spending so far
    pub weekly_spending: u64,  // This week's spending
}

fn main() {
    // Read input from the host
    let input: ZkVMInput = env::read();
    
    // Evaluate the payment intent against the policy
    let evaluation = evaluate_payment_policy(&input.intent, &input.policy, input.current_spending, input.weekly_spending);
    
    // Commit the evaluation result to the journal
    env::commit(&evaluation);
}

fn evaluate_payment_policy(
    intent: &PaymentIntent,
    policy: &PolicyRules,
    current_spending: u64,
    weekly_spending: u64,
) -> PolicyEvaluation {
    let mut violations = Vec::new();
    let mut risk_score = 0u8;

    // 1. Amount limits check
    if intent.amount > policy.max_per_payment {
        violations.push(format!("Amount {} exceeds per-payment limit {}", intent.amount, policy.max_per_payment));
        risk_score = risk_score.saturating_add(30);
    }

    if current_spending + intent.amount > policy.max_per_day {
        violations.push("Daily spending limit would be exceeded".to_string());
        risk_score = risk_score.saturating_add(25);
    }

    if weekly_spending + intent.amount > policy.max_per_week {
        violations.push("Weekly spending limit would be exceeded".to_string());
        risk_score = risk_score.saturating_add(20);
    }

    // 2. Vendor whitelist check
    if !policy.allowed_vendors.is_empty() && !policy.allowed_vendors.contains(&intent.vendor) {
        violations.push(format!("Vendor '{}' not in allowed list", intent.vendor));
        risk_score = risk_score.saturating_add(25);
    }

    // 3. Time constraints check
    let hour = ((intent.timestamp / 3600) % 24) as u8; // Extract hour from timestamp
    if hour < policy.allowed_hours_start || hour >= policy.allowed_hours_end {
        violations.push(format!("Payment time {}:00 outside allowed hours {}:00-{}:00", 
            hour, policy.allowed_hours_start, policy.allowed_hours_end));
        risk_score = risk_score.saturating_add(15);
    }

    // 4. Weekday check
    if !policy.allowed_weekdays.is_empty() {
        let weekday = ((intent.timestamp / 86400 + 4) % 7) as u8; // Thursday = 0, Friday = 1, etc.
        if !policy.allowed_weekdays.contains(&weekday) {
            violations.push(format!("Payment on weekday {} not allowed", weekday));
            risk_score = risk_score.saturating_add(10);
        }
    }

    // 5. Blocked keywords check
    for keyword in &policy.blocked_keywords {
        if intent.vendor.to_lowercase().contains(&keyword.to_lowercase()) ||
           intent.category.to_lowercase().contains(&keyword.to_lowercase()) {
            violations.push(format!("Blocked keyword '{}' found", keyword));
            risk_score = risk_score.saturating_add(20);
        }
    }

    // 6. Custom rules evaluation (simplified)
    if let Some(custom_limit) = policy.custom_rules.get(&intent.category) {
        if let Some(limit) = custom_limit.as_u64() {
            if intent.amount > limit {
                violations.push(format!("Category '{}' limit {} exceeded", intent.category, limit));
                risk_score = risk_score.saturating_add(15);
            }
        }
    }

    // Generate policy hash for verification
    let policy_hash = generate_policy_hash(policy);

    let approved = violations.is_empty();
    let reason = if approved {
        "All policy checks passed".to_string()
    } else {
        format!("Policy violations: {}", violations.join(", "))
    };

    PolicyEvaluation {
        approved,
        reason,
        risk_score: std::cmp::min(risk_score, 100),
        violations,
        policy_hash,
    }
}

fn generate_policy_hash(policy: &PolicyRules) -> [u8; 32] {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    
    // Hash all policy fields in a deterministic order
    policy.max_per_payment.hash(&mut hasher);
    policy.max_per_day.hash(&mut hasher);
    policy.max_per_week.hash(&mut hasher);
    policy.allowed_vendors.hash(&mut hasher);
    policy.allowed_hours_start.hash(&mut hasher);
    policy.allowed_hours_end.hash(&mut hasher);
    policy.allowed_weekdays.hash(&mut hasher);
    policy.blocked_keywords.hash(&mut hasher);
    
    let hash_result = hasher.finish();
    let mut hash_bytes = [0u8; 32];
    hash_bytes[..8].copy_from_slice(&hash_result.to_le_bytes());
    
    hash_bytes
}
