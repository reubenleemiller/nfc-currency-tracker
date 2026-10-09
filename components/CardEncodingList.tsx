"use client";

import { useState } from "react";

type CardLink = {
  id: string;
  label: string;
  shortCode: string;
  url: string;
  studentName: string | null;
  status: string;
};

export function CardEncodingList({ cards }: { cards: CardLink[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copy(card: CardLink) {
    try {
      await navigator.clipboard.writeText(card.url);
    } catch {
      const input = document.createElement("textarea");
      input.value = card.url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopiedId(card.id);
    window.setTimeout(() => setCopiedId((current) => current === card.id ? null : current), 2500);
  }

  return <div className="grid gap-3">
    {cards.map((card) => <article className="panel grid gap-4 p-4 sm:grid-cols-[110px_1fr] sm:items-center md:grid-cols-[110px_1fr_auto]" key={card.id}>
      <div>
        <p className="display text-3xl">Card #{card.label}</p>
        <p className="font-bold tracking-[.18em] text-[#e85d43]">{card.shortCode}</p>
      </div>
      <div className="min-w-0">
        <p className="font-bold">{card.studentName ? `Assigned to ${card.studentName}` : card.status === "AVAILABLE" ? "Available to assign" : card.status}</p>
        <p className="mt-1 truncate text-sm text-slate-500">{card.url}</p>
        <p className="mt-1 text-xs text-slate-500">This URL always belongs to Card #{card.label}. Reassigning the card changes the student it opens.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:col-span-2 md:col-span-1 md:grid-cols-1">
        <button className={`btn ${copiedId === card.id ? "bg-green-700" : "btn-accent"}`} onClick={() => void copy(card)}>{copiedId === card.id ? "Copied!" : "Copy URL"}</button>
        <a className="btn btn-soft" href={card.url} target="_blank" rel="noreferrer">Test link</a>
      </div>
    </article>)}
    {!cards.length && <div className="panel p-8 text-center">No cards exist yet. Generate a card set first.</div>}
  </div>;
}
