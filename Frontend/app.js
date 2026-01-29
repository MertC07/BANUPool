/**
 * BANÜ-Pool Frontend Logic
 * Handles Authentication, Ride Management, Chatbot, and UI Interactions.
 * Optimized for performance and readability.
 */
const API_URL = "http://localhost:5200/api";

// --- CONFIGURATION ---
const BANDIRMA_LOCATIONS = [
    "Bandırma Kampüs (Merkez)",
    "Bandırma Şehir Merkezi",
    "Bandırma İDO İskelesi",
    "Bandırma Otogar",
    "Bandırma Liman AVM",
    "Edincik (Kampüs Yakını)",
    "Erdek (İlçe Merkezi)",
    "Gönen (İlçe Merkezi)",
    "Susurluk (İlçe Merkezi)",
    "Karacabey (Otogar)"
];

const DISTANCE_MATRIX = {
    // Kampüs Çıkışlı
    "Bandırma Kampüs (Merkez)-Bandırma Şehir Merkezi": 6,
    "Bandırma Kampüs (Merkez)-Bandırma Otogar": 4,
    "Bandırma Kampüs (Merkez)-Bandırma İDO İskelesi": 7,
    "Bandırma Kampüs (Merkez)-Bandırma Liman AVM": 5,
    "Bandırma Kampüs (Merkez)-Edincik (Kampüs Yakını)": 3,
    "Bandırma Kampüs (Merkez)-Erdek (İlçe Merkezi)": 18,
    "Bandırma Kampüs (Merkez)-Gönen (İlçe Merkezi)": 42,
    "Bandırma Kampüs (Merkez)-Susurluk (İlçe Merkezi)": 52,
    "Bandırma Kampüs (Merkez)-Karacabey (Otogar)": 38,

    // Merkez Çıkışlı
    "Bandırma Şehir Merkezi-Bandırma Otogar": 5,
    "Bandırma Şehir Merkezi-Bandırma İDO İskelesi": 1,
    "Bandırma Şehir Merkezi-Bandırma Liman AVM": 2,
    "Bandırma Şehir Merkezi-Erdek (İlçe Merkezi)": 22,
    "Bandırma Şehir Merkezi-Gönen (İlçe Merkezi)": 46,
    "Bandırma Şehir Merkezi-Susurluk (İlçe Merkezi)": 54,
    "Bandırma Şehir Merkezi-Karacabey (Otogar)": 44,

    // Otogar Çıkışlı
    "Bandırma Otogar-Bandırma Şehir Merkezi": 5,
    "Bandırma Otogar-Bandırma İDO İskelesi": 6,
    "Bandırma Otogar-Erdek (İlçe Merkezi)": 20,
    "Bandırma Otogar-Gönen (İlçe Merkezi)": 44,
    "Bandırma Otogar-Susurluk (İlçe Merkezi)": 50,

    // Default fallback
    "DEFAULT": 15
};

// --- TOAST MIXIN ---
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 4000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.style.zIndex = '9999999';
        const container = Swal.getContainer();
        if (container) container.style.zIndex = '9999999';
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
        toast.addEventListener('click', Swal.close) // Click to dismiss

        // CSS Improvements for "Clickable" feel
        toast.style.cursor = 'pointer';
        toast.style.userSelect = 'none'; // Disable text selection
        toast.style.webkitUserSelect = 'none';

        // FORCE CSS via Style Tag to override SweetAlert defaults
        const style = document.createElement('style');
        style.innerHTML = `
            div.swal2-toast, 
            div.swal2-toast * {
                cursor: pointer !important;
                user-select: none !important;
                -webkit-user-select: none !important;
            }
        `;
        document.head.appendChild(style);
    }
});

function showToast(msg, icon = 'success') {
    // Delay to allow DOM updates/reloads to settle
    setTimeout(() => {
        Toast.fire({ icon: icon, title: msg });
    }, 200);
}

function showError(msg) {
    // Keep error as toast too? Or modal? User said "onaylama pencereleri" (success/confirm).
    // Let's keep error as modal for visibility, or toast? User prefers less polution.
    // I'll keep error as modal for now unless asked.
    if (typeof Swal !== 'undefined') {
        Swal.fire({ icon: 'error', title: 'Hata!', text: msg, confirmButtonColor: '#ef4444' });
    } else { alert(msg); }
}

function checkAuth() {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const userId = sessionStorage.getItem('userId') || localStorage.getItem('userId');

    if (!token || !userId) {
        logout(); // Force logout if incomplete session
        return null;
    }
    return token;
}

function getUserId() {
    return sessionStorage.getItem('userId') || localStorage.getItem('userId');
}

function logout() {
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = 'login.html';
}

function updateNavigation() {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    const path = window.location.pathname;
    const isDashboard = path.includes('dashboard.html');
    const isProfile = path.includes('profile.html');
    const isIndex = path.includes('index.html') || path.endsWith('/');

    if (token) {
        navLinks.innerHTML = `
            <a href="index.html" class="${isIndex ? 'active' : ''}">Ana Sayfa</a>
            <a href="dashboard.html" class="${isDashboard ? 'active' : ''}">İlanlar</a>
            <a href="profile.html" class="${isProfile ? 'active' : ''}">Profilim</a>
            
            <!-- Notification Wrapper -->
            <div class="notification-wrapper" style="position: relative;">
                <a href="javascript:void(0)" class="nav-icon-btn" onclick="toggleNotifications(event)">
                    🔔
                    <span id="notif-badge" class="badge" style="display:none;">0</span>
                </a>
                
                <!-- Gmail Style Dropdown -->
                <div id="notificationDropdown" class="notification-dropdown">
                    <div class="dropdown-header">
                        <span class="header-title">Bildirimler</span>
                        <button onclick="markAllNotificationsRead(event)" class="header-action">Tümünü okundu işaretle</button>
                    </div>
                    <div id="notificationList" class="dropdown-content">
                        <!-- Items injected here -->
                        <div class="notif-loading">Yükleniyor...</div>
                    </div>
                    <div class="dropdown-footer">
                         <!-- Optional footer -->
                    </div>
                </div>
            </div>

            <a href="javascript:void(0)" onclick="logout()">Çıkış Yap</a>
        `;
    } else {
        navLinks.innerHTML = `
            <a href="index.html" class="${isIndex ? 'active' : ''}">Ana Sayfa</a>
            <a href="dashboard.html" class="${isDashboard ? 'active' : ''}">İlanlar</a>
            <a href="login.html">Giriş Yap</a>
            <a href="register.html" class="btn-primary">Kayıt Ol</a>
        `;
    }
}


// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    updateNavigation();
    populateLocationDropdowns(); // First populate standard options
    initTheme();
    initScrollObserver();

    // Slight delay for Choices to ensure DOM is ready
    setTimeout(() => {
        initChoices();
    }, 50);

    // Init Flatpickr if element exists
    const dateInput = document.getElementById('newDate');
    if (dateInput && typeof flatpickr !== 'undefined') {
        flatpickr(dateInput, {
            enableTime: true,
            dateFormat: "d.m.Y H:i",
            minDate: "today",
            time_24hr: true,
            locale: "tr"
        });
    }

    // Auto-load if on dashboard
    if (document.getElementById('ridesList')) {
        // CHECK FLASH MESSAGE (Ride Creation)
        const rideAction = localStorage.getItem('rideSuccess');
        if (rideAction) {
            localStorage.removeItem('rideSuccess');
            switchTab('my'); // Force switch to My Rides
            showToast(rideAction === 'updated' ? 'İlan Güncellendi! ✅' : 'İlan Başarıyla Oluşturuldu! 🚀');
        } else {
            loadRides();
        }
    }

    // CHECK FLASH MESSAGE (Ride Deletion)
    const delAction = localStorage.getItem('rideAction');
    if (delAction === 'deleted') {
        localStorage.removeItem('rideAction');
        switchTab('my');
        showToast('İlan başarıyla silindi. 🗑️');
    } else if (delAction === 'reserved') {
        localStorage.removeItem('rideAction');
        switchTab('reservations');
        showToast('Rezervasyonunuz başarıyla oluşturuldu! 🎟️');
    } else if (delAction === 'cancelled') {
        localStorage.removeItem('rideAction');
        switchTab('reservations');
        showToast('Rezervasyonunuz iptal edildi. ❌');
    }
});

let choicesInstances = [];

function initChoices() {
    choicesInstances.forEach(c => c.destroy());
    choicesInstances = [];

    const selects = document.querySelectorAll('.search-select, .location-select');
    if (selects.length > 0 && typeof Choices !== 'undefined') {
        selects.forEach(select => {
            // Avoid double init
            if (select.closest('.choices')) return;

            // Only init if visible or part of critical UI
            const instance = new Choices(select, {
                searchEnabled: false,
                itemSelectText: '',
                shouldSort: false,
                position: 'bottom',
                titles: { item: 'Seçiniz', active: 'Seçiniz' }
            });
            choicesInstances.push(instance);

            // Trigger reload when sorting changes
            if (select.id === 'sortBy') {
                select.addEventListener('change', () => loadRides());
            }
        });
    }
}

function populateLocationDropdowns() {
    const dropdowns = document.querySelectorAll('.location-select, .search-select');
    dropdowns.forEach(select => {
        // FIX: Don't populate sort dropdown with locations
        if (select.id === 'sortBy') return;

        const hasFirstOption = select.options.length > 0;
        // Don't clear if it's already a choices element (it handles its own DOM)
        // But since we run this BEFORE initChoices, raw DOM manipulation is fine.

        if (hasFirstOption && select.options[0].value === "") {
            // Keep first placeholder
        } else {
            select.innerHTML = '';
        }

        BANDIRMA_LOCATIONS.forEach(loc => {
            let exists = false;
            for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].value === loc) exists = true;
            }
            if (!exists) {
                const opt = document.createElement('option');
                opt.value = loc;
                opt.textContent = getShortLocName(loc);
                select.appendChild(opt);
            }
        });
    });
}

