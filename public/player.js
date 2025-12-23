// Player Interface Controller - New Card Selection System
let playerState = {
    selectionMode: 'serie', // 'serie' or 'cards'
    selectedSerie: null,
    selectedCards: [],
    cards: [],
    drawnNumbers: new Set(),
    cost: 0,
    availableSeries: [],
    availableCards: [],
    manualMode: false,
    manualMarks: {} // cardIndex -> Set of manually marked numbers
};

// Request available cards when player screen loads
function requestAvailability() {
    socket.emit('player:request-availability');
}

// Update availability
socket.on('cards:availability', ({ availableSeries, availableCards }) => {
    playerState.availableSeries = availableSeries;
    playerState.availableCards = availableCards;

    updateSerieOptions();
    updateCardsGrid();
});

// Listen for cost updates from admin
socket.on('cost:updated', ({ cost }) => {
    playerState.cost = cost;
    updateCostPreview();
});

function updateCostPreview() {
    const preview = document.getElementById('costPreview');
    const count = playerState.selectionMode === 'serie' ? 6 : playerState.selectedCards.length;

    if (playerState.cost > 0 && count > 0) {
        const total = (playerState.cost * count).toFixed(2);
        preview.textContent = `€${total} (${count} × €${playerState.cost.toFixed(2)})`;
    } else if (count > 0) {
        preview.textContent = `${count} ${count === 1 ? 'cartella' : 'cartelle'}`;
    } else {
        preview.textContent = '-';
    }
}

// Mode selection
document.getElementById('selectSerieBtn').addEventListener('click', () => {
    playerState.selectionMode = 'serie';
    document.getElementById('selectSerieBtn').classList.add('active');
    document.getElementById('selectCardsBtn').classList.remove('active');
    document.getElementById('serieMode').classList.remove('hidden');
    document.getElementById('cardsMode').classList.add('hidden');
    updateCostPreview();
});

document.getElementById('selectCardsBtn').addEventListener('click', () => {
    playerState.selectionMode = 'cards';
    document.getElementById('selectCardsBtn').classList.add('active');
    document.getElementById('selectSerieBtn').classList.remove('active');
    document.getElementById('cardsMode').classList.remove('hidden');
    document.getElementById('serieMode').classList.add('hidden');
    updateCostPreview();
});

// Update serie dropdown options
function updateSerieOptions() {
    const select = document.getElementById('serieSelect');
    select.innerHTML = '';

    if (playerState.availableSeries.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'Nessuna serie disponibile';
        option.disabled = true;
        select.appendChild(option);
        return;
    }

    playerState.availableSeries.forEach(serieNum => {
        const option = document.createElement('option');
        option.value = serieNum;
        const startCard = (serieNum - 1) * 6 + 1;
        const endCard = serieNum * 6;
        option.textContent = `Serie ${serieNum} (Cartelle ${startCard}-${endCard})`;
        select.appendChild(option);
    });

    playerState.selectedSerie = playerState.availableSeries[0] || null;
}

// Serie selection change
document.getElementById('serieSelect').addEventListener('change', (e) => {
    playerState.selectedSerie = parseInt(e.target.value);
    updateCostPreview();
});

// Update cards grid for individual selection
function updateCardsGrid() {
    const grid = document.getElementById('cardsGrid');
    grid.innerHTML = '';

    for (let cardId = 1; cardId <= 90; cardId++) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card-option';
        cardDiv.textContent = cardId;
        cardDiv.dataset.cardId = cardId;

        if (!playerState.availableCards.includes(cardId)) {
            cardDiv.classList.add('disabled');
        } else {
            cardDiv.addEventListener('click', () => toggleCardSelection(cardId));
        }

        if (playerState.selectedCards.includes(cardId)) {
            cardDiv.classList.add('selected');
        }

        grid.appendChild(cardDiv);
    }
}

function toggleCardSelection(cardId) {
    const index = playerState.selectedCards.indexOf(cardId);

    if (index > -1) {
        // Deselect
        playerState.selectedCards.splice(index, 1);
    } else {
        // Select (max 6)
        if (playerState.selectedCards.length >= 6) {
            alert('Puoi selezionare massimo 6 cartelle!');
            return;
        }
        playerState.selectedCards.push(cardId);
    }

    playerState.selectedCards.sort((a, b) => a - b);
    updateCardsGrid();
    updateSelectedCount();
    updateCostPreview();
}

function updateSelectedCount() {
    document.getElementById('selectedCount').textContent = playerState.selectedCards.length;
}

