# Contract forms: publish Direct Deposit and the four lien waivers

Status: blocked on owner review of the wording · plan: [`docs/CONTRACT_FORMS_PLAN.md`](../docs/CONTRACT_FORMS_PLAN.md) PR 10 (v2.2805)

## The ask

PR 10 made Forms Click author its own PDFs (`npm run forms:author`) and drafted five: **Direct Deposit Authorization** and the four Texas § 53.284 **lien waivers** (conditional / unconditional × progress / final). The owner asked to review the wording before they go live.

## Validation 2026-09-05

- The five PDFs + schemas sit in `docs/forms/authored/`. v2.2805 states "Not yet published"; no later fragment publishes them.
- Publishing is the studio's normal import: deposit → All Teammates packet; waivers → a packet with no assignees so they are sent one-off per payment.

## The plan

1. Owner reads the five PDFs (open them from `docs/forms/authored/`).
2. Dev: Contract library → Forms tab → import each schema + PDF → publish → add to the packets above.
3. Test with the test sub ("Claude Test Sub") end to end; delete the test rows.
4. Guide: the Subs packet guide gains the waiver line.

## Also in this area (small)

- `docs/HELP_MEDIA_PLAN.md` notes no read-only **training account** exists yet for recordings (the onboarding clips were captured as dev). Create one if more recordings are planned.
