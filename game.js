// --- Firebase 初始化 ---
const firebaseConfig = {
    apiKey: "AIzaSyBG06csgn7_FxcNXIRWETZMLc7ronAq0t0",
    authDomain: "number-puzzle-295af.firebaseapp.com",
    projectId: "number-puzzle-295af",
    storageBucket: "number-puzzle-295af.firebasestorage.app",
    messagingSenderId: "583761184285",
    appId: "1:583761184285:web:ebab7ae6f0f2ff448128f4",
    measurementId: "G-G0EYYGK8E8"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- 全域變數 ---
let currentSize = 3;
let pendingSize = 3; 
let boardArr = [];
let moveCount = 0;
let tilesDOM = {};
let isGameWon = false;
let seconds = 0;
let timerId = null;
let isTimerStarted = false; 

// 開發者模式相關
let isDevMode = false;
let lastDevClickTime = 0;
let devClickCount = 0;

function getOrCreateDeviceId() {
    let deviceId = localStorage.getItem('klotski_device_id');
    if (!deviceId) {
        deviceId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem('klotski_device_id', deviceId);
    }
    return deviceId;
}
const DEVICE_ID = getOrCreateDeviceId();

// --- 介面控制 ---
function initMenu() {
    const menu = document.getElementById('menu');
    const topActions = menu.querySelector('.menu-top-actions'); 
    menu.innerHTML = '';
    menu.appendChild(topActions);

    for (let i = 3; i <= 12; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn';
        const bestTime = localStorage.getItem(`bestTime_${i}`);
        const recordDisplay = bestTime ? formatTime(parseInt(bestTime)) : "尚未挑戰";
        btn.innerHTML = `<span>${i} x ${i} 拼圖</span><span class="record-text">最佳: ${recordDisplay}</span>`;
        btn.onclick = () => startGame(i);
        menu.appendChild(btn);
    }
}

function openHelp() {
    document.getElementById('instruction-modal').style.display = 'flex';
    document.getElementById('checkbox-container').style.display = 'none'; 
    document.getElementById('modal-action-btn').textContent = '我知道了';
    document.getElementById('modal-action-btn').onclick = closeHelp; 
}

function closeHelp() {
    document.getElementById('instruction-modal').style.display = 'none';
}

function openLeaderboard() {
    const lbContainer = document.getElementById('leaderboard-container');
    lbContainer.style.display = 'flex';
    document.getElementById('menu').style.display = 'none';
    fetchLeaderboard();

    lbContainer.onpointerdown = (e) => {
        if (e.target.closest('button') || e.target.closest('select')) return; 
        const currentTime = Date.now();
        if (currentTime - lastDevClickTime < 800) {
            devClickCount++;
        } else {
            devClickCount = 1;
        }
        lastDevClickTime = currentTime;
        if (devClickCount === 3) {
            isDevMode = !isDevMode;
            alert(isDevMode ? "🛠️ 已進入開發者模式" : "🔒 已關閉開發者模式");
            devClickCount = 0;
        }
    };
}

function closeLeaderboard() {
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('leaderboard-container').style.display = 'none';
}

// --- 遊戲邏輯 ---
function startGame(size) {
    pendingSize = size;
    const skipTutorial = localStorage.getItem('klotski_skip_tutorial');
    if (skipTutorial === 'true') {
        startActualGame(size);
    } else {
        document.getElementById('checkbox-container').style.display = 'flex';
        document.getElementById('dont-show-again').checked = false;
        document.getElementById('modal-action-btn').textContent = '開始挑戰';
        document.getElementById('modal-action-btn').onclick = confirmInstruction;
        document.getElementById('instruction-modal').style.display = 'flex';
    }
}

function confirmInstruction() {
    if (document.getElementById('dont-show-again').checked) {
        localStorage.setItem('klotski_skip_tutorial', 'true');
    }
    document.getElementById('instruction-modal').style.display = 'none';
    startActualGame(pendingSize);
}

function startActualGame(size) {
    currentSize = size;
    moveCount = 0;
    seconds = 0;
    isGameWon = false;
    isTimerStarted = false; 
    
    document.getElementById('moves').textContent = moveCount;
    document.getElementById('timer').textContent = "00:00";
    const bestTime = localStorage.getItem(`bestTime_${size}`);
    document.getElementById('best-record-display').textContent = bestTime ? `歷史最佳: ${formatTime(parseInt(bestTime))}` : "歷史最佳: 無";
    document.getElementById('menu').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    
    generateBoard(size);
    initBoardDOM();
    updateDevHighlights();
}

function moveTile(num) {
    if (isGameWon) return; 
    const numIdx = boardArr.indexOf(num);
    const emptyIdx = boardArr.indexOf(0);
    const numRow = Math.floor(numIdx / currentSize);
    const numCol = numIdx % currentSize;
    const emptyRow = Math.floor(emptyIdx / currentSize);
    const emptyCol = emptyIdx % currentSize;

    if (numRow === emptyRow || numCol === emptyCol) {
        if (!isTimerStarted) {
            isTimerStarted = true;
            startTimer();
        }
        let step = (numRow === emptyRow) ? (numIdx > emptyIdx ? 1 : -1) : (numIdx > emptyIdx ? currentSize : -currentSize);
        for (let i = emptyIdx; i !== numIdx; i += step) {
            boardArr[i] = boardArr[i + step]; 
            updateTilePosition(tilesDOM[boardArr[i]], i); 
        }
        boardArr[numIdx] = 0;
        moveCount++; 
        document.getElementById('moves').textContent = moveCount;
        updateDevHighlights();
        checkWin();
    }
}

// --- 輔助功能 ---
function generateBoard(size) {
    const totalTiles = size * size;
    boardArr = Array.from({length: totalTiles - 1}, (_, i) => i + 1);
    boardArr.push(0);
    let emptyIdx = totalTiles - 1;
    for (let i = 0; i < size * size * 60; i++) {
        const neighbors = getNeighbors(emptyIdx, size);
        const randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
        [boardArr[emptyIdx], boardArr[randomNeighbor]] = [boardArr[randomNeighbor], boardArr[emptyIdx]];
        emptyIdx = randomNeighbor;
    }
}

function getNeighbors(index, size) {
    const neighbors = [];
    const row = Math.floor(index / size);
    const col = index % size;
    if (row > 0) neighbors.push(index - size);
    if (row < size - 1) neighbors.push(index + size);
    if (col > 0) neighbors.push(index - 1);
    if (col < size - 1) neighbors.push(index + 1);
    return neighbors;
}

function initBoardDOM() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    tilesDOM = {};
    let fontSize = currentSize >= 10 ? '10px' : (currentSize >= 7 ? '14px' : (currentSize >= 5 ? '18px' : '24px'));
    boardArr.forEach((num, index) => {
        if (num === 0) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'tile-wrapper';
        wrapper.style.width = `${100 / currentSize}%`;
        wrapper.style.height = `${100 / currentSize}%`;
        updateTilePosition(wrapper, index);
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.textContent = num;
        tile.style.fontSize = fontSize;
        tile.onpointerdown = (e) => { e.preventDefault(); moveTile(num); }; 
        wrapper.appendChild(tile);
        board.appendChild(wrapper);
        tilesDOM[num] = wrapper; 
    });
}

