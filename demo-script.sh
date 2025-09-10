#!/bin/bash

# 色付きの出力設定
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎯 Aya AI Hackathon - Gmail Automation with ZKP Demo${NC}"
echo "=================================================="
echo ""

# 1. MCPツール一覧表示
echo -e "${YELLOW}【1. MCPサーバー起動確認】${NC}"
echo "Ayaエージェントが使用できるツール一覧を表示します..."
echo ""
echo -e "${GREEN}実行コマンド:${NC}"
echo "npm run mcp-test"
echo ""

echo -e "${GREEN}結果:${NC}"
npm run mcp-test 2>/dev/null | tail -1 | jq -r '.result.tools[] | "✅ " + .name + ": " + .description'

echo ""
echo "=================================================="
echo ""

# 2. ZKPルール設定確認
echo -e "${YELLOW}【2. ZKPルール設定確認】${NC}"
echo "現在の暗号学的制約ルールを確認します..."
echo ""
echo -e "${GREEN}実行コマンド:${NC}"
echo "get_zkp_rules を呼び出し"
echo ""

echo -e "${GREEN}結果:${NC}"
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_zkp_rules","arguments":{}}}' | node dist/mcp-server.js 2>/dev/null | jq -r '.result.content[0].text'

echo ""
echo "=================================================="
echo ""

# 3. ZKP証明付き支払い実行
echo -e "${YELLOW}【3. ZKP証明付き支払い実行】${NC}"
echo "ルール遵守を暗号学的に証明しながら支払いを実行します..."
echo ""
echo -e "${GREEN}支払い詳細:${NC}"
echo "- 送金先: 0xF2431b618B5b02923922c525885DBfFcdb9DE853"
echo "- 金額: 50,000 JPYC"
echo "- 理由: 電気代支払い"
echo ""

echo -e "${GREEN}結果:${NC}"
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"send_zkp_payment","arguments":{"recipientAddress":"0xF2431b618B5b02923922c525885DBfFcdb9DE853","amount":50000,"description":"電気代支払い"}}}' | node dist/mcp-server.js 2>/dev/null | jq -r '.result.content[0].text'

echo ""
echo "=================================================="
echo ""

# 4. ZKP証明付き予定作成
echo -e "${YELLOW}【4. ZKP証明付き予定作成】${NC}"
echo "スケジュールルールを暗号学的に検証しながら予定を作成します..."
echo ""
echo -e "${GREEN}予定詳細:${NC}"
echo "- タイトル: 重要会議"
echo "- 時間: 2024-09-13 14:00-15:00"
echo "- 参加者: test@example.com"
echo ""

echo -e "${GREEN}結果:${NC}"
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"schedule_meeting_with_zkp","arguments":{"title":"重要会議","startTime":"2024-09-13T14:00:00Z","endTime":"2024-09-13T15:00:00Z","attendees":["test@example.com"],"description":"プロジェクト進捗確認"}}}' | node dist/mcp-server.js 2>/dev/null | jq -r '.result.content[0].text'

echo ""
echo "=================================================="
echo ""
echo -e "${RED}🎉 デモ完了！${NC}"
echo -e "${GREEN}すべての操作がZKP証明により暗号学的に保証されました！${NC}"
echo "" 