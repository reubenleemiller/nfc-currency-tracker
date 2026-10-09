import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const db = new PrismaClient();
const first = ["Avery", "Bailey", "Cameron", "Dakota", "Emerson", "Finley", "Harper", "Jordan"];

async function main() {
  await db.teacher.deleteMany({ where: { email: "demo@example.com" } });
  const teacher = await db.teacher.create({ data: { email: "demo@example.com", displayName: "Ms. Rivera", passwordHash: await bcrypt.hash("classroom123", 12) } });
  const classes = await Promise.all(["Sunflower Room", "Maple Room", "Last Year Archive"].map((name, index) => db.classroom.create({ data: { teacherId: teacher.id, name, schoolYear: index === 2 ? "2025-2026" : "2026-2027", archived: index === 2, archivedAt: index === 2 ? new Date() : null, currencyName: index === 1 ? "Maple Miles" : "Class Bucks", currencySymbol: index === 1 ? "★" : "$" } })));
  await db.storeItem.createMany({ data: [{ teacherId: teacher.id, name: "Choose your seat", price: 8, sortOrder: 1 }, { teacherId: teacher.id, name: "Homework pass", price: 15, sortOrder: 2 }, { teacherId: teacher.id, name: "Prize box", price: 20, stock: 12, sortOrder: 3 }] });
  for (const classroom of classes) for (const [index, name] of first.entries()) await db.student.create({ data: { teacherId: teacher.id, classroomId: classroom.id, displayName: `${name} ${String.fromCharCode(65 + index)}.` } });
}

main().finally(() => db.$disconnect());
