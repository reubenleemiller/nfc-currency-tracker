import { saveStoreItem } from "@/app/actions";
import { requireTeacher } from "@/lib/auth";
import { ownedClassroom } from "@/lib/classes";
import { db } from "@/lib/db";

export default async function Store({ params, searchParams }: { params: Promise<{ classroomId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const teacher = await requireTeacher();
  const { classroomId } = await params;
  const classroom = await ownedClassroom(teacher.id, classroomId);
  const items = await db.storeItem.findMany({ where: { teacherId: teacher.id }, orderBy: { sortOrder: "asc" } });
  const saved = (await searchParams).saved === "1";

  return <div className="grid gap-6">
    <div className="flex flex-wrap items-end justify-between"><div><p className="font-bold text-[#e85d43]">Shared across your classes</p><h1 className="text-4xl">Account store</h1></div>{!classroom.archived && <a className="btn btn-accent" href={`/app/class/${classroomId}/checkout`}>Start checkout for {classroom.name}</a>}</div>
    {saved && <div className="rounded-xl bg-[#cde7d8] p-4 font-bold text-green-900" role="status">Store item saved.</div>}
    <form action={saveStoreItem} className="panel grid gap-3 p-5 md:grid-cols-[1fr_120px_160px_auto]"><input type="hidden" name="returnTo" value={`/app/class/${classroomId}/store`} /><label className="label">Item name<input className="field" name="name" placeholder="e.g. Homework pass" required /></label><label className="label">Price<input className="field" name="price" type="number" min="1" placeholder="Cost" required /></label><label className="label">Stock available<input className="field" name="stock" type="number" min="1" placeholder="Unlimited" /></label><button className="btn self-end">Add item</button></form>
    <section className="grid gap-3">
      <div className="hidden grid-cols-[70px_minmax(0,1fr)_120px_160px_120px_auto] items-center gap-3 border-b-2 border-[#23312c] px-4 pb-2 text-xs font-bold uppercase tracking-wider text-slate-600 md:grid"><span>Order</span><span>Item name</span><span>Price</span><span>Stock available</span><span>Available to sell</span><span>Action</span></div>
      {items.map((item, index) => <form action={saveStoreItem} className={`panel grid items-end gap-3 p-4 md:grid-cols-[70px_minmax(0,1fr)_120px_160px_120px_auto] ${!item.active ? "opacity-60" : ""}`} key={item.id}><input type="hidden" name="itemId" value={item.id} /><input type="hidden" name="returnTo" value={`/app/class/${classroomId}/store`} /><span className="display self-center text-2xl" aria-label={`Display order ${index + 1}`}>{index + 1}</span><label className="label md:hidden">Item name</label><input className="field" name="name" defaultValue={item.name} required /><label className="label md:hidden">Price</label><input className="field" name="price" type="number" min="1" defaultValue={item.price} required /><label className="label md:hidden">Stock available</label><input className="field" name="stock" type="number" min="1" defaultValue={item.stock ?? ""} placeholder="Unlimited" /><label className="label md:hidden">Available to sell</label><select className="field" name="active" defaultValue={String(item.active)}><option value="true">Available</option><option value="false">Hidden</option></select><button className="btn btn-soft">Save</button></form>)}
    </section>
  </div>;
}
