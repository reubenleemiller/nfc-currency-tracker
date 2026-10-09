import { currentTeacher } from "@/lib/auth";
import { cardUrl } from "@/lib/cards";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
export async function GET() { const teacher = await currentTeacher(); if (!teacher) return new NextResponse("Not found", { status: 404 }); const cards = await db.card.findMany({ where: { teacherId: teacher.id } }); cards.sort((first, second) => Number(first.label) - Number(second.label) || first.label.localeCompare(second.label, undefined, { numeric: true })); const csv = ["label,short_code,url", ...cards.map((card) => `"${card.label}","${card.shortCode}","${cardUrl(card.token)}"`)].join("\n"); return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=card-encoding.csv" } }); }
