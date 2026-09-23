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

// Rows the modal inserts (v2.3751 job-bar tests read the checklist_items row back).
const inserted = vi.hoisted(() => [] as Array<{ table: string; row: unknown }>)

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
