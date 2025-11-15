export default function AdminHome() {
  return (
    <main style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1>管理メニュー</h1>
      <ul>
        <li><a href="/admin/people">利用者一覧（予約実績ベース）</a></li>
      </ul>
    </main>
  );
}