function updateTilePosition(element, index) {
    element.style.top = `${Math.floor(index / currentSize) * (100 / currentSize)}%`;
    element.style.left = `${(index % currentSize) * (100 / currentSize)}%`;
}

function updateDevHighlights() {
    Object.values(tilesDOM).forEach(wrapper => wrapper.querySelector('.tile').classList.remove('dev-highlight'));
    if (!isDevMode) return;
    let targetRow = -1;
    for (let r = 0; r < currentSize - 2; r++) {
        let isRowComplete = true;
        for (let c = 0; c < currentSize; c++) {
            if (boardArr[r * currentSize + c] !== r * currentSize + c + 1) { isRowComplete = false; break; }
        }
        if (!isRowComplete) { targetRow = r; break; }
    }
    if (targetRow !== -1) {
        for (let n = targetRow * currentSize + 1; n <= (targetRow + 1) * currentSize; n++) {
            if (tilesDOM[n]) tilesDOM[n].querySelector('.tile').classList.add('dev-highlight');
        }
        return;
    }
    let targetCol = -1;
    for (let c = 0; c < currentSize - 2; c++) {
        const idxT = (currentSize - 2) * currentSize + c, idxB = (currentSize - 1) * currentSize + c;
        if (boardArr[idxT] !== idxT + 1 || boardArr[idxB] !== idxB + 1) { targetCol = c; break; }
    }
    if (targetCol !== -1) {
        const vT = ((currentSize - 2) * currentSize + targetCol) + 1, vB = ((currentSize - 1) * currentSize + targetCol) + 1;
        if (tilesDOM[vT]) tilesDOM[vT].querySelector('.tile').classList.add('dev-highlight');
        if (tilesDOM[vB]) tilesDOM[vB].querySelector('.tile').classList.add('dev-highlight');
    }
}

