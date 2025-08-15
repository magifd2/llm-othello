const boardElement = document.getElementById('board');
const messageElement = document.getElementById('message');
const resetButton = document.getElementById('reset-button');

const BOARD_SIZE = 8;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

let board = [];
let currentPlayer;
const CPU_PLAYER = WHITE; // 白をCPUとする

// ゲームの初期化
function initializeGame() {
    board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(EMPTY));
    // 初期配置
    board[3][3] = WHITE;
    board[3][4] = BLACK;
    board[4][3] = BLACK;
    board[4][4] = WHITE;

    currentPlayer = BLACK; // 黒からスタート
    drawBoard();
    updateMessage();
}

// 盤面の描画
function drawBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', handleCellClick);

            const piece = document.createElement('div');
            piece.classList.add('piece');

            if (board[r][c] === BLACK) {
                piece.classList.add('black');
            } else if (board[r][c] === WHITE) {
                piece.classList.add('white');
            }
            cell.appendChild(piece);
            boardElement.appendChild(cell);
        }
    }
}

// メッセージの更新
function updateMessage() {
    const blackCount = countPieces(BLACK);
    const whiteCount = countPieces(WHITE);
    messageElement.textContent = `黒: ${blackCount} 白: ${whiteCount} - ${currentPlayer === BLACK ? '黒' : '白'}の番です`;
}

// 石の数を数える
function countPieces(player) {
    let count = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === player) {
                count++;
            }
        }
    }
    return count;
}

// セルクリック時の処理
function handleCellClick(event) {
    if (currentPlayer === CPU_PLAYER) return; // CPUのターン中はクリックを無効化

    const row = parseInt(event.currentTarget.dataset.row);
    const col = parseInt(event.currentTarget.dataset.col);

    if (isValidMove(row, col, currentPlayer)) {
        placePieceAndFlip(row, col, currentPlayer);
        switchPlayer();
    } else {
        alert('そこには置けません！');
    }
}

// 手番を交代し、CPUのターンならCPUの処理を呼び出す
function switchPlayer() {
    currentPlayer = (currentPlayer === BLACK) ? WHITE : BLACK; // 手番交代
    drawBoard();
    updateMessage();

    // パス判定
    if (!hasValidMove(currentPlayer)) {
        messageElement.textContent += ` - ${currentPlayer === BLACK ? '黒' : '白'}はパス！`;
        currentPlayer = (currentPlayer === BLACK) ? WHITE : BLACK; // 再度手番交代
        if (!hasValidMove(currentPlayer)) { // 両者パスでゲーム終了
            endGame(); 
            return;
        }
    }

    if (currentPlayer === CPU_PLAYER) {
        // CPUのターン
        messageElement.textContent = `黒: ${countPieces(BLACK)} 白: ${countPieces(WHITE)} - CPUが考え中...`;
        setTimeout(makeCpuMove, 1000); // 1秒後にCPUが手を打つ
    }
}

