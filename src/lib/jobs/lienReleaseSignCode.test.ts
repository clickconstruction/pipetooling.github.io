import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * His signing code on a WAIVER (v2.5924): the audit sentence names the mechanism, and
 * signLienReleaseWithCode is one RPC whose answers the window can act on — ok tells the signer
 * (the push) and stores the signed PDF; wrong carries the tries left; a missing RPC says the
 * migration is not pushed yet.
 */
const net = vi.hoisted(() => ({
  calls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  answer: null as unknown,
  error: null as { message: string } | null,
  uploads: [] as string[],
  updates: [] as Record<string, unknown>[],
}))

vi.mock('../supabase', () => ({
  supabase: {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      net.calls.push({ fn, args })
      return net.error ? { data: null, error: net.error } : { data: net.answer, error: null }
    },
    functions: {
      invoke: async (fn: string, opts: { body: Record<string, unknown> }) => {
        net.calls.push({ fn: `invoke:${fn}`, args: opts.body })
        return { data: null, error: null }
      },
    },
    storage: {
      from: () => ({
        upload: async (path: string) => {
          net.uploads.push(path)
          return { error: null }
        },
      }),
    },
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        net.updates.push(payload)
        return { eq: async () => ({ error: null }) }
      },
    }),
  },
}))

vi.mock('../jobsDocuments/lienWaiverRelease', async (importActual) => {
  const actual = (await importActual()) as Record<string, unknown>
  return { ...actual, buildLienWaiverPdfBlob: async () => new Blob(['pdf'], { type: 'application/pdf' }) }
})

import { lienReleaseSignatureAuditLine } from './lienReleaseLifecycle'
import { signLienReleaseWithCode } from './lienReleaseSignIo'
import type { LienWaiverFields } from '../jobsDocuments/lienWaiverRelease'

const FIELDS: LienWaiverFields = {
  companyName: 'Click Plumbing and Electrical',
  checkFrom: 'Southern Post Construction, LLC',
  amount: '3800',
  projectDescription: 'Take 5 Seguin — 380 TX-123, Seguin, TX 78155',
  throughDate: '',
  signedDate: '2026-10-26',
  signerName: 'Malachi Whites',
  signerTitle: 'Owner · Responsible Master Plumber',
}

describe('the audit sentence for mode code', () => {
  it('names the mechanism and whose screen', () => {
    const line = lienReleaseSignatureAuditLine(
      { signed_at: '2026-10-26T19:14:00Z', signer_consented_at: '2026-10-26T19:14:00Z', signer_printed_name: 'Malachi Whites', signer_signature_mode: 'code' },
      'Wendi',
    )
    expect(line).toContain('Typed by Malachi Whites with his signing code in ClickTooling')
    expect(line).toContain('on Wendi’s screen')
    expect(line).toContain('consent recorded')
  })
})

describe('signLienReleaseWithCode — one RPC, the database checks the code', () => {
  beforeEach(() => {
    net.calls = []
    net.answer = null
    net.error = null
    net.uploads = []
    net.updates = []
  })

  it('ok: signs through the RPC, tells the signer, stores the signed PDF', async () => {
    net.answer = { ok: true, signed_at: '2026-10-26T19:14:00Z', printed_name: 'Malachi Whites' }
    const r = await signLienReleaseWithCode({ releaseId: 'rel-1', formType: 'conditional_final', fields: FIELDS, signerUserId: 'leader-1', code: '2468', deviceUserName: 'Wendi' })
    expect(r).toMatchObject({ ok: true, printedName: 'Malachi Whites' })
    const rpcCall = net.calls.find((c) => c.fn === 'sign_lien_release_with_code')
    expect(rpcCall?.args).toMatchObject({ p_release_id: 'rel-1', p_signer_id: 'leader-1', p_code: '2468' })
    expect(net.calls.find((c) => c.fn === 'invoke:notify-lien-approval')?.args).toMatchObject({ release_id: 'rel-1', kind: 'waiver_code_used' })
    expect(net.uploads).toContain('rel-1/signed.pdf')
    expect(net.updates[0]).toMatchObject({ signed_pdf_path: 'rel-1/signed.pdf' })
  })

  it('wrong: carries the message and the tries left, and tells nobody', async () => {
    net.answer = { ok: false, reason: 'wrong', message: 'That is not Malachi Whites’s code.', tries_left: 3 }
    const r = await signLienReleaseWithCode({ releaseId: 'rel-1', formType: 'conditional_final', fields: FIELDS, signerUserId: 'leader-1', code: '1111', deviceUserName: 'Wendi' })
    expect(r).toMatchObject({ ok: false, reason: 'wrong', triesLeft: 3 })
    expect(net.calls.some((c) => c.fn.startsWith('invoke:'))).toBe(false)
    expect(net.uploads).toEqual([])
  })

  it('a missing RPC answers not_live, the words the desk uses', async () => {
    net.error = { message: 'Could not find the function public.sign_lien_release_with_code' }
    const r = await signLienReleaseWithCode({ releaseId: 'rel-1', formType: 'conditional_final', fields: FIELDS, signerUserId: 'leader-1', code: '2468', deviceUserName: null })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('not_live')
  })
})
