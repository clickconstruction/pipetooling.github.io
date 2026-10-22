import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { ARCHIVED_TOAST, RESTORED_TOAST, archiveTwinBody, archiveTwinConfirm, archivedFoldWords, archivedOnWords, liveKeysOf, restoreTwinConfirm, splitFleet } from './fleetArchive'

const one = { id: 'u-1', name: 'Twin Estimator 1', email: 'twin-estimator-1@twins.pipetooling.local', archived_at: null }
const two = { id: 'u-2', name: 'Twin Estimator 2', email: 'twin-estimator-2@twins.pipetooling.local', archived_at: '2026-10-22T18:00:00.000Z' }
const pricer = { id: 'u-3', name: null, email: 'twin-pricer-1@twins.pipetooling.local', archived_at: null }
const old = { id: 'u-4', name: 'Twin Estimator 3', email: 'twin-estimator-3@twins.pipetooling.local', archived_at: '2026-09-01T12:00:00.000Z' }

describe('fleetArchive (v2.5741)', () => {
  it('splits the fleet: live rows by email, the archived fold newest first', () => {
    const { live, archived } = splitFleet([pricer, two, old, one])
    expect(live.map((t) => t.id)).toEqual(['u-1', 'u-3'])
    expect(archived.map((t) => t.id)).toEqual(['u-2', 'u-4'])
    expect(splitFleet([])).toEqual({ live: [], archived: [] })
  })

  it('finds the keys still live for one twin', () => {
    const keys = [
      { id: 'k-1', twin_user_id: 'u-1', revoked_at: null },
      { id: 'k-2', twin_user_id: 'u-1', revoked_at: '2026-10-01T00:00:00Z' },
      { id: 'k-3', twin_user_id: 'u-2', revoked_at: null },
    ]
    expect(liveKeysOf(keys, 'u-1').map((k) => k.id)).toEqual(['k-1'])
    expect(liveKeysOf(keys, 'u-9')).toEqual([])
  })

  it('words the archive confirm by the live keys, and names the twin by its name or its email', () => {
    expect(archiveTwinConfirm(one, 0)).toEqual({
      title: 'Archive Twin Estimator 1?',
      message: 'No key is live. Its runs, shadows and bids stay. Restore brings it back, under the fleet.',
      confirmLabel: 'Archive',
      cancelLabel: 'Keep it',
      danger: true,
      cancelIsSafe: true,
    })
    expect(archiveTwinConfirm(one, 1).message).toMatch(/^Its one live key is revoked first, so no Mac or harness can run it\./)
    expect(archiveTwinConfirm(one, 3).message).toMatch(/^Its 3 live keys are revoked first/)
    expect(archiveTwinConfirm(pricer, 0).title).toBe('Archive twin-pricer-1@twins.pipetooling.local?')
  })

  it('words the restore confirm and the toasts', () => {
    expect(restoreTwinConfirm(two)).toMatchObject({ title: 'Restore Twin Estimator 2?', confirmLabel: 'Restore', danger: false, cancelIsSafe: true })
    expect(ARCHIVED_TOAST(one, 0)).toBe('Archived Twin Estimator 1. Restore is under the fleet.')
    expect(ARCHIVED_TOAST(one, 1)).toBe('Archived Twin Estimator 1 and revoked 1 key. Restore is under the fleet.')
    expect(ARCHIVED_TOAST(one, 2)).toBe('Archived Twin Estimator 1 and revoked 2 keys. Restore is under the fleet.')
    expect(RESTORED_TOAST(two)).toBe('Restored Twin Estimator 2. It has no live key yet.')
  })

  it('builds the archive-user body with no customers to move', () => {
    expect(archiveTwinBody(two)).toEqual({ email: 'twin-estimator-2@twins.pipetooling.local', name: 'Twin Estimator 2' })
    expect(archiveTwinBody(pricer)).toEqual({ email: 'twin-pricer-1@twins.pipetooling.local', name: '' })
  })

  it('labels the fold and each row', () => {
    expect(archivedFoldWords(1)).toBe('1 archived')
    expect(archivedFoldWords(2)).toBe('2 archived')
    expect(archivedOnWords(two, 'UTC')).toBe('archived Oct 22, 2026')
    expect(archivedOnWords(one, 'UTC')).toBe('')
  })

  it('speaks in plain words', () => {
    const words = [
      archiveTwinConfirm(one, 0).message,
      archiveTwinConfirm(one, 2).message,
      restoreTwinConfirm(two).message,
      ARCHIVED_TOAST(one, 2),
      RESTORED_TOAST(two),
    ]
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })
})
