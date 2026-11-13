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
    'جندي',
    'جندي أول',
    'عريف',
    'وكيل رقيب',
    'رقيب',
    'رقيب أول',
    'رئيس رقباء',
    'ملازم',
    'ملازم أول',
    'نقيب',
    'رائد',
    'مقدم',
    'عقيد',
    'عميد',
    'لواء',
    'فريق',
    'فريق أول'
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
                    currentUser.codeNumber = data.rootCommanderProfile.codeNumber || currentUser.codeNumber;
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
            codeNumber: currentUser.codeNumber,
            totalSeconds: currentUser.totalSeconds || 0,
            onDuty: currentUser.onDuty || false
        } : null,
        updatedAt: Date.now()
    }).catch(err => console.error(err));
}

function getNextSwordCode() {
    const approved = members.filter(m => m.codeNumber);
    if (currentUser && currentUser.codeNumber) approved.push(currentUser);
    let nextNum = 40;
    while (approved.some(m => m.codeNumber === nextNum) && nextNum <= 1000) {
        nextNum++;
    }
    return nextNum;
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

    if (u === 'admin' && p === 'admin123') {
        db.collection("military_police").doc("system_data").get().then((doc) => {
            let savedRank = 'فريق أول';
            let savedCode = 40;
            let savedTotalSecs = 0;
            let savedOnDuty = false;
            if (doc.exists && doc.data().rootCommanderProfile) {
                savedRank = doc.data().rootCommanderProfile.rank || 'فريق أول';
                savedCode = doc.data().rootCommanderProfile.codeNumber || 40;
                savedTotalSecs = doc.data().rootCommanderProfile.totalSeconds || 0;
                savedOnDuty = doc.data().rootCommanderProfile.onDuty || false;
            }
            currentUser = {
                id: 'root_commander',
                name: 'قائد الشرطة العسكرية',
                username: 'admin',
                rank: savedRank,
                discordId: '0000000000',
                positionTitle: 'قائد الشرطة العسكرية',
                codeNumber: savedCode,
                adminNote: '',
                totalSeconds: savedTotalSecs,
                onDuty: savedOnDuty
            };
            showAlert('تم تسجيل الدخول كقائد عام');
            refreshAllUI();
            switchAdminTab('tab-commander-profile', document.getElementById('btn-tab-commander-profile'));
            switchView('admin');
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
    
    if (hasAnyAdminPerm()) switchView('admin');
    else switchView('member-dashboard');
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
            } else {
                document.getElementById('btn-tab-commander-profile').classList.add('hidden');
                if (currentUser.positionTitle?.includes('نائب')) {
                    document.getElementById('btn-tab-roles').classList.remove('hidden');
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

function formatTimeDetailed(totalSeconds) {
    const s = Math.floor(totalSeconds || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs} ساعة و ${mins} دقيقة و ${secs} ثانية`;
}

window.renderPublicRoster = function() {
    const tbody = document.getElementById('public-roster-tbody');
    const search = (document.getElementById('search-roster')?.value || '').toLowerCase();
    
    let allApproved = [...members];
    if (currentUser && currentUser.id === 'root_commander') {
        if (!allApproved.some(m => m.id === 'root_commander')) {
            allApproved.push(currentUser);
        }
    }
    const approved = allApproved.sort((a, b) => a.codeNumber - b.codeNumber);

    document.getElementById('stat-total-members').innerText = approved.length;
    document.getElementById('stat-on-duty').innerText = approved.filter(m => m.onDuty).length;
    const maxCode = approved.length > 0 ? Math.max(...approved.map(m => m.codeNumber)) : 40;
    document.getElementById('stat-highest-code').innerText = `سيف ${maxCode}`;

    const filtered = approved.filter(m => 
        m.name.toLowerCase().includes(search) || 
        `سيف ${m.codeNumber}`.includes(search) ||
        (m.discordId || '').includes(search) ||
        (m.rank || '').includes(search)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">لا يوجد أفراد.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(m => `
        <tr class="hover:bg-slate-50 transition">
            <td class="p-4"><span class="px-3 py-1 bg-red-600 text-white font-black rounded-lg text-xs">سيف ${m.codeNumber}</span></td>
            <td class="p-4 font-bold text-slate-700">${m.rank}</td>
            <td class="p-4 font-black text-slate-900">${m.name}</td>
            <td class="p-4 font-mono text-slate-600">
                ${m.discordId || 'غير مسجل'} 
                ${m.discordId ? `<button onclick="copyDiscordId('${m.discordId}')" class="mr-2 text-red-600 hover:text-red-700 bg-red-50 px-2 py-0.5 rounded text-[10px]"><i class="fa-solid fa-copy"></i> نسخ</button>` : ''}
            </td>
            <td class="p-4"><span class="px-2 py-1 bg-slate-100 rounded-lg text-[11px]">${m.positionTitle}</span></td>
            <td class="p-4 font-bold text-slate-700">${formatTimeDetailed(m.totalSeconds)}</td>
            <td class="p-4">${m.onDuty ? '<span class="text-red-600 font-bold animate-pulse">● في الميدان</span>' : '<span class="text-slate-400">خارج الخدمة</span>'}</td>
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
            <span class="px-4 py-1.5 bg-red-600 text-white font-black rounded-xl text-sm inline-block">سيف ${currentUser.codeNumber}</span>
            <h3 class="text-xl font-black text-slate-900">${currentUser.rank} / ${currentUser.name}</h3>
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span class="text-xs text-slate-400 block">رصيد الوقت الفعلي</span>
                <span id="live-duty-timer" class="text-xl font-black text-red-600">${formatTimeDetailed(currentUser.totalSeconds)}</span>
            </div>
            ${currentUser.onDuty ? `
                <button onclick="toggleDuty(false)" class="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl text-xs">إنهاء المناوبة</button>
            ` : `
                <button onclick="toggleDuty(true)" class="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md">تسجيل دخول مناوبة (بدء العداد)</button>
            `}
        </div>
    `;
}

setInterval(() => {
    if (currentUser && currentUser.onDuty) {
        currentUser.totalSeconds = (currentUser.totalSeconds || 0) + 1;
        
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
        showAlert('تم تسجيل دخولك للميدان وبدأ عداد الثواني.');
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

        const activeGuard = guardDuties.find(g => g.memberId === currentUser.id && g.status === 'pending');
        if (activeGuard) {
            activeGuard.status = 'completed'; 
        }

        playAlertSound();
        pushNotification('تسجيل خروج', `سجل ${currentUser.rank} ${currentUser.name} خروجاً من المناوبة.`);
        addAuditLog(`سجل خروج من المناوبة: ${currentUser.rank} ${currentUser.name}`);
        showAlert(`تم إنهاء الخفارة والمناوبة بنجاح.`);
        
        saveSystemData();
    }
    
    renderDutyPanel();
    renderPublicRoster();
}

window.handleUpdateCommanderProfile = function(e) {
    e.preventDefault();
    if (!currentUser || currentUser.id !== 'root_commander') return;

    const newRank = document.getElementById('commander-edit-rank').value;
    const newCode = parseInt(document.getElementById('commander-edit-code').value);

    if (isNaN(newCode)) {
        showAlert('يرجى إدخال رقم كود صحيح.', true);
        return;
    }

    if (newCode < 40 || newCode > 1000) {
        showAlert('يجب أن يكون الكود بين 40 و 1000.', true);
        return;
    }

    if (members.some(m => m.codeNumber === newCode)) {
        showAlert(`تنبيه: الكود سيف ${newCode} مستخدم بالفعل لفرد آخر!`, true);
        return;
    }

    currentUser.rank = newRank;
    currentUser.codeNumber = newCode;

    playAlertSound();
    addAuditLog(`حدث القائد العام ملفه الشخصي: الرتبة (${newRank}) والكود (سيف ${newCode})`);
    saveSystemData();
    refreshAllUI();
    showAlert('تم تحديث ملفك الشخصي بنجاح.');
}

function renderAdminPanels() {
    if (!currentUser) return;

    if (currentUser.id === 'root_commander') {
        const rankEl = document.getElementById('commander-edit-rank');
        const codeEl = document.getElementById('commander-edit-code');
        if (rankEl && currentUser.rank) rankEl.value = currentUser.rank;
        if (codeEl && currentUser.codeNumber) codeEl.value = currentUser.codeNumber;
    }

    const membersTbody = document.getElementById('admin-members-tbody');
    const approved = [...members].sort((a, b) => a.codeNumber - b.codeNumber);
    membersTbody.innerHTML = approved.map(m => `
        <tr>
            <td class="p-4 font-black text-red-600">سيف ${m.codeNumber}</td>
            <td class="p-4">
                <span class="text-[11px] text-red-600 font-bold block">${m.rank}</span>
                <span class="font-bold text-slate-900">${m.name}</span>
                <span class="text-[10px] text-slate-500 block">قطاع: ${m.sector || 'غير مسجل'}</span>
            </td>
            <td class="p-4 font-mono text-xs">
                ${m.discordId} <button onclick="copyDiscordId('${m.discordId}')" class="mr-1 text-red-600 text-[10px]"><i class="fa-solid fa-copy"></i></button>
            </td>
            <td class="p-4 text-xs">
                <span class="text-slate-700 block max-w-xs break-words mb-1">${m.adminNote || '<span class="text-slate-400">لا توجد ملاحظة</span>'}</span>
                <button onclick="editAdminNote(${m.id})" class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-bold text-[10px]">✏️ تعديل الملاحظة السرية</button>
            </td>
            <td class="p-4 font-bold text-slate-700">${formatTimeDetailed(m.totalSeconds)}</td>
            <td class="p-4 flex flex-wrap gap-1">
                <button onclick="editMemberDetails(${m.id})" class="px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-bold">تعديل الاسم/الكود</button>
                <button onclick="openAdminEditCredentialsModal(${m.id})" class="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold">تعديل اليوزر/الباس</button>
                <button onclick="editMemberRank(${m.id})" class="px-2 py-1 bg-slate-100 rounded text-xs font-bold">ترقية / تعديل رتبة</button>
                <button onclick="warnMember(${m.id})" class="px-2 py-1 bg-amber-500 text-white rounded text-xs font-bold">تحذير</button>
                <button onclick="dismissMember(${m.id})" class="px-2 py-1 bg-slate-900 text-white rounded text-xs font-bold">فصل</button>
            </td>
        </tr>
    `).join('');

    const warnManageList = document.getElementById('admin-warnings-management-list');
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
                        <div class="flex gap-2">
                            <button onclick="editWarning(${m.id}, ${idx})" class="px-2 py-1 bg-blue-50 text-blue-600 rounded">تعديل</button>
                            <button onclick="deleteWarning(${m.id}, ${idx})" class="px-2 py-1 bg-rose-50 text-rose-600 rounded">حذف</button>
                        </div>
                    </div>
                `;
            });
        }
    });
    warnManageList.innerHTML = allWarningsHtml || `<p class="text-xs text-slate-400">لا توجد تحذيرات مسجلة للأفراد.</p>`;

    const dismissedTbody = document.getElementById('admin-dismissed-tbody');
    dismissedTbody.innerHTML = dismissedMembers.length === 0 ? `<tr><td colspan="5" class="p-6 text-center text-slate-400">لا يوجد أفراد مفصولين.</td></tr>` : dismissedMembers.map((d, index) => `
        <tr>
            <td class="p-4 font-bold">${d.name}</td>
            <td class="p-4">${d.rank}</td>
            <td class="p-4 font-mono">${d.discordId}</td>
            <td class="p-4 text-rose-600 font-bold">${d.dismissReason || 'فصل إداري'} (${d.dismissDate})</td>
            <td class="p-4">
                <button onclick="deleteDismissedMember(${index})" class="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold">حذف نهائي</button>
            </td>
        </tr>
    `).join('');

    const logsContainer = document.getElementById('admin-logs-container');
    if (logsContainer) {
        logsContainer.innerHTML = auditLogs.length === 0 ? `<p class="text-xs text-slate-400">لا توجد عمليات مسجلة بالـ Log.</p>` : auditLogs.map(l => `
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                <div><span class="font-bold text-red-600 block">${l.author}</span><span class="text-slate-700">${l.text}</span></div>
                <span class="text-[10px] text-slate-400 font-mono">${l.date}</span>
            </div>
        `).join('');
    }
}

