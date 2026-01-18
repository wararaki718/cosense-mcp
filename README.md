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

## 開発

```bash
# ビルド
npm run build

# 型チェックとビルドの自動実行 (watchモードが必要な場合は scripts に追記してください)
npm run build
```

## ライセンス

ISC License
