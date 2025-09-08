#!/bin/bash

# AI Gmail Automation セットアップスクリプト
# このスクリプトは開発環境のセットアップを自動化します

set -e

echo "🚀 AI Gmail Automation セットアップを開始します..."

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 関数定義
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Node.jsバージョンチェック
check_node_version() {
    print_info "Node.jsバージョンを確認中..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.jsがインストールされていません"
        print_info "Node.js 18以上をインストールしてください: https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | sed 's/v//')
    REQUIRED_VERSION="18.0.0"
    
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
        print_success "Node.js $NODE_VERSION が確認されました"
    else
        print_error "Node.js $REQUIRED_VERSION 以上が必要です（現在: $NODE_VERSION）"
        exit 1
    fi
}

# pnpmチェック・インストール
check_pnpm() {
    print_info "pnpmを確認中..."
    
    if ! command -v pnpm &> /dev/null; then
        print_warning "pnpmがインストールされていません。インストールします..."
        npm install -g pnpm
        print_success "pnpmをインストールしました"
    else
        print_success "pnpmが確認されました"
    fi
}

# 依存関係インストール
install_dependencies() {
    print_info "依存関係をインストール中..."
    pnpm install
    print_success "依存関係のインストールが完了しました"
}

# 環境変数ファイル作成
setup_env_file() {
    print_info "環境変数ファイルを設定中..."
    
    if [ ! -f .env.local ]; then
        if [ -f .env.example ]; then
            cp .env.example .env.local
            print_success ".env.localファイルを作成しました"
            print_warning "⚠️  .env.localファイルを編集して、必要な環境変数を設定してください"
        else
            print_error ".env.exampleファイルが見つかりません"
            exit 1
        fi
    else
        print_info ".env.localファイルは既に存在します"
    fi
}

# 必要なディレクトリ作成
create_directories() {
    print_info "必要なディレクトリを作成中..."
    
    mkdir -p data
    mkdir -p logs
    mkdir -p temp
    
    print_success "ディレクトリを作成しました"
}

# Git設定確認
check_git_setup() {
    print_info "Git設定を確認中..."
    
    if [ ! -d .git ]; then
        print_warning "Gitリポジトリが初期化されていません"
        read -p "Gitリポジトリを初期化しますか？ (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git init
            git add .
            git commit -m "Initial commit"
            print_success "Gitリポジトリを初期化しました"
        fi
    else
        print_success "Gitリポジトリが確認されました"
    fi
}

# 開発サーバー起動確認
test_dev_server() {
    print_info "開発サーバーの起動テストを実行中..."
    
    # 型チェック
    if pnpm type-check; then
        print_success "TypeScriptの型チェックが成功しました"
    else
        print_warning "TypeScriptの型チェックでエラーが発生しました"
    fi
    
    # ビルドテスト
    if pnpm build; then
        print_success "ビルドが成功しました"
        
        # 一時的にビルドファイルを削除
        rm -rf .next
        print_info "ビルドファイルをクリーンアップしました"
    else
        print_error "ビルドに失敗しました"
        print_info "エラーを確認して修正してください"
    fi
}

# Google Cloud Console設定ガイド
show_google_setup_guide() {
    print_info "Google Cloud Console設定ガイド"
    echo
    echo "📝 以下の手順でGoogle Cloud Consoleを設定してください："
    echo
    echo "1. https://console.cloud.google.com/ にアクセス"
    echo "2. 新しいプロジェクトを作成"
    echo "3. 以下のAPIを有効化："
    echo "   - Gmail API"
    echo "   - Google Calendar API"
    echo "4. OAuth 2.0認証情報を作成："
    echo "   - アプリケーションの種類: ウェブアプリケーション"
    echo "   - 承認済みのリダイレクトURI: http://localhost:3000/api/auth/google/callback"
    echo "5. クライアントIDとクライアントシークレットを.env.localに設定"
    echo
}

# セットアップ完了メッセージ
show_completion_message() {
    echo
    print_success "🎉 セットアップが完了しました！"
    echo
    echo "📋 次のステップ："
    echo "1. .env.localファイルを編集して環境変数を設定"
    echo "2. Google Cloud Console設定を完了"
    echo "3. 開発サーバーを起動: pnpm dev"
    echo "4. ブラウザで http://localhost:3000 を開く"
    echo
    print_warning "⚠️  本番環境にデプロイする前に、セキュリティ設定を確認してください"
    echo
}

# メイン実行
main() {
    echo "=================================="
    echo "🤖 AI Gmail Automation Setup"
    echo "=================================="
    echo
    
    check_node_version
    check_pnpm
    install_dependencies
    setup_env_file
    create_directories
    check_git_setup
    test_dev_server
    show_google_setup_guide
    show_completion_message
}

# スクリプト実行
main "$@" 