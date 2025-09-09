# 🚀 AI Gmail Automation セットアップガイド

## 📋 現在の状況

✅ **実装完了**:
- GPT-5-nano統合（AI分類・請求書解析）
- ZKP証明・検証システム
- ブロックチェーン統合（JPYC送金）
- カレンダー連携

❌ **要設定**: Google OAuth認証

## 🔧 Google OAuth設定の修正

### エラーの原因
`Error 403: access_denied` - アプリが「テスト中」状態で、承認されたテストユーザーのみアクセス可能

### 解決方法

1. **Google Cloud Console**にアクセス
   - [https://console.cloud.google.com/](https://console.cloud.google.com/)

2. **OAuth同意画面**に移動
   - 「APIとサービス」→「OAuth同意画面」

3. **テストユーザーを追加**
   - 画面下部の「テストユーザー」セクションを探す
   - 「+ ユーザーを追加」をクリック
   - あなたのGmailアドレス（`mameta.zk@gmail.com`）を入力
   - 「保存」をクリック

4. **変更の反映を待つ**
   - 設定変更は最大5分かかる場合があります

## 🌐 認証手順

### 1. ブラウザでアクセス
```
http://localhost:3000
```

### 2. Google認証
- 「Googleアカウントで認証」ボタンをクリック
- テストユーザーに追加したGmailアカウントでログイン
- 以下の権限を許可:
  - Gmail読み取り・変更
  - Calendar イベント作成
  - ユーザー情報取得

### 3. 認証成功確認
- 認証完了後、`GOOGLE_REFRESH_TOKEN`が自動取得されます
- ダッシュボードでサービス接続状況を確認

## 🧪 動作テスト

### 1. システム状態確認
```bash
curl http://localhost:3000/api/process-emails
```

期待する結果:
```json
{
  "success": true,
  "healthCheck": {
    "gmail": true,    // ← 認証後はtrueになる
    "openai": true,
    "blockchain": true,
    "zkp": true,
    "overall": true   // ← 全てtrueになる
  }
}
```

### 2. メール処理実行
```bash
curl -X POST http://localhost:3000/api/process-emails
```

## 🔄 処理フロー

### 📧 メール受信時
1. **AI分類**（GPT-5-nano）
   - 請求書 / 予定 / その他 を判断
   - 関連情報を抽出

2. **請求書の場合**
   ```
   請求書解析 → 支払い計画生成 → ZKP証明生成 → ZKP検証 → JPYC送金実行
   ```

3. **予定の場合**
   ```
   予定解析 → スケジュール計画生成 → ZKP証明生成 → ZKP検証 → カレンダー登録
   ```

## 🛡️ ZKP検証ルール

### 支払いルール
- **許可アドレス**: ホワイトリストのみ
- **金額上限**: 10万円/回、50万円/日
- **時間制限**: 9:00-18:00のみ
- **信頼ドメイン**: gmail.com, company.co.jp等

### スケジュールルール
- **時間制限**: 9:00-18:00のみ
- **曜日制限**: 月-金のみ
- **会議時間**: 最大3時間
- **ブロックキーワード**: 機密、秘密等

## 🚨 トラブルシューティング

### Google認証エラー
- **Error 403**: テストユーザーに追加されているか確認
- **redirect_uri_mismatch**: リダイレクトURIが正確に設定されているか確認

### API エラー
- **Gmail接続エラー**: GOOGLE_REFRESH_TOKENが設定されているか確認
- **OpenAI エラー**: OPENAI_API_KEYが有効か確認
- **Blockchain エラー**: PRIVATE_KEY、SEPOLIA_RPC_URLが正しく設定されているか確認

## 📝 必要な環境変数

### ✅ 設定済み
- `JPYC_CONTRACT_ADDRESS=0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB`
- `PRIVATE_KEY=your_private_key`
- `SEPOLIA_RPC_URL=your_sepolia_rpc_url`
- `OPENAI_API_KEY=your_openai_api_key`
- `GOOGLE_CLIENT_ID=44308787612-0bmut0otuurvapcffom41a2f1fqsjv7s.apps.googleusercontent.com`
- `GOOGLE_CLIENT_SECRET=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`

### 🔄 認証後に自動取得
- `GOOGLE_REFRESH_TOKEN` - 初回認証時に自動設定

## 🎯 次のステップ

1. **テストユーザー追加** ← 最優先
2. **Google認証実行**
3. **メール処理テスト**
4. **実際のメール送信テスト**

## 💡 テスト用メール例

認証完了後、以下のようなメールを自分に送信してテスト:

### 請求書メール例
```
件名: 請求書 - 電力料金
本文: 
東京電力より電力料金の請求です。
金額: 50,000円
支払期限: 2024-12-31
請求番号: TEPCO-2024-001
```

### 予定メール例
```
件名: 会議の予定
本文:
来週の企画会議の件でご連絡いたします。
日時: 2024-12-20 14:00-16:00
場所: 会議室A
```

これらのメールが自動で分類・処理され、ZKP検証を経て実行されます！ 