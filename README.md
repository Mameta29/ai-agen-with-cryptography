# AI Gmail Automation

Gmail新着メールを自動処理し、予定登録と支払い処理を行うNext.jsアプリケーション

## 🚀 機能

- **📧 Gmail統合**: 新着メール自動取得・分類
- **🤖 AI分類**: OpenAI GPT-4oによるメール内容の自動分析
- **📅 予定管理**: Google Calendar自動登録・重複検知
- **💳 支払い処理**: JPYC自動支払い・ポリシー評価
- **🔒 セキュリティ**: DKIM/SPF検証・フィッシング検知
- **⛓️ ブロックチェーン**: Ethereum Sepolia対応

## 🏗️ アーキテクチャ

```
Gmail新着受信 → AI分類 → 予定/支払い処理 → 結果通知
     ↓              ↓           ↓           ↓
  Push/Poll    OpenAI API   Calendar/JPYC   Labels/Reply
```

### 処理フロー

1. **Gmail新着受信**
   - Gmail APIのPush通知またはポーリング
   - DKIM/SPF/Fromドメイン検査
   - フィッシング疑義のブロック

2. **分類 & 情報抽出**
   - ルール + LLMで「請求/予定/その他」を分類
   - 請求: 請求元・金額・支払期日・振込先抽出
   - 予定: タイトル・日時・場所・参加URL抽出

3. **分岐A：予定なら**
   - Google Calendar APIでevents.insert（重複検知）
   - メールへラベル「Scheduled」付与
   - サマリを返信/Slack通知（任意）

4. **分岐B：請求なら**
   - 送金先の信頼度評価（ホワイトリスト/過去実績）
   - 金額・日次/月次上限・時間帯・リトライ回数などポリシー評価
   - クリアならトランザクション生成→ブロードキャスト
   - 失敗時はユーザー承認要求へフォールバック
   - 成功後：Gmailに「Paid (Onchain)」ラベル＋トランザクションハッシュ記録

## 🛠️ 技術スタック

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **AI**: OpenAI GPT-4o-mini
- **Google APIs**: Gmail API, Calendar API, OAuth2
- **Blockchain**: Viem, Ethereum Sepolia, JPYC Token
- **Database**: SQLite（開発用）
- **Deployment**: Vercel Ready

## 📋 前提条件

- Node.js 18+
- pnpm
- Google Cloud Console プロジェクト
- OpenAI API キー
- Ethereum Sepolia テストネット用秘密鍵
- JPYC テストトークン

## 🚀 セットアップ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd ai-gmail-automation
```

### 2. 依存関係のインストール

```bash
pnpm install
```

### 3. 環境変数の設定

```bash
cp .env.example .env.local
```

`.env.local` を編集：

```env
# Google APIs
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Google Cloud Pub/Sub（オプション）
GOOGLE_PROJECT_ID=your_google_project_id
GOOGLE_PUBSUB_SUBSCRIPTION=gmail-push-subscription

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Blockchain
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_infura_key
PRIVATE_KEY=your_private_key_for_development

# JPYC Contract（デプロイ後に設定）
JPYC_CONTRACT_ADDRESS=

# Security
JWT_SECRET=your_jwt_secret_for_sessions
ENCRYPTION_KEY=your_32_byte_encryption_key

# Development
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Google Cloud Console設定

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. Gmail API、Calendar APIを有効化
3. OAuth 2.0認証情報を作成
4. リダイレクトURIを設定：`http://localhost:3000/api/auth/google/callback`

### 5. 開発サーバーの起動

```bash
pnpm dev
```

ブラウザで `http://localhost:3000` を開いてください。

## 📖 使用方法

### 初回セットアップ

1. **Google認証**: 「Googleアカウントで認証」ボタンをクリック
2. **権限許可**: Gmail、Calendarへのアクセスを許可
3. **システム確認**: ダッシュボードでサービス接続状況を確認

### メール処理

