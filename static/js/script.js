// ══════════════════════════════════════════
//  WassupChat — WhatsApp Style Client
// ══════════════════════════════════════════

const socket = io();

// ── STATE ─────────────────────────────────
let me          = '';        // current username
let currentRoom = null;      // active room
let typingTimer = null;
let isTyping    = false;
let unread      = {};        // { room: count }
let lastMsg     = {};        // { room: { text, time } }
let lastSender  = {};        // track consecutive messages

// ── ROOMS (like WhatsApp contacts) ────────
const ROOMS = [
    { id: 'general', name: 'General',  icon: '💬', color: '#00a884' },
    { id: 'tech',    name: 'Tech Hub', icon: '⚙️', color: '#53bdeb' },
    { id: 'random',  name: 'Random',   icon: '🎲', color: '#f0b429' },
    { id: 'sports',  name: 'Sports',   icon: '⚽', color: '#e06c75' },
    { id: 'music',   name: 'Music',    icon: '🎵', color: '#c678dd' },
];

// ── DOM REFS ──────────────────────────────
const joinScreen    = document.getElementById('join-screen');
const app           = document.getElementById('app');
const usernameInput = document.getElementById('username-input');
const joinBtn       = document.getElementById('join-btn');
const myAvatar      = document.getElementById('my-avatar');
const chatList      = document.getElementById('chat-list');
const searchInput   = document.getElementById('search-input');
const emptyState    = document.getElementById('empty-state');
const conversation  = document.getElementById('conversation');
const chatAvatar    = document.getElementById('chat-avatar');
const chatName      = document.getElementById('chat-name');
const chatStatus    = document.getElementById('chat-status');
const messagesWrap  = document.getElementById('messages');
const typingBar     = document.getElementById('typing-bar');
const typingText    = document.getElementById('typing-text');
const messageInput  = document.getElementById('message-input');
const sendBtn       = document.getElementById('send-btn');

// ── HELPERS ───────────────────────────────
const COLORS = ['#00a884','#53bdeb','#f0b429','#e06c75','#c678dd','#56b6c2','#e5c07b'];

function avatarColor(name) {
    let h = 0;
    for (let c of name) h = c.charCodeAt(0) + ((h << 5) - h);
    return COLORS[Math.abs(h) % COLORS.length];
}

function initial(name) { return name.trim().charAt(0).toUpperCase(); }

function timeNow() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function todayLabel() {
    return new Date().toLocaleDateString([], { weekday:'long', month:'short', day:'numeric' });
}

