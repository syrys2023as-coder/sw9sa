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
                    currentUser.permissions = fresh.permissions || {};
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
    if (!currentUser) return false;
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
    if (tabId === 'tab-leaderboard' && !checkAdminPerm('viewLeaderboard', 'الاطلاع على أوقات الجرد')) return;
    if (tabId === 'tab-announcements' && !checkAdminPerm('canAnnounce', 'نشر التعاميم والتنبيهات')) return;

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
                document.getElementById('btn-tab-announcements').classList.remove('hidden');
                document.getElementById('btn-tab-permissions-overview')?.classList.remove('hidden');
            } else {
                document.getElementById('btn-tab-commander-profile').classList.add('hidden');
                if (currentUser.positionTitle?.includes('نائب')) {
                    document.getElementById('btn-tab-roles').classList.remove('hidden');
                }
                if (currentUser.permissions?.viewLeaderboard) {
                    document.getElementById('btn-tab-leaderboard').classList.remove('hidden');
                } else {
                    document.getElementById('btn-tab-leaderboard').classList.add('hidden');
                }
                if (currentUser.permissions?.canAnnounce) {
                    document.getElementById('btn-tab-announcements').classList.remove('hidden');
                } else {
                    document.getElementById('btn-tab-announcements').classList.add('hidden');
                }
                document.getElementById('btn-tab-permissions-overview')?.classList.remove('hidden');
            }

            if (currentUser.id === 'root_commander' || currentUser.permissions?.viewLogs) {
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
    if (currentUser && currentUser.id !== 'root_commander') {
        renderMemberDashboard();
    }
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
        if (rc) {
            rc.codeNumber = 1;
            if (currentUser && currentUser.id === 'root_commander') {
                rc.onDuty = currentUser.onDuty;
                rc.rank = currentUser.rank;
            }
        }
    }

    // مزامنة حالة الدخول المباشرة للحساب الحالي إذا كان نشطاً في الذاكرة
    if (currentUser && currentUser.id !== 'root_commander') {
        const mObj = allApproved.find(m => m.id === currentUser.id);
        if (mObj) {
            mObj.onDuty = currentUser.onDuty;
            mObj.rank = currentUser.rank;
            mObj.totalSeconds = currentUser.totalSeconds;
        }
    }

    const approved = allApproved.sort((a, b) => a.codeNumber - b.codeNumber);

    document.getElementById('stat-total-members').innerText = approved.length;
    document.getElementById('stat-on-duty').innerText = approved.filter(m => m.onDuty).length;

    // استخراج أعلى رتبة عسكرية نشطة حالياً في الميدان لتحديث العرض فوراً
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
        
        if (currentUser.id !== 'root_commander') {
            const idx = members.findIndex(m => m.id === currentUser.id);
            if (idx !== -1) {
                members[idx].onDuty = true;
            }
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
    
    renderDutyPanel();
    renderPublicRoster();
}

