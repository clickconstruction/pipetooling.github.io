import { describe, expect, it } from 'vitest'
import { runEscapeAction, runHoldSinceOpen, runHoldWords } from './lienRunEscape'
import type { RunRecipient } from './lienDeskRun'

const idle = { busy: false, overlayOpen: false, signing: false, takeBackOpen: false, moreOpen: false, hold: null }
const rcp = (key: RunRecipient['key'], over: Partial<RunRecipient> = {}): RunRecipient => ({ key, label: key, name: 'N', address: 'A', email: '', method: 'certified_mail', tracking: '', ...over })
const notice = (itemId: string, owner: Partial<RunRecipient> = {}, gc: Partial<RunRecipient> = {}) => ({ itemId, recipients: [rcp('owner', owner), rcp('original_contractor', gc)] })
const quiet = { mailedOn: '2026-10-14', openedYmd: '2026-10-14', combine: false, docUrl: '', docNote: '', ticks: [] as boolean[][] }

describe('Esc in the run window (v2.5530)', () => {
  it('peels one layer at a time: a write or an overlay keeps it, a signature waits, the take-back question and More close first, a hold keeps the run', () => {
    expect(runEscapeAction(idle)).toBe('close')
    expect(runEscapeAction({ ...idle, busy: true })).toBe('ignore')
    expect(runEscapeAction({ ...idle, overlayOpen: true, signing: true, takeBackOpen: true, moreOpen: true, hold: 'docsmit' })).toBe('ignore')
    expect(runEscapeAction({ ...idle, signing: true, takeBackOpen: true, moreOpen: true })).toBe('wait-signing')
    expect(runEscapeAction({ ...idle, takeBackOpen: true, moreOpen: true, hold: 'typed' })).toBe('close-take-back')
    expect(runEscapeAction({ ...idle, moreOpen: true, hold: 'typed' })).toBe('close-more')
    expect(runEscapeAction({ ...idle, hold: 'changed' })).toBe('hold')
  })

  it('holds over anything closing would lose, against what the run opened with', () => {
    const opened = [notice('i1', {}, { tracking: '9407 1118 0000' }), notice('i2')]
    expect(runHoldSinceOpen(opened, opened, quiet)).toBeNull()
    // A number the run opened with is not new work; padding is not a change.
    expect(runHoldSinceOpen(opened, [notice('i1', { tracking: '  ' }, { tracking: '9407 1118 0000 ' }), notice('i2')], quiet)).toBeNull()
    expect(runHoldSinceOpen(opened, [notice('i1', {}, { tracking: '9407 1118 0000' }), notice('i2', { tracking: '9407' })], quiet)).toBe('typed')
    expect(runHoldSinceOpen(opened, [notice('i1'), notice('i2')], quiet)).toBe('typed')
    expect(runHoldSinceOpen(opened, [notice('i1', { method: 'hand' }, { tracking: '9407 1118 0000' }), notice('i2')], quiet)).toBe('changed')
    expect(runHoldSinceOpen(opened, [notice('i1', { courtesy: true }, { tracking: '9407 1118 0000' }), notice('i2')], quiet)).toBe('changed')
    // A courtesy box never set reads as off: ticking it on and off again is no change.
    expect(runHoldSinceOpen(opened, [notice('i1', { courtesy: false }, { tracking: '9407 1118 0000' }), notice('i2')], quiet)).toBeNull()
    expect(runHoldSinceOpen(opened, opened, { ...quiet, mailedOn: '2026-10-13' })).toBe('changed')
    expect(runHoldSinceOpen(opened, opened, { ...quiet, combine: true })).toBe('changed')
    expect(runHoldSinceOpen(opened, opened, { ...quiet, docUrl: 'https://drive.google.com/x' })).toBe('changed')
    expect(runHoldSinceOpen(opened, opened, { ...quiet, docNote: 'filed in the blue binder' })).toBe('changed')
    expect(runHoldSinceOpen(opened, opened, { ...quiet, ticks: [[false, true, false]] })).toBe('changed')
    expect(runHoldSinceOpen(opened, opened, { ...quiet, ticks: [[false, false, false]] })).toBeNull()
    // Mailed on is measured against the day the run opened, so a run left open past midnight is not changed by it.
    expect(runHoldSinceOpen(opened, opened, { ...quiet, mailedOn: '2026-10-14', openedYmd: '2026-10-14' })).toBeNull()
  })

  it('a copy sent through Docsmit in this sitting is the strongest hold; one sent before the run opened is not new', () => {
    const opened = [notice('i1'), notice('i2')]
    const sent = { via: 'docsmit' as const, pieceId: 'p1', pieceStatus: 'sent' as const }
    expect(runHoldSinceOpen(opened, [notice('i1', sent), notice('i2', { tracking: '9407' })], quiet)).toBe('docsmit')
    // A batch that failed or stopped mailed nothing: its pieces are no change to keep.
    expect(runHoldSinceOpen(opened, [notice('i1', { via: 'docsmit', pieceId: 'p1', pieceStatus: 'failed' }), notice('i2', { via: 'docsmit', pieceId: 'p2', pieceStatus: 'prepared' })], quiet)).toBeNull()
    const openedSent = [notice('i1', sent), notice('i2')]
    expect(runHoldSinceOpen(openedSent, openedSent, quiet)).toBeNull()
    expect(runHoldWords('docsmit')).toContain('Record the run so the desk keeps them')
  })

  it('compares only the notices still in the run, so a partial record leaves its recorded ones out', () => {
    const opened = [notice('i1'), notice('i2')]
    // i1 was recorded with its number and left the run; i2 waits with nothing typed.
    expect(runHoldSinceOpen(opened, [notice('i2')], quiet)).toBeNull()
    // A notice the run did not open with counts as a change.
    expect(runHoldSinceOpen(opened, [notice('i3')], quiet)).toBe('changed')
  })
})
