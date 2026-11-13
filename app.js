const firebaseConfig = {
  apiKey: "AIzaSyAMKm-xOELnBDxFr7qh1aUJ9KU60pNK_dg",
  authDomain: "acdmih-fc15d.firebaseapp.com",
  projectId: "acdmih-fc15d",
  storageBucket: "acdmih-fc15d.firebasestorage.app",
  messagingSenderId: "787132448066",
  appId: "1:787132448066:web:44c822104a37209a511cdb",
  measurementId: "G-PCE1Q1XZXQ"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const MILITARY_RANKS = [
    'جندي', 'جندي أول', 'عريف', 'وكيل رقيب', 'رقيب', 'رقيب أول', 'رئيس رقباء',
    'ملازم', 'ملازم أول', 'نقيب', 'رائد', 'مقدم', 'عقيد', 'عميد', 'لواء', 'فريق', 'فريق أول'
];

let members = [];
let dismissedMembers = [];
let announcements = [];
let guardDuties = [];
let auditLogs = [];
let systemNotifications = [];
let currentUser = null;

const savedUserSession = localStorage.getItem('mp_current_user');
if (savedUserSession) {
    try {
        currentUser = JSON.parse(savedUserSession);
    } catch(e) {
        localStorage.removeItem('mp_current_user');
    }
}

function populateRankSelects() {
    const optionsHtml = MILITARY_RANKS.map(r => `<option value="${r}">${r}</option>`).join('');
    const addRank = document.getElementById('add-m-rank');
    const commanderRank = document.getElementById('commander-edit-rank');
    if (addRank) addRank.innerHTML = optionsHtml;
    if (commanderRank) commanderRank.innerHTML = optionsHtml;
    
    document.querySelectorAll('.lead-rank-select').forEach(el => {
        el.innerHTML = optionsHtml;
    });
}
populateRankSelects();

function playAlertSound() {
    const sound = document.getElementById('alert-sound');
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(e => console.log("Audio play blocked"));
    }
}

function pushNotification(title, text) {
    systemNotifications.unshift({
        id: Date.now(),
        title,
        text,
        time: new Date().toLocaleTimeString('ar-SA')
    });
    if (systemNotifications.length > 20) systemNotifications.pop();
}

function addAuditLog(actionText) {
    const authorName = currentUser ? `${currentUser.rank || ''} ${currentUser.name}` : 'النظام';
    auditLogs.unshift({
        id: Date.now(),
        text: actionText,
        author: authorName,
        date: new Date().toLocaleString('ar-SA')
    });
    if (auditLogs.length > 100) auditLogs.pop();
}

db.collection("military_police").doc("system_data").onSnapshot((doc) => {
    if (doc.exists) {
        const data = doc.data();
        members = data.members || [];
        dismissedMembers = data.dismissedMembers || [];
        announcements = data.announcements || [];
        guardDuties = data.guardDuties || [];
        auditLogs = data.auditLogs || [];
        systemNotifications = data.systemNotifications || [];

        if (currentUser && !currentUser.onDuty) {
            if (currentUser.id === 'root_commander') {
                if (data.rootCommanderProfile) {
                    currentUser.rank = data.rootCommanderProfile.rank || currentUser.rank;
                    currentUser.codeNumber = data.rootCommanderProfile.codeNumber || currentUser.codeNumber;
                    currentUser.totalSeconds = data.rootCommanderProfile.totalSeconds || currentUser.totalSeconds;
                }
            } else {
                const fresh = members.find(m => m.id === currentUser.id);
                if (fresh) {
                    currentUser.rank = fresh.rank;
                    currentUser.codeNumber = fresh.codeNumber;
                    currentUser.totalSeconds = fresh.totalSeconds;
                    currentUser.permissions = fresh.permissions || {};
                    currentUser.positionTitle = fresh.positionTitle;
                }
            }
            localStorage.setItem('mp_current_user', JSON.stringify(currentUser));
        }
        refreshAllUI();
    }
});

function saveSystemData() {
    db.collection("military_police").doc("system_data").set({
        members,
        dismissedMembers,
        announcements,
        guardDuties,
        auditLogs,
        systemNotifications,
        rootCommanderProfile: currentUser && currentUser.id === 'root_commander' ? {
            rank: currentUser.rank,
            codeNumber: currentUser.codeNumber || 1,
            totalSeconds: currentUser.totalSeconds || 0,
            onDuty: currentUser.onDuty || false
        } : null,
        updatedAt: Date.now()
    }).catch(err => console.error(err));
}

function getNextSwordCode() {
    const approved = members.filter(m => m.codeNumber);
    let nextNum = 40; 
    while (approved.some(m => m.codeNumber === nextNum) && nextNum <= 1000) {
        nextNum++;
    }
    return nextNum;
}