// CPUが手を打つ (LLMを使用)
async function makeCpuMove() {
    const validMoves = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (isValidMove(r, c, CPU_PLAYER)) {
                validMoves.push({ r, c });
            }
        }
    }

    if (validMoves.length === 0) {
        // CPUがパスする場合
        switchPlayer();
        return;
    }

    // 盤面をテキスト形式に変換
    let boardText = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === BLACK) boardText += 'B';
            else if (board[r][c] === WHITE) boardText += 'W';
            else boardText += '.';
        }
        boardText += '\n';
    }

    // 合法手をテキスト形式に変換
    const validMovesText = validMoves.map(move => `{"row": ${move.r}, "col": ${move.c}}`).join(', ');

    const prompt = `あなたはオセロゲームのAIです。現在の盤面と合法手に基づいて、最も最適な手をJSON形式で提案してください。
盤面は8x8のグリッドで、'B'は黒石、'W'は白石、'.'は空のマスを表します。
あなたの石は'W'です。

盤面:
${boardText}合法手:
[${validMovesText}]

提案する手は、合法手の中から選んでください。
出力は以下のJSON形式のみでお願いします:
{"row": <行番号>, "col": <列番号>}`;

    try {
        const response = await fetch('/llm-proxy/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'openai/gpt-oss-20b',
                messages: [
                    { role: 'system', content: 'You are a helpful AI assistant.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 4096,
                temperature: 0.7,
            }),
        });

        const data = await response.json();
        const llmResponseContent = data.choices[0].message.content;
        console.log('LLM Raw Response:', llmResponseContent);

        let chosenMove = null;
        try {
            // LLMの応答からJSONを抽出してパース
            // JSON形式の文字列が完全な形で返されることを期待
            chosenMove = JSON.parse(llmResponseContent);
        } catch (parseError) {
            console.error('Failed to parse LLM response JSON directly. Attempting regex extraction:', parseError);
            // JSON以外の文字が含まれる場合を考慮し、正規表現でJSON部分を抽出
            const jsonMatch = llmResponseContent.match(/\{.*?\}/s);
            if (jsonMatch) {
                try {
                    chosenMove = JSON.parse(jsonMatch[0]);
                } catch (innerParseError) {
                    console.error('Failed to parse JSON extracted by regex:', innerParseError);
                }
            }
        }

        if (chosenMove && typeof chosenMove.row === 'number' && typeof chosenMove.col === 'number') {
            // LLMが提案した手が合法手であるか再確認
            const foundMove = validMoves.find(move => move.r === chosenMove.row && move.c === chosenMove.col);
            if (foundMove) {
                placePieceAndFlip(foundMove.r, foundMove.c, CPU_PLAYER);
            } else {
                console.warn('LLM suggested an invalid or non-existent move. Choosing a random valid move.');
                const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
                placePieceAndFlip(randomMove.r, randomMove.c, CPU_PLAYER);
            }
        } else {
            console.warn('LLM did not return a valid move format. Choosing a random valid move.');
            const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
            placePieceAndFlip(randomMove.r, randomMove.c, CPU_PLAYER);
        }

    } catch (error) {
        console.error('Error communicating with LLM:', error);
        // LLMとの通信エラー時もランダムな合法手を選ぶ
        console.warn('Falling back to random move due to LLM communication error.');
        const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        placePieceAndFlip(randomMove.r, randomMove.c, CPU_PLAYER);
    }

    switchPlayer();
}

// 有効な手かどうかを判定
function isValidMove(row, col, player) {
    if (board[row][col] !== EMPTY) {
        return false;
    }

    const opponent = (player === BLACK) ? WHITE : BLACK;
    let canFlip = false;

    // 8方向をチェック
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;

            let r = row + dr;
            let c = col + dc;
            let foundOpponent = false;

            while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === opponent) {
                r += dr;
                c += dc;
                foundOpponent = true;
            }

            if (foundOpponent && r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
                canFlip = true;
                break;
            }
        }
        if (canFlip) break;
    }
    return canFlip;
}

// 石を置いて反転させる
function placePieceAndFlip(row, col, player) {
    board[row][col] = player;
    const opponent = (player === BLACK) ? WHITE : BLACK;

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;

            let r = row + dr;
            let c = col + dc;
            const piecesToFlip = [];

            while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === opponent) {
                piecesToFlip.push({ r, c });
                r += dr;
                c += dc;
            }

            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
                piecesToFlip.forEach(p => {
                    board[p.r][p.c] = player;
                });
            }
        }
    }
}

// 有効な手があるか判定
function hasValidMove(player) {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (isValidMove(r, c, player)) {
                return true;
            }
        }
    }
    return false;
}

// ゲーム終了処理
function endGame() {
    const blackCount = countPieces(BLACK);
    const whiteCount = countPieces(WHITE);
    let winnerMessage = '';

    if (blackCount > whiteCount) {
        winnerMessage = '黒の勝ち！';
    } else if (whiteCount > blackCount) {
        winnerMessage = '白の勝ち！';
    } else {
        winnerMessage = '引き分け！';
    }
    messageElement.textContent = `ゲーム終了！ ${winnerMessage} (黒: ${blackCount}, 白: ${whiteCount})`;
    // クリックイベントを無効化するなど、ゲーム終了後の処理を追加することも可能
    boardElement.querySelectorAll('.cell').forEach(cell => {
        cell.removeEventListener('click', handleCellClick);
    });
}

// リセットボタンのイベントリスナー
resetButton.addEventListener('click', initializeGame);

// ゲーム開始
initializeGame();
