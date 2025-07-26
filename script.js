// script.js

// استيراد الكائنات المهيأة من ملف firebase-config.js (db لقاعدة البيانات، auth للمصادقة)
import { db, auth } from './firebase-config.js';
// استيراد الدوال اللازمة من Firebase Authentication و Firestore
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { collection, getDocs, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// --- الحصول على عناصر واجهة المستخدم (DOM Elements) ---
const authSection = document.getElementById('auth-section'); // قسم تسجيل الدخول
const appSection = document.getElementById('app');         // التطبيق الرئيسي
const loginForm = document.getElementById('login-form');   // نموذج تسجيل الدخول
const authError = document.getElementById('auth-error');   // رسالة خطأ تسجيل الدخول
const sidebarLinks = document.querySelectorAll('#sidebar nav ul li a'); // روابط الشريط الجانبي
const logoutBtn = document.getElementById('logout-btn');     // زر تسجيل الخروج
const currentUserSpan = document.getElementById('current-user-name'); // اسم المستخدم الحالي

// عناصر لوحة التحكم لعرض البيانات الحقيقية من Firebase
const dailySalesEl = document.getElementById('daily-sales');
const totalDebtsEl = document.getElementById('total-debts');
const lowStockProductsEl = document.getElementById('low-stock-products');

// --- وظائف عامة لواجهة المستخدم ---

/**
 * وظيفة لعرض قسم معين وإخفاء جميع الأقسام الأخرى.
 * @param {string} sectionId - الـ ID الخاص بالقسم المراد عرضه.
 */
function showSection(sectionId) {
    // إخفاء جميع الأقسام أولاً
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    // ثم إظهار القسم المطلوب
    document.getElementById(sectionId).classList.add('active');

    // تحديث تفعيل (active class) رابط القسم في الشريط الجانبي
    sidebarLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === sectionId) {
            link.classList.add('active');
        }
    });

    // إذا كان القسم هو لوحة التحكم، قم بتحديث البيانات من Firebase
    if (sectionId === 'dashboard') {
        fetchDashboardData();
    }
}

// --- التعامل مع المصادقة (Authentication) ---

// مراقبة حالة المصادقة (تسجيل الدخول/الخروج)
// هذه الدالة تعمل تلقائياً عند تحميل الصفحة وتستمع لتغيرات حالة المستخدم
onAuthStateChanged(auth, (user) => {
    if (user) {
        // المستخدم مسجل الدخول
        authSection.style.display = 'none'; // إخفاء قسم تسجيل الدخول
        appSection.style.display = 'flex'; // إظهار التطبيق الرئيسي (هيكل الشريط الجانبي والمحتوى)
        currentUserSpan.textContent = user.email; // عرض بريد المستخدم (يمكن لاحقاً عرض الاسم الحقيقي للمستخدم)
        showSection('dashboard'); // عرض لوحة التحكم كصفحة افتراضية بعد تسجيل الدخول
        console.log("User is logged in:", user.email);
    } else {
        // المستخدم غير مسجل الدخول
        authSection.style.display = 'block'; // إظهار قسم تسجيل الدخول
        appSection.style.display = 'none'; // إخفاء التطبيق الرئيسي
        // التأكد من أن جميع الأقسام الأخرى مخفية
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        authSection.classList.add('active'); // إظهار قسم المصادقة فقط
        console.log("User is logged out.");
    }
});

// التعامل مع تقديم نموذج تسجيل الدخول
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // منع إعادة تحميل الصفحة الافتراضية للنموذج
    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        authError.textContent = ''; // مسح أي رسائل خطأ سابقة عند النجاح
        console.log("Login successful!");
        // onAuthStateChanged سيتكفل بإظهار لوحة التحكم
    } catch (error) {
        let errorMessage = "حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "صيغة البريد الإلكتروني غير صحيحة.";
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = "تم حظر الوصول مؤقتًا بسبب كثرة المحاولات الفاشلة. حاول لاحقًا.";
        }
        authError.textContent = errorMessage; // عرض رسالة الخطأ للمستخدم
        console.error("Login error:", error.message);
    }
});

