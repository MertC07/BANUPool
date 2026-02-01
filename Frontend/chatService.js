const API_URL = "http://localhost:5200/api";
const HUB_URL = "http://localhost:5200/chatHub";

let connection = null;
let currentChatUserId = null;
let currentUser = null;
let chatListCache = []; // Local cache for chats

// --- Helpers ---
function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function getHeaders() {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function logout() {
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = 'login.html';
}

// --- 1. Init Page ---
document.addEventListener('DOMContentLoaded', initPage);

async function initPage() {
    // Auth Check
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const storedUserId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
    if (storedUserId) currentUser = { id: parseInt(storedUserId) };

    // Disable Send Button Initially
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.disabled = true;

    // Start SignalR Immediately
    await startSignalR();

    // Event Listeners
    setupEventListeners();

    // Load Chat Logic
    await loadChatLogic();
}

function setupEventListeners() {
    // No form, manual handling only
    const msgInput = document.getElementById('messageInput');

    if (msgInput) {
        // Use keydown for immediate interruption of any default behavior (though input has no default without form)
        msgInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        };
    }

    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.onclick = (e) => {
            e.preventDefault();
            e.stopImmediatePropagation(); // Ensure nothing else catches this click
            sendMessage();
        };
    }
}

// --- Critical Logic: Load Chats & Handle Ghost Chat ---
async function loadChatLogic() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const contactListEl = document.getElementById('contactList'); // Ensure this matches HTML ID

    if (contactListEl) contactListEl.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b;">Sohbetler yükleniyor...</div>';

    try {
        let chats = await fetchChats();

        const urlParams = new URLSearchParams(window.location.search);
        const targetIdParam = urlParams.get('targetId');
        let targetId = targetIdParam ? parseInt(targetIdParam) : null;
        let activeChatId = null;

        if (targetId) {
            const existingChat = chats.find(c => c.id === targetId);

            if (existingChat) {
                activeChatId = targetId;
            } else {
                // Ghost Chat (New Conversation)
                try {
                    const ghostUser = await fetchUserProfile(targetId);
                    if (ghostUser) {
                        const newChatObj = {
                            id: ghostUser.id,
                            firstName: ghostUser.firstName,
                            lastName: ghostUser.lastName,
                            profilePhotoPath: ghostUser.profilePhotoUrl,
                            lastMessage: "Yeni Sohbet",
                            isOnline: false
                        };
                        chats.unshift(newChatObj);
                        activeChatId = targetId;
                    }
                } catch (ghostErr) {
                    console.warn(`Ghost user ${targetId} could not be loaded.`);
                }
            }
        }

        chatListCache = chats;
        renderChatList(chats, activeChatId);

        if (activeChatId) {
            const chatObj = chats.find(c => c.id === activeChatId);
            if (chatObj) selectChat(chatObj);
        }

    } catch (err) {
        console.error("Critical Error in loadChatLogic:", err);
        if (contactListEl) contactListEl.innerHTML = '<div style="padding:20px; text-align:center; color:#ef4444;">Sohbet listesi yüklenemedi.</div>';
    } finally {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }
}

// --- Fetch Chats ---
async function fetchChats() {
    try {
        const res = await fetch(`${API_URL}/chat/contacts`, { headers: getHeaders() });
        if (!res.ok) return [];
        return await res.json();
    } catch (err) {
        console.error("fetchChats failed:", err);
        return [];
    }
}

// --- Fetch User Profile (Ghost Chat) ---
async function fetchUserProfile(userId) {
    try {
        const res = await fetch(`${API_URL}/users/${userId}`, { headers: getHeaders() });
        if (!res.ok) throw new Error("User profile not found");
        const data = await res.json();
        return {
            id: data.id,
            firstName: data.firstName,
            lastName: data.lastName,
            profilePhotoUrl: data.profilePhotoUrl || data.profilePhotoPath
        };
    } catch (err) {
        return null;
    }
}

