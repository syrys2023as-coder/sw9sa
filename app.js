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
                    currentUser.codeNumber = 1;
                    currentUser.totalSeconds = data.rootCommanderProfile.totalSeconds || currentUser.totalSeconds;
                }
            } else {
                const fresh = members.find(m => m.id === currentUser.id);
                if (fresh) {
                    currentUser.rank = fresh.rank;
                    currentUser.codeNumber = fresh.codeNumber;
                    currentUser.totalSeconds = fresh.totalSeconds;
                }
            }
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
            codeNumber: 1,
            totalSeconds: currentUser.totalSeconds || 0,
            onDuty: currentUser.onDuty || false
        } : null,
        updatedAt: Date.now()
    }).catch(err => console.error(err));
}

function getNextSwordCode() {
    const approved = members.filter(m => m.codeNumber);
    let nextNum = 2;
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

function checkAdminPerm(permKey) {
    if (!currentUser) return false;
    if (currentUser.id === 'root_commander') return true;
    if (!currentUser.permissions) return false;
    return currentUser.permissions[permKey] === true;
}

window.switchView = function(view) {
    ['home', 'login', 'duty', 'admin', 'member-dashboard'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) el.classList.add('hidden');
    });

    if (view === 'duty') renderDutyPanel();
    else if (view === 'admin') {
        if (!hasAnyAdminPerm()) { switchView('login'); return; }
        renderAdminPanels();
    } else if (view === 'member-dashboard') {
        if (!currentUser) { switchView('login'); return; }
        renderMemberDashboard();
    }
    document.getElementById(`view-${view}`).classList.remove('hidden');
}

window.switchAdminTab = function(tabId, btnEl) {
    if (tabId === 'tab-logs' && !checkAdminPerm('viewLogs') && currentUser?.id !== 'root_commander') {
        showAlert('ليس لديك صلاحية معاينة سجل العمليات (Log)', true);
        return;
    }
    if (tabId === 'tab-leaderboard' && !checkAdminPerm('viewLeaderboard') && currentUser?.id !== 'root_commander') {
        showAlert('ليس لديك صلاحية الاطلاع على صفحة أوقات الجرد وأعلى الساعات', true);
        return;
    }

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
        showAlert(`تم نسخ آيدي الديسكورد: ${discordId}`);
    });
}

