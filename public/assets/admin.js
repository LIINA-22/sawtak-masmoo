// لوحة تحكم فريق المبادرة: تسجيل الدخول، وعرض المشاركات، وتحديث الحالة، والتصدير
const $ = (id) => document.getElementById(id);
const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (iso) =>
  new Date(iso).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

const KEY = "sawtak-admin";
let password = "";
try { password = sessionStorage.getItem(KEY) || ""; } catch (_) {}

let items = [];
let statuses = {};
let filter = { status: "", type: "", area: "", q: "" };

const api = async (path, opts = {}) => {
  const res = await fetch(path, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${password}` } });
  if (res.status === 401) throw new Error("unauthorized");
  if (res.status === 503) throw new Error("not-configured");
  if (!res.ok) throw new Error("failed");
  return res;
};

const showPanel = (on) => {
  $("login").hidden = on;
  $("panel").hidden = !on;
  $("logout").hidden = !on;
};

async function load() {
  const data = await (await api("/api/admin")).json();
  items = data.items;
  statuses = data.statuses;
  showPanel(true);
  fillFilters();
  render();
}

$("login").addEventListener("submit", async (e) => {
  e.preventDefault();
  password = $("password").value;
  $("login-status").textContent = "جارٍ التحقق...";
  $("login-status").className = "form-status";
  try {
    await load();
    try { sessionStorage.setItem(KEY, password); } catch (_) {}
    $("login-status").textContent = "";
  } catch (err) {
    $("login-status").className = "form-status error";
    $("login-status").textContent = err.message === "not-configured"
      ? "لم تُضبط كلمة السر بعد. أضف المتغير ADMIN_PASSWORD في إعدادات Netlify."
      : err.message === "unauthorized" ? "كلمة السر غير صحيحة." : "تعذّر الاتصال، حاول مرة أخرى.";
  }
});

$("logout").addEventListener("click", () => {
  password = "";
  try { sessionStorage.removeItem(KEY); } catch (_) {}
  items = [];
  $("list").innerHTML = "";
  $("password").value = "";
  showPanel(false);
});

function fillFilters() {
  const fill = (el, key) => {
    const values = [...new Set(items.map((i) => i[key]).filter(Boolean))].sort();
    const current = el.value;
    el.innerHTML = el.options[0].outerHTML + values.map((v) => `<option>${escapeHtml(v)}</option>`).join("");
    el.value = values.includes(current) ? current : "";
  };
  fill($("filter-type"), "type");
  fill($("filter-area"), "area");
}

const visible = () => {
  const q = filter.q.trim().toLowerCase();
  return items.filter((i) =>
    (!filter.status || i.status === filter.status) &&
    (!filter.type || i.type === filter.type) &&
    (!filter.area || i.area === filter.area) &&
    (!q || [i.id, i.name, i.contact, i.message, i.solution, i.note].some((v) => String(v || "").toLowerCase().includes(q))));
};

function renderChips() {
  const counts = {};
  items.forEach((i) => (counts[i.status] = (counts[i.status] || 0) + 1));
  const chip = (key, label, n) =>
    `<button class="chip${filter.status === key ? " active" : ""}" data-status="${key}">${label}<b>${n}</b></button>`;
  $("status-chips").innerHTML = chip("", "الكل", items.length) +
    Object.entries(statuses).map(([k, label]) => chip(k, label, counts[k] || 0)).join("");
}

const FIELDS = [
  ["contact", "وسيلة التواصل"], ["major", "التخصص"], ["type", "النوع"], ["problem-type", "نوع المشكلة"],
  ["area", "المجال"], ["impact", "التأثير"], ["frequency", "التكرار"], ["priority", "الأولوية"], ["contact-wanted", "يرغب بالتواصل"],
];

function itemHtml(i) {
  const fields = FIELDS.filter(([k]) => i[k])
    .map(([k, label]) => `<div><dt>${label}</dt><dd${k === "contact" ? ' dir="auto"' : ""}>${escapeHtml(i[k])}</dd></div>`).join("");
  const options = Object.entries(statuses)
    .map(([k, label]) => `<option value="${k}"${k === i.status ? " selected" : ""}>${label}</option>`).join("");
  return `
    <details class="item" data-id="${escapeHtml(i.id)}">
      <summary>
        <span class="status status-${escapeHtml(i.status)}">${escapeHtml(statuses[i.status] || i.status)}</span>
        <span class="item-title">${escapeHtml(i.message)}</span>
        <span class="item-id">${escapeHtml(i.id)}</span>
        <span class="item-meta">
          <span>${escapeHtml(i.name)}</span>
          <span>${escapeHtml(i.type)}</span>
          <span>${escapeHtml(i.area)}</span>
          <span class="${i.priority === "عاجل" ? "prio-urgent" : ""}">الأولوية: ${escapeHtml(i.priority)}</span>
          <span>${fmtDate(i.createdAt)}</span>
          ${i.images?.length ? `<span>📎 ${i.images.length}</span>` : ""}
        </span>
      </summary>
      <div class="item-body">
        <dl class="fields">${fields}</dl>
        <dl class="long">
          <dt>الملاحظة أو الاقتراح</dt><dd>${escapeHtml(i.message)}</dd>
        </dl>
        <dl class="long">
          <dt>الحل المقترح</dt><dd>${escapeHtml(i.solution)}</dd>
        </dl>
        ${i.images?.length ? `<div class="thumbs">${i.images.map((k) => `<img alt="صورة مرفقة" data-key="${escapeHtml(k)}">`).join("")}</div>` : ""}
        <div class="manage">
          <label>الحالة<select class="m-status">${options}</select></label>
          <label>ملاحظات الفريق (داخلية)<textarea class="m-note" rows="2" maxlength="2000">${escapeHtml(i.note)}</textarea></label>
          <div class="manage-actions">
            <button class="btn btn-small m-save">حفظ</button>
            <span class="saved" role="status"></span>
            <span style="flex:1"></span>
            <button class="btn btn-small btn-danger m-delete">حذف</button>
          </div>
        </div>
      </div>
    </details>`;
}

function render() {
  renderChips();
  const list = visible();
  $("count").textContent = `${list.length} من ${items.length} مشاركة`;
  $("list").innerHTML = list.length ? list.map(itemHtml).join("") : '<p class="empty-note">لا توجد مشاركات مطابقة.</p>';
}

// الصور محمية بكلمة السر، فتُجلب عند فتح المشاركة
$("list").addEventListener("toggle", async (e) => {
  const det = e.target;
  if (!det.open) return;
  for (const img of det.querySelectorAll("img[data-key]:not([src])")) {
    try {
      const blob = await (await api(`/api/admin?image=${encodeURIComponent(img.dataset.key)}`)).blob();
      img.src = URL.createObjectURL(blob);
    } catch (_) { img.alt = "تعذّر تحميل الصورة"; }
  }
}, true);

$("list").addEventListener("click", async (e) => {
  const img = e.target.closest(".thumbs img[src]");
  if (img) {
    const box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML = `<img src="${img.src}" alt="صورة مرفقة">`;
    box.addEventListener("click", () => box.remove());
    document.body.append(box);
    return;
  }

  const det = e.target.closest(".item");
  if (!det) return;
  const id = det.dataset.id;
  const saved = det.querySelector(".saved");

  if (e.target.closest(".m-save")) {
    saved.textContent = "جارٍ الحفظ...";
    try {
      const updated = await (await api(`/api/admin?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: det.querySelector(".m-status").value, note: det.querySelector(".m-note").value }),
      })).json();
      Object.assign(items.find((i) => i.id === id), updated);
      renderChips();
      const badge = det.querySelector(".status");
      badge.className = `status status-${updated.status}`;
      badge.textContent = statuses[updated.status];
      saved.textContent = "تم الحفظ ✓";
    } catch (_) {
      saved.textContent = "تعذّر الحفظ";
    }
  }

  if (e.target.closest(".m-delete")) {
    if (!confirm(`حذف المشاركة ${id} نهائيًا؟ لا يمكن التراجع.`)) return;
    try {
      await api(`/api/admin?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      items = items.filter((i) => i.id !== id);
      render();
    } catch (_) {
      saved.textContent = "تعذّر الحذف";
    }
  }
});

$("status-chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  filter.status = chip.dataset.status;
  render();
});
$("search").addEventListener("input", (e) => { filter.q = e.target.value; render(); });
$("filter-type").addEventListener("change", (e) => { filter.type = e.target.value; render(); });
$("filter-area").addEventListener("change", (e) => { filter.area = e.target.value; render(); });
$("refresh").addEventListener("click", () => load().catch(() => alert("تعذّر التحديث")));

// تصدير المشاركات الظاهرة إلى ملف CSV يفتح في Excel
$("export").addEventListener("click", () => {
  const cols = [
    ["id", "الرقم المرجعي"], ["createdAt", "التاريخ"], ["status", "الحالة"], ["name", "الاسم"], ["contact", "وسيلة التواصل"], ["major", "التخصص"], ["type", "النوع"], ["problem-type", "نوع المشكلة"], ["area", "المجال"],
    ["message", "الملاحظة"], ["solution", "الحل المقترح"], ["impact", "التأثير"], ["frequency", "التكرار"],
    ["priority", "الأولوية"], ["contact-wanted", "يرغب بالتواصل"], ["note", "ملاحظات الفريق"],
  ];
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = "'" + s; // يمنع تنفيذ الصيغ في Excel
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = visible().map((i) => cols.map(([k]) => cell(k === "status" ? statuses[i.status] : k === "createdAt" ? fmtDate(i.createdAt) : i[k])).join(","));
  const csv = "﻿" + [cols.map(([, h]) => cell(h)).join(","), ...rows].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `sawtak-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

if (password) load().catch(() => showPanel(false));