1. **手動実行**: 「メール処理実行」ボタンで新着メールを処理
2. **結果確認**: 処理結果がリアルタイムで表示
3. **詳細確認**: トランザクションハッシュやカレンダーリンクをクリック

### 設定カスタマイズ

支払いポリシーは `src/lib/payment-policy.ts` で設定：

```typescript
// デフォルト設定例
{
  maxPerPayment: 100000,    // 10万円
  maxPerDay: 500000,        // 50万円
  maxPerWeek: 2000000,      // 200万円
  allowedHours: { start: 9, end: 18 },
  trustedDomains: ['gmail.com', 'company.co.jp'],
  requireManualApproval: {
    amountThreshold: 200000,  // 20万円以上
    unknownVendor: true,
    outsideBusinessHours: true,
  }
}
```

## 🔒 セキュリティ

- **非カストディ**: 秘密鍵はユーザー管理
- **DKIM/SPF検証**: メール認証の確認
- **フィッシング検知**: 疑わしいメールの自動ブロック
- **支払い制限**: 金額・時間・ベンダー制限
- **監査ログ**: 全処理の記録・追跡

## 🧪 テスト

```bash
# ユニットテスト
pnpm test

# E2Eテスト
pnpm test:e2e

# 型チェック
pnpm type-check

# Lint
pnpm lint
```

## 📦 デプロイ

### Vercelデプロイ

```bash
# Vercel CLIでデプロイ
pnpm dlx vercel

# 環境変数を設定
vercel env add GOOGLE_CLIENT_ID
vercel env add OPENAI_API_KEY
# ... 他の環境変数
```

### Railway/その他

```bash
# ビルド
pnpm build

# プロダクション起動
pnpm start
```

## 🔧 開発

### ディレクトリ構造

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── auth/          # Google OAuth
│   │   └── process-emails/ # メール処理
│   └── page.tsx           # メインダッシュボード
├── lib/                   # コアライブラリ
│   ├── gmail.ts           # Gmail API統合
│   ├── ai-classifier.ts   # AI分類・抽出
│   ├── calendar.ts        # Calendar API統合
│   ├── payment-policy.ts  # 支払いポリシー評価
│   ├── blockchain.ts      # ブロックチェーン統合
│   └── email-processor.ts # メイン処理ロジック
└── components/            # UIコンポーネント
    └── ui/               # 基本UIコンポーネント
```

### 新機能の追加

1. **新しい分類タイプ**: `ai-classifier.ts`を拡張
2. **支払いプロバイダー**: `blockchain.ts`に新しいサービス追加
3. **通知方法**: `email-processor.ts`に通知ロジック追加

## 🐛 トラブルシューティング

### よくある問題

**Q: Google認証でエラーが発生する**
A: リダイレクトURIがGoogle Cloud Consoleの設定と一致しているか確認

**Q: メール処理が動作しない**
A: 環境変数（特にOPENAI_API_KEY）が正しく設定されているか確認

**Q: ブロックチェーン接続エラー**
A: SEPOLIA_RPC_URLとPRIVATE_KEYが正しく設定されているか確認

### ログ確認

```bash
# 開発環境のログ
pnpm dev

# プロダクションログ
pnpm start --verbose
```

## 🤝 コントリビューション

1. フォークを作成
2. フィーチャーブランチを作成: `git checkout -b feature/amazing-feature`
3. 変更をコミット: `git commit -m 'Add amazing feature'`
4. ブランチにプッシュ: `git push origin feature/amazing-feature`
5. プルリクエストを作成

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照

## 🙋‍♂️ サポート

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Email**: support@yourproject.com

---

## 🔮 今後の拡張予定

- **zkVM統合**: RISC Zero/SP1による証明生成
- **EIP-4337**: Account Abstraction + Verifying Paymaster
- **EAS統合**: Ethereum Attestation Service
- **マルチチェーン**: Base、Polygon対応
- **Slack/Discord**: 通知統合
- **会計連携**: freee、MoneyForward連携