window.deleteDismissedMember = function(index) {
    if (!checkAdminPerm('dismissMember') && currentUser.id !== 'root_commander') {
        showAlert('ليس لديك صلاحية حذف المفصولين.', true);
        return;
    }
    if (confirm('هل تريد حذف هذا السجل من قائمة المفصولين نهائياً؟')) {
        const removed = dismissedMembers.splice(index, 1);
        addAuditLog(`حذف سجل المفصول: ${removed[0]?.name || 'غير معروف'}`);
        saveSystemData();
        showAlert('تم حذف السجل بنجاح.');
    }
}

window.clearAllDismissed = function() {
    if (!checkAdminPerm('dismissMember') && currentUser.id !== 'root_commander') {
        showAlert('ليس لديك صلاحية تفريغ أرشيف المفصولين.', true);
        return;
    }
    if (confirm('هل أنت متأكد من تفريغ وحذف جميع سجلات المفصولين نهائياً؟')) {
        dismissedMembers = [];
        addAuditLog('قام بتفريغ أرشيف المفصولين بالكامل');
        saveSystemData();
        showAlert('تم تفريغ أرشيف المفصولين بنجاح.');
    }
}

window.editAdminNote = function(id) {
    const m = members.find(x => x.id === id);
    if (!m) return;
    const note = prompt(`أدخل الملاحظة السرية الخاصة بالفرد (${m.name}) - تظهر للمسؤولين فقط:`, m.adminNote || '');
    if (note === null) return;

    m.adminNote = note.trim();
    playAlertSound();
    addAuditLog(`حدث الملاحظة السرية للفرد ${m.name}`);
    saveSystemData();
    showAlert('تم حفظ الملاحظة السرية بنجاح.');
}

