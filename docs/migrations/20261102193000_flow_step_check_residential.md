# 20261102193000_flow_step_check_residential.sql (2026-11-02, v2.6385)

`flow_step_check(p_contact, p_step)` replaced: the step must be on the person's flow as the app reads it — the
contact's kind's flow, and the **residential flow too for a `customer` contact whose customers row says
`residential`** (through the contact's own `customer_id`, or the named person's `customer_contact_persons` row, as
`flow_rows_for` resolves them). Before, the check joined `flows.kind = contacts.kind` alone; since every customer's own
contact is kind `customer` (`contact_find_or_make`, and `contacts_kind_known` has no `residential`), every press on a
residential step was refused `stepUnknown`: Stop reminding on this job (`flow_skip_step`), Hold until… (`nudge_hold_until`),
a step note (`flow_add_note`) and the Send press's record (`nudge_offer_sent` → `nudge_record_sent`). The refusal keeps
its code and now names the step in `DETAIL`. `SECURITY INVOKER` as before: a customers row the caller may not read
leaves the kind's flow alone. No table is made, so no fence call.

Shipped with Today's sends' fix for a homeowner's moved-visit text (PR 1 of three). The bed
`supabase/tests/messages_flows/20_scenario.sql` holds it: a residential customer's contact skips Booked; a step on
neither flow is still refused.

**Apply order:** either side first. The old client works against the new body (the same signature); the new client
reads better once the push lands (its words for a `stepUnknown` that still comes back are the client's own). Push with
`supabase db push` after the merge.
