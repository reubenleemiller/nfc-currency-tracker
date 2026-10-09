"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Student = { id: string; displayName: string; balance: number };
type Preset = { id: string; label: string; amount: number };
type Pending = { key: string; studentIds: string[]; amount: number; reason: string; status: "syncing" | "failed" };
type LastAward = Pending & { count: number; transactionIds: string[] };

const CACHE = "nfc-roster-cache";
const QUEUE = "nfc-award-queue";
const VIEW = "nfc-student-view";
export function OptimisticAward({ classroomId, students: initial, presets, symbol }: { classroomId: string; students: Student[]; presets: Preset[]; symbol: string }) {
  const [students, setStudents] = useState(initial);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [slowSyncKeys, setSlowSyncKeys] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [lastAward, setLastAward] = useState<LastAward | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [view, setView] = useState<"cards" | "list">("cards");
  const awardTimer = useRef<number | undefined>(undefined);
  const syncTimers = useRef(new Map<string, number>());

  useEffect(() => {
    const cached = localStorage.getItem(`${CACHE}-${classroomId}`);
    if (cached) setStudents(JSON.parse(cached));
    setStudents(initial);
    localStorage.setItem(`${CACHE}-${classroomId}`, JSON.stringify(initial));
    const queued = JSON.parse(localStorage.getItem(QUEUE) ?? "[]") as Pending[];
    const failed = queued.filter((item) => item.status === "failed");
    setPending(failed);
    setView(localStorage.getItem(VIEW) === "list" ? "list" : "cards");
  }, [classroomId, initial]);

  useEffect(() => {
    const markOnline = () => setMessage("Connection restored. Tap Retry all to sync waiting awards.");
    window.addEventListener("online", markOnline);
    return () => window.removeEventListener("online", markOnline);
  }, []);

  async function send(item: Pending) {
    window.clearTimeout(syncTimers.current.get(item.key));
    syncTimers.current.set(item.key, window.setTimeout(() => {
      setSlowSyncKeys((current) => current.includes(item.key) ? current : [...current, item.key]);
    }, 4000));
    setPending((current) => [...current.filter((row) => row.key !== item.key), { ...item, status: "syncing" }]);
    try {
      const response = await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": item.key }, body: JSON.stringify({ studentIds: item.studentIds, amount: item.amount, reason: item.reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not sync");
      window.clearTimeout(syncTimers.current.get(item.key));
      syncTimers.current.delete(item.key);
      setPending((current) => current.filter((row) => row.key !== item.key));
      setSlowSyncKeys((current) => current.filter((key) => key !== item.key));
      localStorage.setItem(QUEUE, JSON.stringify((JSON.parse(localStorage.getItem(QUEUE) ?? "[]") as Pending[]).filter((row) => row.key !== item.key)));
      setLastAward((current) => current?.key === item.key ? { ...current, transactionIds: result.transactionIds } : current);
      setMessage(`Saved for ${item.studentIds.length} student${item.studentIds.length === 1 ? "" : "s"}.`);
    } catch (error) {
      window.clearTimeout(syncTimers.current.get(item.key));
      syncTimers.current.delete(item.key);
      const failed = { ...item, status: "failed" as const };
      setPending((current) => [...current.filter((row) => row.key !== item.key), failed]);
      const queue = JSON.parse(localStorage.getItem(QUEUE) ?? "[]") as Pending[];
      localStorage.setItem(QUEUE, JSON.stringify([...queue.filter((row) => row.key !== item.key), failed]));
      setMessage(error instanceof Error ? error.message : "Award waiting to retry.");
    }
  }

  async function undoLastAward() {
    if (!lastAward?.transactionIds.length) return;
    const award = lastAward;
    window.clearTimeout(awardTimer.current);
    setLastAward(null);
    setStudents((current) => current.map((student) => award.studentIds.includes(student.id) ? { ...student, balance: student.balance - award.amount } : student));
    try {
      const response = await fetch("/api/transactions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionIds: award.transactionIds }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not undo the award.");
      setMessage("Award removed.");
    } catch (error) {
      setStudents((current) => current.map((student) => award.studentIds.includes(student.id) ? { ...student, balance: student.balance + award.amount } : student));
      setMessage(error instanceof Error ? error.message : "Could not undo the award.");
    }
  }

  function award(awardAmount: number, presetLabel = "") {
    if (!selected.length) return setMessage("Choose at least one student first.");
    const count = selected.length;
    const item: Pending = { key: crypto.randomUUID(), studentIds: selected, amount: awardAmount, reason: reason.trim() || presetLabel, status: "syncing" };
    setStudents((current) => current.map((student) => selected.includes(student.id) ? { ...student, balance: student.balance + awardAmount } : student));
    setLastAward({ ...item, count, transactionIds: [] });
    window.clearTimeout(awardTimer.current);
    awardTimer.current = window.setTimeout(() => setLastAward(null), 4000);
    setSelected([]); setReason(""); setMessage(`Added +${awardAmount} to ${count} student${count === 1 ? "" : "s"}.`); void send(item);
  }

  function awardCustom() {
    const amount = Number(customAmount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) return setMessage("Enter a whole-number award amount.");
    award(amount);
    setCustomAmount("");
  }

  function changeView(nextView: "cards" | "list") {
    setView(nextView);
    localStorage.setItem(VIEW, nextView);
  }

  function toggleStudent(studentId: string) {
    setSelected((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]);
  }

  return <div className="grid gap-5">
    {pending.filter((item) => item.status === "failed" || slowSyncKeys.includes(item.key)).length > 0 && <div className="sticky top-24 z-20 flex items-center justify-between rounded-xl bg-amber-200 p-3 font-bold"><span>{pending.filter((item) => item.status === "failed" || slowSyncKeys.includes(item.key)).length} action{pending.filter((item) => item.status === "failed" || slowSyncKeys.includes(item.key)).length === 1 ? "" : "s"} not synced</span><button className="btn" onClick={() => pending.forEach((item) => void send(item))}>Retry all</button></div>}
    {lastAward && <div className="sticky top-24 z-20 flex items-center justify-between gap-3 rounded-2xl bg-green-700 p-4 text-white shadow-lg" role="status" aria-live="assertive"><div><strong className="block text-2xl">Money added</strong><span className="text-lg">+{symbol}{lastAward.amount} for {lastAward.count} student{lastAward.count === 1 ? "" : "s"}</span></div><button className="btn btn-soft" onClick={() => void undoLastAward()} disabled={!lastAward.transactionIds.length}>Undo</button></div>}
    <div className="panel grid gap-3 p-4 md:sticky md:top-20 md:z-10 md:grid-cols-[1fr_auto]">
      <input className="field" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional note" />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{presets.map((preset) => <button className="btn btn-accent min-h-16 text-left" onClick={() => award(preset.amount, preset.label)} key={preset.id}><strong className="block text-lg">+{preset.amount}</strong><span className="text-sm">{preset.label}</span></button>)}</div>
      <div className="grid grid-cols-[1fr_auto] gap-2"><input className="field" type="number" inputMode="numeric" min="1" step="1" max="100000" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} onKeyDown={(event) => event.key === "Enter" && awardCustom()} placeholder="Custom amount" aria-label="Custom award amount" /><button className="btn" onClick={awardCustom}>Award custom</button></div>
      <div className="grid grid-cols-2 gap-2 md:flex md:justify-end" aria-label="Student view"><button className={`btn ${view === "cards" ? "btn-accent" : "btn-soft"}`} aria-pressed={view === "cards"} onClick={() => changeView("cards")}>Cards</button><button className={`btn ${view === "list" ? "btn-accent" : "btn-soft"}`} aria-pressed={view === "list"} onClick={() => changeView("list")}>List</button></div>
      <p className="text-sm text-slate-600 md:col-span-2">{selected.length} selected · {message || "Choose students, then tap an award."}</p>
    </div>
    {view === "cards" ? <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">{students.map((student) => <div className={`panel relative p-4 transition ${selected.includes(student.id) ? "border-[#e85d43] bg-[#fff0e8] ring-4 ring-[#e85d43]" : ""}`} key={student.id}>{selected.includes(student.id) && <span className="absolute right-3 top-3 rounded-full bg-[#e85d43] px-2 py-1 text-xs font-bold text-white">Selected</span>}<button aria-pressed={selected.includes(student.id)} onClick={() => toggleStudent(student.id)} className="min-h-20 w-full text-left"><span className="block font-bold">{student.displayName}</span><span className="display mt-4 block text-3xl">{symbol}{student.balance}</span></button><Link href={`/app/student/${student.id}`} className="mt-2 inline-block text-xs underline">Details</Link></div>)}</div> : <div className="panel overflow-hidden">{students.map((student) => <div className={`grid grid-cols-[1fr_auto] items-center gap-3 border-b border-black/10 p-3 last:border-0 sm:grid-cols-[1fr_auto_auto] ${selected.includes(student.id) ? "bg-[#fff0e8]" : ""}`} key={student.id}><button aria-pressed={selected.includes(student.id)} onClick={() => toggleStudent(student.id)} className="min-h-12 text-left font-bold"><span className={`mr-3 inline-block h-6 w-6 rounded-md border align-middle ${selected.includes(student.id) ? "border-[#e85d43] bg-[#e85d43]" : "border-black/30"}`} />{student.displayName}</button><span className="display text-2xl">{symbol}{student.balance}</span><Link href={`/app/student/${student.id}`} className="btn btn-soft col-span-2 sm:col-span-1">Details</Link></div>)}</div>}
    {!students.length && <div className="panel p-8 text-center">No active students yet. Add your roster to start awarding.</div>}
  </div>;
}
