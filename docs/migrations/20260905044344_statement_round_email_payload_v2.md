# 20260905044344_statement_round_email_payload_v2.sql (v2.2812)

Two additive changes for the redesigned round email and the upcoming "contacted" mark (v2.2813):

1. **`gc_statement_round_marks`**: the `action` check widens to `sent | skipped | contacted`; new nullable columns `temperature` (CHECK `hot | warm | cool | cold`) and `expected_pay_by date`. Table comment rewritten. Only `sent` ever feeds the last-sent pills or the week's sent count — the client filters on action.
2. **`get_statement_round_for_user`** re-created (4th cut; the v2.2779 client-row-key diff is unchanged). Per ready GC it now returns `over_90` (remaining on rows aged 90+ days), `certified_at`, `ap_email` / `ap_phone` (`customers.contact_info`), `last_statement_at` (newest of a sent mark and an app-sent `gc_statement_emails` row, any week), `last_word` (newest mark with a note: note / by / at / action / temperature), `last_temperature`, `expected_pay_by`. Top level adds `deadline` (Friday of the Chicago Monday-keyed week), `held.items` (gc, amount, reason `changed | uncertified`, the sender's own), `contacted_by_me`, `book_total`. `held.count/total` are now the SENDER's held GCs (were company-wide).

`CREATE OR REPLACE` / `ADD COLUMN IF NOT EXISTS` / drop-then-add checks; no new table.