// --- Render Chat List ---
function renderChatList(chats, activeChatId) {
    const list = document.getElementById('contactList');
    if (!list) return;

    list.innerHTML = '';

    if (chats.length === 0) {
        list.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8;">Henüz geçmiş sohbetiniz yok.</div>';
        return;
    }

    chats.forEach(c => {
        const item = document.createElement('div');
        item.className = 'contact-item';
        item.dataset.userId = c.id;

        if (activeChatId && c.id === activeChatId) {
            item.classList.add('active');
        }

        item.onclick = () => {
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('targetId', c.id);
            window.history.pushState({}, '', newUrl);

            document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');

            selectChat(c);
        };

        const fullName = `${c.firstName} ${c.lastName}`.trim();
        const initials = ((c.firstName?.[0] || '') + (c.lastName?.[0] || '')).toUpperCase() || '?';

        let avatarHtml = `<div class="contact-avatar" style="display:flex; align-items:center; justify-content:center; background:#cbd5e1; color:#fff; font-weight:bold;">${initials}</div>`;

        let photoPath = c.profilePhotoPath || c.profilePhotoUrl;
        if (photoPath) {
            if (!photoPath.startsWith('http')) {
                photoPath = `${API_URL.replace('/api', '')}${photoPath.startsWith('/') ? photoPath : '/' + photoPath}`;
            }
            avatarHtml = `<img src="${photoPath}" class="contact-avatar" onerror="this.parentNode.innerHTML='${initials}'">`;
        }

        const statusColor = c.isOnline ? '#22c55e' : '#cbd5e1';

        item.innerHTML = `
            ${avatarHtml}
            <div class="contact-info">
                <h4 class="contact-name">
                    ${fullName}
                    <span class="status-dot" style="width:10px; height:10px; border-radius:50%; background:${statusColor}; display:inline-block; margin-left:5px;"></span>
                </h4>
                <p class="last-message">Sohbeti görüntüle</p>
            </div>
        `;
        list.appendChild(item);
    });
}

// --- UI Interaction ---
async function selectChat(user) {
    currentChatUserId = user.id;

    // Hide empty state, show messages area
    const emptyState = document.getElementById('chatEmptyState');
    const messagesArea = document.getElementById('messagesArea');
    if (emptyState) emptyState.style.display = 'none';
    if (messagesArea) messagesArea.style.display = 'block';

    // Update Header
    const header = document.getElementById('chatHeader');
    if (header) {
        header.style.display = 'flex';
        document.getElementById('chatHeaderName').innerText = `${user.firstName} ${user.lastName}`;
        updateHeaderStatus(user.isOnline, user.lastActiveAt);

        const imgEl = document.getElementById('chatHeaderImg');
        let photoPath = user.profilePhotoPath || user.profilePhotoUrl;
        if (photoPath) {
            if (!photoPath.startsWith('http')) {
                photoPath = `${API_URL.replace('/api', '')}${photoPath.startsWith('/') ? photoPath : '/' + photoPath}`;
            }
            imgEl.src = photoPath;
        } else {
            imgEl.src = `https://via.placeholder.com/40?text=${user.firstName?.[0] || 'U'}`;
        }
    }

    const inputArea = document.getElementById('inputArea');
    if (inputArea) inputArea.style.display = 'flex';

    await loadHistory(user.id);

    // Focus Input
    setTimeout(() => {
        const input = document.getElementById('messageInput');
        if (input) input.focus();
    }, 100);
}

function updateHeaderStatus(isOnline, lastActiveAt) {
    const statusEl = document.getElementById('chatHeaderStatus');
    if (!statusEl) return;

    if (isOnline) {
        statusEl.innerText = "Çevrimiçi";
        statusEl.style.color = "#22c55e"; // Green
    } else {
        statusEl.innerText = formatLastSeen(lastActiveAt);
        statusEl.style.color = "#8e8e8e"; // Gray
    }
}

function formatLastSeen(dateStr) {
    if (!dateStr) return "Çevrimdışı";

    const date = new Date(dateStr);
    if (isNaN(date)) return "Çevrimdışı";

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    if (diffDays === 0 && now.getDate() === date.getDate()) {
        return `Bugün ${timeStr} civarında görüldü`;
    } else if (diffDays === 1 || (diffDays === 0 && now.getDate() !== date.getDate())) {
        return `Dün ${timeStr} civarında görüldü`;
    } else {
        return `${date.toLocaleDateString('tr-TR')} ${timeStr} civarında görüldü`;
    }
}

