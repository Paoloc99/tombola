// Main App Controller
const socket = io();

// Session management
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getOrCreateSessionId() {
    let sessionId = sessionStorage.getItem('tombola_session_id');
    if (!sessionId) {
        sessionId = generateUUID();
        sessionStorage.setItem('tombola_session_id', sessionId);
    }
    return sessionId;
}

// Screen management
const screens = {
    login: document.getElementById('loginScreen'),
    admin: document.getElementById('adminScreen'),
    player: document.getElementById('playerScreen')
};

// State
let currentRole = null;
let nickname = null;

// Check for saved nickname
window.addEventListener('DOMContentLoaded', () => {
    const savedNickname = localStorage.getItem('tombola_nickname');
    if (savedNickname) {
        document.getElementById('nicknameInput').value = savedNickname;
    }
});

// Login handlers
document.getElementById('adminBtn').addEventListener('click', () => {
    const nicknameInput = document.getElementById('nicknameInput');
    nickname = nicknameInput.value.trim();

    if (!nickname) {
        alert('Inserisci un nickname!');
        nicknameInput.focus();
        return;
    }

    // Save nickname
    localStorage.setItem('tombola_nickname', nickname);

    currentRole = 'admin';
    switchScreen('admin');

    // Update UI
    document.getElementById('adminNickname').textContent = nickname;

    // Get or create admin session ID
    const adminSessionId = getOrCreateSessionId();

    // Try to reconnect as admin
    socket.emit('admin:reconnect', { sessionId: adminSessionId, nickname });

    // Join as admin (will be handled by server based on existing session)
    socket.emit('admin:join');
});

document.getElementById('playerBtn').addEventListener('click', () => {
    const nicknameInput = document.getElementById('nicknameInput');
    nickname = nicknameInput.value.trim();

    if (!nickname) {
        alert('Inserisci un nickname!');
        nicknameInput.focus();
        return;
    }

    // Save nickname
    localStorage.setItem('tombola_nickname', nickname);

    currentRole = 'player';
    switchScreen('player');

    // Update UI
    document.getElementById('playerNickname').textContent = nickname;

    // Try to reconnect with session ID
    const sessionId = getOrCreateSessionId();
    socket.emit('player:reconnect', { sessionId, nickname });

    // Request available cards immediately
    socket.emit('player:request-availability');
});

// Game reset handler
socket.on('game:reset', () => {
    sessionStorage.clear();
    localStorage.removeItem('tombola_nickname');
    alert('🔄 La partita è stata resettata dall\'admin. Ricaricamento in corso...');
    setTimeout(() => {
        location.reload();
    }, 1000);
});

function switchScreen(screenName) {
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
    });
    screens[screenName].classList.add('active');
}

function showPhase(phaseId) {
    const parent = phaseId.startsWith('admin') ? screens.admin : screens.player;
    const phases = parent.querySelectorAll('.phase');
    phases.forEach(phase => phase.classList.add('hidden'));
    document.getElementById(phaseId).classList.remove('hidden');
}

// Global notification handler for wins
socket.on('win:confirmed', ({ nickname, type, prize }) => {
    const message = `🏆 ${nickname} ha vinto ${type.toUpperCase()}! Premio: €${prize.toFixed(2)}`;

    if (currentRole === 'admin') {
        showNotification(message, 'success');
    } else if (currentRole === 'player') {
        showNotification(message, 'success');
    }
});

socket.on('win:rejected', ({ nickname, type }) => {
    const message = `❌ Vincita di ${nickname} (${type}) non valida`;
    showNotification(message, 'error');
});

function showNotification(message, type = 'info') {
    // Simple notification system
    const notification = document.createElement('div');
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${type === 'success' ? '#11998e' : type === 'error' ? '#f5576c' : '#667eea'};
    color: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: slideInRight 0.5s ease;
    max-width: 300px;
    font-weight: 600;
  `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.5s ease';
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}
