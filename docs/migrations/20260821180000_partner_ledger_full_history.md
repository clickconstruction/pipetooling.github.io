# 20260821180000_partner_ledger_full_history.sql (2026-08-21, v2.1963)

Partner "Full ledger": raises the stub cap in `partner_ledger_payload` from 26 to 520 weeks so the partner card can show complete history on demand (`p_weeks: 520`). Both resolvers (`get_my_partner_ledger`, dev lens `get_partner_ledger_as`) delegate here and inherit the cap. Body otherwise verbatim from 20260821150000. Functions only — idempotent, safe in either deploy order (client just gets fewer weeks until applied).
