// app/admin/page.tsx
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const res = await fetch("/api/reservations", { cache: "no-store" });
  const data = res.ok ? await res.json() : { ok: false, items: [] };
  const items: any[] = data.items ?? [];

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>予約一覧（仮）</h1>
      <p style={{ color: "#666" }}>APIが未実装の場合は空になります。</p>
      <pre style={{ background:"#f7f7f7", padding:12, borderRadius:8 }}>
{JSON.stringify(items, null, 2)}
      </pre>
    </main>
  );
}
