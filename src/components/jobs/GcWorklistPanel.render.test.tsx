// @vitest-environment jsdom
/**
 * Render smoke for the GC Review worklist: a GC assigned to someone else is
 * still the signed-in person's to work, each step opens its own door, a
 * statement cannot be sent before the bills are checked, a row opens onto its
 * statement, and a stage picked on the track narrows the list.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import GcWorklistPanel from './GcWorklistPanel'
import { buildGcWorklist } from '../../lib/jobs/gcWorklist'
import type { GcReviewGroup } from '../../lib/gcReviewRollup'
import type { GcReviewCertRow } from '../../lib/jobs/gcReviewCertification'

const WEEK = '2026-09-21'
const group = (gcId: string, gcName: string, subtotal: number): GcReviewGroup => ({ key: gcId, gcId, gcName, isNoGc: false, rows: [], subtotal, jobCount: 2, oldestAgeDays: 41 })
const cert = (gcId: string, total: number): GcReviewCertRow => ({ week_start: WEEK, gc_customer_id: gcId, certified_by_name: 'Taunya', certified_at: '2026-09-23T15:00:00Z', job_count: 2, total, snapshot: null, note: '' })

const worklist = buildGcWorklist({
  groups: [group('knight', 'Knight Contracting', 26000), group('loberg', 'Loberg Contracting', 22000), group('small', 'Small GC', 4000)],
  certsByGc: new Map([['knight', cert('knight', 26000)]]),
  marks: [],
  senders: new Map([
    ['knight', 'u-malachi'],
    ['loberg', 'u-malachi'],
  ]),
  accountMen: new Map(),
  lastSentByGcId: {},
  weekStartYmd: WEEK,
})

function renderPanel(over: Partial<ComponentProps<typeof GcWorklistPanel>> = {}) {
  const handlers = { onCheck: vi.fn(), onSend: vi.fn(), onMarkSent: vi.fn(), onWord: vi.fn(), onUndoMark: vi.fn(), onOpenHistory: vi.fn(), onStartAssign: vi.fn(), onAssign: vi.fn(), onCancelAssign: vi.fn(), onOpenCallSheet: vi.fn(), onToggle: vi.fn(), onClearStage: vi.fn() }
  render(
    <GcWorklistPanel
      worklist={worklist}
      authUserId="u-taunya"
      userNameById={(id) => (id === 'u-malachi' ? 'Malachi' : 'nobody assigned')}
      canAct
      busy={false}
      error={null}
      lastWordByGc={new Map()}
      assignableUsers={[{ id: 'u-malachi', name: 'Malachi' }]}
      assigningGcId={null}
      expanded={new Set(['knight'])}
      renderDetail={(r) => <p>bills of {r.gcName}</p>}
      {...handlers}
      {...over}
    />,
  )
  return handlers
}

const rowFor = (name: string) => screen.getAllByTestId('gc-worklist-row').find((el) => within(el).queryByText(name))!

describe('GcWorklistPanel', () => {
  it('gives the person signed in every GC, grouped by who to ask', () => {
    renderPanel()
    expect(screen.getByText('Account Man Malachi')).toBeTruthy()
    expect(screen.getByText('Under $10,000')).toBeTruthy()
    expect(screen.getAllByTestId('gc-worklist-row')).toHaveLength(3)
  })

  it('a checked GC offers Send and the word; each opens its own door', () => {
    const h = renderPanel()
    const knight = within(rowFor('Knight Contracting'))
    expect(knight.getByText('Checked')).toBeTruthy()
    // The next step is the row's one button; the same door is on its dot.
    fireEvent.click(knight.getByRole('button', { name: 'Send' }))
    fireEvent.click(knight.getByRole('button', { name: 'Send step: next' }))
    expect(h.onSend).toHaveBeenCalledTimes(2)
    expect(h.onSend).toHaveBeenCalledWith(expect.objectContaining({ gcId: 'knight' }))
    // The word can come in before the statement goes out.
    fireEvent.click(knight.getByRole('button', { name: 'Word step: to do' }))
    expect(h.onWord).toHaveBeenCalledWith(expect.objectContaining({ gcId: 'knight' }))
    fireEvent.click(knight.getByRole('button', { name: 'or mark sent' }))
    expect(h.onMarkSent).toHaveBeenCalledWith(expect.objectContaining({ gcId: 'knight' }))
  })

  it('an unchecked GC cannot be sent — Check comes first', () => {
    const h = renderPanel({ expanded: new Set(['knight', 'loberg']) })
    const loberg = within(rowFor('Loberg Contracting'))
    expect(loberg.queryByRole('button', { name: /^Send/ })).toBeNull()
    expect(loberg.queryByRole('button', { name: 'or mark sent' })).toBeNull()
    fireEvent.click(loberg.getByRole('button', { name: 'Check bills' }))
    expect(h.onCheck).toHaveBeenCalledWith(expect.objectContaining({ gcId: 'loberg' }))
  })

  it('someone who cannot act reads the list and gets no buttons', () => {
    renderPanel({ canAct: false })
    expect(screen.queryByRole('button', { name: /^Send/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Check/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Word/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Get the word' })).toBeNull()
    // Reading a row's bills is not acting.
    expect(screen.getByRole('button', { name: 'Hide Knight Contracting’s bills' })).toBeTruthy()
  })

  it('offers a call sheet for an account man’s GCs, never for the ones under the line', () => {
    const h = renderPanel()
    const buttons = screen.getAllByRole('button', { name: /Call sheet/ })
    expect(buttons).toHaveLength(1)
    fireEvent.click(buttons[0]!)
    expect(h.onOpenCallSheet).toHaveBeenCalledWith(expect.objectContaining({ key: 'owner:u-malachi' }))
  })

  it('offers the link for someone else’s accounts, and his answers to review when they are in', () => {
    const onAskByLink = vi.fn()
    const onReviewAnswers = vi.fn()
    renderPanel({ onAskByLink, onReviewAnswers, askByOwner: new Map([['u-malachi', { statusLine: 'answered 1 of 2 · 1 waiting on you', pending: 1 }]]) })
    fireEvent.click(screen.getByRole('button', { name: /His link/ }))
    expect(onAskByLink).toHaveBeenCalledWith(expect.objectContaining({ key: 'owner:u-malachi' }))
    fireEvent.click(screen.getByRole('button', { name: 'Malachi answered 1 — review' }))
    expect(onReviewAnswers).toHaveBeenCalledWith(expect.objectContaining({ key: 'owner:u-malachi' }))
  })

  it('never offers a link for your own accounts, or before the database has it', () => {
    renderPanel({ authUserId: 'u-malachi', onAskByLink: vi.fn() })
    expect(screen.queryByRole('button', { name: /Ask by link/ })).toBeNull()
  })

  it('a row opens onto its statement; the links that were on the row are inside it', () => {
    const h = renderPanel()
    const knight = within(rowFor('Knight Contracting'))
    expect(knight.getByText('bills of Knight Contracting')).toBeTruthy()
    expect(knight.getByText(/account man: Malachi/)).toBeTruthy()
    expect(knight.getByRole('button', { name: 'change account man' })).toBeTruthy()
    // A closed row shows neither.
    const loberg = within(rowFor('Loberg Contracting'))
    expect(loberg.queryByText('bills of Loberg Contracting')).toBeNull()
    fireEvent.click(loberg.getByRole('button', { name: 'Show Loberg Contracting’s bills' }))
    expect(h.onToggle).toHaveBeenCalledWith(expect.objectContaining({ gcId: 'loberg' }))
  })

  it('a click on the row opens it; a click on a control inside it does not', () => {
    const h = renderPanel()
    fireEvent.click(within(rowFor('Loberg Contracting')).getByText('Loberg Contracting'))
    expect(h.onToggle).toHaveBeenCalledTimes(1)
    fireEvent.click(within(rowFor('Knight Contracting')).getByRole('button', { name: 'Send' }))
    fireEvent.click(within(rowFor('Knight Contracting')).getByText('bills of Knight Contracting'))
    expect(h.onToggle).toHaveBeenCalledTimes(1)
  })

  it('says what the statement on screen owes, not only the active bills', () => {
    renderPanel({ statementByGc: new Map([['knight', { ...group('knight', 'Knight Contracting', 31500), jobCount: 3 }]]) })
    expect(within(rowFor('Knight Contracting')).getByText(/\$31,500\.00 · 3 jobs · oldest 41d/)).toBeTruthy()
  })

  it('a stage picked on the track narrows the list to the GCs waiting there', () => {
    const h = renderPanel({ stage: 'send' })
    expect(screen.getAllByTestId('gc-worklist-row')).toHaveLength(1)
    expect(rowFor('Knight Contracting')).toBeTruthy()
    const line = screen.getByRole('status')
    expect(line.textContent).toContain('1 of 3 GCs — checked and waiting to go out · $26,000.00')
    // The group still says what it holds, not what the filter left of it.
    expect(screen.getByText(/2 GCs · \$48,000\.00/)).toBeTruthy()
    fireEvent.click(within(line).getByRole('button', { name: 'Show all 3' }))
    expect(h.onClearStage).toHaveBeenCalled()
  })

  it('a stage nobody is at says so', () => {
    renderPanel({ stage: 'word' })
    expect(screen.queryAllByTestId('gc-worklist-row')).toHaveLength(0)
    expect(screen.getByText('No GC is sent and waiting on the word.')).toBeTruthy()
  })
})
