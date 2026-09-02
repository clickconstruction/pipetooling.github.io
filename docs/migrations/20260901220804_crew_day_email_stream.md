# 20260901220804_crew_day_email_stream

**v2.2603** — the `crew_day` email stream (Report Subscriptions piece set for the Crew Day section, v2.2602).

- `crew_day_email_requests` table (requested_by, recipient_user_id, send_at, repeat_weekly, sent_at, error, attempts) + due-rows partial index. RLS: crew-day-eligible roles (dev/master_technician/assistant/controller/**superintendent**) insert their own requests **and only for eligible recipients** (the data must never be addressed to a field role); creators read/cancel own unsent rows; devs see all; no client UPDATE (only the dispatcher stamps). Ends with both read-only sweeps (new table).
- `get_crew_day_payload_for_user(p_user_id, p_day)` — service-role-only mirror of `get_crew_day_payload` (20260901215024) computed for the RECIPIENT. Difference: the superintendent branch scopes via `project_superintendents` directly (`can_access_project_row` reads `auth.uid()`, NULL under service role). **Keep the two functions in sync.**
- pg_cron `crew-day-email-dispatch` at `4-59/5 * * * *` (co-rides the :04 lane per the v2.1919 stagger).
- `get_my_email_schedule()` + `get_global_email_schedule()` rebuilt with a `crew_day` branch — bodies verbatim from `20260901120000` (money_waiting, the previous rebuild).
