import { describe, expect, it } from 'vitest'
import { accountQuietWords, headerScrollState, jobAccountsLine, jobWindowMoneyLine, jobWindowSheetRows, pressPad, pressPadFromInside, PRESS_TARGET, SHEET_LABELS, type JobWindowSheetDoors } from './jobWindowPhone'
import type { EditJobBillingBar } from './editJobBillingBar'

describe('headerScrollState', () => {
  it('keeps the header while the strip is still on screen', () => {
    expect(headerScrollState({ top: 0, lastTop: 0, headBottom: 120, wasPinned: false })).toEqual({ headGone: false, stripPinned: false })
    expect(headerScrollState({ top: 120, lastTop: 90, headBottom: 120, wasPinned: true })).toEqual({ headGone: false, stripPinned: false })
  })

  it('hides the header once the strip has gone, and pins the strip (with its ✕) on a scroll back up', () => {
    expect(headerScrollState({ top: 400, lastTop: 380, headBottom: 120, wasPinned: false })).toEqual({ headGone: true, stripPinned: false })
    expect(headerScrollState({ top: 380, lastTop: 400, headBottom: 120, wasPinned: false })).toEqual({ headGone: true, stripPinned: true })
    // A scroll back down unpins it.
    expect(headerScrollState({ top: 420, lastTop: 380, headBottom: 120, wasPinned: true })).toEqual({ headGone: true, stripPinned: false })
  })

  it('treats a move under 4 px as a touch settling and keeps the last state', () => {
    expect(headerScrollState({ top: 401, lastTop: 400, headBottom: 120, wasPinned: true }).stripPinned).toBe(true)
    expect(headerScrollState({ top: 399, lastTop: 400, headBottom: 120, wasPinned: false }).stripPinned).toBe(false)
  })
})

describe('pressPad', () => {
  it('grows a short press to 44 tall and a narrow one to 44 wide, half each side, rounded up', () => {
    expect(pressPad({ width: 86, height: 20 })).toEqual({ x: 0, y: 12 })
    expect(pressPad({ width: 23, height: 23 })).toEqual({ x: 11, y: 11 })
    expect(pressPad({ width: 21, height: 40 })).toEqual({ x: 12, y: 0 })
    expect(pressPad({ width: 344, height: 38 })).toEqual({ x: 0, y: 3 })
  })

  it('leaves a press that is 40 or more both ways, and one not drawn, alone', () => {
    expect(pressPad({ width: 40, height: 40 })).toBeNull()
    expect(pressPad({ width: 300, height: 44 })).toBeNull()
    expect(pressPad({ width: 0, height: 0 })).toBeNull()
  })
})

const allDoors: JobWindowSheetDoors = { share: true, calendar: true, nextBlock: 'next: Sat 8:00 AM', account: true, accountQuiet: 'none yet', money: true, paid: true, task: true, taskReady: true, change: true }

describe('jobWindowSheetRows', () => {
  it('draws every door in the press count’s order, the ? card last', () => {
    const rows = jobWindowSheetRows(allDoors)
    expect(rows.map((r) => r.label)).toEqual(['Share the job', 'Open the calendar', 'Add job account', 'Money story', 'Email the paid-in-full report', 'Send as a task', 'Make change order', 'What this window holds'])
    expect(rows[1]?.quiet).toBe('next: Sat 8:00 AM')
    expect(rows[2]?.quiet).toBe('none yet')
    expect(rows.every((r) => !r.dead)).toBe(true)
  })

  it('leaves out the doors a role lacks and draws Send as a task dead until the job loads', () => {
    const rows = jobWindowSheetRows({ ...allDoors, share: false, money: false, paid: false, change: false, taskReady: false })
    expect(rows.map((r) => r.key)).toEqual(['calendar', 'account', 'task', 'legend'])
    expect(rows[2]).toMatchObject({ dead: true, quiet: 'loading…' })
  })

  it('names the renamed presses the owner’s way', () => {
    expect(SHEET_LABELS.account).toBe('Add job account')
    expect(SHEET_LABELS.paid).toBe('Email the paid-in-full report')
    expect(SHEET_LABELS.change).toBe('Make change order')
  })

  it('writes the quiet words', () => {
    expect(accountQuietWords([])).toBe('none yet')
    expect(accountQuietWords([{ house: 'Ferguson', day: 'Nov 3' }, { house: 'Reece', day: 'Oct 1' }])).toBe('Ferguson · Nov 3')
  })
})

