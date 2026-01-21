# Cosense (Scrapbox) MCP Server

Model Context Protocol (MCP) を通じて Scrapbox (Cosense) の API と連携するためのサーバーです。
Claude Desktop などの MCP ホストから Scrapbox のページを読み書きしたり、検索したりできるようになります。

## 実装されているツール

1.  **get_page**: 指定したタイトルのページ本文を取得します。
2.  **create_page**: 新しいページを作成します。既存のページがある場合に追記するオプションも備えています。
3.  **search_pages**: プロジェクト内をキーワードで検索し、一致するページタイトルの一覧を返します。

## セットアップ

### 1. インストール

```bash
cd mcp
npm install
npm run build
```

### 2. 環境変数の準備

以下の 2 つの情報が必要です。

-   `SCRAPBOX_PROJECT`: 利用したい Scrapbox のプロジェクト名。カンマ区切りで複数指定可能です（例: `project1,project2`）。
-   `SCRAPBOX_CONNECT_SID`: 認証用の `connect.sid` クッキー値（ブラウザのデベロッパーツールから取得可能）。
    -   ※ 閲覧制限のない公開プロジェクトの場合は不要な場合があります。

### 3. MCP ホストへの登録 (Claude Desktop の例)

`~/Library/Application Support/Claude/claude_desktop_config.json` に設定を追加します。

```json
{
  "mcpServers": {
    "cosense": {
      "command": "node",
      "args": ["/Users/YOUR_USER/path/to/cosense-mcp/build/index.js"],
      "env": {
        "SCRAPBOX_PROJECT": "project1,project2",
        "SCRAPBOX_CONNECT_SID": "your-connect-sid-cookie-value"
      }
    }
  }
}
```

## ツール仕様の変更案

-   `search_pages`: 設定されたすべてのプロジェクトから検索し、`[project] title` の形式で結果を返します。
-   `get_page` / `create_page`: `project` 引数をオプションで指定可能です。省略した場合は環境変数の最初に指定したプロジェクトが使用されます。

## ワークスペースの構成

このリポジトリには以下の3つのコンポーネントが含まれています：

1.  **[mcp/](mcp/)**: Scrapbox API と直接やり取りする MCP サーバー。
2.  **[backend/](backend/)**: LangChain を使用したエージェントサーバー。MCP サーバーをクライアントとして利用し、ユーザーの質問に回答します。
3.  **[ui/](ui/)**: エージェントとチャットするための React ベースの Web インターフェース。

## クイックスタート (エージェントアプリの実行)

### 1. MCP サーバーのビルド
```bash
cd mcp
npm install
npm run build
```

### 2. バックエンドのセットアップ
```bash
cd backend
npm install
cp .env.example .env
# .env を編集して OPENAI_API_KEY, SCRAPBOX_PROJECTS, SCRAPBOX_CONNECT_SID を設定してください
npm run dev
```

### 3. UI のセットアップ
```bash
cd ui
npm install
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開くとチャットを開始できます。

sample input

```text
scrapbox から Machine Learning に関連するページをください。
```

## RAG評価 (Ragas)

このシステムの RAG (Retrieval-Augmented Generation) 性能を評価できます。

### 評価メトリクス

- **Faithfulness**: 生成された回答がコンテキストに基づいているか
- **Answer Relevancy**: 回答が質問に関連しているか
- **Context Relevancy**: 検索されたコンテキストが質問に関連しているか
- **Context Precision**: 検索されたコンテキストの精度

### セットアップ

```bash
# Python環境のセットアップ
python -m venv venv
source venv/bin/activate  # macOS/Linux
# または
python -m venv venv && venv\Scripts\activate  # Windows

# 依存パッケージのインストール
pip install -r evaluate/requirements.txt
```

### 使用方法

#### 1. テストデータセットの準備

`evaluate/datasets/test_dataset.json` にテストデータを定義します。形式は以下の通りです：

```json
{
  "questions": ["質問1", "質問2", ...],
  "ground_truths": ["正解1", "正解2", ...],
  "contexts": ["コンテキスト1", "コンテキスト2", ...],
  "answer": ["回答1", "回答2", ...]
}
```

#### 2. RAG評価の実行

```bash
# 基本的な使用方法
python -m evaluate.run --dataset evaluate/datasets/test_dataset.json

# 結果をファイルに保存
python -m evaluate.run --dataset evaluate/datasets/test_dataset.json --output results.json
```

#### 3. 結果の確認

評価スクリプトはコンソールに結果を表示し、オプションで JSON ファイルに保存します。

```
==================================================
RAG Evaluation Results
==================================================
{
  "faithfulness": {
    "mean": 0.85,
    "scores": [0.8, 0.9, 0.85, ...]
  },
  ...
}
```

### ディレクトリ構成

```
evaluate/
├── __init__.py              # Evaluate パッケージ
├── config.py                # 評価メトリクスと LLM 設定
├── run.py                   # 評価実行スクリプト
└── datasets/
    └── test_dataset.json    # テストデータセット
```

### カスタマイズ

評価メトリクスや LLM の設定は `evaluate/config.py` で管理できます。

```python
# 評価メトリクスの変更
EVALUATION_METRICS = [
    faithfulness,
    answer_relevancy,
    # 必要に応じてメトリクスを追加
]

# LLM モデルの変更
LLM_MODEL = "gemini-2.5-flash-lite"
```

## ライセンス

Apache-2.0 license
