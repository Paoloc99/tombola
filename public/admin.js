// Admin Interface Controller
let adminState = {
    cost: 0,
    players: [],
    prizes: {},
    gameStarted: false
};

// Admin joined confirmation
socket.on('admin:joined', ({ players, serverUrl }) => {
    console.log('Admin joined successfully');
    adminState.players = players;
    updatePlayersList();

    // Generate QR Code with server URL
    generateQRCode(serverUrl);
});

function generateQRCode(serverUrl) {
    const img = document.getElementById('qrcodeImage');
    const urlElement = document.getElementById('qrUrl');

    // Usa l'URL del server ricevuto, o fallback a window.location se non disponibile
    const url = serverUrl || window.location.origin;
    urlElement.textContent = url;

    // Generate QR code using API (simple and no library needed)
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    img.src = qrApiUrl;
    img.alt = 'Scansiona per collegarti';
}

// Lobby updates
socket.on('lobby:update', ({ players }) => {
    console.log('Lobby updated:', players);
    adminState.players = players;
    updatePlayersList();

    // Enable calculate button if we have players and cost
    const costInput = document.getElementById('costInput');
    const calculateBtn = document.getElementById('calculatePrizesBtn');
    if (players.length > 0 && costInput.value > 0) {
        calculateBtn.disabled = false;
    }
});

function updatePlayersList() {
    const playersList = document.getElementById('playersList');
    const playerCount = document.getElementById('playerCount');

    playerCount.textContent = adminState.players.length;

    if (adminState.players.length === 0) {
        playersList.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,0.5);padding:20px;">Nessun giocatore connesso</p>';
        return;
    }

    playersList.innerHTML = adminState.players.map(player => {
        const cardsInfo = player.selectionType === 'serie'
            ? `Serie ${player.selection} (6 cartelle)`
            : `${player.cardCount} ${player.cardCount === 1 ? 'cartella' : 'cartelle'}`;
        const cardIds = player.cardIds ? `[${player.cardIds.join(', ')}]` : '';

        return `
      <div class="player-item">
        <span class="player-name-col">👤 ${player.nickname}</span>
        <span class="player-info-col">${cardsInfo} ${cardIds}</span>
      </div>
    `}).join('');
}

// Cost input handler
document.getElementById('costInput').addEventListener('input', (e) => {
    adminState.cost = parseFloat(e.target.value) || 0;
    socket.emit('admin:set-cost', { cost: adminState.cost });

    // Enable calculate button if we have players
    const calculateBtn = document.getElementById('calculatePrizesBtn');
    if (adminState.players.length > 0 && adminState.cost > 0) {
        calculateBtn.disabled = false;
    }
});

// Calculate prizes
document.getElementById('calculatePrizesBtn').addEventListener('click', () => {
    if (adminState.cost <= 0) {
        alert('Inserisci il costo per cartella!');
        return;
    }

    socket.emit('admin:calculate-prizes');
});

// Prizes calculated
socket.on('prizes:calculated', ({ totalCards, totalPot, prizes }) => {
    console.log('Prizes calculated:', prizes);
    adminState.prizes = prizes;

    // Update UI
    document.getElementById('totalPot').textContent = `€${totalPot.toFixed(2)}`;
    document.getElementById('prizeAmbo').textContent = `€${prizes.ambo.toFixed(2)}`;
    document.getElementById('prizeTerno').textContent = `€${prizes.terno.toFixed(2)}`;
    document.getElementById('prizeQuaterna').textContent = `€${prizes.quaterna.toFixed(2)}`;
    document.getElementById('prizeCinquina').textContent = `€${prizes.cinquina.toFixed(2)}`;
    document.getElementById('prizeTombola').textContent = `€${prizes.tombola.toFixed(2)}`;

    // Show prizes display
    document.getElementById('prizesDisplay').classList.remove('hidden');

    // Enable start button
    document.getElementById('startGameBtn').disabled = false;
});

// Prize adjustment handlers
document.querySelectorAll('.adjust-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const amount = parseFloat(btn.dataset.amount);

        socket.emit('admin:adjust-prize', { type, amount });
    });
});

// Prizes updated
socket.on('prizes:updated', ({ prizes }) => {
    adminState.prizes = prizes;

    // Update UI
    document.getElementById('prizeAmbo').textContent = `€${prizes.ambo.toFixed(2)}`;
    document.getElementById('prizeTerno').textContent = `€${prizes.terno.toFixed(2)}`;
    document.getElementById('prizeQuaterna').textContent = `€${prizes.quaterna.toFixed(2)}`;
    document.getElementById('prizeCinquina').textContent = `€${prizes.cinquina.toFixed(2)}`;
    document.getElementById('prizeTombola').textContent = `€${prizes.tombola.toFixed(2)}`;
});

// Start game
document.getElementById('startGameBtn').addEventListener('click', () => {
    if (!confirm('Vuoi avviare la partita? Non potrai più modificare i premi.')) {
        return;
    }

    socket.emit('admin:start-game');
});

