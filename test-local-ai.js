// Node.js 18以降の内蔵fetchを使用

// ローカルAIクラシファイアのテスト実装
class LocalAIClassifier {
  constructor(config = {}) {
    this.config = {
      apiUrl: 'http://localhost:11434',
      model: 'llama3.1:8b',
      temperature: 0.1,
      maxTokens: 500,
      timeout: 60000, // 60秒に延長
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
    // より簡潔なプロンプトに変更
    const prompt = `メールを分析して分類してください。

件名: ${subject}
本文: ${emailContent}

以下から選択:
- INVOICE: 請求書・支払い
- SCHEDULE: 会議・予定
- OTHER: その他

JSON形式で回答:
{"type": "INVOICE", "confidence": 0.9, "reasoning": "理由"}`;

    try {
      console.log('🤖 ローカルAIでメール分析を開始...');
      const startTime = Date.now();
      
      const response = await this.callOllama(prompt);
      console.log('🔍 AI応答:', response.substring(0, 200) + '...');
      
      const duration = Date.now() - startTime;
      console.log(`✅ ローカルAI分析完了 (${duration}ms)`);
      
      // JSONを抽出してパース
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return result;
      } else {
        // JSONが見つからない場合、キーワードベースで分類
        const content = `${subject} ${emailContent}`.toLowerCase();
        if (content.includes('請求') || content.includes('支払') || content.includes('金額')) {
          return {
            type: 'INVOICE',
            confidence: 0.7,
            reasoning: 'キーワードベース分類: 請求関連'
          };
        } else if (content.includes('会議') || content.includes('予定') || content.includes('ミーティング')) {
          return {
            type: 'SCHEDULE',
            confidence: 0.7,
            reasoning: 'キーワードベース分類: 予定関連'
          };
        } else {
          return {
            type: 'OTHER',
            confidence: 0.5,
            reasoning: 'キーワードベース分類: その他'
          };
        }
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

  // 簡単なテスト用メソッド
  async simpleTest() {
    try {
      console.log('🧪 簡単なテストを実行...');
      const response = await this.callOllama('Hello, please respond with "Hello World" in JSON format like {"message": "Hello World"}');
      console.log('📝 応答:', response);
      return true;
    } catch (error) {
      console.error('❌ 簡単なテスト失敗:', error.message);
      return false;
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

  // 2. 簡単なテスト
  console.log('\n2. 簡単なAI応答テスト');
  const simpleTestResult = await classifier.simpleTest();
  console.log(`簡単なテスト: ${simpleTestResult ? '✅ 成功' : '❌ 失敗'}`);

  // 3. 請求書メールのテスト（簡略版）
  console.log('\n3. 請求書メールの分析テスト');
  const invoiceResult = await classifier.classifyEmail(
    '月額利用料 50,000円を請求いたします。お支払期限は1月31日です。',
    '月額利用料のお支払いについて'
  );
  console.log('請求書分析結果:', JSON.stringify(invoiceResult, null, 2));

  // 4. 会議メールのテスト（簡略版）
  console.log('\n4. 会議メールの分析テスト');
  const meetingResult = await classifier.classifyEmail(
    '来週の会議の件です。1月20日14:00-15:00、会議室Aにて。',
    'プロジェクト進捗確認会議'
  );
  console.log('会議分析結果:', JSON.stringify(meetingResult, null, 2));

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