async function loadHistory(targetId) {
    const list = document.getElementById('messagesArea');
    const emptyState = document.getElementById('chatEmptyState');

    // Show only list, hide empty state
    if (emptyState) emptyState.style.display = 'none';
    if (list) {
        list.style.display = 'block';
        list.innerHTML = '<div style="text-align:center; padding:20px;">Yükleniyor...</div>';
    }

    try {
        const res = await fetch(`${API_URL}/chat/history/${targetId}`, { headers: getHeaders() });
        let messages = [];
        if (res.ok) {
            messages = await res.json();
        }

        if (list) list.innerHTML = '';

        if (!messages || messages.length === 0) {
            // Show empty placeholder within list if genuinely empty
            // Or just keep empty.
            if (list) list.innerHTML = '<div style="text-align:center; padding:2rem; color:#94a3b8;">Henüz mesaj yok. İlk mesajı sen gönder. 👋</div>';
        } else {
            messages.forEach(m => {
                const isSent = m.senderId === currentUser.id;
                appendMessage(m, isSent);
            });
            scrollToBottom();
        }

        try {
            await fetch(`${API_URL}/chat/read/${targetId}`, { method: 'POST', headers: getHeaders() });
        } catch (e) { }

    } catch (err) {
        console.error(err);
        if (list) list.innerHTML = '<div style="text-align:center; color:red;">Mesaj geçmişi yüklenemedi.</div>';
    }
}

// --- SignalR & Messaging ---
async function startSignalR() {
    const token = getToken();
    if (!token) {
        console.warn("SignalR: No token found.");
        return;
    }

    connection = new signalR.HubConnectionBuilder()
        .withUrl(HUB_URL, { accessTokenFactory: () => token })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Information)
        .build();

    connection.on("ReceiveMessage", (data) => {
        if (currentChatUserId && (data.senderId === currentChatUserId || data.senderId === currentUser.id)) {
            appendMessage(data, data.senderId === currentUser.id);
        }
    });

    // Updated handler to accept timestamp
    connection.on("UserStatusChanged", (userId, isOnline, timestamp) => {
        const uid = parseInt(userId);
        const item = document.querySelector(`.contact-item[data-user-id="${uid}"] .status-dot`);
        if (item) item.style.background = isOnline ? '#22c55e' : '#cbd5e1';

        // Update local cache
        const cacheItem = chatListCache.find(c => c.id === uid);
        if (cacheItem) {
            cacheItem.isOnline = isOnline;
            if (!isOnline && timestamp) cacheItem.lastActiveAt = timestamp;
        }

        // Update Header if active chat
        if (currentChatUserId === uid) {
            updateHeaderStatus(isOnline, isOnline ? null : timestamp);
        }
    });

    connection.onreconnecting(error => {
        console.warn(`SignalR Reconnecting: ${error}`);
        toggleSendButton(false);
    });

    connection.onreconnected(connectionId => {
        console.log(`SignalR Reconnected. ID: ${connectionId}`);
        toggleSendButton(true);
    });

    try {
        await connection.start();
        console.log("SignalR Connected Successfully.");
        toggleSendButton(true);

    } catch (err) {
        console.error("SignalR Connection Fatal Error: ", err);
        toggleSendButton(false);
    }
}

// Helper to disable/enable button
function toggleSendButton(isEnabled) {
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        // For DIV, use pointer-events to disable clicks
        sendBtn.style.pointerEvents = isEnabled ? 'auto' : 'none';
        sendBtn.style.opacity = isEnabled ? '1' : '0.5';
    }
}

async function sendMessage() {
    if (!currentChatUserId) return;

    if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
        Swal.fire('Hata', 'Sunucu ile bağlantı koptu. Lütfen sayfayı yenileyin.', 'error');
        return;
    }

    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content) return;

    const targetUserIdStr = currentChatUserId.toString();

    // Disable button while sending to prevent double clicks
    toggleSendButton(false);

    try {
        await connection.invoke("SendMessage", targetUserIdStr, content);

        appendMessage({
            content: content,
            timestamp: new Date().toISOString(),
            senderId: currentUser.id
        }, true);

        input.value = '';

    } catch (err) {
        console.error("Send Message Invoke Error:", err);
        Swal.fire('Hata', `Mesaj gönderilemedi: ${err.toString()}`, 'error');
    } finally {
        toggleSendButton(true);
    }
}

function appendMessage(msg, isSent) {
    const list = document.getElementById('messagesArea');
    const emptyState = document.getElementById('chatEmptyState');

    // Ensure correct visibility
    if (emptyState) emptyState.style.display = 'none';
    if (list) list.style.display = 'block';

    const div = document.createElement('div');
    div.className = `message ${isSent ? 'sent' : 'received'}`;

    // Fix timestamp formatting
    const time = new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `${msg.content} <span class="message-time">${time}</span>`;

    list.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    const list = document.getElementById('messagesArea');
    if (list) list.scrollTop = list.scrollHeight;
}
