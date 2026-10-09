"use client";

import { useMemo, useState } from "react";
import { bulkSetCardStatus } from "@/app/actions";

type CardRow = {
  id: string;
  label: string;
  shortCode: string;
  status: "AVAILABLE" | "ASSIGNED" | "LOST" | "RETIRED";
  studentName: string | null;
  studentClassroom: string | null;
};

const statusNames = { AVAILABLE: "Available", ASSIGNED: "Assigned", LOST: "Lost", RETIRED: "Retired" };

export function BulkCardManager({ cards }: { cards: CardRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState<"ALL" | CardRow["status"]>("ALL");
  const visible = useMemo(() => cards.filter((card) => filter === "ALL" || card.status === filter), [cards, filter]);
  const allVisibleSelected = visible.length > 0 && visible.every((card) => selected.includes(card.id));

  function toggleVisible() {
    setSelected((current) => allVisibleSelected ? current.filter((id) => !visible.some((card) => card.id === id)) : [...new Set([...current, ...visible.map((card) => card.id)])]);
  }

  return <form action={bulkSetCardStatus} className="panel overflow-hidden" onSubmit={(event) => {
    const status = (new FormData(event.currentTarget).get("status") ?? "").toString().toLowerCase();
    if (!window.confirm(`Change ${selected.length} selected card${selected.length === 1 ? "" : "s"} to ${status}? Any current student assignments will end.`)) event.preventDefault();
  }}>
    <div className="grid gap-4 border-b border-black/10 p-5 lg:grid-cols-[1fr_auto_auto] lg:items-end">
      <div><h2 className="text-2xl">Manage the full card set</h2><p className="mt-1 text-sm text-slate-600">Cards are always shown in physical number order. Lost and retired cards cannot be assigned.</p></div>
      <label className="label">Show<select className="field w-full sm:min-w-40" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="ALL">All cards ({cards.length})</option>{Object.entries(statusNames).map(([status, label]) => <option value={status} key={status}>{label} ({cards.filter((card) => card.status === status).length})</option>)}</select></label>
      <button className="btn btn-soft w-full sm:w-auto" type="button" onClick={toggleVisible}>{allVisibleSelected ? "Clear visible" : "Select visible"}</button>
    </div>
    {selected.map((cardId) => <input type="hidden" name="cardIds" value={cardId} key={cardId} />)}
    {selected.length > 0 && <div className="sticky top-28 z-10 grid grid-cols-2 items-center gap-2 border-b-4 border-[#e85d43] bg-[#f9bd72] p-3 shadow-lg sm:top-20 sm:flex sm:flex-wrap"><strong className="col-span-2 mr-auto text-lg sm:col-span-1">{selected.length} card{selected.length === 1 ? "" : "s"} selected</strong><select className="field col-span-2 w-full sm:max-w-48" name="status" required defaultValue=""><option value="" disabled>Bulk action...</option><option value="AVAILABLE">Make available</option><option value="LOST">Mark lost</option><option value="RETIRED">Retire cards</option></select><button className="btn w-full sm:w-auto">Apply</button><button className="btn btn-soft w-full sm:w-auto" type="button" onClick={() => setSelected([])}>Cancel</button></div>}
    <div className="hidden grid-cols-[48px_90px_110px_130px_1fr] gap-3 border-b border-black/10 bg-black/5 px-4 py-2 text-xs font-bold uppercase tracking-wider md:grid"><span /><span>Card</span><span>Code</span><span>Status</span><span>Assigned to</span></div>
    {visible.map((card) => <label className={`grid min-h-20 cursor-pointer grid-cols-[36px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b border-black/10 px-4 py-3 last:border-0 md:min-h-16 md:grid-cols-[48px_90px_110px_130px_minmax(0,1fr)] md:gap-3 ${selected.includes(card.id) ? "border-l-4 border-l-[#e85d43] bg-[#fff0e8] pl-3 font-bold ring-2 ring-inset ring-[#e85d43]" : ""}`} key={card.id}>
      <input className="h-5 w-5 accent-[#e85d43]" type="checkbox" checked={selected.includes(card.id)} onChange={() => setSelected((current) => current.includes(card.id) ? current.filter((id) => id !== card.id) : [...current, card.id])} />
      <strong className="display min-w-0 text-xl md:col-auto">#{card.label}</strong>
      <span className="col-start-2 min-w-0 break-all font-bold tracking-widest md:col-auto md:break-normal">{card.shortCode}</span>
      <span className={`col-start-2 w-fit rounded-full px-3 py-1 text-xs font-bold md:col-auto ${card.status === "ASSIGNED" ? "bg-[#cde7d8]" : card.status === "AVAILABLE" ? "bg-black/10" : card.status === "LOST" ? "bg-amber-200" : "bg-slate-700 text-white"}`}>{statusNames[card.status]}</span>
      <span className="col-start-2 min-w-0 break-words text-sm md:col-auto">{card.studentName ? <><strong>{card.studentName}</strong>{card.studentClassroom && <span className="text-slate-500"> · {card.studentClassroom}</span>}</> : <span className="text-slate-500">No student</span>}</span>
    </label>)}
    {!visible.length && <p className="p-8 text-center">No cards match this filter.</p>}
  </form>;
}