// التعامل مع زر تسجيل الخروج
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        console.log("User signed out successfully.");
        // onAuthStateChanged سيتكفل بإظهار قسم تسجيل الدخول
    } catch (error) {
        console.error("Logout error:", error.message);
    }
});

// --- التعامل مع روابط الشريط الجانبي ---
sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault(); // منع إعادة تحميل الصفحة
        // تأكد من أن المستخدم مسجل الدخول قبل السماح بالتنقل
        if (auth.currentUser) {
            const sectionId = e.target.dataset.section; // الحصول على ID القسم من خاصية data-section
            if (sectionId) {
                showSection(sectionId);
            }
        } else {
            alert("يرجى تسجيل الدخول أولاً للوصول إلى هذه الميزة.");
        }
    });
});


// --- جلب وتحديث بيانات لوحة التحكم من Firebase Firestore ---

/**
 * وظيفة لجلب بيانات لوحة التحكم (المبيعات اليومية، الديون، المنتجات المعرضة للنفاذ) من Firestore.
 */
async function fetchDashboardData() {
    console.log("Fetching dashboard data...");

    // 1. حساب إجمالي مبيعات اليوم
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // ضبط الوقت إلى بداية اليوم (منتصف الليل)
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1); // بداية اليوم التالي

        const salesRef = collection(db, 'sales'); // الإشارة إلى مجموعة 'sales' في Firestore
        // إنشاء استعلام لجلب المبيعات التي حدثت في اليوم الحالي
        const q = query(
            salesRef,
            where('timestamp', '>=', Timestamp.fromDate(today)), // المبيعات من بداية اليوم
            where('timestamp', '<', Timestamp.fromDate(tomorrow)) // إلى ما قبل بداية اليوم التالي
        );
        const salesSnapshot = await getDocs(q); // تنفيذ الاستعلام
        let totalDailySales = 0;
        salesSnapshot.forEach(doc => {
            const sale = doc.data();
            totalDailySales += (sale.totalAmount || 0); // جمع إجمالي المبالغ المدفوعة لكل عملية بيع
        });
        dailySalesEl.textContent = `${totalDailySales.toLocaleString()} ج.م`; // عرض القيمة المحدثة
    } catch (error) {
        console.error("Error fetching daily sales:", error);
        dailySalesEl.textContent = "خطأ!"; // عرض رسالة خطأ في حال الفشل
    }

    // 2. حساب إجمالي ديون العملاء
    try {
        const customersRef = collection(db, 'customers'); // الإشارة إلى مجموعة 'customers'
        const customerSnapshot = await getDocs(customersRef); // جلب جميع العملاء
        let totalCustomerDebts = 0;
        customerSnapshot.forEach(doc => {
            const customer = doc.data();
            // جمع قيمة حقل 'outstandingBalance' لكل عميل (أو 0 إذا لم يكن موجوداً)
            totalCustomerDebts += (customer.outstandingBalance || 0);
        });
        totalDebtsEl.textContent = `${totalCustomerDebts.toLocaleString()} ج.م`; // عرض القيمة المحدثة
    } catch (error) {
        console.error("Error fetching total customer debts:", error);
        totalDebtsEl.textContent = "خطأ!";
    }

    // 3. حساب عدد المنتجات على وشك النفاذ
    try {
        const productsRef = collection(db, 'products'); // الإشارة إلى مجموعة 'products'
        const LOW_STOCK_THRESHOLD = 10; // تحديد حد معين للمنتجات المعرضة للنفاذ
        // إنشاء استعلام لجلب المنتجات التي كميتها المتاحة أقل من أو تساوي الحد
        const q = query(
            productsRef,
            where('availableQuantity', '<=', LOW_STOCK_THRESHOLD)
        );
        const lowStockSnapshot = await getDocs(q); // تنفيذ الاستعلام
        const lowStockCount = lowStockSnapshot.size; // عدد المستندات التي تطابق الشرط
        lowStockProductsEl.textContent = `${lowStockCount} منتجات`; // عرض العدد المحدث
    } catch (error) {
        console.error("Error fetching low stock products:", error);
        lowStockProductsEl.textContent = "خطأ!";
    }
}
