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

const logoUrl = "https://i.ibb.co/6PZ8155/logo.jpg";

let academyInfo = { name: "أكاديمية ق", logo: logoUrl };
let plans = [
    { id: 1, name: 'الاشتراك الأساسي', price: 250, duration: 'شهرياً', desc: 'مناسب للمبتدئين وتطوير الأساسيات', features: ['2 حصص تدريب أسبوعياً', 'متابعة أداء أساسية', 'زي رياضي مجاني'] },
    { id: 2, name: 'الاشتراك الاحترافي', price: 450, duration: 'شهرياً', desc: 'تطوير شامل ومكثف', features: ['4 حصص تدريب أسبوعياً', 'تحليل بيانات وتصوير بالفيديو', 'المشاركة في الدوري الداخلي'] },
    { id: 3, name: 'الاشتراك الذهبي / نخبة', price: 750, duration: 'شهرياً', desc: 'برنامج فردي متكامل', features: ['تدريب يومي متكامل', 'برنامج تغذية ولياقة خاص', 'تقارير PDF شهرية تفصيلية'] }
];

let players = [];
let matches = [];
let notifications = [];
let staffList = [];
let dismissedPlayers = [];
let activityLogs = [];
let payments = [];
let currentUser = null;
let chartInstance = null;

function showToast(message, type = 'error') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-5 left-5 z-50 flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const isSuccess = type === 'success';
    toast.className = `pointer-events-auto px-4 py-3 rounded-2xl text-xs font-bold text-white shadow-2xl transition-all duration-300 transform translate-y-2 opacity-0 flex items-center gap-2 ${
        isSuccess ? 'bg-blue-600 border border-blue-400/30' : 'bg-rose-600 border border-rose-400/30'
    }`;
    
    toast.innerHTML = `<i class="fa-solid ${isSuccess ? 'fa-circle-check text-blue-200' : 'fa-circle-exclamation text-rose-200'} text-sm"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

db.collection("academy_data").doc("main_data").onSnapshot((doc) => {
    if (doc.exists) {
        const data = doc.data();
        academyInfo = { name: "أكاديمية ق", logo: logoUrl };
        plans = data.plans || plans;
        players = data.players || [];
        matches = data.matches || [];
        notifications = data.notifications || [];
        staffList = data.staffList || [];
        dismissedPlayers = data.dismissedPlayers || [];
        activityLogs = data.activityLogs || [];
        payments = data.payments || [];
        
        applyAcademyBranding();
        renderPlans();
        renderAdminTables();
        renderSchedule();
        renderNotifications();
        renderStaffPermissionsUI();
        renderActivityLogs();
        renderTeammates();
        updateAuthUI();

        if (currentUser && currentUser.role === 'player') {
            const updatedMe = players.find(p => p.id === currentUser.data.id);
            if (updatedMe) {
                currentUser.data = updatedMe;
                loadPlayerDataIntoProfile();
            }
        }
    }
});

function saveData() {
    db.collection("academy_data").doc("main_data").set({
        academyInfo, plans, players, matches, notifications, staffList, dismissedPlayers, activityLogs, payments,
        updatedAt: Date.now()
    }).catch(err => console.error(err));
}

function addLog(actionText) {
    const actor = currentUser ? (currentUser.name || currentUser.username || 'مدير النظام') : 'زائر';
    const timeStr = new Date().toLocaleString('ar-SA');
    activityLogs.unshift({ id: Date.now(), text: actionText, actor, time: timeStr });
    if (activityLogs.length > 100) activityLogs.pop();
    saveData();
}

function applyAcademyBranding() {
    const nameEls = document.querySelectorAll('.academy-name-display');
    nameEls.forEach(el => el.innerText = "أكاديمية ق");

    const logoEls = document.querySelectorAll('.academy-logo-display');
    logoEls.forEach(el => {
        el.innerHTML = `<img src="${logoUrl}" alt="أكاديمية ق" class="w-full h-full object-cover">`;
    });
}

window.switchView = function(viewId) {
    ['home', 'login', 'register', 'player', 'schedule', 'pricing', 'admin', 'teammates'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(`view-${viewId}`);
    if (target) target.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.switchAdminTab = function(tabId) {
    document.querySelectorAll('.admin-sub-page').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-slate-800', 'text-slate-300');
    });
    document.getElementById(tabId).classList.remove('hidden');
    const activeBtn = document.getElementById(`tabbtn-${tabId.replace('sub-', '')}`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-slate-800', 'text-slate-300');
        activeBtn.classList.add('bg-blue-600', 'text-white');
    }
}

function hasPermission(permKey) {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'staff') {
        const staffMember = staffList.find(s => s.username === currentUser.username);
        return staffMember && staffMember.permissions && staffMember.permissions[permKey] === true;
    }
    return false;
}

window.renderSchedule = function() {
    const list = document.getElementById('schedule-cards-list');
    const adminBtnContainer = document.getElementById('admin-add-match-btn-container');
    if (!list) return;

    const canManageMatches = (currentUser && currentUser.role === 'admin') || hasPermission('manageMatches');

    if (canManageMatches) {
        if (adminBtnContainer) {
            adminBtnContainer.innerHTML = `<button onclick="document.getElementById('modal-add-match').classList.remove('hidden')" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition">+ إضافة مباراة أو تدريب</button>`;
        }
    } else {
        if (adminBtnContainer) adminBtnContainer.innerHTML = '';
    }

    if (matches.length === 0) {
        list.innerHTML = `<div class="col-span-2 text-center p-8 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">لا توجد مباريات أو تدريبات مسجلة حالياً.</div>`;
        return;
    }

    list.innerHTML = matches.map(m => `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex justify-between items-center">
            <div class="space-y-1">
                <span class="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold">${m.location}</span>
                <h4 class="font-bold text-white text-base"><span class="academy-name-display">أكاديمية ق</span> vs ${m.opponent}</h4>
                <p class="text-xs text-slate-400"><i class="fa-regular fa-clock ml-1"></i> ${m.date}</p>
            </div>
            <div class="flex items-center gap-3">
                <div class="text-left bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
                    <span class="font-black text-amber-400 text-sm">${m.score}</span>
                </div>
                ${canManageMatches ? `<button onclick="deleteMatch(${m.id})" class="text-rose-400 hover:text-rose-300 p-2 text-xs"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        </div>
    `).join('');
}

window.handleAddMatch = function(e) {
    e.preventDefault();
    const opponent = document.getElementById('match-opponent').value.trim();
    const datetime = document.getElementById('match-datetime').value;
    const location = document.getElementById('match-location').value.trim();
    matches.push({ id: Date.now(), opponent, date: datetime.replace('T', ' '), location, score: 'قادمة' });
    addLog(`أضاف مباراة أو تدريب جديد ضد: ${opponent}`);
    saveData();
    renderSchedule();
    closeModal('modal-add-match');
    showToast('تمت إضافة المباراة للجدول بنجاح!', 'success');
}

window.deleteMatch = function(id) {
    if (confirm('هل أنت متأكد من حذف هذه المباراة؟')) {
        matches = matches.filter(m => m.id !== id);
        addLog(`قام بحذف مباراة من الجدول`);
        saveData();
        renderSchedule();
        showToast('تم حذف المباراة.', 'success');
    }
}

function bootApp() {
    updateAuthUI();
    applyAcademyBranding();
    renderPlans();
    renderAdminTables();
    renderSchedule();
    renderNotifications();
    renderStaffPermissionsUI();
    renderActivityLogs();
    renderTeammates();
    initChart();
    window.switchView('home');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootApp);
} else {
    bootApp();
}

window.renderPlans = function() {
    const publicContainer = document.getElementById('public-pricing-plans-container');
    const regPlanSelect = document.getElementById('reg-plan');
    const adminPlansContainer = document.getElementById('admin-plans-manage-container');

    if (publicContainer) {
        publicContainer.innerHTML = plans.map(p => `
            <div class="bg-slate-900 border ${p.id === 2 ? 'border-2 border-blue-500 shadow-xl' : 'border-slate-800'} rounded-3xl p-6 flex flex-col justify-between relative">
                ${p.id === 2 ? '<span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white font-black text-xs px-3 py-1 rounded-full">الأكثر طلباً</span>' : ''}
                <div>
                    <h3 class="text-lg font-bold text-white">${p.name}</h3>
                    <p class="text-xs text-slate-400 mt-1">${p.desc}</p>
                    <div class="my-4 text-3xl font-black text-blue-400">${p.price} <span class="text-xs text-slate-400 font-normal">ر.س / ${p.duration}</span></div>
                    <ul class="text-xs text-slate-300 space-y-2 border-t border-slate-800 pt-4">
                        ${p.features.map(f => `<li><i class="fa-solid fa-check text-blue-400 ml-2"></i> ${f}</li>`).join('')}
                    </ul>
                </div>
                <button onclick="switchView('register')" class="mt-6 w-full py-2.5 ${p.id === 2 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'} font-bold rounded-xl transition text-xs">اشتراك الآن</button>
            </div>
        `).join('');
    }

    if (regPlanSelect) {
        regPlanSelect.innerHTML = plans.map(p => `<option value="${p.name}">${p.name} (${p.price} ر.س)</option>`).join('');
    }

    if (adminPlansContainer) {
        const canManagePlans = hasPermission('managePlans');
        adminPlansContainer.innerHTML = plans.map(p => `
            <div class="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="font-bold text-white text-sm">${p.name}</h4>
                        <span class="text-blue-400 font-black text-base">${p.price} ر.س</span>
                    </div>
                    <p class="text-xs text-slate-300 mt-2">${p.desc}</p>
                </div>
                ${canManagePlans ? `
                <div class="flex gap-2 mt-4 pt-3 border-t border-slate-900">
                    <button onclick="editPlan(${p.id})" class="flex-1 py-1 bg-slate-900 text-xs text-slate-200 rounded-lg">تعديل</button>
                    <button onclick="deletePlan(${p.id})" class="py-1 px-3 bg-rose-600/20 text-rose-400 text-xs rounded-lg">حذف</button>
                </div>` : ''}
            </div>
        `).join('');
    }
}

window.openAddPlanModal = function() {
    if (!hasPermission('managePlans')) { showToast('ليس لديك صلاحية تعديل الباقات!', 'error'); return; }
    document.getElementById('plan-edit-id').value = '';
    document.getElementById('modal-plan-title').innerText = 'إضافة باقة اشتراك جديدة';
    document.getElementById('plan-name').value = '';
    document.getElementById('plan-price').value = '';
    document.getElementById('plan-desc').value = '';
    document.getElementById('plan-features').value = '';
    document.getElementById('modal-add-plan').classList.remove('hidden');
}

window.editPlan = function(id) {
    if (!hasPermission('managePlans')) { showToast('ليس لديك صلاحية!', 'error'); return; }
    const p = plans.find(x => x.id === id);
    if (!p) return;
    document.getElementById('plan-edit-id').value = p.id;
    document.getElementById('modal-plan-title').innerText = 'تعديل باقة الاشتراك';
    document.getElementById('plan-name').value = p.name;
    document.getElementById('plan-price').value = p.price;
    document.getElementById('plan-duration').value = p.duration || 'شهرياً';
    document.getElementById('plan-desc').value = p.desc;
    document.getElementById('plan-features').value = p.features.join(', ');
    document.getElementById('modal-add-plan').classList.remove('hidden');
}

window.handleSavePlan = function(e) {
    e.preventDefault();
    if (!hasPermission('managePlans')) return;
    const editId = document.getElementById('plan-edit-id').value;
    const name = document.getElementById('plan-name').value.trim();
    const price = parseFloat(document.getElementById('plan-price').value);
    const duration = document.getElementById('plan-duration').value;
    const desc = document.getElementById('plan-desc').value.trim();
    const features = document.getElementById('plan-features').value.split(',').map(f => f.trim()).filter(Boolean);

    if (editId) {
        const p = plans.find(x => x.id === parseInt(editId));
        if (p) { p.name = name; p.price = price; p.duration = duration; p.desc = desc; p.features = features; }
        addLog(`قام بتعديل الباقة: ${name}`);
    } else {
        plans.push({ id: Date.now(), name, price, duration, desc, features });
        addLog(`قام بإضافة باقة جديدة: ${name}`);
    }
    saveData();
    renderPlans();
    closeModal('modal-add-plan');
    showToast('تم حفظ الباقة بنجاح!', 'success');
}

window.deletePlan = function(id) {
    if (!hasPermission('managePlans')) return;
    if (confirm('هل أنت متأكد من الحذف؟')) {
        plans = plans.filter(p => p.id !== id);
        addLog(`قام بحذف باقة اشتراك`);
        saveData();
        renderPlans();
        showToast('تم الحذف.', 'success');
    }
}

window.handleLogin = function(e) {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value.trim();

    if (u === 'admin' && p === 'admin123') {
        currentUser = { role: 'admin', name: 'المدير العام' };
        addLog(`سجل الدخول كـ (مدير عام)`);
        updateAuthUI();
        showToast('تم تسجيل الدخول كمدير بنجاح!', 'success');
        switchView('admin');
        return;
    }

    const foundStaff = staffList.find(s => s.username.toLowerCase() === u.toLowerCase() && s.password === p);
    if (foundStaff) {
        currentUser = { role: 'staff', username: foundStaff.username, name: foundStaff.name };
        addLog(`سجل الدخول المشرف: ${foundStaff.name}`);
        updateAuthUI();
        showToast(`أهلاً بك مشرف النظام ${foundStaff.name}!`, 'success');
        switchView('admin');
        return;
    }

    const foundPlayer = players.find(x => x.username.toLowerCase() === u.toLowerCase() && x.password === p);
    if (foundPlayer) {
        if (foundPlayer.status !== 'معتمد') {
            showToast('حسابك بانتظار موافقة الإدارة أو غير معتمد.', 'error');
            return;
        }
        if (foundPlayer.frozen) {
            showToast('حسابك مجمد حالياً.', 'error');
            return;
        }
        currentUser = { role: 'player', data: foundPlayer, name: foundPlayer.name };
        addLog(`سجل اللاعب دخولاً: ${foundPlayer.name}`);
        updateAuthUI();
        loadPlayerDataIntoProfile();
        showToast(`أهلاً بك كابتن ${foundPlayer.name}!`, 'success');
        switchView('player');
    } else {
        showToast('اسم المستخدم أو كلمة المرور غير صحيحة.', 'error');
    }
}

window.handleSendOTP = function(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const age = parseInt(document.getElementById('reg-age').value);
    const position = document.getElementById('reg-position').value;
    const plan = document.getElementById('reg-plan').value;
    const password = document.getElementById('reg-password').value;

    if (players.some(p => p.username.toLowerCase() === username.toLowerCase())) {
        showToast('اسم المستخدم مسجل مسبقاً.', 'error');
        return;
    }

    const newPlayer = {
        id: Date.now(),
        name, username, phone, position, plan, age, password,
        status: 'بانتظار الموافقة',
        frozen: false,
        points: 0,
        photoUrl: '',
        displayLocation: 'both',
        permission: 'لاعب عادي',
        warnings: []
    };

    players.push(newPlayer);
    addLog(`سجل حساب جديد بانتظار الموافقة: ${name}`);
    saveData();
    renderAdminTables();
    showToast('تم إرسال طلب انضمامك للإدارة بنجاح!', 'success');
    document.getElementById('register-form').reset();
    switchView('login');
}

window.handleLogout = function() {
    if (currentUser) addLog(`سجل خروج من النظام: ${currentUser.name || 'مستخدم'}`);
    currentUser = null;
    updateAuthUI();
    renderTeammates();
    showToast('تم تسجيل الخروج.', 'success');
    switchView('home');
}

function updateAuthUI() {
    const authSec = document.getElementById('auth-section');
    const adminNavBtn = document.getElementById('admin-nav-btn');

    if (currentUser) {
        if (currentUser.role === 'admin' || currentUser.role === 'staff') {
            if (adminNavBtn) adminNavBtn.classList.remove('hidden');
            const roleName = currentUser.role === 'admin' ? 'مدير الأكاديمية' : `مشرف: ${currentUser.name}`;
            authSec.innerHTML = `<span class="text-xs font-bold text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-xl border border-amber-400/20"><i class="fa-solid fa-user-shield ml-1"></i> ${roleName}</span><button onclick="handleLogout()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-bold rounded-xl transition">خروج</button>`;
        } else {
            if (adminNavBtn) adminNavBtn.classList.add('hidden');
            authSec.innerHTML = `<button onclick="switchView('player')" class="text-xs font-bold text-blue-400 bg-blue-400/10 px-3 py-1.5 rounded-xl border border-blue-400/20"><i class="fa-solid fa-user ml-1"></i> ${currentUser.data.name}</button><button onclick="handleLogout()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-bold rounded-xl transition">خروج</button>`;
        }
    } else {
        if (adminNavBtn) adminNavBtn.classList.add('hidden');
        authSec.innerHTML = `<button onclick="switchView('login')" class="text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 transition">دخول</button><button onclick="switchView('register')" class="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition shadow-md">تسجيل جديد</button>`;
    }
    renderTeammates();
}

window.renderAdminTables = function() {
    const pendingTbody = document.getElementById('admin-pending-tbody');
    const pendingList = players.filter(p => p.status === 'بانتظار الموافقة');
    const canApprove = hasPermission('approvePlayers');

    if (pendingTbody) {
        pendingTbody.innerHTML = pendingList.length === 0 ? `<tr><td colspan="6" class="p-6 text-center text-slate-500">لا توجد طلبات جديدة</td></tr>` : pendingList.map(p => `
            <tr class="hover:bg-slate-800/50 border-b border-slate-800">
                <td class="p-3 font-bold text-white">${p.name}</td>
                <td class="p-3 text-slate-400">${p.username}</td>
                <td class="p-3 font-mono">${p.phone}</td>
                <td class="p-3">${p.position} (${p.age} سنة)</td>
                <td class="p-3"><span class="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded font-bold">${p.plan}</span></td>
                <td class="p-3 flex gap-2">
                    ${canApprove ? `
                        <button onclick="approveMember(${p.id})" class="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg text-xs">قبول</button>
                        <button onclick="rejectMember(${p.id})" class="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold">رفض</button>
                    ` : '<span class="text-xs text-slate-500">غير مسموح</span>'}
                </td>
            </tr>
        `).join('');
    }

    const approvedTbody = document.getElementById('admin-players-tbody');
    const approvedList = players.filter(p => p.status === 'معتمد');

    const canPoints = hasPermission('managePoints');
    const canFreeze = hasPermission('freezePlayer');
    const canDismiss = hasPermission('dismissPlayer');
    const canRename = hasPermission('renamePlayer');
    const canWarn = hasPermission('warnPlayer');
    const canPhoto = hasPermission('managePlayerPhoto');

    if (approvedTbody) {
        approvedTbody.innerHTML = approvedList.length === 0 ? `<tr><td colspan="6" class="p-6 text-center text-slate-500">لا يوجد لاعبين معتمدين حالياً</td></tr>` : approvedList.map(p => `
            <tr class="hover:bg-slate-800/50 border-b border-slate-800">
                <td class="p-3 font-bold text-white flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 font-black overflow-hidden flex items-center justify-center border border-blue-500/30 text-xs">
                        ${p.photoUrl ? `<img src="${p.photoUrl}" class="w-full h-full object-cover">` : (p.name ? p.name.charAt(0) : 'ل')}
                    </div>
                    <div>
                        ${p.name} 
                        ${canRename ? `<button onclick="promptRename(${p.id})" class="text-blue-400 hover:text-blue-300 ml-2 text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded">تعديل الاسم</button>` : ''}
                        ${canPhoto ? `<button onclick="promptPlayerPhoto(${p.id})" class="text-sky-400 hover:text-sky-300 ml-1 text-[10px] bg-sky-500/10 px-1.5 py-0.5 rounded">صورة</button>` : ''}
                        <span class="block text-[10px] text-slate-400 font-mono">@${p.username} ${p.warnings && p.warnings.length > 0 ? `| <span class="text-rose-400 font-bold">تحذيرات: ${p.warnings.length}</span>` : ''}</span>
                    </div>
                </td>
                <td class="p-3">
                    <div class="flex items-center gap-1">
                        <span class="text-xs text-slate-200">${p.position}</span>
                        ${canRename ? `<button onclick="promptChangePosition(${p.id})" class="text-amber-400 hover:text-amber-300 text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded"><i class="fa-solid fa-pen"></i></button>` : ''}
                    </div>
                </td>
                <td class="p-3">
                    <select onchange="changePlayerDisplayLocation(${p.id}, this.value)" class="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-blue-400 font-bold">
                        <option value="both" ${(!p.displayLocation || p.displayLocation === 'both') ? 'selected' : ''}>كلا المكانين</option>
                        <option value="home" ${p.displayLocation === 'home' ? 'selected' : ''}>الرئيسية فقط</option>
                        <option value="teammates" ${p.displayLocation === 'teammates' ? 'selected' : ''}>قائمة اللاعبين فقط</option>
                    </select>
                </td>
                <td class="p-3 font-bold text-amber-400">${p.points} نقطة</td>
                <td class="p-3">
                    <span class="px-2 py-1 rounded text-xs ${p.frozen ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}">${p.frozen ? 'مجمد' : 'نشط'}</span>
                </td>
                <td class="p-3 space-x-1 space-x-reverse flex flex-wrap gap-1">
                    ${canFreeze ? `<button onclick="toggleFreezePlayer(${p.id})" class="px-2 py-1 bg-slate-800 text-xs rounded">${p.frozen ? 'إلغاء' : 'تجميد'}</button>` : ''}
                    ${canDismiss ? `<button onclick="dismissPlayer(${p.id})" class="px-2 py-1 bg-rose-600/20 text-rose-400 text-xs rounded">فصل</button>` : ''}
                    ${canWarn ? `<button onclick="promptWarnPlayer(${p.id})" class="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded">تحذير</button>` : ''}
                </td>
            </tr>
        `).join('');
    }
}

window.promptChangePosition = function(id) {
    if (!hasPermission('renamePlayer')) { showToast('ليس لديك صلاحية تغيير مسمى اللاعب!', 'error'); return; }
    const p = players.find(x => x.id === id);
    if (!p) return;
    const newPos = prompt(`أدخل المسمى الوظيفي أو المركز الجديد لللاعب ${p.name}:`, p.position || 'مهاجم');
    if (newPos && newPos.trim() !== '') {
        const oldPos = p.position;
        p.position = newPos.trim();
        addLog(`غيّر مسمى اللاعب (${p.name}) من (${oldPos}) إلى (${p.position})`);
        saveData();
        renderAdminTables();
        renderTeammates();
        showToast('تم تحديث المسمى الوظيفي بنجاح!', 'success');
    }
}

window.promptChangeStaffTitle = function(id) {
    if (currentUser && currentUser.role !== 'admin') { showToast('خاص بالمدير العام فقط!', 'error'); return; }
    const s = staffList.find(x => x.id === id);
    if (!s) return;
    const newTitle = prompt(`أدخل المسمى الوظيفي الجديد للمشرف ${s.name}:`, s.title || 'مشرف نظام');
    if (newTitle && newTitle.trim() !== '') {
        const oldTitle = s.title;
        s.title = newTitle.trim();
        addLog(`غيّر مسمى المشرف (${s.name}) من (${oldTitle || 'مشرف نظام'}) إلى (${s.title})`);
        saveData();
        renderStaffPermissionsUI();
        renderTeammates();
        showToast('تم تحديث المسمى الوظيفي للمشرف بنجاح!', 'success');
    }
}

window.changePlayerDisplayLocation = function(id, locationVal) {
    if (currentUser && currentUser.role !== 'admin') { showToast('خاص بالمدير العام فقط!', 'error'); return; }
    const p = players.find(x => x.id === id);
    if (p) {
        p.displayLocation = locationVal;
        addLog(`حدد مكان ظهور اللاعب (${p.name}) في: ${locationVal}`);
        saveData();
        renderTeammates();
        showToast('تم تحديث إعدادات عرض اللاعب بنجاح!', 'success');
    }
}

window.changeStaffDisplayLocation = function(id, locationVal) {
    if (currentUser && currentUser.role !== 'admin') { showToast('خاص بالمدير العام فقط!', 'error'); return; }
    const s = staffList.find(x => x.id === id);
    if (s) {
        s.displayLocation = locationVal;
        addLog(`حدد مكان ظهور المشرف (${s.name}) في: ${locationVal}`);
        saveData();
        renderStaffPermissionsUI();
        renderTeammates();
        showToast('تم تحديث مكان ظهور المشرف بنجاح!', 'success');
    }
}

window.promptPlayerPhoto = function(id) {
    if (!hasPermission('managePlayerPhoto')) { showToast('ليس لديك صلاحية إضافة/تعديل صور اللاعبين!', 'error'); return; }
    const p = players.find(x => x.id === id);
    if (!p) return;
    const url = prompt(`أدخل رابط الصورة الجديدة لللاعب ${p.name}:`, p.photoUrl || '');
    if (url !== null) {
        p.photoUrl = url.trim();
        addLog(`قام بتعديل صورة اللاعب: ${p.name}`);
        saveData();
        renderAdminTables();
        renderTeammates();
        showToast('تم تحديث صورة اللاعب بنجاح!', 'success');
    }
}

window.customChangePoints = function(playerId, mode) {
    if (!hasPermission('managePoints')) { showToast('ليس لديك صلاحية تعديل النقاط!', 'error'); return; }
    const p = players.find(x => x.id === playerId);
    if (!p) return;

    const labelMsg = mode === 'add' ? `أدخل عدد النقاط المراد إضافتها للاعب ${p.name}:` : `أدخل عدد النقاط المراد خصمها من اللاعب ${p.name}:`;
    const inputVal = prompt(labelMsg, "10");
    if (inputVal === null) return;

    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) {
        showToast('الرجاء إدخال رقم صحيح أكبر من الصفر.', 'error');
        return;
    }

    if (mode === 'add') {
        p.points += amount;
        addLog(`أضاف ${amount} نقطة للاعب: ${p.name}`);
    } else {
        p.points = Math.max(0, p.points - amount);
        addLog(`خصم ${amount} نقطة من اللاعب: ${p.name}`);
    }

    saveData();
    renderAdminTables();
    renderTeammates();
    showToast('تم تحديث النقاط بنجاح!', 'success');
}

window.promptRename = function(id) {
    if (!hasPermission('renamePlayer')) { showToast('ليس لديك صلاحية تغيير أسماء اللاعبين!', 'error'); return; }
    const p = players.find(x => x.id === id);
    if (!p) return;
    const oldName = p.name;
    const newName = prompt(`أدخل الاسم الجديد لللاعب ${oldName}:`, oldName);
    if (newName && newName.trim() !== '') {
        p.name = newName.trim();
        addLog(`غيّر اسم اللاعب من (${oldName}) إلى (${p.name})`);
        saveData();
        renderAdminTables();
        renderTeammates();
        showToast('تم تغيير اسم اللاعب بنجاح!', 'success');
    }
}

window.promptWarnPlayer = function(id) {
    if (!hasPermission('warnPlayer')) { showToast('ليس لديك صلاحية إعطاء تحذيرات!', 'error'); return; }
    const p = players.find(x => x.id === id);
    if (!p) return;
    const reason = prompt(`أدخل سبب التحذير الموجه لللاعب ${p.name}:`);
    if (reason && reason.trim() !== '') {
        if (!p.warnings) p.warnings = [];
        const issuerName = currentUser ? (currentUser.name || currentUser.username || 'الإدارة') : 'الإدارة العامة';
        p.warnings.push({ 
            date: new Date().toLocaleDateString('ar-SA'), 
            reason: reason.trim(),
            issuer: issuerName 
        });
        addLog(`أعطى تحذيراً للاعب ${p.name} (بواسطة ${issuerName}) بسبب: ${reason.trim()}`);
        saveData();
        renderAdminTables();
        showToast('تم إرسال التحذير وتسجيله بنجاح!', 'success');
    }
}

window.approveMember = function(id) {
    if (!hasPermission('approvePlayers')) { showToast('ليس لديك صلاحية قبول اللاعبين!', 'error'); return; }
    const p = players.find(x => x.id === id);
    if (p) {
        p.status = 'معتمد';
        addLog(`وافق على انضمام اللاعب: ${p.name}`);
        saveData();
        renderAdminTables();
        renderTeammates();
        showToast(`تم قبول اللاعب ${p.name} بنجاح!`, 'success');
    }
}

window.rejectMember = function(id) {
    if (!hasPermission('approvePlayers')) { showToast('ليس لديك صلاحية!', 'error'); return; }
    const p = players.find(x => x.id === id);
    const pName = p ? p.name : 'مجهول';
    players = players.filter(x => x.id !== id);
    addLog(`رفض طلب انضمام اللاعب: ${pName}`);
    saveData();
    renderAdminTables();
    showToast('تم رفض الطلب وحذفه.', 'success');
}

window.toggleFreezePlayer = function(playerId) {
    if (!hasPermission('freezePlayer')) { showToast('ليس لديك صلاحية تجميد الاشتراكات!', 'error'); return; }
    const p = players.find(x => x.id === playerId);
    if (p) {
        p.frozen = !p.frozen;
        addLog(`${p.frozen ? 'جمّد اشتراك' : 'أعاد تفعيل اشتراك'} اللاعب: ${p.name}`);
        saveData();
        renderAdminTables();
        showToast(p.frozen ? 'تم تجميد اشتراك اللاعب' : 'تم إعادة تفعيل الحساب', 'success');
    }
}

window.dismissPlayer = function(playerId) {
    if (!hasPermission('dismissPlayer')) { showToast('ليس لديك صلاحية فصل اللاعبين!', 'error'); return; }
    const p = players.find(x => x.id === playerId);
    if (confirm(`هل أنت متأكد من فصل اللاعب ${p ? p.name : ''} نهائياً؟`)) {
        players = players.filter(x => x.id !== playerId);
        if (p) addLog(`فصل اللاعب نهائياً من الأكاديمية: ${p.name}`);
        saveData();
        renderAdminTables();
        renderTeammates();
        showToast('تم فصل اللاعب.', 'success');
    }
}

function renderTeammates() {
    const teammatesContainer = document.getElementById('teammates-list-container');
    const homeContainer = document.getElementById('home-teammates-container');

    const approvedList = players.filter(p => p.status === 'معتمد');

    const homePlayers = approvedList.filter(p => !p.displayLocation || p.displayLocation === 'both' || p.displayLocation === 'home');
    const listPlayers = approvedList.filter(p => !p.displayLocation || p.displayLocation === 'both' || p.displayLocation === 'teammates');

    const homeStaff = staffList.filter(s => !s.displayLocation || s.displayLocation === 'both' || s.displayLocation === 'home');
    const listStaff = staffList.filter(s => !s.displayLocation || s.displayLocation === 'both' || s.displayLocation === 'teammates');

    function generateCards(playerArray, staffArray) {
        let html = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">`;
        
        // بطاقة المدير العام
        html += `<div class="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black text-lg overflow-hidden shadow">
                م
            </div>
            <div>
                <span class="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded font-bold">الإدارة العليا</span>
                <h4 class="font-bold text-white text-sm academy-name-display">المدير العام</h4>
                <span class="text-[10px] text-blue-400 block font-semibold">قيادة & قدوة</span>
            </div>
        </div>`;

        // بطاقات المشرفين
        staffArray.forEach(s => {
            const firstLetter = s.name ? s.name.charAt(0) : 'م';
            html += `<div class="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-lg">
                    ${firstLetter}
                </div>
                <div>
                    <span class="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-bold">${s.title || 'مشرف نظام'}</span>
                    <h4 class="font-bold text-white text-sm">${s.name}</h4>
                </div>
            </div>`;
        });

        // بطاقات اللاعبين
        if (playerArray.length > 0) {
            playerArray.forEach(p => {
                const firstLetter = p.name ? p.name.charAt(0) : 'ل';
                html += `<div class="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border border-slate-700 text-blue-400 font-bold text-sm">
                        ${p.photoUrl ? `<img src="${p.photoUrl}" class="w-full h-full object-cover">` : firstLetter}
                    </div>
                    <div>
                        <span class="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-bold">لاعب معتمد</span>
                        <h4 class="font-bold text-white text-sm">${p.name}</h4>
                        <p class="text-[11px] text-slate-400">${p.position} | نقاط: ${p.points}</p>
                    </div>
                </div>`;
            });
        }

        html += `</div>`;
        return html;
    }

    if (teammatesContainer) teammatesContainer.innerHTML = generateCards(listPlayers, listStaff);
    if (homeContainer) homeContainer.innerHTML = generateCards(homePlayers, homeStaff);
}