window.handleLogin = function(e) {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();

    if (u === 'mp_admin_9921#secure' && p === 'X9#kL9$mP2!qZ8') {
        db.collection("military_police").doc("system_data").get().then((doc) => {
            let savedRank = 'فريق أول';
            let savedTotalSecs = 0;
            let savedOnDuty = false;
            if (doc.exists && doc.data().rootCommanderProfile) {
                savedRank = doc.data().rootCommanderProfile.rank || 'فريق أول';
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
                codeNumber: 1,
                totalSeconds: savedTotalSecs,
                adminNote: '',
                onDuty: savedOnDuty
            };
            showAlert('تم تسجيل الدخول كقائد عام بنجاح');
            refreshAllUI();
            // التوجيه المباشر إلى الصفحة الرئيسية فور تسجيل الدخول
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
    playAlertSound();
    showAlert(`أهلاً بك ${found.rank} / ${found.name}`);
    refreshAllUI();
    
    // التوجيه المباشر إلى الصفحة الرئيسية فور تسجيل الدخول لجميع المستخدمين
    switchView('home');
}

window.handleLogout = function() {
    if (currentUser && currentUser.onDuty) {
        toggleDuty(false);
    }
    currentUser = null;
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
            document.getElementById('current-role-badge').innerText = `المنصب: ${currentUser.positionTitle}`;
            
            if (currentUser.id === 'root_commander') {
                document.getElementById('btn-tab-commander-profile').classList.remove('hidden');
                document.getElementById('btn-tab-roles').classList.remove('hidden');
                document.getElementById('btn-tab-leaderboard').classList.remove('hidden');
            } else {
                document.getElementById('btn-tab-commander-profile').classList.add('hidden');
                if (currentUser.positionTitle?.includes('نائب')) {
                    document.getElementById('btn-tab-roles').classList.remove('hidden');
                }
                if (checkAdminPerm('viewLeaderboard')) {
                    document.getElementById('btn-tab-leaderboard').classList.remove('hidden');
                } else {
                    document.getElementById('btn-tab-leaderboard').classList.add('hidden');
                }
            }

            if (currentUser.id === 'root_commander' || checkAdminPerm('viewLogs')) {
                document.getElementById('btn-tab-logs').classList.remove('hidden');
            } else {
                document.getElementById('btn-tab-logs').classList.add('hidden');
            }
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
}

window.renderPublicRoster = function() {
    const tbody = document.getElementById('public-roster-tbody');
    const search = (document.getElementById('search-roster')?.value || '').toLowerCase();
    
    let allApproved = [...members];
    if (!allApproved.some(m => m.id === 'root_commander')) {
        allApproved.push({
            id: 'root_commander',
            name: 'قائد الشرطة العسكرية العام',
            rank: currentUser && currentUser.id === 'root_commander' ? currentUser.rank : 'فريق أول',
            codeNumber: 1,
            discordId: '0000000000',
            positionTitle: 'قائد الشرطة العسكرية',
            onDuty: currentUser && currentUser.id === 'root_commander' ? currentUser.onDuty : false
        });
    } else {
        const rc = allApproved.find(m => m.id === 'root_commander');
        if (rc) rc.codeNumber = 1;
    }

    const approved = allApproved.sort((a, b) => a.codeNumber - b.codeNumber);

    document.getElementById('stat-total-members').innerText = approved.length;
    document.getElementById('stat-on-duty').innerText = approved.filter(m => m.onDuty).length;
    const maxCode = approved.length > 0 ? Math.max(...approved.map(m => m.codeNumber)) : 1;
    document.getElementById('stat-highest-code').innerText = `سيف ${maxCode}`;

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
            <td class="p-4 font-mono text-slate-600">
                ${m.discordId || 'غير مسجل'} 
                ${m.discordId && m.discordId !== '0000000000' ? `<button onclick="copyDiscordId('${m.discordId}')" class="mr-2 text-red-600 hover:text-red-700 bg-red-50 px-2 py-0.5 rounded text-[10px]"><i class="fa-solid fa-copy"></i> نسخ</button>` : ''}
            </td>
            <td class="p-4"><span class="px-2 py-1 bg-slate-100 rounded-lg text-[11px]">${m.positionTitle || 'فرد شرطة عسكرية'}</span></td>
            <td class="p-4">${m.onDuty ? '<span class="text-red-600 font-bold animate-pulse">● مسجل دخول (في الميدان)</span>' : '<span class="text-slate-400 font-bold">خارج الخدمة (مسجل خروج)</span>'}</td>
        </tr>
    `).join('');
}

function renderDutyPanel() {
    const container = document.getElementById('duty-content');
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
    
    renderDutyPanel();
    renderPublicRoster();
}

window.handleUpdateCommanderProfile = function(e) {
    e.preventDefault();
    if (!currentUser || currentUser.id !== 'root_commander') return;

    const newRank = document.getElementById('commander-edit-rank').value;
    currentUser.rank = newRank;
    currentUser.codeNumber = 1;

    playAlertSound();
    addAuditLog(`حدث القائد العام رتبته إلى (${newRank}) ويبقى سيف 1`);
    saveSystemData();
    refreshAllUI();
    showAlert('تم تحديث رتبة القائد العام بنجاح.');
}

function renderAdminPanels() {
    if (!currentUser) return;

    if (currentUser.id === 'root_commander') {
        const rankEl = document.getElementById('commander-edit-rank');
        const codeEl = document.getElementById('commander-edit-code');
        if (rankEl && currentUser.rank) rankEl.value = currentUser.rank;
        if (codeEl) {
            codeEl.value = 1;
            codeEl.disabled = true;
        }
    }

    // إدارة الأفراد مع عرض الساعات والدقائق والثواني بدقة
    const membersTbody = document.getElementById('admin-members-tbody');
    const approved = [...members].sort((a, b) => a.codeNumber - b.codeNumber);
    membersTbody.innerHTML = approved.map(m => `
        <tr>
            <td class="p-4 font-black text-red-600">سيف ${m.codeNumber}</td>
            <td class="p-4">
                <span class="text-[11px] text-red-600 font-bold block">${m.rank}</span>
                <span class="font-bold text-slate-900">${m.name}</span>
            </td>
            <td class="p-4 font-mono text-xs">${m.discordId}</td>
            <td class="p-4 font-bold text-red-600">${formatTimeDetailed(m.totalSeconds || 0)}</td>
            <td class="p-4 text-xs">
                <span class="text-slate-700 block max-w-xs break-words mb-1">${m.adminNote || '<span class="text-slate-400">لا توجد ملاحظة</span>'}</span>
                <button onclick="editAdminNote(${m.id})" class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-bold text-[10px]">✏️ ملاحظة</button>
            </td>
            <td class="p-4 flex flex-wrap gap-1">
                <button onclick="editMemberDetails(${m.id})" class="px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-bold">تعديل</button>
                <button onclick="editMemberRank(${m.id})" class="px-2 py-1 bg-slate-100 rounded text-xs font-bold">رتبة</button>
                <button onclick="warnMember(${m.id})" class="px-2 py-1 bg-amber-500 text-white rounded text-xs font-bold">تحذير</button>
                <button onclick="dismissMember(${m.id})" class="px-2 py-1 bg-slate-900 text-white rounded text-xs font-bold">فصل</button>
            </td>
        </tr>
    `).join('');

    // صفحة الجرد وأعلى الساعات
    const leaderboardContainer = document.getElementById('admin-leaderboard-container');
    if (leaderboardContainer) {
        let allForLeaderboard = [...approved];
        allForLeaderboard.push({
            name: currentUser && currentUser.id === 'root_commander' ? currentUser.name : 'قائد الشرطة العسكرية العام',
            rank: currentUser && currentUser.id === 'root_commander' ? currentUser.rank : 'فريق أول',
            codeNumber: 1,
            totalSeconds: currentUser && currentUser.id === 'root_commander' ? currentUser.totalSeconds : 0,
            onDuty: currentUser && currentUser.id === 'root_commander' ? currentUser.onDuty : false
        });
        const sortedByTime = allForLeaderboard.sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0));
        
        leaderboardContainer.innerHTML = sortedByTime.map((m, index) => `
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center text-xs">
                <div class="flex items-center gap-3">
                    <span class="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-black">#${index + 1}</span>
                    <div>
                        <span class="font-black text-slate-900 block">${m.rank} / ${m.name} (سيف ${m.codeNumber})</span>
                        <span class="text-slate-500">حالة الدخول: ${m.onDuty ? '● في الميدان حالياً' : 'خارج الخدمة'}</span>
                    </div>
                </div>
                <div class="text-left font-black text-red-600 text-sm">
                    ${formatTimeDetailed(m.totalSeconds || 0)}
                </div>
            </div>
        `).join('');
    }
}

window.editAdminNote = function(id) {
    const m = members.find(x => x.id === id);
    if (!m) return;
    const note = prompt(`أدخل الملاحظة السرية الخاصة بالفرد (${m.name}):`, m.adminNote || '');
    if (note === null) return;
    m.adminNote = note.trim();
    saveSystemData();
    showAlert('تم حفظ الملاحظة بنجاح.');
}

window.editMemberDetails = function(id) {
    const m = members.find(x => x.id === id);
    const newName = prompt(`تعديل اسم الفرد (${m.name}):`, m.name);
    if (newName === null) return;
    const newCodeInput = prompt(`تعديل رقم كود السيف للفرد (${m.name}) [بين 2 و 1000]:`, m.codeNumber);
    if (newCodeInput === null) return;

    const newCode = parseInt(newCodeInput);
    if (isNaN(newCode) || newCode < 2 || newCode > 1000) {
        showAlert('يرجى إدخال رقم كود صحيح بين 2 و 1000 (سيف 1 محصور للقائد العام).', true);
        return;
    }

    const isUsedByOther = members.some(x => x.codeNumber === newCode && x.id !== id);
    if (isUsedByOther) {
        showAlert(`⚠️ تنبيه: الكود سيف ${newCode} مستخدم بالفعل لفرد آخر!`, true);
        return;
    }

    m.name = newName.trim();
    m.codeNumber = newCode;
    saveSystemData();
    showAlert('تم تحديث بيانات الفرد بنجاح.');
}

window.handleAdminCreateMember = function(e) {
    e.preventDefault();
    const name = document.getElementById('add-m-name').value.trim();
    const rank = document.getElementById('add-m-rank').value;
    const codeMode = document.getElementById('add-m-code-mode').value;
    const customCode = parseInt(document.getElementById('add-m-code-num').value);
    const discordId = document.getElementById('add-m-discord').value.trim();
    const username = document.getElementById('add-m-username').value.trim();
    const password = document.getElementById('add-m-password').value.trim();

    let finalCode = getNextSwordCode();
    if (codeMode === 'custom') {
        if (isNaN(customCode) || customCode < 2 || customCode > 1000) {
            showAlert('يرجى إدخال رقم كود صحيح بين 2 و 1000 (سيف 1 مخصص للقائد العام).', true);
            return;
        }
        if (customCode === 1 || members.some(m => m.codeNumber === customCode)) {
            showAlert(`⚠️ تنبيه: الكود سيف ${customCode} محجوز أو مستخدم بالفعل!`, true);
            return;
        }
        finalCode = customCode;
    }

    // إزالة حقل القطاع الحالي تماماً عند إضافة فرد جديد
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
    const m = members.find(x => x.id === id);
    const newRankInput = prompt(`اختر الرتبة الجديدة للفرد (${m.name}):\n(${MILITARY_RANKS.join(', ')})`, m.rank);
    if (!newRankInput || !MILITARY_RANKS.includes(newRankInput.trim())) return;

    m.rank = newRankInput.trim();
    saveSystemData();
    refreshAllUI();
    showAlert('تم تحديث الرتبة بنجاح.');
}

window.warnMember = function(id) {
    const m = members.find(x => x.id === id);
    const reason = prompt(`أدخل سبب التحذير لـ ${m.name}:`);
    if (reason && reason.trim()) {
        if (!m.warnings) m.warnings = [];
        m.warnings.push({ reason: reason.trim(), date: new Date().toLocaleDateString('ar-SA') });
        saveSystemData();
        showAlert('تم إرسال التحذير بنجاح.');
    }
}

window.dismissMember = function(id) {
    const m = members.find(x => x.id === id);
    if (confirm(`هل أنت متأكد من فصل ${m.name} نهائياً؟`)) {
        dismissedMembers.push({ ...m, dismissDate: new Date().toLocaleDateString('ar-SA') });
        members = members.filter(x => x.id !== id);
        saveSystemData();
        showAlert('تم فصل الفرد ونقله للأرشيف.');
    }
}

window.handleCommanderCreateLeader = function(e) {
    e.preventDefault();
    const positionTitle = document.getElementById('lead-role-type').value;
    const name = document.getElementById('lead-name').value.trim();
    const rank = document.getElementById('lead-rank').value;
    const manualCode = parseInt(document.getElementById('lead-code').value);
    const discordId = document.getElementById('lead-discord').value.trim();
    const username = document.getElementById('lead-username').value.trim();
    const password = document.getElementById('lead-password').value.trim();

    if (manualCode < 2 || manualCode > 1000) {
        showAlert('يجب أن يكون الكود بين 2 و 1000 (سيف 1 مخصص حصرياً للقائد العام).', true);
        return;
    }

    if (manualCode === 1 || members.some(m => m.codeNumber === manualCode)) {
        showAlert(`⚠️ تنبيه: كود السيف رقم ${manualCode} محجوز أو مستخدم بالفعل!`, true);
        return;
    }

    // إضافة صلاحية معاينة صفحة أوقات الجرد للمسؤولين
    const permissions = {
        addMember: true,
        editName: true,
        editRank: true,
        dismissMember: true,
        warnMember: true,
        manageGuards: true,
        manageNotes: true,
        canAnnounce: true,
        editCredentials: true,
        viewLogs: true,
        viewLeaderboard: document.getElementById('perm-view-leaderboard')?.checked || true
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
