# Decisions

- Local development uses SQLite for the requested `npm install && npm run dev` experience. Production uses a separate, equivalent Postgres Prisma schema and hand-written migration so Postgres-only partial unique indexes can enforce one active assignment per card and student.
- The school-year delete flow deletes students currently in archived classes for that year and their ledger rows, while permanent card records survive. Teachers are offered a class transaction CSV on every roster and must type `DELETE <year>`.
- Card URLs resolve to teacher controls only when the browser holds that card owner's teacher session. Otherwise the same URL is strictly read-only. `/s/<token>` always uses the same read-only-first presentation.
- Card short codes use `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`; ambiguous `0`, `O`, `1`, and `I` are excluded.
- Award writes are queued in browser storage on network failure and retain a unique idempotency key. Business-rule failures remain visible for explicit retry instead of being discarded.
- Transactions remain the sole balance source. Checkout uses one `PURCHASE` transaction plus immutable purchase-line snapshots.
- Rate limiting is lightweight in-process because the required deployment runs one long-lived app container. A multi-replica deployment should replace it with a shared limiter.
- A stable `CARD_BASE_URL` can differ from the application domain; Caddy must list both hostnames if they differ.
