// @vitest-environment jsdom
/**
 * Rows that react to a PRESS, and the windows drawn in them (v2.4361). React bubbles a press
 * through the component tree, so a still press inside a window drawn in the row reached the row:
 *
 * - Bid Board: the row's hold (`bidMarkHoldHandlers`) marked the bid after half a second anywhere
 *   in a GC's notes or in Mark account opened, then swallowed the click that followed, so the
 *   button pressed (the notes' Save, Cancel) never ran. On a touch screen the row also blocked
 *   the long-press menu inside the window. The stand-in row spreads the real hold handlers, as
 *   the desktop row and the phone card do.
 * - Checklist Review: the row's drag listeners lifted the task behind Cost this task after a
 *   280 ms press, mouse or finger, dropped it on release and swallowed the click. This draws the
 *   real list from the page.
 *
 * Each row also takes a press on its own content, so a quiet row here proves the window, not a
 * dead stand-in. Each window case fails without the fix. v2.4352 / v2.4356 stop the same
 * windows' backdrop CLICK (nestedWindows.render.test.tsx).
 */
import type { ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../test/renderSmokeMocks'
import { BID_MARK_HOLD_MS, bidMarkHoldHandlers, resetBidMarkHoldsForTests } from '../lib/bids/bidMarkHold'
import { BidGcNotesPopover } from './bids/BidGcNotesPopover'
import { BidBoardJobAccountChips } from './bids/BidBoardJobAccountChips'
import type { BidJobAccountRow } from '../hooks/useBidJobAccountStrip'
import { OutstandingByPersonSortableList } from '../pages/Checklist'

const inserts = vi.hoisted(() => [] as { table: string; row: unknown }[])

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  return {
    supabase: {
      ...stub,
      // Records each insert, so a test can tell whether a Save ran.
      from: (table: string) => {
        const builder = stub.from() as Record<string, unknown>
        const insert = builder.insert as (row: unknown) => unknown
        builder.insert = (row: unknown) => {
          inserts.push({ table, row })
          return insert(row)
        }
        return builder
      },
    },
  }
})

/**
 * jsdom has no PointerEvent: a pointer press would arrive as a bare Event, not primary and with
 * no button, and the hold ignores it. This is the part of the real thing the hold reads.
 */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number
  readonly isPrimary: boolean
  readonly pointerType: string
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 1
    this.isPrimary = init.isPrimary ?? true
    this.pointerType = init.pointerType ?? 'mouse'
  }
}
const realPointerEvent = (globalThis as { PointerEvent?: unknown }).PointerEvent
beforeAll(() => {
  installDomShims()
  vi.stubGlobal('PointerEvent', TestPointerEvent)
  ;(window as unknown as { PointerEvent: unknown }).PointerEvent = TestPointerEvent
})
afterAll(() => {
  vi.unstubAllGlobals()
  ;(window as unknown as { PointerEvent: unknown }).PointerEvent = realPointerEvent
})
afterEach(() => {
  vi.useRealTimers()
  resetBidMarkHoldsForTests()
  inserts.length = 0
})

const AT = { clientX: 40, clientY: 40, button: 0 }
/** pointer = what the Bid Board hold hears; mouse and finger = what the Checklist drag hears. */
type How = 'pointer' | 'mouse' | 'finger'

function press(el: Element, how: How) {
  if (how === 'pointer') fireEvent.pointerDown(el, AT)
  else if (how === 'mouse') fireEvent.mouseDown(el, AT)
  else fireEvent.touchStart(el, { touches: [AT] })
}
function letGo(el: Element, how: How) {
  if (how === 'pointer') fireEvent.pointerUp(el, AT)
  else if (how === 'mouse') fireEvent.mouseUp(el, AT)
  else fireEvent.touchEnd(el, { touches: [], changedTouches: [AT] })
}
function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}
/** Press `el` and keep still for `ms`, then let go and click, as a slow tap does. */
function slowTap(el: Element, ms: number, how: How = 'pointer') {
  press(el, how)
  wait(ms)
  letGo(el, how)
  fireEvent.click(el, AT)
}

