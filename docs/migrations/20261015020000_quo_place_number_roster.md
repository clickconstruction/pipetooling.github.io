# 20261015020000_quo_place_number_roster.sql (2026-10-14, v2.5549)

Messages: `quo_place_number` (the webhook's one read of whose number this is) reads the roster before it makes an unknown contact. When no contact holds the number, a `people` row, not archived, whose phone has the number's key gets the line on their contact, made now with the roster's kind (`sub`, else `team`) when the seed of `20261015010000_contacts_team_kind.sql` has not made it, with the number as its channel. Re-creates the function only; no table, no grant change (it stays the service role's).

Shipped with v2.5549. Apply after `20261015010000_contacts_team_kind.sql` (it writes the `team` kind that one allows); no client change. Bed: `npm run test:pg:quo-messages`.
