// لوحة التحكم: عرض المشاركات وتحديث حالتها وحذفها. محمية بكلمة السر ADMIN_PASSWORD.
import { STATUSES, allSubmissions, submissions, images, isAdmin, json } from "../lib/shared.mjs";

export default async (req) => {
  if (!process.env.ADMIN_PASSWORD) return json({ error: "not-configured" }, 503);
  if (!isAdmin(req)) {
    await new Promise((r) => setTimeout(r, 800)); // يبطّئ تخمين كلمة السر
    return json({ error: "unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  // GET ?image=SM-XXXX/1 → الصورة نفسها
  const imageKey = url.searchParams.get("image");
  if (req.method === "GET" && imageKey) {
    const res = await images().getWithMetadata(imageKey, { type: "arrayBuffer" });
    if (!res) return json({ error: "not-found" }, 404);
    return new Response(res.data, {
      headers: { "Content-Type": res.metadata?.type || "application/octet-stream", "Cache-Control": "private, no-store" },
    });
  }

  if (req.method === "GET") return json({ items: await allSubmissions(), statuses: STATUSES }, 200, { "Cache-Control": "no-store" });

  if (!id) return json({ error: "id مطلوب" }, 400);
  const store = submissions();
  const item = await store.get(id, { type: "json" });
  if (!item) return json({ error: "not-found" }, 404);

  if (req.method === "PATCH") {
    const body = await req.json().catch(() => ({}));
    if (body.status !== undefined) {
      if (!(body.status in STATUSES)) return json({ error: "حالة غير معروفة" }, 400);
      item.status = body.status;
    }
    if (body.note !== undefined) item.note = String(body.note).slice(0, 2000);
    item.updatedAt = new Date().toISOString();
    await store.setJSON(id, item);
    return json(item);
  }

  if (req.method === "DELETE") {
    await Promise.all((item.images || []).map((k) => images().delete(k)));
    await store.delete(id);
    return json({ ok: true });
  }

  return json({ error: "method" }, 405);
};

export const config = { path: "/api/admin" };
