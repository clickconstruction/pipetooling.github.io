import { beforeEach, describe, expect, it, vi } from 'vitest'
import { filingHtmlHasTypedSignature } from '../jobsDocuments/lienFilingDocuments'
import { lienFieldsHash } from './lienNoticeSignature'

/**
 * The leader's signing code (v2.5788): the format rule, the one RPC behind a code signature and
 * what its answers mean on the desk — a wrong code with tries left, a lock, a missing RPC.
 */
const rpc = vi.hoisted(() => ({
  calls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  answer: null as unknown,
  error: null as { message: string } | null,
}))

vi.mock('../supabase', () => ({
  supabase: {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpc.calls.push({ fn, args })
      return rpc.error ? { data: null, error: rpc.error } : { data: rpc.answer, error: null }
    },
    functions: {
      invoke: async (fn: string, opts: { body: Record<string, unknown> }) => {
        rpc.calls.push({ fn: `invoke:${fn}`, args: opts.body })
        return { data: null, error: null }
      },
    },
  },
}))

import { lienSignCodeProblem, lienSignCodeStatus, setLienSignCode, signLienDeskItemWithCode } from './lienDeskSignIo'

const FIELDS = { notice: { claimAmount: 9006 }, gcEmail: '' }

describe('lienSignCodeProblem — four to six digits, typed twice', () => {
  it('says what is wrong while he types and nothing when the code is one', () => {
    expect(lienSignCodeProblem('')).toBeNull()
    expect(lienSignCodeProblem('12')).toBe('Four to six digits.')
    expect(lienSignCodeProblem('1234567')).toBe('Six digits at most.')
    expect(lienSignCodeProblem('12a4')).toBe('Digits only.')
    expect(lienSignCodeProblem('2468')).toBeNull()
    expect(lienSignCodeProblem('2468', '')).toBeNull()
    expect(lienSignCodeProblem('2468', '246')).toBe('The two codes differ.')
    expect(lienSignCodeProblem('2468', '2468')).toBeNull()
  })
})

describe('signLienDeskItemWithCode — one RPC, the database checks the code', () => {
  beforeEach(() => {
    rpc.calls = []
    rpc.answer = null
    rpc.error = null
  })

  it('sends the item, the signer, the code and the hash of the draft as saved; the answer carries the instant and the printed name', async () => {
    rpc.answer = { ok: true, signed_at: '2026-10-23T19:14:00Z', printed_name: 'Malachi' }
    const r = await signLienDeskItemWithCode({ itemId: 'item-1', fields: { ...FIELDS, dropped: undefined }, signerUserId: 'u-malachi', code: '2468', approve: true })
    expect(r).toEqual({ ok: true, signedAtIso: '2026-10-23T19:14:00Z', printedName: 'Malachi' })
    // The RPC, then one line to him (v2.5791): the function says nothing when it was his own screen.
    expect(rpc.calls).toEqual([{ fn: 'sign_lien_desk_item_with_code', args: { p_item_id: 'item-1', p_signer_id: 'u-malachi', p_code: '2468', p_fields_hash: lienFieldsHash(FIELDS), p_approve: true } }, { fn: 'invoke:notify-lien-approval', args: { item_id: 'item-1', kind: 'code_used' } }])
  })

  it('a wrong code says so with the tries left; the fifth locks it until a time', async () => {
    rpc.answer = { ok: false, reason: 'wrong', tries_left: 3, locked_until: null, message: 'That is not Malachi’s code.' }
    const wrong = await signLienDeskItemWithCode({ itemId: 'item-1', fields: FIELDS, signerUserId: 'u-malachi', code: '0000', approve: true })
    expect(wrong).toEqual({ ok: false, reason: 'wrong', message: 'That is not Malachi’s code.', triesLeft: 3, lockedUntilIso: null })
    rpc.answer = { ok: false, reason: 'locked', tries_left: 0, locked_until: '2026-10-23T19:30:00Z', message: 'Five wrong codes. The code is locked for fifteen minutes.' }
    const locked = await signLienDeskItemWithCode({ itemId: 'item-1', fields: FIELDS, signerUserId: 'u-malachi', code: '0000', approve: true })
    expect(locked.ok).toBe(false)
    if (!locked.ok) {
      expect(locked.reason).toBe('locked')
      expect(locked.lockedUntilIso).toBe('2026-10-23T19:30:00Z')
    }
  })

  it('no code set, and a client ahead of the migration, each read as their own reason', async () => {
    rpc.answer = { ok: false, reason: 'none', message: 'Malachi has not set a signing code yet. He sets it under Settings, Your account.' }
    const none = await signLienDeskItemWithCode({ itemId: 'item-1', fields: FIELDS, signerUserId: 'u-malachi', code: '2468', approve: false })
    expect(none.ok).toBe(false)
    if (!none.ok) expect(none.reason).toBe('none')
    rpc.error = { message: 'Could not find the function public.sign_lien_desk_item_with_code in the schema cache' }
    const notLive = await signLienDeskItemWithCode({ itemId: 'item-1', fields: FIELDS, signerUserId: 'u-malachi', code: '2468', approve: true })
    expect(notLive.ok).toBe(false)
    if (!notLive.ok) expect(notLive.reason).toBe('not_live')
  })

  it('the status is null while the RPC is not live, and set/clear pass the code and nothing else', async () => {
    rpc.error = { message: 'PGRST202: could not find the function' }
    expect(await lienSignCodeStatus('u-malachi')).toBeNull()
    rpc.error = null
    rpc.answer = { set: true, set_at: '2026-10-23T18:00:00Z', last_used_at: null, locked_until: null }
    expect(await lienSignCodeStatus('u-malachi')).toEqual({ set: true, setAtIso: '2026-10-23T18:00:00Z', lastUsedAtIso: null, lockedUntilIso: null })
    await setLienSignCode('2468')
    expect(rpc.calls[rpc.calls.length - 1]).toEqual({ fn: 'set_lien_sign_code', args: { p_code: '2468' } })
  })
})

describe('the papers load the cursive face for a code signature as for a press', () => {
  it('filingHtmlHasTypedSignature reads mode code', () => {
    expect(filingHtmlHasTypedSignature('<div data-filing-signed-mode="code">')).toBe(true)
    expect(filingHtmlHasTypedSignature('<div data-filing-signed-mode="draw">')).toBe(false)
  })
})