// Confirm cards selection
document.getElementById('confirmCardsBtn').addEventListener('click', () => {
    let selectionType, selection;

    if (playerState.selectionMode === 'serie') {
        if (!playerState.selectedSerie) {
            alert('Seleziona una serie!');
            return;
        }
        selectionType = 'serie';
        selection = playerState.selectedSerie;
    } else {
        if (playerState.selectedCards.length === 0) {
            alert('Seleziona almeno una cartella!');
            return;
        }
        selectionType = 'cards';
        selection = playerState.selectedCards;
    }

    // Get session ID
    const sessionId = sessionStorage.getItem('tombola_session_id') ||
        'session_' + Date.now() + '_' + Math.random();
    sessionStorage.setItem('tombola_session_id', sessionId);

    // Join game
    socket.emit('player:join', {
        nickname,
        selectionType,
        selection,
        sessionId
    });
});

// Join success
socket.on('join:success', ({ cardIds, cardCount }) => {
    // Update UI
    const cardsText = cardIds.length === 6
        ? `Serie completa (Cartelle ${cardIds[0]}-${cardIds[5]})`
        : `Cartelle: ${cardIds.join(', ')}`;

    document.getElementById('chosenCards').textContent = cardsText;

    // Switch to waiting phase
    showPhase('playerWaiting');

    showNotification('✅ Cartelle assegnate! Attendi l\'inizio della partita...', 'success');
});

// Join error
socket.on('join:error', ({ message }) => {
    alert(message);
    // Refresh availability
    requestAvailability();
});

// Game started - receive cards
socket.on('game:started', ({ cards, cardIds, prizes }) => {
    console.log('Game started! Received cards:', cards);
    playerState.cards = cards;

    // Switch to game phase
    showPhase('playerGame');

    // Render cards
    renderPlayerCards(cardIds);

    // Show first win button (ambo)
    updateWinButton();

    showNotification('🎲 Partita iniziata! Buona fortuna!', 'success');
});

function renderPlayerCards(cardIds) {
    const cardsContainer = document.getElementById('playerCards');
    cardsContainer.innerHTML = '';

    playerState.cards.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';

        const cardTitle = document.createElement('div');
        cardTitle.className = 'card-title';
        cardTitle.textContent = `Cartella ${cardIds[index]}`;

        const cardGrid = document.createElement('div');
        cardGrid.className = 'card-grid';

        // Render 3 rows × 9 columns
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 9; col++) {
                const cell = document.createElement('div');
                const number = card[row][col];

                if (number === null) {
                    cell.className = 'card-cell empty';
                } else {
                    cell.className = 'card-cell';
                    cell.textContent = number;
                    cell.dataset.number = number;
                    cell.dataset.cardIndex = index;

                    // Check if already marked (drawn or manual)
                    const isDrawn = playerState.drawnNumbers.has(number);
                    const isManual = playerState.manualMarks[index]?.has(number);

                    if (isDrawn || isManual) {
                        cell.classList.add('marked');
                    }

                    // Add click handler for manual mode
                    cell.addEventListener('click', () => {
                        if (!playerState.manualMode) return;
                        if (playerState.drawnNumbers.has(number)) return; // Can't unmark drawn numbers

                        // Initialize manual marks for this card if needed
                        if (!playerState.manualMarks[index]) {
                            playerState.manualMarks[index] = new Set();
                        }

                        // Toggle manual mark
                        if (playerState.manualMarks[index].has(number)) {
                            playerState.manualMarks[index].delete(number);
                            cell.classList.remove('marked');
                        } else {
                            playerState.manualMarks[index].add(number);
                            cell.classList.add('marked');
                        }

                        saveManualMarks();
                    });
                }

                cardGrid.appendChild(cell);
            }
        }

        cardDiv.appendChild(cardTitle);
        cardDiv.appendChild(cardGrid);
        cardsContainer.appendChild(cardDiv);
    });
}

// Manual mode toggle
const manualModeCheckbox = document.getElementById('manualModeCheckbox');
if (manualModeCheckbox) {
    manualModeCheckbox.addEventListener('change', (e) => {
        playerState.manualMode = e.target.checked;
        const cardsContainer = document.getElementById('playerCards');

        if (playerState.manualMode) {
            cardsContainer.classList.add('manual-mode');
            // Load saved manual marks from sessionStorage
            const saved = sessionStorage.getItem('manual_marks');
            if (saved) {
                try {
                    const data = JSON.parse(saved);
                    playerState.manualMarks = {};
                    for (const [key, value] of Object.entries(data)) {
                        playerState.manualMarks[key] = new Set(value);
                    }
                    updateManualMarks();
                } catch (e) {
                    console.error('Error loading manual marks:', e);
                }
            }
        } else {
            cardsContainer.classList.remove('manual-mode');
        }
    });
}

function updateManualMarks() {
    // Apply manual marks to cards
    for (const [cardIndex, marks] of Object.entries(playerState.manualMarks)) {
        marks.forEach(number => {
            const cells = document.querySelectorAll(`.card-cell[data-number="${number}"][data-card-index="${cardIndex}"]`);
            cells.forEach(cell => {
                if (!playerState.drawnNumbers.has(number)) {
                    cell.classList.add('marked');
                }
            });
        });
    }
}

