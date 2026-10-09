import { NextResponse } from "next/server";
import { currentTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { postAwards, ServiceError, undoEntry } from "@/lib/ledger";

export async function POST(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher) return NextResponse.json({ error: "Log in again to sync." }, { status: 401 });
  try {
    const body = await request.json() as { studentIds?: string[]; amount?: number; reason?: string };
    const key = request.headers.get("Idempotency-Key");
    if (!key || !Array.isArray(body.studentIds) || !Number.isInteger(body.amount) || Number(body.amount) <= 0) return NextResponse.json({ error: "Invalid award." }, { status: 400 });
    const award = await postAwards({ teacherId: teacher.id, studentIds: body.studentIds.slice(0, 100), amount: Number(body.amount), reason: String(body.reason ?? "").trim().slice(0, 200), idempotencyKey: key });
    const entries = await db.transaction.findMany({
      where: { createdByTeacherId: teacher.id, idempotencyKey: { in: body.studentIds.slice(0, 100).map((_, index) => `${key}-${index}`) } },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, ...award, transactionIds: entries.map((entry) => entry.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ServiceError ? error.message : "Could not save that award." }, { status: error instanceof ServiceError ? 400 : 500 });
  }
}

export async function DELETE(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher) return NextResponse.json({ error: "Log in again to sync." }, { status: 401 });
  try {
    const body = await request.json() as { transactionIds?: string[] };
    if (!Array.isArray(body.transactionIds) || !body.transactionIds.length || body.transactionIds.length > 100) return NextResponse.json({ error: "Invalid award." }, { status: 400 });
    await Promise.all(body.transactionIds.map((transactionId) => undoEntry(teacher.id, transactionId, crypto.randomUUID())));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ServiceError ? error.message : "Could not undo that award." }, { status: error instanceof ServiceError ? 400 : 500 });
  }
}
