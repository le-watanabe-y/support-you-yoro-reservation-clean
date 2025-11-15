// app/api/export/people-csv/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Row = {
  id: string;
  created_at: string;
  preferred_date: string;
  guardian_name: string;
  email: string;
  child_name?: string | null;
  child_birthdate?: string | null;
};

function safeCell(v: any) {
  if (v === null || v === undefined) return "";
  let s = String(v).replace(/\r?\n/g, " ").trim();
  if (/^[=+\-@]/.test(s)) s = "'" + s; // Excel数式対策
  return s;
}
function escCSV(v: any) {
  const s = safeCell(v).replace(/"/g, '""');
  return `"${s}"`;
}
function fileName(start?: string | null, end?: string | null) {
  const base = "people";
  if (start && end) return `${base}_${start}_${end}.csv`;
  if (start) return `${base}_${start}.csv`;
  return `${base}.csv`;
}

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const start = u.searchParams.get("start");
  const end   = u.searchParams.get("end");
  const q     = (u.searchParams.get("q") || "").toLowerCase();

  let query = supabaseAdmin
    .from("reservations")
    .select("id, created_at, preferred_date, guardian_name, email, child_name, child_birthdate")
    .order("preferred_date", { ascending: true })
    .limit(10000);

  if (start) query = query.gte("preferred_date", start);
  if (end)   query = query.lte("preferred_date", end);

  const { data, error } = await query;
  if (error) {
    return new NextResponse(JSON.stringify({ ok: false, message: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  let rows = (data ?? []) as Row[];

  if (q) {
    rows = rows.filter((r) =>
      (r.guardian_name ?? "").toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q) ||
      (r.child_name ?? "").toLowerCase().includes(q)
    );
  }

  // email+guardian_name 単位で集計
  type PersonAgg = {
    guardian_name: string;
    email: string;
    children: Map<string, { name: string; birthdate?: string | null }>;
    first: string;
    last: string;
    count: number;
  };
  const map = new Map<string, PersonAgg>();

  for (const r of rows) {
    const emailKey = (r.email ?? "").toLowerCase();
    const nameKey  = r.guardian_name ?? "";
    const key = `${emailKey}|${nameKey}`;

    if (!map.has(key)) {
      map.set(key, {
        guardian_name: r.guardian_name ?? "",
        email: r.email ?? "",
        children: new Map(),
        first: r.preferred_date,
        last: r.preferred_date,
        count: 0,
      });
    }
    const p = map.get(key)!;
    p.count += 1;
    if (r.preferred_date < p.first) p.first = r.preferred_date;
    if (r.preferred_date > p.last)  p.last  = r.preferred_date;

    const cname = (r.child_name ?? "").trim();
    const cb = r.child_birthdate ?? "";
    if (cname) {
      const ckey = `${cname}|${cb}`;
      if (!p.children.has(ckey)) p.children.set(ckey, { name: cname, birthdate: r.child_birthdate ?? null });
    }
  }

  const header = [
    "保護者氏名",
    "メール",
    "お子さま数",
    "お子さま一覧",
    "初回利用日",
    "最終利用日",
    "予約件数",
  ];
  const lines: string[] = [];
  lines.push(header.map(escCSV).join(","));

  const people = Array.from(map.values()).sort((a, b) =>
    (a.guardian_name || "").localeCompare(b.guardian_name || "")
  );
  for (const p of people) {
    const childrenArr = Array.from(p.children.values()).map((c) =>
      c.birthdate ? `${c.name}(${c.birthdate})` : c.name
    );
    lines.push(
      [
        p.guardian_name || "（未入力）",
        p.email || "（未入力）",
        String(childrenArr.length),
        childrenArr.join("; "),
        p.first,
        p.last,
        String(p.count),
      ].map(escCSV).join(",")
    );
  }

  const csv = "\ufeff" + lines.join("\r\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName(start, end)}"`,
      "Cache-Control": "no-store",
    },
  });
}
