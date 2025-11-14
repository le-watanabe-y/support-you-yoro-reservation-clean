export default async function AdminPage() {
  // 常に最新を読む
  const res = await fetch("/api/reservations", { cache: "no-store" });
  const json = await res.json();
  const items: any[] = json?.items ?? [];

  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>予約一覧</h1>

      <div
        style={{
          overflowX: "auto",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f6f7f8" }}>
              <th style={th}>受付</th>
              <th style={th}>ステータス</th>
              <th style={th}>日付/帯</th>
              <th style={th}>保護者</th>
              <th style={th}>電話</th>
              <th style={th}>子ども</th>
              <th style={th}>作成</th>
              <th style={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={td}>{r.id}</td>
                <td style={td}>
                  <span className={`badge ${r.status}`}>{r.status}</span>
                </td>
                <td style={td}>
                  {r.preferred_date} / {r.time_slot}
                </td>
                <td style={td}>{r.guardian_name}</td>
                <td style={td}>{r.guardian_phone}</td>
                <td style={td}>{r.child_name}</td>
                <td style={td}>
                  {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                </td>
                <td style={td}>
                  <ActionButtons id={r.id} current={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx global>{`
        .badge {
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid #e5e7eb;
          background: #fff;
        }
        .badge.pending {
          color: #92400e;
          background: #fff7ed;
          border-color: #fed7aa;
        }
        .badge.approved {
          color: #065f46;
          background: #ecfdf5;
          border-color: #a7f3d0;
        }
        .badge.rejected {
          color: #991b1b;
          background: #fef2f2;
          border-color: #fecaca;
        }
        .badge.canceled {
          color: #374151;
          background: #f3f4f6;
          border-color: #e5e7eb;
        }
      `}</style>
    </main>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "10px 12px",
  whiteSpace: "nowrap",
};

function ActionButtons({
  id,
  current,
}: {
  id: string;
  current: string;
}) {
  async function setStatus(status: "approved" | "rejected") {
    await fetch(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    location.reload();
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        onClick={() => setStatus("approved")}
        disabled={current === "approved"}
        style={btn("#0ea5e9")}
      >
        承認
      </button>
      <button
        onClick={() => setStatus("rejected")}
        disabled={current === "rejected"}
        style={btn("#ef4444")}
      >
        却下
      </button>
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 8,
    border: "none",
    background: color,
    color: "#fff",
    fontWeight: 700,
    fontSize: 12,
  };
}
