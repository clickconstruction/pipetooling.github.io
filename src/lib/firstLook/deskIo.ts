/**
 * The desk's doors (punch list #319, the spike, v2.6981): the `first-look` function, signed in. The function checks
 * that the caller is the owner or a developer; the desk only draws what it answers.
 */
import { supabase } from '../supabase'
import type { FirstLookDeskRow } from './look'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export type DeskAnswer<T> = { ok: true; value: T } | { ok: false; error: { message: string; status: number } }

export type FirstLookDeskIo = {
  list(): Promise<DeskAnswer<FirstLookDeskRow[]>>
  mint(input: { contactId: string | null; label: string }): Promise<DeskAnswer<{ code: string; lookId: string }>>
  close(lookId: string): Promise<DeskAnswer<true>>
  looked(lookId: string): Promise<DeskAnswer<true>>
  remove(lookId: string): Promise<DeskAnswer<true>>
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

async function ask(body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token ?? ''
    const res = await fetch(`${supabaseUrl}/functions/v1/first-look`, { method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const parsed: unknown = await res.json().catch(() => null)
    return { status: res.status, body: isRecord(parsed) ? parsed : {} }
  } catch {
    return { status: 0, body: { error: 'No signal. Check the connection and try again.' } }
  }
}

function refusal(status: number, body: Record<string, unknown>): { ok: false; error: { message: string; status: number } } {
  return { ok: false, error: { message: typeof body.error === 'string' && body.error ? body.error : `The function answered ${status}.`, status } }
}

async function act(body: Record<string, unknown>): Promise<DeskAnswer<true>> {
  const res = await ask(body)
  return res.status === 200 && res.body.ok === true ? { ok: true, value: true } : refusal(res.status, res.body)
}

export const firstLookDeskIo: FirstLookDeskIo = {
  async list() {
    const res = await ask({ action: 'desk.list' })
    if (res.status !== 200 || res.body.ok !== true || !Array.isArray(res.body.looks)) return refusal(res.status, res.body)
    return { ok: true, value: res.body.looks as FirstLookDeskRow[] }
  },
  async mint(input) {
    const res = await ask({ action: 'desk.mint', contactId: input.contactId, label: input.label })
    if (res.status !== 200 || res.body.ok !== true || typeof res.body.code !== 'string' || typeof res.body.lookId !== 'string') return refusal(res.status, res.body)
    return { ok: true, value: { code: res.body.code, lookId: res.body.lookId } }
  },
  close: (lookId) => act({ action: 'desk.close', lookId }),
  looked: (lookId) => act({ action: 'desk.looked', lookId }),
  remove: (lookId) => act({ action: 'desk.remove', lookId }),
}
