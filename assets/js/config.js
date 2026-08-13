/* =========================================================
   SouqiExpress - الإعدادات العامة للمنصة (نسخة HTML ثابتة)
   يعمل مباشرة على الاستضافة المجانية (GitHub Pages / Netlify)
   ========================================================= */

window.SE_CONFIG = {
  siteName: "SouqiExpress",
  siteNameAr: "سوقي إكسبريس",
  currency: "د.ج",
  logo: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgyBMAK2bLeu1XK4sbC16cwWBDDMXUm2ECySR-zUjoO8jAfIMA1vTbqLM4aeGzNPti_DKhuQdDR4Yi9VYvv_tORcrMDHSuAq9lczXIln_7XJ2N-zi1GgN00ZPDT6K8TaBBIa8_JhLpgslBdmgjALDSBffk65-dRfcYb2x0qIWikiA1xhkEJnbLr5SwnVAyB/s512/ccac0bc7-0b03-481e-8c8a-e136a9ca8df7.jpg",
  /* الاشتراك الشهري للتاجر */
  subscription: {
    price: 90000,          // د.ج
    period: "شهر",
    periodDays: 30
  },
  social: {
    facebook: "https://web.facebook.com/profile.php?id=61591647221843",
    instagram: "https://www.instagram.com/souqiexpress/",
    tiktok: "https://vm.tiktok.com/ZS9M34AXNoePJ-g3JZ7/"
  },
  firebase: {
    apiKey: "AIzaSyAIfkBI0WhxZr1hCyiuYcbVYAy3wXAJxCU",
    authDomain: "walid-shop.firebaseapp.com",
    projectId: "walid-shop",
    storageBucket: "walid-shop.firebasestorage.app",
    messagingSenderId: "3705207162",
    appId: "1:3705207162:web:7b3a80ba4acea3e29c3ec3",
    measurementId: "G-YX3PT078PG"
  }
};

/* الولايات الجزائرية الـ 58 لاستعمالها في الشحن والطلبات */
window.SE_WILAYAS = [
  "أدرار","الشلف","الأغواط","أم البواقي","باتنة","بجاية","بسكرة","بشار","البليدة","البويرة",
  "تمنراست","تبسة","تلمسان","تيارت","تيزي وزو","الجزائر","الجلفة","جيجل","سطيف","سعيدة",
  "سكيكدة","سيدي بلعباس","عنابة","قالمة","قسنطينة","المدية","مستغانم","المسيلة","معسكر","ورقلة",
  "وهران","البيض","إليزي","برج بوعريريج","بومرداس","الطارف","تندوف","تيسمسيلت","الوادي","خنشلة",
  "سوق أهراس","تيبازة","ميلة","عين الدفلى","النعامة","عين تموشنت","غرداية","غليزان","تيميمون","برج باجي مختار",
  "أولاد جلال","بني عباس","عين صالح","عين قزام","تقرت","جانت","المغير","المنيعة"
];
