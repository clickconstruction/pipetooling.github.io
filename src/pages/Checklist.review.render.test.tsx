// @vitest-environment jsdom
/**
 * Checklist → Review's board, drawn through the page: the three tiles and the two folds over it, a person's card
 * opened onto their rows (the age chip, the roadmap stage bar, the tick and the bin), the ask before a row is
 * deleted, and the bar that offers Undo after a tick. The row and the list live in
 * `components/checklist/OutstandingByPersonList.tsx` (v2.7765) and the tiles, fold headers, Undo bar and delete ask
 * in `reviewBoardChrome.tsx` and `ChecklistReviewAsks.tsx` (v2.7766); this holds what the tab draws from them, and
 * it passed on the page before any of them left it.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { writeFileSync } from 'node:fs'
import { installDomShims, renderWithProviders, settle } from '../test/renderSmokeMocks'

installDomShims()

type Row = Record<string, unknown>
const H = vi.hoisted(() => ({
  board: [] as Record<string, unknown>[],
  /** Rows a tick finished or a delete took, by id. */
  gone: new Set<string>(),
  /** Every write to the day rows, as `method:ids` with what an update set. */
  writes: [] as string[],
}))

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  /** The day rows: the board's read answers what is still open, a count answers none, and a write is kept and obeyed. */
  const instances = (): Record<string, unknown> => {
    let count = false
    let write: null | { method: string; set?: Row } = null
    let ids: string[] = []
    const b: Record<string, unknown> = {}
    for (const m of ['is', 'gte', 'lte', 'lt', 'gt', 'order', 'limit', 'not']) b[m] = () => b
    b.select = (cols: string) => ((count = cols === 'scheduled_date'), b)
    b.update = (set: Row) => ((write = { method: 'update', set }), b)
    b.delete = () => ((write = { method: 'delete' }), b)
    b.in = (_col: string, vals: string[]) => ((ids = vals), b)
    b.eq = (col: string, val: string) => {
      if (col === 'id') ids = [val]
      return b
    }
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      if (write) {
        const reopen = write.method === 'update' && write.set?.completed_at === null
        H.writes.push(`${write.method}${reopen ? ' (reopen)' : ''}:${ids.join(',')}`)
        for (const id of ids) {
          if (reopen) H.gone.delete(id)
          else H.gone.add(id)
        }
        return Promise.resolve({ data: ids.map((id) => ({ id })), error: null }).then(ok, bad)
      }
      return Promise.resolve(count ? { data: [], count: 0, error: null } : { data: H.board.filter((r) => !H.gone.has(r.id as string)), error: null }).then(ok, bad)
    }
    return b
  }
  const users = (): Record<string, unknown> => {
    const b = stub.from() as Record<string, unknown>
    b.single = () => Promise.resolve({ data: { role: 'dev' }, error: null })
    return b
  }
  return { supabase: { ...stub, from: (table: string) => (table === 'checklist_instances' ? instances() : table === 'users' ? users() : stub.from()) } }
})
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

const { default: Checklist } = await import('./Checklist')

const ROADMAP_EMBED = { group_id: 'g1', checklist_tech_tree_groups: { title: 'Stage Two', roadmap_id: 'r1', checklist_tech_tree_roadmaps: { title: 'Farm 1' } } }

/** One open one-off on the board. */
function boardRow(id: string, title: string, day: string, userId: string, name: string, item: Row = {}): Row {
  return {
    id,
    checklist_item_id: `item-${id}`,
    scheduled_date: day,
    checklist_items: { title, links: null, repeat_type: 'once', reminder_scope: null, created_at: `${day}T15:00:00Z`, created_by_user_id: 'u-office', roadmap_group_task_id: null, ...item },
    checklist_instance_assignees: [{ user_id: userId, users: { name, email: null } }],
  }
}

/** The page on Review with Dana's card open. */
async function openDanasCard() {
  const view = renderWithProviders(<Checklist />, { route: '/checklist?tab=review' })
  fireEvent.click(await screen.findByText('Dana Whitlow'))
  await screen.findByText('ZZ Return the pipe threader')
  await settle()
  return view
}

/** The row a task's title sits in. */
const rowOf = (title: string) => within(screen.getByText(title).closest('.obp-row') as HTMLElement)

/**
 * What the tab draws, kept beside the run when asked for, to compare two builds of the page. The sortable rows
 * carry `transition: transform 0ms linear` for the one render after their list changes, so whether a dump holds it
 * turns on the moment it is taken; it is left out, and the rest is compared byte for byte.
 */
