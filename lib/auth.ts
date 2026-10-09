import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

const COOKIE = "nfc_session";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(teacherId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { teacherId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + THIRTY_DAYS) },
  });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS / 1000,
  });
}

export async function currentTeacher() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { teacher: true },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.teacher;
}

export async function requireTeacher() {
  const teacher = await currentTeacher();
  if (!teacher) redirect("/login");
  return teacher;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(COOKIE);
}
