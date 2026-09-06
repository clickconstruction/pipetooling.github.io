# 20260906030000_public_page_views_viewer.sql (2026-09-05, v2.2922)

Sub-portal visit trail — who looked at a sub's public page: the outside (the sub, or whoever they forwarded the link to), a signed-in teammate, or the office's own preview. Additive and idempotent; no new table, so the two read-only fence calls at the end are a re-apply, not a requirement.

1. **`public_page_views.viewer text`** (`CHECK viewer IS NULL OR viewer IN ('outside','staff','preview')`) and **`viewer_user_id uuid`** (no FK on purpose — a removed account must not erase the trail). `NULL` viewer = a row written before this migration under the count rule (journey-map #37), i.e. an outside open; every reader treats NULL as outside. The `sub-portal` edge function now writes **every** validated load with its viewer (before: only counted loads, office looks dropped at the door); the customer-portal function is unchanged.
2. **Index** `public_page_views_surface_entity_occurred_idx (surface, entity_id, occurred_at DESC)` — the trail and the summaries read newest-first per person.
3. **`public._sub_portal_visits_gate()`** — STABLE SECURITY DEFINER: `is_dev() OR is_assistant() OR is_superintendent() OR role = 'master_technician'` — the sub-portal-links readers plus superintendents (they read Jobs → Sub Labor). Anon revoked.
4. **`public.sub_portal_visit_summary(p_person_ids uuid[]) → (person_id, outside_opens, first_outside_at, last_outside_at, staff_looks, last_staff_at, last_staff_user_id, last_staff_name)`** — one row per requested id (zeros when nothing on record), outside = `viewer IS NULL OR 'outside'`, staff name joined from `users`. SECURITY DEFINER, gated by (3) in the WHERE (zero rows for anyone else). Feeds the pay run's Who's owed line, the sheet story's Portal cell and the globe's gear in one call.
5. **`public.sub_portal_visits(p_person_id uuid, p_limit int = 200) → (occurred_at, viewer, via, staff_user_id, staff_name)`** — the trail newest-first, previews excluded, limit clamped 1–500. Same gate. Feeds the visits modal.

**Order.** Push this **before** deploying `sub-portal`: the function's new insert carries the two columns and, when that insert fails (columns missing), falls back to the old row for counted loads only — so nothing is lost either way, but staff looks are dropped until the columns exist. The client calls the RPCs with `as never` (generated types not regenerated here); until the push the calls fail quietly and the visit lines simply do not render.

**Verify after push.**

```sql
select column_name from information_schema.columns where table_name = 'public_page_views' and column_name in ('viewer','viewer_user_id');
select * from public.sub_portal_visit_summary(array(select person_id from public.sub_portal_links where revoked_at is null));
select * from public.sub_portal_visits((select person_id from public.sub_portal_links where revoked_at is null limit 1), 20);
```
