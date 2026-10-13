// إحصائيات عامة للزوار: أعداد فقط، بدون أي بيانات شخصية.
import { CHOICES, STATUSES, allSubmissions, json } from "../lib/shared.mjs";

const countBy = (items, key, order) => {
  const counts = Object.fromEntries(order.map((k) => [k, 0]));
  for (const it of items) if (it[key] in counts) counts[it[key]]++;
  return order.map((label) => ({ label, count: counts[label] }));
};

export default async () => {
  const items = await allSubmissions();
  const byStatus = Object.fromEntries(Object.keys(STATUSES).map((s) => [s, 0]));
  for (const it of items) if (it.status in byStatus) byStatus[it.status]++;

  // آخر 6 أشهر
  const months = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = 5; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    months.push(m.toISOString().slice(0, 7));
  }
  const byMonth = months.map((m) => ({ label: m, count: items.filter((it) => it.createdAt.startsWith(m)).length }));

  return json(
    {
      total: items.length,
      byStatus,
      byType: countBy(items, "type", CHOICES.type),
      byArea: countBy(items, "area", CHOICES.area),
      byMonth,
      updatedAt: new Date().toISOString(),
    },
    200,
    // المتصفح يطلب دائمًا نسخة جديدة، وشبكة Netlify تحفظ النتيجة دقيقة واحدة حتى لا تُقرأ كل المشاركات مع كل زيارة
    { "Cache-Control": "public, max-age=0, must-revalidate", "Netlify-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  );
};

export const config = { path: "/api/stats" };
