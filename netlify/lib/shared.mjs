// المنطق المشترك بين الدوال: الخيارات المسموحة، والتحقق، والتخزين، وصلاحية لوحة التحكم.
// إذا عدّلت خيارًا في النموذج (share.html)، عدّله هنا أيضًا.
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

export const CHOICES = {
  major: ["علوم الحاسب", "نظم المعلومات", "الأمن السيبراني", "الذكاء الاصطناعي"],
  type: ["اقتراح", "مشكلة / شكوى", "ملاحظة", "فكرة لمبادرة أو فعالية", "استفسار", "أخرى"],
  "problem-type": [
    "تأخير في خدمة أو إجراء", "عدم وضوح إجراء أو معلومة", "مشكلة في نظام إلكتروني", "مشكلة في قاعة أو مرفق",
    "مشكلة أكاديمية", "مشكلة تنظيمية", "مشكلة متكررة تؤثر على أكثر من طالب", "أخرى",
  ],
  area: [
    "الشؤون الأكاديمية", "الجداول والمحاضرات", "القاعات والمعامل", "المرافق والخدمات", "الخدمات التقنية والأنظمة",
    "الإجراءات الإدارية", "الأنشطة والفعاليات", "التدريب والفرص المهنية", "الأندية الطلابية", "مواقف السيارات والتنقل", "أخرى",
  ],
  impact: ["تؤثر على عدد كبير من الطلاب", "تؤثر على مجموعة محددة", "حالة فردية", "لا أعلم"],
  frequency: ["نعم، بشكل متكرر", "حدثت أكثر من مرة", "حدثت مرة واحدة", "لا ينطبق"],
  priority: ["عاجل", "مرتفع", "متوسط", "منخفض"],
  "contact-wanted": ["نعم", "لا، لا أحتاج إلى تواصل"],
};

export const TEXT_FIELDS = { name: 100, contact: 100, message: 3000, solution: 3000 };

export const REQUIRED = ["name", "contact", "major", "type", "area", "message", "solution", "impact", "frequency", "priority", "contact-wanted"];

// حالات المشاركة في لوحة التحكم
export const STATUSES = {
  new: "جديدة",
  review: "قيد المراجعة",
  progress: "قيد التنفيذ",
  done: "تم الحل",
  closed: "مغلقة",
};

export const MAX_IMAGES = 3;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const filled = (v) => typeof v === "string" && v.trim() !== "";

// رقم جوال سعودي (05xxxxxxxx أو 9665xxxxxxxx أو +9665xxxxxxxx) أو بريد إلكتروني
export const isContact = (v) => {
  const s = String(v).trim().replace(/[\s-]/g, "");
  return /^(05\d{8}|(\+?966)5\d{8})$/.test(s) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
};

// يرجّع قائمة أخطاء، وتكون فاضية إذا المشاركة سليمة
export function validate(d) {
  const errors = [];
  for (const key of REQUIRED) if (!filled(d[key])) errors.push(`${key} مطلوب`);
  if (filled(d.contact) && !isContact(d.contact)) errors.push("contact ليس رقم جوال أو بريدًا صحيحًا");
  for (const [key, allowed] of Object.entries(CHOICES)) {
    if (filled(d[key]) && !allowed.includes(d[key])) errors.push(`${key} قيمة غير مسموحة`);
  }
  for (const [key, max] of Object.entries(TEXT_FIELDS)) {
    if (filled(d[key]) && d[key].length > max) errors.push(`${key} أطول من ${max} حرف`);
  }
  if (d.type === "مشكلة / شكوى" && !filled(d["problem-type"])) errors.push("problem-type مطلوب مع مشكلة / شكوى");
  return errors;
}

// التخزين: Netlify Blobs، بدون قاعدة بيانات خارجية
export const submissions = () => getStore({ name: "submissions", consistency: "strong" });
export const images = () => getStore({ name: "images", consistency: "strong" });
export const limits = () => getStore({ name: "rate-limits", consistency: "strong" });

export async function allSubmissions() {
  const store = submissions();
  const { blobs } = await store.list();
  const items = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return items.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// رقم مرجعي قصير يقدر الطالب يحتفظ فيه، مثل SM-4K7Q2D
export function newId() {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "SM-" + [...bytes].map((b) => chars[b % chars.length]).join("");
}

export const hash = (s) => createHash("sha256").update(String(s)).digest();

// لوحة التحكم: كلمة السر في متغير البيئة ADMIN_PASSWORD
export function isAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return given !== "" && timingSafeEqual(hash(given), hash(expected));
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
