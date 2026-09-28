// @vitest-environment jsdom
/**
 * The Workbench's margin brush as a hook (the Pricing / Labor map's step 8). The grid's pointer
 * handlers are called directly, and `document.elementFromPoint` answers with the row under the
 * pointer, so a stroke crosses real `wb-row-…` rows. Pins: arming loads the last margin and
 * folds the solver; a stroke drafts only the rows the brush may price; pointer-up saves the
 * changed rows, reloads, freezes, remembers the margin and leaves an undo; a pending solver
 * preview loses the brushed rows; undo writes the old prices back; Escape puts the brush down.
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMarginBrush, type MarginBrushArgs } from './useMarginBrush'
import type { BrushRow } from '../lib/bids/marginBrush'

const toasts: Array<[string, string]> = []
vi.mock('../contexts/ToastContext', () => ({
  useToastContext: () => ({ showToast: (m: string, kind: string) => toasts.push([m, kind]), showActionToast: () => {} }),
}))

/** cost 600 over 4 → 250 each at 40 %. */
const ROWS: BrushRow[] = [
  { countRow: { id: 'r1' }, cost: 600, count: 4, unitPrice: null, isFixedPrice: false },
  { countRow: { id: 'r2' }, cost: 600, count: 4, unitPrice: 250, isFixedPrice: false }, // already at the brushed price
  { countRow: { id: 'r3' }, cost: 600, count: 4, unitPrice: 180, isFixedPrice: false },
  { countRow: { id: 'held' }, cost: 600, count: 4, unitPrice: 100, isFixedPrice: false },
  { countRow: { id: 'nocost' }, cost: 0, count: 4, unitPrice: 50, isFixedPrice: false },
  { countRow: { id: 'fixed' }, cost: 600, count: 1, unitPrice: 900, isFixedPrice: true },
]
/** The pointer's x is the row's index. */
const ROW_AT_X = ROWS.map((r) => r.countRow.id)

type Calls = {
  writes: Array<[string, number | null]>
  events: string[]
  stashed: Array<{ versionId: string | null; preview: Record<string, number> | null; veto: string[] }>
  errors: Array<string | null>
  folds: number
}
let calls: Calls
let guardAllows = true
let writeFailsOn: string | null = null

function Probe({ over = {} }: { over?: Partial<MarginBrushArgs> }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [landing, setLanding] = useState<string | null>('56% on 3 rows')
  const b = useMarginBrush({
    guardPricingWrite: () => guardAllows,
    foldSolver: () => {
      calls.folds += 1
    },
    wbLocks: new Set(['held']),
    setWbPriceDrafts: setDrafts,
    clearSolveLanding: () => setLanding(null),
    bidId: 'b359',
    pricingVersionId: 'pv1',
    writePrice: async (rowId, value) => {
      calls.writes.push([rowId, value])
      calls.events.push(`write ${rowId}`)
      return rowId === writeFailsOn ? { message: `row ${rowId} refused` } : null
    },
    wbPreview: null,
    wbPreviewVeto: new Set(),
    setAndStashWbPreview: (versionId, preview, vetoed) => {
      calls.stashed.push({ versionId, preview, veto: [...(vetoed ?? [])] })
    },
    reloadAssignments: async (bidId, versionId) => {
      calls.events.push(`reload ${bidId}/${versionId}`)
    },
    freezeAfterWrite: async () => {
      calls.events.push('freeze')
    },
    setError: (m) => calls.errors.push(m),
    ...over,
  })
  const h = b.gridPointerHandlers(ROWS)
  const pointer = (x: number) => ({ clientX: x, clientY: 0, pointerId: 1, preventDefault() {}, stopPropagation() {}, currentTarget: { setPointerCapture() {} } }) as never
  return (
    <div>
      <table>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.countRow.id} id={`wb-row-${r.countRow.id}`}>
              <td>{r.countRow.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div data-testid="state">
        {`armed:${b.brushArmed} margin:${b.brushMarginInput}(${b.brushMargin ?? '—'}) painting:${b.brushStrokeCount} committing:${b.brushCommitting} undo:${b.brushUndo ? b.brushUndo.map(([id, p]) => `${id}=${p ?? '∅'}`).join(',') : 'none'} recent:${b.recentMargins.join(',')}`}
      </div>
      <div data-testid="drafts">{JSON.stringify(drafts)}</div>
      <div data-testid="landing">{landing ?? 'cleared'}</div>
      <button type="button" onClick={() => b.armBrush()}>arm</button>
      <button type="button" onClick={() => b.setBrushMarginInput('abc')}>bad margin</button>
      <button type="button" onClick={() => b.setBrushMarginInput('45')}>margin 45</button>
      <button type="button" onClick={() => void b.undoBrushSweep()}>undo</button>
      {ROWS.map((r, i) => (
        <button key={r.countRow.id} type="button" onClick={() => h.onPointerMove(pointer(i))}>{`over ${r.countRow.id}`}</button>
      ))}
      {ROWS.map((r, i) => (
        <button key={r.countRow.id} type="button" onClick={() => h.onPointerDownCapture(pointer(i))}>{`down on ${r.countRow.id}`}</button>
      ))}
      <button type="button" onClick={() => h.onPointerUp()}>up</button>
    </div>
  )
}

