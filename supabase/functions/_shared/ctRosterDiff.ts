// CT↔PT roster drift diff — the pure kernel behind the weekly ct-roster-audit email
// (v2.2438; CT bridge Phase 3). Drift is CAUGHT here, not prevented by sync machinery
// (locked decision). Lives in functions/_shared because the edge function can't bundle
// imports from src/ (the deploy bundler only reaches the functions tree); the unit tests
// in src/lib/ctRosterDiff.test.ts import THIS file, so there is still exactly one copy.
//
// Twin seats intentionally live at different fleet domains on the two apps
// (twin-estimator-1@twins.pipetooling.local ↔ …@twins.counttooling.local), so email
// comparison normalizes the fleet domains before calling anything "changed".

export type PtRosterRow = {
  id: string
  email: string
  name: string | null
  archived_at: string | null
  is_digital_twin: boolean
  counttooling_user_id: string | null
}

export type CtRosterRow = {
  ct_user_id: string
  email: string | null
  is_digital_twin: boolean
  is_admin: boolean
  active: boolean
}

export type CtRosterDiff = {
  /** CT accounts no PT row links to AND whose email matches no PT user — unmanaged seats. */
  onlyInCt: CtRosterRow[]
  /** PT rows whose counttooling_user_id no longer exists on CT — dangling join keys. */
  linkedButGone: PtRosterRow[]
  /** Linked pairs where the twin flag disagrees. */
  twinFlagMismatch: { pt: PtRosterRow; ct: CtRosterRow }[]
  /** Linked pairs where active disagrees (PT active = not archived; CT active = not banned). */
  activeMismatch: { pt: PtRosterRow; ct: CtRosterRow }[]
  /** Linked pairs whose emails differ after fleet-domain normalization. */
  emailChanged: { pt: PtRosterRow; ct: CtRosterRow }[]
  /** Unlinked active PT users whose email DOES exist on CT — backfill candidates. */
  backfillCandidates: { pt: PtRosterRow; ct: CtRosterRow }[]
  /** True when every list is empty. */
  clean: boolean
}

const FLEET_DOMAIN_RE = /@twins\.(pipetooling|counttooling)\.local$/

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase().replace(FLEET_DOMAIN_RE, '@twins.<fleet>.local')
}

export function diffCtRoster(pt: PtRosterRow[], ct: CtRosterRow[]): CtRosterDiff {
  const ctById = new Map(ct.map((c) => [c.ct_user_id, c]))
  const ctByEmail = new Map<string, CtRosterRow>()
  for (const c of ct) {
    const e = normalizeEmail(c.email)
    if (e) ctByEmail.set(e, c)
  }
  const linkedCtIds = new Set(pt.map((p) => p.counttooling_user_id).filter(Boolean) as string[])
  const ptEmails = new Set(pt.map((p) => normalizeEmail(p.email)))

  const onlyInCt = ct.filter((c) => !linkedCtIds.has(c.ct_user_id) && !ptEmails.has(normalizeEmail(c.email)))
  const linkedButGone = pt.filter((p) => p.counttooling_user_id && !ctById.has(p.counttooling_user_id))

  const twinFlagMismatch: CtRosterDiff['twinFlagMismatch'] = []
  const activeMismatch: CtRosterDiff['activeMismatch'] = []
  const emailChanged: CtRosterDiff['emailChanged'] = []
  for (const p of pt) {
    const c = p.counttooling_user_id ? ctById.get(p.counttooling_user_id) : undefined
    if (!c) continue
    if (p.is_digital_twin !== c.is_digital_twin) twinFlagMismatch.push({ pt: p, ct: c })
    const ptActive = p.archived_at == null
    if (ptActive !== c.active) activeMismatch.push({ pt: p, ct: c })
    if (normalizeEmail(p.email) !== normalizeEmail(c.email)) emailChanged.push({ pt: p, ct: c })
  }

  const backfillCandidates: CtRosterDiff['backfillCandidates'] = []
  for (const p of pt) {
    if (p.counttooling_user_id || p.archived_at != null) continue
    const c = ctByEmail.get(normalizeEmail(p.email))
    if (c && !linkedCtIds.has(c.ct_user_id)) backfillCandidates.push({ pt: p, ct: c })
  }

  const clean =
    onlyInCt.length === 0 &&
    linkedButGone.length === 0 &&
    twinFlagMismatch.length === 0 &&
    activeMismatch.length === 0 &&
    emailChanged.length === 0 &&
    backfillCandidates.length === 0

  return { onlyInCt, linkedButGone, twinFlagMismatch, activeMismatch, emailChanged, backfillCandidates, clean }
}
