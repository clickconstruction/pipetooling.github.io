/**
 * Attach a login (punch list #260, PR 4, v2.6518): a person on the roster with no login behind their users row gets one
 * on the same id — `create-user` with `user_id` creates the auth account ON that id (GoTrue's admin create has taken `id`
 * since v2.155.0), `handle_new_user` stamps `login_attached_at` and the address, and nothing that points at the person
 * moves: their clock sessions, Charged as, People record, pay, paperwork. Then the sign-in email, as the Try-out door
 * does, so they choose a password from the link. Dev only (`create-user` refuses anyone else).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { formatErrorMessage } from '../../utils/errorHandling'

type FnClient = { functions: { invoke: (name: string, opts: { body: Record<string, unknown> }) => Promise<{ data: unknown; error: unknown }> } }

export type AttachLoginInput = {
  userId: string
  email: string
  /** When given, the login is made with this password and no sign-in email goes out; else an unguessable one is set and the email goes. */
  password?: string
  /** Where the sign-in link lands. */
  redirectTo: string
}

export type AttachLoginResult = { userId: string; email: string; signInEmailSent: boolean }

/** The address the login attaches to: trimmed, lower-cased, and shaped like one. */
export function attachEmailProblem(email: string): string | null {
  const e = email.trim().toLowerCase()
  if (!e) return 'An email is required to attach a login.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'That email does not look right.'
  return null
}

async function fnErrorMessage(e: unknown, fallback: string): Promise<string> {
  if (e instanceof FunctionsHttpError && e.context) {
    try {
      const b = (await e.context.json()) as { error?: string } | null
      if (b?.error) return b.error
    } catch {
      /* fall through */
    }
  }
  return formatErrorMessage(e, fallback)
}

async function invokeOrThrow(client: FnClient, name: string, body: Record<string, unknown>, fallback: string): Promise<unknown> {
  let data: unknown
  try {
    const r = await client.functions.invoke(name, { body })
    if (r.error) throw r.error
    data = r.data
  } catch (e) {
    throw new Error(await fnErrorMessage(e, fallback))
  }
  const err = (data as { error?: string } | null)?.error
  if (err) throw new Error(err)
  return data
}

/** Removes the person's login (punch list #266, v2.6532): `detach-login` deletes the auth account by the row's id; the person and everything that points at them stay. Throws with the refusal's words. */
export async function removeLogin(client: SupabaseClient<never> | SupabaseClient, input: { userId: string }): Promise<{ userId: string }> {
  const fn = client as unknown as FnClient
  const made = (await invokeOrThrow(fn, 'detach-login', { user_id: input.userId }, 'The login was not removed.')) as { user?: { id?: string } } | null
  return { userId: made?.user?.id ?? input.userId }
}

/** Attaches the login on the person's id, then sends the sign-in email unless a password was set. Throws with the refusal's words. */
export async function attachLogin(client: SupabaseClient<never> | SupabaseClient, input: AttachLoginInput): Promise<AttachLoginResult> {
  const problem = attachEmailProblem(input.email)
  if (problem) throw new Error(problem)
  const email = input.email.trim().toLowerCase()
  const fn = client as unknown as FnClient
  const body: Record<string, unknown> = { user_id: input.userId, email }
  if (input.password) body.password = input.password
  const made = (await invokeOrThrow(fn, 'create-user', body, 'The login was not attached.')) as { user?: { id?: string; email?: string } } | null
  const userId = made?.user?.id ?? input.userId
  if (input.password) return { userId, email, signInEmailSent: false }
  await invokeOrThrow(fn, 'send-sign-in-email', { email, redirectTo: input.redirectTo }, 'The login is attached, but the sign-in email did not go.')
  return { userId, email, signInEmailSent: true }
}
