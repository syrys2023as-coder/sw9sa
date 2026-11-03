// ==========================================
// 1. تهيئة Firebase وتثبيت الجلسة (Persistence)
// ==========================================
// التأكد من حفظ جلسة المستخدم في ذاكرة المتصفح المحلية (LOCAL)
// لمنع تسجيل الخروج عند تحديث الصفحة (Refresh / F5)
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    console.log("تم تثبيت جلسة الدخول بنجاح.");
  })
  .catch((error) => {
    console.error("خطأ في تثبيت الجلسة:", error);
  });

// متغيرات عامة للتطبيق
let currentUser = null;
let userRole = 'student'; // 'admin' أو 'student'

// ==========================================
// 2. مراقب حالة تسجيل الدخول (Auth State Observer)
// ==========================================
// يعمل هذا المراقب فور فتح الموقع أو تحديث الصفحة للتحقق من حالة المستخدم
firebase.auth().onAuthStateChanged(async (user) => {
  const loadingOverlay = document.getElementById('loading-overlay'); // إن وجد عنصر التحميل
  
  if (user) {
    // حالة: المستخدم مسجل دخوله مسبقاً
    currentUser = user;
    console.log("المستخدم متصل حالياً:", user.uid);

    try {
      // جلب بيانات المستخدم وصلاحياته من قاعدة البيانات (Firestore)
      const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        userRole = userData.role || 'student';
        
        // تحديث واجهة المستخدم بالبيانات الشاملة
        updateUIForAuthenticatedUser(userData);
      } else {
        console.warn("بيانات المستخدم غير موجودة في قاعدة البيانات، جاري إنشاؤها...");
        // إنشاء ملف للمستخدم الجديد ببيانات افتراضية
        const defaultData = {
          email: user.email,
          role: 'student',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await firebase.firestore().collection('users').doc(user.uid).set(defaultData);
        updateUIForAuthenticatedUser(defaultData);
      }

      // إظهار الواجهة الرئيسية وإخفاء صفحة تسجيل الدخول
      showMainApp();

    } catch (error) {
      console.error("حدث خطأ أثناء جلب بيانات المستخدم:", error);
      showToast("تعذر جلب بيانات الحساب، حاول التحديث مجدداً", "error");
    }

  } else {
    // حالة: لا يوجد مستخدم مسجل دخول (أو قام بالخروج)
    currentUser = null;
    userRole = 'student';
    console.log("لا يوجد حساب متصل.");
    
    // إظهار شاشة تسجيل الدخول وإخفاء لوحة التحكم الرئيسية
    showLoginScreen();
  }

  // إخفاء مؤشر التحميل إن وجد
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
});

// ==========================================
// 3. دوال تسجيل الدخول والخروج
// ==========================================

// دالة تسجيل الدخول
async function loginUser(email, password) {
  try {
    showLoading(true);
    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
    showToast("تم تسجيل الدخول بنجاح!", "success");
    return userCredential.user;
  } catch (error) {
    showLoading(false);
    console.error("خطأ تسجيل الدخول:", error);
    let errorMsg = "فشل تسجيل الدخول. تحقق من البيانات وحاول مجدداً.";
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      errorMsg = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    } else if (error.code === 'auth/invalid-email') {
      errorMsg = "صيغة البريد الإلكتروني غير صحيحة.";
    }
    showToast(errorMsg, "error");
  }
}

// دالة تسجيل الخروج اليدوي
async function logoutUser() {
  try {
    await firebase.auth().signOut();
    showToast("تم تسجيل الخروج بنجاح.", "info");
    showLoginScreen();
  } catch (error) {
    console.error("خطأ أثناء تسجيل الخروج:", error);
    showToast("حدث خطأ أثناء تسجيل الخروج.", "error");
  }
}

// ==========================================
// 4. التحكم في عرض الواجهات (UI Switching)
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
  // تحديث أسماء العناصر في الواجهة مثل اسم المستخدم والصورة والتنبيهات
  const userNameElements = document.querySelectorAll('.user-name-display');
  const userRoleElements = document.querySelectorAll('.user-role-display');

  userNameElements.forEach(el => el.textContent = userData.name || userData.email || "مستخدم الأكاديمية");
  userRoleElements.forEach(el => el.textContent = userData.role === 'admin' ? 'مدير النظام' : 'طالب / عضو');

  // إظهار أو إخفاء عناصر التحكم بناءً على الصلاحيات (Admin vs Student)
  const adminElements = document.querySelectorAll('.admin-only');
  adminElements.forEach(el => {
    el.style.display = (userData.role === 'admin') ? 'block' : 'none';
  });
}

// ==========================================
// 5. دوال مساعدة وتنبهات (Helpers & Toasts)
// ==========================================

function showToast(message, type = "info") {
  console.log(`[${type.toUpperCase()}] ${message}`);
  // إذا كان لديك مكتبة للتنبيهات مثل Toastify أو SweetAlert2 يمكنك تفعيلها هنا:
  const toastContainer = document.getElementById('toast-container');
  if (toastContainer) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}

function showLoading(enable) {
  const spinner = document.getElementById('loading-spinner');
  if (spinner) {
    spinner.style.display = enable ? 'flex' : 'none';
  }
}