function getShortLocName(name) {
    return name;
}

// --- THEME & ANIMATION ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark';

    if (isDark) {
        document.body.classList.add('dark-mode');
    }

    // Avoid duplicate buttons
    if (document.querySelector('.theme-toggle')) return;

    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.innerHTML = isDark ? '🌙' : '☀️';
    btn.title = 'Temayı Değiştir';
    btn.onclick = () => {
        document.body.classList.toggle('dark-mode');
        const isNowDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isNowDark ? 'dark' : 'light');
        btn.innerHTML = isNowDark ? '🌙' : '☀️';
        btn.style.transform = 'scale(0.9)';
        setTimeout(() => btn.style.transform = '', 200);
    };
    document.body.appendChild(btn);
}

function initScrollObserver() {
    const targets = document.querySelectorAll('.card, .ride-card, .hero, .section-title, .faq-item, .container > div');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('scroll-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    targets.forEach(target => {
        target.classList.add('scroll-hidden');
        observer.observe(target);
    });
}


// --- TAB & UI LOGIC ---
let currentTab = 'all'; // 'all' or 'my'

function switchTab(tab) {
    currentTab = tab;
    // Update UI
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('ridesList').style.display = 'none';
    document.getElementById('my-reservations-list').style.display = 'none';

    // Explicitly handle sub-tabs visibility
    const subTabs = document.getElementById('myRidesSubTabs');
    if (subTabs) {
        subTabs.style.display = (tab === 'my') ? 'flex' : 'none';
    }
    const ticketSubTabs = document.getElementById('myTicketsSubTabs');
    if (ticketSubTabs) {
        ticketSubTabs.style.display = (tab === 'reservations') ? 'flex' : 'none';
    }

    if (tab === 'all') {
        document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
        if (document.getElementById('searchSection')) document.getElementById('searchSection').style.display = 'block';
        document.getElementById('ridesList').style.display = 'grid';
        loadRides();
    } else if (tab === 'my') {
        document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
        if (document.getElementById('searchSection')) document.getElementById('searchSection').style.display = 'none';
        document.getElementById('ridesList').style.display = 'grid';
        loadRides();
    } else if (tab === 'reservations') {
        document.querySelector('.tab-btn:nth-child(3)').classList.add('active');
        if (document.getElementById('searchSection')) document.getElementById('searchSection').style.display = 'none';
        document.getElementById('my-reservations-list').style.display = 'grid';
        loadMyReservations();
    }
}

// --- RESERVATIONS (My Trips) ---
let currentMyTicketsTab = 'active'; // 'active' or 'history'

