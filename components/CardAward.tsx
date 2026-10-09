"use client";

import { useState } from "react";

export function CardAward({ studentId, presets, currencyName }: { studentId: string; presets: { id: string; label: string; amount: number }[]; currencyName: string }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function send(awardAmount: number, awardReason: string) {
    if (!Number.isInteger(awardAmount) || awardAmount < 1 || awardAmount > 100000) {
      setStatus("Enter a positive whole-number amount.");
      return;
    }
    if (saving) return;
    setSaving(true);
    setStatus("Saving...");
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ studentIds: [studentId], amount: awardAmount, reason: awardReason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setStatus(`Synced +${awardAmount} ${currencyName}`);
      setAmount("");
      setReason("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  function sendCustom() {
    void send(Number(amount), reason.trim() || "Custom award");
  }

  return <section className="panel p-5">
    <h2 className="text-xl">Quick award</h2>
    <label className="label mt-3">Note (optional)<input className="field" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Add a note if needed" /></label>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">{presets.map((preset) => <button className="btn btn-accent min-h-16 text-left" onClick={() => void send(preset.amount, reason.trim() || preset.label)} disabled={saving} key={preset.id}><strong className="block text-lg">+{preset.amount}</strong><span className="text-sm">{preset.label}</span></button>)}</div>
    <div className="mt-5 border-t border-black/10 pt-5">
      <label className="label">Custom amount<input className="field text-lg" type="number" inputMode="numeric" min="1" max="100000" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendCustom()} placeholder="Enter amount" /></label>
      <button className="btn btn-accent mt-3 w-full text-lg" onClick={sendCustom} disabled={saving}>Add {amount && Number(amount) > 0 ? `+${amount}` : "custom amount"}</button>
    </div>
    <p className="mt-3 min-h-5 text-sm" aria-live="polite">{status}</p>
  </section>;
}
