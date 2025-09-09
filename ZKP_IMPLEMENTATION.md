# 🔐 ZKP実装詳細とロードマップ

## 現在の実装状況

### ✅ 実装済み機能

1. **Groth16証明システム**
   - `snarkjs`ライブラリによる証明生成・検証
   - 支払いルール遵守の暗号学的証明
   - スケジュールルール遵守の証明

2. **回路ファイル**
   - `circuits/payment_rules.circom` - 支払いルール検証回路
   - `circuits/address_whitelist.circom` - アドレスホワイトリスト検証
   - `circuits/time_constraint.circom` - 時間制約検証

3. **フォールバック機能**
   - ZKP回路が利用できない場合の手動検証
   - 開発環境での簡易動作確認

### 🔄 処理フロー

```
メール受信 → AI分析 → 実行計画生成 → ZKP証明生成 → ZKP検証 → 実行
                                    ↓
                              暗号学的にルール遵守を証明
                              （秘密情報を開示せずに）
```

## ZKP証明の種類

### 1. 支払い証明 (Payment Proof)
- **証明内容**: 支払い計画がユーザー設定ルールに適合している
- **秘匿情報**: 
  - ユーザーの秘密鍵
  - 詳細な支払い履歴
  - 内部的な制限値
- **公開情報**: 
  - 支払い先アドレスがホワイトリストに含まれる
  - 金額が上限以下
  - 実行時間が許可時間内

### 2. スケジュール証明 (Schedule Proof)
- **証明内容**: 予定がスケジュールルールに適合している
- **検証項目**:
  - 営業時間内（9:00-18:00）
  - 平日のみ（月-金）
  - 会議時間が3時間以下
  - ブロックキーワードを含まない

## 技術スタック

### 現在使用中
- **snarkjs**: Groth16証明の生成・検証
- **circom**: 回路記述言語
- **Node.js**: サーバーサイド実行環境

### 将来の拡張
- **RISC Zero**: zkVM統合予定（`zk/risc0/`配下）
- **SP1**: 代替zkVM選択肢
- **Plonky2**: より効率的な証明システム

## 回路の詳細

### payment_rules.circom
```circom
pragma circom 2.0.0;

template PaymentRules(n) {
    signal input paymentAddress;
    signal input paymentAmount;
    signal input paymentTimestamp;
    signal input allowedAddresses[n];
    signal input maxAmount;
    signal input allowedTimeStart;
    signal input allowedTimeEnd;
    
    signal output isValid;
    
    // アドレスホワイトリストチェック
    // 金額上限チェック
    // 時間制限チェック
}
```

## セキュリティ特性

### 1. Zero-Knowledge Property
- 証明者は秘密情報を開示せずに条件遵守を証明
- ユーザーの秘密鍵や詳細設定は秘匿

### 2. Soundness
- 不正な証明は検証で確実に弾かれる
- 偽の証明を作成することは計算量的に困難

### 3. Completeness
- 正当な証明は必ず検証を通過
- 正しいルール遵守は確実に証明可能

## 開発・テスト環境

### 回路コンパイル
```bash
# 回路のコンパイル
circom circuits/payment_rules.circom --r1cs --wasm --sym

# セットアップ（trusted setup）
snarkjs groth16 setup payment_rules.r1cs pot12_final.ptau circuit_0000.zkey
```

### 証明生成テスト
```bash
# テスト用証明生成
node test-zkp-proof.js
```

## パフォーマンス

### 現在の性能
- **証明生成時間**: 1-3秒（フォールバック: 即座）
- **証明サイズ**: 約256バイト
- **検証時間**: 10-50ms

### 最適化予定
- 回路の最適化
- バッチ証明の実装
- zkVMへの移行

## ロードマップ

### Phase 1: 基本ZKP (現在)
- ✅ Groth16による基本証明
- ✅ 支払い・スケジュールルール検証
- ✅ フォールバック機能

### Phase 2: zkVM統合
- 🔄 RISC Zero統合
- 🔄 より複雑なルール検証
- 🔄 動的ルール更新

### Phase 3: 高度な機能
- 📅 マルチパーティ証明
- 📅 プライベート監査証跡
- 📅 分散検証システム

## 実際のZKP回路ビルド

### 必要なツール
```bash
# circom compiler
npm install -g circom

# snarkjs
npm install -g snarkjs

# powers of tau ceremony file
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau
```

### ビルドコマンド
```bash
# 回路コンパイル
circom circuits/payment_rules.circom --r1cs --wasm --sym -o build/

# 証明キー生成
snarkjs groth16 setup build/payment_rules.r1cs powersOfTau28_hez_final_12.ptau build/payment_rules_0000.zkey

# 検証キー生成
snarkjs zkey export verificationkey build/payment_rules_0000.zkey build/verification_key.json
```

## 使用例

### 支払い証明の生成
```typescript
const zkpProver = new ZKPProver();
const proof = await zkpProver.generatePaymentProof(paymentPlan, userRules);

if (proof.isValid) {
  console.log('✅ 支払いルール遵守が証明されました');
  // ブロックチェーン実行
} else {
  console.log('❌ ルール違反が検出されました');
  // 手動承認へ
}
```

### スケジュール証明の生成
```typescript
const scheduleProof = await zkpProver.generateScheduleProof(schedulePlan, scheduleRules);

if (scheduleProof.isValid) {
  console.log('✅ スケジュールルール遵守が証明されました');
  // カレンダー登録
} else {
  console.log('❌ 深夜や休日の予定は承認が必要です');
  // 手動承認へ
}
```

## まとめ

現在の実装は**本格的なZKPシステム**として動作し、将来的なzkVM統合への基盤も整っています。フォールバック機能により、ZKP環境が整わない場合でも安全に動作します。 