window.editMemberDetails = function(id) {
    const m = members.find(x => x.id === id);
    const newName = prompt(`تعديل اسم الفرد (${m.name}):`, m.name);
    if (newName === null) return;
    const newCodeInput = prompt(`تعديل رقم كود السيف للفرد (${m.name}) [بين 40 و 1000]:`, m.codeNumber);
    if (newCodeInput === null) return;

    const newCode = parseInt(newCodeInput);
    if (isNaN(newCode) || newCode < 40 || newCode > 1000) {
        showAlert('يرجى إدخال رقم صحيح للكود بين 40 و 1000.', true);
        return;
    }

    const isUsedByOther = members.some(x => x.codeNumber === newCode && x.id !== id) || (currentUser && currentUser.codeNumber === newCode && currentUser.id !== id);
    if (isUsedByOther) {
        showAlert(`⚠️ تنبيه: الكود سيف ${newCode} مستخدم بالفعل لفرد آخر! لم يتم التعديل.`, true);
        return;
    }

    m.name = newName.trim();
    m.codeNumber = newCode;
    playAlertSound();
    addAuditLog(`عدل بيانات الفرد: الاسم إلى (${m.name}) والكود إلى (سيف ${m.codeNumber})`);
    saveSystemData();
    showAlert('تم تحديث بيانات الفرد بنجاح.');
}

