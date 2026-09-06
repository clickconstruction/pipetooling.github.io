import { describe, expect, it } from 'vitest'
import {
  bidOutcomeSetTarget,
  inferWonCascadeSnapshot,
  wonCascadeConfirmMessage,
  wonCascadeNeedsConfirm,
  wonCascadeNoteBody,
  wonCascadePlan,
  wonCascadeUndo,
  wonCascadeUndoNoteBody,
  type CascadePacket,
  type WonCascadeSnapshot,
} from './wonCascade'

const own: CascadePacket = { key: '', name: 'Burd & Assoc.', outcome: null, sentOn: '2026-08-20', versionIds: ['v1'] }
const southern: CascadePacket = { key: 'c2', name: 'Southern Post', outcome: null, sentOn: '2026-08-21', versionIds: ['v2', 'v2b'] }
const unsent: CascadePacket = { key: 'c3', name: 'PlanHub', outcome: null, sentOn: null, versionIds: ['v3'] }
const alreadyLost: CascadePacket = { key: 'c4', name: 'MERIT', outcome: 'lost', sentOn: '2026-08-19', versionIds: ['v4'] }
const shared: CascadePacket = { key: 'shared:c5', name: 'Rider', outcome: null, sentOn: '2026-08-20', versionIds: [], sharedLetter: true }

describe('wonCascadePlan', () => {
  it('names the sent, unanswered siblings and the bid roll; skips unsent, answered and shared-letter packets', () => {
    const plan = wonCascadePlan({ outcome: null }, [own, southern, unsent, alreadyLost, shared], '')
    expect(plan.target?.name).toBe('Burd & Assoc.')
    expect(plan.willLose.map((p) => p.name)).toEqual(['Southern Post'])
    expect(plan.willLoseGcIds).toEqual(['c2'])
    expect(plan.willRollBidOutcome).toBe(true)
    expect(plan.overridesHandSetOutcome).toBeNull()
  })

  it('says so when the roll overrides a hand-set Lost', () => {
    const plan = wonCascadePlan({ outcome: 'lost' }, [own, southern], 'c2')
    expect(plan.willRollBidOutcome).toBe(true)
    expect(plan.overridesHandSetOutcome).toBe('lost')
    expect(plan.bidOutcomeBefore).toBe('lost')
  })

  it('does not roll a bid already won or started', () => {
    expect(wonCascadePlan({ outcome: 'won' }, [own, southern], '').willRollBidOutcome).toBe(false)
    expect(wonCascadePlan({ outcome: 'started_or_complete' }, [own, southern], '').willRollBidOutcome).toBe(false)
    expect(wonCascadePlan({ outcome: 'started_or_complete' }, [own, southern], '').overridesHandSetOutcome).toBeNull()
  })

  it('needs the confirm whenever anything beyond the tapped packet changes', () => {
    expect(wonCascadeNeedsConfirm(wonCascadePlan({ outcome: null }, [own], ''))).toBe(true) // the bid rolls
    expect(wonCascadeNeedsConfirm(wonCascadePlan({ outcome: 'won' }, [own, alreadyLost], ''))).toBe(false)
    expect(wonCascadeNeedsConfirm(wonCascadePlan({ outcome: 'won' }, [own, southern], ''))).toBe(true) // a sibling loses
  })
})

describe('wonCascadeConfirmMessage', () => {
  it('states the cascade before the tap, naming the GCs', () => {
    const msg = wonCascadeConfirmMessage(wonCascadePlan({ outcome: null }, [own, southern, unsent], ''))
    expect(msg).toBe('Mark Burd & Assoc. Won? This marks the other GC (Southern Post) Lost — GC lost the project and the bid Won. ↩ waiting on the winner puts all of it back.')
  })

  it('calls out a hand-set Lost it will flip', () => {
    const msg = wonCascadeConfirmMessage(wonCascadePlan({ outcome: 'lost' }, [own, southern], 'c2'))
    expect(msg).toContain('This marks the other GC (Burd & Assoc.) Lost — GC lost the project and the bid Won.')
    expect(msg).toContain('The bid is currently marked Lost by hand — it flips to Won.')
  })

  it('joins three names with an and, and says when only the packet changes', () => {
    const third: CascadePacket = { ...unsent, sentOn: '2026-08-22' }
    expect(wonCascadeConfirmMessage(wonCascadePlan({ outcome: 'won' }, [own, southern, third], ''))).toContain('(Southern Post and PlanHub) Lost')
    const fourth: CascadePacket = { key: 'c6', name: 'Acme', outcome: null, sentOn: '2026-08-22', versionIds: ['v6'] }
    expect(wonCascadeConfirmMessage(wonCascadePlan({ outcome: 'won' }, [own, southern, third, fourth], ''))).toContain('(Southern Post, PlanHub and Acme) Lost')
    expect(wonCascadeConfirmMessage(wonCascadePlan({ outcome: 'won' }, [own, alreadyLost], ''), { gcName: 'Burd' })).toBe("Mark Burd Won? Only Burd's packet changes.")
  })
})

const sessionSnapshot: WonCascadeSnapshot = {
  bidId: 'b1',
  targetKey: '',
  targetVersionIds: ['v1'],
  versions: [
    { id: 'v1', outcome: null, outcome_at: null, loss_category: null },
    { id: 'v2', outcome: null, outcome_at: null, loss_category: null },
    { id: 'v2b', outcome: null, outcome_at: null, loss_category: null },
  ],
  autoLostNames: ['Southern Post'],
  bidOutcomeBefore: 'lost',
  bidOutcomeWritten: true,
  takenAt: '2026-09-05T15:00:00Z',
  source: 'session',
}

