// @vitest-environment jsdom
/**
 * Render smoke for the GC Review worklist: a GC assigned to someone else is
 * still the signed-in person's to work, each step opens its own door, and a
 * statement cannot be sent before the bills are checked.
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
  const handlers = { onCheck: vi.fn(), onSend: vi.fn(), onMarkSent: vi.fn(), onWord: vi.fn(), onUndoMark: vi.fn(), onOpenHistory: vi.fn(), onStartAssign: vi.fn(), onAssign: vi.fn(), onCancelAssign: vi.fn() }
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
    expect(screen.getByText('Ask Malachi')).toBeTruthy()
    expect(screen.getByText('Under $10,000')).toBeTruthy()
    expect(screen.getAllByTestId('gc-worklist-row')).toHaveLength(3)
    expect(screen.getByText('0 of 3 done')).toBeTruthy()
  })

  it('a checked GC offers Send and the word; each opens its own door', () => {
    const h = renderPanel()
    const knight = within(rowFor('Knight Contracting'))
    expect(knight.getByText('✓ Checked')).toBeTruthy()
    fireEvent.click(knight.getByRole('button', { name: 'Send' }))
    expect(h.onSend).toHaveBeenCalledWith(expect.objectContaining({ gcId: 'knight' }))
    fireEvent.click(knight.getByRole('button', { name: 'Word' }))
    expect(h.onWord).toHaveBeenCalledWith(expect.objectContaining({ gcId: 'knight' }))
    fireEvent.click(knight.getByRole('button', { name: 'or mark sent' }))
    expect(h.onMarkSent).toHaveBeenCalledWith(expect.objectContaining({ gcId: 'knight' }))
  })

  it('an unchecked GC cannot be sent — Check comes first', () => {
    const h = renderPanel()
    const loberg = within(rowFor('Loberg Contracting'))
    expect(loberg.queryByRole('button', { name: 'Send' })).toBeNull()
    expect(loberg.queryByRole('button', { name: 'or mark sent' })).toBeNull()
    fireEvent.click(loberg.getByRole('button', { name: 'Check' }))
    expect(h.onCheck).toHaveBeenCalledWith(expect.objectContaining({ gcId: 'loberg' }))
  })

  it('someone who cannot act reads the list and gets no buttons', () => {
    renderPanel({ canAct: false })
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Word' })).toBeNull()
  })
})