/** A Bid Board row's press wiring: the hold that marks the bid, spread as the board spreads it. */
function BoardRow({ onMark, children }: { onMark: () => void; children: ReactNode }) {
  return (
    <div data-testid="board-row" {...bidMarkHoldHandlers('board:b-385', onMark)}>
      <span>Galloway Park</span>
      {children}
    </div>
  )
}

const backdropOf = (dialog: HTMLElement) => dialog.parentElement as HTMLElement
/** The row's fill line runs while it holds `data-holding`. */
const fillLineRuns = () => screen.getByTestId('board-row').dataset.holding === 'true'
/** A finger's long press asks for the system menu (copy, paste); false when something blocked it. */
const longPressMenuShows = (el: Element) => fireEvent(el, new TestPointerEvent('contextmenu', { bubbles: true, cancelable: true, pointerType: 'touch' }))

describe('Bid Board row: a press inside a window drawn in it', () => {
  it('the row’s own hold still marks the bid', async () => {
    const onMark = vi.fn()
    renderWithProviders(<BoardRow onMark={onMark}>{null}</BoardRow>)
    await settle()
    vi.useFakeTimers()
    slowTap(screen.getByText('Galloway Park'), BID_MARK_HOLD_MS + 100)
    expect(onMark).toHaveBeenCalledTimes(1)
  })

  it('GC notes: a long press on the backdrop or in the box marks nothing, and Save still saves', async () => {
    const onMark = vi.fn()
    renderWithProviders(
      <BoardRow onMark={onMark}>
        <BidGcNotesPopover bidId="b-385" bidLabel="Galloway Park" gcId="gc-1" gcName="HCS, Inc." sentOn="9/22" outcome={null} onClose={() => {}} onChanged={() => {}} />
      </BoardRow>,
    )
    const dialog = await screen.findByRole('dialog', { name: 'Notes for HCS, Inc. on Galloway Park' })
    await screen.findByText('No notes yet for HCS, Inc. on this bid.')
    const box = screen.getByPlaceholderText('Add a note for HCS, Inc. on this bid…')
    fireEvent.change(box, { target: { value: 'Called Dana, wants the alternates split out' } })
    const menuInBox = longPressMenuShows(box)

    vi.useFakeTimers()
    press(backdropOf(dialog), 'pointer')
    const fillLine = fillLineRuns()
    wait(BID_MARK_HOLD_MS + 100)
    letGo(backdropOf(dialog), 'pointer')
    slowTap(box, BID_MARK_HOLD_MS + 100)
    slowTap(screen.getByRole('button', { name: 'Save' }), BID_MARK_HOLD_MS + 100)
    await settle()

    expect({ menuInBox, fillLine, marks: onMark.mock.calls.length, saved: inserts }).toEqual({
      menuInBox: true,
      fillLine: false,
      marks: 0,
      saved: [{ table: 'bids_submission_entries', row: expect.objectContaining({ bid_id: 'b-385', gc_customer_id: 'gc-1', notes: 'Called Dana, wants the alternates split out' }) }],
    })
  })

  it('Mark account opened, from the won row’s job account chip: a long press marks nothing, and Cancel still closes it', async () => {
    const onMark = vi.fn()
    const ferguson: BidJobAccountRow = {
      bid_id: 'b-385',
      job_id: 'j-258',
      job_hcp_number: '258',
      job_click_number: null,
      job_name: 'Dudley Mason',
      job_address: null,
      supply_house_id: 'h-1',
      house_name: 'Ferguson',
      policy: null,
      quoted: false,
      status: null,
      account_ref: null,
      opened_via: null,
      opened_at: null,
      requested_at: null,
      rep_contact_id: null,
      rep_name: null,
      rep_phone: null,
      rep_email: null,
    }
    renderWithProviders(
      <BoardRow onMark={onMark}>
        <BidBoardJobAccountChips bidId="b-385" loaded rows={[ferguson]} onChanged={() => {}} />
      </BoardRow>,
    )
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Ferguson' }))
    const dialog = await screen.findByRole('dialog', { name: /^Ferguson job account for/ })

    vi.useFakeTimers()
    press(backdropOf(dialog), 'pointer')
    const fillLine = fillLineRuns()
    wait(BID_MARK_HOLD_MS + 100)
    letGo(backdropOf(dialog), 'pointer')
    slowTap(screen.getByRole('button', { name: 'Cancel' }), BID_MARK_HOLD_MS + 100)

    expect({ fillLine, marks: onMark.mock.calls.length, stillOpen: screen.queryByRole('dialog') != null }).toEqual({ fillLine: false, marks: 0, stillOpen: false })
  })
})

