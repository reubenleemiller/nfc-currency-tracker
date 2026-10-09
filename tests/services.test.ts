import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { db } from "@/lib/db";
import { balance, checkout, postAwards, postEntry, ServiceError, undoEntry } from "@/lib/ledger";
import { resolveCard } from "@/lib/cards";

beforeAll(() => { execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--force-reset"], { env: process.env }); });
beforeEach(async () => { await db.transaction.deleteMany(); await db.teacher.deleteMany(); });

async function setup() {
  const teacher = await db.teacher.create({ data: { email: `${crypto.randomUUID()}@example.com`, passwordHash: "hash", displayName: "Teacher" } });
  const classroom = await db.classroom.create({ data: { teacherId: teacher.id, name: "Room", schoolYear: "2026" } });
  const student = await db.student.create({ data: { teacherId: teacher.id, classroomId: classroom.id, displayName: "Student" } });
  return { teacher, classroom, student };
}

describe("currency service invariants", () => {
  it("returns not found behavior for cross-teacher access", async () => {
    const first = await setup(); const second = await setup();
    await expect(postEntry({ teacherId: second.teacher.id, studentId: first.student.id, amount: 1, reason: "No", kind: "AWARD", idempotencyKey: "cross-teacher-test" })).rejects.toThrow("Student not found");
  });
  it("never allows a negative balance", async () => {
    const { teacher, student } = await setup();
    await expect(postEntry({ teacherId: teacher.id, studentId: student.id, amount: -1, reason: "Spend", kind: "DEDUCT", idempotencyKey: "negative-test" })).rejects.toBeInstanceOf(ServiceError);
  });
  it("adds credit to a group of students in one request", async () => {
    const { teacher, classroom, student } = await setup();
    const classmate = await db.student.create({ data: { teacherId: teacher.id, classroomId: classroom.id, displayName: "Classmate" } });
    await postAwards({ teacherId: teacher.id, studentIds: [student.id, classmate.id], amount: 3, reason: "Great work", idempotencyKey: "group-award" });
    expect(await balance(student.id)).toBe(3);
    expect(await balance(classmate.id)).toBe(3);
    expect(await db.transaction.count({ where: { createdByTeacherId: teacher.id, idempotencyKey: { startsWith: "group-award-" } } })).toBe(2);
  });
  it("removes an undone transaction without adding it to history", async () => {
    const { teacher, student } = await setup();
    const entry = await postEntry({ teacherId: teacher.id, studentId: student.id, amount: 5, reason: "Earned", kind: "AWARD", idempotencyKey: "undo-source" });
    await undoEntry(teacher.id, entry.id, "undo-entry");
    expect(await balance(student.id)).toBe(0);
    expect(await db.transaction.count({ where: { studentId: student.id } })).toBe(0);
  });
  it("records each sold item and reduces its remaining stock", async () => {
    const { teacher, classroom, student } = await setup();
    const item = await db.storeItem.create({ data: { teacherId: teacher.id, name: "Prize", price: 2, stock: 3 } });
    await postEntry({ teacherId: teacher.id, studentId: student.id, amount: 5, reason: "Earned", kind: "AWARD", idempotencyKey: "purchase-credit" });
    await checkout({ teacherId: teacher.id, studentId: student.id, items: [{ id: item.id, quantity: 1 }], idempotencyKey: "purchase-item" });
    expect((await db.storeItem.findUnique({ where: { id: item.id } }))?.stock).toBe(2);
    expect(await db.purchaseLine.findFirst({ where: { storeItemId: item.id }, select: { quantity: true } })).toEqual({ quantity: 1 });
  });
  it("uses the same account store in another classroom", async () => {
    const { teacher, student } = await setup();
    const otherClassroom = await db.classroom.create({ data: { teacherId: teacher.id, name: "Other room", schoolYear: "2026" } });
    const otherStudent = await db.student.create({ data: { teacherId: teacher.id, classroomId: otherClassroom.id, displayName: "Other student" } });
    const item = await db.storeItem.create({ data: { teacherId: teacher.id, name: "Shared prize", price: 2, stock: 2 } });
    await postEntry({ teacherId: teacher.id, studentId: otherStudent.id, amount: 3, reason: "Earned", kind: "AWARD", idempotencyKey: "shared-store-credit" });
    await checkout({ teacherId: teacher.id, studentId: otherStudent.id, items: [{ id: item.id, quantity: 1 }], idempotencyKey: "shared-store-purchase" });
    expect((await db.storeItem.findUnique({ where: { id: item.id } }))?.stock).toBe(1);
    expect(await balance(student.id)).toBe(0);
  });
  it("does not allow another account to buy an account store item", async () => {
    const first = await setup(); const second = await setup();
    const item = await db.storeItem.create({ data: { teacherId: first.teacher.id, name: "Private prize", price: 2 } });
    await postEntry({ teacherId: second.teacher.id, studentId: second.student.id, amount: 3, reason: "Earned", kind: "AWARD", idempotencyKey: "other-account-credit" });
    await expect(checkout({ teacherId: second.teacher.id, studentId: second.student.id, items: [{ id: item.id, quantity: 1 }], idempotencyKey: "other-account-purchase" })).rejects.toThrow("unavailable");
  });
  it("rejects checkout when an item is sold out", async () => {
    const { teacher, classroom, student } = await setup();
    const item = await db.storeItem.create({ data: { teacherId: teacher.id, name: "Sold out prize", price: 2, stock: 0 } });
    await postEntry({ teacherId: teacher.id, studentId: student.id, amount: 5, reason: "Earned", kind: "AWARD", idempotencyKey: "sold-out-credit" });
    await expect(checkout({ teacherId: teacher.id, studentId: student.id, items: [{ id: item.id, quantity: 1 }], idempotencyKey: "sold-out-purchase" })).rejects.toThrow("does not have enough stock");
    expect(await db.transaction.count({ where: { studentId: student.id } })).toBe(1);
  });
  it("keeps store item display orders unique", async () => {
    const { teacher } = await setup();
    await db.storeItem.createMany({ data: [{ teacherId: teacher.id, name: "First", price: 1, sortOrder: 1 }, { teacherId: teacher.id, name: "Second", price: 1, sortOrder: 2 }] });
    const orders = await db.storeItem.findMany({ where: { teacherId: teacher.id }, orderBy: { sortOrder: "asc" }, select: { sortOrder: true } });
    expect(orders.map((item) => item.sortOrder)).toEqual([1, 2]);
  });
  it("reassignment clears the prior active student", async () => {
    const { teacher, classroom, student } = await setup(); const replacement = await db.student.create({ data: { teacherId: teacher.id, classroomId: classroom.id, displayName: "Replacement" } }); const card = await db.card.create({ data: { teacherId: teacher.id, token: crypto.randomUUID() + crypto.randomUUID(), shortCode: "7K2Q", label: "1", status: "ASSIGNED" } }); const old = await db.cardAssignment.create({ data: { cardId: card.id, studentId: student.id } }); await db.$transaction([db.cardAssignment.update({ where: { id: old.id }, data: { endedAt: new Date() } }), db.cardAssignment.create({ data: { cardId: card.id, studentId: replacement.id } })]); expect(await db.cardAssignment.count({ where: { cardId: card.id, endedAt: null } })).toBe(1); expect((await db.cardAssignment.findFirst({ where: { cardId: card.id, endedAt: null } }))?.studentId).toBe(replacement.id);
  });
  it("a permanent card URL resolves to its currently assigned student", async () => {
    const { teacher, classroom, student } = await setup();
    const replacement = await db.student.create({ data: { teacherId: teacher.id, classroomId: classroom.id, displayName: "Replacement" } });
    const token = crypto.randomUUID() + crypto.randomUUID();
    const card = await db.card.create({ data: { teacherId: teacher.id, token, shortCode: "8M3R", label: "1", status: "ASSIGNED" } });
    const firstAssignment = await db.cardAssignment.create({ data: { cardId: card.id, studentId: student.id } });
    expect((await resolveCard(token))?.student.id).toBe(student.id);
    await db.$transaction([db.cardAssignment.update({ where: { id: firstAssignment.id }, data: { endedAt: new Date() } }), db.cardAssignment.create({ data: { cardId: card.id, studentId: replacement.id } })]);
    expect((await resolveCard(token))?.student.id).toBe(replacement.id);
  });
  it("does not resolve a card assigned across teacher accounts", async () => {
    const first = await setup(); const second = await setup();
    const token = crypto.randomUUID() + crypto.randomUUID();
    const card = await db.card.create({ data: { teacherId: first.teacher.id, token, shortCode: "9N4P", label: "1", status: "ASSIGNED" } });
    await db.cardAssignment.create({ data: { cardId: card.id, studentId: second.student.id } });
    expect(await resolveCard(token)).toBeNull();
  });
  it("balance follows a student across a class transfer", async () => {
    const { teacher, student } = await setup(); await postEntry({ teacherId: teacher.id, studentId: student.id, amount: 7, reason: "Earned", kind: "AWARD", idempotencyKey: "transfer-test" }); const next = await db.classroom.create({ data: { teacherId: teacher.id, name: "Next", schoolYear: "2026" } }); await db.student.update({ where: { id: student.id }, data: { classroomId: next.id } }); expect(await balance(student.id)).toBe(7);
  });
});
