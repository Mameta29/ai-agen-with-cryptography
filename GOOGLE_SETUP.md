# 🔐 Google OAuth設定手順

## 1. Google Cloud Consoleでのプロジェクト作成

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成
   - プロジェクト名: `ai-gmail-automation`（任意）
   - 組織: 個人の場合は「組織なし」

## 2. 必要なAPIを有効化

### Gmail API
1. 「APIとサービス」→「ライブラリ」
2. "Gmail API"を検索
3. 「有効にする」をクリック

### Google Calendar API
1. 同じく「ライブラリ」から"Google Calendar API"を検索
2. 「有効にする」をクリック

## 3. OAuth同意画面の設定

1. 「APIとサービス」→「OAuth同意画面」
2. **User Type選択**:
   - **External**: 任意のGoogleアカウントでアクセス可能（推奨）
   - **Internal**: 組織内ユーザーのみ（G Suiteが必要）

3. **アプリ情報入力**:
   - アプリ名: `AI Gmail Automation`
   - ユーザーサポートメール: あなたのGmailアドレス
   - デベロッパー連絡先: あなたのGmailアドレス

4. **スコープ設定**:
   - 「スコープを追加または削除」
   - 以下のスコープを追加:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.modify`
     - `https://www.googleapis.com/auth/calendar.events`

5. **テストユーザー** (Externalの場合):
   - あなたのGmailアドレスを追加

## 4. OAuth 2.0認証情報の作成

1. 「APIとサービス」→「認証情報」
2. 「認証情報を作成」→「OAuth 2.0 クライアント ID」
3. **アプリケーションの種類**: 「ウェブアプリケーション」
4. **名前**: `AI Gmail Automation Client`
5. **承認済みのリダイレクト URI**:
   ```
   http://localhost:3000/api/auth/google/callback
   ```

6. 「作成」をクリック
7. **クライアントIDとクライアントシークレット**をコピー

## 5. 環境変数の設定

`.env.local`ファイルに以下を設定:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

## 6. 初回認証の実行

1. アプリケーションを起動:
   ```bash
   pnpm dev
   ```

2. ブラウザで `http://localhost:3000` にアクセス

3. 「Googleアカウントで認証」をクリック

4. Google認証画面で:
   - アカウントを選択
   - 権限を許可
   - **リフレッシュトークンが自動取得されます**

## 7. トラブルシューティング

### よくあるエラー

**"redirect_uri_mismatch"**
- リダイレクトURIが正確に設定されているか確認
- `http://localhost:3000/api/auth/google/callback`

**"access_denied"**
- OAuth同意画面でテストユーザーに追加されているか確認

**"unauthorized_client"**
- クライアントIDが正しく設定されているか確認

### 本番環境での設定

本番環境では以下を変更:
```env
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

Google Cloud Consoleの承認済みリダイレクトURIも更新が必要です。

## 8. セキュリティのベストプラクティス

1. **クライアントシークレット**は絶対に公開しない
2. 本番環境では環境変数で管理
3. 定期的にクライアントシークレットをローテーション
4. 不要なスコープは削除
5. OAuth同意画面を本番公開前に審査申請 