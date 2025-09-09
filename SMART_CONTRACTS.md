# 🏗️ スマートコントラクトとEAS統合

## 📋 概要

このプロジェクトでは、ZKP証明をオンチェーンで記録・検証するために以下のスマートコントラクトとEASを使用します。

## 🔗 EAS（Ethereum Attestation Service）

### 設定済みコントラクト
- **EAS Contract**: `0xC2679fBD37d54388Ce493F1DB75320D236e1815e` (Sepolia)
- **Schema Registry**: `0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0` (Sepolia)

### 使用目的
1. **支払い証明の記録**: ZKP検証済み支払いの証明をオンチェーンに記録
2. **スケジュール証明の記録**: ZKP検証済みスケジュール登録の証明を記録
3. **監査証跡**: 全ての自動化実行の透明性を確保

## 📊 EASスキーマ

### 支払い証明スキーマ
```solidity
string invoiceNumber,
uint256 paymentAmount,
address recipientAddress,
bytes32 zkpProofHash,
uint256 timestamp,
bool isVerified
```

### スケジュール証明スキーマ
```solidity
string eventTitle,
uint256 startTime,
uint256 endTime,
bytes32 zkpProofHash,
uint256 timestamp,
bool isVerified
```

## 🚀 デプロイ予定のスマートコントラクト

### 1. PolicyRegistry
```solidity
// ユーザーの支払いルールとスケジュールルールを管理
contract PolicyRegistry {
    struct PaymentPolicy {
        uint256 maxAmount;
        uint256 maxDailyAmount;
        address[] allowedAddresses;
        uint256 allowedTimeStart;
        uint256 allowedTimeEnd;
    }
    
    struct SchedulePolicy {
        uint256 allowedTimeStart;
        uint256 allowedTimeEnd;
        uint8[] allowedDaysOfWeek;
        uint256 maxMeetingDuration;
        string[] blockedKeywords;
    }
    
    mapping(address => PaymentPolicy) public paymentPolicies;
    mapping(address => SchedulePolicy) public schedulePolicies;
    
    function setPaymentPolicy(PaymentPolicy memory policy) external;
    function setSchedulePolicy(SchedulePolicy memory policy) external;
}
```

### 2. ProofVerifier
```solidity
// ZKP証明をオンチェーンで検証
contract ProofVerifier {
    using Groth16Verifier for *;
    
    struct ProofData {
        uint[2] _pA;
        uint[2][2] _pB;
        uint[2] _pC;
        uint[] _pubSignals;
    }
    
    function verifyPaymentProof(
        ProofData memory proof,
        address user
    ) external view returns (bool);
    
    function verifyScheduleProof(
        ProofData memory proof,
        address user
    ) external view returns (bool);
}
```

### 3. IntentPayExecutor
```solidity
// 検証済みの支払い意図を実行
contract IntentPayExecutor {
    event PaymentExecuted(
        address indexed user,
        address indexed recipient,
        uint256 amount,
        bytes32 proofHash,
        bytes32 attestationUID
    );
    
    function executePayment(
        address recipient,
        uint256 amount,
        bytes32 proofHash,
        ProofData memory zkpProof
    ) external;
}
```

### 4. VerifyingPaymaster
```solidity
// EIP-4337 Account Abstraction対応
contract VerifyingPaymaster is BasePaymaster {
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external override returns (bytes memory context, uint256 validationData);
    
    // ZKP証明が有効な場合のみガス代を支払い
}
```

## 🔄 統合フロー

### 支払い処理フロー
```
1. Gmail受信 → AI分析 → 支払い計画生成
2. ZKP証明生成 (ローカル)
3. ZKP証明検証 (ローカル)
4. ブロックチェーン支払い実行
5. EASアテステーション記録
6. 監査証跡の永続化
```

### スケジュール処理フロー
```
1. Gmail受信 → AI分析 → スケジュール計画生成
2. ZKP証明生成 (ローカル)
3. ZKP証明検証 (ローカル)
4. Google Calendar登録
5. EASアテステーション記録
6. 監査証跡の永続化
```

## 📝 現在の実装状況

### ✅ 実装済み
- EAS統合サービス（簡易版）
- ZKP証明生成・検証
- ローカルアテステーション記録
- 健全性チェック

### 🔄 実装予定
- 実際のEASスキーマ作成
- オンチェーンアテステーション
- スマートコントラクトデプロイ
- Account Abstraction統合

## 🛠️ セットアップ手順

### 1. EASスキーマ作成

```bash
# 必要なツールをインストール
npm install -g @ethereum-attestation-service/eas-cli

# スキーマを作成
eas schema create --schema "string invoiceNumber,uint256 paymentAmount,address recipientAddress,bytes32 zkpProofHash,uint256 timestamp,bool isVerified" --resolver 0x0000000000000000000000000000000000000000 --revocable true
```

### 2. 環境変数設定

```env
# EAS関連
EAS_CONTRACT_ADDRESS=0xC2679fBD37d54388Ce493F1DB75320D236e1815e
EAS_SCHEMA_REGISTRY_ADDRESS=0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0
EAS_PAYMENT_SCHEMA_UID=your_payment_schema_uid
EAS_SCHEDULE_SCHEMA_UID=your_schedule_schema_uid

# スマートコントラクト（デプロイ後）
POLICY_REGISTRY_ADDRESS=your_deployed_address
PROOF_VERIFIER_ADDRESS=your_deployed_address
INTENT_PAY_EXECUTOR_ADDRESS=your_deployed_address
VERIFYING_PAYMASTER_ADDRESS=your_deployed_address
```

### 3. スマートコントラクトデプロイ

```bash
# Foundryを使用
forge create PolicyRegistry --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY

# または Hardhatを使用
npx hardhat deploy --network sepolia
```

## 🔍 監査と透明性

### オンチェーン記録
- 全ての支払い実行がEASに記録
- ZKP証明ハッシュの永続化
- タイムスタンプ付き監査証跡

### 検証可能性
- 任意の第三者が実行履歴を検証可能
- ZKP証明の妥当性を確認可能
- ルール遵守の暗号学的証明

## 🚀 将来の拡張

### Phase 1: 基本EAS統合 (現在)
- ✅ 簡易EASサービス
- ✅ ローカルアテステーション
- 🔄 実際のスキーマ作成

### Phase 2: フルオンチェーン統合
- 📅 スマートコントラクトデプロイ
- 📅 オンチェーン証明検証
- 📅 Account Abstraction統合

### Phase 3: 高度な機能
- 📅 マルチシグ承認
- 📅 ガバナンス統合
- 📅 クロスチェーン対応

## 💡 使用例

### 支払いアテステーションの確認
```typescript
const attestationUID = '0x1234...';
const attestation = await easService.getAttestation(attestationUID);
console.log('支払い証明:', attestation);
```

### スキーマ情報の取得
```typescript
const config = easService.getConfig();
console.log('EAS設定:', config);
```

このEAS統合により、AI自動化の全ての実行が透明性を持ち、暗号学的に証明可能な形でオンチェーンに記録されます。 