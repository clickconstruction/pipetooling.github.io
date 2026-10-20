// @vitest-environment jsdom
/**
 * Messages, cut 2's screens, C2: the owed strip (v2.5319). Its what list from their flow and the usual, their own words,
 * the day by chip or typed, *Mark it* waiting for a what, and once marked: who marked it, a new what or day written, a
 * same pick writing nothing, done with a team note, put it off, and ×. The people are the prototype's demo people.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Owed } from '../../lib/messages/owed'
import { OwedStrip, type OwedStripProps } from './OwedStrip'

afterEach(cleanup)

const GREG = { name: 'Greg Paulk', goesBy: null, kind: 'trade' as const }
const OWED: Owed = { what: 'the plans or an addendum', byYmd: '2026-10-09', byWords: null, markedBy: 'Rosa', markedAt: '2026-09-26T19:30:00.000Z' }

function strip(over: Partial<OwedStripProps> = {}) {
  const props: OwedStripProps = {
    person: GREG,
    owed: null,
    todayYmd: '2026-10-02',
    nowIso: '2026-10-02T17:00:00.000Z',
    busy: false,
    canSettle: true,
    onMark: vi.fn(),
    onSettle: vi.fn(),
    onPutOff: vi.fn(),
    onClose: vi.fn(),
    ...over,
  }
  render(<OwedStrip {...props} />)
  return props
}

describe('OwedStrip', () => {
  it('opens on the what list, and Mark it waits for a what; the day is a chip', () => {
    const p = strip()
    const list = within(document.querySelector<HTMLElement>('[data-owed-what]')!)
    expect(list.getByText('From the trade partner flow')).toBeTruthy()
    expect(list.getByRole('button', { name: 'the invitation' })).toBeTruthy()
    expect(list.getByRole('button', { name: 'a call back' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Mark it' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(list.getByRole('button', { name: 'the plans or an addendum' }))
    fireEvent.click(screen.getByRole('button', { name: 'when? ▾' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fri Oct 9' }))
    expect(screen.getByRole('button', { name: 'Fri Oct 9 ▾' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mark it' }))
    expect(p.onMark).toHaveBeenCalledWith('the plans or an addendum', { ymd: '2026-10-09', words: null })
  })

  it('takes their own words for the what, and reads a typed day back before Enter keeps it', () => {
    const p = strip()
    fireEvent.change(screen.getByRole('textbox', { name: 'What we owe, in your own words' }), { target: { value: 'the gate code' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use these words' }))
    fireEvent.click(screen.getByRole('button', { name: 'when? ▾' }))
    const typed = screen.getByRole('textbox', { name: 'By when, in your own words' })
    fireEvent.change(typed, { target: { value: 'Oct 16' } })
    expect(screen.getByText('Reads as Fri Oct 16. Press Enter.')).toBeTruthy()
    fireEvent.keyDown(typed, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Mark it' }))
    expect(p.onMark).toHaveBeenCalledWith('the gate code', { ymd: '2026-10-16', words: null })
  })

  it('once marked: who marked it, a new what or day written, a same pick writing nothing', () => {
    const p = strip({ owed: OWED })
    expect(screen.queryByRole('button', { name: 'Mark it' })).toBeNull()
    expect(screen.getByText(/^Rosa, /)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'the plans or an addendum ▾' }))
    fireEvent.click(screen.getByRole('button', { name: 'the plans or an addendum' }))
    expect(p.onMark).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'the plans or an addendum ▾' }))
    fireEvent.click(screen.getByRole('button', { name: 'a call back' }))
    expect(p.onMark).toHaveBeenLastCalledWith('a call back', { ymd: '2026-10-09', words: null })

    fireEvent.click(screen.getByRole('button', { name: 'Fri Oct 9 ▾' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear the day' }))
    expect(p.onMark).toHaveBeenLastCalledWith('the plans or an addendum', { ymd: null, words: null })
  })

  it('offers done with a team note only while a reply box is there to take the note', () => {
    strip({ owed: OWED, canSettle: false })
    expect(screen.queryByRole('button', { name: 'Mark it done, with a team note' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Put it off' })).toBeTruthy()
  })

  it('once marked: done with a team note, put it off, and × put the strip away', () => {
    const p = strip({ owed: OWED })
    fireEvent.click(screen.getByRole('button', { name: 'Mark it done, with a team note' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put it off' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put the strip away' }))
    expect([p.onSettle, p.onPutOff, p.onClose].map((f) => vi.mocked(f).mock.calls.length)).toEqual([1, 1, 1])
  })
})
