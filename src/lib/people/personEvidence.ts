/**
 * Evidence on a person's file (v2.6392): a record — the day it is about, a title, a memo, its files — and the rules on
 * it. The kernel lives in `supabase/functions/_shared/personEvidence.ts`, with no app import, so the panel and the dev
 * MCP's `plan_person_evidence` / `apply_person_evidence` stage a file under one path rule and one set of caps; this
 * file is the app's door to it, as `personTimeline.ts` is to the Timeline's kernel.
 */
export * from '../../../supabase/functions/_shared/personEvidence'