function saveManualMarks() {
    // Convert Sets to Arrays for JSON storage
    const data = {};
    for (const [key, value] of Object.entries(playerState.manualMarks)) {
        data[key] = Array.from(value);
    }
    sessionStorage.setItem('manual_marks', JSON.stringify(data));
}

// Number drawn - update cards
socket.on('game:number-drawn', ({ number, total }) => {
    console.log('Number drawn:', number);

    playerState.drawnNumbers.add(number);

    // Update current number display
    document.getElementById('currentNumber').textContent = number;

    // Only mark automatically if manual mode is OFF
    if (!playerState.manualMode) {
        // Mark number on all cards
        document.querySelectorAll(`.card-cell[data-number="${number}"]`).forEach(cell => {
            cell.classList.add('marked');
            cell.style.animation = 'popNumber 0.5s ease';
        });
    }

    // Update history
    updateNumberHistory(number);
});

function updateNumberHistory(number) {
    const historyList = document.getElementById('historyList');

    const historyItem = document.createElement('div');
    historyItem.className = 'history-number';
    historyItem.textContent = number;

    // Add to beginning
    historyList.insertBefore(historyItem, historyList.firstChild);

    // Keep only last 20 numbers
    while (historyList.children.length > 20) {
        historyList.removeChild(historyList.lastChild);
    }
}

// Progressive win tracking
const winProgression = ['ambo', 'terno', 'quaterna', 'cinquina', 'tombola'];
const winIcons = {
    ambo: '🎯',
    terno: '🎲',
    quaterna: '🎰',
    cinquina: '⭐',
    tombola: '🏆'
};
let currentWinIndex = 0;
let claimedWins = new Set();

function updateWinButton() {
    const btn = document.getElementById('declareWinBtn');
    const icon = document.getElementById('winIcon');
    const label = document.getElementById('winLabel');

    // Find next unclaimed win
    while (currentWinIndex < winProgression.length) {
        const winType = winProgression[currentWinIndex];
        if (!claimedWins.has(winType)) {
            // Show button for this win type
            btn.dataset.type = winType;
            icon.textContent = winIcons[winType];
            label.textContent = winType.toUpperCase();
            btn.classList.remove('hidden');
            return;
        }
        currentWinIndex++;
    }

    // All wins claimed, hide button
    btn.classList.add('hidden');
}

// Single win button click handler
document.getElementById('declareWinBtn').addEventListener('click', function () {
    const type = this.dataset.type;

    if (!confirm(`Vuoi dichiarare ${type.toUpperCase()}?`)) {
        return;
    }

    socket.emit('player:declare-win', { type });
    showNotification(`📢 Hai dichiarato ${type.toUpperCase()}! Attendi la validazione...`, 'info');
});

// Win already claimed
socket.on('win:already-claimed', ({ type }) => {
    alert(`Il premio ${type.toUpperCase()} è già stato vinto da qualcun altro!`);
    claimedWins.add(type);
    updateWinButton();
});

// Win declared successfully
socket.on('win:declared', ({ type }) => {
    showNotification(`✅ Vincita ${type.toUpperCase()} dichiarata! Attendi validazione...`, 'success');
});

// Win invalid
socket.on('win:invalid', ({ type }) => {
    alert(`❌ La tua dichiarazione di ${type.toUpperCase()} non è valida!`);
});

// Win confirmed - move to next win type
socket.on('win:confirmed', ({ nickname, type, prize }) => {
    claimedWins.add(type);
    if (currentWinIndex < winProgression.length && winProgression[currentWinIndex] === type) {
        currentWinIndex++;
    }
    updateWinButton();
});

// Game restore (reconnection)
socket.on('game:restore', ({ cards, cardIds, drawnNumbers, gameStarted, winners }) => {
    console.log('Restoring game state...', { cardIds, drawnNumbers });

    if (gameStarted && cards && cards.length > 0) {
        playerState.cards = cards;
        playerState.drawnNumbers = new Set(drawnNumbers);

        // Update claimed wins
        for (const [winType, winner] of Object.entries(winners)) {
            if (winner) {
                claimedWins.add(winType);
            }
        }

        // Switch to game phase
        showPhase('playerGame');

        // Render cards
        renderPlayerCards(cardIds);

        // Update win button
        updateWinButton();

        // Update current number display
        if (drawnNumbers.length > 0) {
            const lastNumber = drawnNumbers[drawnNumbers.length - 1];
            document.getElementById('currentNumber').textContent = lastNumber;
        }

        showNotification('✅ Riconnesso alla partita in corso!', 'success');
    }
});

// Initialize: request availability when component loads
if (typeof window !== 'undefined') {
    setTimeout(() => {
        if (currentRole === 'player') {
            requestAvailability();
        }
    }, 100);
}