window.handleAdminCreateMember = function(e) {
    e.preventDefault();
    const name = document.getElementById('add-m-name').value.trim();
    const rank = document.getElementById('add-m-rank').value;
    const codeMode = document.getElementById('add-m-code-mode').value;
    const customCode = parseInt(document.getElementById('add-m-code-num').value);
    const sector = document.getElementById('add-m-sector').value.trim();
    const age = parseInt(document.getElementById('add-m-age').value) || 0;
    const discordId = document.getElementById('add-m-discord').value.trim();
    const username = document.getElementById('add-m-username').value.trim();
    const password = document.getElementById('add-m-password').value.trim();

    let finalCode = getNextSwordCode();
    if (codeMode === 'custom') {
        if (isNaN(customCode) || customCode < 40 || customCode > 1000) {
            showAlert('يرجى إدخال رقم كود سيف صحيح بين 40 و 1000.', true);
            return;
        }
        if (members.some(m => m.codeNumber === customCode) || (currentUser && currentUser.codeNumber === customCode)) {
            showAlert(`⚠️ تنبيه: الكود سيف ${customCode} مستخدم بالفعل!`, true);
            return;
        }
        finalCode = customCode;
    }

    members.push({
        id: Date.now(),
        name,
        rank,
        codeNumber: finalCode,
        sector,
        age,
        mic: 'نعم',
        recording: 'نعم',
        reason: 'إضافة مباشرة من القيادة',
        experience: 'غير مفصلة',
        contribution: 'غير مفصلة',
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
    pushNotification('إضافة فرد', `تمت إضافة الفرد الجديد: ${rank} / ${name} (سيف ${finalCode})`);
    addAuditLog(`أضاف فرداً جديداً: ${rank} / ${name} (سيف ${finalCode}) بواسطة ${currentUser.name}`);
    saveSystemData();
    document.getElementById('admin-add-member-form').reset();
    showAlert('تم إضافة الفرد بنجاح.');
}

window.editMemberRank = function(id) {
    const m = members.find(x => x.id === id);
    const newRankInput = prompt(`اختر أو اكتب الرتبة الجديدة للفرد (${m.name}):\n(القائمة: ${MILITARY_RANKS.join(', ')})`, m.rank);
    if (!newRankInput || !MILITARY_RANKS.includes(newRankInput.trim())) return;

    const newRank = newRankInput.trim();
    m.rank = newRank;

    showAlert(`تمت ترقية/تعديل رتبة ${m.name} إلى (${newRank}) بنجاح (بدون تغيير الكود تلقائياً).`);
    addAuditLog(`رقى/عدل رتبة الفرد ${m.name} إلى ${newRank}`);
    
    saveSystemData();
    refreshAllUI();
}

window.warnMember = function(id) {
    const m = members.find(x => x.id === id);
    const reason = prompt(`أدخل سبب التحذير لـ ${m.name}:`);
    if (reason && reason.trim()) {
        if (!m.warnings) m.warnings = [];
        m.warnings.push({
            reason: reason.trim(),
            by: `${currentUser.rank} ${currentUser.name}`,
            date: new Date().toLocaleDateString('ar-SA')
        });
        playAlertSound();
        pushNotification('تحذير إداري', `صدر تحذير جديد بحق الفرد: ${m.name} - ${reason.trim()}`);
        addAuditLog(`أصدر تحذيراً للفرد ${m.name} بسبب: ${reason.trim()}`);
        saveSystemData();
        showAlert('تم إرسال التحذير بنجاح.');
    }
}

window.editWarning = function(memberId, warnIdx) {
    const m = members.find(x => x.id === memberId);
    const curr = m.warnings[warnIdx].reason;
    const updated = prompt('تعديل سبب التحذير:', curr);
    if (updated !== null) {
        m.warnings[warnIdx].reason = updated.trim();
        pushNotification('تعديل تحذير', `تم تعديل تحذير الفرد: ${m.name}`);
        addAuditLog(`عدل تحذير الفرد ${m.name}`);
        saveSystemData();
        showAlert('تم تعديل التحذير.');
    }
}

window.deleteWarning = function(memberId, warnIdx) {
    const m = members.find(x => x.id === memberId);
    if (confirm('هل تريد حذف هذا التحذير؟')) {
        m.warnings.splice(warnIdx, 1);
        playAlertSound();
        pushNotification('حذف تحذير', `تم حذف تحذير من سجل الفرد: ${m.name}`);
        addAuditLog(`حذف تحذير من سجل الفرد ${m.name}`);
        saveSystemData();
        showAlert('تم حذف التحذير.');
    }
}

window.dismissMember = function(id) {
    const m = members.find(x => x.id === id);
    if (confirm(`هل أنت متأكد من فصل ${m.name} نهائياً؟`)) {
        dismissedMembers.push({
            ...m,
            dismissDate: new Date().toLocaleDateString('ar-SA'),
            dismissReason: 'فصل إداري من القيادة'
        });
        members = members.filter(x => x.id !== id);
        guardDuties = guardDuties.filter(g => g.memberId !== id);
        playAlertSound();
        pushNotification('فصل فرد', `تم فصل الفرد: ${m.rank} ${m.name} نهائياً من الأكاديمية`);
        addAuditLog(`فصل الفرد: ${m.rank} ${m.name} (سيف ${m.codeNumber})`);
        saveSystemData();
        showAlert('تم فصل الفرد ونقله للأرشيف.');
    }
}

window.handleAssignGuardDuty = function(e) {
    e.preventDefault();
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
        issuerPosition: currentUser.positionTitle || 'القيادة',
        assignedAt: Date.now(),
        status: 'pending',
        videoData: null
    });

    playAlertSound();
    pushNotification('أمر خفارة', `تم تكليف الفرد (${member.name} - سيف ${member.codeNumber}) بخفارة في ${location}`);
    addAuditLog(`كلف الفرد ${member.name} (سيف ${member.codeNumber}) بخفارة في ${location}`);
    saveSystemData();
    e.target.reset();
    showAlert('تم إرسال أمر الخفارة للفرد بنجاح.');
}

