import { describe, expect, it } from 'vitest'
import { canTakeBackItem, fieldsWithTakeBack, runNoticesTakenBack, runPrintedItemIds, runTakeBackConfirm, runTakenBackOf, runTakenBackWords, runTypedTrackingCount, takenBackChipWords } from './lienRunTakeBack'
import type { RunNotice } from './lienDeskRun'

const rec = (tracking: string, method: RunNotice['recipients'][number]['method'] = 'certified_mail') => ({ key: 'owner' as const, label: 'Owner of record', name: 'A', address: '1 St', email: '', method, tracking })
const n = (itemId: string, printedAt: string | null, recipients = [rec('')]) => ({ itemId, printedAt, recipients }) as Pick<RunNotice, 'itemId' | 'printedAt' | 'recipients'>

describe('lienRunTakeBack', () => {
  it('reads the line back, and ignores what is not one', () => {
    expect(runTakenBackOf(null)).toBeNull()
    expect(runTakenBackOf({ runTakenBack: { by: 'u1' } })).toBeNull()
    expect(runTakenBackOf({ runTakenBack: { at: '2026-10-08T15:00:00Z', by: 'u1', byName: '  Dana ', printedAt: '2026-10-07T16:00:00Z' } })).toEqual({ at: '2026-10-08T15:00:00Z', by: 'u1', byName: 'Dana', printedAt: '2026-10-07T16:00:00Z' })
  })

  it('writes the line and keeps every other field', () => {
    const t = { at: '2026-10-08T15:00:00Z', by: 'u1', byName: 'Dana', printedAt: '2026-10-07T16:00:00Z' }
    expect(fieldsWithTakeBack({ ownerCall: { x: 1 }, runTakenBack: { at: 'old' } }, t)).toEqual({ ownerCall: { x: 1 }, runTakenBack: t })
    expect(fieldsWithTakeBack(null, t)).toEqual({ runTakenBack: t })
    expect(fieldsWithTakeBack([1], t)).toEqual({ runTakenBack: t })
  })

  it('takes back only a printed row that is not sent, missed or voided', () => {
    expect(canTakeBackItem({ printed_at: '2026-10-07T16:00:00Z', status: 'approved' })).toBe(true)
    expect(canTakeBackItem({ printed_at: null, status: 'approved' })).toBe(false)
    expect(canTakeBackItem({ printed_at: '2026-10-07T16:00:00Z', status: 'sent' })).toBe(false)
    expect(canTakeBackItem({ printed_at: '2026-10-07T16:00:00Z', status: 'missed' })).toBe(false)
    expect(canTakeBackItem({ printed_at: '2026-10-07T16:00:00Z', status: 'approved', voided_at: '2026-10-07T17:00:00Z' })).toBe(false)
  })

  it('the printed items: before this sitting or in it, in run order, once each', () => {
    expect(runPrintedItemIds([n('a', '2026-10-07T16:00:00Z'), n('b', null), n('c', null), n('a', '2026-10-07T16:00:00Z')], ['c'])).toEqual(['a', 'c'])
    expect(runPrintedItemIds([n('b', null)])).toEqual([])
  })

  it('counts the typed numbers a take-back drops: paper sends only, on the items taken back', () => {
    const notices = [n('a', 'x', [rec('9407 1'), rec('', 'certified_mail')]), n('b', 'x', [rec('jo', 'hand'), rec('', 'email')]), n('c', null, [rec('9407 2')])]
    expect(runTypedTrackingCount(notices, ['a', 'b'])).toBe(1)
    expect(runTypedTrackingCount(notices, ['a', 'c'])).toBe(2)
  })

  it('clears the printed day and the typed numbers on the items taken back, and leaves the rest', () => {
    const out = runNoticesTakenBack([n('a', 'x', [rec('9407 1')]), n('b', 'y', [rec('9407 2')])], ['a'])
    expect(out[0]).toMatchObject({ printedAt: null, recipients: [{ tracking: '' }] })
    expect(out[1]).toMatchObject({ printedAt: 'y', recipients: [{ tracking: '9407 2' }] })
  })

  it('the confirm in plain sentences', () => {
    const all = runTakeBackConfirm({ count: 19, printedAt: '2026-10-07T16:00:00Z', typed: 0, all: true })
    expect(all.title).toBe('Take back the run?')
    expect(all.button).toBe('Take back 19 notices')
    expect(all.lines).toEqual([
      'The 19 notices go back to Ready to send. The approvals stand.',
      'Then print the packet again. It prints the way the app draws it today.',
      'The copies printed Oct 7 stay in each job’s Documents, filed as printed.',
    ])
    const one = runTakeBackConfirm({ count: 1, printedAt: null, typed: 1, all: false })
    expect(one.title).toBe('Take back the 1 notice that printed?')
    expect(one.lines).toContain('The notice goes back to Ready to send. The approvals stand.')
    expect(one.lines).toContain('The copy printed stays in the job’s Documents, filed as printed.')
    expect(one.lines).toContain('The tracking number typed here is not saved.')
    expect(one.lines).toContain('The notices in this run that have not printed stay as they are.')
    expect(runTakeBackConfirm({ count: 2, printedAt: null, typed: 3, all: true }).lines).toContain('The 3 tracking numbers typed here are not saved.')
  })

  it('the strip after, and the ready chip’s line', () => {
    expect(runTakenBackWords(19, '2026-10-07T16:00:00Z')).toBe('Taken back. The 19 notices printed October 7, 2026 are in Ready to send again. Print the packet when it is ready.')
    expect(runTakenBackWords(1, null)).toBe('Taken back. The notice is in Ready to send again. Print the packet when it is ready.')
    expect(takenBackChipWords(null)).toBeNull()
    expect(takenBackChipWords({ at: '2026-10-08T15:00:00Z', by: 'u1', byName: 'Dana', printedAt: '2026-10-07T16:00:00Z' })).toEqual({ tail: 'taken back Oct 8', sentence: 'Printed Oct 7, taken back Oct 8 by Dana. Nothing was mailed.' })
    expect(takenBackChipWords({ at: '2026-10-08T15:00:00Z', by: null, byName: null, printedAt: null })!.sentence).toBe('Taken back Oct 8. Nothing was mailed.')
  })
})