window.switchMyTicketsTab = function (tab) {
    currentMyTicketsTab = tab;
    document.querySelectorAll('#myTicketsSubTabs .sub-tab-btn').forEach(btn => {
        if ((tab === 'active' && btn.innerText.includes('Aktif')) ||
            (tab === 'history' && btn.innerText.includes('Geçmiş'))) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    loadMyReservations();
}

async function loadMyReservations() {
    const list = document.getElementById('my-reservations-list');
    if (!list) return;

    list.innerHTML = '<p style="text-align: center;">Yükleniyor...</p>';

    const userId = getUserId();
    const token = checkAuth();

    try {
        const res = await fetch(`${API_URL}/rides/passenger/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Yolculuklar yüklenemedi');

        const rides = await res.json();
        list.innerHTML = '';

        if (rides.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding: 4rem 2rem; color: var(--text-secondary);">
                    <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">🎫</div>
                    <p style="font-size: 1.1rem;">Henüz bir biletiniz yok.</p>
                    <button onclick="switchTab('all')" class="btn-primary" style="margin-top:1rem;">Hemen Yolculuk Bul</button>
                </div>`;
            return;
        }

        // FILTERING FOR TABS
        const now = new Date();
        let filteredRides = [];

        if (currentMyTicketsTab === 'active') {
            filteredRides = rides.filter(r => new Date(r.departureTime) >= now);
        } else {
            // History
            filteredRides = rides.filter(r => new Date(r.departureTime) < now);
        }

        if (filteredRides.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding: 4rem 2rem; color: var(--text-secondary);">
                    <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">🎫</div>
                    <p style="font-size: 1.1rem;">${currentMyTicketsTab === 'active' ? 'Aktif biletiniz bulunmuyor.' : 'Geçmiş biletiniz bulunmuyor.'}</p>
                    ${currentMyTicketsTab === 'active' ? '<button onclick="switchTab(\'all\')" class="btn-primary" style="margin-top:1rem;">Hemen Yolculuk Bul</button>' : ''}
                </div>`;
            return;
        }

        filteredRides.forEach(ride => {
            const date = new Date(ride.departureTime).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
            const time = new Date(ride.departureTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

            const card = document.createElement('div');
            card.className = 'ride-card';
            // Visual indication for past rides
            if (currentMyTicketsTab === 'history') {
                card.style.opacity = '0.7';
                card.style.borderLeft = '4px solid #94a3b8';
            }

            card.innerHTML = `
                <div class="ride-header">
                    <div class="ride-price">${ride.price} ₺</div>
                    <div class="ride-date">${date} • ${time}</div>
                </div>
                <div class="ride-route">
                    <div class="route-point">
                        <span class="dot origin"></span>
                        <span class="location">${ride.origin}</span>
                    </div>
                    <div class="route-line"></div>
                    <div class="route-point">
                        <span class="dot dest"></span>
                        <span class="location">${ride.destination}</span>
                    </div>
                </div>
                <div class="driver-info">
                    <div class="driver-avatar">${ride.driver?.firstName[0] || 'U'}</div>
                    <div class="driver-details">
                        <span class="driver-name">${ride.driver?.firstName} ${ride.driver?.lastName}</span>
                        <span class="driver-rating">⭐ 5.0 (Sürücü)</span>
                    </div>
                </div>
                <div class="card-footer">
                    <span class="status-badge success">
                        <span style="font-size:1.1em;">✓</span> ${currentMyTicketsTab === 'active' ? 'Onaylandı' : 'Tamamlandı'}
                    </span>
                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        ${ride.driver?.phoneNumber ? `
                        <a href="https://wa.me/90${ride.driver.phoneNumber.replace(/^0/, '').replace(/\D/g, '')}" target="_blank" class="btn-whatsapp">
                            <span>💬</span> Mesaj
                        </a>` : ''}
                        ${currentMyTicketsTab === 'history' ?
                    `<button class="btn-primary" onclick="openRateModal(${ride.id}, ${ride.driver.id})" style="padding:0.4rem 0.8rem; font-size:0.85rem;">⭐ Puanla</button>` :
                    `<button class="btn-destructive" onclick="cancelSeat(${ride.id})">İptal</button>`
                }
                    </div>
                </div>
            `;
            list.appendChild(card);
        });

    } catch (err) {
        list.innerHTML = `<p style="color:red; text-align:center;">Hata: ${err.message}</p>`;
    }
}

async function cancelSeat(rideId) {
    const token = checkAuth();
    const userId = getUserId();
    if (!token || !userId) return;

    const result = await Swal.fire({
        title: 'Rezervasyonu İptal Et?',
        text: "Bu işlem geri alınamaz.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Evet, İptal Et',
        cancelButtonText: 'Vazgeç'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/rides/${rideId}/reserve?userId=${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            localStorage.setItem('rideAction', 'cancelled');
            window.location.reload();
        } else {
            const txt = await res.text();
            showError('İptal başarısız: ' + txt);
        }
    } catch (err) {
        showError('Hata: ' + err.message);
    }
}

// (Removed duplicate Tab Logic to fix scoping issue)

// --- RIDE MANAGEMENT ---

// --- MY RIDES SUB-TAB STATE ---
let currentMyRidesTab = 'active'; // 'active' or 'history'

window.switchMyRidesTab = function (tab) {
    currentMyRidesTab = tab;
    // Update button states
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        if ((tab === 'active' && btn.innerText.includes('Aktif')) ||
            (tab === 'history' && btn.innerText.includes('Geçmiş'))) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    // Refresh list
    loadRides();
}

async function loadRides() {
    const originFilter = document.getElementById('searchOrigin')?.value || '';
    const destFilter = document.getElementById('searchDest')?.value || '';
    const maxPrice = parseFloat(document.getElementById('searchMaxPrice')?.value) || Infinity;
    const sortBy = document.getElementById('sortBy')?.value || 'dateAsc';

    try {
        const currentUserId = getUserId();

        let url = `${API_URL}/rides`;

        // Toggle Sub-tabs visibility
        const wrapper = document.getElementById('myRidesSubTabs');
        if (currentTab === 'my') {
            if (wrapper) wrapper.style.display = 'flex';
        } else {
            if (wrapper) wrapper.style.display = 'none';
        }

        // LIFECYCLE LOGIC:
        if (currentTab === 'my') {
            if (!currentUserId) {
                console.warn("User ID missing for My Rides");
                // Optional: Force login or handle error
                // window.location.href = 'index.html'; 
                // For now, let's just not set the URL to avoid 400, or let checkAuth handle it?
                // checkAuth() is called later, we should probably call it here or return.
                return;
            }
            const isHistory = currentMyRidesTab === 'history';
            url = `${API_URL}/rides/driver/${currentUserId}?history=${isHistory}`;
        } else if (currentTab === 'reservations') {
            loadMyReservations(); // Handled separately
            return;
        } else {
            // Search / Public (Active only)
            const userPart = currentUserId ? `&userId=${currentUserId}` : '';
            const query = `?origin=${encodeURIComponent(originFilter)}&destination=${encodeURIComponent(destFilter)}&maxPrice=${maxPrice === Infinity ? '' : maxPrice}&sortBy=${sortBy}${userPart}`;
            url += `/search${query}`;
        }

        const options = {
            headers: {}
        };

        const token = checkAuth();
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, options);
        if (!response.ok) {
            const errText = await response.text();
            throw new Error('Sunucu hatası: ' + response.status + ' | ' + errText);
        }
        let rides = await response.json();

        if (!Array.isArray(rides)) rides = []; // Safety check

        // 1. FILTERING
        if (currentTab === 'my') {
            // Backend already filters by driverId for this endpoint
            // rides = rides.filter(r => (r.driver && r.driver.id) == currentUserId);
        } else {
            // HIDE RESERVED RIDES
            if (currentUserId) {
                try {
                    const reservedRes = await fetch(`${API_URL}/rides/passenger/${currentUserId}`, {
                        headers: { 'Authorization': `Bearer ${checkAuth()}` }
                    });
                    if (reservedRes.ok) {
                        const reservedRides = await reservedRes.json();
                        const reservedIds = new Set(reservedRides.map(rr => rr.id));
                        rides = rides.filter(r => !reservedIds.has(r.id));
                    }
                } catch (e) {
                    console.warn("Rezervasyonlar kontrol edilemedi", e);
                }
            }

            if (originFilter) rides = rides.filter(r => r.origin === originFilter);
            if (destFilter) rides = rides.filter(r => r.destination === destFilter);
            if (maxPrice !== Infinity) rides = rides.filter(r => r.price <= maxPrice);
        }

        // 2. SORTING
        rides.sort((a, b) => {
            const dateA = new Date(a.departureTime);
            const dateB = new Date(b.departureTime);
            if (sortBy === 'dateAsc') return dateA - dateB;
            if (sortBy === 'dateDesc') return dateB - dateA;
            if (sortBy === 'priceAsc') return a.price - b.price;
            if (sortBy === 'priceDesc') return b.price - a.price;
            return 0;
        });

        const list = document.getElementById('ridesList');
        if (!list) return;

        list.innerHTML = '';
        if (rides.length === 0) {
            const emptyMsg = currentTab === 'my'
                ? 'Henüz hiç ilan oluşturmadınız. 🚘'
                : 'Aradığınız kriterlere uygun ilan bulunamadı. 📭';

            list.innerHTML = `
                <div style="text-align:center; padding: 4rem 2rem; color: var(--text-secondary);">
                    <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">${currentTab === 'my' ? '🛣️' : '🔍'}</div>
                    <p style="font-size: 1.1rem;">${emptyMsg}</p>
                    ${currentTab === 'my'
                    ? '<button onclick="showCreateRideModal()" class="btn-primary" style="margin-top:1rem;">İlk İlanını Oluştur</button>'
                    : ''}
                </div>
            `;
            return;
        }

        // --- SPLIT VIEW LOGIC FOR 'MY RIDES' ---
        if (currentTab === 'my') {
            const now = new Date();
            // Active = Departure Time > Now AND Status != Cancelled (3)
            const activeRides = rides.filter(r => new Date(r.departureTime) >= now && r.status !== 3);

            // Expired OR Cancelled
            const pastRides = rides.filter(r => new Date(r.departureTime) < now || r.status === 3);

            if (activeRides.length > 0) {
                list.innerHTML += `<h4 style="margin: 1.5rem 0 1rem; color: var(--primary-color); border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem;">Aktif İlanlar (${activeRides.length})</h4>`;
                activeRides.forEach(ride => list.appendChild(createRideCard(ride)));
            }

            if (pastRides.length > 0) {
                list.innerHTML += `<h4 style="margin: 2rem 0 1rem; color: var(--text-secondary); border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem;">Geçmiş & İptal Edilenler (${pastRides.length})</h4>`;
                pastRides.forEach(ride => list.appendChild(createRideCard(ride)));
            }
            return; // Done rendering for 'my' tab
        }

        // --- STANDARD VIEW FOR OTHER TABS ---
        rides.forEach(ride => {
            list.appendChild(createRideCard(ride));
        });

    } catch (err) {
        console.error(err);
        const list = document.getElementById('ridesList');
        if (list) {
            list.innerHTML = `
                <div style="text-align:center; padding: 2rem; color: #ef4444;">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
                    <p>İlanlar yüklenirken bir sorun oluştu.</p>
                    <p style="font-size: 0.9rem; opacity: 0.8;">Hata: ${err.message}</p>
                    <button onclick="loadRides()" class="btn-primary" style="margin-top:1rem;">Tekrar Dene</button>
                </div>
            `;
        }
    }
}

function createRideCard(ride) {
    const userId = getUserId();
    const currentTab = document.querySelector('.tab-btn.active').innerText.includes('İlanlarım') ? 'my' :
        (document.querySelector('.tab-btn.active').innerText.includes('Biletlerim') ? 'reservations' : 'all');

    const dateObj = new Date(ride.departureTime);
    const isValidDate = !isNaN(dateObj);
    const dateStr = isValidDate ? dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : ride.departureTime;
    const timeStr = isValidDate ? dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';

    const available = ride.totalSeats - ride.reservedSeats;
    const isFull = available <= 0;
    const isMyRide = (ride.driver && ride.driver.id) == userId || (ride.driverId == userId);

    // Check expiry and status
    const isExpired = new Date(ride.departureTime) < new Date();
    const isCancelled = ride.status === 3; // Enum: Cancelled = 3

    const card = document.createElement('div');
    card.className = `ride-card ${isExpired ? 'expired' : ''} ${isCancelled ? 'cancelled-ride-card' : ''}`;

    // Style separation
    let borderColor = 'var(--secondary-color)';
    if (isCancelled) borderColor = '#ef4444'; // Red for cancelled
    else if (isExpired) borderColor = '#94a3b8'; // Gray for expired
    else if (isFull) borderColor = '#cbd5e1';

    card.style.borderLeft = `4px solid ${borderColor}`;
    if (isCancelled) card.style.backgroundColor = '#fef2f2'; // Light red background

    if (isMyRide && currentTab === 'all') {
        card.style.borderColor = 'var(--primary-color)';
        card.style.background = 'linear-gradient(to right, rgba(99, 102, 241, 0.05), transparent)';
    }

    let actionHtml = '';
    if (currentTab === 'my') {
        const canEdit = !isExpired && ride.reservedSeats === 0 && !isCancelled; // State Pattern Check

        // Determine Tooltip Message
        let editTooltip = "";
        if (isCancelled) editTooltip = "İptal edilen ilanlar düzenlenemez";
        else if (ride.reservedSeats > 0) editTooltip = "Yolcusu olan ilan düzenlenemez";

        actionHtml = `
                    <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem;">
                         ${isExpired
                ? `<button onclick="republishRide(${ride.id})" class="btn-sm btn-edit">🔄 Yeniden Yayınla</button>`
                : `<button onclick="${canEdit ? `editRide(${ride.id})` : ''}" class="btn-sm btn-edit" 
                        style="${!canEdit ? 'background-color:#94a3b8; cursor:not-allowed; opacity:0.7;' : ''}" 
                        ${!canEdit ? `disabled title="${editTooltip}"` : ''}>
                        ${canEdit ? 'Düzenle' : '🔒 Düzenlenemez'}
                   </button>`}
                         ${!isCancelled ? `<button onclick="initiateCancelRide(${ride.id})" class="btn-sm btn-danger">İptal Et</button>` : ''}
                    </div>
                `;
    } else {
        if (isMyRide) {
            actionHtml = `<button class="btn-primary" disabled style="background-color: var(--text-secondary); color: white; opacity: 0.8; cursor: not-allowed; width:100%;">Sizin İlanınız</button>`;
        } else {
            actionHtml = `<button onclick="reserveRide(${ride.id})" class="btn-primary" style="width:100%; ${isFull ? 'background:gray;' : ''}" ${isFull ? 'disabled' : ''}>${isFull ? 'Dolu' : 'Rezervasyon'}</button>`;
        }
    }

    card.innerHTML = `
                <div class="ride-info">
                        ${ride.origin} <span style="color:var(--text-secondary); font-size:0.8em;">➔</span> ${ride.destination}
                        ${isMyRide ? '<span style="font-size:0.7rem; background:var(--primary-color); color:white; padding:2px 6px; border-radius:4px;">SİZ</span>' : ''}
                        ${isExpired ? '<span class="status-badge expired">⚠️ Süresi Doldu</span>' : ''}
                        ${isCancelled ? '<span class="status-badge" style="background:#ef4444; color:white;">🚫 İPTAL EDİLDİ</span>' : ''}
                    </h3>
                    <div class="ride-details" style="display:grid; grid-template-columns: auto auto; gap: 0.5rem 2rem; margin-top:0.5rem;">
                    <span>📅 <b>${dateStr}</b> ${timeStr}</span>
                    <span>👤 ${ride.driver ? ride.driver.firstName : 'Sürücü'} <span style="color:#f59e0b; font-weight:bold;">⭐ ${(ride.driver && ride.driver.reputationScore !== undefined) ? ride.driver.reputationScore.toFixed(1) : '5.0'}</span></span>
                    <span>🚗 ${ride.vehicle ? (ride.vehicle.model + ' (' + ride.vehicle.plateNumber + ')') : 'Araç Bilgisi Yok'}</span>
                    <span>💺 Boş: <span style="color:${isFull ? 'red' : 'green'}">${available}</span> / ${ride.totalSeats}</span>
                </div>
                </div>
                <div class="ride-action" style="min-width: 140px;">
                    <div class="price-tag" style="text-align:right; margin-bottom:0.5rem;">${ride.price} ₺</div>
                    ${actionHtml}
                </div>
            `;
    return card;
}

// --- NOTIFICATIONS ---

// --- NOTIFICATIONS (GMAIL STYLE) ---

async function initDashboard() {
    // Check Flash Messages
    if (localStorage.getItem('cancelSuccess')) {
        localStorage.removeItem('cancelSuccess');
        showToast('İlanınız başarıyla iptal edildi! 🚫', 'success');
    }

    await loadRides();

    // Initial load
    await loadNotifications();

    // Poll every 30s
    // Initial load only - NO POLLING
    await loadNotifications();

    // Global click listener to close dropdown
    document.addEventListener('click', (e) => {
        const wrapper = document.querySelector('.notification-wrapper');
        const dropdown = document.getElementById('notificationDropdown');
        if (wrapper && !wrapper.contains(e.target) && dropdown.classList.contains('active')) {
            dropdown.classList.remove('active');
        }
    });

    // CRITICAL: Stop propagation from inside the dropdown to prevent closing
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}

// --- NOTIFICATIONS CORE LOGIC ---

// 1. Toggle Dropdown
function toggleNotifications(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const dropdown = document.getElementById('notificationDropdown');
    const isActive = dropdown.classList.contains('active');

    // Close others
    document.querySelectorAll('.notification-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.remove('active');
    });

    if (!isActive) {
        dropdown.classList.add('active');
        // Optional: Refresh only if empty or explicitly requested
        const list = document.getElementById('notificationList');
        if (list && list.children.length === 0) {
            loadNotifications();
        }
    } else {
        dropdown.classList.remove('active');
    }
}

// 2. Load Notifications (Initial)
async function loadNotifications() {
    const userId = getUserId();
    if (!userId) return;

    try {
        const res = await fetch(`${API_URL}/notifications/${userId}?_t=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${checkAuth()}` }
        });

        if (res.ok) {
            const notifications = await res.json();
            renderNotifications(notifications);

            // Initial Badge Count
            const unreadCount = notifications.filter(n => !n.isRead).length;
            updateBadge(unreadCount);
        }
    } catch (err) {
        console.error("Bildirim yükleme hatası", err);
    }
}

// 3. Render List (Reset)
function renderNotifications(notifications) {
    const list = document.getElementById('notificationList');
    if (!list) return;

    list.innerHTML = ''; // Reset list

    if (notifications.length === 0) {
        list.innerHTML = `
            <div class="notif-empty">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div>
                <div>Henüz bildiriminiz yok</div>
            </div>`;
        return;
    }

    notifications.forEach(n => {
        const item = createNotificationItem(n);
        list.appendChild(item);
    });
}

// 4. Create Item (Shared with SignalR)
function createNotificationItem(n) {
    const item = document.createElement('div');
    item.className = `notif-item ${n.isRead ? 'read' : 'unread'}`;
    item.dataset.id = n.id;
    // Prevent dropdown sizing issues
    item.style.overflow = "hidden";

    // Content
    const left = document.createElement('div');
    left.className = 'notif-left';
    left.innerHTML = `
        ${getIconHtml(n.type)}
        <div class="notif-content">
            <div class="notif-title">${n.title || 'Bildirim'}</div>
            <div class="notif-message">${n.message}</div>
            <div class="notif-date">${getDateDisplay(n.createdAt || new Date())}</div>
        </div>
    `;
    left.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleNotificationClick(n.id, n.isRead);
    };

    // Actions
    const actions = document.createElement('div');
    actions.className = 'notif-actions';

    // Delete
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'notif-action-btn delete-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Sil';
    deleteBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation(); // CRITICAL: Stop Event
        removeNotification(n.id);
    };
    actions.appendChild(deleteBtn);

    // Mark Read
    if (!n.isRead) {
        const readBtn = document.createElement('button');
        readBtn.type = 'button';
        readBtn.className = 'notif-action-btn read-btn';
        readBtn.innerHTML = '📩';
        readBtn.title = 'Okundu işaretle';
        readBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation(); // CRITICAL: Stop Event
            markAsRead(n.id);
        };
        actions.appendChild(readBtn);
    }

    item.appendChild(left);
    item.appendChild(actions);
    return item;
}

// 5. Mark As Read (No Reload, Math Update)
async function markAsRead(id) {
    // UI Update (Immediate)
    const item = document.querySelector(`.notif-item[data-id="${id}"]`);
    if (item && item.classList.contains('unread')) {
        item.classList.remove('unread');
        item.classList.add('read');

        // Remove Read Button
        const readBtn = item.querySelector('.read-btn');
        if (readBtn) readBtn.remove();

        // Update Badge Math
        const badge = document.getElementById('notif-badge');
        if (badge) {
            let current = parseInt(badge.innerText) || 0;
            current = Math.max(0, current - 1);
            updateBadge(current);
        }
    }

    // Backend
    try {
        await fetch(`${API_URL}/notifications/${id}/read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${checkAuth()}` }
        });
    } catch (e) { console.error("Okundu hatası", e); }
}

// 6. Remove Notification (No Reload, Math Update)
async function removeNotification(id) {
    // UI Update (Immediate)
    const item = document.querySelector(`.notif-item[data-id="${id}"]`);
    if (item) {
        // Decrease badge if specific item was unread
        if (item.classList.contains('unread')) {
            const badge = document.getElementById('notif-badge');
            if (badge) {
                let current = parseInt(badge.innerText) || 0;
                current = Math.max(0, current - 1);
                updateBadge(current);
            }
        }
        item.remove();
    }

    // Check Empty State
    const list = document.getElementById('notificationList');
    if (list && list.children.length === 0) {
        list.innerHTML = `
            <div class="notif-empty">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div>
                <div>Henüz bildiriminiz yok</div>
            </div>`;
    }

    // Backend
    try {
        await fetch(`${API_URL}/notifications/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${checkAuth()}` }
        });
    } catch (e) {
        console.error("Silme hatası", e);
        showToast("Silinemedi", "error");
    }
}

// 7. Mark All Read
async function markAllNotificationsRead(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    // UI Update
    document.querySelectorAll('.notif-item.unread').forEach(item => {
        item.classList.remove('unread');
        item.classList.add('read');
        const btn = item.querySelector('.read-btn');
        if (btn) btn.remove();
    });
    updateBadge(0);

    // Backend
    const userId = getUserId();
    if (!userId) return;

    // Fetch unread IDs to mark them involved
    try {
        const res = await fetch(`${API_URL}/notifications/${userId}`, {
            headers: { 'Authorization': `Bearer ${checkAuth()}` }
        });
        if (res.ok) {
            const data = await res.json();
            const unreadIds = data.filter(n => !n.isRead).map(n => n.id);
            // Fire and forget
            unreadIds.forEach(id => {
                fetch(`${API_URL}/notifications/${id}/read`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${checkAuth()}` }
                }).catch(e => console.error(e));
            });
        }
    } catch (e) { console.error(e); }
}
// Expose globally
window.removeNotification = removeNotification;
window.markAsRead = markAsRead;
window.markAllNotificationsRead = markAllNotificationsRead;

