const API_URL = "http://localhost:5200/api";

// Helper: Get Token
function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');

    // Handle missing ID
    if (!userId) {
        window.location.replace('dashboard.html'); // Replace to avoid back button loop
        return;
    }

    // Set Send Message Button Target
    const sendBtn = document.getElementById('sendMessageBtn');
    if (sendBtn) {
        sendBtn.onclick = () => window.location.href = `chat.html?targetId=${userId}`;
    }

    await loadPublicProfile(userId);
});

async function loadPublicProfile(userId) {
    // UI Elements
    const elName = document.getElementById('pName');
    const elUserType = document.getElementById('pUserType');
    const elScore = document.getElementById('pScore');
    const elImg = document.getElementById('profileImage');
    const elDriverSection = document.getElementById('driverInfoSection');

    // Set Loading State (Skeleton / Spinner) - if specific loader exists
    // Currently, "Yükleniyor..." text serves as loader. 
    // Optimization: Ensure we don't block UI thread.

    try {
        const token = getToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        // Fetch Data
        const res = await fetch(`${API_URL}/users/${userId}`, { headers });

        if (res.status === 401) {
            Swal.fire({
                icon: 'warning',
                title: 'Giriş Yapılmalı',
                text: 'Kullanıcı profillerini görüntülemek için giriş yapmalısınız.',
                confirmButtonText: 'Giriş Yap',
                allowOutsideClick: false
            }).then(() => window.location.href = 'login.html');
            return;
        }

        if (!res.ok) throw new Error('Kullanıcı bulunamadı');

        const data = await res.json();

        // --- DOM UPDATES (FAST) ---

        // 1. Basic Info
        elName.innerText = `${data.firstName} ${data.lastName}`;

        // 2. Styling User Type
        elUserType.innerText = data.userType || 'Kullanıcı';
        if (data.userType === 'Akademisyen') {
            elUserType.style.background = '#7c3aed';
        } else {
            elUserType.style.background = 'var(--primary-color)';
        }

        // 3. Score
        elScore.innerText = data.reputationScore ? data.reputationScore.toFixed(1) : '5.0';

        // 4. Vehicle Info
        if (data.vehicle) {
            elDriverSection.style.display = 'block';
            document.getElementById('vModel').innerText = data.vehicle.model;
            document.getElementById('vColor').innerText = data.vehicle.color;
        } else {
            elDriverSection.style.display = 'none';
        }

        // 5. Image Handling (Non-blocking)
        if (data.profilePhotoUrl) {
            // Use a temporary image to load in background if you want to avoid "pop-in",
            // BUT for speed, setting src immediately is best. 
            // The browser handles the download asynchronously.
            let photoPath = data.profilePhotoUrl;
            if (!photoPath.startsWith('http')) {
                if (!photoPath.startsWith('/')) photoPath = '/' + photoPath;
                photoPath = API_URL.replace('/api', '') + photoPath;
            }
            // Add cache-bust only if strictly necessary (debugging), 
            // otherwise standard caching is better for performance.
            // Removing timestamp for production performance unless avatar updates are instant-critical.
            // But user wanted "up to date", so let's keep it or use a version hash if available.
            // For now, keep timestamp to satisfy "always up to date" request.
            photoPath += `?t=${new Date().getTime()}`;

            elImg.src = photoPath;
        } else {
            // Initials
            const initials = ((data.firstName?.[0] || '') + (data.lastName?.[0] || '')).toUpperCase();
            const wrapper = document.querySelector('.avatar-circle'); // Parent of img
            if (wrapper) {
                wrapper.innerHTML = `
                    <div style="width:100%; height:100%; background:#e0f2fe; color:#0284c7; 
                                display:flex; align-items:center; justify-content:center; 
                                font-size:3.5rem; font-weight:700;">
                        ${initials}
                    </div>
                 `;
            }
        }


        document.title = `${data.firstName} ${data.lastName} | BANÜ-Pool`;

        // 6. Check Reservation Status for Chat Permission
        const sendBtn = document.getElementById('sendMessageBtn');
        if (sendBtn && userId) {
            sendBtn.style.display = 'none'; // Hide by default

            // Check if own profile
            const currentUserId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
            if (currentUserId && currentUserId != userId) {
                try {
                    const statusRes = await fetch(`${API_URL}/rides/check-reservation-status?targetUserId=${userId}`, { headers });
                    if (statusRes.ok) {
                        const canChat = await statusRes.json();
                        if (canChat) {
                            sendBtn.style.display = 'flex'; // Show if allowed
                        }
                    }
                } catch (err) {
                    console.error("Failed to check chat permission", err);
                }
            }
        }

    } catch (e) {
        console.error(e);
        elName.innerText = "Kullanıcı Bulunamadı";
        // Optional: specific error UI
    }
}