const TASK = 'Clear back half of floor'

function renderChecklistRow(onDragEnd: () => void) {
  return renderWithProviders(
    <OutstandingByPersonSortableList
      userId="u-taunya"
      instances={[{ id: 'inst-1', checklist_item_id: 'item-1', scheduled_date: '2026-10-01', checklist_items: { title: TASK, links: null, repeat_type: 'once', created_at: '2026-09-30T15:00:00Z' } }]}
      reorderingUserId={null}
      canManageChecklists
      isDev={false}
      canSeeCosts
      authUserId="u-taunya"
      onDragEnd={onDragEnd}
      completingInstanceId={null}
      deletingInstanceId={null}
      expandedInstanceId={null}
      notesByInstance={new Map()}
      onToggleExpanded={() => {}}
      onMarkComplete={() => {}}
      onDeleteInstance={() => {}}
      onOpenFwd={() => {}}
      onCompleteFromPanel={async () => true}
      setEditItemId={() => {}}
      setError={() => {}}
    />,
  )
}

/** The grip carries dnd-kit's attributes: aria-pressed is set while the task is lifted. */
const lifted = () => screen.getByRole('button', { name: `Drag to reorder: ${TASK}` }).getAttribute('aria-pressed') === 'true'
/**
 * After a drop dnd-kit stops the next click with a document listener it removes 50 ms later.
 * Left pending under fake timers it would swallow the next test's clicks.
 */
const letDndKitTidyUp = () => wait(100)

describe('Checklist Review row: a press inside Cost this task', () => {
  it.each(['mouse', 'finger'] as const)('the row’s own 280 ms hold still lifts the task (%s)', async (how) => {
    const onDragEnd = vi.fn()
    renderChecklistRow(onDragEnd)
    await settle()
    vi.useFakeTimers()
    const title = screen.getByText(TASK)
    press(title, how)
    wait(300)
    const liftedOnItsOwn = lifted()
    letGo(title, how)
    letDndKitTidyUp()
    expect({ liftedOnItsOwn, drops: onDragEnd.mock.calls.length }).toEqual({ liftedOnItsOwn: true, drops: 1 })
  })

  it.each(['mouse', 'finger'] as const)('a long press in the window lifts nothing, and Cancel still closes it (%s)', async (how) => {
    const onDragEnd = vi.fn()
    renderChecklistRow(onDragEnd)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Cost this task' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cost this task' })

    vi.useFakeTimers()
    press(backdropOf(dialog), how)
    wait(300)
    const liftedBehind = lifted()
    letGo(backdropOf(dialog), how)
    slowTap(screen.getByRole('button', { name: 'Cancel' }), 300, how)
    const stillOpen = screen.queryByRole('dialog') != null
    letDndKitTidyUp()

    expect({ liftedBehind, drops: onDragEnd.mock.calls.length, stillOpen }).toEqual({ liftedBehind: false, drops: 0, stillOpen: false })
  })
})
