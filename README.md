# NFC Currency Tracker

A self-hosted classroom reward economy for reusable NFC and short-code cards. Teachers award whole-number classroom currency, run a store, and keep an immutable transaction history. Students do not have accounts and cannot move credit.

## Local setup

Requirements: Node.js 22+ and npm.

```sh
npm install
cp .env.example .env
npm run dev
```

The development command creates the local SQLite database automatically. Open the project's shared website. To fill it with demonstration data, stop the app once and run `npm run db:seed`, then restart it. Demo login: `demo@example.com` / `classroom123`.

Useful checks:

```sh
npm run typecheck
npm test
npm run build
```

## Environment variables

- `DATABASE_URL`: SQLite URL locally; the Docker stack supplies the internal Postgres URL in production.
- `SESSION_SECRET`: at least 32 random characters for secure teacher sessions.
- `CARD_BASE_URL`: permanent public HTTPS origin encoded on physical cards. Decide this before writing cards.
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`: production database settings.
- `DOMAIN`: public app hostname used by Caddy, without a protocol.

See `.env.example` for examples and `SETUP.md` for the full VM, HTTPS, GitHub deployment, backup, and restore runbook.

## Setting up your card set

Cards store only a URL. Names, assignments, balances, and history always stay in the database, so a card can be returned to the available pool and assigned to a different student without carrying any balance.

1. In a classroom, open **Cards** and generate the required number.
2. Open **Encoding sheet**. Match each printed card label to its permanent URL.
3. On an iPhone, use any free NFC writer app to write the matching URL to each chip once.
4. Test the card, then lock the tag after writing so its permanent identifier cannot be changed accidentally.
5. Label each physical card with its matching card number and short code. No student name is needed because cards are reused.
6. Assign cards to students manually or with sequential auto-assign.

Blank NTAG215 cards and re-encodable hotel keycards both work. Confirm that hotel cards are writable before buying a set. iPhones open the written URL through background NFC reading without an installed app. The four-character code remains a backup for damaged cards and for devices that cannot read NFC.

Never change `CARD_BASE_URL` after chips have been written and locked. The path is deliberately short: `/c/<permanent-token>`.

## Production deployment

The three-service Docker Compose stack includes the app, Postgres, and Caddy automatic HTTPS. Migrations run with `prisma migrate deploy` before the app process accepts traffic. Run:

```sh
cp .env.example .env
# Edit every production value first.
docker compose up -d --build
```

`deploy.sh` safely pulls, rebuilds, restarts, and checks health. `.github/workflows/deploy.yml` runs checks before invoking that script over SSH. Exact first-install and secret instructions are in `SETUP.md`.

## Main workflows

- Teacher signup, login, class switching, archiving, restoring, and school-year deletion.
- Paste or CSV roster import, student editing/deactivation, bulk class transfer, and balance sorting.
- Permanent card generation, encoding CSV, print sheets, assignment, reset, lost/retired state, and replacement.
- Multi-student quick awards with optimistic balances, visible sync state, queued retry, and idempotency.
- Manual short-code lookup, teacher-aware iPhone card links, and roster fallback.
- Manual adjustment with required reason, compensating undo, full student history, store editing, stocked checkout, and CSV export.
- Fast read-only student balance, activity, and affordability view.