const bar = (total: number, paid: number, billedUnpaid: number, draft = 0): EditJobBillingBar => ({ total, paid, billedUnpaid, draft, remaining: total - paid - billedUnpaid - draft } as EditJobBillingBar)

describe('jobWindowMoneyLine', () => {
  it('reads the total and nothing billed yet, ending in the bar’s money verb', () => {
    expect(jobWindowMoneyLine(bar(56000, 0, 0), { label: 'Bill it', tone: 'green', target: 'bill' })).toEqual({ text: 'Job total $56,000 · nothing billed yet', act: 'Bill it' })
  })

  it('reads billed and paid, and ends plain when the next move is not a money move', () => {
    expect(jobWindowMoneyLine(bar(56000, 4000, 8000), { label: 'Ready to bill', tone: 'blue', target: 'status' })).toEqual({ text: 'Job total $56,000 · billed $12,000 · paid $4,000', act: null })
    expect(jobWindowMoneyLine(bar(56000, 0, 12000), { label: 'Mark paid', tone: 'blue', target: 'status' })).toEqual({ text: 'Job total $56,000 · billed $12,000 · nothing paid yet', act: 'Mark paid' })
    expect(jobWindowMoneyLine(bar(0, 0, 0), null)).toEqual({ text: 'No job total yet · nothing billed yet', act: null })
  })
})

describe('jobAccountsLine', () => {
  it('says None yet with the door to add one, and the houses once there are some', () => {
    expect(jobAccountsLine([], true)).toEqual({ text: 'None yet', act: 'Add job account' })
    expect(jobAccountsLine([{ houseName: 'Ferguson', stateWord: '✓' }, { houseName: 'Reece', stateWord: 'none yet' }], true)).toEqual({ text: 'Ferguson ✓ · Reece none yet', act: 'Add another' })
    expect(jobAccountsLine([], false).act).toBeNull()
  })
})

describe('pressPadFromInside (finding 340)', () => {
  /** What a tap can land on along one axis: the press inside its two borders, and the pad on each side of that. */
  const tap = (size: number, border: number, pad: number) => size - 2 * border + 2 * pad

  it('a press 28 px tall with a 1 px border reaches 44 from inside its border, where it reached 42', () => {
    const sized = pressPad({ width: 120, height: 28 })!
    expect(sized).toEqual({ x: 0, y: 8 })
    // The pad as it was drawn: 8 px from inside a 1 px border.
    expect(tap(28, 1, sized.y)).toBe(42)
    const drawn = pressPadFromInside(sized, { x: 1, y: 1 })
    expect(drawn).toEqual({ x: 0, y: 9 })
    expect(tap(28, 1, drawn.y)).toBe(PRESS_TARGET)
  })

  it('the Lien desk’s band press, 27.2 px with a 1 px border, takes a tap of 44 or more', () => {
    const drawn = pressPadFromInside(pressPad({ width: 146.8, height: 27.2 })!, { x: 1, y: 1 })
    expect(tap(27.2, 1, drawn.y)).toBeGreaterThanOrEqual(PRESS_TARGET)
  })

  it('a press with no border is padded as before', () => {
    const sized = pressPad({ width: 86, height: 20 })!
    expect(pressPadFromInside(sized, { x: 0, y: 0 })).toEqual(sized)
    expect(tap(20, 0, sized.y)).toBe(PRESS_TARGET)
  })

  it('adds the border on the sides that grow and nothing on a side that does not', () => {
    expect(pressPadFromInside({ x: 0, y: 12 }, { x: 2, y: 2 })).toEqual({ x: 0, y: 14 })
    expect(pressPadFromInside({ x: 11, y: 11 }, { x: 1, y: 1 })).toEqual({ x: 12, y: 12 })
    expect(pressPadFromInside({ x: 12, y: 0 }, { x: 1, y: 3 })).toEqual({ x: 13, y: 0 })
  })

  it('a border a browser cannot say is none', () => {
    expect(pressPadFromInside({ x: 0, y: 12 }, { x: Number.NaN, y: Number.NaN })).toEqual({ x: 0, y: 12 })
    expect(pressPadFromInside({ x: 0, y: 12 }, { x: -1, y: -1 })).toEqual({ x: 0, y: 12 })
  })
})
