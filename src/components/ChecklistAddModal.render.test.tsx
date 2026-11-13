// @vitest-environment jsdom
/**
 * Render tests for the "Go to checklist" button (v2.NNNN): by default it
 * navigates the page behind to /checklist?tab=today while the modal — and the
 * draft typed into it — stays open, so a mis-click costs nothing. The
 * standalone /task shortcut page passes goToChecklistKeepsModalOpen={false}
 * to keep the old close-then-navigate behavior (that page unmounts on
 * navigation, so "stay open" is impossible there).
 */
import { describe, expect, it, vi } from 'vitest'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { cleanup, fireEvent, screen } from '@testing-library/react'

// Phone branch (v2.3188): flip to true for the docked-card test.
let phoneViewport = false
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => phoneViewport }))

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})

// The places tasks already carry (#328): the Place row's chips. Empty unless a test fills it.
const offeredPlaces = vi.hoisted(() => ({ places: [] as Array<{ name: string; lat: number; lng: number; accuracyM: number | null; setBy: string | null; setAt: string | null }> }))
vi.mock('../lib/tasks/taskPlaceIo', () => ({ loadRecentTaskPlaces: () => Promise.resolve(offeredPlaces.places), loadTaskPlace: () => Promise.resolve(null) }))

// The photo of the spot (#328, PR 6): the field is stood in for by one press that hands up a picture, and the send is recorded.
const spotPhotoIo = vi.hoisted(() => ({ puts: [] as string[], refusal: null as string | null }))
vi.mock('../lib/tasks/taskSpotPhotoIo', () => ({
  putTaskSpotPhoto: (owner: { kind: string; id: string }, id: string) => {
    spotPhotoIo.puts.push(`${owner.kind}/${owner.id}/${id}`)
    return Promise.resolve(spotPhotoIo.refusal ? { error: spotPhotoIo.refusal } : { path: `${owner.kind}/${owner.id}/${id}.jpg` })
  },
}))
vi.mock('./checklist/TaskSpotPhotoField', () => ({
  TaskSpotPhotoField: (props: { value: unknown; onChange: (v: unknown) => void }) => (
    <button type="button" onClick={() => props.onChange({ kind: 'new', id: 'p1', blob: new Blob(['x']), previewUrl: 'blob:p1' })}>
      {props.value ? 'photo held' : 'stub: take the photo'}
    </button>
  ),
}))

// Rows the modal inserts (v2.3751 job-bar tests read the checklist_items row back).
const inserted = vi.hoisted(() => [] as Array<{ table: string; row: unknown }>)
// The roster and the rows a table lists (v2.7085, the faces): one made-up person unless a test fills them.
const ONE_PERSON = vi.hoisted(() => [{ id: 'smoke-auth-user', name: 'Robert', email: 'smoke@example.com', role: 'dev' }])
const db = vi.hoisted(() => ({ users: [] as Array<{ id: string; name: string; email: string; role: string }>, rows: {} as Record<string, unknown[]> }))
db.users = ONE_PERSON

vi.mock('../lib/supabase', () => {
  // Table-aware stub: the generic renderSmokeMocks stub resolves single() to
  // null, but the modal renders null until the role query returns one.
  function makeBuilder(table: string, listResult: unknown[], singleResult: unknown) {
    const listPromise = () => Promise.resolve({ data: listResult, error: null })
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'in', 'order', 'limit']) {
      builder[m] = () => builder
    }
    builder.insert = (row: unknown) => {
      inserted.push({ table, row })
      return builder
    }
    builder.upsert = builder.insert
    builder.single = () => Promise.resolve({ data: singleResult, error: null })
    builder.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
      listPromise().then(f, r)
    return builder
  }
  return {
    supabase: {
      from: (table: string) =>
        table === 'users'
          ? makeBuilder(table, db.users, { role: 'dev' })
          : makeBuilder(table, db.rows[table] ?? [], table === 'checklist_items' ? { id: 'item-1' } : null),
    },
  }
})