// Game started
socket.on('game:started-admin', ({ totalPlayers }) => {
    adminState.gameStarted = true;

    showPhase('adminGame');

    // Initialize tombola board
    initializeTombolaBoard();

    showNotification(`🎲 Partita avviata con ${totalPlayers} ${totalPlayers === 1 ? 'giocatore' : 'giocatori'}!`, 'success');
});

// Initialize tombola board (90 numbers)
function initializeTombolaBoard() {
    const board = document.getElementById('tombolaBoard');
    board.innerHTML = '';

    for (let i = 1; i <= 90; i++) {
        const cell = document.createElement('div');
        cell.className = 'board-number';
        cell.textContent = i;
        cell.dataset.number = i;
        board.appendChild(cell);
    }
}

// Draw number
document.getElementById('drawNumberBtn').addEventListener('click', () => {
    socket.emit('admin:draw-number');
});

// Number drawn
socket.on('game:number-drawn', ({ number, total }) => {
    console.log('Number drawn:', number);

    // Update board
    const cell = document.querySelector(`.board-number[data-number="${number}"]`);
    if (cell) {
        cell.classList.add('drawn');
    }

    // Update info
    document.getElementById('numbersDrawn').textContent = `${total}/90`;
    document.getElementById('lastNumber').textContent = number;

    // Play sound (optional - would need audio file)
    // new Audio('/sounds/number-draw.mp3').play();
});

// No numbers left
socket.on('game:no-numbers-left', () => {
    alert('Tutti i 90 numeri sono stati estratti!');
    document.getElementById('drawNumberBtn').disabled = true;
});

// Win declared by player
socket.on('admin:win-declared', ({ nickname, type, cards, drawnNumbers }) => {
    console.log(`Win declared by ${nickname}:`, type);

    // Play notification sound (optional - would need audio file)
    // new Audio('/sounds/win-notification.mp3').play();

    // Show win notification with validation controls
    const notification = document.createElement('div');
    notification.className = 'win-alert';
    notification.innerHTML = `
    <div class="win-alert-text">
      <strong>🔔 ${nickname}</strong> ha dichiarato <strong>${type.toUpperCase()}</strong>!
    </div>
    <div class="win-alert-buttons">
      <button class="validate-btn" onclick="validateWin('${nickname}', '${type}', true)">✓ Valida</button>
      <button class="reject-btn" onclick="validateWin('${nickname}', '${type}', false)">✗ Rifiuta</button>
    </div>
  `;

    document.getElementById('winNotifications').appendChild(notification);
});

// Validate win function (global scope for onclick)
window.validateWin = function (nickname, type, valid) {
    socket.emit('admin:validate-win', { nickname, type, valid });

    // Remove notification
    const notifications = document.getElementById('winNotifications');
    notifications.innerHTML = '';
};

// Reset game button
document.getElementById('resetGameBtn').addEventListener('click', () => {
    if (!confirm('Vuoi resettare la partita? Tutti i giocatori dovranno riconnettersi e la partita ricomincer à da zero.')) {
        return;
    }

    socket.emit('admin:reset-game');

    // Reload admin page
    setTimeout(() => {
        location.reload();
    }, 500);
});

// Admin game restore (reconnection)
socket.on('admin:game-restore', ({ gameStarted, drawnNumbers, players, prizes, serverUrl }) => {
    console.log('Restoring admin game state...', { gameStarted, drawnNumbers: drawnNumbers.length });

    if (gameStarted) {
        adminState.gameStarted = true;
        adminState.prizes = prizes;

        // Switch to game phase
        showPhase('adminGame');

        // Initialize board
        initializeTombolaBoard();

        // Mark already drawn numbers
        drawnNumbers.forEach(number => {
            const cell = document.querySelector(`.board-number[data-number="${number}"]`);
            if (cell) {
                cell.classList.add('drawn');
            }
        });

        // Update info
        document.getElementById('numbersDrawn').textContent = `${drawnNumbers.length}/90`;
        if (drawnNumbers.length > 0) {
            document.getElementById('lastNumber').textContent = drawnNumbers[drawnNumbers.length - 1];
        }

        showNotification('✅ Riconnesso alla partita in corso!', 'success');
    } else {
        // Game not started yet, show players list
        adminState.players = players;
        updatePlayersList();
    }
    
    // Rigenera il QR code se serverUrl è disponibile
    if (serverUrl) {
        generateQRCode(serverUrl);
    }
});

// Reset button during game
const resetBtnDuringGame = document.getElementById('resetGameBtnDuringGame');
if (resetBtnDuringGame) {
    resetBtnDuringGame.addEventListener('click', () => {
        if (!confirm('Vuoi resettare la partita? Tutti i giocatori dovranno riconnettersi e la partita ricomincerà da zero.')) {
            return;
        }

        socket.emit('admin:reset-game');

        // Reload admin page
        setTimeout(() => {
            location.reload();
        }, 500);
    });
}
