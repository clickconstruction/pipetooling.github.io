# 20261004170429_job_pay_applications_carry_reason.sql (2026-10-04, v2.4494)

`job_pay_applications.carry_reason text NOT NULL DEFAULT ''` — why an application keeps previous amounts that no longer match the application before it. Nothing locks a saved pay application, so an earlier one can change after a later one went out; the window flags the later one (the client works the mismatch out from the two rows — `carryMismatch`) and the office either takes the new amounts or keeps it as it went out and writes the reason here. One column, additive; the table's policies and fences are unchanged.

Apply order: **either**. The old client never names the column. The new client asks for it and, on a database that does not have it (`42703`), reads and writes again without it (`aiaPayApplicationsIo.ts`), and sends the column only when there is a reason to write or clear. Regenerate `src/types/database.ts` after the push.

Test: `supabase/tests/pay_applications/20_scenario.sql` — a new row starts with no reason; the office writes one.
