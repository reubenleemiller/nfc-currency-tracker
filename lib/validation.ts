import { z } from "zod";

export const id = z.string().min(10).max(40);
export const name = z.string().trim().min(1).max(100);
export const reason = z.string().trim().min(1, "A reason is required").max(200);
export const wholeAmount = z.coerce.number().int().min(1).max(100000);
export const idempotencyKey = z.string().min(12).max(100);

export function text(form: FormData, field: string) {
  return String(form.get(field) ?? "");
}
