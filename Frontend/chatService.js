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

    // Start SignalR Immediately
    await startSignalR();

    // Event Listeners (Delegate or Direct)
    setupEventListeners();

    // Load Chat Logic
    await loadChatLogic();
}

function setupEventListeners() {
    // Send Button (Use document body delegation if button is dynamic, but here it's static usually. 
    // If it's static in HTML, direct binding is fine. If dynamic, use delegation.)
    const sendBtn = document.getElementById('sendBtn');
    const msgInput = document.getElementById('messageInput');

    if (sendBtn) {
        sendBtn.removeEventListener('click', sendMessage); // Cleanup old
        sendBtn.addEventListener('click', sendMessage);
    }

    if (msgInput) {
        // Remove old to prevent duplicates if initPage called multiple times
        const newHelper = (e) => {
            if (e.key === 'Enter') sendMessage();
        };
        msgInput.onkeypress = newHelper; // Overwrite
    }
}

// --- 5. Critical Logic: Load Chats & Handle Ghost Chat ---
async function loadChatLogic() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const contactListEl = document.getElementById('contactList');

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
                            isOnline: false // Default to false, catch update later
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

// --- 2. Fetch Chats ---
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

// --- 3. Fetch User Profile (Ghost Chat) ---
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
        return null; // Return null handled in caller
    }
}

// --- 4. Render Chat List ---
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
        item.dataset.userId = c.id; // Helpful for updates

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

        // Avatar Image
        let photoPath = c.profilePhotoPath || c.profilePhotoUrl;
        if (photoPath) {
            if (!photoPath.startsWith('http')) {
                photoPath = `${API_URL.replace('/api', '')}${photoPath.startsWith('/') ? photoPath : '/' + photoPath}`;
            }
            avatarHtml = `<img src="${photoPath}" class="contact-avatar" onerror="this.parentNode.innerHTML='${initials}'">`;
        }

        // Online Status Dot
        const statusColor = c.isOnline ? '#22c55e' : '#cbd5e1'; // Green : Gray

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

    // Update Header
    const header = document.getElementById('chatHeader');
    if (header) {
        header.style.display = 'flex';
        document.getElementById('chatHeaderName').innerText = `${user.firstName} ${user.lastName}`;
        // Status Update (Initial)
        updateHeaderStatus(user.isOnline);

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

function updateHeaderStatus(isOnline) {
    const statusEl = document.getElementById('chatHeaderStatus');
    if (statusEl) {
        statusEl.innerText = isOnline ? "Çevrimiçi" : "Çevrimdışı";
        statusEl.style.color = isOnline ? "#22c55e" : "#64748b";
    }
}

async function loadHistory(targetId) {
    const list = document.getElementById('messagesArea');
    list.innerHTML = '<div style="text-align:center; padding:20px;">Yükleniyor...</div>';

    try {
        const res = await fetch(`${API_URL}/chat/history/${targetId}`, { headers: getHeaders() });
        // Handle 404 or empty as empty
        let messages = [];
        if (res.ok) {
            messages = await res.json();
        }

        list.innerHTML = '';

        if (!messages || messages.length === 0) {
            list.innerHTML = '<div class="no-chat-selected"><div style="font-size:3rem;">👋</div><p>Sohbet başlatın.</p></div>';
        } else {
            messages.forEach(m => {
                const isSent = m.senderId === currentUser.id;
                appendMessage(m, isSent);
            });
            scrollToBottom();
        }

        // Mark read
        try {
            await fetch(`${API_URL}/chat/read/${targetId}`, { method: 'POST', headers: getHeaders() });
        } catch (e) { }

    } catch (err) {
        console.error(err);
        list.innerHTML = '<div style="text-align:center; color:red;">Mesaj geçmişi yüklenemedi.</div>';
    }
}

// --- SignalR & Messaging ---
async function startSignalR() {
    const token = getToken();
    if (!token) return;

    connection = new signalR.HubConnectionBuilder()
        .withUrl(HUB_URL, { accessTokenFactory: () => token })
        .withAutomaticReconnect()
        .build();

    // 1. Receive Message
    connection.on("ReceiveMessage", (data) => {
        // If chat is open with sender OR if I sent it (for sync across tabs)
        if (currentChatUserId && (data.senderId === currentChatUserId || data.senderId === currentUser.id)) {
            // Check prevention of duplicate (if optimistic UI used)
            // Ideally backend sends ID, we can check.
            appendMessage(data, data.senderId === currentUser.id);

            if (data.senderId === currentChatUserId) {
                // Mark as read immediately if window focused?
            }
        } else {
            // Notify user (toast etc)
        }
    });

    // 2. User Online Handler
    connection.on("UserIsOnline", (userId) => {
        handleUserStatusChange(userId, true);
    });

    // 3. User Offline Handler
    connection.on("UserIsOffline", (userId) => {
        handleUserStatusChange(userId, false);
    });

    try {
        await connection.start();
        console.log("SignalR Connected.");
    } catch (err) {
        console.error("SignalR Connection Error: ", err);
        // Retry logic is handled by AutomaticReconnect
    }
}

function handleUserStatusChange(userId, isOnline) {
    const uid = parseInt(userId);

    // Update Contact List Dot
    const item = document.querySelector(`.contact-item[data-user-id="${uid}"] .status-dot`);
    if (item) {
        item.style.background = isOnline ? '#22c55e' : '#cbd5e1';
    }

    // Update Header Status if active
    if (currentChatUserId === uid) {
        updateHeaderStatus(isOnline);
    }

    // Update Cache
    const cacheItem = chatListCache.find(c => c.id === uid);
    if (cacheItem) cacheItem.isOnline = isOnline;
}

async function sendMessage() {
    if (!currentChatUserId) return;

    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content) return;

    // Optimistic UI Append
    // We append immediately. 
    // Ideally we should wait for ACK, but for speed we show it.
    // If backend fails, we should show error.

    // Clear Input
    input.value = '';

    const tempMsg = {
        content: content,
        timestamp: new Date().toISOString(),
        senderId: currentUser.id
    };
    appendMessage(tempMsg, true);

    try {
        await connection.invoke("SendMessage", currentChatUserId, content);
    } catch (err) {
        console.error("Send failed", err);
        // Show error on the last message?
        Swal.fire('Hata', 'Mesaj gönderilemedi.', 'error');
    }
}

function appendMessage(msg, isSent) {
    const list = document.getElementById('messagesArea');
    // Remove empty state if present
    const emptyState = list.querySelector('.no-chat-selected');
    if (emptyState) emptyState.remove();

    const div = document.createElement('div');
    div.className = `message ${isSent ? 'sent' : 'received'}`;

    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `${msg.content} <span class="message-time">${time}</span>`;

    list.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    const list = document.getElementById('messagesArea');
    if (list) list.scrollTop = list.scrollHeight;
}

async function markAsRead(targetId) {
    // This function is now empty as its logic was moved into loadHistory.
    // It remains for backward compatibility or if it's called elsewhere.
}
