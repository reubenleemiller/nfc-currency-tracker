import { currentTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
export async function GET(_request: Request, { params }: { params: Promise<{ classroomId: string }> }) {
  const teacher = await currentTeacher(); if (!teacher) return new NextResponse("Not found", { status: 404 });
  const { classroomId } = await params; const classroom = await db.classroom.findFirst({ where: { id: classroomId, teacherId: teacher.id } });
  if (!classroom) return new NextResponse("Not found", { status: 404 });
  const entries = await db.transaction.findMany({ where: { classroomId, createdByTeacherId: teacher.id }, include: { student: true }, orderBy: { createdAt: "desc" } });
  const csv = ["Date,Student,Amount,Kind,Reason", ...entries.map((row) => [row.createdAt.toISOString(), row.student.displayName, row.amount, row.kind, row.reason].map(csvCell).join(","))].join("\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${classroom.name.replace(/[^a-z0-9]/gi, "-")}-transactions.csv"` } });
}
