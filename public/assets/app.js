// صوتك مسموع! — سكربت الصفحات العامة: القائمة، والنموذج، والإحصائيات، وصفحة الشكر
const $ = (id) => document.getElementById(id);
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n).toLocaleString("ar-SA-u-nu-latn");

// القائمة على الجوال
const toggle = document.querySelector(".menu-toggle");
const links = $("nav-links");
if (toggle && links) {
  toggle.addEventListener("click", () => toggle.setAttribute("aria-expanded", links.classList.toggle("open")));
  links.addEventListener("click", (e) => {
    if (e.target.closest("a")) { links.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
  });
}
if ($("year")) $("year").textContent = new Date().getFullYear();

// ===== النموذج =====
const form = $("share-form");
if (form) {
  const status = form.querySelector(".form-status");
  const submitBtn = form.querySelector('button[type="submit"]');
  const setStatus = (msg, cls = "") => { status.textContent = msg; status.className = "form-status " + cls; };
  $("f-t").value = Date.now();

  // وسيلة التواصل: جوال سعودي أو بريد
  const isContact = (v) => {
    const s = v.trim().replace(/[\s-]/g, "");
    return /^(05\d{8}|(\+?966)5\d{8})$/.test(s) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  };
  const contact = form.elements.contact;
  const checkContact = () =>
    contact.setCustomValidity(contact.value.trim() && !isContact(contact.value) ? "اكتب رقم جوال مثل 05xxxxxxxx أو بريدًا إلكترونيًا صحيحًا" : "");
  contact.addEventListener("input", checkContact);
  checkContact();

  // سؤال نوع المشكلة يظهر فقط مع "مشكلة / شكوى"
  const problem = $("q-problem");
  const updateProblem = () => {
    const show = form.elements.type.value === "مشكلة / شكوى";
    problem.hidden = !show;
    problem.querySelectorAll("input").forEach((i) => (i.disabled = !show));
  };
  form.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener("change", updateProblem));
  updateProblem();

  // الصور: حتى 3، وكل اختيار يُضاف للسابق
  const picker = $("f-images");
  let selected = [];
  const showFiles = () => {
    $("file-list").innerHTML = selected
      .map((f, i) => `<li><span>🖼️ ${escapeHtml(f.name)}</span><button type="button" class="remove" data-i="${i}" aria-label="حذف الصورة">✕</button></li>`)
      .join("");
    picker.disabled = selected.length >= 3;
  };
  picker.addEventListener("change", () => {
    const added = [...picker.files].filter((f) => f.type.startsWith("image/"));
    const room = 3 - selected.length;
    selected = selected.concat(added.slice(0, room));
    picker.value = "";
    showFiles();
    if (added.length > room) setStatus(`الحد الأقصى 3 صور، فأُضيف منها ${room} فقط.`, "error");
    else setStatus("");
  });
  $("file-list").addEventListener("click", (e) => {
    const btn = e.target.closest(".remove");
    if (!btn) return;
    selected.splice(+btn.dataset.i, 1);
    showFiles();
  });

  // تصغير الصورة قبل الرفع (أقصى بُعد 1600 بكسل)
  const shrink = (file) =>
    new Promise((resolve) => {
      if (file.type === "image/gif") return resolve(file);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (!blob || blob.size >= file.size) return resolve(file);
          resolve(new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
        }, "image/jpeg", 0.8);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });

  // إزالة التنبيه الأحمر بمجرد تعبئة الخانة
  const clear = (e) => {
    const q = e.target.closest(".q");
    if (q && q.classList.contains("invalid") && ![...q.querySelectorAll("input, textarea")].some((i) => !i.checkValidity())) {
      q.classList.remove("invalid");
    }
  };
  form.addEventListener("input", clear);
  form.addEventListener("change", clear);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    form.querySelectorAll(".q.invalid").forEach((q) => q.classList.remove("invalid"));
    if (!form.checkValidity()) {
      const bad = [...new Set([...form.querySelectorAll(":invalid")].map((el) => el.closest(".q")).filter(Boolean))];
      bad.forEach((q) => q.classList.add("invalid"));
      bad[0]?.scrollIntoView({ behavior: "smooth", block: "center" });
      const contactBad = !contact.validity.valueMissing && !contact.checkValidity();
      setStatus(contactBad ? contact.validationMessage : "الرجاء الإجابة على الأسئلة المطلوبة المعلّمة بـ *", "error");
      return;
    }

    submitBtn.disabled = true;
    setStatus("جارٍ الإرسال...");
    try {
      const data = new FormData(form);
      const imgs = await Promise.all(selected.map(shrink));
      if (imgs.some((f) => f.size > 2 * 1024 * 1024)) throw new Error("too-large");
      imgs.forEach((f) => data.append("images", f, f.name));

      const res = await fetch("/api/submit", { method: "POST", body: data });
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) throw new Error("rate");
      if (!res.ok || !body.id) throw new Error("failed");

      const wantsContact = form.elements["contact-wanted"].value === "نعم";
      location.href = `/thanks.html?id=${encodeURIComponent(body.id)}${wantsContact ? "&contact=yes" : ""}`;
    } catch (err) {
      setStatus({
        "too-large": "إحدى الصور كبيرة جدًا، جرّب صورة أصغر.",
        rate: "أرسلت مشاركات كثيرة خلال وقت قصير، حاول بعد ساعة.",
      }[err.message] || "تعذّر الإرسال، تأكد من اتصالك بالإنترنت وحاول مرة أخرى.", "error");
      submitBtn.disabled = false;
    }
  });
}

