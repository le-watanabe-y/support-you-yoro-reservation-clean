export default async function AdminPage() {
  const items = [
    { id: 1, guardian_name: "サンプル保護者", email: "sample@example.com", preferred_date: "2025-01-01", notes: "ダミー行" }
  ];

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>予約一覧（ダミー）</h1>
      <pre style={{ background: "#f7f7f7", padding: 12, borderRadius: 6 }}>
        {JSON.stringify(items, null, 2)}
      </pre>
    </main>
  );
}
