const { default: fetch } = require('node-fetch');

// ローカルAIクラシファイアのテスト実装
class LocalAIClassifier {
  constructor(config = {}) {
    this.config = {
      apiUrl: 'http://localhost:11434',
      model: 'llama3.1:8b',
      temperature: 0.1,
      maxTokens: 1000,
      timeout: 30000,
      ...config
    };
  }

  async callOllama(prompt) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.apiUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt,
          stream: false,
          options: {
            temperature: this.config.temperature,
            num_predict: this.config.maxTokens,
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.response;
    } finally {
      clearTimeout(timeout);
    }
  }

  async testConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.config.apiUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('Ollama接続テスト失敗:', error.message);
      return false;
    }
  }

  async classifyEmail(emailContent, subject = '') {
    const prompt = `
あなたは優秀なメール分析AIです。以下のメールを分析し、JSON形式で結果を返してください。

分類タイプ:
- INVOICE: 請求書、支払い要求、料金通知
- SCHEDULE: 会議、予定、イベントの招待
- OTHER: その他

メール件名: ${subject}

メール本文:
${emailContent}

以下のJSON形式で回答してください:
{
  "type": "INVOICE|SCHEDULE|OTHER",
  "confidence": 0.95,
  "reasoning": "分類の理由を日本語で説明",
  "extracted_data": {
    "amount": 50000,
    "vendorName": "会社名",
    "vendorEmail": "example@company.com"
  }
}

重要: JSON以外の文字は出力しないでください。
`;

    try {
      console.log('🤖 ローカルAIでメール分析を開始...');
      const startTime = Date.now();
      
      const response = await this.callOllama(prompt);
      
      const duration = Date.now() - startTime;
      console.log(`✅ ローカルAI分析完了 (${duration}ms)`);
      
      // JSONを抽出してパース
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return result;
      } else {
        throw new Error('JSONが見つかりません');
      }
    } catch (error) {
      console.error('❌ ローカルAI分析エラー:', error.message);
      return {
        type: 'OTHER',
        confidence: 0.1,
        reasoning: 'エラーのため分類できませんでした',
        extracted_data: null
      };
    }
  }
}

// テスト実行
async function runTests() {
  console.log('🚀 ローカルAIテストを開始...');
  
  const classifier = new LocalAIClassifier();
  
  // 1. 接続テスト
  console.log('\n1. 接続テスト');
  const isConnected = await classifier.testConnection();
  console.log(`接続状態: ${isConnected ? '✅ 成功' : '❌ 失敗'}`);
  
  if (!isConnected) {
    console.log('Ollamaサービスが起動していない可能性があります。');
    console.log('以下のコマンドで起動してください: brew services start ollama');
    return;
  }

  // 2. 請求書メールのテスト
  console.log('\n2. 請求書メールの分析テスト');
  const invoiceEmail = `
件名: 【重要】月額利用料のお支払いについて

いつもお世話になっております。
株式会社サンプルです。

2024年12月分の月額利用料をご請求させていただきます。

請求金額: 50,000円
請求書番号: INV-2024-12-001
お支払期限: 2025年01月31日

お支払いは以下の口座までお願いいたします。
振込先: みずほ銀行 東京支店 普通 1234567

よろしくお願いいたします。
`;
  
  const invoiceResult = await classifier.classifyEmail(invoiceEmail, '【重要】月額利用料のお支払いについて');
  console.log('請求書分析結果:', JSON.stringify(invoiceResult, null, 2));

  // 3. 会議メールのテスト
  console.log('\n3. 会議メールの分析テスト');
  const meetingEmail = `
件名: 【会議招待】プロジェクト進捗確認会議

お疲れ様です。

来週のプロジェクト進捗確認会議の件でご連絡いたします。

日時: 2025年01月20日(月) 14:00-15:00
場所: 会議室A
参加者: 田中、佐藤、山田

議題:
- 第1四半期の進捗確認
- 次フェーズの計画について

Zoomリンク: https://zoom.us/j/123456789

よろしくお願いいたします。
`;

  const meetingResult = await classifier.classifyEmail(meetingEmail, '【会議招待】プロジェクト進捗確認会議');
  console.log('会議分析結果:', JSON.stringify(meetingResult, null, 2));

  // 4. その他メールのテスト
  console.log('\n4. その他メールの分析テスト');
  const otherEmail = `
件名: お疲れ様でした

お疲れ様です。

今日のプレゼンテーション、とても良かったです。
資料もわかりやすく、クライアントも満足していました。

また明日もよろしくお願いします。
`;

  const otherResult = await classifier.classifyEmail(otherEmail, 'お疲れ様でした');
  console.log('その他分析結果:', JSON.stringify(otherResult, null, 2));

  console.log('\n🎉 ローカルAIテスト完了！');
}

// メイン実行
if (require.main === module) {
  runTests().catch(error => {
    console.error('テスト実行エラー:', error);
    process.exit(1);
  });
}

module.exports = { LocalAIClassifier }; 