describe('wonCascadeUndo', () => {
  it('puts the winner back to waiting, restores the siblings, and un-rolls the bid to what it was — a hand-set Lost included', () => {
    const undo = wonCascadeUndo(sessionSnapshot)
    expect(undo.versionPatches).toEqual([
      { id: 'v1', outcome: null, outcome_at: null, loss_category: null },
      { id: 'v2', outcome: null, outcome_at: null, loss_category: null },
      { id: 'v2b', outcome: null, outcome_at: null, loss_category: null },
    ])
    expect(undo.bidPatch).toEqual({ outcome: 'lost' })
    expect(undo.restoredSiblingNames).toEqual(['Southern Post'])
  })

  it('restores a sibling that had its own prior answer, and leaves bids.outcome alone when the cascade never wrote it', () => {
    const snap: WonCascadeSnapshot = {
      ...sessionSnapshot,
      versions: [
        { id: 'v1', outcome: 'lost', outcome_at: '2026-08-30', loss_category: 'price' },
        { id: 'v4', outcome: 'lost', outcome_at: '2026-08-19', loss_category: 'price' },
      ],
      targetVersionIds: ['v1'],
      autoLostNames: [],
      bidOutcomeBefore: 'won',
      bidOutcomeWritten: false,
    }
    const undo = wonCascadeUndo(snap)
    // The winner's own prior Lost is not restored — "↩ waiting" means waiting.
    expect(undo.versionPatches[0]).toEqual({ id: 'v1', outcome: null, outcome_at: null, loss_category: null })
    expect(undo.versionPatches[1]).toEqual({ id: 'v4', outcome: 'lost', outcome_at: '2026-08-19', loss_category: 'price' })
    expect(undo.bidPatch).toBeNull()
  })
})

describe('inferWonCascadeSnapshot (no session snapshot — reload or signature-set Won)', () => {
  const rows = [
    { id: 'v1', outcome: 'won', outcome_at: '2026-09-01', loss_category: null },
    { id: 'v2', outcome: 'lost', outcome_at: '2026-09-01', loss_category: null },
    { id: 'v2b', outcome: 'lost', outcome_at: '2026-09-01', loss_category: null },
    { id: 'v4', outcome: 'lost', outcome_at: '2026-08-19', loss_category: 'price' },
    { id: 'v7', outcome: 'lost', outcome_at: '2026-09-01', loss_category: 'scope' },
  ]
  const reasoned: CascadePacket = { key: 'c7', name: 'Reasoned', outcome: 'lost', sentOn: '2026-08-25', versionIds: ['v7'] }

  it('treats same-day, reason-less Lost siblings as the cascade and leaves reasoned or earlier losses alone', () => {
    const snap = inferWonCascadeSnapshot({ bidId: 'b1', bidOutcome: 'won', gcs: [own, southern, alreadyLost, reasoned, shared], targetKey: '', rows, nowIso: '2026-09-05T15:00:00Z' })
    expect(snap.source).toBe('inferred')
    expect(snap.autoLostNames).toEqual(['Southern Post'])
    expect(snap.versions.map((v) => v.id)).toEqual(['v1', 'v2', 'v2b'])
    expect(snap.bidOutcomeWritten).toBe(true)
    expect(snap.bidOutcomeBefore).toBeNull()
    const undo = wonCascadeUndo(snap)
    expect(undo.bidPatch).toEqual({ outcome: null })
    expect(undo.versionPatches.every((v) => v.outcome === null && v.outcome_at === null && v.loss_category === null)).toBe(true)
  })

  it('does not touch bids.outcome when the bid does not read won', () => {
    const snap = inferWonCascadeSnapshot({ bidId: 'b1', bidOutcome: 'started_or_complete', gcs: [own, southern], targetKey: '', rows, nowIso: '2026-09-05T15:00:00Z' })
    expect(snap.bidOutcomeWritten).toBe(false)
    expect(wonCascadeUndo(snap).bidPatch).toBeNull()
  })
})

describe('telemetry + notes', () => {
  it('bid_outcome_set target carries path and undone', () => {
    expect(bidOutcomeSetTarget('board', 'won', false)).toBe('#board:won')
    expect(bidOutcomeSetTarget('edit-bid', null, false)).toBe('#edit-bid:waiting')
    expect(bidOutcomeSetTarget('waiting-to-hear', null, true)).toBe('#waiting-to-hear:undone')
  })

  it('the packet path finally writes a Win/Loss note, both ways', () => {
    expect(wonCascadeNoteBody({ gcName: 'Southern Post', autoLostNames: ['Burd & Assoc.'], bidOutcomeSet: true, overrodeHandSet: 'lost' })).toBe(
      'Marked Won via packet — Southern Post · siblings marked Lost: Burd & Assoc. (GC lost the project) · bid Lost → Won.',
    )
    expect(wonCascadeNoteBody({ gcName: 'Southern Post', autoLostNames: [], bidOutcomeSet: false, overrodeHandSet: null })).toBe('Marked Won via packet — Southern Post.')
    expect(wonCascadeUndoNoteBody({ gcName: 'Southern Post', restoredSiblingNames: ['Burd & Assoc.'], bidOutcomeRestoredTo: 'lost' })).toBe(
      'Won undone via packet — Southern Post back to waiting · Burd & Assoc. back to waiting · bid back to Lost.',
    )
    expect(wonCascadeUndoNoteBody({ gcName: 'X', restoredSiblingNames: [], bidOutcomeRestoredTo: undefined })).toBe('Won undone via packet — X back to waiting.')
  })
})
