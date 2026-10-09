import { randomBytes, randomInt } from "crypto";
import { db } from "@/lib/db";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function cardUrl(token: string) {
  return `${(process.env.CARD_BASE_URL ?? "https://nfc-currency-tracker.edtechathon.com").replace(/\/$/, "")}/c/${token}`;
}

function shortCode() {
  return Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export async function generateCards(teacherId: string, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 200) throw new Error("Create between 1 and 200 cards.");
  const cards = await db.card.findMany({ where: { teacherId }, select: { label: true } });
  let nextLabel = cards.reduce((max, card) => Math.max(max, Number(card.label) || 0), 0) + 1;
  for (let index = 0; index < count; index++) {
    let code = shortCode();
    while (await db.card.findFirst({ where: { teacherId, shortCode: code } })) code = shortCode();
    await db.card.create({
      data: { teacherId, token: randomBytes(24).toString("base64url"), shortCode: code, label: String(nextLabel++) },
    });
  }
}

export async function resolveCard(identifier: string, teacherId?: string) {
  const card = await db.card.findFirst({
    where: identifier.length === 4 ? { shortCode: identifier.toUpperCase(), ...(teacherId ? { teacherId } : {}) } : { token: identifier },
    include: {
      assignments: {
        where: { endedAt: null },
        take: 1,
        include: { student: { include: { classroom: true } } },
      },
    },
  });
  if (!card || card.status !== "ASSIGNED" || !card.assignments[0]?.student.active || card.teacherId !== card.assignments[0].student.teacherId) return null;
  return { card, student: card.assignments[0].student };
}
