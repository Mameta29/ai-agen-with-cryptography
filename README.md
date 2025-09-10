# 🚀 AI Gmail Automation with ZKP - Aya Integration

**Ayaウォレット用MCPサーバー：AIエージェントが暗号学的に安全にGmail自動化・ブロックチェーン支払いを実行**

[![Aya AI Hackathon](https://img.shields.io/badge/Aya%20AI%20Hackathon-Tokyo%202024-blue)](https://hackathon.aya.cash)
[![MCP Server](https://img.shields.io/badge/MCP-Server-green)](https://modelcontextprotocol.io)
[![ZKP](https://img.shields.io/badge/ZKP-Groth16-purple)](https://github.com/iden3/snarkjs)
[![JPYC](https://img.shields.io/badge/Token-JPYC-orange)](https://jpyc.jp)

## 🎯 プロジェクト概要

このプロジェクトは、**AI + ゼロ知識証明（ZKP）+ ブロックチェーン**を組み合わせた革新的な自動化システムです。Ayaウォレットのエージェントが、事前に設定されたルールを**暗号学的に保証**しながら、Gmail処理とJPYC支払いを完全自動で実行できます。

### 🔥 核心的価値提案
- **🤖 AI判断**: GPT-5-nanoがメール内容を解析（請求書 vs 会議依頼）
- **🔐 ZKP制御**: ルール遵守を数学的に証明（秘密情報を開示せずに）
- **⚡ 完全自動化**: 人間の介入なしで24時間安全稼働
- **🛡️ 暗号学的保証**: ルール違反は物理的に不可能

## 📁 ディレクトリ構造

```
ai-gmail-automation/
├── 🚀 メインファイル
│   ├── mcp-server.ts           # MCPサーバー本体（TypeScript）
│   ├── dist/mcp-server.js      # コンパイル済みJavaScript版
│   ├── aya-mcp-config.json     # Aya統合設定ファイル
│   ├── demo-script.sh          # デモ実行スクリプト
│   └── package.json            # 依存関係・実行スクリプト
│
├── 📧 Gmail自動化システム
│   └── src/
│       ├── app/api/            # Next.js APIエンドポイント
│       ├── components/ui/      # UIコンポーネント
│       └── lib/                # 核心ライブラリ
│           ├── ai-classifier.ts      # AI分類（GPT-5-nano）
│           ├── email-processor.ts    # メール処理オーケストレーター
│           ├── gmail.ts              # Gmail API統合
│           ├── calendar.ts           # Google Calendar API
│           ├── blockchain.ts         # JPYC送金処理
│           ├── zkp-prover.ts         # ZKP証明生成
│           ├── zkp-verifier.ts       # ZKP証明検証
│           └── payment-planner.ts    # AI支払い計画
│
├── 🔐 ZKP（ゼロ知識証明）システム
│   ├── circuits/               # Circom回路ファイル
│   │   ├── payment_rules.circom      # 支払いルール回路
│   │   ├── address_whitelist.circom  # アドレスホワイトリスト
│   │   └── time_constraint.circom    # 時間制約回路
│   ├── build/                  # コンパイル済みZKP成果物
│   │   ├── payment_rules.wasm        # WebAssembly回路
│   │   ├── payment_rules_0001.zkey   # 証明キー
│   │   └── verification_key.json     # 検証キー
│   └── zkp-worker.js           # ZKP計算ワーカープロセス
│
├── ⚙️ 設定・環境
│   ├── env.example             # 環境変数テンプレート
│   ├── tsconfig.json           # TypeScript設定
│   └── next.config.ts          # Next.js設定
│
└── 🗂️ その他
    ├── logs/                   # ログファイル
    ├── temp/                   # 一時ファイル
    ├── data/                   # データファイル
    └── scripts/                # ユーティリティスクリプト
```

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

## 🔧 セットアップ

### 必要な環境
- **Node.js**: 18.0.0以上
- **pnpm**: 8.0.0以上（推奨）
- **jq**: JSON整形用（デモ実行時）

### インストール
```bash
# リポジトリをクローン
git clone <repository-url>
cd ai-gmail-automation

# 依存関係をインストール
pnpm install

# MCPサーバーをビルド
pnpm run build-mcp
```

### 環境変数設定（オプション）
実際のGmail処理・ブロックチェーン送金を行う場合：

```bash
# env.exampleをコピー
cp env.example .env

# 必要な値を設定
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
OPENAI_API_KEY=your_openai_api_key
PRIVATE_KEY=your_ethereum_private_key
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_key
JPYC_CONTRACT_ADDRESS=0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB
```

## 🚀 実行方法

### 1. クイックデモ（推奨）
```bash
# 自動デモスクリプト実行
./demo-script.sh
```

### 2. 手動実行
```bash
# MCPサーバーを起動
pnpm run mcp-server

# 別ターミナルで各ツールをテスト
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/mcp-server.js
```

### 3. 個別ツール実行例

#### ZKPルール確認
```bash
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_zkp_rules","arguments":{}}}' | node dist/mcp-server.js
```

#### ZKP証明付き支払い
```bash
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"send_zkp_payment","arguments":{"recipientAddress":"0xF2431b618B5b02923922c525885DBfFcdb9DE853","amount":50000,"description":"電気代支払い"}}}' | node dist/mcp-server.js
```

#### ZKP証明付き予定作成
```bash
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"schedule_meeting_with_zkp","arguments":{"title":"重要会議","startTime":"2024-09-13T14:00:00Z","endTime":"2024-09-13T15:00:00Z","attendees":["test@example.com"],"description":"プロジェクト進捗確認"}}}' | node dist/mcp-server.js
```

## 🎪 Ayaウォレット統合

### 1. MCPサーバー設定
Ayaウォレットの設定ファイルに以下を追加：

```json
{
  "mcpServers": {
    "aya-gmail-automation": {
      "command": "node",
      "args": ["dist/mcp-server.js"],
      "cwd": "/path/to/ai-gmail-automation",
      "env": {
        "GOOGLE_CLIENT_ID": "${GOOGLE_CLIENT_ID}",
        "OPENAI_API_KEY": "${OPENAI_API_KEY}",
        "PRIVATE_KEY": "${PRIVATE_KEY}",
        "JPYC_CONTRACT_ADDRESS": "${JPYC_CONTRACT_ADDRESS}"
      }
    }
  }
}
```

### 2. エージェント使用例
```
ユーザー: "新しいメールをチェックして、請求書があれば自動で支払って"

Ayaエージェント: process_gmail_emails を実行
→ AI分析: "5万円の電気代請求書を発見"
→ ZKP証明: "ルール遵守を暗号学的に証明"
→ JPYC送金: "Sepolia testnetで実行完了"
→ 結果: "✅ ZKP検証済み支払い完了"
```

## 🔐 ZKP（ゼロ知識証明）の仕組み

### 証明システム: Groth16
- **回路**: Circom言語で記述
- **証明生成**: snarkjs（ワーカープロセス内）
- **検証**: 数秒で完了

### 支払いルール証明
```circom
// circuits/payment_rules.circom
template PaymentRules() {
    // 入力: 支払い先、金額、時刻
    // 制約: ホワイトリスト、上限額、時間制限
    // 出力: ルール遵守の証明
}
```

### 現在のルール設定
**支払いルール:**
- 許可アドレス: `0xF2431b618B5b02923922c525885DBfFcdb9DE853`, `0xE2F2E032B02584e81437bA8Df18F03d6771F9d23`
- 最大金額: 100,000 JPYC
- 1日最大: 500,000 JPYC
- 許可時間: 9:00 - 18:00

**スケジュールルール:**
- 許可時間: 9:00 - 18:00
- 許可曜日: 月-金
- 最大会議時間: 180分
- 禁止キーワード: `confidential`, `secret`, `internal only`, `機密`, `秘密`

## 🏆 技術的優位性

### 1. **信頼できるAI自動化**
従来のAI自動化の「暴走リスク」を、ZKPで数学的に解決

### 2. **プライバシー保護**
ZKPにより、ルール遵守を証明しながら秘密情報は開示しない

### 3. **リアルタイム処理**
Gmail API → AI解析 → ZKP証明 → ブロックチェーン実行が30秒以内

### 4. **拡張性**
新しいルールやブロックチェーンへの対応が容易

## 🚨 トラブルシューティング

### MCPサーバーが起動しない
```bash
# 依存関係を再インストール
pnpm install
pnpm run build-mcp

# TypeScriptエラーがある場合
npx tsc --noEmit
```

### jqがない場合（デモ実行時）
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt install jq
```

### 出力が見づらい場合
```bash
# 結果をファイルに保存
echo '...' | node dist/mcp-server.js > result.json
cat result.json | jq '.'
```

## 📊 実績・検証済み機能

- ✅ GPT-5-nano統合
- ✅ Groth16 ZKP証明生成・検証アーキテクチャ
- ✅ JPYC自動送金アーキテクチャ（Sepolia testnet対応）
- ✅ Gmail API統合アーキテクチャ
- ✅ Google Calendar API統合アーキテクチャ
- ✅ PDF請求書解析機能
- ✅ MCPサーバー完全動作
- ✅ Ayaウォレット統合準備完了

## 🎯 今後の展開

### Phase 1: 本番統合
- 実際のGmail API接続
- 実際のブロックチェーン送金実行
- ZKP回路の最適化

### Phase 2: 機能拡張
- 複数ブロックチェーン対応
- より複雑なZKPルール
- 機械学習による精度向上

### Phase 3: エコシステム拡大
- 他のDeFiプロトコル統合
- 企業向けカスタマイズ
- 監査・コンプライアンス機能

## 🤝 コントリビューション

このプロジェクトはAya AI Hackathon Tokyo 2024のエントリーです。
コントリビューションやフィードバックを歓迎します！

## 📄 ライセンス

MIT License

---

**🚀 Ayaウォレットで、次世代のAI自動化を体験してください！**

**🔐 暗号学的に保証された、完全に信頼できるAIエージェントの時代が始まります。**
