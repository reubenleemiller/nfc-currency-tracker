"use client";

import { useState } from "react";
import { assignCard, unassignCard } from "@/app/actions";

type AvailableCard = { id: string; label: string; shortCode: string };
type StudentCard = { id: string; label: string; shortCode: string; url: string };
type Student = { id: string; displayName: string; card: StudentCard | null };

export function StudentCardAssignments({ students, availableCards }: { students: Student[]; availableCards: AvailableCard[] }) {
  const [openStudentId, setOpenStudentId] = useState<string | null>(students.find((student) => !student.card)?.id ?? students[0]?.id ?? null);
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);
  const withoutCards = students.filter((student) => !student.card).length;

  async function copyUrl(card: StudentCard) {
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
    setCopiedCardId(card.id);
    window.setTimeout(() => setCopiedCardId((current) => current === card.id ? null : current), 2500);
  }

  return <section className="panel overflow-hidden">
    <div className="border-b border-black/10 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl">Assign cards to students</h2><span className={`rounded-full px-3 py-1 text-sm font-bold ${withoutCards ? "bg-amber-200" : "bg-[#cde7d8]"}`}>{withoutCards} without cards</span></div>
      <p className="mt-1 text-sm text-slate-600">Tap a student to assign, copy, or remove their physical card.</p>
    </div>
    <div>{students.map((student) => {
      const open = openStudentId === student.id;
      return <article className="border-b border-black/10 last:border-0" key={student.id}>
        <button type="button" className={`grid min-h-16 w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left ${open ? "bg-[#fff0e8]" : ""}`} onClick={() => setOpenStudentId(open ? null : student.id)} aria-expanded={open}>
          <span><strong className="block">{student.displayName}</strong><small className={student.card ? "text-green-700" : "text-amber-700"}>{student.card ? `Card #${student.card.label} · ${student.card.shortCode}` : "No card assigned"}</small></span>
          <span className="text-xl" aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        {open && <div className="grid gap-3 border-t border-black/5 bg-white/60 p-4">
          {student.card ? <>
            <div className="rounded-xl bg-[#cde7d8] p-4"><p className="text-sm font-bold uppercase tracking-wider">Assigned physical card</p><p className="display mt-1 text-3xl">Card #{student.card.label}</p><p className="font-bold tracking-[.18em]">{student.card.shortCode}</p></div>
            <p className="truncate text-xs text-slate-500">{student.card.url}</p>
            <div className="grid grid-cols-2 gap-2"><button type="button" className={`btn ${copiedCardId === student.card.id ? "bg-green-700" : "btn-accent"}`} onClick={() => void copyUrl(student.card!)}>{copiedCardId === student.card.id ? "Copied!" : "Copy NFC URL"}</button><form action={unassignCard} onSubmit={(event) => { if (!window.confirm(`Remove Card #${student.card?.label} from ${student.displayName}? The card will become available.`)) event.preventDefault(); }}><input type="hidden" name="studentId" value={student.id} /><button className="btn btn-soft w-full">Remove card</button></form></div>
          </> : <form action={assignCard} className="grid gap-2 sm:grid-cols-[1fr_auto]"><input type="hidden" name="studentId" value={student.id} /><label className="label">Available physical card<select className="field" name="cardId" required><option value="">Choose a card...</option>{availableCards.map((card) => <option value={card.id} key={card.id}>Card #{card.label} · {card.shortCode}</option>)}</select></label><button className="btn btn-accent self-end" disabled={!availableCards.length}>Assign card</button>{!availableCards.length && <p className="text-sm text-amber-700 sm:col-span-2">No cards are available. Generate more cards or remove one from another student.</p>}</form>}
        </div>}
      </article>;
    })}</div>
    {!students.length && <p className="p-8 text-center">Add students to this classroom before assigning cards.</p>}
  </section>;
}