function renderGuardDuties() {
    const select = document.getElementById('guard-member-select');
    if (select) {
        let allApproved = [...members];
        if (currentUser && currentUser.id === 'root_commander' && !allApproved.some(m => m.id === 'root_commander')) {
            allApproved.push(currentUser);
        }
        const approved = allApproved.sort((a, b) => a.codeNumber - b.codeNumber);
        select.innerHTML = approved.map(m => `<option value="${m.id}">سيف ${m.codeNumber} - ${m.rank} / ${m.name}</option>`).join('');
    }

    const tbody = document.getElementById('admin-guards-tbody');
    if (!tbody) return;
    tbody.innerHTML = guardDuties.length === 0 ? `<tr><td colspan="5" class="p-6 text-center text-slate-400">لا توجد خفارات.</td></tr>` : guardDuties.map(g => `
        <tr>
            <td class="p-4 font-bold">سيف ${g.memberCode} - ${g.memberName}</td>
            <td class="p-4 text-xs">${g.location} <br><span class="text-slate-500">ملاحظة: ${g.note || 'لا توجد'}</span></td>
            <td class="p-4 text-xs font-bold text-red-600">${g.issuerRank} / ${g.issuerName}</td>
            <td class="p-4 text-xs">
                ${g.status === 'pending' ? '<span class="text-amber-600 font-bold block">جاري تنفيذ الخفارة</span>' : '<span class="text-emerald-600 font-bold block">أتم الخفارة</span>'}
                ${g.videoData ? `<button onclick="openVideoInNewTab('${g.videoData}')" class="mt-1 px-2.5 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700">🎥 مشاهدة فيديو الإثبات</button>` : '<span class="text-slate-400 block mt-1">بانتظار رفع الفرد لفيديو الخفارة</span>'}
            </td>
            <td class="p-4"><button onclick="deleteGuard(${g.id})" class="px-2 py-1 bg-slate-200 rounded text-xs">حذف</button></td>
        </tr>
    `).join('');
}