function formatTimeDetailed(totalSeconds) {
    const s = Math.floor(totalSeconds || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs} ساعة و ${mins} دقيقة و ${secs} ثانية`;
}

function showAlert(msg, isError = false) {
    playAlertSound();
    const box = document.createElement('div');
    box.className = `fixed bottom-5 left-5 z-50 px-5 py-3 rounded-2xl text-xs font-bold text-white shadow-xl transition-all ${isError ? 'bg-slate-900 border-r-4 border-red-600' : 'bg-red-600'}`;
    box.innerText = msg;
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3500);
}

function showCustomPrompt(title, defaultValue, callback) {
    const container = document.getElementById('custom-modal-container');
    container.innerHTML = `
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div class="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
                <h3 class="font-black text-slate-900 text-sm border-b pb-2">${title}</h3>
                <input type="text" id="custom-prompt-input" value="${defaultValue || ''}" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-red-600">
                <div class="flex gap-2 pt-2">
                    <button onclick="submitCustomPrompt(true)" class="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow">تأكيد</button>
                    <button onclick="submitCustomPrompt(false)" class="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl">إلغاء</button>
                </div>
            </div>
        </div>
    `;
    window._promptCallback = callback;
}

window.submitCustomPrompt = function(isConfirm) {
    const container = document.getElementById('custom-modal-container');
    const val = isConfirm ? document.getElementById('custom-prompt-input').value : null;
    container.innerHTML = '';
    if (window._promptCallback) window._promptCallback(val);
}

window.toggleCustomCodeInput = function(selectId, inputId) {
    const mode = document.getElementById(selectId).value;
    const wrap = document.getElementById(`${inputId}`);
    if (mode === 'custom') wrap.classList.remove('hidden');
    else wrap.classList.add('hidden');
}

function hasAnyAdminPerm() {
    if (!currentUser) return false;
    if (currentUser.id === 'root_commander') return true;
    if (!currentUser.permissions) return false;
    return Object.values(currentUser.permissions).some(v => v === true);
}

function checkAdminPerm(permKey, permNameMsg = 'الصلاحية المطلوبة') {
    if (!currentUser) {
        showAlert('يرجى تسجيل الدخول أولاً', true);
        return false;
    }
    if (currentUser.id === 'root_commander') return true;
    if (currentUser.permissions && currentUser.permissions[permKey] === true) {
        return true;
    }
    showAlert(`ليس لديك صلاحية (${permNameMsg})`, true);
    return false;
}

window.switchView = function(view) {
    ['home', 'login', 'duty', 'admin', 'member-dashboard'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) el.classList.add('hidden');
    });

    if (view === 'duty') renderDutyPanel();
    else if (view === 'admin') {
        if (!hasAnyAdminPerm()) { 
            showAlert('ليس لديك صلاحية الدخول إلى غرفة القيادة والتحكم', true);
            switchView('home'); 
            return; 
        }
        renderAdminPanels();
    } else if (view === 'member-dashboard') {
        if (!currentUser) { switchView('login'); return; }
        renderMemberDashboard();
    }
    document.getElementById(`view-${view}`).classList.remove('hidden');
}

window.switchAdminTab = function(tabId, btnEl) {
    if (tabId === 'tab-logs' && !checkAdminPerm('viewLogs', 'معاينة سجل العمليات')) return;
    if (tabId === 'tab-roles' && !checkAdminPerm('addMember', 'إدارة المناصب والصلاحيات')) return;
    if (tabId === 'tab-inventory' && !checkAdminPerm('inventoryManager', 'إدارة الجرد والساعات')) return;

    document.querySelectorAll('.admin-pane').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.admin-tab').forEach(b => {
        b.classList.remove('bg-red-600', 'text-white');
        b.classList.add('bg-slate-100', 'text-slate-700');
    });
    document.getElementById(tabId).classList.remove('hidden');
    if (btnEl) {
        btnEl.classList.remove('bg-slate-100', 'text-slate-700');
        btnEl.classList.add('bg-red-600', 'text-white');
    }
}

window.copyDiscordId = function(discordId) {
    navigator.clipboard.writeText(discordId).then(() => {
        showAlert(`تم نسخ آيدي الديسكورد بنجاح: ${discordId}`);
    });
}

window.handleLogin = function(e) {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();

    if (u === 'mp_admin_9921#secure' && p === 'X9#kL9$mP2!qZ8') {
        db.collection("military_police").doc("system_data").get().then((doc) => {
            let savedRank = 'فريق أول';
            let savedCode = 1;
            let savedTotalSecs = 0;
            let savedOnDuty = false;
            if (doc.exists && doc.data().rootCommanderProfile) {
                savedRank = doc.data().rootCommanderProfile.rank || 'فريق أول';
                savedCode = doc.data().rootCommanderProfile.codeNumber || 1;
                savedTotalSecs = doc.data().rootCommanderProfile.totalSeconds || 0;
                savedOnDuty = doc.data().rootCommanderProfile.onDuty || false;
            }
            currentUser = {
                id: 'root_commander',
                name: 'قائد الشرطة العسكرية',
                username: 'mp_admin_9921#secure',
                rank: savedRank,
                discordId: '0000000000',
                positionTitle: 'قائد الشرطة العسكرية',
                codeNumber: savedCode,
                totalSeconds: savedTotalSecs,
                adminNote: '',
                onDuty: savedOnDuty
            };
            localStorage.setItem('mp_current_user', JSON.stringify(currentUser));
            showAlert('تم تسجيل الدخول كقائد عام بنجاح');
            refreshAllUI();
            switchView('home');
        });
        return;
    }

    const found = members.find(m => m.username.toLowerCase() === u.toLowerCase() && m.password === p);
    if (!found) {
        showAlert('بيانات الدخول غير صحيحة!', true);
        return;
    }

    currentUser = found;
    localStorage.setItem('mp_current_user', JSON.stringify(currentUser));
    playAlertSound();
    showAlert(`أهلاً بك ${found.rank} / ${found.name}`);
    refreshAllUI();
    switchView('home');
}

window.handleLogout = function() {
    if (currentUser && currentUser.onDuty) {
        toggleDuty(false);
    }
    currentUser = null;
    localStorage.removeItem('mp_current_user');
    refreshAllUI();
    switchView('home');
    showAlert('تم تسجيل الخروج.');
}

function refreshAllUI() {
    const authDiv = document.getElementById('auth-buttons');
    const adminBtn = document.getElementById('nav-admin-btn');
    const memberBtn = document.getElementById('nav-member-btn');

    if (currentUser) {
        authDiv.innerHTML = `
            <span class="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">
                ${currentUser.name} | سيف ${currentUser.codeNumber || ''}
            </span>
            <button onclick="handleLogout()" class="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-xl">خروج</button>
        `;
        if (currentUser.id !== 'root_commander') memberBtn.classList.remove('hidden');
        else memberBtn.classList.add('hidden');

        if (hasAnyAdminPerm()) {
            adminBtn.classList.remove('hidden');
            const badge = document.getElementById('current-role-badge');
            if (badge) badge.innerText = `المنصب: ${currentUser.positionTitle}`;
            renderAdminTabs();
        } else {
            adminBtn.classList.add('hidden');
        }
    } else {
        adminBtn.classList.add('hidden');
        memberBtn.classList.add('hidden');
        authDiv.innerHTML = `
            <button onclick="switchView('login')" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md transition">تسجيل الدخول</button>
        `;
    }

    renderPublicRoster();
    renderAdminPanels();
    renderGuardDuties();
    renderDutyPanel();
    if (currentUser && currentUser.id !== 'root_commander') {
        renderMemberDashboard();
    }
}

// دقيق جداً: يعرض فقط التبويبات التي يملك المسؤول صلاحيات لها، ويفتح تلقائياً أول تبويب مسموح له
function renderAdminTabs() {
    const container = document.getElementById('admin-tabs-container');
    if (!container) return;

    let html = '';
    let availableTabs = [];

    if (currentUser.id === 'root_commander') {
        html += `<button id="btn-tab-commander-profile" onclick="switchAdminTab('tab-commander-profile', this)" class="admin-tab px-3 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">تعديل ملفي</button>`;
        availableTabs.push('tab-commander-profile');
    }
    if (currentUser.id === 'root_commander' || currentUser.permissions?.addMember) {
        html += `<button id="btn-tab-add-member" onclick="switchAdminTab('tab-add-member', this)" class="admin-tab px-3 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">+ إضافة فرد</button>`;
        availableTabs.push('tab-add-member');
    }
    
    // إدارة الأفراد تظهر لمن لديه أي صلاحية إدارية أو جرد
    if (currentUser.id === 'root_commander' || hasAnyAdminPerm()) {
        html += `<button id="btn-tab-members" onclick="switchAdminTab('tab-members', this)" class="admin-tab px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">إدارة الأفراد</button>`;
        availableTabs.push('tab-members');
    }

    if (currentUser.id === 'root_commander' || currentUser.permissions?.inventoryManager) {
        html += `<button id="btn-tab-inventory" onclick="switchAdminTab('tab-inventory', this)" class="admin-tab px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">📊 الجرد والساعات</button>`;
        availableTabs.push('tab-inventory');
    }
    if (currentUser.id === 'root_commander' || currentUser.permissions?.warnMember) {
        html += `<button id="btn-tab-warnings" onclick="switchAdminTab('tab-warnings', this)" class="admin-tab px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">إدارة التحذيرات</button>`;
        availableTabs.push('tab-warnings');
    }
    if (currentUser.id === 'root_commander' || currentUser.permissions?.dismissMember) {
        html += `<button id="btn-tab-dismissed" onclick="switchAdminTab('tab-dismissed', this)" class="admin-tab px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">المفصولين</button>`;
        availableTabs.push('tab-dismissed');
    }
    if (currentUser.id === 'root_commander' || currentUser.permissions?.manageGuards) {
        html += `<button id="btn-tab-guards" onclick="switchAdminTab('tab-guards', this)" class="admin-tab px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">الخفارات</button>`;
        availableTabs.push('tab-guards');
    }
    if (currentUser.id === 'root_commander' || currentUser.positionTitle?.includes('نائب')) {
        html += `<button id="btn-tab-roles" onclick="switchAdminTab('tab-roles', this)" class="admin-tab px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">المناصب</button>`;
        availableTabs.push('tab-roles');
    }
    
    html += `<button id="btn-tab-permissions-overview" onclick="switchAdminTab('tab-permissions-overview', this)" class="admin-tab px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">🛡️ قائمة المسؤولين</button>`;
    availableTabs.push('tab-permissions-overview');

    if (currentUser.id === 'root_commander' || currentUser.permissions?.viewLogs) {
        html += `<button id="btn-tab-logs" onclick="switchAdminTab('tab-logs', this)" class="admin-tab px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">سجل العمليات (Log)</button>`;
        availableTabs.push('tab-logs');
    }
    if (currentUser.id === 'root_commander' || currentUser.permissions?.canAnnounce) {
        html += `<button id="btn-tab-announce" onclick="switchAdminTab('tab-announce', this)" class="admin-tab px-3 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">تعميم</button>`;
        availableTabs.push('tab-announce');
    }
    container.innerHTML = html;

    // تفعيل أول تبويب متاح تلقائياً للمسؤول لكي لا يظهر فارجاً
    if (availableTabs.length > 0) {
        const firstTabId = availableTabs[0];
        const firstBtn = document.getElementById(`btn-${firstTabId}`);
        switchAdminTab(firstTabId, firstBtn);
    }
}

window.renderPublicRoster = function() {
    const tbody = document.getElementById('public-roster-tbody');
    if (!tbody) return;
    const search = (document.getElementById('search-roster')?.value || '').toLowerCase();
    
    let allApproved = [...members];
    const rootCode = currentUser && currentUser.id === 'root_commander' ? (currentUser.codeNumber || 1) : 1;
    const rootRank = currentUser && currentUser.id === 'root_commander' ? currentUser.rank : 'فريق أول';
    const rootOnDuty = currentUser && currentUser.id === 'root_commander' ? currentUser.onDuty : false;

    if (!allApproved.some(m => m.id === 'root_commander')) {
        allApproved.push({
            id: 'root_commander',
            name: 'قائد الشرطة العسكرية العام',
            rank: rootRank,
            codeNumber: rootCode,
            discordId: '0000000000',
            positionTitle: 'قائد الشرطة العسكرية',
            onDuty: rootOnDuty
        });
    } else {
        const rc = allApproved.find(m => m.id === 'root_commander');
        if (rc) {
            rc.codeNumber = rootCode;
            rc.rank = rootRank;
            rc.onDuty = rootOnDuty;
        }
    }

    if (currentUser && currentUser.id !== 'root_commander') {
        const mObj = allApproved.find(m => m.id === currentUser.id);
        if (mObj) {
            mObj.onDuty = currentUser.onDuty;
            mObj.rank = currentUser.rank;
            mObj.totalSeconds = currentUser.totalSeconds;
        }
    }

    const approved = allApproved.sort((a, b) => a.codeNumber - b.codeNumber);

    const totalEl = document.getElementById('stat-total-members');
    const onDutyEl = document.getElementById('stat-on-duty');
    if (totalEl) totalEl.innerText = approved.length;
    if (onDutyEl) onDutyEl.innerText = approved.filter(m => m.onDuty).length;

    const onlineMembers = approved.filter(m => m.onDuty);
    let highestActiveDisplay = "لا يوجد";
    if (onlineMembers.length > 0) {
        onlineMembers.sort((a, b) => MILITARY_RANKS.indexOf(b.rank) - MILITARY_RANKS.indexOf(a.rank));
        highestActiveDisplay = `${onlineMembers[0].rank} (${onlineMembers[0].name})`;
    }
    const highestCodeEl = document.getElementById('stat-highest-code');
    if (highestCodeEl) highestCodeEl.innerText = highestActiveDisplay;

    const filtered = approved.filter(m => 
        m.name.toLowerCase().includes(search) || 
        `سيف ${m.codeNumber}`.includes(search) ||
        (m.discordId || '').includes(search) ||
        (m.rank || '').includes(search)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">لا يوجد أفراد أو مسؤولين مسجلين.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(m => `
        <tr class="hover:bg-slate-50 transition">
            <td class="p-4"><span class="px-3 py-1 bg-red-600 text-white font-black rounded-lg text-xs">سيف ${m.codeNumber}</span></td>
            <td class="p-4 font-bold text-slate-700">${m.rank}</td>
            <td class="p-4 font-black text-slate-900">${m.name}</td>
            <td class="p-4 font-mono text-slate-600 flex items-center gap-2">
                <span>${m.discordId || 'غير مسجل'}</span>
                ${m.discordId && m.discordId !== '0000000000' ? `
                    <button onclick="copyDiscordId('${m.discordId}')" class="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-sm border border-red-200">
                        <i class="fa-solid fa-copy"></i> نسخ
                    </button>
                ` : ''}
            </td>
            <td class="p-4"><span class="px-2 py-1 bg-slate-100 rounded-lg text-[11px]">${m.positionTitle || 'فرد شرطة عسكرية'}</span></td>
            <td class="p-4">${m.onDuty ? '<span class="text-red-600 font-bold animate-pulse">● مسجل دخول (في الميدان)</span>' : '<span class="text-slate-400 font-bold">خارج الخدمة (مسجل خروج)</span>'}</td>
        </tr>
    `).join('');
}

function renderDutyPanel() {
    const container = document.getElementById('duty-content');
    if (!container) return;
    if (!currentUser) {
        container.innerHTML = `<p class="text-xs text-slate-500">سجل الدخول بحساب معتمد للمناوبة.</p><button onclick="switchView('login')" class="mt-3 px-4 py-2 bg-red-600 text-white rounded-xl text-xs">تسجيل الدخول</button>`;
        return;
    }

    container.innerHTML = `
        <div class="space-y-4">
            <span class="px-4 py-1.5 bg-red-600 text-white font-black rounded-xl text-sm inline-block">سيف ${currentUser.codeNumber || 1}</span>
            <h3 class="text-xl font-black text-slate-900">${currentUser.rank} / ${currentUser.name}</h3>
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span class="text-xs text-slate-400 block">إجمالي رصيد الوقت الفعلي</span>
                <span id="live-duty-timer" class="text-lg font-black text-red-600">${formatTimeDetailed(currentUser.totalSeconds || 0)}</span>
            </div>
            ${currentUser.onDuty ? `
                <button onclick="toggleDuty(false)" class="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl text-xs">تسجيل خروج من المناوبة</button>
            ` : `
                <button onclick="toggleDuty(true)" class="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md">تسجيل دخول للمناوبة</button>
            `}
        </div>
    `;
}

setInterval(() => {
    if (currentUser && currentUser.onDuty) {
        currentUser.totalSeconds = (currentUser.totalSeconds || 0) + 1;
        
        if (currentUser.id !== 'root_commander') {
            const mObj = members.find(m => m.id === currentUser.id);
            if (mObj) mObj.totalSeconds = currentUser.totalSeconds;
        }
        localStorage.setItem('mp_current_user', JSON.stringify(currentUser));

        const timerEl = document.getElementById('live-duty-timer');
        if (timerEl) {
            timerEl.innerText = formatTimeDetailed(currentUser.totalSeconds);
        }
    }
}, 1000);

window.toggleDuty = function(start) {
    if (!currentUser) return;

    if (start) {
        if (currentUser.onDuty) return;
        currentUser.onDuty = true;
        
        if (currentUser.id !== 'root_commander') {
            const idx = members.findIndex(m => m.id === currentUser.id);
            if (idx !== -1) members[idx].onDuty = true;
        }

        playAlertSound();
        pushNotification('تسجيل دخول', `سجل ${currentUser.rank} ${currentUser.name} دخولاً للمناوبة.`);
        addAuditLog(`سجل دخول للمناوبة: ${currentUser.rank} ${currentUser.name}`);
        showAlert('تم تسجيل دخولك للميدان وبدأ احتساب الوقت.');
        saveSystemData();
    } else {
        if (!currentUser.onDuty) return;
        currentUser.onDuty = false;

        if (currentUser.id !== 'root_commander') {
            const idx = members.findIndex(m => m.id === currentUser.id);
            if (idx !== -1) {
                members[idx].totalSeconds = currentUser.totalSeconds;
                members[idx].onDuty = false;
            }
        }

        playAlertSound();
        pushNotification('تسجيل خروج', `سجل ${currentUser.rank} ${currentUser.name} خروجاً من المناوبة.`);
        addAuditLog(`سجل خروج من المناوبة: ${currentUser.rank} ${currentUser.name}`);
        showAlert(`تم تسجيل خروجك من المناوبة بنجاح.`);
        saveSystemData();
    }
    
    localStorage.setItem('mp_current_user', JSON.stringify(currentUser));
    renderDutyPanel();
    renderPublicRoster();
}

window.renderMemberDashboard = function() {
    const container = document.getElementById('view-member-dashboard');
    if (!container || !currentUser) return;

    const myGuards = guardDuties.filter(g => g.memberId === currentUser.id);
    const myWarnings = currentUser.warnings || [];

    const guardBox = document.getElementById('member-guard-duty-box');
    if (guardBox) {
        if (myGuards.length > 0) {
            const activeG = myGuards[0];
            guardBox.classList.remove('hidden');
            guardBox.innerHTML = `
                <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <span class="px-2.5 py-1 bg-red-600 text-white font-black rounded-lg text-xs">أمر خفارة رسمي جديد</span>
                        <h3 class="text-base font-black text-slate-900 mt-2">الموقع: ${activeG.location} (${activeG.durationMins} دقيقة)</h3>
                        <p class="text-xs text-slate-500 mt-1">ملاحظة: ${activeG.note || 'لا توجد ملاحظات'}</p>
                    </div>
                    <div>
                        ${activeG.videoUrl ? `<span class="text-emerald-600 font-bold text-xs">✓ تم رفع فيديو الإثبات بنجاح</span>` : `
                            <label class="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md inline-block">
                                🎥 رفع فيديو إثبات الخفارة
                                <input type="file" accept="video/*" class="hidden" onchange="uploadGuardVideo(event, ${activeG.id})">
                            </label>
                        `}
                    </div>
                </div>
            `;
        } else {
            guardBox.classList.add('hidden');
        }
    }

    const warnList = document.getElementById('member-warnings-list');
    if (warnList) {
        warnList.innerHTML = myWarnings.length === 0 ? `<p class="text-xs text-slate-400">سجل نظيف، لا توجد أي تحذيرات مسجلة.</p>` : myWarnings.map(w => `
            <div class="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-800 font-bold flex justify-between">
                <span>${w.reason}</span>
                <span class="text-rose-400">${w.date}</span>
            </div>
        `).join('');
    }

    const annList = document.getElementById('member-announcements-list');
    if (annList) {
        annList.innerHTML = announcements.length === 0 ? `<p class="text-xs text-slate-400">لا توجد تعاميم حالياً.</p>` : announcements.map(a => `
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 text-xs">
                <span class="font-black text-slate-900 text-sm block">${a.title}</span>
                <p class="text-slate-700">${a.body}</p>
                <span class="text-[10px] text-slate-400 block pt-1">بواسطة: ${a.author} (${a.date})</span>
            </div>
        `).join('');
    }

    document.getElementById('member-dash-code').innerText = `سيف ${currentUser.codeNumber}`;
    document.getElementById('member-dash-name').innerText = `${currentUser.rank} / ${currentUser.name}`;
    document.getElementById('member-dash-meta').innerText = `ديسكورد: ${currentUser.discordId || 'غير مسجل'} | المنصب: ${currentUser.positionTitle || 'فرد'}`;
}

window.uploadGuardVideo = function(e, guardId) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(uploadEvent) {
        const videoDataUrl = uploadEvent.target.result;
        const duty = guardDuties.find(g => g.id === guardId);
        if (duty) {
            duty.videoUrl = videoDataUrl;
            duty.status = 'completed';
        }
        saveSystemData();
        showAlert('تم رفع فيديو الخفارة بنجاح وإرساله للمسؤولين.');
        renderMemberDashboard();
    };
    reader.readAsDataURL(file);
}

window.openVideoModal = function(url) {
    let modal = document.getElementById('video-preview-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'video-preview-modal';
        modal.className = 'fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-3xl overflow-hidden max-w-2xl w-full p-4 space-y-3 shadow-2xl">
                <div class="flex justify-between items-center">
                    <h3 class="font-black text-sm text-slate-900">معاينة فيديو إثبات الخفارة</h3>
                    <button onclick="document.getElementById('video-preview-modal').remove()" class="px-3 py-1 bg-slate-100 rounded-xl text-xs font-bold">✕ إغلاق</button>
                </div>
                <video id="modal-video-source" controls class="w-full rounded-2xl max-h-[70vh] bg-black"></video>
            </div>
        `;
        document.body.appendChild(modal);
    }
    document.getElementById('modal-video-source').src = url;
}

