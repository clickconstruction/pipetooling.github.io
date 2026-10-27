// @vitest-environment jsdom
/**
 * Render smoke for Schedule → Share → Send now (punch list #184, sweep A, PR 2): a picked person
 * with no email on file is held with a door to add one, the button says both counts, and only
 * the people with an email go to `schedule-share-dispatch`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { PersonDeskProvider } from '../../contexts/PersonDeskContext'
import { ScheduleShareModal } from './ScheduleShareModal'

const USERS = [
  { id: 'u1', name: 'Marisol', email: 'marisol@example.com' },
  { id: 'u2', name: 'Todd', email: '' },
  { id: 'u3', name: 'Ana', email: 'ana@example.com' },
]
const invoke = vi.fn(async (_name: string, _opts: { body: { recipientUserIds: string[] } }) => ({ data: { ok: true, sent: 1, results: [{ recipientUserId: 'u1', ok: true }] }, error: null }))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', () => {
  function builder(data: unknown) {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'is', 'order', 'limit', 'eq', 'insert', 'update', 'delete']) b[m] = () => b
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok, bad)
    return b
  }
  return {
    supabase: {
      from: (table: string) => builder(table === 'users' ? USERS : []),
      rpc: () => builder([]),
      functions: { invoke: (name: string, opts: { body: { recipientUserIds: string[] } }) => invoke(name, opts) },
    },
  }
})
// The picker is its own tested component; a plain select stands in so the test can pick.
vi.mock('../SearchableSelect', () => ({
  SearchableSelect: (p: { id?: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void; listAriaLabel?: string }) => (
    <select aria-label={p.listAriaLabel} value="" onChange={(e) => p.onChange(e.target.value)}>
      <option value="">pick</option>
      {p.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}))

afterEach(() => {
  cleanup()
  invoke.mockClear()
})

async function openWith(ids: string[], onClose = vi.fn()) {
  renderWithProviders(
    <PersonDeskProvider>
      <ScheduleShareModal open onClose={onClose} baseDateYmd="2026-10-26" />
    </PersonDeskProvider>,
  )
  const picker = await screen.findByRole('combobox', { name: 'Add recipient' })
  await waitFor(() => expect(picker.querySelectorAll('option').length).toBe(USERS.length + 1))
  for (const id of ids) fireEvent.change(picker, { target: { value: id } })
  return onClose
}

describe('Schedule → Share → Send now', () => {
  it('holds a person with no email on file, says both counts, and sends only the rest', async () => {
    const onClose = await openWith(['u1', 'u2'])
    const send = screen.getByRole('button', { name: 'Send to 1 · 1 has no email ▸' })
    expect(screen.getByText(/no email on file/)).toBeTruthy()
    expect(screen.getByText('1 is held. It stays here with the reason. The 1 ready one sends now.')).toBeTruthy()
    fireEvent.click(send)
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1))
    expect(invoke.mock.calls[0]![1].body.recipientUserIds).toEqual(['u1'])
    // The held person stays picked, the sent one leaves, the window stays open.
    await waitFor(() => expect(document.querySelectorAll('[data-share-recipient]').length).toBe(1))
    expect(document.querySelector('[data-share-recipient="held"]')?.textContent).toContain('Todd')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Send now ▸' }).hasAttribute('disabled')).toBe(true)
  })

  it('the held person’s door closes the window and opens their desk at Access', async () => {
    const onClose = await openWith(['u2'])
    fireEvent.click(screen.getByRole('button', { name: 'Add an email ▸' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('everyone with an email: Send to 2, and the window closes after the send', async () => {
    invoke.mockImplementationOnce(async () => ({ data: { ok: true, sent: 2, results: [{ recipientUserId: 'u1', ok: true }, { recipientUserId: 'u3', ok: true }] }, error: null }))
    const onClose = await openWith(['u1', 'u3'])
    fireEvent.click(screen.getByRole('button', { name: 'Send to 2' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('a send the function could not make stays picked with its reason', async () => {
    invoke.mockImplementationOnce(async () => ({ data: { ok: true, sent: 1, results: [{ recipientUserId: 'u1', ok: true }, { recipientUserId: 'u3', ok: false, error: 'Resend refused the address' }] }, error: null }))
    const onClose = await openWith(['u1', 'u3'])
    fireEvent.click(screen.getByRole('button', { name: 'Send to 2' }))
    const failed = await screen.findByText(/1 email did not send\. It stays here with the reason\./)
    expect(failed.closest('[data-share-send-failed]')?.textContent).toContain('Ana · Resend refused the address')
    expect(screen.getByRole('button', { name: 'Send to 1' })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })
})
