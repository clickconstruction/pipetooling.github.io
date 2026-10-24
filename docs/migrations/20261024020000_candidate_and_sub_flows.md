# 20261024020000_candidate_and_sub_flows.sql (2026-10-24, v2.5812)

Flows, the candidate's own flow and the sub flow's Once lane (the 2026-10-23 design spike; the kernels are `src/lib/flows/facts.ts`, `seed.ts`, `candidateLoad.ts` and `subOnboardingLoad.ts`). No column is added and no table made.

- **`flows.kind`** may also be `candidate` (`flows_kind_known` widened to the seven, in `FLOW_KINDS`' order).
- **`flow_fact_ids()`** gains ten facts after `sub_paid`, in `facts.ts`'s order: `qualifications_noted`, `cand_called`, `cand_trial`, `cand_hired`, `cand_passed`, then `sub_reached`, `sub_agreement`, `sub_first_done`, `sub_kept`, `sub_let_go`. `flow_paper_ids()` stays as the residential flow left it.
- **`flows_seed()`** seeds every flow from `SEED_FLOWS` again, the candidate flow now among them (one Once lane of four steps, Screening call to Hired or passed); on prod it adds the candidate flow alone, since every other kind has its flow.
- **The sub flow's Once lane** (reached, qualifications, w9, coi, agreement, first, kept) is inserted into the sub flow prod already holds, each step once (`flow_steps_key_once`), so a second run adds nothing.

Generated from the kernels by the spike's `gen-candidate-flow-sql.ts` so `flowsSql.test.ts` reads it back exactly. Additive. The older `20261014050000_residential_flow.sql` names the candidate in its kinds list too, since the residential bed re-applies that file after every migration and a six-kind list would then refuse the candidate row; prod had that file applied long before, so the edit changes nothing there. The three bed scenarios that count the flows (`residential_flow`, `sub_flow`, `messages_flows`) read seven. Shipped with v2.5812 (`feat/flows-candidate-sub-qualifications`); `supabase db push` after the merge, the client deployed first or after without harm: the old client never asks for the candidate flow, and the new one lends the seed's Once lane to a sub until this lands.