// "Delete All" functionality can be added if needed, but not part of standard Gmail dropdown header usually.

// --- CANCEL RIDE ---
window.initiateCancelRide = async function (rideId) {
    const token = checkAuth();
    if (!token) return;

    // 1. Ask for Reason
    const { value: reason } = await Swal.fire({
        title: 'Yolculuğu İptal Et',
        input: 'select',
        inputOptions: {
            'Aracım bozuldu': 'Aracım bozuldu',
            'Hastalandım': 'Hastalandım',
            'Vazgeçtim': 'Vazgeçtim',
            'Diğer': 'Diğer'
        },
        inputPlaceholder: 'İptal nedenini seçin',
        showCancelButton: true,
        confirmButtonText: 'İptal Et',
        cancelButtonText: 'Vazgeç',
        confirmButtonColor: '#d33',
        inputValidator: (value) => {
            return !value && 'Bir neden seçmelisiniz!'
        }
    });

    if (!reason) return;

    // 2. Confirm (Simulating Reputation Warning)
    const result = await Swal.fire({
        title: 'Emin misiniz?',
        text: "Son dakika iptalleri güven puanınızı düşürebilir! Bu işlem geri alınamaz.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Evet, İptal Et!',
        cancelButtonText: 'Vazgeç'
    });

    if (!result.isConfirmed) return;

    try {
        const response = await fetch(`${API_URL}/rides/${rideId}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ reason: reason })
        });

        if (response.ok) {
            // Set flag and reload
            localStorage.setItem('cancelSuccess', 'true');
            window.location.reload();
        } else {
            const err = await response.text();
            showError("İptal işlemi başarısız: " + err);
        }
    } catch (e) {
        showError("Bağlantı hatası: " + e.message);
    }
}

// --- RIDE EDITING STATE ---
let editingRideId = null;

async function editRide(rideId) {
    const token = checkAuth();
    try {
        const res = await fetch(`${API_URL}/rides/${rideId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('İlan detayları alınamadı');

        const ride = await res.json();

        // Open Modal
        showCreateRideModal();

        // Update Modal UI for Editing
        document.querySelector('#createRideModal h3').innerText = 'İlanı Düzenle';
        document.getElementById('btnPublishRide').innerText = 'Değişiklikleri Kaydet';

        // Fill Form
        editingRideId = rideId;
        document.getElementById('newOrigin').value = ride.origin;
        document.getElementById('newDest').value = ride.destination;
        document.getElementById('newDate').value = ride.departureTime; // Flatpickr might need setDate
        document.getElementById('newSeats').value = ride.totalSeats;
        document.getElementById('newPrice').value = ride.price;

        // Update Flatpickr
        const dateInput = document.getElementById('newDate');
        if (dateInput._flatpickr) {
            dateInput._flatpickr.setDate(ride.departureTime);
        }

        // Trigger smart price hint update manually
        calculateSmartPrice();

    } catch (err) {
        showError('Hata: ' + err.message);
    }
}


async function republishRide(rideId) {
    const token = checkAuth();
    try {
        const res = await fetch(`${API_URL}/rides/${rideId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('İlan detayları alınamadı');

        const ride = await res.json();

        // Open Modal
        showCreateRideModal();

        // Update Modal UI for Re-publishing
        document.querySelector('#createRideModal h3').innerText = 'İlanı Yeniden Yayınla';
        document.getElementById('btnPublishRide').innerText = 'Yeni İlan Olarak Yayınla';

        // Fill Form (Clone Data)
        editingRideId = null; // IMPORTANT: Create NEW ride



        document.getElementById('newOrigin').value = ride.origin;
        document.getElementById('newDest').value = ride.destination;
        document.getElementById('newSeats').value = ride.totalSeats;
        document.getElementById('newPrice').value = ride.price;

        // HANDLE CHOICES.JS UPDATE
        if (typeof choicesInstances !== 'undefined' && choicesInstances.length > 0) {
            choicesInstances.forEach(c => {
                if (c.passedElement && c.passedElement.element) {
                    if (c.passedElement.element.id === 'newOrigin') c.setChoiceByValue(ride.origin);
                    if (c.passedElement.element.id === 'newDest') c.setChoiceByValue(ride.destination);
                }
            });
        }

        // Clear Date (User must pick new date)
        document.getElementById('newDate').value = "";
        if (document.getElementById('newDate')._flatpickr) {
            document.getElementById('newDate')._flatpickr.clear();
        }

        // Trigger smart price hint
        calculateSmartPrice();

        showToast('Bilgiler kopyalandı, lütfen yeni tarih seçiniz.', 'info');

    } catch (err) {
        showError('Hata: ' + err.message);
    }
}



function resetFilters() {
    const els = ['searchOrigin', 'searchDest', 'searchMaxPrice'];
    els.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const sort = document.getElementById('sortBy');
    if (sort) sort.value = 'dateAsc';

    // Reset choices if active
    if (typeof choicesInstances !== 'undefined') {
        choicesInstances.forEach(c => c.setChoiceByValue('')); // Might need tailored logic
    }

    loadRides();
}

// --- SMART PRICING ---
function calculateSmartPrice() {
    const origin = document.getElementById('newOrigin').value;
    const dest = document.getElementById('newDest').value;
    const priceInput = document.getElementById('newPrice');
    const hint = document.getElementById('priceHint');

    if (!origin || !dest || origin === dest) {
        if (hint) hint.innerText = "";
        return;
    }

    let key = `${origin}-${dest}`;
    let reverseKey = `${dest}-${origin}`;
    let dist = DISTANCE_MATRIX[key] || DISTANCE_MATRIX[reverseKey];

    if (!dist) {
        if ((origin.includes("Gönen") || dest.includes("Gönen"))) dist = 45;
        else if ((origin.includes("Susurluk") || dest.includes("Susurluk"))) dist = 55;
        else if ((origin.includes("Karacabey") || dest.includes("Karacabey"))) dist = 40;
        else if ((origin.includes("Erdek") || dest.includes("Erdek"))) dist = 20;
        else dist = 10;
    }

    const suggested = Math.round(10 + (dist * 2.5));
    priceInput.value = suggested;
    if (hint) {
        hint.innerHTML = `✨ Yapay zeka: <b>~${dist} km</b> için <b>${suggested}₺</b> öneriyor.`;
    }
    priceInput.style.borderColor = "#10b981";
    setTimeout(() => priceInput.style.borderColor = "#e2e8f0", 1000);
}

// --- FORCE UNREGISTER SERVICE WORKER (Fix Caching Issues) ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
            registration.unregister();
        }
    });
}

// --- CREATE RIDE HANDLER (Global) ---
// --- CREATE RIDE HANDLER (Rewritten for Reliability) ---
window.handleRideSubmit = async function () {
    const token = checkAuth();
    if (!token) return;

    const userId = getUserId();
    if (!userId) {
        Swal.fire('Hata', 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.', 'error').then(() => logout());
        return;
    }

    // 1. Collect & Validate Inputs
    const origin = document.getElementById('newOrigin').value;
    const dest = document.getElementById('newDest').value;
    const dateInput = document.getElementById('newDate');
    const seats = document.getElementById('newSeats').value;
    const price = document.getElementById('newPrice').value;

    if (!origin || !dest || !dateInput.value || !price) {
        showToast('Lütfen tüm alanları doldurunuz.', 'warning');
        return;
    }

    // 2. Prepare Payload
    let departureTimeStr = "";
    if (dateInput._flatpickr && dateInput._flatpickr.selectedDates.length > 0) {
        const d = dateInput._flatpickr.selectedDates[0];
        const dateOffset = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
        departureTimeStr = dateOffset.toISOString().slice(0, 19);
    } else {
        departureTimeStr = dateInput.value.replace(' ', 'T') + ':00';
    }

    const ride = {
        driverId: parseInt(userId),
        origin: origin,
        destination: dest,
        departureTime: departureTimeStr,
        totalSeats: parseInt(seats),
        price: parseFloat(price)
    };

    // 3. API Request
    try {
        let url = `${API_URL}/rides`;
        let method = 'POST';

        if (editingRideId) {
            url = `${API_URL}/rides/${editingRideId}`;
            method = 'PUT';
            ride.id = editingRideId;
        }

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(ride)
        });

        if (response.ok) {
            // --- SUCCESS FLOW (Flash Message) ---

            // 1. Save State
            localStorage.setItem('rideSuccess', editingRideId ? 'updated' : 'created');




            // 2. Reload Page (Ensures fresh state and matches Login Logic)
            window.location.reload();

        } else {
            const err = await response.text();
            showError("Hata: " + err);
        }
    } catch (err) {
        console.error(err);
        showError('Bağlantı hatası: ' + err.message);
    }
};

// --- MODALS & FORMS ---
function showCreateRideModal() {
    checkAuth();
    // Reset State
    editingRideId = null;
    document.querySelector('#createRideModal h3').innerText = 'Yeni İlan Oluştur';
    document.getElementById('btnPublishRide').innerText = 'İlanı Yayınla';

    populateLocationDropdowns(); // Ensure latest state
    const modal = document.getElementById('createRideModal');
    if (modal) {
        modal.style.display = 'flex';
        // Manual Reset since Form is gone
        document.getElementById('newOrigin').value = "";
        document.getElementById('newDest').value = "";
        document.getElementById('newDate').value = "";
        if (document.getElementById('newDate')._flatpickr) document.getElementById('newDate')._flatpickr.clear();
        document.getElementById('newSeats').value = "3";
        document.getElementById('newPrice').value = "";
        document.getElementById('priceHint').innerText = "";
        // Re-init select UI if needed or let Choices handle it
    }
}

// (Moved to DOMContentLoaded)

// --- REGISTRATION LOGIC ---
let isPhoneVerified = false;

function toggleDriverFields() {
    const isDriver = document.getElementById('isDriver').checked;
    const fields = document.getElementById('vehicleFields');
    if (fields) fields.style.display = isDriver ? 'block' : 'none';
}

function validatePhoneFormat(input) {
    let raw = input.value.replace(/\D/g, ''); // Strip non-digits

    // Auto-fix: Ensure starts with 0 if user enters 5...
    if (raw.length > 0 && raw[0] !== '0') {
        raw = '0' + raw;
    }

    // Limit to 11 digits (05XX...)
    if (raw.length > 11) raw = raw.substring(0, 11);

    // Format: 05XX XXX XX XX
    let formatted = raw;
    if (raw.length > 4) {
        formatted = raw.substring(0, 4) + ' ' + raw.substring(4);
    }
    if (raw.length > 7) {
        formatted = formatted.substring(0, 8) + ' ' + raw.substring(7);
    }
    if (raw.length > 9) {
        formatted = formatted.substring(0, 11) + ' ' + raw.substring(9);
    }

    input.value = formatted;

    const btn = document.getElementById('verifyPhoneBtn');
    // Check if valid (11 digits starting with 05)
    const isValid = (raw.length === 11 && raw.startsWith('05'));
    btn.disabled = !isValid;

    // Reset verification if changed
    if (isPhoneVerified) {
        isPhoneVerified = false;
        btn.innerText = "Doğrula";
        btn.classList.remove('btn-success');
        btn.classList.add('btn-secondary');
        document.getElementById('registerBtn').disabled = true;
        document.getElementById('registerBtn').innerText = "Kayıt Ol (Telefon Doğrulanmalı)";
        document.getElementById('registerBtn').style.opacity = "0.6";
    }
}

async function verifyPhone() {
    const phone = document.getElementById('phoneNumber').value;

    // 1. Send Code (Mock)
    Swal.fire({ title: 'Kod Gönderiliyor...', timer: 1000, didOpen: () => Swal.showLoading() });
    await new Promise(r => setTimeout(r, 1000));

    // 2. Input Code
    const { value: code } = await Swal.fire({
        title: 'Doğrulama Kodu',
        text: `Lütfen ${phone} numarasına gönderilen 4 haneli kodu giriniz. (Demo Kodu: 1234)`,
        input: 'text',
        inputPlaceholder: '1234',
        confirmButtonText: 'Doğrula'
    });

    // 3. Verify
    if (code === '1234') {
        isPhoneVerified = true;
        Swal.fire('Başarılı', 'Telefon numarası doğrulandı!', 'success');

        const btn = document.getElementById('verifyPhoneBtn');
        btn.innerText = "Doğrulandı ✓";
        btn.disabled = true;
        btn.style.backgroundColor = "#10b981";
        btn.style.color = "white";

        document.getElementById('phoneNumber').disabled = true;

        document.getElementById('registerBtn').disabled = false;
        document.getElementById('registerBtn').innerText = "Kayıt Ol";
        document.getElementById('registerBtn').style.opacity = "1";
    } else {
        Swal.fire('Hata', 'Girdiğiniz kod hatalı!', 'error');
    }
}

// LOGIN / REGISTER
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST', body: JSON.stringify({ email, password }), headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                const data = await res.json();

                // CHECK REMEMBER ME
                const rememberMe = document.getElementById('rememberMe').checked;
                if (rememberMe) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('userId', data.userId);
                    localStorage.setItem('userType', data.userType);
                } else {
                    sessionStorage.setItem('token', data.token);
                    sessionStorage.setItem('userId', data.userId);
                    sessionStorage.setItem('userType', data.userType);
                }

                window.location.href = 'dashboard.html';
            } else {
                const errText = await res.text();
                showError('Giriş başarısız: ' + errText);
            }
        } catch (e) {
            console.error(e);
            showError('Bağlantı Hatası: ' + e.message);
        }
    });
}

function getUserId() {
    return sessionStorage.getItem('userId') || localStorage.getItem('userId');
}

// --- PROFILE MANAGEMENT ---
async function loadProfile() {
    const token = checkAuth();
    const userId = getUserId();
    if (!userId) return;

    // CHECK FLASH MESSAGE (Profile)
    if (localStorage.getItem('profileSuccess')) {
        localStorage.removeItem('profileSuccess');
        showToast('Profil bilgileriniz başarıyla güncellendi! ✅');
    }

    try {
        const res = await fetch(`${API_URL}/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Profil yüklenemedi');

        const data = await res.json();

        document.getElementById('pFirstName').value = data.firstName;
        document.getElementById('pLastName').value = data.lastName;
        document.getElementById('pEmail').value = data.email;
        document.getElementById('pPhone').value = data.phoneNumber;
        document.getElementById('pUserType').value = data.userType;

        if (data.vehicle) {
            document.getElementById('vPlate').value = data.vehicle.plateNumber;
            document.getElementById('vModel').value = data.vehicle.model;
            document.getElementById('vColor').value = data.vehicle.color;
        }
    } catch (err) { showError(err.message); }
}

async function updateProfile(e) {
    e.preventDefault();
    const token = checkAuth();
    const userId = getUserId();

    const dto = {
        id: parseInt(userId),
        firstName: document.getElementById('pFirstName').value,
        lastName: document.getElementById('pLastName').value,
        email: document.getElementById('pEmail').value,
        phoneNumber: document.getElementById('pPhone').value,
        userType: document.getElementById('pUserType').value,
        vehicle: null
    };

    const plate = document.getElementById('vPlate').value;
    if (plate) {
        dto.vehicle = {
            plateNumber: plate,
            model: document.getElementById('vModel').value,
            color: document.getElementById('vColor').value
        };
    }

    try {
        const res = await fetch(`${API_URL}/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(dto)
        });

        if (res.ok) {
            // FLASH MESSAGE: Save state and reload
            localStorage.setItem('profileSuccess', 'true');
            window.location.reload();
        } else {
            showError('Güncelleme başarısız: ' + await res.text());
        }
    } catch (err) { showError(err.message); }
}


// Register Form Logic - Wrapped to ensure DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // --- CREATE RIDE FORM ---
    // (Moved to Global Scope)

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        // Auto-Fill Listener
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.addEventListener('input', (e) => {
                const val = e.target.value;
                const parts = val.split('@');
                if (parts.length < 1) return;
                const local = parts[0];

                try {
                    // Try/Catch for safety against external function calls
                    // 1. Numeric -> Student ID
                    if (/^\d+$/.test(local) && document.getElementById('studentId')) {
                        document.getElementById('studentId').value = local;
                        const userTypeEl = document.getElementById('userType');
                        if (userTypeEl) userTypeEl.value = 'Student';

                        if (typeof toggleUserFields === 'function') toggleUserFields();
                    }
                    // 2. Name-Based (ad.soyad) -> Name Fields
                    else if (local.includes('.')) {
                        const names = local.split('.');
                        if (names.length >= 2) {
                            const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
                            const fname = document.getElementById('firstName');
                            const lname = document.getElementById('lastName');
                            if (fname) fname.value = cap(names[0]);
                            if (lname) lname.value = cap(names[names.length - 1]);
                        }
                    }
                } catch (err) { console.error("Auto-fill error:", err); }
            });
        }

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // CRITICAL: Stop reload

            const email = document.getElementById('email').value;

            // --- VALIDATION: .edu check ---
            if (!email.includes('.edu') && !email.includes('bandirma.edu.tr')) {
                Swal.fire({
                    icon: 'error',
                    title: 'Hatalı E-posta',
                    text: 'Sadece üniversite e-postaları (.edu veya .edu.tr) ile kayıt olabilirsiniz.',
                    confirmButtonColor: '#ef4444'
                });
                return;
            }

            if (!isPhoneVerified) {
                showError("Lütfen telefon numaranızı doğrulayınız.");
                return;
            }

            const firstName = document.getElementById('firstName').value;
            const lastName = document.getElementById('lastName').value;
            const password = document.getElementById('password').value;
            const userType = document.getElementById('userType').value;
            // Send CLEAN number (without spaces) to backend
            const phoneNumber = document.getElementById('phoneNumber').value.replace(/\s/g, '');
            const isDriver = document.getElementById('isDriver') ? document.getElementById('isDriver').checked : false;

            const payload = {
                firstName,
                lastName,
                email,
                password,
                userType,
                phoneNumber,
                isDriver
            };

            if (isDriver) {
                payload.vehicle = {
                    plateNumber: document.getElementById('plateNumber').value,
                    model: document.getElementById('vehicleModel').value,
                    color: document.getElementById('vehicleColor').value
                };
            }

            if (document.getElementById('studentId')) payload.studentId = document.getElementById('studentId').value;
            if (document.getElementById('academicianTitle')) payload.academicianTitle = document.getElementById('academicianTitle').value;

            try {
                const res = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' }
                });
                if (res.ok) {
                    // FLASH MESSAGE: Redirect immediately, show message on Login page
                    localStorage.setItem('registrationSuccess', 'true');
                    window.location.href = 'login.html';
                } else {
                    const errorText = await res.text();
                    showError(errorText);
                }
            } catch (e) { showError(e); }
        });
    }

    // CHECK FLASH MESSAGE (Login Page)
    if (localStorage.getItem('registrationSuccess')) {
        localStorage.removeItem('registrationSuccess');
        // Delay slightly to ensure page is ready
        // Delay slightly to ensure page is ready
        setTimeout(() => {
            showToast('Hesabınız oluşturuldu. Lütfen giriş yapınız. 🎉');
        }, 300);
    }
});

function logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
}

function forgotPassword() {
    Swal.fire({
        title: 'Şifre Sıfırlama',
        text: 'E-posta adresinizi giriniz:',
        input: 'email',
        inputPlaceholder: 'ornek@ogr.bandirma.edu.tr',
        showCancelButton: true,
        confirmButtonText: 'Gönder',
        cancelButtonText: 'İptal',
        confirmButtonColor: 'var(--primary-color)'
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            Swal.fire({
                title: 'E-posta Gönderildi (Demo)',
                html: `${result.value} adresine sıfırlama talimatları gönderildi.<br><br>
                       <small style="color:gray;">*Bu bir demo projesidir, gerçek e-posta gönderilmez.</small>`,
                icon: 'success'
            });
        }
    });
}

async function reserveRide(rideId) {
    const token = checkAuth();
    if (!token) return;

    const userId = getUserId();
    if (!userId) {
        logout(); // Should be handled by checkAuth but safety first
        return;
    }

    // confirm
    const result = await Swal.fire({ title: 'Rezervasyon?', showCancelButton: true, confirmButtonText: 'Evet' });
    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/rides/${rideId}/reserve?userId=${userId}`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            localStorage.setItem('rideAction', 'reserved');
            window.location.reload();
        } else {
            const txt = await res.text();
            showError(txt);
        }
    } catch (e) { showError('Hata'); }
}

// --- BANÜ-BOT AI LOGIC (V3 - Enhanced) ---
let isChatOpen = false;

// KNOWLEDGE BASE (Eğitilmiş Veri)
const knowledgeBase = [
    {
        keywords: ['merhaba', 'selam', 'hi', 'günaydın', 'iyi akşamlar'],
        response: "Merhaba! 👋 Size nasıl yardımcı olabilirim? İlan arayabilir, fiyat sorabilir veya sistem hakkında bilgi verebilirim.",
        chips: ["Fiyatlar?", "Güvenli mi?"]
    },
    {
        keywords: ['nasılsın', 'naber'],
        response: "Dijital dünyamda harikayım! 🤖 Senin yolculuğunu planlamak için sabırsızlanıyorum.",
        chips: []
    },
    {
        keywords: ['teşekkür', 'sağol', 'eyvallah'],
        response: "Rica ederim! Her zaman buradayım. 🚗",
        chips: []
    },
    {
        keywords: ['fiyat', 'ücret', 'para', 'kaç tl', 'ne kadar'],
        response: "💰 **Ücret Politikası:**\nFiyatları sürücüler belirler ancak sistemimiz mesafe başına adil bir tavan fiyat önerir.\n\n• Bandırma - Erdek: ~50-60 TL\n• Bandırma - Bursa: ~200-250 TL\n• Kampüs - Merkez: ~15-20 TL",
        chips: ["İlanlara Git"]
    },
    {
        keywords: ['güven', 'emniyet', 'korkuyorum', 'tehlike'],
        response: "🛡️ **Güvenlik Önceliklidir:**\n• Tüm sürücülerimiz **BANÜ öğrencisi** olmak zorundadır.\n• Okul e-postası (@ogr.bandirma.edu.tr) ile doğrulama yapılır.\n• Yolculuk sonrası sürücüyü puanlayabilirsiniz.",
        chips: ["Sürücü Nasıl Olunur?"]
    },
    {
        keywords: ['sürücü', 'şoför', 'ilan ver', 'ilan oluştur', 'yolcu al'],
        activeFunction: 'createRide',
        response: "Sürücü olmak harika bir fikir! Hem masraflarını çıkarırsın hem de sosyalleşirsin. Senin için ilan oluşturma ekranını açıyorum... 🚘",
        chips: []
    },
    {
        keywords: ['bandırma', 'erdek', 'gönen', 'susurluk', 'bursa', 'kampüs', 'otogar', 'ido'],
        activeFunction: 'searchLocation',
        response: "Konum algılandı. Sizi ilgili seferlere yönlendiriyorum... 📍",
        chips: []
    },
    {
        keywords: ['iptal', 'vazgeçtim', 'rezervasyon iptali'],
        response: "Rezervasyonunuzu 'İlanlarım' sekmesinden yönetebilirsiniz. Yolculuğa 24 saat kala yapılan iptallerde sürücüye bildirim gider.",
        chips: ["İlanlarım"]
    },
    {
        keywords: ['iletişim', 'destek', 'yardım', 'telefon'],
        response: "Bana buradan yazabilirsin! Ama teknik bir sorun varsa **destek@bandirma.edu.tr** adresine mail atabilirsin.",
        chips: []
    },
    {
        keywords: ['ilanlara git', 'ilanlar', 'seferler', 'yolculuk bul'],
        activeFunction: 'goToRides',
        response: "Sizi hemen ilanlar sayfasına ışınlıyorum! 🚀",
        chips: []
    }
];

function toggleChat() {
    isChatOpen = !isChatOpen;
    const window = document.querySelector('.chat-window');
    const toggle = document.querySelector('.chat-toggle');

    if (isChatOpen) {
        window.classList.add('active');
        toggle.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="white"/></svg>';
        toggle.style.background = 'var(--accent-color)';
        setTimeout(() => document.getElementById('chatInput').focus(), 300);

        // Show initial chips if chat is empty
        const chatBody = document.getElementById('chatBody');
        if (chatBody.children.length <= 2) {
            showQuickReplies(["İlan Ver", "Fiyatlar?", "Güvenli mi?"]);
        }
    } else {
        window.classList.remove('active');
        toggle.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white"/></svg>';
        toggle.style.background = '';
    }
}

function showQuickReplies(options) {
    const container = document.getElementById('chatOptions');
    if (!container) return;

    // FIX: Use double quotes for onclick to allow single quotes in text (e.g. Bandırma'ya)
    container.innerHTML = options.map(opt =>
        `<button class="chat-chip" onclick='handleChipClick("${opt}")'>${opt}</button>`
    ).join('');

    container.scrollLeft = 0;
}

function handleChipClick(text) {
    const input = document.getElementById('chatInput');
    input.value = text;
    sendMessage();
}

function handleChatKey(e) {
    if (e.key === 'Enter') sendMessage();
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    const chipsContainer = document.getElementById('chatOptions');
    if (chipsContainer) chipsContainer.innerHTML = '';

    addMessage(text, 'user');
    input.value = '';

    const typing = document.getElementById('typingIndicator');
    const chatBody = document.getElementById('chatBody');
    typing.style.display = 'flex';
    chatBody.scrollTop = chatBody.scrollHeight;

    setTimeout(() => {
        typing.style.display = 'none';
        const responseData = getBotResponse(text);
        addMessage(responseData.text, 'bot');

        if (responseData.chips && responseData.chips.length > 0) {
            showQuickReplies(responseData.chips);
        }
        chatBody.scrollTop = chatBody.scrollHeight;
    }, 600 + Math.random() * 400);
}

function addMessage(text, sender) {
    const chatBody = document.getElementById('chatBody');
    const typing = document.getElementById('typingIndicator');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender}`;
    // Convert newlines to <br> for formatting
    msgDiv.innerHTML = text.replace(/\n/g, '<br>');

    chatBody.insertBefore(msgDiv, typing);
    chatBody.scrollTop = chatBody.scrollHeight;
}

function getBotResponse(input) {
    const lower = input.toLocaleLowerCase('tr-TR').replace(/[?.,!]/g, '');

    // 1. Search in Knowledge Base
    for (const entry of knowledgeBase) {
        if (entry.keywords.some(k => lower.includes(k))) {

            // Handle Actions
            if (entry.activeFunction === 'createRide') {
                if (typeof showCreateRideModal === 'function') setTimeout(() => showCreateRideModal(), 1500);
            }
            if (entry.activeFunction === 'searchLocation') {
                // Determine location from input
                const location = entry.keywords.find(k => lower.includes(k));
                if (typeof switchTab === 'function' && document.getElementById('searchOrigin')) {
                    setTimeout(() => {
                        document.querySelector('.search-bar-container').scrollIntoView({ behavior: 'smooth' });
                        document.getElementById('searchOrigin').focus();
                        // Optional: Pre-fill if needed
                    }, 800);
                    return {
                        text: `Anlaşıldı, <b>${location.toLocaleUpperCase('tr-TR')}</b> için arama başlatıyorum... 📍`,
                        chips: []
                    };
                }
            }


            if (entry.activeFunction === 'goToRides') {
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            }

            return { text: entry.response, chips: entry.chips };
        }
    }

    // 2. Fallback
    return {
        text: "Bunu henüz öğrenmedim. 🧠 Ama zamanla daha akıllı olacağım! Şimdilik şunları deneyebilirsin:",
        chips: ["Güvenlik Politikası", "Nasıl İlan Verilir?"]
    };
}

// --- FOOTER MODALS ---
function showSupport() {
    Swal.fire({
        id: 'support-modal',
        title: '📞 7/24 Destek',
        html: `
            <div style="text-align: left; font-size: 0.95rem;">
                <p>Her türlü soru ve sorununuz için bize ulaşabilirsiniz.</p>
                <div style="background: rgba(99, 102, 241, 0.1); padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                    <p>📧 <b>E-posta:</b> destek@banu-pool.com</p>
                    <p>📱 <b>WhatsApp:</b> +90 555 123 45 67</p>
                    <p>📍 <b>Ofis:</b> BANÜ Teknokent, Ofis 204</p>
                </div>
                <p><small>*Mesai saatleri (09:00 - 18:00) içinde ortalama yanıt süremiz 15 dakikadır.</small></p>
            </div>
        `,
        confirmButtonText: 'Tamam',
        confirmButtonColor: 'var(--primary-color)'
    });
}

function showPrivacy() {
    Swal.fire({
        id: 'privacy-modal',
        title: '🔒 Gizlilik Politikası',
        html: `
            <div style="text-align: left; max-height: 300px; overflow-y: auto; font-size: 0.9rem;">
                <p>BANÜ-Pool olarak kişisel verilerinize önem veriyoruz.</p>
                <h4>1. Toplanan Veriler</h4>
                <p>Ad, soyad, öğrenci numarası, e-posta ve güzergah bilgileriniz.</p>
                <h4>2. Veri Kullanımı</h4>
                <p>Bu bilgiler sadece eşleştirme ve güvenlik amacıyla kullanılır.</p>
                <h4>3. Çerezler</h4>
                <p>Oturum güvenliği için zorunlu çerezler kullanılmaktadır.</p>
                <br>
                <p class="text-xs text-gray-500">Son güncelleme: 27.12.2025</p>
            </div>
        `,
        confirmButtonText: 'Anladım',
        confirmButtonColor: 'var(--accent-color)'
    });
}

function showTerms() {
    Swal.fire({
        id: 'terms-modal',
        title: '📜 Kullanım Koşulları',
        html: `
             <div style="text-align: left; max-height: 300px; overflow-y: auto; font-size: 0.9rem;">
                <p>Sistemi kullanarak aşağıdaki şartları kabul etmiş sayılırsınız:</p>
                <ul>
                    <li>Sürücüler ve yolcular birbirlerine karşı saygılı olmak zorundadır.</li>
                    <li>Yolculuk masrafları paylaşımı kar amacı gütmez.</li>
                    <li>Sistem, sadece platform sağlayıcıdır; yolculuk sırasında doğabilecek aksaklıklardan sorumlu değildir.</li>
                    <li>Yanlış beyanda bulunan hesaplar süresiz kapatılır.</li>
                </ul>
            </div>
        `,
        confirmButtonText: 'Kabul Ediyorum',
        confirmButtonColor: '#10b981'
    });
}

// --- PWA INIT ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered:', reg.scope))
            .catch(err => console.log('SW Error:', err));
    });
}

// --- Rating System ---
async function openRateModal(rideId, driverId) {
    const { value: formValues } = await Swal.fire({
        title: 'Sürücüyü Puanla',
        html:
            '<select id="swal-score" class="swal2-input">' +
            '<option value="5">⭐⭐⭐⭐⭐ (5)</option>' +
            '<option value="4">⭐⭐⭐⭐ (4)</option>' +
            '<option value="3">⭐⭐⭐ (3)</option>' +
            '<option value="2">⭐⭐ (2)</option>' +
            '<option value="1">⭐ (1)</option>' +
            '</select>' +
            '<textarea id="swal-comment" class="swal2-textarea" placeholder="Yorumunuz..." maxlength="100"></textarea>',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Gönder',
        cancelButtonText: 'Vazgeç',
        preConfirm: () => {
            return {
                score: document.getElementById('swal-score').value,
                comment: document.getElementById('swal-comment').value
            }
        }
    });

    if (formValues) {
        try {
            const token = checkAuth();
            const raterId = getUserId();

            const reviewData = {
                raterId: parseInt(raterId),
                rateeId: parseInt(driverId), // Rating the driver
                rideId: parseInt(rideId),
                score: parseInt(formValues.score),
                comment: formValues.comment
            };

            const res = await fetch(`${API_URL}/reviews`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(reviewData)
            });

            if (res.ok) {
                showToast('Puanınız kaydedildi!');
            } else {
                const txt = await res.text();
                showError('Puanlama başarısız: ' + txt);
            }
        } catch (err) {
            showError('Hata: ' + err.message);
        }
    }
}

// --- Notification System ---
let notifPollInterval = null;

function startNotificationPolling() {
    if (notifPollInterval) return;
    checkNotifications(); // Initial check
    notifPollInterval = setInterval(checkNotifications, 10000); // Check every 10 sec
}

async function checkNotifications() {
    const token = checkAuth();
    const userId = getUserId();
    if (!token || !userId) return;

    try {
        const res = await fetch(`${API_URL}/notifications/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const notes = await res.json();
            const badge = document.getElementById('notif-badge');
            if (badge) {
                const unreadCount = notes.filter(n => !n.isRead).length;
                if (unreadCount > 0) {
                    badge.innerText = unreadCount;
                    badge.classList.add('active');
                } else {
                    badge.classList.remove('active');
                }
            }
            window.latestNotifications = notes; // Store for modal
        }
    } catch (e) { console.error("Notif poll error", e); }
}

