import Link from "next/link";
import { createClassroom, deleteYear } from "@/app/actions";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClassroomActions } from "@/components/ClassroomActions";

export default async function Dashboard() {
  const teacher = await requireTeacher();
  const classes = await db.classroom.findMany({ where: { teacherId: teacher.id }, orderBy: [{ archived: "asc" }, { name: "asc" }], include: { _count: { select: { students: true } }, transactions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } } });
  const years = [...new Set(classes.map((room) => room.schoolYear))];
  return <div className="grid gap-8">
    <section><p className="font-bold uppercase tracking-[.18em] text-[#e85d43]">Your classrooms</p><h1 className="mt-2 text-4xl md:text-6xl">Where are we learning?</h1></section>
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {classes.filter((room) => !room.archived).map((room) => <article className="panel p-6" key={room.id}><Link className="group block hover:text-[#e85d43]" href={`/app/class/${room.id}`}><p className="text-sm text-slate-500">{room.schoolYear}</p><h2 className="mt-2 text-2xl">{room.name}</h2><p className="mt-6">{room._count.students} student{room._count.students === 1 ? "" : "s"}</p><p className="mt-1 text-sm text-slate-500">{room.transactions[0] ? `Last activity ${room.transactions[0].createdAt.toLocaleDateString()}` : "No activity yet"} · {room.currencyName}</p></Link></article>)}
      {!classes.some((room) => !room.archived) && <div className="panel p-6">No active classrooms yet. Create one below.</div>}
    </section>
    <details className="panel p-5"><summary className="cursor-pointer text-lg font-bold">Create a classroom</summary><form action={createClassroom} className="mt-5 grid gap-4 md:grid-cols-5"><input className="field" name="name" placeholder="Class name" required /><input className="field" name="schoolYear" placeholder="2026-2027" required /><input className="field" name="currencyName" defaultValue="Class Bucks" required /><input className="field" name="currencySymbol" defaultValue="$" maxLength={4} required /><button className="btn btn-accent">Create</button></form></details>
    <details className="panel p-5"><summary className="cursor-pointer text-lg font-bold">Archived classrooms & school years</summary><div className="mt-5 grid gap-4">
       {classes.filter((room) => room.archived).map((room) => <article className="rounded-xl bg-black/5 p-4" key={room.id}><Link className="font-bold hover:text-[#e85d43]" href={`/app/class/${room.id}`}>{room.name} · {room.schoolYear}</Link></article>)}
      </div></details>
      <details className="panel p-5"><summary className="cursor-pointer text-lg font-bold">End-of-year tools</summary><p className="mt-3 text-sm text-slate-600">Archive, restore, or permanently delete individual classes here. Deleting a school year permanently removes every class in that year.</p><div className="mt-5 grid gap-4"><section><h2 className="text-lg font-bold">Individual classes</h2><div className="mt-3 grid gap-3">{classes.map((room) => <div className="grid gap-3 rounded-xl border border-black/10 p-4 md:grid-cols-[1fr_auto]" key={room.id}><div><strong>{room.name}</strong><p className="mt-1 text-sm text-slate-600">{room.schoolYear} · {room.archived ? "Archived" : "Active"}</p></div><ClassroomActions classroomId={room.id} classroomName={room.name} archived={room.archived} /></div>)}</div></section><section><h2 className="text-lg font-bold">School years</h2><div className="mt-3 grid gap-4">{years.map((year) => <div className="grid gap-3 rounded-xl border border-black/10 p-4 md:grid-cols-[1fr_auto]" key={year}><strong>{year}</strong><form action={deleteYear} className="grid gap-2 sm:grid-cols-[1fr_auto]"><input type="hidden" name="schoolYear" value={year} /><input className="field" name="confirmation" placeholder={`DELETE ${year}`} required /><button className="btn bg-red-700">Delete all classes</button></form></div>)}</div></section></div></details>
  </div>;
}
