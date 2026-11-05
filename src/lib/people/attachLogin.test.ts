import { describe, expect, it, vi } from 'vitest'
import { attachEmailProblem, attachLogin, removeLogin } from './attachLogin'

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
