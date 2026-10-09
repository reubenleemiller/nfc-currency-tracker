"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, requireTeacher } from "@/lib/auth";
import { generateCards } from "@/lib/cards";
import { checkout, postEntry, undoEntry } from "@/lib/ledger";
import { id, name, reason, text, wholeAmount } from "@/lib/validation";

function refresh() { revalidatePath("/app", "layout"); }
function key(form: FormData) { return text(form, "idempotencyKey") || crypto.randomUUID(); }

export async function signup(form: FormData) {
  const email = text(form, "email").trim().toLowerCase();
  const displayName = name.parse(text(form, "displayName"));
  const password = text(form, "password");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  const teacher = await db.teacher.create({ data: { email, displayName, passwordHash: await bcrypt.hash(password, 12) } });
  await db.classroom.create({
    data: {
      teacherId: teacher.id, name: "My Classroom", schoolYear: String(new Date().getFullYear()),
      awardPresets: { create: [{ label: "Great choice", amount: 1 }, { label: "Helping out", amount: 2, sortOrder: 1 }, { label: "Above & beyond", amount: 5, sortOrder: 2 }] },
    },
  });
  await createSession(teacher.id);
  redirect("/app");
}

export async function login(form: FormData) {
  const email = text(form, "email").trim().toLowerCase();
  const teacher = await db.teacher.findUnique({ where: { email } });
  if (!teacher || !(await bcrypt.compare(text(form, "password"), teacher.passwordHash))) redirect("/login?error=1");
  await createSession(teacher.id);
  redirect("/app");
}

export async function logout() { await destroySession(); redirect("/login"); }

export async function createClassroom(form: FormData) {
  const teacher = await requireTeacher();
  const classroom = await db.classroom.create({ data: {
    teacherId: teacher.id, name: name.parse(text(form, "name")), schoolYear: name.parse(text(form, "schoolYear")),
    currencyName: name.parse(text(form, "currencyName") || "Class Bucks"), currencySymbol: text(form, "currencySymbol").trim().slice(0, 4) || "$",
    awardPresets: { create: [{ label: "Great choice", amount: 1 }, { label: "Helping out", amount: 2, sortOrder: 1 }, { label: "Above & beyond", amount: 5, sortOrder: 2 }] },
  } });
  redirect(`/app/class/${classroom.id}`);
}

export async function updateClassroom(form: FormData) {
  const teacher = await requireTeacher();
  const classroomId = id.parse(text(form, "classroomId"));
  await db.classroom.updateMany({ where: { id: classroomId, teacherId: teacher.id }, data: {
    name: name.parse(text(form, "name")), schoolYear: name.parse(text(form, "schoolYear")),
    currencyName: name.parse(text(form, "currencyName")), currencySymbol: text(form, "currencySymbol").trim().slice(0, 4) || "$",
  } });
  refresh();
}

export async function setArchived(form: FormData) {
  const teacher = await requireTeacher();
  const archived = text(form, "archived") === "true";
  await db.classroom.updateMany({ where: { id: id.parse(text(form, "classroomId")), teacherId: teacher.id }, data: { archived, archivedAt: archived ? new Date() : null } });
  refresh();
}

export async function addStudents(form: FormData) {
  const teacher = await requireTeacher();
  const classroomId = id.parse(text(form, "classroomId"));
  const classroom = await db.classroom.findFirst({ where: { id: classroomId, teacherId: teacher.id, archived: false } });
  if (!classroom) throw new Error("Classroom not found.");
  const names = text(form, "names").split(/[,\r\n]+/).map((studentName) => studentName.trim()).filter(Boolean).slice(0, 200);
  if (!names.length) throw new Error("Add at least one name.");
  await db.student.createMany({ data: names.map((displayName) => ({ teacherId: teacher.id, classroomId, displayName: name.parse(displayName) })) });
  refresh();
}

export async function updateStudent(form: FormData) {
  const teacher = await requireTeacher();
  const studentId = id.parse(text(form, "studentId"));
  const active = text(form, "active") !== "false";
  await db.$transaction(async (tx) => {
    const student = await tx.student.findFirst({ where: { id: studentId, teacherId: teacher.id } });
    if (!student) throw new Error("Student not found.");
    await tx.student.update({ where: { id: student.id }, data: { displayName: name.parse(text(form, "displayName")), active } });
    if (!active) {
      const assignments = await tx.cardAssignment.findMany({ where: { studentId, endedAt: null }, select: { id: true, cardId: true } });
      await tx.cardAssignment.updateMany({ where: { studentId, endedAt: null }, data: { endedAt: new Date() } });
      await tx.card.updateMany({ where: { id: { in: assignments.map((item) => item.cardId) }, teacherId: teacher.id }, data: { status: "AVAILABLE" } });
    }
  });
  refresh();
}

