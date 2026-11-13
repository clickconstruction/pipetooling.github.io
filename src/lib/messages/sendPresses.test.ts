import { describe, expect, it } from 'vitest'
import { SHOW_WORDS } from '../firstLook/ask'
import { slashPaperKind, slashWordAt } from '../quickReplies/slash'
import { SEND_PRESS_TYPED, SEND_PRESSES, sendPressesHead, sendPressesShown, withSlashWord } from './sendPresses'

describe('the three presses over the reply box (punch list #319 PR 1b)', () => {
  it('names the person, never a guessed pronoun', () => {
    expect(sendPressesHead('Dana')).toBe('Send Dana')
    expect(sendPressesHead(null)).toBe('Send them')
    expect(sendPressesHead('  ')).toBe('Send them')
  })

  it('draws on a text for the office team alone', () => {
    const on = { role: 'assistant' as const, kind: 'text', who: 'customer', folded: false, textWaits: false, settling: false }
    expect(sendPressesShown(on)).toBe(true)
    for (const role of ['dev', 'master_technician', 'controller', 'estimator'] as const) expect(sendPressesShown({ ...on, role })).toBe(true)
    for (const role of ['primary', 'helpers', 'subcontractor', 'superintendent', null] as const) expect(sendPressesShown({ ...on, role })).toBe(false)
    for (const who of ['lead', 'unknown']) expect(sendPressesShown({ ...on, who })).toBe(true)
    for (const who of ['team', 'trade', 'arch', 'sub', 'supply_house', 'candidate']) expect(sendPressesShown({ ...on, who })).toBe(false)
    expect(sendPressesShown({ ...on, kind: 'email' })).toBe(false)
    expect(sendPressesShown({ ...on, kind: 'note' })).toBe(false)
    expect(sendPressesShown({ ...on, folded: true })).toBe(false)
    expect(sendPressesShown({ ...on, textWaits: true })).toBe(false)
    expect(sendPressesShown({ ...on, settling: true })).toBe(false)
  })

  it('a press writes its word where the / list opens on it', () => {
    const empty = withSlashWord('', 'estimate')
    expect(empty).toEqual({ text: '/estimate', caret: 9 })
    expect(slashPaperKind(slashWordAt(empty.text, empty.caret)!.words)).toBe('estimate')
    const under = withSlashWord('Thanks for the call. \n', 'bill')
    expect(under.text).toBe('Thanks for the call.\n/bill')
    const word = slashWordAt(under.text, under.caret)!
    expect(word.start).toBe(21)
    expect(slashPaperKind(word.words)).toBe('bill')
  })

  it('each hover line ends with the word that does the same when typed (v2.7123)', () => {
    expect(SEND_PRESSES.photosTip.endsWith('Same as typing /show.')).toBe(true)
    expect(SEND_PRESSES.estimateTip.endsWith('Same as typing /estimate.')).toBe(true)
    expect(SEND_PRESSES.billTip.endsWith('Same as typing /bill.')).toBe(true)
    // The words are ones the box knows: /show opens the ask, the other two open their list.
    expect(SHOW_WORDS).toContain(SEND_PRESS_TYPED.photos.slice(1))
    expect(slashPaperKind(SEND_PRESS_TYPED.estimate.slice(1))).toBe('estimate')
    expect(slashPaperKind(SEND_PRESS_TYPED.bill.slice(1))).toBe('bill')
  })
})