function dump(part: 'board' | 'ask' | 'undo', html: string): void {
  if (!process.env.CHECKLIST_REVIEW_HTML) return
  writeFileSync(`${process.env.CHECKLIST_REVIEW_HTML}.${part}.html`, html.split(' transition: transform 0ms linear;').join(''))
}

describe('Checklist → Review, the board', () => {
  beforeAll(() => {
    // The day the rows' ages are read against. Only the clock is held, so the reads and the undo timer still run.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T18:00:00Z'))
  })
  afterAll(() => {
    vi.useRealTimers()
  })
  beforeEach(() => {
    H.board = [
      boardRow('b1', 'ZZ Return the pipe threader', '2026-10-28', 'u-dana', 'Dana Whitlow'),
      boardRow('b2', 'ZZ Cut the trail', '2026-11-08', 'u-dana', 'Dana Whitlow', { roadmap_group_task_id: 'rt1', checklist_tech_tree_group_tasks: ROADMAP_EMBED }),
      boardRow('b3', 'ZZ Order the valves', '2026-11-09', 'u-eli', 'Eli Brandt'),
    ]
    H.gone = new Set()
    H.writes = []
    localStorage.clear()
  })

  it('draws the tiles and the folds over the board, and an opened card’s rows with their age, stage and presses', async () => {
    const { container } = await openDanasCard()

    // The three tiles, each a press that says its count and its caption.
    for (const label of ['To sign off', 'Outstanding', 'Missed this week']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label} — `) })).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: /^Outstanding — 3\./ })).toBeTruthy()
    // The two folds open closed.
    const folds = screen.getAllByRole('button', { expanded: false }).map((b) => b.textContent ?? '')
    expect(folds.some((t) => t.includes('Review: completed work'))).toBe(true)
    expect(folds.some((t) => t.includes('Dispatch & estimator inboxes'))).toBe(true)

    // Dana's two rows, the older first, each with its age chip, tick and bin; the roadmap task wears its stage.
    const rows = Array.from(container.querySelectorAll('.obp-row')).map((r) => r.querySelector('.obp-title')?.textContent)
    expect(rows).toEqual(['ZZ Return the pipe threader', 'ZZ Cut the trail'])
    expect(screen.getByTitle('2026-10-28').textContent).toBe('13d')
    expect(rowOf('ZZ Return the pipe threader').getByRole('button', { name: 'Mark complete' })).toBeTruthy()
    expect(rowOf('ZZ Return the pipe threader').getByRole('button', { name: 'Delete' })).toBeTruthy()
    expect(rowOf('ZZ Cut the trail').getByRole('button', { name: 'Stage Two' }).closest('.obp-goalbar')).not.toBeNull()
    expect(container.querySelectorAll('.obp-goalbar')).toHaveLength(1)

    dump('board', container.innerHTML)
  })

  it('the bin asks first, names the task and its day, and Delete takes that row', async () => {
    const { container } = await openDanasCard()
    fireEvent.click(rowOf('ZZ Return the pipe threader').getByRole('button', { name: 'Delete' }))
    const ask = within(screen.getByRole('dialog'))
    expect(ask.getByText('Delete outstanding task?')).toBeTruthy()
    expect(ask.getByText('ZZ Return the pipe threader')).toBeTruthy()
    expect(ask.getByText('(2026-10-28)')).toBeTruthy()
    expect(ask.getByText('This cannot be undone.')).toBeTruthy()
    dump('ask', container.innerHTML)

    // Cancel leaves the row and writes nothing.
    fireEvent.click(ask.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(H.writes).toEqual([])

    fireEvent.click(rowOf('ZZ Return the pipe threader').getByRole('button', { name: 'Delete' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(H.writes).toEqual(['delete:b1']))
    await waitFor(() => expect(screen.queryByText('ZZ Return the pipe threader')).toBeNull())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a tick finishes the row and offers Undo, and Undo opens it again', async () => {
    const { container } = await openDanasCard()
    fireEvent.click(rowOf('ZZ Cut the trail').getByRole('button', { name: 'Mark complete' }))
    const bar = await screen.findByText('✓ Completed — ZZ Cut the trail')
    await waitFor(() => expect(screen.queryByText('ZZ Cut the trail')).toBeNull())
    expect(H.writes).toEqual(['update:b2'])
    dump('undo', container.innerHTML)

    fireEvent.click(within(bar.parentElement as HTMLElement).getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(H.writes).toEqual(['update:b2', 'update (reopen):b2']))
    await screen.findByText('ZZ Cut the trail')
    expect(screen.queryByText('✓ Completed — ZZ Cut the trail')).toBeNull()
  })
})
