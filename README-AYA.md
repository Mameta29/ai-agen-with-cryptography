# 🚀 AI Gmail Automation with ZKP - Aya Integration

**Ayaウォレット用MCPツール：AIエージェントが暗号学的に安全にGmail自動化・ブロックチェーン支払いを実行**

## 🎯 プロジェクト概要

このプロジェクトは、**AI + ゼロ知識証明（ZKP）+ ブロックチェーン**を組み合わせた革新的な自動化システムです。Ayaウォレットのエージェントが、事前に設定されたルールを**暗号学的に保証**しながら、Gmail処理とJPYC支払いを完全自動で実行できます。

### 🔥 核心的価値提案
- **🤖 AI判断**: GPT-5-nanoがメール内容を解析（請求書 vs 会議依頼）
- **🔐 ZKP制御**: ルール遵守を数学的に証明（秘密情報を開示せずに）
- **⚡ 完全自動化**: 人間の介入なしで24時間安全稼働
- **🛡️ 暗号学的保証**: ルール違反は物理的に不可能

## 🛠️ MCPツール一覧

### 1. `process_gmail_emails`
Gmail受信箱を自動処理し、AI分析→ZKP検証→ブロックチェーン実行を行う

**機能:**
- メール分類（請求書/会議依頼/その他）
- 添付PDF解析
- ZKP証明生成・検証
- JPYC自動送金
- Googleカレンダー連携

### 2. `send_zkp_payment`
ZKP証明付きでJPYC支払いを実行（ルール遵守を暗号学的に保証）

**保証内容:**
- 送金先がホワイトリストに含まれる
- 金額が上限以下
- 実行時間が許可時間内

### 3. `schedule_meeting_with_zkp`
ZKP証明付きでGoogleカレンダーに予定を追加（スケジュールルール遵守を保証）

**保証内容:**
- 営業時間内（9:00-18:00）
- 平日のみ
- 会議時間が3時間以下
- 機密キーワードを含まない

### 4. `get_zkp_rules`
現在のZKPルール設定を取得（支払い・スケジュール制限）

## 🔐 ZKP（ゼロ知識証明）の仕組み

### 証明システム: Groth16
- **回路**: Circom言語で記述
- **証明生成**: snarkjs
- **検証**: 数秒で完了

### 支払いルール証明
```circom
// payment_rules.circom
template PaymentRules() {
    // 入力: 支払い先、金額、時刻
    // 制約: ホワイトリスト、上限額、時間制限
    // 出力: ルール遵守の証明
}
```

### スケジュールルール証明
```circom
// schedule_rules.circom  
template ScheduleRules() {
    // 入力: 開始時刻、終了時刻、曜日
    // 制約: 営業時間、平日のみ、最大時間
    // 出力: ルール遵守の証明
}
```

## 🚀 Ayaウォレット統合方法

### 1. MCPサーバー起動
```bash
npm run mcp-server
```

### 2. Aya設定ファイル
```json
{
  "mcpServers": {
    "aya-gmail-automation": {
      "command": "node",
      "args": ["mcp-server.js"],
      "env": {
        "GOOGLE_CLIENT_ID": "your_client_id",
        "OPENAI_API_KEY": "your_openai_key",
        "PRIVATE_KEY": "your_private_key",
        "JPYC_CONTRACT_ADDRESS": "0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB"
      }
    }
  }
}
```

### 3. エージェント使用例
```
ユーザー: "新しいメールをチェックして、請求書があれば自動で支払って"

Ayaエージェント: process_gmail_emails を実行
→ AI分析: "5万円の電気代請求書を発見"
→ ZKP証明: "ルール遵守を暗号学的に証明"
→ JPYC送金: "Sepolia testnetで実行完了"
→ 結果: "✅ ZKP検証済み支払い完了"
```

## 🎪 デモシナリオ

### シナリオ1: 請求書自動支払い
1. **メール受信**: "電気代5万円の請求書"
2. **AI解析**: GPT-5-nanoが内容を理解
3. **ZKP証明**: ルール遵守を暗号学的に証明
4. **自動送金**: JPYCでSepolia testnetに送金
5. **完了通知**: "ZKP検証済み支払い完了"

### シナリオ2: 会議予定自動登録
1. **メール受信**: "来週火曜14時から会議"
2. **AI解析**: スケジュール情報を抽出
3. **ZKP証明**: 営業時間内・平日・3時間以下を証明
4. **カレンダー登録**: Googleカレンダーに自動追加
5. **完了通知**: "ZKP検証済み予定作成完了"

## 🏆 技術的優位性

### 1. **信頼できるAI自動化**
従来のAI自動化の「暴走リスク」を、ZKPで数学的に解決

### 2. **プライバシー保護**
ZKPにより、ルール遵守を証明しながら秘密情報は開示しない

### 3. **リアルタイム処理**
Gmail API → AI解析 → ZKP証明 → ブロックチェーン実行が30秒以内

### 4. **拡張性**
新しいルールやブロックチェーンへの対応が容易

## 🌟 Ayaエコシステムへの貢献

### ユーザーメリット
- **完全自動化**: 24時間安全稼働
- **暗号学的保証**: ルール違反は不可能
- **プライバシー保護**: 秘密情報は開示されない
- **リアルタイム実行**: 即座に処理完了

### 開発者メリット
- **オープンソース**: 自由にカスタマイズ可能
- **モジュラー設計**: 新機能の追加が容易
- **豊富なドキュメント**: 実装詳細を完全公開

## 🔧 セットアップ

### 必要な環境変数
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
OPENAI_API_KEY=your_openai_api_key
PRIVATE_KEY=your_ethereum_private_key
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_key
JPYC_CONTRACT_ADDRESS=0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB
```

### インストール
```bash
npm install
npm run build-mcp
npm run mcp-server
```

## 📊 実績・検証済み機能

- ✅ GPT-5-nano統合
- ✅ Groth16 ZKP証明生成・検証
- ✅ JPYC自動送金（Sepolia testnet）
- ✅ Gmail API統合
- ✅ Google Calendar API統合
- ✅ PDF請求書解析
- ✅ リアルタイム処理（30秒以内）

## 🎯 今後の展開

### Phase 1: Ayaウォレット統合
- MCPサーバーの最適化
- エラーハンドリング強化
- パフォーマンス向上

### Phase 2: 機能拡張
- 複数ブロックチェーン対応
- より複雑なZKPルール
- 機械学習による精度向上

### Phase 3: エコシステム拡大
- 他のDeFiプロトコル統合
- 企業向けカスタマイズ
- 監査・コンプライアンス機能

---

**🚀 Ayaウォレットで、次世代のAI自動化を体験してください！**

**🔐 暗号学的に保証された、完全に信頼できるAIエージェントの時代が始まります。** 