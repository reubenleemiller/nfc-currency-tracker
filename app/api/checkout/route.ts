import { NextResponse } from "next/server";
import { currentTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkout, ServiceError } from "@/lib/ledger";

export async function POST(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher) return NextResponse.json({ error: "Log in again to complete checkout." }, { status: 401 });

  try {
    const body = await request.json() as { studentId?: string; itemIds?: string[]; idempotencyKey?: string };
    if (!body.studentId || !Array.isArray(body.itemIds) || !body.itemIds.length || !body.idempotencyKey) {
      return NextResponse.json({ error: "Choose a student and at least one item." }, { status: 400 });
    }
    const itemIds = [...new Set(body.itemIds)].slice(0, 100);
    await checkout({ teacherId: teacher.id, studentId: body.studentId, items: itemIds.map((id) => ({ id, quantity: 1 })), idempotencyKey: body.idempotencyKey });
    const student = await db.student.findFirst({ where: { id: body.studentId, teacherId: teacher.id }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student is unavailable." }, { status: 400 });
    const items = await db.storeItem.findMany({ where: { teacherId: teacher.id }, select: { id: true, stock: true } });
    const balance = await db.transaction.aggregate({ where: { studentId: student.id }, _sum: { amount: true } });
    return NextResponse.json({ ok: true, items, studentId: student.id, balance: balance._sum.amount ?? 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ServiceError ? error.message : "Checkout could not be completed. Please try again." }, { status: error instanceof ServiceError ? 400 : 500 });
  }
}