// ===== صفحة الشكر =====
if ($("ref-id")) {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (id && /^SM-[A-Z0-9]{6}$/.test(id)) {
    $("ref-id").textContent = id;
    $("ref").hidden = false;
  }
  if (params.get("contact") === "yes") {
    $("thanks-msg").textContent = "سيطّلع عليها فريق المجلس الطلابي، ونتواصل معك في أقرب فرصة عبر وسيلة التواصل اللي كتبتها. احتفظ بالرقم المرجعي لو احتجت تسأل عن مشاركتك.";
  }
}

// ===== الإحصائيات =====
const statEls = document.querySelectorAll("[data-stat]");
if (statEls.length) {
  const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

  // أعمدة أفقية: سلسلة واحدة، لون واحد، والقيمة مكتوبة بجانب كل عمود
  const bars = (el, rows) => {
    const max = Math.max(1, ...rows.map((r) => r.count));
    const sorted = [...rows].sort((a, b) => b.count - a.count);
    el.innerHTML = sorted
      .map((r) => `
        <li class="bar" title="${escapeHtml(r.label)}: ${fmt(r.count)}">
          <span class="bar-label">${escapeHtml(r.label)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${(r.count / max) * 85}%"></span><span class="bar-value">${fmt(r.count)}</span></span>
        </li>`)
      .join("");
  };

  const monthsChart = (el, rows) => {
    const max = Math.max(1, ...rows.map((r) => r.count));
    const name = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];
    el.innerHTML = `
      <div class="months">${rows.map((r) => `
        <div class="month" title="${name(r.label)} ${r.label.slice(0, 4)}: ${fmt(r.count)} مشاركة">
          <span class="bar-value">${fmt(r.count)}</span>
          <span class="bar-fill" style="height:${(r.count / max) * 100}%"></span>
        </div>`).join("")}
      </div>
      <div class="month-labels">${rows.map((r) => `<span>${name(r.label)}</span>`).join("")}</div>`;
  };

  fetch("/api/stats")
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((s) => {
      const done = s.byStatus.done || 0;
      const active = (s.byStatus.review || 0) + (s.byStatus.progress || 0);
      const values = {
        total: fmt(s.total),
        active: fmt(active),
        done: fmt(done),
        rate: s.total ? fmt(Math.round((done / s.total) * 100)) + "٪" : "—",
      };
      statEls.forEach((el) => (el.textContent = values[el.dataset.stat]));

      if ($("chart-type")) {
        if (!s.total) {
          ["chart-type", "chart-area", "chart-months"].forEach((id) => ($(id).innerHTML = '<p class="empty-note">ما فيه مشاركات بعد. كن أول من يشارك!</p>'));
        } else {
          bars($("chart-type"), s.byType);
          bars($("chart-area"), s.byArea.filter((r) => r.count > 0));
          monthsChart($("chart-months"), s.byMonth);
        }
        $("stats-updated").textContent = "آخر تحديث: " + new Date(s.updatedAt).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "medium", timeStyle: "short" });
      }
    })
    .catch(() => {
      if ($("stats-updated")) $("stats-updated").textContent = "تعذّر تحميل الإحصائيات حاليًا.";
    });
}
