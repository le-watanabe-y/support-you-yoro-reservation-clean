// app/api/export/csv/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Row = {
  id: string;
  created_at: string;
  preferred_date: string; // YYYY-MM-DD
  dropoff_time: string;   // HH:MM
  status: "pending" | "approved" | "rejected" | "canceled";
  guardian_name: string;
  email: string;
  child_name?: string | null;
  child_birthdate?: string | null; // YYYY-MM-DD
};

const ALL_STATUS = ["pending", "approved", "rejected", "canceled"] as const;

function jstString(ts: string) {
  // 例: 2025/11/15 13:05:00
  return new Date(ts).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

// Excel数式誤解釈対策（先頭が = + - @ の場合に ' を付与）
function safeCell(v: any) {
  if (v === null || v === undefined) return "";
  let s = String(v).replace(/\r?\n/g, " ").trim();
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function escCSV(v: any) {
  const s = safeCell(v).replace(/"/g, '""');
  return `"${s}"`;
}
function fileName(start?: string | null, end?: string | null) {
  const base = "reservations";
  if (start && end) return `${base}_${start}_${end}.csv`;
  if (start) return `${base}_${start}.csv`;
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${base}_${y}${m}${day}.csv`;
}

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const start = u.searchParams.get("start");
  const end = u.searchParams.get("end");
  const statusParam = u.searchParams.get("status");

  const statuses = (statusParam
    ? statusParam.split(",").map((s) => s.trim()).filter((s) => (ALL_STATUS as readonly string[]).includes(s))
    : ([] as string[])
  ) as Row["status"][];

  let q = supabaseAdmin
    .from("reservations")
    .select(
      "id, created_at, preferred_date, dropoff_time, status, guardian_name, email, child_name, child_birthdate"
    )
    .order("preferred_date", { ascending: true })
    .order("dropoff_time", { ascending: true })
    .limit(5000);

  // 期間条件
  if (start && end) {
    q = q.gte("preferred_date", start).lte("preferred_date", end);
  } else if (start && !end) {
    q = q.eq("preferred_date", start);
  } else if (!start && end) {
    q = q.eq("preferred_date", end);
  } else {
    // 明示指定が無ければ、当日だけに限定（暴走防止）
    const todayJST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const y = todayJST.getFullYear();
    const m = String(todayJST.getMonth() + 1).padStart(2, "0");
    const d = String(todayJST.getDate()).padStart(2, "0");
    const today = `${y}-${m}-${d}`;
    q = q.eq("preferred_date", today);
  }

  if (statuses.length > 0) {
    q = q.in("status", statuses as any);
  }

  const { data, error } = await q;
  if (error) {
    return new NextResponse(JSON.stringify({ ok: false, message: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const rows = (data ?? []) as Row[];

  const header = [
    "受付番号",
    "受付日時(JST)",
    "利用日",
    "預け希望時刻",
    "ステータス",
    "保護者氏名",
    "メール",
    "お子さま氏名",
    "お子さま生年月日",
  ];
  const lines: string[] = [];
  lines.push(header.map(escCSV).join(","));

  for (const r of rows) {
    lines.push(
      [
        r.id,
        jstString(r.created_at),
        r.preferred_date,
        r.dropoff_time,
        r.status,
        r.guardian_name,
        r.email,
        r.child_name ?? "",
        r.child_birthdate ?? "",
      ]
        .map(escCSV)
        .join(",")
    );
  }

  const csv = "\ufeff" + lines.join("\r\n"); // BOM + CRLF
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName(start, end)}"`,
      "Cache-Control": "no-store",
    },
  });
}
