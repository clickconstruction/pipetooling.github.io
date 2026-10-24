// @vitest-environment jsdom
/**
 * Quickfill → Texts (v2.5816, punch list #157): the station draws the day's text ledger as the kernel made it. A day
 * with rows in every lane draws the three bands with their rows, Reply and Call, the folded receipt and the quiet
 * lines, and the Mark writes the note from the rows with the typed words; a clean day is one line and one press; in
 * the round the body draws no Mark and the typed words reach the page; a failed read and a non-office role each say
 * their line and still mark.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { QuickfillRoundScreenContext } from './quickfillRoundContext'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { textsLedger, type LedgerContact, type LedgerLine, type TextsLedger } from '../../lib/quickfill/textsLedger'
import { QuickfillTextsSection } from './QuickfillTextsSection'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useCallThrough', () => ({
  useCallThrough: () => ({ seat: null, phone: false, kept: null, keep: () => {}, fromFor: () => null }),
}))
vi.mock('../dashboard/TodaysSendsWindow', () => ({
  TodaysSendsWindow: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="todays-sends-window">
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}))

const TODAY = '2026-10-24'
const NOW = Date.parse('2026-10-24T14:52:00Z')
const contacts: LedgerContact[] = [
  { id: 'marcus', name: 'Marcus Calloway', kind: 'sub', phone: '(512) 555-0142' },
  { id: 'dana', name: 'Dana Whitfield', kind: 'customer', phone: null },
  { id: 'tom', name: 'Tom Reyes', kind: 'customer' },
  { id: 'unknown1', name: '', kind: 'unknown' },
]
const lines = new Map<string, LedgerLine>(
  (
    [
      { id: 'l-marcus', contactId: 'marcus', channel: 'text', direction: 'in', body: 'Running late, there by 9:30.', at: '2026-10-24T11:55:00Z' },
      { id: 'l-dana', contactId: 'dana', channel: 'text', direction: 'in', body: 'Can the tech come after 2?', at: '2026-10-24T13:12:00Z' },
      { id: 'l-unknown1', contactId: 'unknown1', channel: 'text', direction: 'in', body: 'Do you do water heaters?', at: '2026-10-24T13:40:00Z' },
    ] as LedgerLine[]
  ).map((l) => [l.id, l]),
)
const reply = (contactId: string, landOnId: string, waitingSince: string) => ({ contactId, landOnId, waitingSince, callBack: false, offers: [], acts: ['Reply'] })
const sent = (id: string, contactId: string, name: string, body: string, atIso: string, delivery: 'delivered' | 'undelivered' | null, who = 'Taunya') => ({ id, contactId, name, kind: 'customer' as const, body, atMs: Date.parse(atIso), who, delivery, number: '(830) 555-0121' })

const fullDay = (): TextsLedger =>
  textsLedger({
    needsReply: [reply('marcus', 'l-marcus', '2026-10-24T11:55:00Z'), reply('dana', 'l-dana', '2026-10-24T13:12:00Z')],
    newLane: [{ contactId: 'unknown1' }],
    lines,
    contacts,
    wentOut: [sent('s-hill', 'hill', 'Hill Country Electric', 'The inspector comes at 1.', '2026-10-24T14:40:00Z', null), sent('s-marcus', 'marcus', 'Marcus Calloway', 'See you at 9:30.', '2026-10-24T14:12:00Z', 'delivered'), sent('s-tom', 'tom', 'Tom Reyes', 'Tom, your estimate #1312 is ready.', '2026-10-23T21:10:00Z', 'undelivered')],
    todayYmd: TODAY,
    nowMs: NOW,
  })
const cleanDay = (): TextsLedger => textsLedger({ needsReply: [], newLane: [], lines, contacts, wentOut: [sent('s-marcus', 'marcus', 'Marcus Calloway', 'See you at 9:30.', '2026-10-24T14:12:00Z', 'delivered')], todayYmd: TODAY, nowMs: NOW })

const palette = { bg: 'var(--bg-green-tint)', border: 'var(--border-green)' }

afterEach(() => cleanup())

describe('QuickfillTextsSection (v2.5816, punch list #157)', () => {
  it('a day with rows in every lane: the bands, the rows with their doors, the folded receipt, the quiet lines, and the Mark writes the note from the rows', async () => {
    const onConfirmMark = vi.fn()
    renderWithProviders(<QuickfillTextsSection ledger={fullDay()} todaysSends={2} loading={false} problem={false} canRead markButtonPalette={palette} onConfirmMark={onConfirmMark} />)
    await settle()
    // first paint
    const replies = screen.getAllByTestId('texts-reply-row')
    expect(replies.map((r) => within(r).getByText(/Calloway|Whitfield/).textContent)).toEqual(['Marcus Callowaysub', 'Dana Whitfieldcustomer'])
    expect(within(replies[0]!).getByTestId('texts-reply').getAttribute('href')).toBe('/messages?thread=marcus&at=l-marcus')
    expect(within(replies[0]!).getByTestId('texts-call-marcus')).toBeTruthy()
    expect(within(replies[1]!).queryByTestId('texts-call-dana')).toBeNull()
    const bad = screen.getByTestId('texts-bad-row')
    expect(within(bad).getByTestId('texts-mark').textContent).toBe('⚠ not delivered')
    expect(within(bad).getByTestId('texts-call-them-s-tom')).toBeTruthy()
    expect(screen.queryAllByTestId('texts-sent-row')).toHaveLength(0)
    expect(screen.getByTestId('texts-band-went-out-today').textContent).toContain('1 ✓ delivered · 1 waiting on Quo')
    fireEvent.click(screen.getByTestId('texts-receipt-toggle'))
    expect(screen.getAllByTestId('texts-sent-row')).toHaveLength(2)
    expect(screen.getByTestId('texts-todays-sends').textContent).toContain("2 texts the app prepared wait on Today's sends.")
    expect(screen.getByTestId('texts-new').textContent).toContain('1 text from a number nobody has named waits in New on Messages.')
    fireEvent.change(screen.getByLabelText(/Anything else\?/), { target: { value: 'Owe Pete the sheet from my phone' } })
    fireEvent.click(screen.getByTestId('texts-mark-button'))
    expect(onConfirmMark).toHaveBeenCalledWith('2 need a reply · Marcus Calloway 2 h, Dana Whitfield 1 h · 1 not delivered · Tom Reyes · 2 went out, 1 delivered, 1 waiting on Quo\nOwe Pete the sheet from my phone')
    expect((screen.getByLabelText(/Anything else\?/) as HTMLInputElement).value).toBe('')
  })
  it('a clean day is one line, the receipt behind Show them, and one press', async () => {
    const onConfirmMark = vi.fn()
    renderWithProviders(<QuickfillTextsSection ledger={cleanDay()} todaysSends={0} loading={false} problem={false} canRead markButtonPalette={palette} onConfirmMark={onConfirmMark} />)
    await settle()
    // first paint
    const clean = screen.getByTestId('texts-clean')
    expect(clean.textContent).toContain('Nothing on texts is waiting on us.')
    expect(clean.textContent).toContain('1 went out today, all delivered.')
    expect(screen.queryByTestId('texts-todays-sends')).toBeNull()
    fireEvent.click(screen.getByTestId('texts-receipt-toggle'))
    expect(screen.getAllByTestId('texts-sent-row')).toHaveLength(1)
    fireEvent.click(screen.getByTestId('texts-mark-button'))
    expect(onConfirmMark).toHaveBeenCalledWith('nothing waiting · 1 went out, all delivered')
  })
  it('in the round the body draws no Mark; the typed words reach the page for the foot’s Looked', async () => {
    const onTyped = vi.fn()
    renderWithProviders(
      <QuickfillRoundScreenContext.Provider value={true}>
        <QuickfillTextsSection ledger={fullDay()} todaysSends={0} loading={false} problem={false} canRead markButtonPalette={palette} onConfirmMark={() => {}} onTyped={onTyped} />
      </QuickfillRoundScreenContext.Provider>,
    )
    await settle()
    // first paint
    expect(screen.queryByTestId('texts-mark-button')).toBeNull()
    expect(screen.getAllByTestId('texts-reply-row')).toHaveLength(2)
    fireEvent.change(screen.getByLabelText(/Anything else\?/), { target: { value: 'from my phone' } })
    expect(onTyped).toHaveBeenLastCalledWith('from my phone')
  })
  it('the quiet line opens the Today’s sends window', async () => {
    renderWithProviders(<QuickfillTextsSection ledger={cleanDay()} todaysSends={1} loading={false} problem={false} canRead markButtonPalette={palette} onConfirmMark={() => {}} />)
    await settle()
    // first paint
    expect(screen.getByTestId('texts-todays-sends').textContent).toContain("1 text the app prepared waits on Today's sends.")
    fireEvent.click(within(screen.getByTestId('texts-todays-sends')).getByRole('button'))
    expect(await screen.findByTestId('todays-sends-window')).toBeTruthy()
  })
  it('a failed read and a non-office role each say their line and still mark with the typed words', async () => {
    const onConfirmMark = vi.fn()
    const { unmount } = renderWithProviders(<QuickfillTextsSection ledger={null} todaysSends={0} loading={false} problem canRead markButtonPalette={palette} onConfirmMark={onConfirmMark} />)
    await settle()
    // first paint
    expect(screen.getByTestId('texts-problem').textContent).toContain('Texts could not be read. Messages has them.')
    fireEvent.click(screen.getByTestId('texts-mark-button'))
    expect(onConfirmMark).toHaveBeenLastCalledWith('the texts could not be read')
    unmount()
    renderWithProviders(<QuickfillTextsSection ledger={null} todaysSends={0} loading={false} problem={false} canRead={false} markButtonPalette={palette} onConfirmMark={onConfirmMark} />)
    await settle()
    // first paint
    expect(screen.getByText(/The office team reads texts on Messages/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Anything else\?/), { target: { value: 'all caught up' } })
    fireEvent.click(screen.getByTestId('texts-mark-button'))
    expect(onConfirmMark).toHaveBeenLastCalledWith('all caught up')
  })
})
