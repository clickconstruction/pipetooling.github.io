import { describe, expect, it, vi } from 'vitest'
import { attachDoneWords, attachEmailProblem, attachFormProblem, attachHintWords, attachLogin, attachPressLabel, removeLogin } from './attachLogin'

function client(invoke: (name: string, opts: { body: Record<string, unknown> }) => Promise<{ data: unknown; error: unknown }>) {
  return { functions: { invoke } } as unknown as Parameters<typeof attachLogin>[0]
}

describe('attachEmailProblem', () => {
  it('needs an address shaped like one', () => {
    expect(attachEmailProblem('')).toBe('An email is required to attach a login.')
    expect(attachEmailProblem('rio at example')).toBe('That email does not look right.')
    expect(attachEmailProblem(' Rio@Example.test ')).toBeNull()
  })
})

describe('the Attach form with a password (v2.7901)', () => {
  const typed = { email: 'rio@example.test', password: 'pw-rio-123', again: 'pw-rio-123' }
  it('checks the address first, then the password only when one is being set', () => {
    expect(attachFormProblem({ ...typed, email: 'nope', signInBy: 'password' })).toBe('That email does not look right.')
    expect(attachFormProblem({ ...typed, password: '', again: '', signInBy: 'email' })).toBeNull()
    expect(attachFormProblem({ ...typed, password: 'short', again: 'short', signInBy: 'password' })).toBe('Use at least 6 characters.')
    expect(attachFormProblem({ ...typed, again: 'pw-rio-124', signInBy: 'password' })).toBe('The two passwords do not match.')
    expect(attachFormProblem({ ...typed, signInBy: 'password' })).toBeNull()
  })
  it('the press, the hint and the toast say whether an email goes', () => {
    expect(attachPressLabel('email')).toBe('Attach and send the sign-in email')
    expect(attachPressLabel('password')).toBe('Attach with this password')
    expect(attachHintWords('email')).toContain('They choose a password from the email.')
    expect(attachHintWords('password')).toContain('No email goes out.')
    expect(attachHintWords('password')).not.toContain('from the email')
    expect(attachDoneWords('email', 'rio@example.test', 'Rio Vance')).toBe('Login attached. Sign-in email sent to rio@example.test.')
    expect(attachDoneWords('password', 'rio@example.test', 'Rio Vance')).toBe('Login attached. No email went. Give Rio Vance the password in person or by phone.')
  })
  it('never says the password back', () => {
    for (const words of [attachHintWords('password'), attachDoneWords('password', typed.email, 'Rio Vance'), attachPressLabel('password')]) expect(words).not.toContain(typed.password)
  })
})

describe('removeLogin', () => {
  it('calls detach-login with the id and answers it', async () => {
    const invoke = vi.fn(async () => ({ data: { success: true, user: { id: 'u1', login_attached_at: null } }, error: null }))
    await expect(removeLogin(client(invoke), { userId: 'u1' })).resolves.toEqual({ userId: 'u1' })
    expect(invoke).toHaveBeenCalledWith('detach-login', { body: { user_id: 'u1' } })
  })
  it("throws the function's reason", async () => {
    const invoke = vi.fn(async () => ({ data: { error: 'You cannot remove your own login.' }, error: null }))
    await expect(removeLogin(client(invoke), { userId: 'me' })).rejects.toThrow('You cannot remove your own login.')
  })
})

describe('attachLogin', () => {
  it('creates the login on the id, then sends the sign-in email', async () => {
    const invoke = vi.fn(async (name: string) => (name === 'create-user' ? { data: { success: true, user: { id: 'u1', email: 'rio@example.test' } }, error: null } : { data: { success: true }, error: null }))
    const r = await attachLogin(client(invoke), { userId: 'u1', email: ' Rio@Example.test ', redirectTo: 'https://app.example/dashboard' })
    expect(r).toEqual({ userId: 'u1', email: 'rio@example.test', signInEmailSent: true })
    expect(invoke).toHaveBeenNthCalledWith(1, 'create-user', { body: { user_id: 'u1', email: 'rio@example.test' } })
    expect(invoke).toHaveBeenNthCalledWith(2, 'send-sign-in-email', { body: { email: 'rio@example.test', redirectTo: 'https://app.example/dashboard' } })
  })
  it('with a password, sets it and sends no email', async () => {
    const invoke = vi.fn(async () => ({ data: { success: true, user: { id: 'u1' } }, error: null }))
    const r = await attachLogin(client(invoke), { userId: 'u1', email: 'rio@example.test', password: 'pw-rio-123', redirectTo: 'x' })
    expect(r.signInEmailSent).toBe(false)
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledWith('create-user', { body: { user_id: 'u1', email: 'rio@example.test', password: 'pw-rio-123' } })
  })
  it("throws the function's reason", async () => {
    const invoke = vi.fn(async () => ({ data: { error: 'Rio Vance already has a login.' }, error: null }))
    await expect(attachLogin(client(invoke), { userId: 'u1', email: 'rio@example.test', redirectTo: 'x' })).rejects.toThrow('Rio Vance already has a login.')
  })
  it('refuses a bad address before calling anything', async () => {
    const invoke = vi.fn()
    await expect(attachLogin(client(invoke), { userId: 'u1', email: 'nope', redirectTo: 'x' })).rejects.toThrow('does not look right')
    expect(invoke).not.toHaveBeenCalled()
  })
})
