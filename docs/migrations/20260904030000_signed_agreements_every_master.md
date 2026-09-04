# 20260904030000_signed_agreements_every_master (v2.2748, 2026-09-04)

**Why.** The Signed agreements recipient rule (v2.2743) runs candidates through the org-scope filter, which dropped a master who owns a different org from the estimate's master. Owner: every master should hear about every signature.

**What.** Re-creates `signed_agreement_notify_recipients(p_master_user_id)`: the candidate set (explicit list, else the four default roles) is still org-scoped for assistants, controllers and devs, but **masters in the candidate set always receive** (active, non-twin, with an email). Result is the distinct union. No data change.
