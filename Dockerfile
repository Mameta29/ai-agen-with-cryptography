# Actually Intelligent - ハッカソン用Dockerfile
FROM node:18-slim

# 必要なシステムパッケージをインストール
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Rustとcargo（RISC Zero用）
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# RISC Zero toolchain
RUN curl -L https://risczero.com/install | bash
ENV PATH="/root/.risc0/bin:${PATH}"

# pnpmをインストール
RUN npm install -g pnpm

# 作業ディレクトリを設定
WORKDIR /app

# パッケージファイルをコピー
COPY package.json pnpm-lock.yaml ./

# 依存関係をインストール
RUN pnpm install --frozen-lockfile

# ソースコードをコピー
COPY . .

# RISC Zeroプロジェクトをビルド
RUN cd zk/risc0/zkvm-policy-engine && \
    source ~/.cargo/env && \
    rzup install && \
    cargo build --release

# Next.jsアプリケーションをビルド
RUN pnpm build

# ポートを公開
EXPOSE 3000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# デフォルトコマンド
CMD ["pnpm", "start"] 