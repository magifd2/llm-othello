package main

import (
	"embed" // embed パッケージをインポート
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
)

//go:embed index.html script.js style.css
var embeddedFiles embed.FS // 埋め込むファイルを指定

// LLM_SERVER_URL はLLMサーバーのベースURLです。
const LLM_SERVER_URL = "http://localhost:1234" // LM Studioのデフォルトポート

func main() {
	// 静的ファイルの提供
	// embed.FS を使用して、埋め込まれたファイルをWebルートとして設定
	fs := http.FileServer(http.FS(embeddedFiles))
	http.Handle("/", fs)

	// LLMプロキシハンドラ
	http.HandleFunc("/llm-proxy/", llmProxyHandler)

	port := ":8000"
	fmt.Printf("サーバーを %s で起動しました。http://localhost%s\n", port, port)
	log.Fatal(http.ListenAndServe(port, nil))
}

func llmProxyHandler(w http.ResponseWriter, r *http.Request) {
	proxyPath := r.URL.Path[len("/llm-proxy"):]
	targetURL, err := url.Parse(LLM_SERVER_URL + proxyPath)
	if err != nil {
		http.Error(w, "Bad Gateway: Invalid target URL", http.StatusBadGateway)
		log.Printf("Invalid target URL: %v", err)
		return
	}

	proxyReq, err := http.NewRequest(r.Method, targetURL.String(), r.Body)
	if err != nil {
		http.Error(w, "Internal Server Error: Could not create proxy request", http.StatusInternalServerError)
		log.Printf("Could not create proxy request: %v", err)
		return
	}

	for name, values := range r.Header {
		if name == "Host" {
			continue
		}
		for _, value := range values {
			proxyReq.Header.Add(name, value)
		}
	}

	client := &http.Client{}
	resp, err := client.Do(proxyReq)
	if err != nil {
		http.Error(w, "Bad Gateway: Could not connect to LLM server", http.StatusBadGateway)
		log.Printf("Could not connect to LLM server: %v", err)
		return
	}
	defer resp.Body.Close()

	for name, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(name, value)
		}
	}
	w.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(w, resp.Body); err != nil {
		log.Printf("Error copying response body: %v", err)
	}
}