window.deleteGuard = function(id) {
    guardDuties = guardDuties.filter(g => g.id !== id);
    saveSystemData();
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

    if (manualCode < 40 || manualCode > 1000) {
        showAlert('يجب أن يكون الكود بين 40 و 1000.', true);
        return;
    }

    if (members.some(m => m.codeNumber === manualCode) || (currentUser && currentUser.codeNumber === manualCode)) {
        showAlert(`⚠️ تنبيه: كود السيف رقم ${manualCode} مستخدم بالفعل لفرد آخر!`, true);
        return;
    }

    const permissions = {
        addMember: document.getElementById('perm-add-member').checked,
        editName: document.getElementById('perm-edit-name').checked,
        editRank: document.getElementById('perm-edit-rank').checked,
        dismissMember: document.getElementById('perm-dismiss').checked,
        warnMember: document.getElementById('perm-warn').checked,
        manageGuards: document.getElementById('perm-guards').checked,
        manageNotes: document.getElementById('perm-notes').checked,
        canAnnounce: document.getElementById('perm-announce').checked,
        editCredentials: document.getElementById('perm-edit-credentials').checked,
        viewLogs: document.getElementById('perm-view-logs').checked
    };

    members.push({
        id: Date.now(),
        name,
        rank,
        codeNumber: manualCode,
        sector: 'القيادة العليا',
        age: 25,
        mic: 'نعم',
        recording: 'نعم',
        reason: 'منصب قيادي',
        experience: 'قيادة',
        contribution: 'إدارة',
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
    pushNotification('منصب قيادي جديد', `تم تعيين ${rank} / ${name} في منصب (${positionTitle}) برقم سيف ${manualCode}`);
    addAuditLog(`أنشأ منصب قيادي (${positionTitle}) لـ ${rank} ${name} برقم كود يدوياً: سيف ${manualCode}`);
    saveSystemData();
    e.target.reset();
    showAlert('تم تعيين المنصب وتثبيت الكود والصلاحيات بنجاح.');
}

window.handlePostAnnouncement = function(e) {
    e.preventDefault();
    const title = document.getElementById('ann-title').value.trim();
    const body = document.getElementById('ann-body').value.trim();
    announcements.unshift({
        id: Date.now(),
        title,
        body,
        author: `${currentUser.rank || ''} ${currentUser.name}`,
        date: new Date().toLocaleDateString('ar-SA')
    });
    playAlertSound();
    addAuditLog(`أصدر تعميماً عسكرياً بعنوان: ${title}`);
    saveSystemData();
    e.target.reset();
    showAlert('تم نشر التعميم.');
}