import ChecklistAddModal from './ChecklistAddModal'
import {
  ChecklistAddModalProvider,
  useChecklistAddModal,
} from '../contexts/ChecklistAddModalContext'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { THREAD_WINDOW_Z } from '../lib/windowLayers'

function OpenOnMount() {
  const modal = useChecklistAddModal()
  const opened = useRef(false)
  useEffect(() => {
    if (modal && !opened.current) {
      opened.current = true
      modal.openAddModal()
    }
  }, [modal])
  return null
}

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location-probe">{loc.pathname + loc.search}</div>
}

async function renderOpenModal(keepsOpen?: boolean) {
  renderWithProviders(
    <ChecklistAddModalProvider>
      <OpenOnMount />
      <LocationProbe />
      <ChecklistAddModal
        {...(keepsOpen === undefined ? {} : { goToChecklistKeepsModalOpen: keepsOpen })}
      />
    </ChecklistAddModalProvider>,
  )
  // Wait for the users fetch to settle: the form-reset effect re-fires when the
  // list lands, so typing before that would be wiped.
  await screen.findByText('Robert')
  // And for the window to settle on its first person: Send names them from then on.
  await screen.findByRole('button', { name: 'Send to Robert' })
  return screen.getByPlaceholderText('What needs to be done?') as HTMLTextAreaElement
}

/** The bar's Send. The one person on the roster is not the signed-in giver, so it names them. */
const sendPress = () => screen.getByRole('button', { name: 'Send to Robert' }) as HTMLButtonElement
/** A press on the Add row, by its key. */
const addPress = (key: string) => document.querySelector<HTMLButtonElement>(`[data-add-press="${key}"]`)!

