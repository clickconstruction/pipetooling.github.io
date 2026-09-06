# Contract forms: publish the four lien waivers

Status: blocked on owner review of the waiver wording · plan: [`docs/CONTRACT_FORMS_PLAN.md`](../docs/CONTRACT_FORMS_PLAN.md) PR 10 (v2.2805)

## The ask

PR 10 made Forms Click author its own PDFs (`npm run forms:author`) and drafted five: **Direct Deposit Authorization** and the four Texas § 53.284 **lien waivers** (conditional / unconditional × progress / final). The owner asked to review the wording before they go live.

## Done 2026-09-06 — Direct Deposit Authorization

Six review rounds (#2688, #2690, #2693, #2696, #2702, #2704): contractor wording, four account types, all / fixed / percentage with a Term box, address on account instead of bank name, no voided-check language, three-line letterhead. Published through the Form Studio (Contract library → Forms → New form from a PDF → Import JSON → Save → Publish) as a **Subs** packet entry, audience **sub**, version date 2026-09-06, revision `v1 (2026-09)`; `contract_form_templates.pdf_sha256` matches `docs/forms/authored/direct-deposit-authorization.pdf`. Not yet test-signed with the Claude Test Sub (the plan's step 3) — do that before the first real send.

## Validation 2026-09-05 (waivers)

- The four waiver PDFs + schemas sit in `docs/forms/authored/`; nothing publishes them yet.
- Publishing is the studio's normal import: waivers → a packet with no assignees so they are sent one-off per payment.

## The plan

1. Owner reads the four waiver PDFs (open them from `docs/forms/authored/`); if the deposit form's letterhead convention should carry over, switch `lienWaivers.ts` to `COMPANY_ADDRESS_LINES` first.
2. Dev: Contract library → Forms tab → import each schema + PDF → publish → add to the packet above.
3. Test with the test sub ("Claude Test Sub") end to end — the deposit form too; delete the test rows.
4. Guide: the Subs packet guide gains the waiver line.

## Also in this area (small)

- `docs/HELP_MEDIA_PLAN.md` notes no read-only **training account** exists yet for recordings (the onboarding clips were captured as dev). Create one if more recordings are planned.
