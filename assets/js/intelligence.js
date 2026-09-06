/* =========================================================
   SouqiExpress — محرّك الذكاء التحليلي (SE_AI)

   ⚠️ توضيح صريح: هذا ليس ذكاءً اصطناعياً توليدياً (ChatGPT).
   منصتنا HTML ثابت بلا خادم، ووضع مفتاح OpenAI في الصفحة يعني
   تسريبه لكل زائر ودفع فاتورة استعماله. راجع docs/intelligence.md

   ما يفعله هذا الملف: خوارزميات إحصائية حقيقية تعمل في متصفح
   التاجر على بياناته وحدها — بلا خادم وبلا تكلفة وبلا تسريب.

   المبدأ الحاكم: لا نعطي توصية بلا دليل كافٍ.
   كل مخرَج يحمل عدد العيّنة ومستوى الثقة.
   ========================================================= */
(function () {
  "use strict";

  const AI = {};

  /* ---------- إعدادات قابلة للضبط ---------- */
  AI.CONFIG = {
    MIN_SAMPLE: 5,        // أقل عدد طلبات لإصدار حكم على ولاية
    STRONG_SAMPLE: 15,    // عيّنة تُعطي ثقة عالية
    BAD_RATE: 0.55,       // نسبة تسليم تحت هذا الحد = مشكلة
    GOOD_RATE: 0.75,      // فوق هذا = ممتاز
    STOCK_DAYS: 14,       // أفق التنبؤ بالمخزون
    RISK_CANCEL: 2        // إلغاءان = زبون متعثّر
  };

  /* ---------- أدوات ---------- */
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };

  AI.toDate = function (v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v === "object" && typeof v.toDate === "function") {
      try { const d = v.toDate(); return isNaN(d) ? null : d; } catch (e) { return null; }
    }
    if (typeof v === "object" && typeof v.seconds === "number") return new Date(v.seconds * 1000);
    const d = new Date(v);
    return isNaN(d) ? null : d;
  };

  AI.orderDate = o => AI.toDate(o && (o.created_at || o.created));
  AI.status = o => {
    const s = (o && o.status) || "pending";
    return s === "cancel" ? "cancelled" : s;
  };
  AI.orderValue = o => num(o && o.total_price) || (num(o && o.unit_price) * (num(o && o.quantity) || 1));

  /* تطبيع اسم الولاية — نفس منطق السلة حتى لا تنقسم الإحصاءات */
  AI.normWilaya = function (v) {
    return String(v == null ? "" : v)
      .replace(/ولاية/g, "").replace(/العاصمة/g, "")
      .replace(/[\u0623\u0625\u0622]/g, "\u0627")
      .replace(/\u0629/g, "\u0647").replace(/\u0649/g, "\u064A")
      .replace(/[\u064B-\u0652]/g, "")
      .replace(/[^\u0600-\u06FF\w]/g, "").trim();
  };

  /* ---------- 1) تحليل الولايات: أين يقع الروتور؟ ----------
     المشكلة رقم 1 للتاجر الجزائري. نحسب لكل ولاية نسبة التسليم
     الفعلية ونصنّفها. لا نحكم على ولاية بأقل من MIN_SAMPLE طلبات. */
  AI.analyzeWilayas = function (orders) {
    const map = {};
    (orders || []).forEach(o => {
      const key = AI.normWilaya(o.wilaya);
      if (!key) return;
      if (!map[key]) map[key] = { name: o.wilaya || key, total: 0, done: 0, cancelled: 0, pending: 0, revenue: 0 };
      const m = map[key];
      m.total++;
      const s = AI.status(o);
      if (s === "completed") { m.done++; m.revenue += AI.orderValue(o); }
      else if (s === "cancelled") m.cancelled++;
      else m.pending++;
    });

    return Object.values(map).map(m => {
      const decided = m.done + m.cancelled;           // المحسوم فقط
      const rate = decided > 0 ? m.done / decided : null;
      let level = "unknown", label = "بيانات غير كافية";
      if (decided >= AI.CONFIG.MIN_SAMPLE && rate !== null) {
        if (rate < AI.CONFIG.BAD_RATE) { level = "bad"; label = "نسبة إلغاء مرتفعة"; }
        else if (rate >= AI.CONFIG.GOOD_RATE) { level = "good"; label = "ولاية ممتازة"; }
        else { level = "mid"; label = "متوسطة"; }
      }
      return {
        wilaya: m.name, total: m.total, done: m.done, cancelled: m.cancelled,
        pending: m.pending, revenue: Math.round(m.revenue),
        rate: rate === null ? null : Math.round(rate * 100),
        sample: decided,
        confidence: decided >= AI.CONFIG.STRONG_SAMPLE ? "عالية" : decided >= AI.CONFIG.MIN_SAMPLE ? "متوسطة" : "ضعيفة",
        level, label
      };
    }).sort((a, b) => b.total - a.total);
  };

  /* ---------- 2) درجة خطورة الطلب (قبل الشحن) ----------
     تقدير احتمال الفشل بناءً على إشارات حقيقية من بيانات التاجر.
     نعيد سبباً لكل نقطة — التاجر يجب أن يفهم لماذا. */
  AI.scoreOrder = function (order, ctx) {
    ctx = ctx || {};
    const reasons = [];
    let risk = 0;

    // أ) سجل الزبون: أقوى إشارة على الإطلاق
    let repeatCanceller = false;   // سلوك مثبت يغلب أي مؤشر جغرافي
    const phone = String(order.phone_number || "").replace(/\D/g, "");
    if (phone && ctx.customerHistory && ctx.customerHistory[phone]) {
      const h = ctx.customerHistory[phone];
      if (h.cancelled >= AI.CONFIG.RISK_CANCEL) {
        // أقوى إشارة على الإطلاق: سلوك مثبت لا تخمين.
        // 65 تتجاوز حدّ «خطر مرتفع» (60) وحدها، وتزيد مع كل إلغاء إضافي.
        risk += 65 + Math.min(20, (h.cancelled - AI.CONFIG.RISK_CANCEL) * 10);
        reasons.push(`ألغى ${h.cancelled} طلبات سابقة`);
        repeatCanceller = true;
      } else if (h.cancelled === 1 && h.completed === 0) {
        risk += 18; reasons.push("ألغى طلبه الوحيد السابق");
      }
      if (h.completed >= 2 && !repeatCanceller) {
        risk -= 25; reasons.push(`زبون موثوق (${h.completed} طلبات ناجحة)`);
      }
    }

    // ب) الولاية: نستعمل نسبتها الفعلية إن توفّرت عيّنة كافية
    const wkey = AI.normWilaya(order.wilaya);
    const w = (ctx.wilayaStats || []).find(x => AI.normWilaya(x.wilaya) === wkey);
    if (w && w.sample >= AI.CONFIG.MIN_SAMPLE && w.rate !== null) {
      if (w.rate < AI.CONFIG.BAD_RATE * 100) { risk += 22; reasons.push(`ولاية ${w.wilaya}: التسليم ${w.rate}%`); }
      else if (w.rate >= AI.CONFIG.GOOD_RATE * 100 && !repeatCanceller) {
        // لا نخصم لزبون ملغٍ متكرر: سلوكه الشخصي أقوى دلالة من معدّل ولايته
        risk -= 10; reasons.push(`ولاية ${w.wilaya}: تسليم ممتاز ${w.rate}%`);
      }
    }

    // ج) رقم الهاتف: صيغة جزائرية صحيحة
    if (!/^0(5|6|7)[0-9]{8}$/.test(phone) && !/^213(5|6|7)[0-9]{8}$/.test(phone)) {
      // بلا رقم صحيح لا يمكن التأكيد ولا التوصيل — الطلب شبه ميت.
      risk += 65; reasons.push("رقم الهاتف غير مطابق للصيغة الجزائرية");
    }
    // تكرار رقمي مريب (0555555555)
    if (phone && /^(\d)\1{6,}$/.test(phone.slice(-9))) { risk += 45; reasons.push("رقم هاتف يبدو وهمياً"); }

    // د) العنوان: عنوان قصير جداً يصعب التوصيل إليه
    const addr = String(order.address_line || order.address || "").trim();
    if (addr.length < 10) { risk += 15; reasons.push("العنوان مختصر جداً"); }

    // هـ) قيمة مرتفعة = خسارة أكبر عند الروتور
    const val = AI.orderValue(order);
    if (ctx.avgOrder && val > ctx.avgOrder * 2.5) {
      risk += 12; reasons.push("قيمة الطلب أعلى بكثير من المعتاد");
    }

    // و) كمية كبيرة بلا سجل
    if (num(order.quantity) >= 5) { risk += 10; reasons.push(`كمية كبيرة (${num(order.quantity)})`); }

    risk = Math.max(0, Math.min(100, Math.round(risk)));
    const level = risk >= 60 ? "high" : risk >= 30 ? "mid" : "low";
    return {
      risk, level, reasons,
      label: level === "high" ? "خطر مرتفع" : level === "mid" ? "انتبه" : "آمن",
      advice: level === "high"
        ? "اتصل بالزبون وأكّد قبل الشحن"
        : level === "mid" ? "يُفضّل تأكيد هاتفي سريع" : "يمكن الشحن مباشرة"
    };
  };

  /* بناء سجل الزبائن من الطلبات (مفتاحه رقم الهاتف) */
  AI.buildCustomerHistory = function (orders) {
    const h = {};
    (orders || []).forEach(o => {
      const p = String(o.phone_number || "").replace(/\D/g, "");
      if (!p) return;
      if (!h[p]) h[p] = { completed: 0, cancelled: 0, pending: 0, total: 0, spent: 0, name: o.customer_name || "" };
      const s = AI.status(o);
      h[p].total++;
      if (s === "completed") { h[p].completed++; h[p].spent += AI.orderValue(o); }
      else if (s === "cancelled") h[p].cancelled++;
      else h[p].pending++;
    });
    return h;
  };

  /* ---------- 3) تنبؤ بنفاد المخزون ----------
     معدل البيع اليومي من الطلبات المؤكَّدة خلال آخر 30 يوماً. */
  AI.forecastStock = function (products, orders, days) {
    days = days || 30;
    const since = new Date(Date.now() - days * 86400000);
    const sold = {};
    (orders || []).forEach(o => {
      if (AI.status(o) !== "completed") return;
      const d = AI.orderDate(o);
      if (!d || d < since) return;
      const id = o.product_ordered;
      if (!id) return;
      sold[id] = (sold[id] || 0) + (num(o.quantity) || 1);
    });

    return (products || []).map(p => {
      const qty = sold[p.id] || 0;
      const perDay = qty / days;
      const stock = num(p.stock);
      const daysLeft = perDay > 0 ? Math.floor(stock / perDay) : null;
      let level = "ok", label = "المخزون كافٍ";
      if (stock <= 0) { level = "out"; label = "نفد المخزون"; }
      else if (daysLeft !== null && daysLeft <= 3) { level = "critical"; label = `ينفد خلال ${daysLeft} أيام`; }
      else if (daysLeft !== null && daysLeft <= AI.CONFIG.STOCK_DAYS) { level = "warn"; label = `ينفد خلال ${daysLeft} يوماً`; }
      else if (perDay === 0 && stock > 0) { level = "idle"; label = "لم يُبَع منذ شهر"; }
      return {
        id: p.id, name: p.name || "منتج", stock,
        soldLast: qty, perDay: Math.round(perDay * 100) / 100,
        daysLeft, level, label
      };
    }).sort((a, b) => {
      const rank = { out: 0, critical: 1, warn: 2, idle: 3, ok: 4 };
      return rank[a.level] - rank[b.level];
    });
  };

  /* ---------- 4) أفضل وقت للاتصال ----------
     نقارن ساعة الطلب بمعدل نجاحه — «كل ساعة تأخير تفقدك حماس المشتري». */
  AI.bestHours = function (orders) {
    const h = Array.from({ length: 24 }, () => ({ total: 0, done: 0 }));
    (orders || []).forEach(o => {
      const d = AI.orderDate(o);
      if (!d) return;
      const s = AI.status(o);
      if (s === "pending") return;
      h[d.getHours()].total++;
      if (s === "completed") h[d.getHours()].done++;
    });
    const rows = h.map((x, i) => ({
      hour: i, total: x.total,
      rate: x.total >= 3 ? Math.round(x.done / x.total * 100) : null
    })).filter(x => x.rate !== null);
    rows.sort((a, b) => b.rate - a.rate);
    return { best: rows.slice(0, 3), worst: rows.slice(-3).reverse(), all: rows };
  };

  /* ---------- 5) كشف الشذوذ ----------
     مقارنة آخر 7 أيام بالسبعة التي قبلها. */
  AI.detectAnomalies = function (orders) {
    const now = Date.now(), D = 86400000;
    const cur = [], prev = [];
    (orders || []).forEach(o => {
      const d = AI.orderDate(o); if (!d) return;
      const age = (now - d.getTime()) / D;
      if (age <= 7) cur.push(o); else if (age <= 14) prev.push(o);
    });

    const rate = list => {
      const dec = list.filter(o => AI.status(o) !== "pending");
      if (!dec.length) return null;
      return dec.filter(o => AI.status(o) === "completed").length / dec.length;
    };
    const out = [];
    const rc = rate(cur), rp = rate(prev);

    if (rc !== null && rp !== null && cur.length >= 5 && rp - rc >= 0.15) {
      out.push({
        type: "delivery_drop", severity: "high",
        title: "انخفاض نسبة التسليم",
        detail: `نزلت من ${Math.round(rp * 100)}% إلى ${Math.round(rc * 100)}% هذا الأسبوع.`,
        action: "راجع إعلاناتك — الوعود المبالغ فيها ترفع الرفض عند الاستلام."
      });
    }
    if (prev.length >= 5 && cur.length <= prev.length * 0.5) {
      out.push({
        type: "orders_drop", severity: "mid",
        title: "تراجع عدد الطلبات",
        detail: `${cur.length} هذا الأسبوع مقابل ${prev.length} الأسبوع الماضي.`,
        action: "تحقّق من عمل إعلاناتك ومن أن متجرك يفتح بلا أخطاء."
      });
    }
    if (cur.length >= prev.length * 2 && prev.length >= 3) {
      out.push({
        type: "orders_spike", severity: "info",
        title: "ارتفاع في الطلبات",
        detail: `${cur.length} هذا الأسبوع مقابل ${prev.length} سابقاً.`,
        action: "تأكّد من كفاية المخزون وسرعة التأكيد الهاتفي."
      });
    }
    const pend = (orders || []).filter(o => {
      const d = AI.orderDate(o);
      return AI.status(o) === "pending" && d && (now - d.getTime()) / D > 2;
    });
    if (pend.length >= 3) {
      out.push({
        type: "stale_pending", severity: "high",
        title: `${pend.length} طلبات معلّقة أكثر من يومين`,
        detail: "كل ساعة تأخير في التأكيد تُضعف حماس المشتري.",
        action: "أكّدها الآن أو ألغِها لتحرير المخزون."
      });
    }
    return out;
  };

  /* ---------- 6) التوصيات مرتّبة بالأثر المالي ----------
     نرتّب حسب المال المعرّض للخطر — لا حسب رأينا. */
  AI.recommend = function (data) {
    const { orders = [], products = [] } = data || {};
    const recs = [];
    const wilayas = AI.analyzeWilayas(orders);
    const stock = AI.forecastStock(products, orders);
    const anomalies = AI.detectAnomalies(orders);

    // ولايات خاسرة
    wilayas.filter(w => w.level === "bad" && w.sample >= AI.CONFIG.MIN_SAMPLE).forEach(w => {
      const lost = Math.round(w.cancelled * (w.revenue / Math.max(1, w.done) || 0));
      recs.push({
        impact: lost, icon: "🚚", severity: "high",
        title: `ولاية ${w.wilaya}: تسليم ${w.rate}% فقط`,
        detail: `${w.cancelled} ملغى من ${w.sample} (ثقة ${w.confidence}).`,
        action: "اطلب تأكيداً هاتفياً إجبارياً لهذه الولاية، أو ارفع سعر شحنها."
      });
    });

    // مخزون حرج على منتجات تبيع
    stock.filter(s => s.level === "critical" || s.level === "out").forEach(s => {
      recs.push({
        impact: Math.round(s.perDay * 30 * 1000), icon: "📦", severity: s.level === "out" ? "high" : "mid",
        title: `${s.name}: ${s.label}`,
        detail: `يبيع ${s.perDay} قطعة يومياً · المتبقي ${s.stock}.`,
        action: "أعد التخزين قبل أن تخسر طلبات."
      });
    });

    // منتجات راكدة
    const idle = stock.filter(s => s.level === "idle");
    if (idle.length >= 3) {
      recs.push({
        impact: 0, icon: "💤", severity: "low",
        title: `${idle.length} منتجات لم تُبَع منذ شهر`,
        detail: idle.slice(0, 3).map(x => x.name).join(" · "),
        action: "جرّب خصماً أو أوقفها وركّز إعلانك على الأكثر مبيعاً."
      });
    }

    anomalies.forEach(a => recs.push({
      impact: a.severity === "high" ? 999999 : 500,
      icon: a.severity === "high" ? "🔴" : "📊",
      severity: a.severity, title: a.title, detail: a.detail, action: a.action
    }));

    return recs.sort((a, b) => {
      const rank = { high: 0, mid: 1, info: 2, low: 3 };
      if (rank[a.severity] !== rank[b.severity]) return rank[a.severity] - rank[b.severity];
      return b.impact - a.impact;
    });
  };

  /* ---------- 7) ملخّص شامل ---------- */
  AI.analyze = function (data) {
    const { orders = [], products = [] } = data || {};
    const decided = orders.filter(o => AI.status(o) !== "pending");
    const done = decided.filter(o => AI.status(o) === "completed");
    const rate = decided.length ? done.length / decided.length : null;
    const revenue = done.reduce((s, o) => s + AI.orderValue(o), 0);
    const history = AI.buildCustomerHistory(orders);
    const avgOrder = done.length ? revenue / done.length : 0;

    return {
      health: {
        deliveryRate: rate === null ? null : Math.round(rate * 100),
        // المرجع من واقع السوق الجزائري: فوق 65-70% جيد، تحت 50% مشكلة
        verdict: rate === null ? "بيانات غير كافية"
               : rate >= 0.70 ? "ممتاز" : rate >= 0.50 ? "مقبول" : "يحتاج تدخّلاً عاجلاً",
        sample: decided.length,
        revenue: Math.round(revenue),
        avgOrder: Math.round(avgOrder)
      },
      wilayas: AI.analyzeWilayas(orders),
      stock: AI.forecastStock(products, orders),
      hours: AI.bestHours(orders),
      anomalies: AI.detectAnomalies(orders),
      recommendations: AI.recommend({ orders, products }),
      customers: history,
      riskyCustomers: Object.entries(history)
        .filter(([, h]) => h.cancelled >= AI.CONFIG.RISK_CANCEL)
        .map(([phone, h]) => ({ phone, ...h }))
        .sort((a, b) => b.cancelled - a.cancelled)
    };
  };

  window.SE_AI = AI;
})();
