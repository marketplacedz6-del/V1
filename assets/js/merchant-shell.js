/* =========================================================
   SouqiExpress — قشرة مركز التاجر الموحّدة
   شريط جانبي واحد + حماية موحّدة + بحث سريع (Ctrl+K) + إشعارات
   تُستعمل في كل صفحات لوحة التاجر بدل تكرار الكود
   ========================================================= */
(function () {
  "use strict";

  const SHELL = {};

  SHELL.NAV = [
    { key: "dashboard", href: "merchant-dashboard.html", icon: "📊", label: "لوحة القيادة" },
    { key: "products",  href: "products.html",           icon: "📦", label: "إدارة المنتجات" },
    { key: "orders",    href: "orders.html",             icon: "🛒", label: "الطلبات الواردة", badge: "navPendingBadge" },
    { key: "customers", href: "customers.html",          icon: "👥", label: "الزبائن" },
    { key: "shipping",  href: "shipping.html",           icon: "🚚", label: "إدارة الشحن" },
    { key: "landing",   href: "landing-preview.html",    icon: "🚀", label: "صفحة الهبوط" },
    { key: "settings",  href: "settings.html",           icon: "⚙️", label: "الإعدادات" }
  ];

  /* ---------- رسم الشريط الجانبي ---------- */
  SHELL.renderSidebar = function (active) {
    const nav = SHELL.NAV.map(i => {
      const on = i.key === active;
      const cls = on
        ? "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black bg-gradient-to-l from-blue-50 to-indigo-50/50 text-blue-600 border-r-4 border-blue-600"
        : "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold se-muted hover:text-blue-600 hover:bg-slate-500/5 transition";
      const badge = i.badge
        ? `<span id="${i.badge}" class="mr-auto bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full hidden">0</span>`
        : "";
      return `<a href="${i.href}" class="${cls}"><span>${i.icon}</span> ${i.label} ${badge}</a>`;
    }).join("");

    return `
    <div id="sidebarOverlay" onclick="SHELL.toggleSidebar()" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 hidden md:hidden"></div>
    <aside id="sidebar" class="fixed inset-y-0 right-0 w-[85vw] max-w-xs md:w-72 se-surface border-l shadow-xl flex flex-col z-50 transform translate-x-full transition-transform duration-300 md:translate-x-0 md:static md:h-full">
      <div class="p-5 border-b flex items-center gap-3" style="border-color:var(--se-border)">
        <div class="w-11 h-11 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl flex justify-center items-center shadow-lg rotate-3 flex-shrink-0">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
        </div>
        <div class="min-w-0">
          <h1 class="text-base font-black leading-none">مركز التاجر</h1>
          <p id="sidebarStoreName" class="text-xs text-blue-600 font-extrabold mt-1 truncate">جاري التحميل...</p>
        </div>
      </div>

      <button onclick="SHELL.openPalette()" class="mx-3 mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl se-surface border text-[11px] font-bold se-muted hover:border-blue-400 transition" style="border-color:var(--se-border)">
        <span>🔍</span><span>بحث سريع</span>
        <kbd class="mr-auto text-[9px] bg-slate-500/10 px-1.5 py-0.5 rounded">Ctrl K</kbd>
      </button>

      <nav class="flex-grow p-3 space-y-1 overflow-y-auto">
        ${nav}
        <hr class="my-2" style="border-color:var(--se-border)">
        <a id="myStoreLink" href="#" target="_blank" rel="noopener" class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold se-muted hover:text-emerald-600 transition"><span>🏪</span> عرض متجري</a>
      </nav>

      <div class="p-3 border-t flex items-center justify-between gap-2" style="border-color:var(--se-border)">
        <div class="flex items-center gap-2 min-w-0">
          <span id="db-status-dot" class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0"></span>
          <span id="db-status-text" class="text-[11px] font-bold se-muted truncate">فحص الاتصال...</span>
        </div>
        <button data-se-theme-toggle class="se-btn se-btn-ghost !px-2.5 !py-1.5" title="الوضع الليلي"><i data-se-theme-icon class="fa-solid fa-moon"></i></button>
        <button onclick="SHELL.logout()" class="text-[11px] font-black text-red-500 flex-shrink-0">🚪</button>
      </div>
    </aside>`;
  };

  SHELL.renderTopbar = function (title) {
    return `
    <header class="se-surface border-b p-3 flex items-center justify-between md:hidden z-30 gap-2">
      <span id="mobileStoreName" class="font-black text-sm truncate">${title || "مركز التاجر"}</span>
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <button onclick="SHELL.openPalette()" class="se-btn se-btn-ghost !px-2.5 !py-2" aria-label="بحث">🔍</button>
        <button data-se-theme-toggle class="se-btn se-btn-ghost !px-2.5 !py-2"><i data-se-theme-icon class="fa-solid fa-moon"></i></button>
        <button onclick="SHELL.toggleSidebar()" class="se-btn se-btn-ghost !px-2.5 !py-2" aria-label="القائمة">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
      </div>
    </header>`;
  };

  /* ---------- تركيب القشرة ---------- */
  SHELL.mount = function (active, title) {
    const host = document.getElementById("shell");
    if (host) host.insertAdjacentHTML("beforebegin", SHELL.renderSidebar(active));
    const top = document.getElementById("shell-topbar");
    if (top) top.innerHTML = SHELL.renderTopbar(title);
    SHELL.mountPalette();
    // لو نودي setStatus/setStoreName قبل رسم الشريط، طبّقها الآن
    if (SHELL._status) SHELL.setStatus(SHELL._status.ok, SHELL._status.txt);
    if (SHELL._store) SHELL.setStoreName(SHELL._store.name, SHELL._store.uid);
  };

  SHELL.toggleSidebar = function () {
    const s = document.getElementById("sidebar");
    const o = document.getElementById("sidebarOverlay");
    if (s) s.classList.toggle("translate-x-full");
    if (o) o.classList.toggle("hidden");
  };

  SHELL._status = null;
  SHELL.setStatus = function (ok, txt) {
    SHELL._status = { ok, txt };           // احفظ آخر حالة
    // نجاح جلب البيانات = الإنترنت يعمل قطعاً -> أخفِ أي تحذير كاذب
    if (ok && window.SE && SE.markOnline) SE.markOnline();
    const d = document.getElementById("db-status-dot");
    const t = document.getElementById("db-status-text");
    if (d) d.className = "w-2.5 h-2.5 rounded-full flex-shrink-0 " + (ok ? "bg-emerald-500" : "bg-red-500 animate-pulse");
    if (t) t.textContent = txt;
  };

  SHELL._store = null;
  SHELL.setStoreName = function (name, uid) {
    SHELL._store = { name, uid };
    ["sidebarStoreName", "mobileStoreName"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = name;
    });
    const link = document.getElementById("myStoreLink");
    if (link && uid) link.href = "store.html?merchantId=" + encodeURIComponent(uid);
  };

  SHELL.setPending = function (n) {
    const b = document.getElementById("navPendingBadge");
    if (!b) return;
    b.textContent = n;
    b.classList.toggle("hidden", !n);
  };

  /* ---------- الحماية الموحّدة ---------- */
  /**
   * guard({ auth, db, getDoc, doc, signOut }) -> Promise<merchant|null>
   * يوحّد فحص الدخول والصلاحية والتفعيل في مكان واحد.
   */
  SHELL.guard = function (api) {
    return new Promise((resolve) => {
      api.onAuthStateChanged(api.auth, async (user) => {
        if (!user) { location.replace("login.html"); return resolve(null); }
        try {
          const snap = await api.getDoc(api.doc(api.db, "users", user.uid));
          if (!snap.exists()) { await api.signOut(api.auth); location.replace("login.html"); return resolve(null); }
          const d = snap.data() || {};
          if (d.role !== "merchant" && d.role !== "admin") {
            alert("لا تملك صلاحية دخول هذه اللوحة.");
            location.replace(d.role === "admin" ? "admin-dashboard.html" : "index.html");
            return resolve(null);
          }
          if (d.role === "merchant" && d.is_approved !== true) {
            // الحساب غير مفعّل → وجّهه لاختيار مسوّق يفعّل له
            if (window.SE_SUB) { window.SE_SUB.redirectExpired(d); return resolve(null); }
            alert("حسابك قيد المراجعة من الإدارة.");
            await api.signOut(api.auth); location.replace("login.html"); return resolve(null);
          }
          // فحص الاشتراك الشهري (الأدمن معفى)
          if (d.role === "merchant" && window.SE_SUB && !window.SE_SUB.status(d).active) {
            window.SE_SUB.redirectExpired(d);
            return resolve(null);
          }
          const merchant = { id: user.uid, ...d };
          // لافتة تنبيه إن كان الاشتراك على وشك الانتهاء أو غير مضبوط
          if (d.role === "merchant" && window.SE_SUB) {
            try { window.SE_SUB.mountBanner(d); } catch (e) {}
          }
          SHELL.setStoreName(d.name || "متجر غير مسمى", user.uid);
          SHELL._signOut = () => api.signOut(api.auth);
          resolve(merchant);
        } catch (e) {
          console.error(e);
          SHELL.setStatus(false, "خطأ في الاتصال ❌");
          resolve(null);
        }
      });
    });
  };

  SHELL.logout = async function () {
    try { if (SHELL._signOut) await SHELL._signOut(); } catch (e) {}
    location.replace("login.html");
  };

  /* ---------- لوحة الأوامر (Ctrl+K) ---------- */
  SHELL.mountPalette = function () {
    if (document.getElementById("sePalette")) return;
    const el = document.createElement("div");
    el.id = "sePalette";
    el.className = "fixed inset-0 z-[80] hidden items-start justify-center pt-24 px-4 bg-slate-900/50 backdrop-blur-sm";
    el.innerHTML = `
      <div class="se-card w-full max-w-lg overflow-hidden" onclick="event.stopPropagation()">
        <input id="sePaletteInput" placeholder="اكتب للبحث: منتج، طلب، أو صفحة..." class="w-full px-4 py-3.5 text-sm font-bold bg-transparent border-b outline-none" style="border-color:var(--se-border);color:var(--se-text)">
        <div id="sePaletteList" class="max-h-80 overflow-y-auto p-2"></div>
      </div>`;
    el.onclick = SHELL.closePalette;
    document.body.appendChild(el);

    const input = el.querySelector("#sePaletteInput");
    input.addEventListener("input", () => SHELL.renderPalette(input.value));
    input.addEventListener("keydown", e => {
      if (e.key === "Escape") SHELL.closePalette();
      if (e.key === "Enter") {
        const first = document.querySelector("#sePaletteList [data-go]");
        if (first) location.href = first.getAttribute("data-go");
      }
    });
    document.addEventListener("keydown", e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); SHELL.openPalette(); }
    });
  };

  SHELL.openPalette = function () {
    const el = document.getElementById("sePalette");
    if (!el) return;
    el.classList.remove("hidden"); el.classList.add("flex");
    const i = document.getElementById("sePaletteInput");
    i.value = ""; SHELL.renderPalette(""); setTimeout(() => i.focus(), 30);
  };
  SHELL.closePalette = function () {
    const el = document.getElementById("sePalette");
    if (el) { el.classList.add("hidden"); el.classList.remove("flex"); }
  };

  // مصادر البحث: الصفحات + ما تسجّله الصفحة الحالية (منتجات/طلبات)
  SHELL.searchSources = [];
  SHELL.registerSearch = function (fn) { SHELL.searchSources.push(fn); };

  SHELL.renderPalette = function (q) {
    q = (q || "").toLowerCase().trim();
    const esc = window.SE ? SE.escape : (x => String(x == null ? "" : x));
    let items = SHELL.NAV
      .filter(i => !q || i.label.toLowerCase().includes(q))
      .map(i => ({ icon: i.icon, title: i.label, sub: "صفحة", go: i.href }));

    SHELL.searchSources.forEach(fn => {
      try { items = items.concat(fn(q) || []); } catch (e) {}
    });

    const list = document.getElementById("sePaletteList");
    list.innerHTML = items.length
      ? items.slice(0, 12).map(i => `
        <a data-go="${esc(i.go)}" href="${esc(i.go)}" class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-500/10 transition">
          <span class="text-base">${i.icon || "•"}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-xs font-black truncate">${esc(i.title)}</span>
            <span class="block text-[10px] se-muted font-bold truncate">${esc(i.sub || "")}</span>
          </span>
        </a>`).join("")
      : '<p class="text-[11px] se-muted font-bold text-center py-6">لا توجد نتائج</p>';
  };

  window.SHELL = SHELL;
  // توافق مع الاستدعاءات القديمة
  window.toggleSidebar = () => SHELL.toggleSidebar();
  window.logout = () => SHELL.logout();
})();
