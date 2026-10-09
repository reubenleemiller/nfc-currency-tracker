import Link from "next/link";
import { undo } from "@/app/actions";
import { currentTeacher } from "@/lib/auth";
import { resolveCard } from "@/lib/cards";
import { db } from "@/lib/db";
import { CardAward } from "@/components/CardAward";

export const dynamic = "force-dynamic";

export default async function CardView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await resolveCard(token);
  if (!result) return <main className="grid min-h-screen place-items-center p-5"><div className="panel max-w-md p-8 text-center"><p className="font-bold text-[#e85d43]">NFC Currency Tracker</p><h1 className="mt-3 text-3xl">This card isn’t assigned yet</h1><p className="mt-3 text-slate-600">Ask your teacher to assign or replace this card.</p></div></main>;

  const teacher = await currentTeacher();
  const [transactions, balanceResult, store, presets] = await Promise.all([
    db.transaction.findMany({ where: { studentId: result.student.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.transaction.aggregate({ where: { studentId: result.student.id }, _sum: { amount: true } }),
    db.storeItem.findMany({ where: { teacherId: result.student.teacherId, active: true, OR: [{ stock: null }, { stock: { gt: 0 } }] }, orderBy: { sortOrder: "asc" } }),
    db.awardPreset.findMany({ where: { classroomId: result.student.classroomId! }, orderBy: { sortOrder: "asc" } }),
  ]);
  const total = balanceResult._sum.amount ?? 0;
  const classroom = result.student.classroom!;
  const ownTeacher = teacher?.id === result.student.teacherId;

  return <main className="mx-auto grid min-h-screen max-w-xl gap-5 p-4 py-8">
    <section className="overflow-hidden rounded-[2rem] bg-[#23312c] p-7 text-white"><p className="font-bold text-[#f9bd72]">{classroom.name}</p><h1 className="mt-2 text-3xl">{result.student.displayName}</h1><p className="display mt-8 text-7xl text-[#f9bd72]">{classroom.currencySymbol}{total}</p><p>{classroom.currencyName}</p></section>
    {ownTeacher && <CardAward studentId={result.student.id} presets={presets} currencyName={classroom.currencyName} />}
    {ownTeacher && <Link className="btn" href={`/app/student/${result.student.id}`}>Open full teacher controls</Link>}
    <section className="panel overflow-hidden"><h2 className="p-5 text-xl">Recent activity</h2>{transactions.map((entry) => <div className="flex justify-between border-t border-black/10 p-4" key={entry.id}><div>{entry.reason && <strong>{entry.reason}</strong>}<p className="text-sm text-slate-500">{entry.createdAt.toLocaleDateString()}</p></div><div className="text-right"><span className={entry.amount > 0 ? "text-green-700" : "text-red-700"}>{entry.amount > 0 ? "+" : ""}{entry.amount}</span>{ownTeacher && <form action={undo}><input type="hidden" name="transactionId" value={entry.id} /><button className="mt-1 block text-xs underline">Undo</button></form>}</div></div>)}</section>
    <section className="panel p-5"><h2 className="text-xl">Account store</h2>{store.length ? <div className="mt-3 grid gap-2">{store.map((item) => <div className="flex justify-between" key={item.id}><span>{item.name}</span><strong>{classroom.currencySymbol}{item.price}</strong></div>)}</div> : <p className="mt-2 text-slate-600">No store items are available.</p>}</section>
  </main>;
}
