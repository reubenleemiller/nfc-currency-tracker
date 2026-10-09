import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export async function ownedClassroom(teacherId: string, classroomId: string) {
  const classroom = await db.classroom.findFirst({ where: { id: classroomId, teacherId } });
  if (!classroom) notFound();
  return classroom;
}