function escapeHTML(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function scrollBottom(smooth = true) {
    messagesWrap.scrollTo({ top: messagesWrap.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

// ── ROOM INFO ─────────────────────────────
function getRoom(id) { return ROOMS.find(r => r.id === id) || { id, name: id, icon: '💬', color: '#00a884' }; }

// ── JOIN ──────────────────────────────────
joinBtn.addEventListener('click', doJoin);
usernameInput.addEventListener('keypress', e => { if (e.key === 'Enter') doJoin(); });

function doJoin() {
    const name = usernameInput.value.trim();
    if (!name) { usernameInput.focus(); shake(usernameInput); return; }
    me = name;

    // My avatar
    myAvatar.textContent        = initial(me);
    myAvatar.style.background   = avatarColor(me);

    // Init unread
    ROOMS.forEach(r => { unread[r.id] = 0; lastMsg[r.id] = { text: 'Tap to open chat', time: '' }; });

    joinScreen.classList.add('hidden');
    app.classList.remove('hidden');

    buildChatList();
    openRoom('general');
}

function shake(el) {
    el.style.animation = 'none';
    el.style.borderColor = '#e06c75';
    setTimeout(() => el.style.borderColor = '', 600);
}

// ── BUILD CHAT LIST ───────────────────────
function buildChatList(filter = '') {
    chatList.innerHTML = '';

    // Add today divider
    const div = document.createElement('div');
    div.style.cssText = 'padding:6px 16px;font-size:0.72rem;color:#8696a0;background:#1a2428;';
    div.textContent = 'CHANNELS';
    chatList.appendChild(div);

    ROOMS.filter(r => r.name.toLowerCase().includes(filter.toLowerCase()))
         .forEach(r => chatList.appendChild(makeChatItem(r)));
}

function makeChatItem(room) {
    const el = document.createElement('div');
    el.className = 'chat-item';
    el.id = `ci-${room.id}`;
    if (room.id === currentRoom) el.classList.add('active');

    const lm = lastMsg[room.id] || { text: 'Tap to open chat', time: '' };
    const ub = unread[room.id] || 0;

    el.innerHTML = `
        <div class="ci-avatar" style="background:${room.color}">
            ${room.icon}
            <span class="online-dot"></span>
        </div>
        <div class="ci-content">
            <div class="ci-top">
                <span class="ci-name">${room.name}</span>
                <span class="ci-time${ub > 0 ? ' unread' : ''}">${lm.time}</span>
            </div>
            <div class="ci-bottom">
                <span class="ci-preview">${escapeHTML(lm.text)}</span>
                ${ub > 0 ? `<span class="ci-badge">${ub}</span>` : ''}
            </div>
        </div>`;

    el.addEventListener('click', () => openRoom(room.id));
    return el;
}

function refreshChatItem(roomId) {
    const old = document.getElementById(`ci-${roomId}`);
    if (old) old.replaceWith(makeChatItem(getRoom(roomId)));
    // Re-mark active
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
    const active = document.getElementById(`ci-${currentRoom}`);
    if (active) active.classList.add('active');
}

// ── SEARCH ────────────────────────────────
searchInput.addEventListener('input', () => buildChatList(searchInput.value));

// ── OPEN ROOM ─────────────────────────────
function openRoom(roomId) {
    // Leave old room
    if (currentRoom && currentRoom !== roomId) {
        socket.emit('leave', { username: me, room: currentRoom });
    }

    currentRoom = roomId;
    const room = getRoom(roomId);

    // Update right panel header
    chatAvatar.textContent      = room.icon;
    chatAvatar.style.background = room.color;
    chatName.textContent        = `# ${room.name}`;
    chatStatus.textContent      = 'online · cloud synced ☁';

    // Clear + show conversation
    messagesWrap.innerHTML = `
        <div class="date-divider"><span>${todayLabel()}</span></div>`;
    emptyState.classList.add('hidden');
    conversation.classList.remove('hidden');

    // Reset unread + update input placeholder
    unread[currentRoom] = 0;
    messageInput.placeholder = `Message #${room.name}...`;
    lastSender[currentRoom] = null;

    // Sidebar active state
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
    const ci = document.getElementById(`ci-${roomId}`);
    if (ci) ci.classList.add('active');

    // Mobile: show chat panel
    app.classList.add('chat-open');

    // Join socket room + load history
    socket.emit('join', { username: me, room: roomId });
    loadHistory(roomId);
    messageInput.focus();
}

// ── HISTORY ───────────────────────────────
async function loadHistory(room) {
    try {
        const res  = await fetch(`/history/${room}`);
        const data = await res.json();
        data.messages.forEach(m => renderBubble(m, false));
        scrollBottom(false);
    } catch(e) { console.error('History error', e); }
}

// ── SEND ──────────────────────────────────
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentRoom) return;
    socket.emit('message', { username: me, room: currentRoom, content: text });
    messageInput.value = '';
    isTyping = false;
    clearTimeout(typingTimer);
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });

// Typing events
messageInput.addEventListener('input', () => {
    if (!isTyping && currentRoom) {
        isTyping = true;
        socket.emit('typing', { username: me, room: currentRoom });
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { isTyping = false; }, 2500);
});

// ── SOCKET EVENTS ─────────────────────────
socket.on('message', payload => {
    // Update last message for sidebar
    lastMsg[payload.room] = {
        text: (payload.username === me ? 'You: ' : `${payload.username}: `) + payload.content,
        time: payload.timestamp || timeNow()
    };

    if (payload.room === currentRoom) {
        renderBubble(payload, true);
        scrollBottom();
        unread[currentRoom] = 0;
    } else {
        unread[payload.room] = (unread[payload.room] || 0) + 1;
        // Pulse the sidebar item
        pulseItem(payload.room);
    }
    refreshChatItem(payload.room);
});

socket.on('system', data => {
    if (data.room !== currentRoom && data.room) return;
    const el = document.createElement('div');
    el.className = 'sys-msg';
    el.innerHTML = `<span>${escapeHTML(data.msg)}</span>`;
    messagesWrap.appendChild(el);
    scrollBottom();
});

socket.on('typing', data => {
    if (data.room && data.room !== currentRoom) return;
    typingText.textContent = `${data.username} is typing…`;
    typingBar.classList.remove('hidden');
    clearTimeout(window._typingHide);
    window._typingHide = setTimeout(() => typingBar.classList.add('hidden'), 2800);
});

socket.on('message_deleted', data => {
    const bubbleGroup = document.getElementById(`msg-${data.id}`);
    if (bubbleGroup) {
        const bubble = bubbleGroup.querySelector('.bubble');
        if (bubble) {
            bubble.innerHTML = '<span class="deleted-message">🚫 This message was deleted</span>';
        }
    }
});

window.deleteMessage = function(id, room) {
    if (confirm('Delete this message for everyone?')) {
        socket.emit('delete_message', { id: id, username: me, room: room });
    }
};

// ── RENDER BUBBLE ─────────────────────────
function renderBubble(msg, animate) {
    const isMe  = (msg.username === me);
    const dir   = isMe ? 'out' : 'in';
    const prev  = lastSender[msg.room || currentRoom];
    const isFirst = (msg.username !== prev);
    lastSender[msg.room || currentRoom] = msg.username;

    const ts = msg.timestamp || timeNow();

    const group = document.createElement('div');
    group.className = `bubble-group ${dir}`;
    group.id = `msg-${msg.id}`;

    // Sender name (only for incoming, first in chain)
    const nameHTML = (!isMe && isFirst)
        ? `<div class="bubble-sender" style="color:${avatarColor(msg.username)}">${escapeHTML(msg.username)}</div>`
        : '';

    // Ticks for outgoing
    const ticksHTML = isMe ? `
        <span class="ticks">
            <svg viewBox="0 0 16 11" width="16" height="11">
                <path d="M11.071.653a.45.45 0 0 0-.304-.302.443.443 0 0 0-.444.109L4.958 5.945l-1.98-2.138a.45.45 0 0 0-.629-.026l-.678.599a.45.45 0 0 0-.035.636l2.918 3.155a.45.45 0 0 0 .665-.001L11.1 1.313a.45.45 0 0 0-.029-.66zm2.943 0a.45.45 0 0 0-.304-.302.443.443 0 0 0-.444.109l-5.365 5.485.297.321-.678.599a.45.45 0 0 0 .665-.001L14.043 1.313a.45.45 0 0 0-.029-.66z" fill="currentColor"/>
            </svg>
        </span>` : '';

    const deleteBtnHTML = isMe ? `<span class="delete-btn" onclick="deleteMessage(${msg.id}, '${msg.room || currentRoom}')" title="Delete message">🗑️</span>` : '';

    group.innerHTML = `
        ${nameHTML}
        <div class="bubble ${dir}${isFirst ? ` first-${dir}` : ''}">
            ${escapeHTML(msg.content)}
            <div class="bubble-meta">
                ${deleteBtnHTML}
                <span class="bubble-time">${ts}</span>
                ${ticksHTML}
            </div>
        </div>`;

    if (!animate) group.style.animation = 'none';
    messagesWrap.appendChild(group);
}

// ── PULSE SIDEBAR ─────────────────────────
function pulseItem(roomId) {
    const el = document.getElementById(`ci-${roomId}`);
    if (!el) return;
    el.style.background = 'rgba(0,168,132,0.12)';
    setTimeout(() => el.style.background = '', 600);
}

// ── INIT ──────────────────────────────────
// Pre-focus username input
window.addEventListener('load', () => usernameInput.focus());
