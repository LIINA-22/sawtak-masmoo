// استقبال مشاركة جديدة من النموذج: تحقق، ثم حفظ المشاركة وصورها.
import {
  CHOICES, TEXT_FIELDS, MAX_IMAGES, MAX_IMAGE_BYTES,
  validate, submissions, images, limits, newId, hash, json,
} from "../lib/shared.mjs";

const PER_HOUR = 10; // أقصى عدد مشاركات من نفس الجهاز في الساعة

export default async (req, context) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let form;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "bad-request" }, 400);
  }

  // فخ للبوتات: خانة مخفية لا يعبّئها إنسان، ونموذج أُرسل بأقل من 3 ثوانٍ
  const started = Number(form.get("t"));
  if (form.get("website") || !started || Date.now() - started < 3000) return json({ error: "spam" }, 400);

  const data = {};
  for (const key of [...Object.keys(CHOICES), ...Object.keys(TEXT_FIELDS)]) {
    const v = form.get(key);
    if (typeof v === "string" && v.trim()) data[key] = v.trim();
  }
  if (data.type !== "مشكلة / شكوى") delete data["problem-type"];

  const errors = validate(data);
  const files = form.getAll("images").filter((f) => f && typeof f === "object" && f.size > 0);
  if (files.length > MAX_IMAGES) errors.push("أكثر من 3 صور");
  for (const f of files) {
    if (!String(f.type).startsWith("image/")) errors.push("ملف ليس صورة");
    if (f.size > MAX_IMAGE_BYTES) errors.push("صورة كبيرة");
  }
  if (errors.length) return json({ error: "invalid", details: errors }, 400);

  // حد بسيط للمشاركات من نفس الجهاز
  const hour = new Date().toISOString().slice(0, 13);
  const ipKey = `${hour}/${hash(context.ip || "unknown").toString("hex").slice(0, 32)}`;
  const count = Number(await limits().get(ipKey)) || 0;
  if (count >= PER_HOUR) return json({ error: "rate-limited" }, 429);
  await limits().set(ipKey, String(count + 1));

  const id = newId();
  const imageKeys = [];
  for (const [i, f] of files.entries()) {
    const key = `${id}/${i + 1}`;
    await images().set(key, await f.arrayBuffer(), { metadata: { type: f.type, name: f.name } });
    imageKeys.push(key);
  }

  const now = new Date().toISOString();
  await submissions().setJSON(id, {
    id,
    createdAt: now,
    updatedAt: now,
    status: "new",
    note: "",
    ...data,
    images: imageKeys,
  });

  return json({ id });
};

export const config = { path: "/api/submit" };
