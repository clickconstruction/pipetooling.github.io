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
// Rows the modal updates after the insert (the card's tag, punch list #334).
const updated = vi.hoisted(() => [] as Array<{ table: string; row: unknown }>)

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
    builder.update = (row: unknown) => {
      updated.push({ table, row })
      return builder
    }
    builder.single = () => Promise.resolve({ data: singleResult, error: null })
    builder.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
      listPromise().then(f, r)
    return builder
  }
  const users = [
    { id: 'smoke-auth-user', name: 'Robert', email: 'smoke@example.com', role: 'dev' },
  ]
  return {
    supabase: {
      from: (table: string) =>
        table === 'users'
          ? makeBuilder(table, users, { role: 'dev' })
          : makeBuilder(table, [], table === 'checklist_items' ? { id: 'item-1' } : null),
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
  return screen.getByPlaceholderText('What needs to be done?') as HTMLTextAreaElement
}

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
  it('says what the closed fold is for, shows the photo switch beside it, and names what the card carries', async () => {
    await renderOpenModal()
    expect(screen.getByTestId('done-when-hint').textContent).toBe('what done means, one line each, ticked off on the card')
    const photo = screen.getByLabelText('Asks for a photo at the finish') as HTMLInputElement
    expect(photo.checked).toBe(false)
    expect(screen.queryByLabelText('Done when')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show done when' }))
    expect(screen.queryByTestId('done-when-hint')).toBeNull()
    fireEvent.change(screen.getByLabelText('Done when'), { target: { value: 'Pipe is racked by size\nFittings are in labeled bins' } })
    expect((screen.getByLabelText('Asks for a photo at the finish') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText(/stays until completed, 2 Done when… lines, a photo at the finish\./)).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Asks for a photo at the finish'))
    expect(screen.getByText(/stays until completed, 2 Done when… lines\./)).toBeTruthy()
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

describe('ChecklistAddModal Send buttons', () => {
  it('shows a header Send only once a title is typed, beside the footer Send', async () => {
    const title = await renderOpenModal()
    expect(screen.getAllByRole('button', { name: 'Send' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    fireEvent.change(title, { target: { value: 'Order the 3/4" copper' } })
    expect(screen.getAllByRole('button', { name: 'Send' })).toHaveLength(2)
    fireEvent.change(title, { target: { value: '   ' } })
    expect(screen.getAllByRole('button', { name: 'Send' })).toHaveLength(1)
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
    customer: 'Johnny Inglow',
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
    expect(bar.textContent).toContain('15638 Mission Crest, San Antonio, TX · Johnny Inglow')
    // The raw grammar never reaches the box; the header Send waits for typed text.
    expect(screen.queryByDisplayValue(/\{\{1:/)).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Send' })).toHaveLength(1)
    fireEvent.change(title, { target: { value: '  Pick up the Moen cartridge ' } })
    expect(screen.getAllByRole('button', { name: 'Send' })).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Send' })[0]!)
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
    expect(screen.getByText('(1)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove job' }))
    expect(screen.queryByTestId('checklist-add-job-bar')).toBeNull()
    expect(screen.queryByText('(1)')).toBeNull()
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
    const today = document.querySelector<HTMLInputElement>('input[type="date"]')!.min
    const due = new Date(today + 'T12:00:00')
    due.setDate(due.getDate() + 3)
    const dueYmd = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="date"]')!, { target: { value: dueYmd } })
    const calendar = document.querySelector<HTMLElement>('[data-schedule-calendar]')!
    expect(calendar).not.toBeNull()
    expect(landing()).toEqual([today])
    expect(calendar.querySelector(`[data-cal-day="${dueYmd}"]`)!.getAttribute('data-due')).toBe('true')
    cleanup()
  })
})

describe('ChecklistAddModal place (punch list #328)', () => {
  it('a task with no place sends the row it always sent: no place column at all', async () => {
    inserted.length = 0
    offeredPlaces.places = [{ name: 'Pump house', lat: 29.5512, lng: -98.2874, accuracyM: 6, setBy: 'u1', setAt: '2026-11-03T15:00:00Z' }]
    const title = await renderOpenModal()
    expect((await screen.findByRole('button', { name: 'Pump house' })).getAttribute('aria-pressed')).toBe('false')
    fireEvent.change(title, { target: { value: 'Order hose clamps' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Send' })[0]!)
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Send' })[0]!)
    await vi.waitFor(() => expect(inserted.some((r) => r.table === 'checklist_items')).toBe(true))
    const row = inserted.find((r) => r.table === 'checklist_items')!.row as Record<string, unknown>
    expect(row).toMatchObject({ place_name: 'Pump house', place_lat: 29.5512, place_lng: -98.2874, place_accuracy_m: 6, place_set_by: 'smoke-auth-user-1' })
    expect(typeof row.place_set_at).toBe('string')
    await vi.waitFor(() => expect(screen.queryByPlaceholderText('What needs to be done?')).toBeNull())
    offeredPlaces.places = []
    cleanup()
  })
})

// A card written for one specific thing (punch list #334): the Bridge opens the window with what finished looks like,
// no photo asked, and the key of the thing. Made-up customer.
const THING_PRESET = {
  title: 'Call Alder Builders about $40.0k late. Get a pay date for each bill.',
  links: ['https://app.example/customers/c1?todo=payer.c1'],
  doneWhen: ['201 · Maple Lofts: pay date written down', ' 202 · Oak Court: pay date written down '],
  asksForPhoto: false,
  sourceTag: 'payer.c1',
}

function OpenWithThingOnMount() {
  const modal = useChecklistAddModal()
  const opened = useRef(false)
  useEffect(() => {
    if (modal && !opened.current) {
      opened.current = true
      modal.openAddModal({ preset: THING_PRESET })
    }
  }, [modal])
  return null
}

describe('ChecklistAddModal, a card written for one thing (punch list #334)', () => {
  it('opens with the Done when lines shown and no photo asked, and Send keeps the thing’s key on the card', async () => {
    inserted.length = 0
    updated.length = 0
    renderWithProviders(
      <ChecklistAddModalProvider>
        <OpenWithThingOnMount />
        <ChecklistAddModal />
      </ChecklistAddModalProvider>,
    )
    await screen.findByText('Robert')
    expect(screen.getByDisplayValue(THING_PRESET.title)).toBeTruthy()
    // The lines arrive trimmed, one a line, and the fold is open so the sender reads them.
    const lines = screen.getByDisplayValue(/201 · Maple Lofts: pay date written down\s+202 · Oak Court: pay date written down/) as HTMLTextAreaElement
    expect(lines.value).toBe('201 · Maple Lofts: pay date written down\n202 · Oak Court: pay date written down')
    expect((screen.getByLabelText('Asks for a photo at the finish') as HTMLInputElement).checked).toBe(false)
    // Settle before Send: the person is ticked by an effect that runs after the list of people lands. A press before
    // it is refused for having nobody on the card, which a loaded runner made happen (the first CI run of this case).
    await screen.findByRole('checkbox', { name: 'Robert', checked: true }, { timeout: 4000 })
    fireEvent.click(screen.getAllByRole('button', { name: 'Send' })[0]!)
    await vi.waitFor(() => expect(inserted.some((r) => r.table === 'checklist_items')).toBe(true))
    const row = inserted.find((r) => r.table === 'checklist_items')!.row as Record<string, unknown>
    expect(row.links).toEqual(THING_PRESET.links)
    expect(row.asks_for_photo).toBe(false)
    // The key is written apart from the insert, so a card is still made where the column is not there yet.
    expect('source_tag' in row).toBe(false)
    await vi.waitFor(() => expect(updated).toEqual([{ table: 'checklist_items', row: { source_tag: 'payer.c1' } }]))
    await vi.waitFor(() => expect(screen.queryByDisplayValue(THING_PRESET.title)).toBeNull())
    cleanup()
  })

  it('writes no key on a card a person wrote by hand', async () => {
    inserted.length = 0
    updated.length = 0
    const title = await renderOpenModal()
    fireEvent.change(title, { target: { value: 'Order hose clamps' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Send' })[0]!)
    await vi.waitFor(() => expect(inserted.some((r) => r.table === 'checklist_items')).toBe(true))
    await vi.waitFor(() => expect(screen.queryByPlaceholderText('What needs to be done?')).toBeNull())
    expect(updated).toEqual([])
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Send' })[0]!)
    await vi.waitFor(() => expect(spotPhotoIo.puts).toEqual(['item/item-1/p1']))
    await vi.waitFor(() => expect(screen.queryByPlaceholderText('What needs to be done?')).toBeNull())
    cleanup()
  })

  it('a task sent with no photo sends none', async () => {
    inserted.length = 0
    spotPhotoIo.puts = []
    const title = await renderOpenModal()
    fireEvent.change(title, { target: { value: 'Order hose clamps' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Send' })[0]!)
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Send' })[0]!)
    expect(await screen.findByText('The task was sent, but its photo did not save: The photo did not upload. Add it from Checklist → Manage → Edit.')).toBeTruthy()
    expect(inserted.filter((r) => r.table === 'checklist_items')).toHaveLength(1)
    expect(screen.getByPlaceholderText('What needs to be done?')).toBeTruthy()
    spotPhotoIo.refusal = null
    cleanup()
  })
})
