// @vitest-environment jsdom
/**
 * The New task window and the read of the person's role (finding 347). The window drew nothing until a read of the
 * role answered, and read it again on every open. A read that failed blanked the role, so an open window vanished,
 * the app still held it as open, and no later press of ＋ New task could bring it back until a reload.
 *
 * The role the app already holds stands in now, and a failed read keeps the role it had. Before the mend the two
 * cases of a failed read below failed: the window was gone while the app held it as open.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => true }))
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../lib/tasks/taskPlaceIo', () => ({ loadRecentTaskPlaces: () => Promise.resolve([]), loadTaskPlace: () => Promise.resolve(null) }))

/** What the read of the role answers next: the role, or a failure with no row, as a lost sign-in lock gives. */
const roleRead = vi.hoisted(() => ({ fails: false, asked: 0 }))
vi.mock('../lib/supabase', () => {
  function makeBuilder(table: string): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'in', 'order', 'limit', 'insert', 'update', 'upsert']) builder[m] = () => builder
    builder.single = () => {
      if (table !== 'users') return Promise.resolve({ data: null, error: null })
      roleRead.asked += 1
      return Promise.resolve(roleRead.fails ? { data: null, error: { message: 'AbortError: Lock was stolen by another request' } } : { data: { role: 'dev' }, error: null })
    }
    builder.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
      Promise.resolve({ data: table === 'users' ? [{ id: 'smoke-auth-user', name: 'Robert', email: 'smoke@example.com', role: 'dev' }] : [], error: null }).then(f, r)
    return builder
  }
  return { supabase: { from: (table: string) => makeBuilder(table) } }
})

import ChecklistAddModal from './ChecklistAddModal'
import { ChecklistAddModalProvider, useChecklistAddModal } from '../contexts/ChecklistAddModalContext'
import { renderWithProviders } from '../test/renderSmokeMocks'

/** The page's own press, and what the app holds: open or not. */
function Page() {
  const modal = useChecklistAddModal()
  return (
    <div>
      <button type="button" onClick={() => modal?.openAddModal()}>
        ＋ New task
      </button>
      <output data-testid="held">{modal?.isOpen ? 'open' : 'closed'}</output>
    </div>
  )
}
const open = () =>
  renderWithProviders(
    <ChecklistAddModalProvider>
      <Page />
      <ChecklistAddModal />
    </ChecklistAddModalProvider>,
  )
const press = () => fireEvent.click(screen.getByRole('button', { name: '＋ New task' }))
const win = () => screen.queryByRole('dialog', { name: 'New task' })
const settle = () => new Promise((r) => setTimeout(r, 30))

afterEach(() => {
  cleanup()
  roleRead.fails = false
  roleRead.asked = 0
})

describe('the New task window and the read of the role (finding 347)', () => {
  it('opens, closes and opens again while the read answers', async () => {
    open()
    press()
    await waitFor(() => expect(win()).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(win()).toBeNull())
    press()
    await waitFor(() => expect(win()).toBeTruthy())
  })

  it('the first open draws at once from the role the app holds, even when its own read fails', async () => {
    roleRead.fails = true
    open()
    press()
    // No wait on the read: the window is there in the same turn the press is made.
    expect(win()).toBeTruthy()
    await settle()
    expect(roleRead.asked).toBe(1)
    expect(win()).toBeTruthy()
    expect(screen.getByTestId('held').textContent).toBe('open')
  })

  it('a read of the role that fails on a later open does not take the window away', async () => {
    open()
    press()
    await waitFor(() => expect(win()).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(win()).toBeNull())
    // The second open's read loses the sign-in lock.
    roleRead.fails = true
    press()
    await settle()
    await settle()
    expect(screen.getByTestId('held').textContent).toBe('open')
    expect(win()).toBeTruthy()
  })

  it('a press never leaves the app holding a window that is not drawn', async () => {
    open()
    press()
    await waitFor(() => expect(win()).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(win()).toBeNull())
    roleRead.fails = true
    press()
    await settle()
    await settle()
    // Whatever the read did, what the app holds and what is drawn agree.
    expect(screen.getByTestId('held').textContent === 'open').toBe(win() != null)
    // And one more press opens it, with the read answering again.
    roleRead.fails = false
    press()
    await waitFor(() => expect(win()).toBeTruthy())
  })
})