describe('ChecklistAddModal "Go to checklist" button', () => {
  it('navigates behind the modal and keeps the draft open by default', async () => {
    const title = await renderOpenModal()
    fireEvent.change(title, { target: { value: 'Call the inspector back' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go to checklist' }))
    expect(screen.getByTestId('location-probe').textContent).toBe('/checklist?tab=today')
    const stillOpen = screen.getByPlaceholderText('What needs to be done?') as HTMLTextAreaElement
    expect(stillOpen.value).toBe('Call the inspector back')
    cleanup()
  })

  it('closes the modal before navigating when goToChecklistKeepsModalOpen is false', async () => {
    await renderOpenModal(false)
    fireEvent.click(screen.getByRole('button', { name: 'Go to checklist' }))
    expect(screen.getByTestId('location-probe').textContent).toBe('/checklist')
    expect(screen.queryByPlaceholderText('What needs to be done?')).toBeNull()
    cleanup()
  })
})

describe('ChecklistAddModal Done when… and the ring (v2.6617)', () => {
  it('keeps Done when… and the photo as presses on the Add row, and the sentence names what the card carries', async () => {
    const title = await renderOpenModal()
    fireEvent.change(title, { target: { value: 'Rack the pipe' } })
    expect(addPress('lines').textContent).toBe('+ Done when…')
    expect(addPress('photo').textContent).toBe('+ Photo at the finish')
    expect(addPress('photo').getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByLabelText('Done when')).toBeNull()
    fireEvent.click(addPress('lines'))
    fireEvent.change(screen.getByLabelText('Done when'), { target: { value: 'Pipe is racked by size\nFittings are in labeled bins' } })
    // A line written turns the photo on by itself, until the writer touches the switch.
    expect(addPress('lines').textContent).toBe('✓ Done when… · 2 lines')
    expect(addPress('photo').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('status').textContent).toContain('It has 2 Done when… lines and asks for a photo at the finish.')
    fireEvent.click(addPress('photo'))
    expect(addPress('photo').textContent).toBe('+ Photo at the finish')
    expect(screen.getByRole('status').textContent).toContain('It has 2 Done when… lines.')
    cleanup()
  })

  it('says on Repeats that a repeating task keeps its tick', async () => {
    await renderOpenModal()
    expect(screen.queryByTestId('repeat-ring-hint')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Repeats' }))
    expect(screen.getByTestId('repeat-ring-hint').textContent).toBe('A repeating task keeps its tick. A one-off gets the % ring.')
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.queryByTestId('repeat-ring-hint')).toBeNull()
    cleanup()
  })
})

describe('ChecklistAddModal Send (v2.7085)', () => {
  it('holds Send dead until a task is typed, says why, and names who gets it', async () => {
    const title = await renderOpenModal()
    expect(sendPress().disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toBe('Type the task first.')
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    fireEvent.change(title, { target: { value: 'Order the 3/4" copper' } })
    expect(sendPress().disabled).toBe(false)
    expect(screen.getByRole('status').textContent).toBe('Robert gets it today. It stays until it is done. You hear when it is done.')
    fireEvent.change(title, { target: { value: '   ' } })
    expect(sendPress().disabled).toBe(true)
    cleanup()
  })

  it('keeps a second Send at the top of a phone once a title is typed', async () => {
    phoneViewport = true
    try {
      const title = await renderOpenModal()
      expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
      fireEvent.change(title, { target: { value: 'Order the 3/4" copper' } })
      expect(screen.getAllByRole('button', { name: 'Send' })).toHaveLength(1)
      expect(sendPress().disabled).toBe(false)
    } finally {
      phoneViewport = false
      cleanup()
    }
  })

  it('the bell beside Send is Tell me when it is done, lit, and a press stores it off', async () => {
    inserted.length = 0
    const title = await renderOpenModal()
    fireEvent.change(title, { target: { value: 'Order hose clamps' } })
    const bell = screen.getByRole('button', { name: "Tell me when it's done" })
    expect(bell.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(bell)
    expect(screen.getByRole('status').textContent).toBe('Robert gets it today. It stays until it is done.')
    fireEvent.click(sendPress())
    await vi.waitFor(() => expect(inserted.some((r) => r.table === 'checklist_items')).toBe(true))
    expect((inserted.find((r) => r.table === 'checklist_items')!.row as { notify_creator_on_complete: boolean }).notify_creator_on_complete).toBe(false)
    await vi.waitFor(() => expect(screen.queryByPlaceholderText('What needs to be done?')).toBeNull())
    cleanup()
  })
})

describe('ChecklistAddModal closing', () => {
  it('ignores a click on the backdrop and closes from the header ×', async () => {
    const title = await renderOpenModal()
    fireEvent.change(title, { target: { value: 'Order the 3/4" copper' } })
    fireEvent.click(screen.getByRole('dialog'))
    expect((screen.getByPlaceholderText('What needs to be done?') as HTMLTextAreaElement).value).toBe('Order the 3/4" copper')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByPlaceholderText('What needs to be done?')).toBeNull()
    cleanup()
  })

  it('opens over a thread window, so Ask a tech… and Send as a task show it (v2.7069)', async () => {
    await renderOpenModal()
    expect(Number(screen.getByRole('dialog').style.zIndex)).toBeGreaterThan(THREAD_WINDOW_Z)
    cleanup()
  })
})

describe('ChecklistAddModal on a phone (v2.3188)', () => {
  it('docks the card to the top under the safe-area inset, edge to edge; desktop stays centered', async () => {
    await renderOpenModal()
    let dialog = screen.getByRole('dialog')
    let card = screen.getByTestId('checklist-add-modal-card')
    expect(dialog.style.alignItems).toBe('center')
    expect(card.style.width).toBe('90%')
    cleanup()
    phoneViewport = true
    try {
      await renderOpenModal()
      dialog = screen.getByRole('dialog')
      card = screen.getByTestId('checklist-add-modal-card')
      expect(dialog.style.alignItems).toBe('flex-start')
      // jsdom drops env() values, so the safe-area padding is checked live, not here.
      expect(card.style.width).toBe('100%')
      expect(card.style.borderRadius).toBe('0 0 14px 14px')
      expect(card.style.maxHeight).toBe('100%')
    } finally {
      phoneViewport = false
      cleanup()
    }
  })
})

/* ── the job bar (v2.3751) ──────────────────────────────────────────────── */

const JOB_URL = 'http://localhost:3000/jobs?jobDetail=job-1'
const JOB_PRESET = {
  title: '',
  links: [JOB_URL],
  job: {
    id: 'job-1',
    number: '1016',
    name: 'Mission faucet',
    trade: { tag: 'PLUM', color: '#e17235' },
    address: '15638 Mission Crest, San Antonio, TX',
    customer: 'Johnny Ingram',
    path: '/jobs?jobDetail=job-1',
    url: JOB_URL,
  },
}

function OpenWithJobOnMount() {
  const modal = useChecklistAddModal()
  const opened = useRef(false)
  useEffect(() => {
    if (modal && !opened.current) {
      opened.current = true
      modal.openAddModal({ preset: JOB_PRESET })
    }
  }, [modal])
  return null
}

async function renderOpenModalWithJob() {
  renderWithProviders(
    <ChecklistAddModalProvider>
      <OpenWithJobOnMount />
      <LocationProbe />
      <ChecklistAddModal />
    </ChecklistAddModalProvider>,
  )
  await screen.findByText('Robert')
  await screen.findByRole('button', { name: 'Send to Robert' })
  return screen.getByPlaceholderText('What needs doing on this job?') as HTMLTextAreaElement
}

describe('ChecklistAddModal job bar (v2.3751)', () => {
  it('shows the job as a bar above an empty box, and Send stores the pre-v2.3751 token title with the job as link [1]', async () => {
    inserted.length = 0
    const title = await renderOpenModalWithJob()
    expect(title.value).toBe('')
    const bar = screen.getByTestId('checklist-add-job-bar')
    expect(bar.textContent).toContain('1016 PLUM')
    expect(bar.textContent).toContain('Mission faucet')
    expect(bar.textContent).toContain('15638 Mission Crest, San Antonio, TX · Johnny Ingram')
    // The raw grammar never reaches the box; Send waits for typed text.
    expect(screen.queryByDisplayValue(/\{\{1:/)).toBeNull()
    expect(sendPress().disabled).toBe(true)
    fireEvent.change(title, { target: { value: '  Pick up the Moen cartridge ' } })
    expect(sendPress().disabled).toBe(false)
    fireEvent.click(sendPress())
    await vi.waitFor(() => expect(inserted.some((r) => r.table === 'checklist_items')).toBe(true))
    const row = inserted.find((r) => r.table === 'checklist_items')!.row as { title: string; links: string[] }
    expect(row.title).toBe('{{1:1016 · Mission faucet}} — Pick up the Moen cartridge')
    expect(row.links).toEqual([JOB_URL])
    // The save chain closes the dialog; wait for it so nothing runs past cleanup.
    await vi.waitFor(() => expect(screen.queryByTestId('checklist-add-job-bar')).toBeNull())
    cleanup()
  })

  it('× on the bar makes it an ordinary task: bar and link gone, the box keeps what was typed', async () => {
    const title = await renderOpenModalWithJob()
    fireEvent.change(title, { target: { value: 'Call the inspector back' } })
    // The job is the task's first link, and its panel stays closed behind the bar.
    expect(addPress('link').textContent).toBe('✓ 1 link')
    expect(screen.queryByTestId('new-task-panel-link')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Remove job' }))
    expect(screen.queryByTestId('checklist-add-job-bar')).toBeNull()
    expect(addPress('link').textContent).toBe('+ Link')
    const plain = screen.getByPlaceholderText('What needs to be done?') as HTMLTextAreaElement
    expect(plain.value).toBe('Call the inspector back')
    cleanup()
  })

  it('"open" on the bar navigates the page behind to the job and keeps the draft open', async () => {
    const title = await renderOpenModalWithJob()
    fireEvent.change(title, { target: { value: 'Bring the camera' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open the job' }))
    expect(screen.getByTestId('location-probe').textContent).toBe('/jobs?jobDetail=job-1')
    expect((screen.getByPlaceholderText('What needs doing on this job?') as HTMLTextAreaElement).value).toBe('Bring the camera')
    cleanup()
  })
})

describe('ChecklistAddModal schedule calendar (punch list #217, office-13)', () => {
  const landing = () => Array.from(document.querySelectorAll<HTMLElement>('[data-schedule-calendar] [data-cal-day][data-lands]')).map((el) => el.dataset.calDay!)
  const dow = (ymd: string) => new Date(ymd + 'T12:00:00').getDay()

  it('draws the next weeks under the weekday buttons and follows them, with the sentence under it', async () => {
    await renderOpenModal()
    expect(document.querySelector('[data-schedule-calendar]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Repeats' }))
    const calendar = document.querySelector<HTMLElement>('[data-schedule-calendar]')!
    expect(calendar).not.toBeNull()
    expect(calendar.querySelectorAll('[data-cal-day]')).toHaveLength(28)
    expect(calendar.querySelectorAll('[data-today]')).toHaveLength(1)
    expect(landing()).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Monday' }))
    const mondays = landing()
    expect(mondays.length).toBeGreaterThanOrEqual(3)
    expect(mondays.every((d) => dow(d) === 1)).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Wednesday' }))
    const both = landing()
    expect(both.length).toBeGreaterThan(mondays.length)
    expect(both.every((d) => dow(d) === 1 || dow(d) === 3)).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Monday' }))
    expect(landing().every((d) => dow(d) === 3)).toBe(true)

    // The sentence stays, as the caption under the calendar.
    const status = screen.getByRole('status')
    expect(calendar.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    cleanup()
  })

  it('a one-off on today draws only once it has a due day', async () => {
    await renderOpenModal()
    expect(document.querySelector('[data-schedule-calendar]')).toBeNull()
    // Due by is a press on the Add row now; its date box opens under the row.
    expect(document.querySelector('input[type="date"]')).toBeNull()
    fireEvent.click(addPress('due'))
    const today = document.querySelector<HTMLInputElement>('input[type="date"]')!.min
    const due = new Date(today + 'T12:00:00')
    due.setDate(due.getDate() + 3)
    const dueYmd = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="date"]')!, { target: { value: dueYmd } })
    const calendar = document.querySelector<HTMLElement>('[data-schedule-calendar]')!
    expect(calendar).not.toBeNull()
    expect(landing()).toEqual([today])
    expect(calendar.querySelector(`[data-cal-day="${dueYmd}"]`)!.getAttribute('data-due')).toBe('true')
    // A due day keeps the task until it is done, so Just for the day leaves the row.
    expect(addPress('due').textContent).toMatch(/^✓ Due by /)
    expect(addPress('oneDay')).toBeNull()
    cleanup()
  })
})

/* ── the New task window's rows (punch list #331, v2.7085) ─────────────────── */

// Made-up people. The signed-in giver is on this roster, so the faces lead with Me.
const CREW_ROSTER = [
  { id: 'smoke-auth-user-1', name: 'Rosa', email: 'rosa@example.com', role: 'dev' },
  { id: 'theo', name: 'Theo', email: 'theo@example.com', role: 'helpers' },
  { id: 'imani', name: 'Imani', email: 'imani@example.com', role: 'helpers' },
  { id: 'wes', name: 'Wes', email: 'wes@example.com', role: 'helpers' },
]

async function renderWithRoster() {
  db.users = CREW_ROSTER
  // The giver's last task went to Theo, so Theo has a face. Imani and Wes are reached through Someone else.
  db.rows = { checklist_items: [{ id: 't1' }], checklist_item_assignees: [{ checklist_item_id: 't1', user_id: 'theo' }] }
  renderWithProviders(
    <ChecklistAddModalProvider>
      <OpenOnMount />
      <ChecklistAddModal />
    </ChecklistAddModalProvider>,
  )
  await screen.findByRole('button', { name: 'Theo' })
  await screen.findByRole('button', { name: 'Add to my list' })
  return screen.getByPlaceholderText('What needs to be done?') as HTMLTextAreaElement
}
const restoreRoster = () => {
  db.users = ONE_PERSON
  db.rows = {}
  cleanup()
}
const faceNames = () => Array.from(screen.getByTestId('new-task-faces').querySelectorAll('button')).map((b) => b.getAttribute('aria-label'))

describe('ChecklistAddModal as New task (punch list #331)', () => {
  it('is called New task and opens on the giver, for today', async () => {
    try {
      const title = await renderWithRoster()
      expect(screen.getByRole('dialog').getAttribute('aria-labelledby')).toBe('checklist-add-modal-title')
      expect(document.getElementById('checklist-add-modal-title')!.textContent).toBe('New task')
      expect(faceNames()).toEqual(['Me', 'Theo'])
      expect(screen.getByRole('button', { name: 'Me' }).getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-pressed')).toBe('true')
      fireEvent.change(title, { target: { value: 'Grease the pump bearings' } })
      expect(screen.getByRole('status').textContent).toBe('It goes on your list today. It stays until it is done.')
      expect(screen.getByRole('button', { name: 'Add to my list' })).toBeTruthy()
      // A task that is only the giver's has nobody to tell.
      expect(screen.queryByRole('button', { name: "Tell me when it's done" })).toBeNull()
    } finally {
      restoreRoster()
    }
  })

  it('one press on a face gives the task to that person and takes the giver off', async () => {
    try {
      inserted.length = 0
      const title = await renderWithRoster()
      fireEvent.change(title, { target: { value: 'Grease the pump bearings' } })
      fireEvent.click(screen.getByRole('button', { name: 'Theo' }))
      expect(screen.getByRole('button', { name: 'Me' }).getAttribute('aria-pressed')).toBe('false')
      expect(screen.getByRole('status').textContent).toBe('Theo gets it today. It stays until it is done. You hear when it is done.')
      fireEvent.click(screen.getByRole('button', { name: 'Send to Theo' }))
      await vi.waitFor(() => expect(inserted.some((r) => r.table === 'checklist_item_assignees')).toBe(true))
      const sent = inserted.find((r) => r.table === 'checklist_item_assignees')!.row as Array<{ user_id: string }>
      expect(sent.map((r) => r.user_id)).toEqual(['theo'])
      await vi.waitFor(() => expect(screen.queryByPlaceholderText('What needs to be done?')).toBeNull())
    } finally {
      restoreRoster()
    }
  })

  it('Someone else opens the full list in place, and a person picked there takes a face after Me', async () => {
    try {
      const title = await renderWithRoster()
      fireEvent.change(title, { target: { value: 'Walk the north fence' } })
      const everyone = screen.getByTestId('new-task-everyone')
      expect(everyone.hidden).toBe(true)
      fireEvent.click(screen.getByRole('button', { name: 'Someone else' }))
      expect(everyone.hidden).toBe(false)
      expect(screen.getByRole('button', { name: 'Someone else' }).getAttribute('aria-expanded')).toBe('true')
      fireEvent.click(screen.getByLabelText('Imani'))
      expect(faceNames()).toEqual(['Me', 'Imani', 'Theo'])
      expect(screen.getByRole('button', { name: 'Imani' }).getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByRole('button', { name: 'Send to Imani' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Theo' }))
      expect(screen.getByRole('button', { name: 'Send to Imani and Theo' })).toBeTruthy()
    } finally {
      restoreRoster()
    }
  })

  it('Tomorrow is one press and stores the next day as a dated task', async () => {
    try {
      inserted.length = 0
      const title = await renderWithRoster()
      fireEvent.change(title, { target: { value: 'Check the water troughs' } })
      fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }))
      expect(screen.getByRole('button', { name: 'Tomorrow' }).getAttribute('aria-pressed')).toBe('true')
      expect(document.querySelector('input[type="date"]')).toBeNull()
      expect(screen.getByRole('status').textContent).toMatch(/^It goes on your list tomorrow\./)
      fireEvent.click(screen.getByRole('button', { name: 'Add to my list' }))
      await vi.waitFor(() => expect(inserted.some((r) => r.table === 'checklist_items')).toBe(true))
      const row = inserted.find((r) => r.table === 'checklist_items')!.row as { start_date: string; repeat_type: string }
      const now = new Date()
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      expect(row.start_date).toBe(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`)
      expect(row.repeat_type).toBe('once')
      await vi.waitFor(() => expect(screen.queryByPlaceholderText('What needs to be done?')).toBeNull())
    } finally {
      restoreRoster()
    }
  })

  it('Pick a day opens the date box, and the segment then reads the day', async () => {
    try {
      await renderWithRoster()
      fireEvent.click(screen.getByRole('button', { name: 'Pick a day' }))
      const box = document.querySelector<HTMLInputElement>('input[type="date"]')!
      fireEvent.change(box, { target: { value: '2031-03-17' } })
      expect(screen.getByRole('group', { name: 'When' }).textContent).toContain('Mon 17')
    } finally {
      restoreRoster()
    }
  })

  it('a rare thing opens under the Add row by its press, one at a time, and shows its value once set', async () => {
    try {
      inserted.length = 0
      const title = await renderWithRoster()
      fireEvent.change(title, { target: { value: 'Grease the pump bearings' } })
      expect(Array.from(document.querySelectorAll('[data-add-press]')).map((b) => b.textContent)).toEqual([
        '+ Remind',
        '+ Tell someone else',
        '+ Link',
        '+ Due by',
        '+ Done when…',
        '+ Photo at the finish',
        '+ Just for the day',
      ])
      expect(screen.queryByTestId('new-task-panel-remind')).toBeNull()
      fireEvent.click(addPress('remind'))
      fireEvent.click(screen.getByRole('button', { name: 'Morning 7:00' }))
      expect(addPress('remind').textContent).toBe('✓ Remind · Morning 7:00')
      fireEvent.click(addPress('link'))
      expect(screen.queryByTestId('new-task-panel-remind')).toBeNull()
      fireEvent.change(screen.getByLabelText('Link 1'), { target: { value: 'https://example.com/pump-manual' } })
      expect(addPress('link').textContent).toBe('✓ 1 link')
      fireEvent.click(addPress('oneDay'))
      expect(addPress('oneDay').getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByRole('status').textContent).toContain('It leaves the list when that day ends.')
      fireEvent.click(screen.getByRole('button', { name: 'Add to my list' }))
      await vi.waitFor(() => expect(inserted.some((r) => r.table === 'checklist_items')).toBe(true))
      expect(inserted.find((r) => r.table === 'checklist_items')!.row).toMatchObject({
        reminder_time: '07:00',
        links: ['https://example.com/pump-manual'],
        show_until_completed: false,
      })
      await vi.waitFor(() => expect(screen.queryByPlaceholderText('What needs to be done?')).toBeNull())
    } finally {
      restoreRoster()
    }
  })

  it('a repeating task leaves Due by and Just for the day off the row', async () => {
    try {
      await renderWithRoster()
      fireEvent.click(screen.getByRole('button', { name: 'Repeats' }))
      expect(addPress('due')).toBeNull()
      expect(addPress('oneDay')).toBeNull()
      expect(screen.getByRole('status').textContent).toBe('Type the task first.')
    } finally {
      restoreRoster()
    }
  })
})

describe('ChecklistAddModal place (punch list #328)', () => {
  it('a task with no place sends the row it always sent: no place column at all', async () => {
    inserted.length = 0
    offeredPlaces.places = [{ name: 'Pump house', lat: 29.5512, lng: -98.2874, accuracyM: 6, setBy: 'u1', setAt: '2026-11-03T15:00:00Z' }]
    const title = await renderOpenModal()
    expect((await screen.findByRole('button', { name: 'Pump house' })).getAttribute('aria-pressed')).toBe('false')
    fireEvent.change(title, { target: { value: 'Order hose clamps' } })
    fireEvent.click(sendPress())
    await vi.waitFor(() => expect(inserted.some((r) => r.table === 'checklist_items')).toBe(true))
    const row = inserted.find((r) => r.table === 'checklist_items')!.row as Record<string, unknown>
    expect(Object.keys(row).filter((k) => k.startsWith('place_'))).toEqual([])
    await vi.waitFor(() => expect(screen.queryByPlaceholderText('What needs to be done?')).toBeNull())
    offeredPlaces.places = []
    cleanup()
  })

  it('one press on a place chip and Send stores the place whole, set by the sender', async () => {
    inserted.length = 0
    offeredPlaces.places = [{ name: 'Pump house', lat: 29.5512, lng: -98.2874, accuracyM: 6, setBy: 'u1', setAt: '2026-11-03T15:00:00Z' }]
    const title = await renderOpenModal()
    fireEvent.change(title, { target: { value: 'Grease the pump bearings' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Pump house' }))
    expect(screen.getByRole('button', { name: 'Pump house' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(sendPress())
    await vi.waitFor(() => expect(inserted.some((r) => r.table === 'checklist_items')).toBe(true))
    const row = inserted.find((r) => r.table === 'checklist_items')!.row as Record<string, unknown>
    expect(row).toMatchObject({ place_name: 'Pump house', place_lat: 29.5512, place_lng: -98.2874, place_accuracy_m: 6, place_set_by: 'smoke-auth-user-1' })
    expect(typeof row.place_set_at).toBe('string')
    await vi.waitFor(() => expect(screen.queryByPlaceholderText('What needs to be done?')).toBeNull())
    offeredPlaces.places = []
    cleanup()
  })
})

describe('ChecklistAddModal photo of the spot (punch list #328, PR 6)', () => {
  it('a task sent with a photo files it under the new task\'s id, after the task exists', async () => {
    inserted.length = 0
    spotPhotoIo.puts = []
    const title = await renderOpenModal()
    fireEvent.change(title, { target: { value: 'Grease the pump bearings' } })
    fireEvent.click(screen.getByRole('button', { name: 'stub: take the photo' }))
    expect(screen.getByRole('button', { name: 'photo held' })).toBeTruthy()
    fireEvent.click(sendPress())
    await vi.waitFor(() => expect(spotPhotoIo.puts).toEqual(['item/item-1/p1']))
    await vi.waitFor(() => expect(screen.queryByPlaceholderText('What needs to be done?')).toBeNull())
    cleanup()
  })

  it('a task sent with no photo sends none', async () => {
    inserted.length = 0
    spotPhotoIo.puts = []
    const title = await renderOpenModal()
    fireEvent.change(title, { target: { value: 'Order hose clamps' } })
    fireEvent.click(sendPress())
    await vi.waitFor(() => expect(screen.queryByPlaceholderText('What needs to be done?')).toBeNull())
    expect(spotPhotoIo.puts).toEqual([])
    cleanup()
  })

  it('a photo that does not save says the task was sent, why the photo was not, and where to add it, and stays open', async () => {
    inserted.length = 0
    spotPhotoIo.puts = []
    spotPhotoIo.refusal = 'The photo did not upload.'
    const title = await renderOpenModal()
    fireEvent.change(title, { target: { value: 'Grease the pump bearings' } })
    fireEvent.click(screen.getByRole('button', { name: 'stub: take the photo' }))
    fireEvent.click(sendPress())
    expect(await screen.findByText('The task was sent, but its photo did not save: The photo did not upload. Add it from Checklist → Manage → Edit.')).toBeTruthy()
    expect(inserted.filter((r) => r.table === 'checklist_items')).toHaveLength(1)
    expect(screen.getByPlaceholderText('What needs to be done?')).toBeTruthy()
    spotPhotoIo.refusal = null
    cleanup()
  })
})
