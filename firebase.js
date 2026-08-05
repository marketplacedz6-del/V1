import { getApps, initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAIfkBI0WhxZr1hCyiuYcbVYAy3wXAJxCU",
  authDomain: "walid-shop.firebaseapp.com",
  projectId: "walid-shop",
  storageBucket: "walid-shop.firebasestorage.app",
  messagingSenderId: "3705207162",
  appId: "1:3705207162:web:7b3a80ba4acea3e29c3ec3" // تطبيق Walid-Shop الصحيح
};

// فحص ذكي: إذا كان الفايربيز يعمل مسبقاً استخدمه، وإلا قم بتهيئته فوراً
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// تفعيل حماية الـ App Check تلقائياً في الخلفية لموقعك
try {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6Lf6j1gtAAAAAKKjxuXNT43jIZOVqf_W4wG4iwYZ'),
    isTokenAutoRefreshEnabled: true
  });
  console.log("🔒 تم تفعيل مفتاح العبور والحماية بنجاح");
} catch (error) {
  console.warn("⚠️ جاري المراقبة الآمنة:", error);
}

// تجهيز قاعدة البيانات وجعلها عالمية
const db = getFirestore(app);
window.db = db;
