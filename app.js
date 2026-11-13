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

// تم تصحيح دالة فحص الصلاحيات لتشمل inventoryManager وكافة الصلاحيات المتاحة بدقة
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

function renderAdminTabs() {
    const container = document.getElementById('admin-tabs-container');
    if (!container) return;

    let html = '';
    if (currentUser.id === 'root_commander') {
        html += `<button id="btn-tab-commander-profile" onclick="switchAdminTab('tab-commander-profile', this)" class="admin-tab px-3 py-2 bg-red-600 text-white font-bold rounded-xl text-xs">تعديل ملفي</button>`;
    }
    if (currentUser.id === 'root_commander' || currentUser.permissions?.addMember) {
        html += `<button id="btn-tab-add-member" onclick="switchAdminTab('tab-add-member', this)" class="admin-tab px-3 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">+ إضافة فرد</button>`;
    }
    html += `<button id="btn-tab-members" onclick="switchAdminTab('tab-members', this)" class="admin-tab px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">إدارة الأفراد</button>`;
    if (currentUser.id === 'root_commander' || currentUser.permissions?.inventoryManager) {
        html += `<button id="btn-tab-inventory" onclick="switchAdminTab('tab-inventory', this)" class="admin-tab px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">📊 الجرد والساعات</button>`;
    }
    if (currentUser.id === 'root_commander' || currentUser.permissions?.warnMember) {
        html += `<button id="btn-tab-warnings" onclick="switchAdminTab('tab-warnings', this)" class="admin-tab px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">إدارة التحذيرات</button>`;
    }
    if (currentUser.id === 'root_commander' || currentUser.permissions?.dismissMember) {
        html += `<button id="btn-tab-dismissed" onclick="switchAdminTab('tab-dismissed', this)" class="admin-tab px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">المفصولين</button>`;
    }
    if (currentUser.id === 'root_commander' || currentUser.permissions?.manageGuards) {
        html += `<button id="btn-tab-guards" onclick="switchAdminTab('tab-guards', this)" class="admin-tab px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">الخفارات</button>`;
    }
    if (currentUser.id === 'root_commander' || currentUser.positionTitle?.includes('نائب')) {
        html += `<button id="btn-tab-roles" onclick="switchAdminTab('tab-roles', this)" class="admin-tab px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">المناصب</button>`;
    }
    html += `<button id="btn-tab-permissions-overview" onclick="switchAdminTab('tab-permissions-overview', this)" class="admin-tab px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">🛡️ قائمة المسؤولين</button>`;
    if (currentUser.id === 'root_commander' || currentUser.permissions?.viewLogs) {
        html += `<button id="btn-tab-logs" onclick="switchAdminTab('tab-logs', this)" class="admin-tab px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">سجل العمليات (Log)</button>`;
    }
    if (currentUser.id === 'root_commander' || currentUser.permissions?.canAnnounce) {
        html += `<button id="btn-tab-announce" onclick="switchAdminTab('tab-announce', this)" class="admin-tab px-3 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">تعميم</button>`;
    }
    container.innerHTML = html;
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
        onlineMembers.sort((a, b) => MILITARY_RANKS.indexOf(b.rank) - MILITARY_RANKS.indexOf(