function checkWin() {
    if (boardArr.every((num, idx) => idx === boardArr.length - 1 ? num === 0 : num === idx + 1)) {
        isGameWon = true; stopTimer();
        const best = localStorage.getItem(`bestTime_${currentSize}`);
        if (!best || seconds < parseInt(best)) {
            localStorage.setItem(`bestTime_${currentSize}`, seconds); 
            setTimeout(() => {
                let name = prompt(`🎉 破紀錄！時間：${formatTime(seconds)}\n請輸入大名：`, "匿名玩家");
                saveToCloud(name?.trim() || "匿名玩家", seconds, moveCount);
            }, 150);
        } else {
            setTimeout(() => { alert(`恭喜！時間：${formatTime(seconds)}`); exitGame(); }, 150);
        }
    }
}

// --- 資料傳輸與計時 ---
function formatTime(s) { return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`; }
function startTimer() { if (timerId) clearInterval(timerId); timerId = setInterval(() => { seconds++; document.getElementById('timer').textContent = formatTime(seconds); }, 1000); }
function stopTimer() { clearInterval(timerId); timerId = null; }
function exitGame() { stopTimer(); initMenu(); document.getElementById('menu').style.display = 'flex'; document.getElementById('game-container').style.display = 'none'; }

function saveToCloud(name, time, moves) {
    // 判斷是否為腳本 (神仙)：時間為 0 (防呆) 或 每秒大於 10 步
    let collectionName = `records_${currentSize}`;
    let alertMsg = "已上傳排行榜！";
    
    if (time <= 0 || (moves / time) > 10) {
        collectionName = `god_records_${currentSize}`;
        alertMsg = "速度驚人！已上傳神仙榜！";
    }

    db.collection(collectionName).doc(DEVICE_ID).set({ name, time, moves, timestamp: firebase.firestore.FieldValue.serverTimestamp() })
      .then(() => { alert(alertMsg); exitGame(); });
}

function fetchLeaderboard() {
    const size = document.getElementById('lb-size-select').value;
    
    // 取得當前選擇的排行榜類型 (一般 or 神仙)
    const typeSelect = document.getElementById('lb-type-select');
    const isGodMode = typeSelect ? typeSelect.value === 'god' : false;
    const collectionName = isGodMode ? `god_records_${size}` : `records_${size}`;

    const content = document.getElementById('lb-content');
    content.innerHTML = '<li>載入中...</li>';
    db.collection(collectionName).orderBy("time", "asc").get().then((snap) => {
        content.innerHTML = snap.empty ? '<li>尚無紀錄</li>' : '';
        let r = 1; snap.forEach((doc) => {
            const d = doc.data();
            // 在這裡補上了 (${d.moves}步)
            content.innerHTML += `<li class="lb-item"><span class="lb-rank">#${r++}</span><span class="lb-name">${d.name}</span><span class="lb-score">${formatTime(d.time)} (${d.moves}步)</span></li>`;
        });
    });
}
window.onload = initMenu;