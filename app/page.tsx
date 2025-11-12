import ReservationForm from "./components/ReservationForm";

export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>サポート予約フォーム</h1>
      <p style={{ color: "#666" }}>以下にご記入ください（この段階ではまだ保存しません）。</p>
      <div style={{ marginTop: "1.5rem" }}>
        <ReservationForm />
      </div>
    </main>
  );
}
