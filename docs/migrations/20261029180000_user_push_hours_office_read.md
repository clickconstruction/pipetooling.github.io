# 20261029180000_user_push_hours_office_read.sql (2026-10-29, v2.6060)

The office reads every person's **Push me** hours (punch list #141 PR 4, `to-dos/quiet-hours/README.md` → The plan → PR 4). The thread's pill on Messages (`WhoHasItPill`, through `messages/whoIsOff.ts`) says when whoever has the reply is off, *Rosa has this · off until 6 AM*, and when nobody has it and every office member is, *the office is off until 6 AM*. The pill reads the team's rows of `user_push_hours` (`20261028200000`); until this push only the owner and a dev may read another person's row, so only they see the off words. The client reads fail-soft (a row it cannot read is any time), so it may deploy first. No function reads anything new.

## What it does

1. **`user_push_hours_office_read`**: one SELECT policy for `authenticated`, `(SELECT public.gc_office_team())`, the five office roles (dev, master_technician, assistant, controller, estimator). The own-row policy and the owner-or-dev read stay as they were; the office read is additive. `DROP POLICY IF EXISTS` first, so a second run leaves the same policy.
2. A comment on the policy naming the two surfaces that read through it.

No new table, so no fences.

## Why

Decision 3 of the card: when the holder is off the office hears at once, *Dana wrote to Luis, who is off until 6 AM*, so the office already learns a person's hours from the push in words. The pill says the same thing where the office works the reply, and the Office hours card's coverage line (the owner or a dev, already readable) says where everyone's hours leave nobody. A tech reads only their own row: the tech's thread window never draws the pill.

## Verify

Read-only on prod after the push: `select policyname, cmd, qual from pg_policies where tablename = 'user_push_hours'` reads three policies, the new one `FOR SELECT` on `gc_office_team()`. As an office member who is not the owner, open a thread someone holds whose Push me hours are closed now: the pill reads *… has this · off until …*. As a tech, `read_rows user_push_hours` reads only your own row.
