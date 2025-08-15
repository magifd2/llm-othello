# Othello with LLM

## 概要
このプロジェクトは、ブラウザ上で動作するオセロゲームと、LLM（大規模言語モデル）との連携を最小限の実装で探求するためのものです。ゲームのロジックとLLMとの通信はすべてクライアントサイド（JavaScript）で完結しており、Go言語で書かれたサーバーは静的ファイルの配信と、LLM APIへのプロキシ（CORS回避のため）のみを担当します。これにより、LLMとの対戦をよりインタラクティブで実験的なものにすることを目指しています。

## 特徴
- ブラウザベースのオセロゲーム
- **クライアントサイド完結のゲームロジック**: すべてのゲームロジックは `script.js` で実装されています。
- **LLMとの対戦機能**: LLMとの通信も `script.js` で行われます。
- **シンプルなGoサーバー**: 静的ファイルの配信と、LLM APIへのプロキシ（CORS回避）のみを行います。
- シンプルなコードベースで、LLM連携の実験が容易

## セットアップ
このプロジェクトを実行するには、Go言語の実行環境が必要です。

1.  **リポジトリのクローン**
    ```bash
    git clone <リポジトリのURL>
    cd othello
    ```

2.  **Goサーバーのビルドと実行**
    プロジェクトのルートディレクトリで以下のコマンドを実行します。
    ```bash
    go run server.go
    ```
    サーバーが起動すると、通常 `http://localhost:8080` でアクセスできるようになります。

## 遊び方
ブラウザで `http://localhost:8080` にアクセスしてください。ゲーム画面が表示され、LLMとの対戦を開始できます。

## LLM設定の変更方法
LLMとの連携に関する主要なロジックはすべて `script.js` に記述されています。`server.go` は、`script.js` からのLLM APIリクエストをプロキシする役割を担っています。

-   **`script.js`**: LLMのAPIエンドポイント、LLMに送るプロンプト、LLMからの応答処理など、LLMとの通信に関するすべてのロジックが含まれています。
    現在、LLMとしてはLM Studioで動作するOpenAIのGPT-oss 20Bがハードコードされています。`script.js` 内の `makeCpuMove` 関数にある `fetch` リクエストの `body` 内の `model` パラメータを変更することで、使用するLLMモデルを切り替えることができます。例えば、`"model": "openai/gpt-oss-20b"` の部分を `"model": "your-new-model-name"` に変更します。
-   **`server.go`**: クライアントサイドからのLLM APIリクエストを、サーバーサイドでLLMの実際のAPIエンドポイントに転送します。これは、ブラウザのCORS（Cross-Origin Resource Sharing）制限を回避し、安全にLLMのAPIを利用するために行われます。

具体的な変更箇所は、`script.js` 内で以下のキーワードで検索すると見つけやすいでしょう。
-   `LLM_API_ENDPOINT` (またはプロキシエンドポイント)

-   `prompt`
-   `fetch`

**例（`script.js`での変更イメージ）:**
```javascript
// LLMのAPIエンドポイントを変更する場合（サーバーのプロキシエンドポイントを指定）
const LLM_API_URL = '/api/llm'; // server.go がプロキシするエンドポイント

// LLMに送るプロンプトを調整する場合
const prompt = `あなたはオセロのAIです。次の盤面で最適な手をJSON形式で返してください: ${boardState}`;
```

**例（`server.go`での変更イメージ）:**
```go
// LLMの実際のAPIエンドポイントを設定する場合
const actualLLMAPIURL = "https://api.example.com/v1/chat/completions";

// LLMへのリクエストボディを調整する場合（プロキシ処理内で）
// (例: モデル名、温度設定など)
// reqBody := map[string]interface{}{
//     "model": "gemini-pro",
//     "messages": []map[string]string{{
//         "role": "user",
//         "content": promptFromClient, // クライアントから受け取ったプロンプト
//     }},
//     "temperature": 0.7,
// }
```

変更後は、`server.go` を再起動し、ブラウザをリロードしてください。

## コードの改造方法
このプロジェクトは、LLMとの連携を試すためのシンプルな基盤を提供します。以下のような改造が考えられます。

-   **LLMの戦略改善**: `script.js` 内でLLMに与えるプロンプトを工夫し、より強力なオセロAIを開発する。
-   **UI/UXの改善**: ゲームの見た目や操作性を向上させる。
-   **異なるLLMの統合**: `script.js` 内のLLM通信ロジックを変更し、現在使用しているLLM以外のモデル（例: OpenAI GPTシリーズ、Gemini、Claudeなど）と連携するように変更する。
-   **ゲームロジックの拡張**: `script.js` 内のゲームロジックを修正し、オセロ以外のボードゲームに適用する。
-   **設定ファイルの導入**: LLMの設定をコードから分離し、外部ファイル（例: `config.json`）で管理するようにする。

コードは `index.html`, `style.css`, `script.js`, `server.go` の4つの主要なファイルで構成されています。

-   `index.html`: ゲームのHTML構造
-   `style.css`: ゲームのスタイル
-   `script.js`: **クライアントサイドのゲームロジックとLLMとの通信ロジックのすべて**
-   `server.go`: 静的ファイルの配信と、LLM APIへのプロキシ

自由にコードを修正し、LLMとの新しい遊び方を発見してください。