export async function moveStudents(form: FormData) {
  const teacher = await requireTeacher();
  const classroomId = id.parse(text(form, "destinationId"));
  const destination = await db.classroom.findFirst({ where: { id: classroomId, teacherId: teacher.id, archived: false } });
  if (!destination) throw new Error("Destination classroom not found.");
  const studentIds = form.getAll("studentIds").map(String);
  await db.student.updateMany({ where: { id: { in: studentIds }, teacherId: teacher.id }, data: { classroomId } });
  refresh();
}

export async function removeStudents(form: FormData) {
  const teacher = await requireTeacher();
  const classroomId = id.parse(text(form, "classroomId"));
  const studentIds = [...new Set(form.getAll("studentIds").map(String))].slice(0, 200);
  if (!studentIds.length) throw new Error("Select at least one student.");
  await db.$transaction(async (tx) => {
    const students = await tx.student.findMany({
      where: { id: { in: studentIds }, classroomId, teacherId: teacher.id },
      select: { id: true },
    });
    const ownedStudentIds = students.map((student) => student.id);
    const assignments = await tx.cardAssignment.findMany({
      where: { studentId: { in: ownedStudentIds }, endedAt: null },
      select: { id: true, cardId: true },
    });
    await tx.cardAssignment.updateMany({
      where: { id: { in: assignments.map((assignment) => assignment.id) } },
      data: { endedAt: new Date() },
    });
    await tx.card.updateMany({
      where: { id: { in: assignments.map((assignment) => assignment.cardId) }, teacherId: teacher.id },
      data: { status: "AVAILABLE" },
    });
    await tx.student.updateMany({
      where: { id: { in: ownedStudentIds }, teacherId: teacher.id },
      data: { classroomId: null, active: false },
    });
  });
  refresh();
}

export async function createCardBatch(form: FormData) {
  const teacher = await requireTeacher();
  await generateCards(teacher.id, Number(text(form, "count")));
  refresh();
}

export async function assignCard(form: FormData) {
  const teacher = await requireTeacher();
  const studentId = id.parse(text(form, "studentId"));
  const cardId = id.parse(text(form, "cardId"));
  await db.$transaction(async (tx) => {
    const [student, card] = await Promise.all([
      tx.student.findFirst({ where: { id: studentId, teacherId: teacher.id, active: true } }),
      tx.card.findFirst({ where: { id: cardId, teacherId: teacher.id, status: "AVAILABLE" } }),
    ]);
    if (!student || !card) throw new Error("That student or card is unavailable.");
    const previous = await tx.cardAssignment.findMany({ where: { OR: [{ studentId, endedAt: null }, { cardId, endedAt: null }] }, select: { id: true, cardId: true } });
    await tx.cardAssignment.updateMany({ where: { id: { in: previous.map((item) => item.id) } }, data: { endedAt: new Date() } });
    await tx.card.updateMany({ where: { id: { in: previous.map((item) => item.cardId) } }, data: { status: "AVAILABLE" } });
    await tx.cardAssignment.create({ data: { studentId, cardId } });
    await tx.card.update({ where: { id: cardId }, data: { status: "ASSIGNED" } });
  });
  refresh();
}

export async function unassignCard(form: FormData) {
  const teacher = await requireTeacher();
  const studentId = id.parse(text(form, "studentId"));
  await db.$transaction(async (tx) => {
    const student = await tx.student.findFirst({ where: { id: studentId, teacherId: teacher.id } });
    if (!student) throw new Error("Student not found.");
    const assignments = await tx.cardAssignment.findMany({ where: { studentId, endedAt: null }, select: { id: true, cardId: true } });
    if (!assignments.length) return;
    await tx.cardAssignment.updateMany({ where: { id: { in: assignments.map((assignment) => assignment.id) } }, data: { endedAt: new Date() } });
    await tx.card.updateMany({ where: { id: { in: assignments.map((assignment) => assignment.cardId) }, teacherId: teacher.id }, data: { status: "AVAILABLE" } });
  });
  refresh();
}

