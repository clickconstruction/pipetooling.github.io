// @vitest-environment jsdom
/**
 * Render smokes for the Quo connection card (v2.5718) over a fake io: the owner reads the masked key with when and by
 * whom, Quo's answer in numbers; saving a key sends it once and never shows it; what stops a save says so; a key that
 * is not saved yet asks for it; a read Quo refused says so with Ask Quo again; nobody else sees the card. The key in
 * the smokes is made up.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NO_QUO_KEY, QUO_KEY_SAVED_TOAST, type QuoDirectory, type QuoKeyStatus } from '../../lib/quo/connection'
import type { QuoConnectionIo } from '../../lib/quo/connectionIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { QuoConnectionCard } from './QuoConnectionCard'
import { QuoConnectionProvider } from './QuoConnectionContext'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const auth = vi.hoisted(() => ({ role: 'master_technician' }))
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: auth.role })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

const NOW = '2026-10-21T20:00:00.000Z'
const SAVED: QuoKeyStatus = { set: true, source: 'vault', last4: 'ab12', savedAt: '2026-10-21T19:30:00Z', savedBy: 'Robert Douglas' }
const DIRECTORY: QuoDirectory = {
  members: [{ id: 'USrosa2', name: 'Rosa Diaz', email: 'rosa@plumbing.example', role: 'member' }],
  numbers: [
    { id: 'PNteam01', name: 'Team line', symbol: '🏡', number: '+15125550144', phone: '(512) 555-0144' },
    { id: 'PNbids02', name: 'Bids', symbol: '', number: '+15125550199', phone: '(512) 555-0199' },
  ],
}
const FAKE_KEY = 'made-up-key-for-the-smoke-0000'

function fakeIo(status: QuoKeyStatus = SAVED, over: Partial<QuoConnectionIo> = {}): QuoConnectionIo {
  return {
    status: vi.fn(async () => status),
    save: vi.fn(async () => ({ ...SAVED, last4: '0000' })),
    directory: vi.fn(async () => DIRECTORY),
    ...over,
  }
}

const card = () => document.querySelector<HTMLElement>('[data-settings-quo-connection]')
const keyStatus = () => document.querySelector<HTMLElement>('[data-quo-key-status]')!
const quoLine = () => document.querySelector<HTMLElement>('[data-quo-line]')

function draw(io: QuoConnectionIo, enabled = true) {
  renderWithProviders(
    <QuoConnectionProvider io={io} enabled={enabled}>
      <QuoConnectionCard nowIso={NOW} />
    </QuoConnectionProvider>,
  )
}

beforeEach(() => {
  auth.role = 'master_technician'
})
afterEach(() => cleanup())

describe('Quo connection (Settings → Phone and texts, v2.5718)', () => {
  it('reads the masked key with when and by whom, and what Quo answered', async () => {
    const io = fakeIo()
    draw(io)
    await waitFor(() => expect(keyStatus().textContent).toBe('A key is saved. It ends in ab12. Saved today at 2:30 PM by Robert Douglas.'))
    await waitFor(() => expect(quoLine()?.textContent).toBe('Quo answered: 2 numbers and 1 person.'))
    expect(io.directory).toHaveBeenCalledTimes(1)
    expect(card()!.textContent).not.toContain(FAKE_KEY)
    expect(screen.queryByRole('button', { name: 'Ask Quo again' })).toBeNull()
  })

  it('asks for the key when none is saved, and reads Quo once a key is saved', async () => {
    const io = fakeIo(NO_QUO_KEY)
    draw(io)
    await waitFor(() => expect(keyStatus().textContent).toBe('No key saved yet.'))
    expect(io.directory).not.toHaveBeenCalled()
    expect(quoLine()).toBeNull()
    fireEvent.change(screen.getByLabelText('Quo API key'), { target: { value: ` ${FAKE_KEY} ` } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the key' }))
    await waitFor(() => expect(io.save).toHaveBeenCalledWith(` ${FAKE_KEY} `))
    expect(await screen.findByText(QUO_KEY_SAVED_TOAST)).toBeTruthy()
    await waitFor(() => expect(keyStatus().textContent).toContain('It ends in 0000.'))
    await waitFor(() => expect(quoLine()?.textContent).toBe('Quo answered: 2 numbers and 1 person.'))
    expect((screen.getByLabelText('Quo API key') as HTMLInputElement).value).toBe('')
    expect(document.body.textContent).not.toContain(FAKE_KEY)
  })

  it('says what stops a save, and saves nothing', async () => {
    const io = fakeIo(NO_QUO_KEY)
    draw(io)
    await waitFor(() => expect(keyStatus().textContent).toBe('No key saved yet.'))
    fireEvent.change(screen.getByLabelText('Quo API key'), { target: { value: 'too short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the key' }))
    expect((await screen.findByRole('alert')).textContent).toBe('The key has a space in it. Paste it again.')
    expect(io.save).not.toHaveBeenCalled()
  })

  it('keeps a refused save’s words', async () => {
    const io = fakeIo(NO_QUO_KEY, { save: vi.fn(async () => Promise.reject(new Error('Only the owner or a dev sets the Quo connection.'))) })
    draw(io)
    await waitFor(() => expect(keyStatus().textContent).toBe('No key saved yet.'))
    fireEvent.change(screen.getByLabelText('Quo API key'), { target: { value: FAKE_KEY } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the key' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Only the owner or a dev sets the Quo connection.')
  })

  it('says when Quo did not answer, and asks again on the button', async () => {
    let tries = 0
    const io = fakeIo(SAVED, {
      directory: vi.fn(async () => {
        tries += 1
        if (tries === 1) throw new Error('Quo did not give its numbers (401: Unauthorized).')
        return DIRECTORY
      }),
    })
    draw(io)
    await waitFor(() => expect(quoLine()?.textContent).toBe('Quo did not give its numbers (401: Unauthorized).'))
    fireEvent.click(screen.getByRole('button', { name: 'Ask Quo again' }))
    await waitFor(() => expect(quoLine()?.textContent).toBe('Quo answered: 2 numbers and 1 person.'))
  })

  it('names a key a dev set on the server, and still reads Quo with it', async () => {
    draw(fakeIo({ set: true, source: 'env', last4: null, savedAt: null, savedBy: null }))
    await waitFor(() => expect(keyStatus().textContent).toBe('A key is set on the server by a dev, not here. Paste it here so Settings holds it.'))
    await waitFor(() => expect(quoLine()?.textContent).toBe('Quo answered: 2 numbers and 1 person.'))
  })

  it('shows nobody but the owner or a dev the card', async () => {
    auth.role = 'assistant'
    const io = fakeIo()
    draw(io, false)
    expect(card()).toBeNull()
    expect(io.status).not.toHaveBeenCalled()
  })
})
