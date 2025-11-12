"use client";

import React, { useState } from "react";

export default function ReservationForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // まずは見た目確認だけ（保存は次ステップ）
    alert(
      `送信テスト：\nお名前: ${name}\n電話: ${phone}\n日付: ${date}\n時間: ${time}\nメモ: ${notes}`
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.6rem",
    border: "1px solid #ccc",
    borderRadius: 6,
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "1rem", maxWidth: 480 }}>
      <label>
        お名前
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        お電話番号
        <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <label>
          日付
          <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          時間
          <input style={inputStyle} type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
      </div>
      <label>
        メモ（任意）
        <textarea style={inputStyle} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <button
        type="submit"
        style={{
          padding: "0.8rem 1.2rem",
          border: "none",
          borderRadius: 6,
          background: "#0ea5e9",
          color: "white",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        送信（テスト）
      </button>
    </form>
  );
}