export async function autoAssign(form: FormData) {
  const teacher = await requireTeacher();
  const classroomId = id.parse(text(form, "classroomId"));
  await db.$transaction(async (tx) => {
    const students = await tx.student.findMany({
      where: { classroomId, teacherId: teacher.id, active: true, assignments: { none: { endedAt: null } } }, orderBy: { displayName: "asc" },
    });
    const cards = await tx.card.findMany({ where: { teacherId: teacher.id, status: "AVAILABLE" }, orderBy: { label: "asc" }, take: students.length });
    for (let index = 0; index < cards.length; index++) {
      await tx.cardAssignment.create({ data: { studentId: students[index].id, cardId: cards[index].id } });
      await tx.card.update({ where: { id: cards[index].id }, data: { status: "ASSIGNED" } });
    }
  });
  refresh();
}

export async function resetAssignments(form: FormData) {
  const teacher = await requireTeacher();
  const classroomId = id.parse(text(form, "classroomId"));
  const assignments = await db.cardAssignment.findMany({
    where: { endedAt: null, student: { classroomId, teacherId: teacher.id } }, select: { id: true, cardId: true },
  });
  await db.$transaction([
    db.cardAssignment.updateMany({ where: { id: { in: assignments.map((item) => item.id) } }, data: { endedAt: new Date() } }),
    db.card.updateMany({ where: { id: { in: assignments.map((item) => item.cardId) }, teacherId: teacher.id }, data: { status: "AVAILABLE" } }),
  ]);
  refresh();
}

export async function setCardStatus(form: FormData) {
  const teacher = await requireTeacher();
  const cardId = id.parse(text(form, "cardId"));
  const status = text(form, "status");
  if (!(["AVAILABLE", "LOST", "RETIRED"] as const).includes(status as "AVAILABLE")) throw new Error("Invalid card status.");
  await db.$transaction(async (tx) => {
    const card = await tx.card.findFirst({ where: { id: cardId, teacherId: teacher.id } });
    if (!card) throw new Error("Card not found.");
    await tx.cardAssignment.updateMany({ where: { cardId, endedAt: null }, data: { endedAt: new Date() } });
    await tx.card.update({ where: { id: cardId }, data: { status: status as "AVAILABLE" | "LOST" | "RETIRED" } });
  });
  refresh();
}

export async function bulkSetCardStatus(form: FormData) {
  const teacher = await requireTeacher();
  const cardIds = [...new Set(form.getAll("cardIds").map(String))].slice(0, 200);
  const status = text(form, "status");
  if (!cardIds.length) throw new Error("Select at least one card.");
  if (!(["AVAILABLE", "LOST", "RETIRED"] as const).includes(status as "AVAILABLE")) throw new Error("Invalid card status.");
  await db.$transaction(async (tx) => {
    const cards = await tx.card.findMany({ where: { id: { in: cardIds }, teacherId: teacher.id }, select: { id: true } });
    if (cards.length !== cardIds.length) throw new Error("One or more cards were not found.");
    const ownedIds = cards.map((card) => card.id);
    await tx.cardAssignment.updateMany({ where: { cardId: { in: ownedIds }, endedAt: null }, data: { endedAt: new Date() } });
    await tx.card.updateMany({ where: { id: { in: ownedIds }, teacherId: teacher.id }, data: { status: status as "AVAILABLE" | "LOST" | "RETIRED" } });
  });
  refresh();
}

export async function award(form: FormData) {
  const teacher = await requireTeacher();
  const amount = wholeAmount.parse(text(form, "amount"));
  const selected = form.getAll("studentIds").map(String);
  const why = text(form, "reason").trim() || text(form, "presetLabel").trim() || "Classroom award";
  for (const [index, studentId] of selected.entries()) await postEntry({ teacherId: teacher.id, studentId, amount, reason: why, kind: "AWARD", idempotencyKey: `${key(form)}-${index}` });
  refresh();
}

export async function adjust(form: FormData) {
  const teacher = await requireTeacher();
  const amount = wholeAmount.parse(text(form, "amount")) * (text(form, "direction") === "remove" ? -1 : 1);
  await postEntry({ teacherId: teacher.id, studentId: id.parse(text(form, "studentId")), amount, reason: reason.parse(text(form, "reason")), kind: "ADJUSTMENT", idempotencyKey: key(form) });
  refresh();
}

export async function undo(form: FormData) {
  const teacher = await requireTeacher();
  await undoEntry(teacher.id, id.parse(text(form, "transactionId")), key(form));
  refresh();
}