async function showNotifications() {
    const notes = window.latestNotifications || [];

    // Auto mark all read in backend (silent)
    if (notes.some(n => !n.isRead)) {
        markAllReadSilent();
        // We do NOT update notes.isRead here, so they appear 'fresh' (bright) in this view.
        // We DO clear the badge immediately for feedback.
        const badge = document.getElementById('notif-badge');
        if (badge) {
            badge.innerText = '';
            badge.classList.remove('active');
        }
    }

    if (notes.length === 0) {
        Swal.fire('Bildirimler', 'Bildiriminiz yok.', 'info');
        return;
    }

    const html = `
        <div class="notif-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(0,0,0,0.05); padding-right: 40px;">
            <h3 style="margin:0; font-size:1.25rem;">Bildirimler</h3>
            <button onclick="confirmDeleteAll()" class="btn-text" style="color:#ef4444; font-size:0.85rem;">
                Tümünü Temizle
            </button>
        </div>
        <div class="notif-list" style="max-height:400px; overflow-y:auto; text-align:left; padding-right:5px;">
            ${notes.map(n => `
                <div class="notif-item read" id="notif-${n.id}" style="padding:12px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:start; transition:all 0.2s; border:1px solid transparent; opacity:0.8;">
                    <div style="flex:1; padding-right:10px;">
                        <span style="display:block; font-weight:500; color:var(--text-primary); margin-bottom:4px; line-height:1.4;">${n.message}</span>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">
                            ${new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                    <div class="notif-actions" style="display:flex; gap:8px; align-items:center;">
                        <button onclick="deleteNotification(${n.id})" title="Sil" class="icon-btn danger">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    Swal.fire({
        html: html,
        showConfirmButton: false,
        showCloseButton: true,
        width: 550,
        customClass: { popup: 'swal-notif-popup' }
    });
}

async function markAllReadSilent() {
    const token = checkAuth();
    const userId = getUserId();
    if (!token) return;
    try {
        await fetch(`${API_URL}/notifications/read-all/${userId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch (e) { console.error(e); }
}

window.confirmDeleteAll = function () {
    Swal.fire({
        title: 'Tümünü Temizle?',
        text: "Tüm bildirimleriniz kalıcı olarak silinecek.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#aaa',
        confirmButtonText: 'Evet, Sil',
        cancelButtonText: 'Vazgeç',
        target: '.swal-notif-popup' // Attempt to stack over existing if possible, or it replaces it.
    }).then((result) => {
        if (result.isConfirmed) {
            deleteAllNotifications();
        } else {
            // Re-open notifications if cancelled? 
            // Better: User just cancelled, they can re-open.
            // Or use chaining.
            showNotifications();
        }
    });
};

async function deleteAllNotifications() {
    const token = checkAuth();
    const userId = getUserId();
    if (!token) return;
    try {
        await fetch(`${API_URL}/notifications/delete-all/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        showToast('Bildirimler temizlendi.');
        checkNotifications(); // Updates badge and list
    } catch (e) { console.error(e); }
}

window.deleteNotification = async function (id) {
    const token = checkAuth();
    if (!token) return;
    try {
        await fetch(`${API_URL}/notifications/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const item = document.getElementById(`notif-${id}`);
        if (item) item.remove();
        checkNotifications();
    } catch (e) { console.error(e); }
};

// --- SIGNALR REAL-TIME NOTIFICATIONS ---
let connection = null;

async function initializeSignalR() {
    const token = checkAuth();
    if (!token) return;

    if (connection && connection.state === signalR.HubConnectionState.Connected) return;

    connection = new signalR.HubConnectionBuilder()
        .withUrl(`${API_URL.replace('/api', '')}/notificationHub`, {
            accessTokenFactory: () => checkAuth()
        })
        .withAutomaticReconnect()
        .build();

    // Event Handler: Receive Notification
    connection.on("ReceiveNotification", (notification) => {
        console.log("New Notification:", notification);

        // 1. Show Toast
        showToast(notification.title || "Yeni Bildirim", "info");

        // 2. Play Sound (Optional - might be blocked by browser)
        // const audio = new Audio('assets/notification.mp3'); 
        // audio.play().catch(e => console.log('Audio play failed', e));

        // 3. Update Badge
        if (typeof globalUnreadCount !== 'undefined') {
            globalUnreadCount++;
            updateBadge(globalUnreadCount);
        }

        // 4. Prepend to List if it exists
        const list = document.getElementById('notificationList');
        if (list) {
            // Remove "Empty" loading/message if exists
            const emptyMsg = list.querySelector('.notif-loading') || list.querySelector('.notif-empty');
            if (emptyMsg) emptyMsg.remove();

            const item = createNotificationItem(notification);
            list.prepend(item);
        }
    });

    try {
        await connection.start();
        console.log("SignalR Connected!");
    } catch (err) {
        console.error("SignalR Connection Failed: ", err);
    }
}

function createNotificationItem(n) {
    const item = document.createElement('div');
    item.className = `notif-item ${n.isRead ? 'read' : 'unread'}`;
    item.dataset.id = n.id;

    // Content Container
    const left = document.createElement('div');
    left.className = 'notif-left';
    left.innerHTML = `
        ${getIconHtml(n.type)}
        <div class="notif-content">
            <div class="notif-title">${n.title || 'Bildirim'}</div>
            <div class="notif-message">${n.message}</div>
            <div class="notif-date">${getDateDisplay(n.createdAt || new Date())}</div>
        </div>
    `;
    left.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleNotificationClick(n.id, n.isRead);
    };

    // Actions Container
    const actions = document.createElement('div');
    actions.className = 'notif-actions';

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'notif-action-btn delete-btn';
    deleteBtn.title = 'Sil';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeNotification(e, n.id);
    };
    actions.appendChild(deleteBtn);

    // Mark Read Button (if unread)
    if (!n.isRead) {
        const readBtn = document.createElement('button');
        readBtn.type = 'button';
        readBtn.className = 'notif-action-btn read-btn';
        readBtn.title = 'Okundu işaretle';
        readBtn.innerHTML = '📩';
        readBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            markAsRead(e, n.id);
        };
        actions.appendChild(readBtn);
    }

    item.appendChild(left);
    item.appendChild(actions);
    return item;
}

// Start SignalR if user is logged in (Safe check, no redirect)
const savedToken = sessionStorage.getItem('token') || localStorage.getItem('token');
if (savedToken) {
    // Initial fetch to populate list
    loadNotifications();
    // Start Real-time
    initializeSignalR();
}

// --- LOGIN LOGIC (Safe Append) ---
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        // Handle form submission via JS
        const handleLogin = async (e) => {
            if (e) e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('rememberMe').checked;

            if (!email || !password) {
                showError('Lütfen tüm alanları doldurunuz.');
                return;
            }

            try {
                const res = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (res.ok) {
                    const data = await res.json();

                    // Store Session Data & Clear Opposing Storage
                    if (rememberMe) {
                        localStorage.setItem('token', data.token);
                        localStorage.setItem('userId', data.userId);
                        sessionStorage.removeItem('token');
                        sessionStorage.removeItem('userId');
                    } else {
                        sessionStorage.setItem('token', data.token);
                        sessionStorage.setItem('userId', data.userId);
                        localStorage.removeItem('token');
                        localStorage.removeItem('userId');
                    }

                    showToast('Giriş başarılı! Yönlendiriliyorsunuz...', 'success');

                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1000);
                } else {
                    const txt = await res.text();
                    showError('Giriş başarısız: ' + txt);
                }
            } catch (err) {
                showError('Bağlantı hatası: ' + err.message);
            }
        };

        // Attach to submit listener
        loginForm.addEventListener('submit', handleLogin);

        // Also attach to the button explicitly for safety
        const btn = loginForm.querySelector('button[type="submit"]');
        if (btn) btn.onclick = handleLogin;
    }
});

