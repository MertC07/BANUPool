/**
 * SignalR Notification Service for BANÜ-Pool
 * Handles real-time events for bookings and cancellations.
 */

const NOTIFICATION_HUB_URL = "http://localhost:5200/rideHub";
const NOTIF_API_URL = "http://localhost:5200/api";

const NotificationService = {
    connection: null,

    init: async function () {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) return; // Not logged in

        // If already connected, do nothing
        if (this.connection) return;

        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(NOTIFICATION_HUB_URL, {
                accessTokenFactory: () => token
            })
            .withAutomaticReconnect()
            .build();

        // Handle ReceiveBookingNotification (Success/Info)
        this.connection.on("ReceiveBookingNotification", (message) => {
            this.showNotificationUI(message, 'success');
            this.incrementBadgeCount();
            this.fetchUnreadNotifications(); // Refresh list
        });

        // Handle ReceiveCancellationNotification (Warning)
        this.connection.on("ReceiveCancellationNotification", (message) => {
            this.showNotificationUI(message, 'warning');
            this.incrementBadgeCount();
            this.fetchUnreadNotifications(); // Refresh list
        });

        // Handle Generic Notification
        this.connection.on("ReceiveNotification", (message) => {
            this.showNotificationUI(message, 'info');
            this.incrementBadgeCount();
            this.fetchUnreadNotifications();
        });

        try {
            await this.connection.start();
            console.log("Registered for real-time updates.");
        } catch (err) {
            console.error("SignalR Connection Error: ", err);
        }
    },

    stop: async function () {
        if (this.connection) {
            await this.connection.stop();
            console.log("SignalR Disconnected.");
        }
    },

    showNotificationUI: function (message, type) {
        if (typeof Swal !== 'undefined') {
            const icon = type === 'warning' ? 'warning' : (type === 'success' ? 'success' : 'info');

            if (icon === 'warning') {
                Swal.fire({
                    icon: 'warning',
                    title: 'Dikkat!',
                    text: message,
                    confirmButtonText: 'Tamam'
                });
            } else {
                const Toast = Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true
                });
                Toast.fire({
                    icon: icon,
                    title: message
                });
            }
        } else {
            console.log(`[${type}] ${message}`);
            alert(message);
        }
    },

    // --- PERSISTENCE & UI LOGIC ---
    unreadCount: 0,

    // Fetches ONLY unread count for Badge (runs on every page)
    fetchUnreadNotifications: async function () {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) return;

            const res = await fetch(`${NOTIF_API_URL}/notifications/unread`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const notifications = await res.json();
                this.updateBadgeUI(notifications.length);
            }
        } catch (e) {
            console.error("Failed to fetch notifications", e);
        }
    },

    // Fetches ALL notifications for the dedicated page
    loadAllNotificationsPage: async function () {
        const list = document.getElementById('fullNotificationList');
        if (!list) return; // Not on notifications page

        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) return;

            const res = await fetch(`${NOTIF_API_URL}/notifications`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const notifications = await res.json();
                this.renderFullList(notifications);

                // Also update badge since we might have read some silently or just to sync
                const unreadCount = notifications.filter(n => !n.isRead).length;
                this.updateBadgeUI(unreadCount);
            } else {
                throw new Error("API responded with " + res.status);
            }
        } catch (e) {
            console.error("Failed to fetch all notifications", e);
            list.innerHTML = '<p style="padding: 2rem; text-align: center; color: #ef4444;">Yükleme hatası.</p>';
        }
    },

    updateBadgeCount: function (increment) {
        this.unreadCount += increment;
        this.updateBadgeUI(this.unreadCount);
    },

    updateBadgeUI: function (count) {
        this.unreadCount = count;
        const badge = document.getElementById('notificationBadge');
        if (!badge) return;

        if (count > 0) {
            badge.style.display = 'flex'; // Changed to flex for centering
            badge.innerText = count > 9 ? '9+' : count;
        } else {
            badge.style.display = 'none';
        }
    },

    // --- BULK ACTIONS ---
    selectedIds: [],

    toggleSelectAll: function (isChecked) {
        const checkboxes = document.querySelectorAll('.notif-checkbox');
        this.selectedIds = [];
        checkboxes.forEach(cb => {
            cb.checked = isChecked;
            if (isChecked) this.selectedIds.push(parseInt(cb.value));
        });
        this.updateBulkActionUI();
    },

    toggleSelection: function (id, isChecked) {
        if (isChecked) {
            this.selectedIds.push(id);
        } else {
            this.selectedIds = this.selectedIds.filter(idx => idx !== id);
        }

        // Update "Select All" checkbox state
        const allCheckboxes = document.querySelectorAll('.notif-checkbox');
        const selectAllCb = document.getElementById('selectAllCheckbox');
        if (selectAllCb) {
            selectAllCb.checked = allCheckboxes.length > 0 && this.selectedIds.length === allCheckboxes.length;
        }

        this.updateBulkActionUI();
    },

    updateBulkActionUI: function () {
        const btnDelete = document.getElementById('btnDeleteSelected');
        if (btnDelete) {
            if (this.selectedIds.length > 0) {
                btnDelete.style.display = 'inline-block';
                btnDelete.innerText = `🗑️ Seçilenleri Sil (${this.selectedIds.length})`;
            } else {
                btnDelete.style.display = 'none';
            }
        }
    },

    markAllAsRead: async function () {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) return;

            const res = await fetch(`${NOTIF_API_URL}/notifications/mark-all-read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                this.loadAllNotificationsPage();
                showToast("Tüm bildirimler okundu olarak işaretlendi.", "success");
            }
        } catch (e) {
            console.error("Failed mark all read", e);
        }
    },

    deleteSelectedNotifications: async function () {
        if (this.selectedIds.length === 0) return;
        if (!confirm(`${this.selectedIds.length} adet bildirimi silmek istediğinize emin misiniz?`)) return;

        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) return;

            const res = await fetch(`${NOTIF_API_URL}/notifications/delete-batch`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.selectedIds)
            });

            if (res.ok) {
                this.selectedIds = [];
                this.updateBulkActionUI();
                const selectAllCb = document.getElementById('selectAllCheckbox');
                if (selectAllCb) selectAllCb.checked = false;

                this.loadAllNotificationsPage();
                showToast("Seçilen bildirimler silindi.", "success");
            }
        } catch (e) {
            console.error("Failed batch delete", e);
        }
    },

    // --- REDESIGN logic ---
    currentTab: 'all', // all, unread, important

    switchTab: function (tab) {
        this.currentTab = tab;
        document.querySelectorAll('.notif-tab').forEach(t => {
            t.classList.remove('active');
            t.style.borderBottom = 'none';
            t.style.color = '#64748b';
        });
        const activeBtn = document.getElementById(`tab-${tab}`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.borderBottom = '2px solid var(--primary-color)';
            activeBtn.style.color = 'var(--primary-color)';
        }

        // Reload list with filter
        this.loadAllNotificationsPage();
    },

    getRelativeTime: function (dateStr) {
        if (!dateStr.endsWith('Z')) dateStr += 'Z';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return 'Az önce';
        if (minutes < 60) return `${minutes} dakika önce`;
        if (hours < 24) return `${hours} saat önce`;
        if (days === 1) return 'Dün';
        if (days < 7) return `${days} gün önce`;
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined });
    },

    groupNotificationsByDate: function (notifications) {
        const groups = {};
        notifications.forEach(n => {
            const date = new Date(n.createdAt);
            const today = new Date();
            const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

            let key = 'Diğer';
            if (isToday) key = 'Bugün';
            else if (isYesterday) key = 'Dün';
            else key = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

            if (!groups[key]) groups[key] = [];
            groups[key].push(n);
        });
        return groups;
    },

    renderFullList: function (allNotifications) {
        const list = document.getElementById('fullNotificationList');
        if (!list) return;

        // 1. Filter based on Tab
        let filtered = allNotifications;
        if (this.currentTab === 'unread') {
            filtered = allNotifications.filter(n => !n.isRead);
        } else if (this.currentTab === 'important') {
            filtered = allNotifications.filter(n => n.type === 'warning');
        }

        this.selectedIds = [];
        this.updateBulkActionUI();

        // 2. Empty State
        if (filtered.length === 0) {
            list.innerHTML = `
                <div style="padding: 4rem 2rem; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">📭</div>
                    <h3 style="color: #1e293b; margin-bottom: 0.5rem;">Bildirim Yok</h3>
                    <p style="color: #64748b; margin-bottom: 1.5rem;">Şu anda bu kategoride hiç bildiriminiz bulunmuyor.</p>
                    <a href="dashboard.html" class="btn-primary" style="text-decoration: none;">İlanlara Göz At</a>
                </div>
            `;
            return;
        }

        // 3. Grouping
        const groups = this.groupNotificationsByDate(filtered);
        const groupKeys = Object.keys(groups); // 'Bugün', 'Dün'... (Ordering might need logic but typically inserts in order)

        let html = '';
        groupKeys.forEach(key => {
            html += `<div style="padding: 1rem 1.5rem 0.5rem 1.5rem; color: #94a3b8; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${key}</div>`;

            groups[key].forEach(n => {
                // Style Logic
                const bg = !n.isRead ? '#F0F4FF' : 'white';
                const borderLeftColor = n.type === 'success' ? '#10b981' : (n.type === 'warning' ? '#f59e0b' : '#3b82f6');

                // Avatar Logic (Initials or Default)
                const initials = n.senderInitials || "?";
                const avatarColor = n.type === 'success' ? '#d1fae5' : '#fee2e2'; // Light Green or Red
                const avatarTextColor = n.type === 'success' ? '#065f46' : '#991b1b';

                html += `
                <div class="notification-item-new" style="display: flex; gap: 1rem; align-items: start; padding: 1.25rem 1.5rem; background: ${bg}; border-bottom: 1px solid #f1f5f9; position: relative;">
                    <!-- Color Strip -->
                    <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: ${borderLeftColor};"></div>

                    <!-- Checkbox -->
                    <div style="padding-top: 0.2rem;">
                         <input type="checkbox" class="notif-checkbox" value="${n.id}" onchange="NotificationService.toggleSelection(${n.id}, this.checked)" style="width: 1.2rem; height: 1.2rem; cursor: pointer; accent-color: var(--primary-color);">
                    </div>

                    <!-- Avatar (Clickable -> Public Profile) -->
                    <!-- Updated to point to public-profile.html with SenderId -->
                    <div style="flex-shrink: 0; cursor: pointer;" onclick="event.stopPropagation(); window.location.href='public-profile.html?id=${n.senderId || ''}';">
                        ${n.senderPhoto
                        ? `<img src="${API_URL.replace('/api', '')}${n.senderPhoto.startsWith('/') ? n.senderPhoto : '/' + n.senderPhoto}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0;">`
                        : `<div style="width: 40px; height: 40px; border-radius: 50%; background-color: ${avatarColor}; color: ${avatarTextColor}; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.9rem;">${initials}</div>`
                    }
                    </div>

                    <!-- Content (Clickable -> Read) -->
                    <div style="flex: 1; cursor: pointer; padding-left: 0.25rem;" onclick="NotificationService.handleNotificationClick(${n.id}, ${n.rideId || 'null'})">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.25rem;">
                             <h4 style="margin: 0; font-size: 1rem; font-weight: ${!n.isRead ? '700' : '500'}; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;">
                                ${n.senderName || n.title}
                             </h4>
                             <span title="${new Date(n.createdAt + (n.createdAt.endsWith('Z') ? '' : 'Z')).toLocaleString('tr-TR')}" style="font-size: 0.8rem; color: #94a3b8; white-space: nowrap; cursor: help;">${this.getRelativeTime(n.createdAt)}</span>
                        </div>
                        <p style="margin: 0; font-size: 0.95rem; color: #475569; line-height: 1.5;">${n.message}</p>
                    </div>

                    <!-- Hover Actions (X) -->
                    <div class="hover-action" style="padding-left: 0.5rem;">
                         <button onclick="NotificationService.deleteNotification(${n.id})" title="Sil" style="background: none; border: none; font-size: 1.2rem; color: #cbd5e1; cursor: pointer; padding: 0;">
                            &times;
                        </button>
                    </div>
                </div>
                `;
            });
        });

        list.innerHTML = html;

        // Inject CSS for hover actions locally if needed or rely on style.css (better to inject style once)
        if (!document.getElementById('hover-style')) {
            const style = document.createElement('style');
            style.id = 'hover-style';
            style.innerHTML = `
                .notification-item-new:hover .hover-action button { color: #ef4444 !important; }
                .notification-item-new:hover { background-color: #f8fafc !important; }
            `;
            document.head.appendChild(style);
        }
    },

    markAsRead: async function (id, reloadPage = false) {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) return;

            const notificationItem = document.querySelector(`.notification-item input[value="${id}"]`)?.closest('.notification-item');

            // Optimistic UI update
            if (notificationItem && notificationItem.classList.contains('unread')) {
                notificationItem.classList.remove('unread');
                this.decrementBadgeCount();
            }

            await fetch(`${NOTIF_API_URL}/notifications/mark-as-read/${id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (reloadPage) {
                // Optional: Don't reload entire list just for read status to keep selection, 
                // but user asked for simple flow. If we reload, selection is lost.
                // Let's just update UI class above and NOT reload.
            } else {
                this.fetchUnreadNotifications();
            }
        } catch (e) {
            console.error("Failed to mark as read", e);
        }
    },

    handleNotificationClick: function (id, rideId) {
        // 1. Mark as read immediately
        this.markAsRead(id, false);

        // Navigation removed as per user request (Stay on page)
    },

    decrementBadgeCount: function () {
        if (this.unreadCount > 0) {
            this.unreadCount--;
            this.updateBadgeUI(this.unreadCount);
        }
    },

    deleteNotification: async function (id) {
        if (!confirm("Bu bildirimi silmek istediğinize emin misiniz?")) return;

        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) return;

            const res = await fetch(`${NOTIF_API_URL}/notifications/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                this.loadAllNotificationsPage(); // Refresh list
                showToast("Bildirim silindi.", "success");
            }
        } catch (e) {
            console.error("Failed to delete", e);
        }
    }
};

// Global Functions for HTML access
// window.toggleNotificationDropdown removed - using direct link

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    // Delay slightly to wait for app.js to render nav
    setTimeout(() => {
        NotificationService.init();
        NotificationService.fetchUnreadNotifications();
    }, 500);
});
