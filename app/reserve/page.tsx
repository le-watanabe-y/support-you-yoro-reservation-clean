"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// 時刻プルダウン
function generateTimes(start = "08:00", end = "18:00", stepMin = 30): string[] {
  const toMin = (hhmm: string) => { const [h,m] = hhmm.split(":").map(Number); return h*60+(m||0); };
  const pad = (n: number) => String(n).padStart(2,"0");
  const toHHMM = (m: number) => `${pad(Math.floor(m/60))}:${pad(m%60)}`;
  const out: string[] = []; for (let m=toMin(start); m<=toMin(end); m+=stepMin) out.push(toHHMM(m)); return out;
}
const TIME_OPTIONS = generateTimes("08:00","18:00",30);

// JST & 正午ルール
function nowJST(): Date { return new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Tokyo"})); }
function ymd(d: Date){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const dd=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${dd}`; }
function addDays(d: Date,n:number){ const c=new Date(d); c.setDate(c.getDate()+n); return c; }
function currentPreferredDate(): string { const n=nowJST(); return n.getHours()<12? ymd(n): ymd(addDays(n,1)); }

export default function ReservePage() {
  const router = useRouter();
  const preferredDate = useMemo(()=>currentPreferredDate(),[]);
  const [guardianName,setGuardianName]=useState("");
  const [email,setEmail]=useState("");
  const [childName,setChildName]=useState("");
  const [childBirthdate,setChildBirthdate]=useState("");
  const [dropoffTime,setDropoffTime]=useState(TIME_OPTIONS[0]);
  const [submitting,setSubmitting]=useState(false);
  const [message,setMessage]=useState<string|null>(null);

  useEffect(()=>{ // 直近の30分刻みに寄せる
    const n=nowJST(); const hh=String(n.getHours()).padStart(2,"0"); const mm=n.getMinutes()<30?"00":"30";
    const base=`${hh}:${mm}`; const found=TIME_OPTIONS.find(t=>t>=base); if(found) setDropoffTime(found);
  },[]);

  async function onSubmit(e: React.FormEvent){
    e.preventDefault(); setSubmitting(true); setMessage(null);
    try{
      const res=await fetch("/api/reservations",{ method:"POST", headers:{ "Content-Type":"application/json" }, cache:"no-store",
        body:JSON.stringify({
          guardianName, email, childName, childBirthdate: childBirthdate||null,
          preferredDate, dropoffTime
        })
      });
      const json=await res.json().catch(()=>({}));
      if(!res.ok || !json?.ok){ setMessage(json?.message||"送信に失敗しました"); }
      else{
        const status = json?.status==="approved" ? "approved" : "pending";
        router.push(`/reserve/thanks?status=${status}`);
        return;
      }
    }catch(err:any){ setMessage(err?.message||"送信エラーが発生しました"); }
    finally{ setSubmitting(false); }
  }

  const noonHint="前日12:00〜24:00は翌日分のみ、00:00〜12:00は当日分のみ受付です（翌日予約は正午12:00から可能）。";

  return (
    <main style={styles.wrap}>
      <h1 style={styles.h1}>病児保育 予約</h1>
      <div style={styles.notice}>
        <div><strong>対象日：</strong><span style={{fontWeight:700}}>{preferredDate}</span></div>
        <div style={{fontSize:13,color:"#4b5563",marginTop:4}}>{noonHint}</div>
      </div>

      <form onSubmit={onSubmit} style={styles.form}>
        <label style={styles.label}>保護者氏名（必須）
          <input style={styles.input} value={guardianName} onChange={e=>setGuardianName(e.target.value)} required placeholder="山田 太郎"/>
        </label>

        <label style={styles.label}>メールアドレス（必須）
          <input style={styles.input} value={email} onChange={e=>setEmail(e.target.value)} required placeholder="example@example.com" type="email" inputMode="email"/>
        </label>

        <label style={styles.label}>お子さま氏名
          <input style={styles.input} value={childName} onChange={e=>setChildName(e.target.value)} placeholder="山田 花子"/>
        </label>

        <label style={styles.label}>お子さま生年月日
          <input style={styles.input} value={childBirthdate} onChange={e=>setChildBirthdate(e.target.value)} type="date" placeholder="YYYY-MM-DD"/>
        </label>

        <label style={styles.label}>預け希望時刻（プルダウン）
          <select style={styles.select} value={dropoffTime} onChange={e=>setDropoffTime(e.target.value)} required>
            {TIME_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <button type="submit" disabled={submitting} style={styles.submit}>{submitting?"送信中…":"予約を送信"}</button>
        {message && <p style={styles.message}>{message}</p>}
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap:{maxWidth:560,margin:"24px auto",padding:"16px"},
  h1:{fontSize:20,fontWeight:800,marginBottom:12},
  notice:{background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:12,padding:"12px 14px",marginBottom:16},
  form:{display:"grid",gap:14},
  label:{display:"grid",gap:6,fontSize:14,fontWeight:600},
  input:{height:44,padding:"0 12px",fontSize:16,border:"1px solid #e5e7eb",borderRadius:10},
  select:{height:44,padding:"0 12px",fontSize:16,border:"1px solid #e5e7eb",borderRadius:10,background:"#fff"},
  submit:{height:48,background:"#00A5E2",color:"#fff",border:0,borderRadius:12,fontWeight:700,fontSize:16},
  message:{marginTop:8,color:"#0F766E",fontWeight:700}
};