window.handleSendBroadcast = function(e) {
    e.preventDefault();
    const title = document.getElementById('broadcast-title').value.trim();
    const body = document.getElementById('broadcast-msg').value.trim();
    const publisherName = currentUser ? (currentUser.name || currentUser.username || 'الإدارة') : 'الإدارة العامة';

    const newNotif = {
        id: Date.now(),
        title,
        body,
        publisher: publisherName,
        date: new Date().toLocaleString('ar-SA')
    };

    notifications.unshift(newNotif);
    addLog(`نشر تعميم جديد بعنوان: (${title})`);
    saveData();
    renderNotifications();
    document.getElementById('broadcast-title').value = '';
    document.getElementById('broadcast-msg').value = '';
    showToast('تم نشر التعميم بنجاح!', 'success');
}

window.deleteBroadcast = function(notifId) {
    const notif = notifications.find(n => n.id === notifId);
    if (confirm('هل أنت متأكد من حذف هذا التعميم؟')) {
        notifications = notifications.filter(n => n.id !== notifId);
        addLog(`حذف التعميم: ${notif ? notif.title : ''}`);
        saveData();
        renderNotifications();
        showToast('تم حذف التعميم.', 'success');
    }
}

window.renderNotifications = function() {
    const list = document.getElementById('player-notifications-list');
    if (!list) return;

    const canManageBroadcast = (currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff'));

    if (notifications.length === 0) {
        list.innerHTML = `<p class="text-xs text-slate-500 text-center py-4">لا توجد إشعارات أو تعاميم حالياً.</p>`;
        return;
    }

    list.innerHTML = notifications.map(n => `
        <div class="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-bold text-white text-sm flex items-center gap-2">
                        <i class="fa-solid fa-bullhorn text-blue-400"></i> ${n.title || 'إشعار'}
                    </h4>
                    <span class="text-[10px] text-slate-400">نُشر بواسطة: <strong class="text-blue-400">${n.publisher || 'الإدارة'}</strong> | ${n.date || ''}</span>
                </div>
                ${canManageBroadcast ? `<button onclick="deleteBroadcast(${n.id})" class="text-rose-400 hover:text-rose-300 text-xs px-2 py-1 bg-rose-600/10 rounded-lg">حذف</button>` : ''}
            </div>
            <p class="text-xs text-slate-300 whitespace-pre-line">${n.body || n}</p>
        </div>
    `).join('');
}

function renderActivityLogs() {
    const container = document.getElementById('admin-logs-container');
    if (!container) return;

    if (currentUser && currentUser.role !== 'admin') {
        container.innerHTML = `<div class="p-4 text-center text-xs text-amber-400">سجلات النظام (Logs) مخصصة للمدير العام فقط.</div>`;
        return;
    }

    if (activityLogs.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-500 text-center py-4">لا توجد سجلات مسجلة حتى الآن.</p>`;
        return;
    }

    container.innerHTML = activityLogs.map(l => `
        <div class="p-3 bg-slate-950 border border-slate-800/60 rounded-xl text-xs flex justify-between items-center">
            <div class="space-y-1">
                <span class="font-bold text-blue-400">${l.actor}</span>
                <span class="text-slate-200 block">${l.text}</span>
            </div>
            <span class="text-[10px] font-mono text-slate-400">${l.time}</span>
        </div>
    `).join('');
}

window.handleCreateStaff = function(e) {
    e.preventDefault();
    if (currentUser && currentUser.role !== 'admin') {
        showToast('عذراً، المدير فقط هو من يمكنه إنشاء مشرفين!', 'error');
        return;
    }
    const name = document.getElementById('staff-add-name').value.trim();
    const username = document.getElementById('staff-add-username').value.trim();
    const password = document.getElementById('staff-add-password').value.trim();
    const title = document.getElementById('staff-add-title').value.trim();
    const displayLocation = document.getElementById('staff-add-location').value;

    if (staffList.some(s => s.username.toLowerCase() === username.toLowerCase())) {
        showToast('اسم المستخدم هذا مستخدم بالفعل.', 'error');
        return;
    }

    const newStaff = {
        id: Date.now(),
        name, username, password, title,
        displayLocation,
        permissions: {
            approvePlayers: document.getElementById('perm-approve').checked,
            manageMatches: document.getElementById('perm-matches').checked,
            managePlans: document.getElementById('perm-plans').checked,
            managePoints: document.getElementById('perm-points').checked,
            dismissPlayer: document.getElementById('perm-dismiss').checked,
            freezePlayer: document.getElementById('perm-freeze').checked,
            renamePlayer: document.getElementById('perm-rename').checked,
            warnPlayer: document.getElementById('perm-warn').checked,
            managePlayerPhoto: document.getElementById('perm-photo').checked
        }
    };

    staffList.push(newStaff);
    addLog(`أنشأ حساب مشرف جديد: ${name} بمسمى (${title})`);
    saveData();
    renderStaffPermissionsUI();
    renderTeammates();
    document.getElementById('staff-form').reset();
    showToast('تم إنشاء حساب المشرف وصلاحياته بنجاح!', 'success');
}

window.deleteStaff = function(id) {
    if (currentUser && currentUser.role !== 'admin') return;
    if (confirm('هل أنت متأكد من حذف حساب هذا المشرف؟')) {
        staffList = staffList.filter(s => s.id !== id);
        addLog(`حذف حساب مشرف من النظام`);
        saveData();
        renderStaffPermissionsUI();
        renderTeammates();
        showToast('تم حذف حساب المشرف.', 'success');
    }
}

function renderStaffPermissionsUI() {
    const container = document.getElementById('admin-staff-permissions-container');
    if (!container) return;

    if (currentUser && currentUser.role !== 'admin') {
        container.innerHTML = `<div class="p-4 bg-slate-950 rounded-xl text-xs text-amber-400 text-center">الإدارة حصرياً للمدير العام.</div>`;
        return;
    }

    if (staffList.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-500 text-center py-4">لا توجد حسابات مشرفين مسجلة.</p>`;
        return;
    }

    container.innerHTML = staffList.map(s => `
        <div class="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
            <div class="flex flex-wrap justify-between items-center border-b border-slate-800 pb-2 gap-2">
                <div class="flex items-center gap-3 flex-wrap">
                    <h4 class="font-bold text-white text-sm">${s.name} <span class="text-xs text-slate-400 font-mono">(@${s.username})</span></h4>
                    <span class="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-bold">${s.title || 'مشرف نظام'}</span>
                    <button onclick="promptChangeStaffTitle(${s.id})" class="text-amber-400 hover:text-amber-300 text-[10px] bg-amber-500/10 px-2 py-0.5 rounded"><i class="fa-solid fa-pen ml-1"></i>تعديل المسمى</button>
                    <select onchange="changeStaffDisplayLocation(${s.id}, this.value)" class="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-blue-400 font-bold">
                        <option value="both" ${(!s.displayLocation || s.displayLocation === 'both') ? 'selected' : ''}>كلا المكانين</option>
                        <option value="home" ${s.displayLocation === 'home' ? 'selected' : ''}>الرئيسية فقط</option>
                        <option value="teammates" ${s.displayLocation === 'teammates' ? 'selected' : ''}>قائمة اللاعبين فقط</option>
                    </select>
                </div>
                <button onclick="deleteStaff(${s.id})" class="px-2.5 py-1 bg-rose-600/20 text-rose-400 text-xs rounded-lg font-bold">حذف</button>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-300">
                <span class="${s.permissions.approvePlayers ? 'text-blue-400 font-bold' : 'text-slate-500'}">✓ قبول/رفض</span>
                <span class="${s.permissions.manageMatches ? 'text-blue-400 font-bold' : 'text-slate-500'}">✓ المباريات</span>
                <span class="${s.permissions.managePlans ? 'text-blue-400 font-bold' : 'text-slate-500'}">✓ الباقات</span>
                <span class="${s.permissions.managePoints ? 'text-blue-400 font-bold' : 'text-slate-500'}">✓ النقاط</span>
                <span class="${s.permissions.dismissPlayer ? 'text-blue-400 font-bold' : 'text-slate-500'}">✓ الفصل</span>
                <span class="${s.permissions.freezePlayer ? 'text-blue-400 font-bold' : 'text-slate-500'}">✓ التجميد</span>
                <span class="${s.permissions.renamePlayer ? 'text-blue-400 font-bold' : 'text-slate-500'}">✓ تغيير الاسم</span>
                <span class="${s.permissions.warnPlayer ? 'text-blue-400 font-bold' : 'text-slate-500'}">✓ التحذيرات</span>
                <span class="${s.permissions.managePlayerPhoto ? 'text-blue-400 font-bold' : 'text-slate-500'}">✓ صور اللاعبين</span>
            </div>
        </div>
    `).join('');
}

function loadPlayerDataIntoProfile() {
    if (currentUser && currentUser.role === 'player') {
        const p = currentUser.data;
        document.getElementById('profile-name').innerText = p.name;
        document.getElementById('profile-position').innerText = p.position;
        document.getElementById('profile-points').innerText = p.points;
        document.getElementById('profile-permission').innerText = p.permission || 'لاعب عادي';
        
        const warnList = document.getElementById('profile-warnings-list');
        if (warnList) {
            if (p.warnings && p.warnings.length > 0) {
                warnList.innerHTML = p.warnings.map(w => `
                    <div class="p-3 bg-slate-950 border border-rose-500/20 rounded-xl space-y-1">
                        <div class="flex justify-between items-center">
                            <span class="text-xs font-bold text-rose-400"><i class="fa-solid fa-exclamation-circle ml-1"></i> ${w.reason}</span>
                            <span class="text-[10px] text-slate-400">${w.date}</span>
                        </div>
                        <span class="block text-[10px] text-slate-500">تم الإصدار بواسطة: <strong class="text-slate-300">${w.issuer || 'الإدارة'}</strong></span>
                    </div>
                `).join('');
            } else {
                warnList.innerHTML = `<p class="text-xs text-slate-500 text-center py-2">لا توجد أي تحذيرات مسجلة بحقك.</p>`;
            }
        }
        
        updatePlayerChart(p.points);
    }
}

function initChart() {
    const ctx = document.getElementById('playerPerformanceChart');
    if (!ctx) return;
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['التسجيل', 'الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الحالي'],
            datasets: [{ label: 'تطور النقاط والأداء', data: [0, 0, 0, 0, 0], borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.4, fill: true }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#cbd5e1', font: { family: 'Cairo' } } } }, scales: { x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }, y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } } } }
    });
}

function updatePlayerChart(points) {
    if (!chartInstance) return;
    chartInstance.data.datasets[0].data = [0, Math.round(points*0.3), Math.round(points*0.6), Math.round(points*0.85), points];
    chartInstance.update();
}
