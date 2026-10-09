import { Prisma, TransactionKind } from "@prisma/client";
import { db } from "@/lib/db";

export class ServiceError extends Error {}

export async function balance(studentId: string, client: Prisma.TransactionClient | typeof db = db) {
  const result = await client.transaction.aggregate({ where: { studentId }, _sum: { amount: true } });
  return result._sum.amount ?? 0;
}

export async function balancesByStudent(studentIds: string[]) {
  if (!studentIds.length) return new Map<string, number>();
  const totals = await db.transaction.groupBy({
    by: ["studentId"],
    where: { studentId: { in: studentIds } },
    _sum: { amount: true },
  });
  return new Map(totals.map((total) => [total.studentId, total._sum.amount ?? 0]));
}

type Entry = {
  teacherId: string;
  studentId: string;
  amount: number;
  reason: string;
  kind: TransactionKind;
  idempotencyKey: string;
};

type Award = Omit<Entry, "studentId" | "kind"> & { studentIds: string[] };

export async function postAwards(input: Award) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new ServiceError("Amount must be a positive whole number.");
  const studentIds = [...new Set(input.studentIds)];
  if (!studentIds.length) throw new ServiceError("Choose at least one student.");

  return db.$transaction(async (tx) => {
    const students = await tx.student.findMany({
      where: { id: { in: studentIds }, teacherId: input.teacherId, active: true },
      include: { classroom: true },
    });
    if (students.length !== studentIds.length || students.some((student) => !student.classroom || student.classroom.archived)) {
      throw new ServiceError("One or more students are unavailable.");
    }

    const keys = studentIds.map((_, index) => `${input.idempotencyKey}-${index}`);
    const previous = await tx.transaction.findMany({
      where: { createdByTeacherId: input.teacherId, idempotencyKey: { in: keys } },
      select: { idempotencyKey: true },
    });
    const completed = new Set(previous.map((entry) => entry.idempotencyKey));
    const studentById = new Map(students.map((student) => [student.id, student]));
    const entries = studentIds.flatMap((studentId, index) => {
      const idempotencyKey = keys[index];
      if (completed.has(idempotencyKey)) return [];
      const student = studentById.get(studentId)!;
      return [{ studentId, classroomId: student.classroomId!, amount: input.amount, reason: input.reason.trim(), kind: "AWARD" as const, createdByTeacherId: input.teacherId, idempotencyKey }];
    });
    if (entries.length) await tx.transaction.createMany({ data: entries });
    return { awarded: studentIds.length };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function postEntry(input: Entry) {
  if (!Number.isInteger(input.amount) || input.amount === 0) throw new ServiceError("Amount must be a non-zero whole number.");
  const prior = await db.transaction.findUnique({
    where: { createdByTeacherId_idempotencyKey: { createdByTeacherId: input.teacherId, idempotencyKey: input.idempotencyKey } },
  });
  if (prior) return prior;
  return db.$transaction(async (tx) => {
    const student = await tx.student.findFirst({
      where: { id: input.studentId, teacherId: input.teacherId, active: true },
    });
    if (!student?.classroomId) throw new ServiceError("Student not found.");
    const classroom = await tx.classroom.findFirst({
      where: { id: student.classroomId, teacherId: input.teacherId, archived: false },
    });
    if (!classroom) throw new ServiceError("This classroom is archived or unavailable.");
    const current = await balance(student.id, tx);
    if (current + input.amount < 0) {
      throw new ServiceError(`Not enough ${classroom.currencyName}. Short by ${Math.abs(current + input.amount)}.`);
    }
    return tx.transaction.create({
      data: {
        studentId: student.id,
        classroomId: classroom.id,
        amount: input.amount,
        reason: input.reason.trim(),
        kind: input.kind,
        createdByTeacherId: input.teacherId,
        idempotencyKey: input.idempotencyKey,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function undoEntry(teacherId: string, transactionId: string, idempotencyKey: string) {
  return db.$transaction(async (tx) => {
    const original = await tx.transaction.findFirst({
      where: { id: transactionId, createdByTeacherId: teacherId, correctedBy: null },
      include: { purchaseLines: true },
    });
    if (!original) throw new ServiceError("That action cannot be undone.");
    const current = await balance(original.studentId, tx);
    if (current - original.amount < 0) throw new ServiceError("Undo would make the balance negative.");
    for (const line of original.purchaseLines) {
      if (line.storeItemId) await tx.storeItem.updateMany({ where: { id: line.storeItemId, stock: { not: null } }, data: { stock: { increment: line.quantity } } });
    }
    await tx.transaction.delete({ where: { id: original.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function checkout(input: {
  teacherId: string; studentId: string; items: Array<{ id: string; quantity: number }>; idempotencyKey: string;
}) {
  const prior = await db.transaction.findUnique({
    where: { createdByTeacherId_idempotencyKey: { createdByTeacherId: input.teacherId, idempotencyKey: input.idempotencyKey } },
  });
  if (prior) return prior;
  return db.$transaction(async (tx) => {
    const student = await tx.student.findFirst({ where: { id: input.studentId, teacherId: input.teacherId, active: true } });
    if (!student?.classroomId) throw new ServiceError("Student not found.");
    const requested = input.items.filter((item) => Number.isInteger(item.quantity) && item.quantity > 0);
    if (!requested.length) throw new ServiceError("Choose at least one item.");
    const items = await tx.storeItem.findMany({
      where: { id: { in: requested.map((item) => item.id) }, teacherId: input.teacherId, active: true },
    });
    if (items.length !== requested.length) throw new ServiceError("One of those items is unavailable.");
    const lines = requested.map((request) => {
      const item = items.find((candidate) => candidate.id === request.id)!;
      if (item.stock !== null && item.stock < request.quantity) throw new ServiceError(`${item.name} does not have enough stock.`);
      return { item, quantity: request.quantity };
    });
    const total = lines.reduce((sum, line) => sum + line.item.price * line.quantity, 0);
    const current = await balance(student.id, tx);
    if (current < total) throw new ServiceError(`Not enough balance. Short by ${total - current}.`);
    for (const line of lines) {
      if (line.item.stock !== null) {
        const updated = await tx.storeItem.updateMany({
          where: { id: line.item.id, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (!updated.count) throw new ServiceError(`${line.item.name} just sold out. Remove it and try again.`);
      }
    }
    return tx.transaction.create({
      data: {
        studentId: student.id, classroomId: student.classroomId, amount: -total,
        reason: `Store purchase: ${lines.map((line) => `${line.quantity} x ${line.item.name}`).join(", ")}`,
        kind: "PURCHASE", createdByTeacherId: input.teacherId, idempotencyKey: input.idempotencyKey,
        purchaseLines: { create: lines.map((line) => ({ storeItemId: line.item.id, itemName: line.item.name, unitPrice: line.item.price, quantity: line.quantity })) },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
