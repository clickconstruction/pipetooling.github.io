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

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../lib/supabase', () => {
  // Table-aware stub: the generic renderSmokeMocks stub resolves single() to
  // null, but the modal renders null until the role query returns one.
  function makeBuilder(listResult: unknown[], singleResult: unknown) {
    const listPromise = () => Promise.resolve({ data: listResult, error: null })
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'in', 'order', 'limit']) {
      builder[m] = () => builder
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
        table === 'users' ? makeBuilder(users, { role: 'dev' }) : makeBuilder([], null),
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