export async function saveStoreItem(form: FormData) {
  const teacher = await requireTeacher();
  const data = { name: name.parse(text(form, "name")), price: wholeAmount.parse(text(form, "price")), stock: text(form, "stock") ? wholeAmount.parse(text(form, "stock")) : null, active: text(form, "active") !== "false" };
  const itemId = text(form, "itemId");
  if (itemId) await db.storeItem.updateMany({ where: { id: itemId, teacherId: teacher.id }, data });
  else {
    const count = await db.storeItem.count({ where: { teacherId: teacher.id } });
    await db.storeItem.create({ data: { teacherId: teacher.id, ...data, sortOrder: count + 1 } });
  }
  const returnTo = text(form, "returnTo");
  if (/^\/app\/class\/[^/]+\/store$/.test(returnTo)) redirect(`${returnTo}?saved=1`);
  refresh();
}

export async function savePreset(form: FormData) {
  const teacher = await requireTeacher();
  const classroomId = id.parse(text(form, "classroomId"));
  const classroom = await db.classroom.findFirst({ where: { id: classroomId, teacherId: teacher.id, archived: false } });
  if (!classroom) throw new Error("Classroom not found.");
  const amount = wholeAmount.parse(text(form, "amount"));
  const label = name.parse(text(form, "label"));
  const presetId = text(form, "presetId");
  if (presetId) await db.awardPreset.updateMany({ where: { id: presetId, classroomId }, data: { amount, label } });
  else await db.awardPreset.create({ data: { classroomId, amount, label, sortOrder: await db.awardPreset.count({ where: { classroomId } }) } });
  refresh();
}

export async function purchase(form: FormData) {
  const teacher = await requireTeacher();
  const items = form.getAll("itemIds").map(String).map((id) => ({ id, quantity: 1 }));
  await checkout({ teacherId: teacher.id, studentId: id.parse(text(form, "studentId")), items, idempotencyKey: key(form) });
  refresh();
}

export async function archiveYear(form: FormData) {
  const teacher = await requireTeacher();
  const schoolYear = name.parse(text(form, "schoolYear"));
  await db.classroom.updateMany({ where: { teacherId: teacher.id, schoolYear }, data: { archived: true, archivedAt: new Date() } });
  refresh();
}

export async function deleteClassroom(form: FormData) {
  const teacher = await requireTeacher();
  const classroomId = id.parse(text(form, "classroomId"));
  await db.$transaction(async (tx) => {
    const classroom = await tx.classroom.findFirst({ where: { id: classroomId, teacherId: teacher.id }, select: { id: true } });
    if (!classroom) throw new Error("Classroom not found.");
    const students = await tx.student.findMany({ where: { classroomId, teacherId: teacher.id }, select: { id: true } });
    const studentIds = students.map((student) => student.id);
    const assignments = await tx.cardAssignment.findMany({ where: { studentId: { in: studentIds }, endedAt: null }, select: { cardId: true } });
    await tx.cardAssignment.updateMany({ where: { studentId: { in: studentIds }, endedAt: null }, data: { endedAt: new Date() } });
    await tx.card.updateMany({ where: { id: { in: assignments.map((assignment) => assignment.cardId) }, teacherId: teacher.id }, data: { status: "AVAILABLE" } });
    await tx.student.deleteMany({ where: { id: { in: studentIds }, teacherId: teacher.id } });
    await tx.classroom.delete({ where: { id: classroom.id } });
  });
  redirect("/app");
}

export async function deleteYear(form: FormData) {
  const teacher = await requireTeacher();
  const schoolYear = name.parse(text(form, "schoolYear"));
  if (text(form, "confirmation") !== `DELETE ${schoolYear}`) throw new Error(`Type DELETE ${schoolYear} to confirm.`);
  await db.$transaction(async (tx) => {
    const classes = await tx.classroom.findMany({ where: { teacherId: teacher.id, schoolYear, archived: true }, select: { id: true } });
    const classIds = classes.map((item) => item.id);
    const students = await tx.student.findMany({ where: { teacherId: teacher.id, classroomId: { in: classIds } }, select: { id: true } });
    const studentIds = students.map((item) => item.id);
    const assignments = await tx.cardAssignment.findMany({ where: { studentId: { in: studentIds }, endedAt: null }, select: { cardId: true } });
    await tx.cardAssignment.updateMany({ where: { studentId: { in: studentIds }, endedAt: null }, data: { endedAt: new Date() } });
    await tx.card.updateMany({ where: { id: { in: assignments.map((item) => item.cardId) }, teacherId: teacher.id }, data: { status: "AVAILABLE" } });
    await tx.transaction.deleteMany({ where: { classroomId: { in: classIds }, createdByTeacherId: teacher.id } });
    await tx.student.deleteMany({ where: { id: { in: studentIds }, teacherId: teacher.id } });
    await tx.classroom.deleteMany({ where: { id: { in: classIds }, teacherId: teacher.id } });
  });
  refresh();
}