const state = () => screen.getByTestId('state').textContent ?? ''
const drafts = () => JSON.parse(screen.getByTestId('drafts').textContent ?? '{}') as Record<string, string>
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

/** Arm, press on r1, then cross the given rows. */
function stroke(...over: string[]) {
  click('arm')
  click('down on r1')
  for (const id of over) click(`over ${id}`)
}

beforeEach(() => {
  calls = { writes: [], events: [], stashed: [], errors: [], folds: 0 }
  guardAllows = true
  writeFailsOn = null
  toasts.length = 0
  window.localStorage.clear()
  window.localStorage.setItem('bidPricingRecentMargins_v1', JSON.stringify([40, 35]))
  document.elementFromPoint = ((x: number) => document.getElementById(`wb-row-${ROW_AT_X[x] ?? ''}`)) as typeof document.elementFromPoint
})
afterEach(() => cleanup())

describe('useMarginBrush', () => {
  it('arming loads the last margin used and folds the solver away', () => {
    render(<Probe />)
    // first paint
    expect(state()).toContain('armed:false margin:50(50)')
    click('arm')
    expect(state()).toContain('armed:true margin:40(40)')
    expect(state()).toContain('recent:40,35')
    expect(calls.folds).toBe(1)
  })

  it('a locked bid refuses the brush', () => {
    guardAllows = false
    render(<Probe />)
    click('arm')
    expect(state()).toContain('armed:false')
    expect(calls.folds).toBe(0)
  })

  it('a stroke drafts only the rows the brush may price, counts only real changes, and clears the landing chip', () => {
    render(<Probe />)
    stroke('r2', 'r3', 'held', 'nocost', 'fixed')
    expect(drafts()).toEqual({ r1: '250', r2: '250', r3: '250' })
    // r2 is already at 250, so the stroke changes two rows.
    expect(state()).toContain('painting:2')
    expect(screen.getByTestId('landing').textContent).toBe('cleared')
    expect(calls.writes).toEqual([])
  })

  it('pointer-up saves the changed rows, then reloads and freezes once, remembers the margin and leaves an undo', async () => {
    render(<Probe />)
    stroke('r2', 'r3')
    click('up')
    await waitFor(() => expect(state()).toContain('undo:r1=∅,r3=180'))
    expect(calls.events).toEqual(['write r1', 'write r3', 'reload b359/pv1', 'freeze'])
    expect(calls.writes).toEqual([
      ['r1', 250],
      ['r3', 250],
    ])
    expect(drafts()).toEqual({})
    expect(state()).toContain('painting:0 committing:false')
    expect(state()).toContain('recent:40,35')
    expect(toasts).toEqual([['Swept 2 rows at 40% — sweep again, or Esc puts the brush down.', 'success']])
  })

  it('a sweep at a new margin puts it first among the recent ones, on the device too', async () => {
    render(<Probe />)
    click('arm')
    click('margin 45')
    click('down on r1')
    click('up')
    await waitFor(() => expect(state()).toContain('recent:45,40,35'))
    expect(JSON.parse(window.localStorage.getItem('bidPricingRecentMargins_v1') ?? '[]')).toEqual([45, 40, 35])
    expect(toasts[toasts.length - 1]?.[0]).toBe('Swept 1 row at 45% — sweep again, or Esc puts the brush down.')
  })

  it('a pending solver preview loses the brushed rows and their vetoes; one that holds none is left alone', async () => {
    const { unmount } = render(<Probe over={{ wbPreview: { r1: 300, r9: 70 }, wbPreviewVeto: new Set(['r1', 'r9']) }} />)
    stroke()
    click('up')
    await waitFor(() => expect(calls.events).toContain('freeze'))
    expect(calls.stashed).toEqual([{ versionId: 'pv1', preview: { r9: 70 }, veto: ['r9'] }])
    unmount()

    calls.stashed = []
    calls.events = []
    render(<Probe over={{ wbPreview: { r9: 70 }, wbPreviewVeto: new Set() }} />)
    stroke()
    click('up')
    await waitFor(() => expect(calls.events).toContain('freeze'))
    expect(calls.stashed).toEqual([])
  })

  it('a refused row write says why and stops the batch — the reload and freeze still run', async () => {
    writeFailsOn = 'r1'
    render(<Probe />)
    stroke('r3')
    click('up')
    await waitFor(() => expect(calls.events).toContain('freeze'))
    expect(calls.errors).toEqual(['row r1 refused'])
    expect(calls.writes).toEqual([['r1', 250]])
  })

  it('a stroke over a row already at the brushed price writes nothing, drops its draft and leaves no undo', async () => {
    render(<Probe />)
    click('arm')
    click('down on r2')
    expect(drafts()).toEqual({ r2: '250' })
    expect(state()).toContain('painting:0')
    click('up')
    await act(async () => {})
    expect(calls.writes).toEqual([])
    expect(calls.events).toEqual([])
    expect(drafts()).toEqual({})
    expect(state()).toContain('undo:none')
  })

  it('undo writes each row’s old price back (none for a row that had none), reloads and freezes', async () => {
    render(<Probe />)
    stroke('r3')
    click('up')
    await waitFor(() => expect(state()).toContain('undo:r1=∅,r3=180'))
    calls.writes = []
    calls.events = []
    click('undo')
    await waitFor(() => expect(state()).toContain('undo:none'))
    expect(calls.writes).toEqual([
      ['r1', null],
      ['r3', 180],
    ])
    expect(calls.events).toEqual(['write r1', 'write r3', 'reload b359/pv1', 'freeze'])
    expect(toasts[toasts.length - 1]).toEqual(['Sweep undone.', 'success'])
  })

  it('Escape mid-stroke drops the stroke’s drafts and puts the brush down', () => {
    render(<Probe />)
    stroke('r3')
    expect(drafts()).toEqual({ r1: '250', r3: '250' })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(drafts()).toEqual({})
    expect(state()).toContain('armed:false')
    expect(state()).toContain('painting:0')
  })

  it('an unusable margin says to load the brush, and starts no stroke', () => {
    render(<Probe />)
    click('arm')
    click('bad margin')
    click('down on r1')
    expect(toasts).toEqual([['Load the brush first — margin between 1 and 95.', 'error']])
    expect(drafts()).toEqual({})
  })

  it('with the brush down, a press on the grid does nothing', () => {
    render(<Probe />)
    click('down on r1')
    click('over r3')
    expect(drafts()).toEqual({})
    expect(state()).toContain('painting:0')
  })
})
