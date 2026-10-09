import Link from "next/link";
import { autoAssign, createCardBatch, resetAssignments } from "@/app/actions";
import { requireTeacher } from "@/lib/auth";
import { ownedClassroom } from "@/lib/classes";
import { db } from "@/lib/db";
import { BulkCardManager } from "@/components/BulkCardManager";
import { StudentCardAssignments } from "@/components/StudentCardAssignments";
import { cardUrl } from "@/lib/cards";

export default async function Cards({ params }: { params: Promise<{ classroomId: string }> }) {
  const teacher = await requireTeacher(); const { classroomId } = await params; const classroom = await ownedClassroom(teacher.id, classroomId);
  const [students, cards] = await Promise.all([
    db.student.findMany({ where: { teacherId: teacher.id, classroomId, active: true }, orderBy: { displayName: "asc" }, include: { assignments: { where: { endedAt: null }, include: { card: true } } } }),
    db.card.findMany({ where: { teacherId: teacher.id }, include: { assignments: { where: { endedAt: null }, include: { student: { include: { classroom: true } } } } } }),
  ]);
  cards.sort((first, second) => Number(first.label) - Number(second.label) || first.label.localeCompare(second.label, undefined, { numeric: true }));
  const available = cards.filter((card) => card.status === "AVAILABLE");
  const counts = { available: cards.filter((card) => card.status === "AVAILABLE").length, assigned: cards.filter((card) => card.status === "ASSIGNED").length, lost: cards.filter((card) => card.status === "LOST").length, retired: cards.filter((card) => card.status === "RETIRED").length };
  return <div className="grid gap-6"><div><p className="font-bold text-[#e85d43]">Reusable card set</p><h1 className="text-4xl">Cards for {classroom.name}</h1><p className="mt-2 max-w-3xl text-slate-600">A permanent URL belongs to each numbered card, not to a student. Write Card #1’s URL to physical Card #1 once. When you assign Card #1 below, that same URL immediately opens the assigned student. Reassigning it later requires no NFC rewrite.</p></div>
    <div className="panel grid gap-3 p-5 md:grid-cols-2"><Link className="rounded-xl bg-[#fff0e8] p-4" href={`/app/class/${classroomId}/cards/encoding`}><strong className="block text-lg">1. Write NFC cards</strong><span className="text-sm">Copy each URL into NFC Tools and write the matching physical card.</span></Link><div className="rounded-xl bg-[#cde7d8] p-4"><strong className="block text-lg">2. Assign students</strong><span className="text-sm">Choose the numbered card beside each student below.</span></div></div>
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4"><div className="panel p-4"><p className="text-sm text-slate-500">Available</p><p className="display text-3xl">{counts.available}</p></div><div className="panel p-4"><p className="text-sm text-slate-500">Assigned</p><p className="display text-3xl">{counts.assigned}</p></div><div className="panel p-4"><p className="text-sm text-slate-500">Lost</p><p className="display text-3xl">{counts.lost}</p></div><div className="panel p-4"><p className="text-sm text-slate-500">Retired</p><p className="display text-3xl">{counts.retired}</p></div></section>
    {!classroom.archived && <form action={createCardBatch} className="panel flex flex-wrap items-end gap-3 p-5"><label className="label">New cards<input className="field max-w-32" type="number" name="count" min="1" max="200" defaultValue="30" required /></label><button className="btn btn-accent">Generate card set</button><span className="text-sm text-slate-600">Permanent tokens and labels continue from the highest existing number.</span></form>}
    <StudentCardAssignments students={students.map((student) => { const card = student.assignments[0]?.card; return { id: student.id, displayName: student.displayName, card: card ? { id: card.id, label: card.label, shortCode: card.shortCode, url: cardUrl(card.token) } : null }; })} availableCards={available.map((card) => ({ id: card.id, label: card.label, shortCode: card.shortCode }))} />
    {!classroom.archived && <div className="flex flex-wrap gap-3"><form action={autoAssign}><input type="hidden" name="classroomId" value={classroomId} /><button className="btn btn-accent">Sequential auto-assign</button></form><form action={resetAssignments}><input type="hidden" name="classroomId" value={classroomId} /><button className="btn bg-red-700">End all assignments in this class</button></form></div>}
    <BulkCardManager cards={cards.map((card) => ({ id: card.id, label: card.label, shortCode: card.shortCode, status: card.status, studentName: card.assignments[0]?.student.displayName ?? null, studentClassroom: card.assignments[0]?.student.classroom?.name ?? null }))} />
  </div>;
}