window.handleUpdateCommanderProfile = function(e) {
    e.preventDefault();
    if (!currentUser || currentUser.id !== 'root_commander') return;

    const newRank = document.getElementById('commander-edit-rank').value;
    const newCode = parseInt(document.getElementById('commander-edit-code').value);

    if (isNaN(newCode) || newCode < 1) {
        showAlert('يرجى إدخال رقم كود صحيح.', true);
        return;
    }

    currentUser.rank = newRank;
    currentUser.codeNumber = newCode;
    localStorage.setItem('mp_current_user', JSON.stringify(currentUser));

    playAlertSound();
    addAuditLog(`حدث القائد العام بياناته (رتبة: ${newRank}, كود: سيف ${newCode})`);
    saveSystemData();
    refreshAllUI();
    showAlert('تم تحديث ملف القائد العام بنجاح.');
}

function renderAdminPanels() {
    if (!currentUser) return;

    if (currentUser.id === 'root_commander') {
        const rankEl = document.getElementById('commander-edit-rank');
        const codeEl = document.getElementById('commander-edit-code');
        if (rankEl && currentUser.rank) rankEl.value = currentUser.rank;
        if (codeEl) codeEl.value = currentUser.codeNumber || 1;
    }

    const membersTbody = document.getElementById('admin-members-tbody');
    if (membersTbody) {
        const approved = [...members].sort((a, b) => a.codeNumber - b.codeNumber);
        membersTbody.innerHTML = approved.map(m => `
            <tr>
                <td class="p-4 font-black text-red-600">سيف ${m.codeNumber}</td>
                <td class="p-4 font-bold text-slate-900">${m.rank} / ${m.name}</td>
                <td class="p-4 font-mono text-xs">${m.discordId}</td>
                <td class="p-4 text-xs">
                    <span class="text-slate-700 block max-w-xs break-words mb-1">${m.adminNote || '<span class="text-slate-400">لا توجد ملاحظة</span>'}</span>
                    <button onclick="editAdminNote(${m.id})" class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-bold text-[10px]">✏️ ملاحظة</button>
                </td>
                <td class="p-4 font-mono font-bold text-red-600">${formatTimeDetailed(m.totalSeconds || 0)}</td>
                <td class="p-4 flex flex-wrap gap-1">
                    <button onclick="editMemberDetails(${m.id})" class="px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-bold">تعديل الاسم/الكود</button>
                    <button onclick="openCredentialsModal(${m.id})" class="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold">اليوزر/الباس</button>
                    <button onclick="editMemberRank(${m.id})" class="px-2 py-1 bg-slate-100 rounded text-xs font-bold">رتبة</button>
                    <button onclick="warnMember(${m.id})" class="px-2 py-1 bg-amber-500 text-white rounded text-xs font-bold">تحذير</button>
                    <button onclick="dismissMember(${m.id})" class="px-2 py-1 bg-slate-900 text-white rounded text-xs font-bold">فصل</button>
                </td>
            </tr>
        `).join('');
    }

    const inventoryTbody = document.getElementById('admin-inventory-tbody');
    const topScorerName = document.getElementById('top-scorer-name');
    const topScorerTime = document.getElementById('top-scorer-time');

    let allPool = [...members];
    if (!allPool.some(m => m.id === 'root_commander')) {
        allPool.push({
            id: 'root_commander',
            name: 'قائد الشرطة العسكرية العام',
            rank: currentUser.id === 'root_commander' ? currentUser.rank : 'فريق أول',
            codeNumber: currentUser.id === 'root_commander' ? (currentUser.codeNumber || 1) : 1,
            totalSeconds: currentUser.id === 'root_commander' ? (currentUser.totalSeconds || 0) : 0
        });
    }

    allPool.sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0));

    if (allPool.length > 0 && topScorerName && topScorerTime) {
        const top = allPool[0];
        topScorerName.innerText = `${top.rank} / ${top.name} (سيف ${top.codeNumber})`;
        topScorerTime.innerText = `إجمالي الوقت: ${formatTimeDetailed(top.totalSeconds || 0)}`;
    }

    if (inventoryTbody) {
        const approvedByCode = [...allPool].sort((a, b) => a.codeNumber - b.codeNumber);
        inventoryTbody.innerHTML = approvedByCode.map(m => `
            <tr>
                <td class="p-4 font-black text-red-600">سيف ${m.codeNumber}</td>
                <td class="p-4 font-bold text-slate-900">${m.rank} / ${m.name}</td>
                <td class="p-4 font-mono font-bold text-red-600">${formatTimeDetailed(m.totalSeconds || 0)}</td>
                <td class="p-4 flex gap-2">
                    <button onclick="adjustMemberTime(${m.id}, 3600)" class="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-bold border border-emerald-200">+ ساعة</button>
                    <button onclick="adjustMemberTime(${m.id}, -3600)" class="px-2.5 py-1 bg-amber-50 text-amber-700 rounded text-xs font-bold border border-amber-200">- ساعة</button>
                    <button onclick="setCustomMemberTime(${m.id})" class="px-2.5 py-1 bg-slate-100 text-slate-700 rounded text-xs font-bold">تعديل دقيق</button>
                </td>
            </tr>
        `).join('');
    }

    const warnManageList = document.getElementById('admin-warnings-management-list');
    if (warnManageList) {
        const approved = [...members].sort((a, b) => a.codeNumber - b.codeNumber);
        let allWarningsHtml = '';
        approved.forEach(m => {
            if (m.warnings && m.warnings.length > 0) {
                m.warnings.forEach((w, idx) => {
                    allWarningsHtml += `
                        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-xs">
                            <div>
                                <span class="font-black text-slate-900 block">${m.rank} / ${m.name} (سيف ${m.codeNumber})</span>
                                <span class="text-slate-600">${w.reason} <strong class="text-slate-400">(${w.date})</strong></span>
                            </div>
                            <button onclick="deleteWarning(${m.id}, ${idx})" class="px-2 py-1 bg-rose-50 text-rose-600 rounded font-bold">حذف التحذير</button>
                        </div>
                    `;
                });
            }
        });
        warnManageList.innerHTML = allWarningsHtml || `<p class="text-xs text-slate-400">لا توجد تحذيرات مسجلة للأفراد حالياً.</p>`;
    }

    const dismissedTbody = document.getElementById('admin-dismissed-tbody');
    if (dismissedTbody) {
        dismissedTbody.innerHTML = dismissedMembers.length === 0 ? `<tr><td colspan="5" class="p-6 text-center text-slate-400">لا يوجد أفراد مفصولون في الأرشيف.</td></tr>` : dismissedMembers.map((d, index) => `
            <tr>
                <td class="p-4 font-bold text-slate-900">${d.rank} / ${d.name}</td>
                <td class="p-4">${d.rank}</td>
                <td class="p-4 font-mono">${d.discordId}</td>
                <td class="p-4 text-xs text-rose-600">فصل في: ${d.dismissDate}</td>
                <td class="p-4"><button onclick="deleteDismissed(${index})" class="px-2 py-1 bg-rose-50 text-rose-600 rounded font-bold text-xs">حذف نهائي</button></td>
            </tr>
        `).join('');
    }

    const permsOverviewContainer = document.getElementById('admin-permissions-overview-container');
    if (permsOverviewContainer) {
        const leaders = members.filter(m => m.permissions && Object.keys(m.permissions).length > 0);
        permsOverviewContainer.innerHTML = leaders.length === 0 ? `<p class="text-xs text-slate-400">لا يوجد مسؤولون بصلاحيات مخصصة حالياً.</p>` : leaders.map(l => `
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs">
                <div class="flex justify-between items-center">
                    <div>
                        <span class="font-black text-slate-900 text-sm block">${l.rank} / ${l.name} (سيف ${l.codeNumber})</span>
                        <span class="text-red-600 font-bold">${l.positionTitle}</span>
                    </div>
                    <div class="space-x-2">
                        <button onclick="openEditLeaderPermissionsModal(${l.id})" class="px-3 py-1.5 bg-blue-50 text-blue-600 font-bold rounded-xl">⚙️ تعديل الصلاحيات</button>
                        <button onclick="revokeLeaderRole(${l.id})" class="px-3 py-1.5 bg-rose-50 text-rose-600 font-bold rounded-xl">🗑️ إزالة من المسؤولين</button>
                    </div>
                </div>
                <div class="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                    ${Object.entries(l.permissions).map(([k, v]) => `
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${v ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-500'}">
                            ${k}: ${v ? 'مفعلة ✓' : 'مغلقة ✕'}
                        </span>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    const auditLogsContainer = document.getElementById('admin-audit-logs-tbody');
    if (auditLogsContainer) {
        auditLogsContainer.innerHTML = auditLogs.length === 0 ? `<tr><td colspan="3" class="p-6 text-center text-slate-400">لا توجد عمليات مسجلة في الـ Log.</td></tr>` : auditLogs.map(l => `
            <tr>
                <td class="p-4 font-mono text-[11px] text-slate-500">${l.date}</td>
                <td class="p-4 font-bold text-red-600">${l.author}</td>
                <td class="p-4 text-slate-800">${l.text}</td>
            </tr>
        `).join('');
    }

    const manageAnnList = document.getElementById('admin-announcements-manage-list');
    if (manageAnnList) {
        manageAnnList.innerHTML = announcements.length === 0 ? `<p class="text-xs text-slate-400">لا توجد تعاميم منشورة حالياً.</p>` : announcements.map((a, index) => `
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center text-xs">
                <div>
                    <span class="font-black text-slate-900 text-sm block">${a.title}</span>
                    <p class="text-slate-600 mt-1">${a.body}</p>
                    <span class="text-[10px] text-slate-400 block mt-1">بواسطة: ${a.author} (${a.date})</span>
                </div>
                <div>
                    <button onclick="deleteAnnouncement(${index})" class="px-3 py-1.5 bg-rose-50 text-rose-600 font-bold rounded-xl">🗑️ حذف التعميم</button>
                </div>
            </div>
        `).join('');
    }

    renderGuardDuties();
}

window.adjustMemberTime = function(id, secondsDelta) {
    if (!checkAdminPerm('inventoryManager', 'إدارة وزيادة/نقصان الساعات')) return;

    if (id === 'root_commander') {
        currentUser.totalSeconds = Math.max(0, (currentUser.totalSeconds || 0) + secondsDelta);
        localStorage.setItem('mp_current_user', JSON.stringify(currentUser));
    } else {
        const m = members.find(x => x.id === id);
        if (m) {
            m.totalSeconds = Math.max(0, (m.totalSeconds || 0) + secondsDelta);
        }
    }
    saveSystemData();
    showAlert('تم تعديل رصيد الساعات بنجاح.');
    renderAdminPanels();
}

window.setCustomMemberTime = function(id) {
    if (!checkAdminPerm('inventoryManager', 'تعديل الساعات بدقة')) return;

    let currentSecs = 0;
    let targetName = '';
    if (id === 'root_commander') {
        currentSecs = currentUser.totalSeconds || 0;
        targetName = 'القائد العام';
    } else {
        const m = members.find(x => x.id === id);
        if (!m) return;
        currentSecs = m.totalSeconds || 0;
        targetName = m.name;
    }

    const currentHours = Math.floor(currentSecs / 3600);
    showCustomPrompt(`أدخل عدد الساعات الجديدة للفرد (${targetName}):`, currentHours, (val) => {
        if (val === null) return;
        const newHours = parseInt(val);
        if (isNaN(newHours) || newHours < 0) {
            showAlert('يرجى إدخال رقم صحيح.', true);
            return;
        }
        const newTotalSecs = newHours * 3600;
        if (id === 'root_commander') {
            currentUser.totalSeconds = newTotalSecs;
            localStorage.setItem('mp_current_user', JSON.stringify(currentUser));
        } else {
            const m = members.find(x => x.id === id);
            if (m) m.totalSeconds = newTotalSecs;
        }
        saveSystemData();
        showAlert('تم ضبط ساعات العمل بدقة بنجاح.');
        renderAdminPanels();
    });
}

window.deleteAnnouncement = function(index) {
    if (!checkAdminPerm('canAnnounce', 'حذف التعاميم العسكرية')) return;
    if (confirm('هل أنت متأكد من حذف هذا التعميم؟')) {
        announcements.splice(index, 1);
        saveSystemData();
        showAlert('تم حذف التعميم بنجاح.');
        renderAdminPanels();
    }
}

window.openEditLeaderPermissionsModal = function(id) {
    if (!currentUser || (currentUser.id !== 'root_commander' && !currentUser.positionTitle?.includes('نائب'))) {
        showAlert('ليس لديك صلاحية تعديل صلاحيات المسؤولين', true);
        return;
    }
    const l = members.find(x => x.id === id);
    if (!l) return;
    const p = l.permissions || {};

    let modal = document.getElementById('edit-perms-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'edit-perms-modal';
        modal.className = 'fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="bg-white rounded-3xl overflow-hidden max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs">
            <div class="flex justify-between items-center border-b pb-2">
                <h3 class="font-black text-sm text-slate-900">تعديل صلاحيات المسؤول: ${l.rank} / ${l.name}</h3>
                <button onclick="document.getElementById('edit-perms-modal').remove()" class="px-3 py-1 bg-slate-100 rounded-xl font-bold">✕ إغلاق</button>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" id="edit-perm-add" ${p.addMember ? 'checked' : ''}> إضافة أفراد</label>
                <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" id="edit-perm-name" ${p.editName ? 'checked' : ''}> تعديل أسماء وأكواد</label>
                <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" id="edit-perm-rank" ${p.editRank ? 'checked' : ''}> تعديل الرتب</label>
                <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" id="edit-perm-dismiss" ${p.dismissMember ? 'checked' : ''}> فصل الأفراد</label>
                <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" id="edit-perm-warn" ${p.warnMember ? 'checked' : ''}> التحذيرات</label>
                <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" id="edit-perm-guards" ${p.manageGuards ? 'checked' : ''}> إدارة الخفارات</label>
                <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" id="edit-perm-notes" ${p.manageNotes ? 'checked' : ''}> الملاحظات السرية</label>
                <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" id="edit-perm-inventory" ${p.inventoryManager ? 'checked' : ''}> 📊 الجرد والساعات</label>
                <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" id="edit-perm-announce" ${p.canAnnounce ? 'checked' : ''}> التعاميم والتنبيهات</label>
                <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" id="edit-perm-credentials" ${p.editCredentials ? 'checked' : ''}> اليوزر والباسورد</label>
                <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" id="edit-perm-logs" ${p.viewLogs ? 'checked' : ''}> سجل العمليات</label>
            </div>
            <button onclick="saveLeaderPermissions(${l.id})" class="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md">حفظ التعديلات</button>
        </div>
    `;
}

window.saveLeaderPermissions = function(id) {
    const l = members.find(x => x.id === id);
    if (!l) return;

    l.permissions = {
        addMember: document.getElementById('edit-perm-add').checked,
        editName: document.getElementById('edit-perm-name').checked,
        editRank: document.getElementById('edit-perm-rank').checked,
        dismissMember: document.getElementById('edit-perm-dismiss').checked,
        warnMember: document.getElementById('edit-perm-warn').checked,
        manageGuards: document.getElementById('edit-perm-guards').checked,
        manageNotes: document.getElementById('edit-perm-notes').checked,
        inventoryManager: document.getElementById('edit-perm-inventory').checked,
        canAnnounce: document.getElementById('edit-perm-announce').checked,
        editCredentials: document.getElementById('edit-perm-credentials').checked,
        viewLogs: document.getElementById('edit-perm-logs').checked
    };

    saveSystemData();
    document.getElementById('edit-perms-modal').remove();
    showAlert('تم تحديث صلاحيات المسؤول بنجاح.');
}

window.revokeLeaderRole = function(id) {
    if (!currentUser || (currentUser.id !== 'root_commander' && !currentUser.positionTitle?.includes('نائب'))) {
        showAlert('ليس لديك صلاحية إزالة المسؤولين', true);
        return;
    }
    const l = members.find(x => x.id === id);
    if (!l) return;
    if (confirm(`هل أنت متأكد من إزالة الصلاحيات القيادية عن (${l.name}) وإعادته كفرد عادي؟`)) {
        l.permissions = {};
        l.positionTitle = 'فرد شرطة عسكرية';
        saveSystemData();
        showAlert('تم سحب المنصب القيادي بنجاح.');
    }
}

window.editAdminNote = function(id) {
    if (!checkAdminPerm('manageNotes', 'تعديل الملاحظات السرية')) return;
    const m = members.find(x => x.id === id);
    if (!m) return;
    showCustomPrompt(`أدخل الملاحظة السرية الخاصة بالفرد (${m.name}):`, m.adminNote || '', (val) => {
        if (val !== null) {
            m.adminNote = val.trim();
            saveSystemData();
            showAlert('تم حفظ الملاحظة بنجاح.');
        }
    });
}

window.editMemberDetails = function(id) {
    if (!checkAdminPerm('editName', 'تعديل أسماء وأكواد الأفراد')) return;
    const m = members.find(x => x.id === id);
    showCustomPrompt(`تعديل اسم الفرد (${m.name}):`, m.name, (newName) => {
        if (newName === null) return;
        showCustomPrompt(`تعديل رقم كود السيف للفرد (${m.name}):`, m.codeNumber, (newCodeInput) => {
            if (newCodeInput === null) return;
            const newCode = parseInt(newCodeInput);
            if (isNaN(newCode) || newCode < 1) {
                showAlert('يرجى إدخال رقم كود صحيح.', true);
                return;
            }
            m.name = newName.trim();
            m.codeNumber = newCode;
            saveSystemData();
            showAlert('تم تحديث بيانات الفرد بنجاح.');
        });
    });
}

window.openCredentialsModal = function(id) {
    if (!checkAdminPerm('editCredentials', 'تعديل بيانات الدخول (يوزر وباسورد)')) return;
    const m = members.find(x => x.id === id);
    if (!m) return;
    showCustomPrompt(`تعديل اسم المستخدم (اليوزر) للفرد (${m.name}):`, m.username || '', (newUsername) => {
        if (newUsername === null) return;
        showCustomPrompt(`تعديل كلمة المرور الجديدة للفرد (${m.name}):`, m.password || '', (newPassword) => {
            if (newPassword === null) return;
            if (!newUsername.trim() || !newPassword.trim()) {
                showAlert('لا يمكن ترك حقل اليوزر أو الباسورد فارغاً!', true);
                return;
            }
            m.username = newUsername.trim();
            m.password = newPassword.trim();
            playAlertSound();
            addAuditLog(`عدل بيانات الدخول للفرد ${m.name}`);
            saveSystemData();
            showAlert('تم تحديث بيانات الدخول بنجاح.');
        });
    });
}

window.handleAdminCreateMember = function(e) {
    e.preventDefault();
    if (!checkAdminPerm('addMember', 'إضافة أفراد جدد للنظام')) return;

    const name = document.getElementById('add-m-name').value.trim();
    const rank = document.getElementById('add-m-rank').value;
    const codeMode = document.getElementById('add-m-code-mode').value;
    const customCode = parseInt(document.getElementById('add-m-code-num').value);
    const discordId = document.getElementById('add-m-discord').value.trim();
    const username = document.getElementById('add-m-username').value.trim();
    const password = document.getElementById('add-m-password').value.trim();

    let finalCode = getNextSwordCode();
    if (codeMode === 'custom') {
        if (isNaN(customCode) || customCode < 1) {
            showAlert('يرجى إدخال رقم كود صحيح.', true);
            return;
        }
        if (members.some(m => m.codeNumber === customCode)) {
            showAlert(`⚠️ تنبيه: الكود سيف ${customCode} مستخدم بالفعل لفرد آخر!`, true);
            return;
        }
        finalCode = customCode;
    }

    members.push({
        id: Date.now(),
        name,
        rank,
        codeNumber: finalCode,
        discordId,
        username,
        password,
        positionTitle: 'فرد شرطة عسكرية',
        permissions: {},
        totalSeconds: 0,
        onDuty: false,
        adminNote: '',
        warnings: []
    });

    playAlertSound();
    pushNotification('إضافة فرد', `تمت إضافة الفرد: ${rank} / ${name} (سيف ${finalCode})`);
    addAuditLog(`أضاف فرداً جديداً: ${rank} / ${name} (سيف ${finalCode})`);
    saveSystemData();
    document.getElementById('admin-add-member-form').reset();
    showAlert('تم إضافة الفرد بنجاح.');
}

window.editMemberRank = function(id) {
    if (!checkAdminPerm('editRank', 'تعديل رتب الأفراد')) return;
    const m = members.find(x => x.id === id);
    const ranksListStr = MILITARY_RANKS.join(', ');
    showCustomPrompt(`اختر الرتبة الجديدة للفرد (${m.name}):\n(${ranksListStr})`, m.rank, (newRankInput) => {
        if (!newRankInput || !MILITARY_RANKS.includes(newRankInput.trim())) return;
        m.rank = newRankInput.trim();
        saveSystemData();
        refreshAllUI();
        showAlert('تم تحديث الرتبة بنجاح.');
    });
}

window.warnMember = function(id) {
    if (!checkAdminPerm('warnMember', 'إرسال تحذيرات عسكرية للأفراد')) return;
    const m = members.find(x => x.id === id);
    showCustomPrompt(`أدخل سبب التحذير للفرد (${m.name}):`, '', (reason) => {
        if (reason && reason.trim()) {
            if (!m.warnings) m.warnings = [];
            m.warnings.push({ reason: reason.trim(), date: new Date().toLocaleDateString('ar-SA') });
            saveSystemData();
            showAlert('تم إرسال التحذير بنجاح.');
            refreshAllUI();
        }
    });
}

window.deleteWarning = function(memberId, warnIdx) {
    if (!checkAdminPerm('warnMember', 'إدارة وحذف التحذيرات')) return;
    const m = members.find(x => x.id === memberId);
    if (!m) return;
    if (confirm('هل أنت متأكد من حذف هذا التحذير؟')) {
        m.warnings.splice(warnIdx, 1);
        saveSystemData();
        showAlert('تم حذف التحذير بنجاح.');
        renderAdminPanels();
    }
}

window.dismissMember = function(id) {
    if (!checkAdminPerm('dismissMember', 'فصل الأفراد نهائياً')) return;
    const m = members.find(x => x.id === id);
    if (confirm(`هل أنت متأكد من فصل ${m.name} نهائياً؟`)) {
        dismissedMembers.push({ ...m, dismissDate: new Date().toLocaleDateString('ar-SA') });
        members = members.filter(x => x.id !== id);
        saveSystemData();
        showAlert('تم فصل الفرد ونقله للأرشيف.');
    }
}

window.deleteDismissed = function(index) {
    if (!checkAdminPerm('dismissMember', 'حذف المفصولين من الأرشيف')) return;
    if (confirm('هل أنت متأكد من حذف هذا الفرد من الأرشيف نهائياً؟')) {
        dismissedMembers.splice(index, 1);
        saveSystemData();
        renderAdminPanels();
    }
}

window.clearAllDismissed = function() {
    if (!checkAdminPerm('dismissMember', 'تفريغ أرشيف المفصولين')) return;
    if (confirm('هل أنت متأكد من تفريغ أرشيف المفصولين بالكامل؟')) {
        dismissedMembers = [];
        saveSystemData();
        renderAdminPanels();
    }
}

window.handlePostAnnouncement = function(e) {
    e.preventDefault();
    if (!checkAdminPerm('canAnnounce', 'نشر التعاميم والتنبيهات العسكرية')) return;

    const title = document.getElementById('ann-title').value.trim();
    const body = document.getElementById('ann-body').value.trim();
    
    announcements.unshift({
        id: Date.now(),
        title,
        body,
        author: currentUser ? `${currentUser.rank || ''} ${currentUser.name}` : 'القيادة العليا',
        date: new Date().toLocaleDateString('ar-SA')
    });

    playAlertSound();
    pushNotification('تعميم عسكري جديد', title);
    addAuditLog(`أصدر تعميماً عسكرياً بعنوان: ${title}`);
    saveSystemData();
    e.target.reset();
    showAlert('تم نشر التعميم بنجاح.');
    renderAdminPanels();
}

window.handleAssignGuardDuty = function(e) {
    e.preventDefault();
    if (!checkAdminPerm('manageGuards', 'تكليف الأفراد بأوامر خفارة')) return;

    const memberId = parseInt(document.getElementById('guard-member-select').value);
    const location = document.getElementById('guard-location').value.trim();
    const durationMins = parseInt(document.getElementById('guard-duration-mins').value);
    const note = document.getElementById('guard-note').value.trim();

    const member = members.find(m => m.id === memberId);
    if (!member) return;

    guardDuties.unshift({
        id: Date.now(),
        memberId: member.id,
        memberName: member.name,
        memberCode: member.codeNumber,
        location,
        durationMins,
        note,
        issuerName: currentUser.name,
        issuerRank: currentUser.rank || 'قائد',
        assignedAt: Date.now(),
        status: 'pending'
    });

    playAlertSound();
    pushNotification('أمر خفارة', `تم تكليف الفرد (${member.name}) بخفارة في ${location}`);
    addAuditLog(`كلف الفرد ${member.name} بخفارة في ${location}`);
    saveSystemData();
    e.target.reset();
    showAlert('تم إرسال أمر الخفارة للفرد بنجاح.');
}

function renderGuardDuties() {
    const select = document.getElementById('guard-member-select');
    if (select) {
        const approved = [...members].sort((a, b) => a.codeNumber - b.codeNumber);
        select.innerHTML = approved.map(m => `<option value="${m.id}">سيف ${m.codeNumber} - ${m.rank} / ${m.name}</option>`).join('');
    }

    const tbody = document.getElementById('admin-guards-tbody');
    if (!tbody) return;
    tbody.innerHTML = guardDuties.length === 0 ? `<tr><td colspan="5" class="p-6 text-center text-slate-400">لا توجد خفارات مسجلة حالياً.</td></tr>` : guardDuties.map(g => `
        <tr>
            <td class="p-4 font-bold">سيف ${g.memberCode} - ${g.memberName}</td>
            <td class="p-4 text-xs">${g.location} <br><span class="text-slate-500">ملاحظة: ${g.note || 'لا توجد'}</span>
                ${g.videoUrl ? `<br><button onclick="openVideoModal('${g.videoUrl}')" class="mt-1 text-red-600 font-bold underline">🎥 معاينة فيديو الخفارة</button>` : ''}
            </td>
            <td class="p-4 text-xs font-bold text-red-600">${g.issuerRank} / ${g.issuerName}</td>
            <td class="p-4 text-xs">
                ${g.status === 'pending' ? '<span class="text-amber-600 font-bold block">بانتظار رفع الفيديو</span>' : '<span class="text-emerald-600 font-bold block">مكتملة (تم رفع الفيديو)</span>'}
            </td>
            <td class="p-4"><button onclick="deleteGuard(${g.id})" class="px-2 py-1 bg-slate-200 rounded text-xs">حذف</button></td>
        </tr>
    `).join('');
}

window.deleteGuard = function(id) {
    if (!checkAdminPerm('manageGuards', 'حذف أو إلغاء أوامر الخفارة')) return;
    guardDuties = guardDuties.filter(g => g.id !== id);
    saveSystemData();
    refreshAllUI();
}

window.handleCommanderCreateLeader = function(e) {
    e.preventDefault();
    if (currentUser && currentUser.id !== 'root_commander' && !currentUser.positionTitle?.includes('نائب')) {
        showAlert('ليس لديك صلاحية تعيين المسؤولين أو منح الصلاحيات', true);
        return;
    }

    const positionTitle = document.getElementById('lead-role-type').value;
    const name = document.getElementById('lead-name').value.trim();
    const rank = document.getElementById('lead-rank').value;
    const manualCode = parseInt(document.getElementById('lead-code').value);
    const discordId = document.getElementById('lead-discord').value.trim();
    const username = document.getElementById('lead-username').value.trim();
    const password = document.getElementById('lead-password').value.trim();

    if (isNaN(manualCode) || manualCode < 1) {
        showAlert('يرجى إدخال رقم سيف صحيح.', true);
        return;
    }

    if (members.some(m => m.codeNumber === manualCode)) {
        showAlert(`⚠️ تنبيه: كود السيف رقم ${manualCode} مستخدم بالفعل!`, true);
        return;
    }

    const permissions = {
        addMember: document.getElementById('perm-add-member')?.checked || false,
        editName: document.getElementById('perm-edit-name')?.checked || false,
        editRank: document.getElementById('perm-edit-rank')?.checked || false,
        dismissMember: document.getElementById('perm-dismiss')?.checked || false,
        warnMember: document.getElementById('perm-warn')?.checked || false,
        manageGuards: document.getElementById('perm-guards')?.checked || false,
        manageNotes: document.getElementById('perm-notes')?.checked || false,
        inventoryManager: document.getElementById('perm-inventory')?.checked || false,
        canAnnounce: document.getElementById('perm-announce')?.checked || false,
        editCredentials: document.getElementById('perm-edit-credentials')?.checked || false,
        viewLogs: document.getElementById('perm-view-logs')?.checked || false
    };

    members.push({
        id: Date.now(),
        name,
        rank,
        codeNumber: manualCode,
        discordId,
        username,
        password,
        positionTitle,
        permissions,
        totalSeconds: 0,
        onDuty: false,
        adminNote: '',
        warnings: []
    });

    playAlertSound();
    pushNotification('منصب قيادي جديد', `تم تعيين ${rank} / ${name} برقم سيف ${manualCode}`);
    addAuditLog(`أنشأ منصب قيادي (${positionTitle}) لـ ${rank} ${name}`);
    saveSystemData();
    e.target.reset();
    showAlert('تم تعيين المسؤول وتثبيت الصلاحيات بنجاح.');
}

refreshAllUI();
