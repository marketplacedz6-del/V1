/* =========================================================
   SouqiExpress — نظام الاشتراك الشهري للتجار
   يعمل 100% بدون خادم (HTML ثابت + Firestore)

   الحقول المستعملة داخل مستند users/{uid}:
     is_approved        : boolean  — هل فُعّل الحساب أصلاً
     subscription_start : ISO string — تاريخ بداية آخر اشتراك
     subscription_end   : ISO string — تاريخ نهاية الاشتراك
     subscription_months: number   — عدد الأشهر المدفوعة آخر مرة
     activated_by       : uid المسوق الذي فعّل/جدّد
     activated_by_name  : اسم المسوق (للعرض فقط)

   ملاحظة مهمة: التحقق هنا واجهي (client-side) لأن المنصة ثابتة
   بلا خادم. الحماية الحقيقية يجب أن تُكتب في قواعد Firestore.
   ========================================================= */
(function () {
  "use strict";

  const SUB = {};

  /* مدة الاشتراك الافتراضية بالأيام (شهر واحد) */
  SUB.MONTH_DAYS = 30;

  /* عدد الأيام التي يُعتبر فيها الاشتراك "قارب على الانتهاء" */
  SUB.WARN_DAYS = 5;

  /* ---------- أدوات التاريخ ---------- */
  SUB.parseDate = function (v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    // Firestore Timestamp
    if (typeof v === "object" && typeof v.toDate === "function") {
      try { const d = v.toDate(); return isNaN(d) ? null : d; } catch (e) { return null; }
    }
    if (typeof v === "object" && typeof v.seconds === "number") {
      return new Date(v.seconds * 1000);
    }
    const d = new Date(v);
    return isNaN(d) ? null : d;
  };

  /* يضيف عدد أشهر إلى تاريخ (شهر = 30 يوماً لتجنّب اختلاف أطوال الأشهر) */
  SUB.addMonths = function (date, months) {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + SUB.MONTH_DAYS * (Number(months) || 1));
    return d;
  };

  SUB.daysBetween = function (a, b) {
    return Math.ceil((b.getTime() - a.getTime()) / 86400000);
  };

  SUB.formatDate = function (v) {
    const d = SUB.parseDate(v);
    if (!d) return "—";
    try {
      return d.toLocaleDateString("ar-DZ", { year: "numeric", month: "long", day: "numeric" });
    } catch (e) {
      return d.toISOString().slice(0, 10).split("-").reverse().join("/");
    }
  };

  /* ---------- الحالة ---------- */
  /**
   * status(userData) -> {
   *   state: "none" | "active" | "expiring" | "expired",
   *   active: boolean, end: Date|null, start: Date|null,
   *   daysLeft: number, label: string, tone: "green"|"amber"|"red"|"gray"
   * }
   *
   * "none"  = الحساب مفعّل لكن بلا تاريخ اشتراك (حسابات قديمة).
   *           نعتبره نشطاً حتى لا نقفل على تاجر قديم بغير ذنب،
   *           لكن نعرض له تنبيهاً بضرورة ضبط اشتراكه.
   */
  SUB.status = function (data) {
    data = data || {};
    const start = SUB.parseDate(data.subscription_start);
    const end = SUB.parseDate(data.subscription_end);
    const now = new Date();

    if (!end) {
      return {
        state: "none", active: true, start, end: null, daysLeft: Infinity,
        label: "اشتراك غير محدد المدة", tone: "gray"
      };
    }

    const daysLeft = SUB.daysBetween(now, end);

    if (end.getTime() <= now.getTime()) {
      return {
        state: "expired", active: false, start, end, daysLeft: daysLeft,
        label: "انتهى الاشتراك", tone: "red"
      };
    }
    if (daysLeft <= SUB.WARN_DAYS) {
      return {
        state: "expiring", active: true, start, end, daysLeft,
        label: daysLeft <= 1 ? "ينتهي اليوم" : "يتبقّى " + daysLeft + " أيام",
        tone: "amber"
      };
    }
    return {
      state: "active", active: true, start, end, daysLeft,
      label: "اشتراك نشط · " + daysLeft + " يوماً متبقّياً", tone: "green"
    };
  };

  /* هل يُسمح للتاجر بدخول لوحته؟ */
  SUB.allowed = function (data) {
    if (!data) return false;
    if (data.role === "admin") return true;
    if (data.is_approved !== true) return false;
    return SUB.status(data).active;
  };

  /* حساب تواريخ اشتراك جديد أو تمديد اشتراك قائم */
  SUB.buildRenewal = function (data, months) {
    months = Number(months) || 1;
    const now = new Date();
    const currentEnd = SUB.parseDate(data && data.subscription_end);
    // إن كان الاشتراك ما زال ساري المفعول نُضيف فوقه، وإلا نبدأ من اليوم
    const base = (currentEnd && currentEnd.getTime() > now.getTime()) ? currentEnd : now;
    const end = SUB.addMonths(base, months);
    return {
      subscription_start: (SUB.parseDate(data && data.subscription_start) && currentEnd && currentEnd > now)
        ? new Date(SUB.parseDate(data.subscription_start)).toISOString()
        : now.toISOString(),
      subscription_end: end.toISOString(),
      subscription_months: months
    };
  };

  /* ---------- شارة الحالة (HTML) ---------- */
  SUB.badge = function (data) {
    const st = SUB.status(data);
    const colors = {
      green: "background:rgba(16,185,129,.14);color:#047857",
      amber: "background:rgba(245,158,11,.16);color:#b45309",
      red: "background:rgba(244,63,94,.14);color:#be123c",
      gray: "background:rgba(100,116,139,.14);color:#475569"
    };
    const icon = { green: "✓", amber: "⏳", red: "⛔", gray: "•" }[st.tone];
    return '<span style="' + colors[st.tone] + ';padding:.2rem .6rem;border-radius:999px;font-size:10px;font-weight:900;white-space:nowrap">'
      + icon + " " + st.label + "</span>";
  };

  /* ---------- التوجيه عند انتهاء الاشتراك ---------- */
  /**
   * يخزّن سبب الخروج ثم يوجّه إلى صفحة المسوقين لاختيار من يجدّد له.
   */
  SUB.redirectExpired = function (userData) {
    try {
      const st = SUB.status(userData || {});
      sessionStorage.setItem("se_sub_notice", JSON.stringify({
        reason: (userData && userData.is_approved !== true) ? "pending" : "expired",
        name: (userData && userData.name) || "",
        email: (userData && userData.email) || "",
        end: st.end ? st.end.toISOString() : null,
        activated_by: (userData && userData.activated_by) || "",
        activated_by_name: (userData && userData.activated_by_name) || ""
      }));
    } catch (e) {}
    location.replace("resellers_list.html?reason=" +
      ((userData && userData.is_approved !== true) ? "pending" : "expired"));
  };

  /* ---------- لافتة تحذير داخل لوحة التاجر ---------- */
  SUB.mountBanner = function (data) {
    const st = SUB.status(data);
    document.getElementById("se-sub-banner")?.remove();
    if (st.state === "active") return; // كل شيء سليم، لا نزعج التاجر

    const bar = document.createElement("div");
    bar.id = "se-sub-banner";
    bar.setAttribute("dir", "rtl");
    const bg = st.tone === "red"
      ? "linear-gradient(90deg,#be123c,#f43f5e)"
      : st.tone === "amber"
        ? "linear-gradient(90deg,#b45309,#f59e0b)"
        : "linear-gradient(90deg,#475569,#64748b)";

    let msg;
    if (st.state === "expired") {
      msg = "⛔ <b>انتهى اشتراكك</b> بتاريخ " + SUB.formatDate(st.end) + " — جدّده لمواصلة استعمال لوحتك.";
    } else if (st.state === "expiring") {
      msg = "⏳ <b>اشتراكك على وشك الانتهاء</b> (" + st.label + ") — ينتهي في " + SUB.formatDate(st.end) + ".";
    } else {
      msg = "• لم يُضبط تاريخ اشتراكك بعد. تواصل مع مسوّقك لتسجيل اشتراكك الشهري.";
    }

    bar.style.cssText = "background:" + bg
      + ";color:#fff;padding:.6rem 1rem;font-size:12px;font-weight:800;display:flex;"
      + "align-items:center;justify-content:center;gap:.75rem;flex-wrap:wrap;text-align:center;"
      + "border-radius:1rem;margin:0 0 1rem;width:100%;box-sizing:border-box;flex:0 0 auto";
    bar.innerHTML = '<span style="min-width:0">' + msg + '</span>'
      + '<a href="resellers_list.html?reason=renew" style="background:#fff;color:#0f172a;padding:.35rem .9rem;'
      + 'border-radius:999px;font-weight:900;font-size:11px;white-space:nowrap;text-decoration:none;flex:0 0 auto">🔄 جدّد الاشتراك</a>';

    /* أين نضع اللافتة؟
       لوحات التاجر تستعمل body{display:flex;overflow:hidden} — وضع اللافتة
       مباشرة في <body> يجعلها عنصر flex رأسياً ضيقاً بجانب القائمة الجانبية،
       كما أن position:sticky لا يعمل داخل overflow:hidden.
       لذلك نضعها داخل <main> القابل للتمرير، أو أعلى المحتوى في الصفحات العادية. */
    const main = document.querySelector("main");
    if (main) {
      main.insertBefore(bar, main.firstChild);
      return;
    }
    // صفحات عادية (بلا <main>): شريط علوي لاصق
    bar.style.position = "sticky";
    bar.style.top = "0";
    bar.style.zIndex = "70";
    bar.style.borderRadius = "0";
    bar.style.margin = "0";
    document.body.insertBefore(bar, document.body.firstChild);
  };

  window.SE_SUB = SUB;
})();
