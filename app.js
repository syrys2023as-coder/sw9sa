// ==========================================
// 1. تثبيت جلسة الدخول في المتصفح (LOCAL)
// لمنع تسجيل الخروج عند تحديث الصفحة (F5)
// ==========================================
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    console.log("تم تثبيت الجلسة بنجاح ولن يتم الخروج عند التحديث.");
  })
  .catch((error) => {
    console.error("خطأ في تثبيت الجلسة:", error);
  });

// متغيرات عامة
let currentUser = null;
let userRole = 'student'; // 'admin' أو 'student'

// ==========================================
// 2. مراقب حالة تسجيل الدخول (Auth State Observer)
// ==========================================
firebase.auth().onAuthStateChanged(async (user) => {
  const loadingOverlay = document.getElementById('loading-overlay');
  
  if (user) {
    currentUser = user;
    console.log("المستخدم متصل:", user.uid);

    try {
      // جلب بيانات الصلاحيات من قاعدة البيانات (Firestore)
      const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        userRole = userData.role || 'student';
        updateUIForAuthenticatedUser(userData);
      } else {
        // إنشاء ملف افتراضي إذا لم يكن موجوداً
        const defaultData = {
          email: user.email,
          role: 'student',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await firebase.firestore().collection('users').doc(user.uid).set(defaultData);
        updateUIForAuthenticatedUser(defaultData);
      }
      showMainApp();
    } catch (error) {
      console.error("خطأ في جلب بيانات المستخدم:", error);
      showToast("تعذر جلب بيانات الحساب", "error");
    }
  } else {
    currentUser = null;
    userRole = 'student';
    console.log("لا يوجد مستخدم مسجل دخول.");
    showLoginScreen();
  }

  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
});

// ==========================================
// 3. دالة التنقل بين الصفحات (إصلاح خطأ switchView)
// ==========================================
function switchView(viewId) {
    console.log("الانتقال إلى القسم:", viewId);
    
    // إخفاء جميع الأقسام العامة إن وجدت
    const sections = document.querySelectorAll('.app-section');
    sections.forEach(section => {
        section.style.display = 'none';
    });

    // إظهار القسم المطلوب فقط
    const targetSection = document.getElementById(viewId);
    if (targetSection) {
        targetSection.style.display = 'block';
    } else {
        console.warn("القسم غير موجود في الصفحة:", viewId);
    }
}

// ==========================================
// 4. دوال تسجيل الدخول والخروج
// ==========================================
async function loginUser(email, password) {
  try {
    showLoading(true);
    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
    showToast("تم تسجيل الدخول بنجاح!", "success");
    return userCredential.user;
  } catch (error) {
    showLoading(false);
    console.error("خطأ تسجيل الدخول:", error);
    let errorMsg = "فشل تسجيل الدخول. تحقق من البيانات.";
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      errorMsg = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    }
    showToast(errorMsg, "error");
  }
}

async function logoutUser() {
  try {
    await firebase.auth().signOut();
    showToast("تم تسجيل الخروج بنجاح.", "info");
    showLoginScreen();
  } catch (error) {
    console.error("خطأ تسجيل الخروج:", error);
    showToast("حدث خطأ أثناء تسجيل الخروج.", "error");
  }
}

// ==========================================
// 5. التحكم في الواجهات والصلاحيات
// ==========================================
function showMainApp() {
  const loginSection = document.getElementById('login-section');
  const mainAppSection = document.getElementById('main-app-section');
  
  if (loginSection) loginSection.style.display = 'none';
  if (mainAppSection) mainAppSection.style.display = 'block';
}

function showLoginScreen() {
  const loginSection = document.getElementById('login-section');
  const mainAppSection = document.getElementById('main-app-section');
  
  if (loginSection) loginSection.style.display = 'block';
  if (mainAppSection) mainAppSection.style.display = 'none';
}

function updateUIForAuthenticatedUser(userData) {
  const userNameElements = document.querySelectorAll('.user-name-display');
  const userRoleElements = document.querySelectorAll('.user-role-display');

  userNameElements.forEach(el => el.textContent = userData.name || userData.email || "مستخدم الأكاديمية");
  userRoleElements.forEach(el => el.textContent = userData.role === 'admin' ? 'مدير النظام' : 'طالب / عضو');

  // إخفاء أو إظهار قسم الزملاء بناءً على الصلاحيات (Admin فقط)
  const adminElements = document.querySelectorAll('.admin-only');
  adminElements.forEach(el => {
    el.style.display = (userData.role === 'admin') ? 'block' : 'none';
  });
}

// ==========================================
// 6. التنبيهات المخصصة (Toast Alerts) أسفل اليسار
// ==========================================
function showToast(message, type = "info") {
  let toastContainer = document.getElementById('toast-container');
  
  // إن لم يكن الحاوية موجودة، يتم إنشاؤها تلقائياً وتثبيتها أسفل اليسار
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed bottom-5 left-5 z-50 flex flex-col gap-2';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  // ألوان مخصصة: أحمر للأخطاء، أخضر للنجاح، أزرق للمعلومات
  let bgColor = type === 'error' ? 'bg-red-600' : (type === 'success' ? 'bg-green-600' : 'bg-blue-600');
  
  toast.className = `px-4 py-3 text-white rounded-lg shadow-lg text-sm font-medium transition-all duration-300 transform translate-y-0 ${bgColor}`;
  toast.innerText = message;
  
  toastContainer.appendChild(toast);
  
  // إزالة التنبيه تلقائياً بعد 3.5 ثانية
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function showLoading(enable) {
  const spinner = document.getElementById('loading-spinner');
  if (spinner) {
    spinner.style.display = enable ? 'flex' : 'none';
  }
}
