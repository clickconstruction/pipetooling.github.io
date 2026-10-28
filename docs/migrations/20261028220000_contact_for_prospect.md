# 20261028220000_contact_for_prospect.sql (2026-10-28, v2.6032)

The Subs run's first text to a sub starts their Messages thread (punch list #153, `to-dos/subs-bench-board/README.md` → Where it stands). One function, no table, no fence call. Push after the feature PR merges: the client calls the function only on the press that finds no thread, so a client deployed first shows the function's absence as that one toast's reason, and the old client never calls it.

## What it does

`contact_for_prospect(p_prospect_id uuid) RETURNS uuid`, `contact_for_customer`'s shape (`20261014020000`) for a Prospects row:

1. Refuses in words anyone signed out, anyone outside both the office team (`gc_office_team()`, the contacts' own policy and what `quo-send` asks of the caller) and the prospects staff (`user_has_prospects_staff_access()`, the row's own policy), and a prospect that is not there.
2. Answers the contact on the row (`contacts.prospect_id`, one per row by `contacts_prospect_once`) when it holds every number and address the card has: a read, which a training account and a digital twin may do.
3. Otherwise refuses a training account and a twin in words (a definer passes the house fences), makes the contact when there is none (kind `lead`, as the seven kinds give a Prospects row; named after the person on the card, else the company, since `contact_display_name` is an invoker and the prospects policy refuses some of the office team), and puts the card's numbers (the person's cell, the company's line) and address on it as channels where missing (`contact_channels_once`, `ON CONFLICT DO NOTHING`).

`SECURITY DEFINER`; `anon` cannot run it; `authenticated` and the service role can.

## Verify

After the push, as the dev on the Subs board (`/prospects?kind=subs&tab=board`): a ZZ sub with a phone, **Call the top 3 →**, **Didn't Answer**, May we text? set to yes, **Text them**. `read_rows contacts` filtered by `prospect_id` shows one row of kind `lead` named after the card, `read_rows contact_channels` by that `contact_id` the card's number; a second press adds nothing. Then delete the contact (its channels and lines cascade), then the ZZ prospect.