window.renderMemberDashboard = function() {
    const container = document.getElementById('view-member-dashboard');
    if (!container || !currentUser) return;

    const myGuards = guardDuties.filter(g => g.memberId === currentUser.id);
    const myWarnings = currentUser.warnings || [];

    container.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-6 p-6">
            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center">
                <div>
                    <span class="px-3 py-1 bg-red-600 text-white font-black rounded-xl text-xs inline-block mb-2">سيف ${currentUser.codeNumber}</span>
                    <h2 class="text-xl font-black text-slate-900">${currentUser.rank} / ${currentUser.name}</h2>
                    <span class="text-xs text-slate-500">فرد شرطة عسكرية | ديسكورد: ${currentUser.discordId || 'غير مسجل'}</span>
                </div>
                <div>
                    <label class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md inline-block">
                        🎥 رفع فيديو الخفارة
                        <input type="file" accept="video/*" class="hidden" onchange="uploadGuardVideo(event, ${currentUser.id})">
                    </label>
                </div>
            </div>

            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-3">
                <h3 class="font-black text-slate-900 text-sm">أوامر تكليف بخفارة عسكرية</h3>
                ${myGuards.length === 0 ? '<p class="text-xs text-slate-400">لا توجد خفارات مكلف بها حالياً.</p>' : myGuards.map(g => `
                    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center text-xs">
                        <div>
                            <span class="font-black text-slate-900 block">الموقع: ${g.location} (المدة: ${g.durationMins} دقيقة)</span>
                            <span class="text-slate-500">ملاحظة: ${g.note || 'لا توجد ملاحظات'}</span>
                            ${g.videoUrl ? `<span class="text-emerald-600 font-bold block mt-1">✓ تم رفع فيديو الإثبات بنجاح</span>` : ''}
                        </div>
                        <div>
                            ${g.videoUrl ? `<button onclick="openVideoModal('${g.videoUrl}')" class="px-3 py-1.5 bg-slate-900 text-white font-bold rounded-xl">معاينة الفيديو المرفوع</button>` : '<span class="text-amber-600 font-bold">بانتظار رفع الفيديو</span>'}
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-3">
                <h3 class="font-black text-slate-900 text-sm">🚨 سجل التحذيرات الإدارية الخاصة بك</h3>
                ${myWarnings.length === 0 ? '<p class="text-xs text-slate-400">سجل نظيف، لا توجد أي تحذيرات مسجلة.</p>' : myWarnings.map(w => `
                    <div class="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-800 font-bold flex justify-between">
                        <span>${w.reason}</span>
                        <span class="text-rose-400">${w.date}</span>
                    </div>
                `).join('')}
            </div>

            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-3">
                <h3 class="font-black text-slate-900 text-sm">📢 التعاميم والأوامر العسكرية الرسمية</h3>
                ${announcements.length === 0 ? '<p class="text-xs text-slate-400">لا توجد تعاميم حالياً.</p>' : announcements.map(a => `
                    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 text-xs">
                        <span class="font-black text-slate-900 text-sm block">${a.title}</span>
                        <p class="text-slate-700">${a.body}</p>
                        <span class="text-[10px] text-slate-400 block pt-1">بواسطة: ${a.author} (${a.date})</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

window.uploadGuardVideo = function(e, memberId) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(uploadEvent) {
        const videoDataUrl = uploadEvent.target.result;
        const duty = guardDuties.find(g => g.memberId === memberId && g.status === 'pending');
        if (duty) {
            duty.videoUrl = videoDataUrl;
            duty.status = 'completed';
        } else if (guardDuties.length > 0) {
            guardDuties[0].videoUrl = videoDataUrl;
            guardDuties[0].status = 'completed';
        } else {
            guardDuties.unshift({
                id: Date.now(),
                memberId: currentUser.id,
                memberName: currentUser.name,
                memberCode: currentUser.codeNumber,
                location: 'خفارة ذاتية / عامة',
                durationMins: 60,
                note: 'رفع فيديو حر',
                issuerName: currentUser.name,
                issuerRank: currentUser.rank,
                videoUrl: videoDataUrl,
                status: 'completed'
            });
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
                <button onclick="editMemberDetails(${m.id})" class="px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-bold">تعديل الاسم/الكود</button>
                <button onclick="openCredentialsModal(${m.id})" class="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold">تعديل اليوزر/الباس</button>
                <button onclick="editMemberRank(${m.id})" class="px-2 py-1 bg-slate-100 rounded text-xs font-bold">رتبة</button>
                <button onclick="warnMember(${m.id})" class="px-2 py-1 bg-amber-500 text-white rounded text-xs font-bold">تحذير</button>
                <button onclick="dismissMember(${m.id})" class="px-2 py-1 bg-slate-900 text-white rounded text-xs font-bold">فصل</button>
            </td>
        </tr>
    `).join('');

    const warnManageList = document.getElementById('admin-warnings-management-list');
    if (warnManageList) {
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

    const annListContainer = document.getElementById('admin-announcements-list');
    if (annListContainer) {
        annListContainer.innerHTML = announcements.length === 0 ? `<p class="text-xs text-slate-400">لا توجد تعاميم مسجلة حالياً.</p>` : announcements.map((a, idx) => `
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div class="flex justify-between items-center">
                    <span class="font-black text-slate-900 text-sm">${a.title}</span>
                    <button onclick="deleteAnnouncement(${idx})" class="px-2 py-1 bg-rose-50 text-rose-600 rounded font-bold">حذف التعميم</button>
                </div>
                <p class="text-slate-700 whitespace-pre-wrap">${a.body}</p>
                <div class="text-[10px] text-slate-400 flex justify-between">
                    <span>بواسطة: ${a.author}</span>
                    <span>${a.date}</span>
                </div>
            </div>
        `).join('');
    }

    const permsOverviewContainer = document.getElementById('admin-permissions-overview-container');
    if (permsOverviewContainer) {
        const leaders = members.filter(m => m.permissions && Object.keys(m.permissions).length > 0);
        permsOverviewContainer.innerHTML = leaders.length === 0 ? `<p class="text-xs text-slate-400">لا يوجد مسؤولون بصلاحيات مخصصة حالياً.</p>` : leaders.map(l => `
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                <div class="flex justify-between items-center">
                    <span class="font-black text-slate-900 text-sm">${l.rank} / ${l.name} (سيف ${l.codeNumber})</span>
                    <span class="px-2 py-1 bg-red-50 text-red-600 rounded font-bold">${l.positionTitle}</span>
                </div>
                <div class="flex flex-wrap gap-1 pt-1">
                    ${Object.entries(l.permissions).map(([k, v]) => `
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${v ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-500'}">
                            ${k}: ${v ? 'مفعلة ✓' : 'مغلقة ✕'}
                        </span>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    renderGuardDuties();
}

window.editAdminNote = function(id) {
    if (!checkAdminPerm('manageNotes', 'تعديل الملاحظات السرية')) return;
    const m = members.find(x => x.id === id);
    if (!m) return;
    const note = prompt(`أدخل الملاحظة السرية الخاصة بالفرد (${m.name}):`, m.adminNote || '');
    if (note === null) return;
    m.adminNote = note.trim();
    saveSystemData();
    showAlert('تم حفظ الملاحظة بنجاح.');
}

window.editMemberDetails = function(id) {
    if (!checkAdminPerm('editName', 'تعديل أسماء وأكواد الأفراد')) return;
    const m = members.find(x => x.id === id);
    const newName = prompt(`تعديل اسم الفرد (${m.name}):`, m.name);
    if (newName === null) return;
    const newCodeInput = prompt(`تعديل رقم كود السيف للفرد (${m.name}) [بين 40 و 1000]:`, m.codeNumber);
    if (newCodeInput === null) return;

    const newCode = parseInt(newCodeInput);
    if (isNaN(newCode) || newCode < 40 || newCode > 1000) {
        showAlert('يرجى إدخال رقم كود صحيح بين 40 و 1000 (سيف 1 محصور للقائد العام).', true);
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

window.openCredentialsModal = function(id) {
    if (!checkAdminPerm('editCredentials', 'تعديل بيانات الدخول (يوزر وباسورد)')) return;
    const m = members.find(x => x.id === id);
    if (!m) return;
    const newUsername = prompt(`تعديل اسم المستخدم (اليوزر) للفرد (${m.name}):`, m.username || '');
    if (newUsername === null) return;
    const newPassword = prompt(`تعديل كلمة المرور الجديدة للفرد (${m.name}):`, m.password || '');
    if (newPassword === null) return;

    if (!newUsername.trim() || !newPassword.trim()) {
        showAlert('لا يمكن ترك حقل اليوزر أو الباسورد فارغاً!', true);
        return;
    }

    m.username = newUsername.trim();
    m.password = newPassword.trim();
    playAlertSound();
    addAuditLog(`عدل بيانات الدخول (اليوزر/الباس) للفرد ${m.name}`);
    saveSystemData();
    showAlert('تم تحديث بيانات الدخول بنجاح.');
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
        if (isNaN(customCode) || customCode < 40 || customCode > 1000) {
            showAlert('يرجى إدخال رقم كود صحيح بين 40 و 1000 (سيف 1 مخصص للقائد العام).', true);
            return;
        }
        if (customCode === 1 || members.some(m => m.codeNumber === customCode)) {
            showAlert(`⚠️ تنبيه: الكود سيف ${customCode} محجوز أو مستخدم بالفعل!`, true);
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
    const newRankInput = prompt(`اختر الرتبة الجديدة للفرد (${m.name}):\n(${MILITARY_RANKS.join(', ')})`, m.rank);
    if (!newRankInput || !MILITARY_RANKS.includes(newRankInput.trim())) return;

    m.rank = newRankInput.trim();
    saveSystemData();
    refreshAllUI();
    showAlert('تم تحديث الرتبة بنجاح.');
}

window.warnMember = function(id) {
    if (!checkAdminPerm('warnMember', 'إرسال تحذيرات عسكرية للأفراد')) return;
    const m = members.find(x => x.id === id);
    const reason = prompt(`أدخل سبب التحذير للفرد ${m.name}:`);
    if (reason && reason.trim()) {
        if (!m.warnings) m.warnings = [];
        m.warnings.push({ reason: reason.trim(), date: new Date().toLocaleDateString('ar-SA') });
        saveSystemData();
        showAlert('تم إرسال وتحجيل التحذير بنجاح.');
        refreshAllUI();
    }
}

window.deleteWarning = function(memberId, warnIdx) {
    if (!checkAdminPerm('warnMember', 'إدارة وحذف التحذيرات')) return;
    const m = members.find(x => x.id === memberId);
    if (!m) return;
    if (confirm('هل أنت متأكد من حذف هذا التحذير؟')) {
        if (m.warnings && m.warnings[warnIdx] !== undefined) {
            m.warnings.splice(warnIdx, 1);
            saveSystemData();
            showAlert('تم حذف التحذير بنجاح.');
            renderAdminPanels();
        } else {
            showAlert('حدث خطأ: التحذير غير موجود.', true);
        }
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

window.handlePostAnnouncement = function(e) {
    e.preventDefault();
    if (!checkAdminPerm('canAnnounce', 'نشر التعاميم والتنبيهات العسكرية')) return;

    const title = document.getElementById('ann-title').value.trim();
    const body = document.getElementById('ann-body').value.trim();
    
    if (!title || !body) {
        showAlert('يرجى تعبئة عنوان ومحتوى التعميم.', true);
        return;
    }

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

window.deleteAnnouncement = function(idx) {
    if (!checkAdminPerm('canAnnounce', 'حذف التعاميم العسكرية')) return;
    if (confirm('هل أنت متأكد من حذف هذا التعميم؟')) {
        announcements.splice(idx, 1);
        saveSystemData();
        showAlert('تم حذف التعميم بنجاح.');
        renderAdminPanels();
    }
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
    pushNotification('أمر خفارة', `تم تكليف الفرد (${member.name} - سيف ${member.codeNumber}) بخفارة في ${location}`);
    addAuditLog(`كلف الفرد ${member.name} (سيف ${member.codeNumber}) بخفارة في ${location}`);
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

    if (manualCode < 40 || manualCode > 1000) {
        showAlert('يجب أن يكون الكود بين 40 و 1000 (سيف 1 مخصص حصرياً للقائد العام).', true);
        return;
    }

    if (manualCode === 1 || members.some(m => m.codeNumber === manualCode)) {
        showAlert(`⚠️ تنبيه: كود السيف رقم ${manualCode} محجوز أو مستخدم بالفعل!`, true);
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
        canAnnounce: document.getElementById('perm-announce')?.checked || false,
        editCredentials: document.getElementById('perm-credentials')?.checked || false,
        viewLogs: document.getElementById('perm-logs')?.checked || false,
        viewLeaderboard: document.getElementById('perm-view-leaderboard')?.checked || false
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
