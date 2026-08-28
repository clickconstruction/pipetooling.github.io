import { describe, expect, it } from 'vitest'
import {
  diffCtRoster,
  type CtRosterRow,
  type PtRosterRow,
} from '../../supabase/functions/_shared/ctRosterDiff'

function ptRow(over: Partial<PtRosterRow>): PtRosterRow {
  return { id: 'pt-1', email: 'a@x.com', name: 'A', archived_at: null, is_digital_twin: false, counttooling_user_id: null, ...over }
}
function ctRow(over: Partial<CtRosterRow>): CtRosterRow {
  return { ct_user_id: 'ct-1', email: 'a@x.com', is_digital_twin: false, is_admin: false, active: true, ...over }
}

describe('diffCtRoster', () => {
  it('clean when linked pairs agree', () => {
    const d = diffCtRoster(
      [ptRow({ counttooling_user_id: 'ct-1' })],
      [ctRow({})],
    )
    expect(d.clean).toBe(true)
  })

  it('onlyInCt: CT account with no link and no matching PT email', () => {
    const d = diffCtRoster([ptRow({})], [ctRow({ ct_user_id: 'ct-9', email: 'stranger@x.com' })])
    expect(d.onlyInCt.map((c) => c.ct_user_id)).toEqual(['ct-9'])
    // The PT user with the same-but-unlinked email is a backfill candidate, not drift.
    expect(d.clean).toBe(false)
  })

  it('a CT account matching an unlinked PT email is a backfill candidate, not onlyInCt', () => {
    const d = diffCtRoster([ptRow({ email: 'b@x.com' })], [ctRow({ ct_user_id: 'ct-2', email: 'b@x.com' })])
    expect(d.onlyInCt).toEqual([])
    expect(d.backfillCandidates).toHaveLength(1)
    expect(d.backfillCandidates[0]?.ct.ct_user_id).toBe('ct-2')
  })

  it('archived PT users are not backfill candidates', () => {
    const d = diffCtRoster(
      [ptRow({ email: 'b@x.com', archived_at: '2026-01-01T00:00:00Z' })],
      [ctRow({ ct_user_id: 'ct-2', email: 'b@x.com' })],
    )
    expect(d.backfillCandidates).toEqual([])
    // …but the CT seat still shows as unmanaged? No — the email matches a PT user, so
    // it is not onlyInCt either; the activeMismatch check only runs on LINKED pairs.
    expect(d.onlyInCt).toEqual([])
  })

  it('linkedButGone: PT join key pointing at a vanished CT account', () => {
    const d = diffCtRoster([ptRow({ counttooling_user_id: 'ct-gone' })], [])
    expect(d.linkedButGone).toHaveLength(1)
  })

  it('twin flag mismatch on a linked pair', () => {
    const d = diffCtRoster(
      [ptRow({ counttooling_user_id: 'ct-1', is_digital_twin: true })],
      [ctRow({ is_digital_twin: false })],
    )
    expect(d.twinFlagMismatch).toHaveLength(1)
  })

  it('active mismatch: archived on PT but still active on CT (the offboarding hole)', () => {
    const d = diffCtRoster(
      [ptRow({ counttooling_user_id: 'ct-1', archived_at: '2026-08-01T00:00:00Z' })],
      [ctRow({ active: true })],
    )
    expect(d.activeMismatch).toHaveLength(1)
  })

  it('email changed under a linked uuid', () => {
    const d = diffCtRoster(
      [ptRow({ counttooling_user_id: 'ct-1', email: 'new@x.com' })],
      [ctRow({ email: 'old@x.com' })],
    )
    expect(d.emailChanged).toHaveLength(1)
  })

  it('twin fleet domains normalize — cross-app twin pair is NOT an email change', () => {
    const d = diffCtRoster(
      [ptRow({ counttooling_user_id: 'ct-1', email: 'twin-estimator-1@twins.pipetooling.local', is_digital_twin: true })],
      [ctRow({ email: 'twin-estimator-1@twins.counttooling.local', is_digital_twin: true })],
    )
    expect(d.emailChanged).toEqual([])
    expect(d.clean).toBe(true)
  })

  it('emails compare case-insensitively', () => {
    const d = diffCtRoster(
      [ptRow({ counttooling_user_id: 'ct-1', email: 'A@X.com' })],
      [ctRow({ email: 'a@x.com' })],
    )
    expect(d.emailChanged).toEqual([])
  })
})
