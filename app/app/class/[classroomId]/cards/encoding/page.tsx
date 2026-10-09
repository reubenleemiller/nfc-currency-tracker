import { requireTeacher } from "@/lib/auth";
import { ownedClassroom } from "@/lib/classes";
import { cardUrl } from "@/lib/cards";
import { db } from "@/lib/db";
import { CardEncodingList } from "@/components/CardEncodingList";

export default async function Encoding({ params }: { params: Promise<{ classroomId: string }> }) {
  const teacher = await requireTeacher(); const { classroomId } = await params; const classroom = await ownedClassroom(teacher.id, classroomId);
  const cards = await db.card.findMany({ where: { teacherId: teacher.id }, include: { assignments: { where: { endedAt: null }, take: 1, include: { student: true } } } });
  const orderedCards = [...cards].sort((first, second) => {
    const firstInClass = first.assignments[0]?.student.classroomId === classroomId ? 0 : first.status === "AVAILABLE" ? 1 : 2;
    const secondInClass = second.assignments[0]?.student.classroomId === classroomId ? 0 : second.status === "AVAILABLE" ? 1 : 2;
    return firstInClass - secondInClass || Number(first.label) - Number(second.label) || first.label.localeCompare(second.label, undefined, { numeric: true });
  });
  return <div className="grid gap-5">
    <div><p className="font-bold text-[#e85d43]">{classroom.name}</p><h1 className="text-4xl">Write your NFC cards</h1><p className="mt-2 max-w-3xl">On your iPhone, tap <strong>Copy URL</strong>, switch to NFC Tools, create a URL record, paste, and write it to the matching numbered card. Each physical card is written only once.</p></div>
    <ol className="panel grid gap-3 p-5 md:grid-cols-3"><li><strong>1. Match the number</strong><br /><span className="text-sm text-slate-600">Pick the physical card matching the label shown here.</span></li><li><strong>2. Copy and write</strong><br /><span className="text-sm text-slate-600">Copy its URL and paste it into NFC Tools.</span></li><li><strong>3. Test, then assign</strong><br /><span className="text-sm text-slate-600">Test the link before locking the tag, then assign that card to a student.</span></li></ol>
    <div className="flex flex-wrap gap-2"><a className="btn" href={`/app/class/${classroomId}/cards`}>Assign cards</a><a className="btn btn-soft" href="/api/cards.csv">Download all as CSV</a></div>
    <CardEncodingList cards={orderedCards.map((card) => ({ id: card.id, label: card.label, shortCode: card.shortCode, url: cardUrl(card.token), studentName: card.assignments[0]?.student.displayName ?? null, status: card.status }))} />
  </div>;
}
