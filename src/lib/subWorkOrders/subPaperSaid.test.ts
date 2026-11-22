/**
 * The last press's line in the papers window (punch list #350): it stays while the window is on the paper and the
 * step it arrived on, and goes when either changes.
 */
import { describe, expect, it } from 'vitest'
import { subPaperPlace, subPaperSaidHeld, subPaperSaidShown } from './subPaperSaid'

const DOWNLOADED = { tone: 'ok', words: 'WS-2041-1.pdf is downloaded, and a copy is filed under Documents → Sent copies.' }
const SENT = { tone: 'ok', words: 'Sent 3 papers to Harlan Mechanical.' }
const cedar = subPaperPlace({ kind: 'work', sheetId: 'cedar-1' }, 'paper')
const ridge = subPaperPlace({ kind: 'work', sheetId: 'ridge-1' }, 'paper')

describe('subPaperPlace: where the window is', () => {
  it('tells each paper and each step apart', () => {
    const places = [
      subPaperPlace({ kind: 'statement' }, 'paper'),
      subPaperPlace({ kind: 'statement' }, 'send'),
      cedar,
      ridge,
      subPaperPlace({ kind: 'work', sheetId: 'cedar-1' }, 'send'),
      subPaperPlace({ kind: 'payment', sendingKey: 'snd226' }, 'paper'),
      subPaperPlace({ kind: 'payment', sendingKey: 'row:p-old' }, 'paper'),
    ]
    expect(new Set(places).size).toBe(places.length)
  })

  it('a sheet and a sending that share an id are still two places', () => {
    expect(subPaperPlace({ kind: 'work', sheetId: 'x1' }, 'paper')).not.toBe(subPaperPlace({ kind: 'payment', sendingKey: 'x1' }, 'paper'))
  })

  it('each email of a send in several is a place of its own, and the first is the step itself', () => {
    const first = subPaperPlace({ kind: 'statement' }, 'send')
    expect(subPaperPlace({ kind: 'statement' }, 'send', 0)).toBe(first)
    expect(subPaperPlace({ kind: 'statement' }, 'send', 1)).not.toBe(first)
    expect(subPaperPlace({ kind: 'statement' }, 'send', 2)).not.toBe(subPaperPlace({ kind: 'statement' }, 'send', 1))
  })
})

describe('subPaperSaidHeld: how long the last press’s line stays', () => {
  it('a line shows where it arrived, and through every draw that changes nothing', () => {
    const first = subPaperSaidHeld(null, DOWNLOADED, cedar)
    expect(subPaperSaidShown(first)).toBe(DOWNLOADED)
    // Nothing moved: the same object comes back, so the window has nothing to store.
    expect(subPaperSaidHeld(first, DOWNLOADED, cedar)).toBe(first)
  })

  it('goes when the window moves to another paper', () => {
    const first = subPaperSaidHeld(null, DOWNLOADED, cedar)
    expect(subPaperSaidShown(subPaperSaidHeld(first, DOWNLOADED, ridge))).toBeNull()
  })

  it('goes when the step changes, on the same paper', () => {
    const statementPaper = subPaperPlace({ kind: 'statement' }, 'paper')
    const statementSend = subPaperPlace({ kind: 'statement' }, 'send')
    const sent = subPaperSaidHeld(null, SENT, statementSend)
    expect(subPaperSaidShown(subPaperSaidHeld(sent, SENT, statementPaper))).toBeNull()
  })

  it('stays gone on the way back: a send step opened again does not read as sent', () => {
    const statementPaper = subPaperPlace({ kind: 'statement' }, 'paper')
    const statementSend = subPaperPlace({ kind: 'statement' }, 'send')
    let held = subPaperSaidHeld(null, SENT, statementSend)
    held = subPaperSaidHeld(held, SENT, statementPaper)
    held = subPaperSaidHeld(held, SENT, statementSend)
    expect(subPaperSaidShown(held)).toBeNull()
    // And a draw that changes nothing keeps the same object there too.
    expect(subPaperSaidHeld(held, SENT, statementSend)).toBe(held)
  })

  it('a new line always shows, wherever the window is when it arrives', () => {
    // Download pressed on one sheet, the picker moved to another while the PDF was made.
    let held = subPaperSaidHeld<typeof DOWNLOADED>(null, null, cedar)
    held = subPaperSaidHeld(held, null, ridge)
    expect(subPaperSaidShown(held)).toBeNull()
    held = subPaperSaidHeld(held, DOWNLOADED, ridge)
    expect(subPaperSaidShown(held)).toBe(DOWNLOADED)
    // The next move takes it away like any other.
    expect(subPaperSaidShown(subPaperSaidHeld(held, DOWNLOADED, cedar))).toBeNull()
  })

  it('the same words said again are a new line: a second download after a move shows', () => {
    let held = subPaperSaidHeld(null, DOWNLOADED, cedar)
    held = subPaperSaidHeld(held, DOWNLOADED, ridge)
    const again = { ...DOWNLOADED }
    expect(subPaperSaidShown(subPaperSaidHeld(held, again, ridge))).toBe(again)
  })

  it('a press that clears the line clears it at once', () => {
    const first = subPaperSaidHeld(null, DOWNLOADED, cedar)
    expect(subPaperSaidShown(subPaperSaidHeld(first, null, cedar))).toBeNull()
  })
})
