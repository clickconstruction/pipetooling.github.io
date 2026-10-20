import { describe, expect, it, vi } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'

// The real door to the function, for the answers that come back with an error status (v2.5532).
const fn = vi.hoisted(() => ({ invoke: null as null | (() => Promise<{ data: unknown; error: unknown }>) }))
vi.mock('../supabase', () => ({ supabase: { functions: { invoke: () => fn.invoke!() } } }))
vi.mock('../jobs/lienDeskRunIo', () => ({ buildRunNoticePdf: vi.fn() }))

import { docsmitHeldWords, docsmitPayUrl, docsmitRecipientPatches, prepareDocsmitRun, sendDocsmitRun, type DocsmitIo } from './runDocsmitIo'
import type { RunEnvelope } from '../jobs/runEnvelopes'

const owner = { recipient: { key: 'owner' as const, label: 'Owner of record', name: 'ATI Schertz Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail' as const, tracking: '' }, notice: { itemId: 'it1', jobId: 'j650', jobNumber: '650', kind: 'notice_53_056', label: '650 · ATI' }, noticeIndex: 0, recipientIndex: 0 }
const envelopes = [
  { key: 'e1', n: 1, label: 'Owner of record', name: 'ATI Schertz Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', email: '', method: 'certified_mail', tracking: '', contents: [owner] },
  { key: 'e2', n: 2, label: 'Owner of record', name: 'Nobody', address: 'nowhere', email: '', method: 'certified_mail', tracking: '', contents: [{ ...owner, notice: { ...owner.notice, itemId: 'it2', jobId: 'j700', jobNumber: '700' } }] },
  { key: 'e3', n: 3, label: 'Owner of record', name: 'Harlan Dental PLLC', address: '2200 Bandera Rd, San Antonio, TX 78228', email: '', method: 'hand', tracking: '', contents: [{ ...owner, notice: { ...owner.notice, itemId: 'it3', jobId: 'j688', jobNumber: '688' } }] },
] as unknown as RunEnvelope[]

function fakeIo(over: Partial<DocsmitIo> = {}): { io: DocsmitIo; calls: Array<Record<string, unknown>>; uploads: string[] } {
  const calls: Array<Record<string, unknown>> = []
  const uploads: string[] = []
  let n = 0
  const io: DocsmitIo = {
    buildPdf: async (_n, key, _inv, _pay, opts) => new Blob([`%PDF ${key} ${opts?.window ? 'window:' + opts.window.lines.join('/') + (opts.window.qr ? ' qr:' + opts.window.qr.display : '') : 'plain'}`]),
    merge: async (blobs) => new Blob([`merged ${blobs.length}`]),
    pages: async () => 4,
    qrPng: async () => 'data:png',
    upload: async (path) => {
      uploads.push(path)
      return null
    },
    invoke: async (body) => {
      calls.push(body)
      n++
      return { data: { ok: true, piece_id: `p${n}`, price: 9.85, correction: n === 1 ? 'ZIP+4: 78154-2011' : null, credit_balance: 120 }, error: null }
    },
    objectUrl: () => 'blob:x',
    shortCode: () => 'KX7M2QRT',
    ...over,
  }
  return { io, calls, uploads }
}

describe('a run that mails through Docsmit, the doing side (the Docsmit train, PR 5b)', () => {
  it('prepares each clean certified envelope: the owner’s PDF carries the window and the code, the copy goes to the bucket, prepare is asked, the price and the balance come back; a bad address is held', async () => {
    const { io, calls, uploads } = fakeIo()
    const payRowsByJob = { j650: [{ invoiceId: '8f3c2a1e-6b7d-4c9a-9e21-5d0f7a3b1c44', label: 'Invoice #650-1', description: '', openAmount: 100, payable: true }] }
    const out = await prepareDocsmitRun(envelopes, { receipt: 'electronic', invoiceDocsByJob: {}, payBlocksByJob: {}, payRowsByJob: payRowsByJob as never, io })
    expect(out.prepared.map((p) => p.key)).toEqual(['e1'])
    expect(out.held).toEqual([{ key: 'e2', n: 2, label: 'Owner of record', why: 'The address needs a city, a two-letter state, a ZIP or ZIP+4.' }])
    expect(out.balance).toBe(120)
    const p = out.prepared[0]!
    expect(p).toMatchObject({ n: 1, who: 'ATI Schertz Holdings LLC', windowLines: ['ATI Schertz Holdings LLC', '17300 IH 35 N', 'Schertz, TX 78154'], sendType: 'Certified, Electronic Return Receipt', shortCode: 'KX7M2QRT', pieceId: 'p1', price: 9.85, correction: 'ZIP+4: 78154-2011', sheets: 4, envelope: '#10', pdfUrl: 'blob:x', pdfPath: 'mail/KX7M2QRT.pdf' })
    expect(uploads).toEqual(['mail/KX7M2QRT.pdf'])
    expect(calls[0]).toMatchObject({ action: 'prepare', pdf_path: 'mail/KX7M2QRT.pdf', job_number: '650', piece: { kind: 'lien_notice_53_056', recipient: 'owner', short_code: 'KX7M2QRT', organization: 'ATI Schertz Holdings LLC', postal_code: '78154', envelope: '#10', sheets: 4 } })
    // The piece carries its desk items from the start (v2.5532): a send is the desk's the moment it goes, recorded or not.
    expect((calls[0]!.piece as { source_ids: string[] }).source_ids).toEqual(['it1'])
  })

  it('a combined notice’s piece carries every job’s desk item inside the envelope (v2.5532)', async () => {
    const { io, calls } = fakeIo()
    const combined = { ...envelopes[0]!, contents: [{ ...owner, notice: { ...owner.notice, parts: [{ itemId: 'it1', jobId: 'j650' }, { itemId: 'it9', jobId: 'j651' }] } }] } as unknown as RunEnvelope
    await prepareDocsmitRun([combined], { receipt: 'electronic', invoiceDocsByJob: {}, payBlocksByJob: {}, payRowsByJob: {}, io })
    expect((calls[0]!.piece as { source_ids: string[] }).source_ids).toEqual(['it1', 'it9'])
  })

  it('the owner’s copy gets the code only when the job has a payable bill; a refusal, a bucket failure or too many pages hold the envelope with the reason', async () => {
    const built: string[] = []
    const base = fakeIo({ buildPdf: async (_n, _key, _i, _p, opts) => { built.push(opts?.window?.qr ? 'qr' : opts?.window ? 'window' : 'plain'); return new Blob(['x']) } })
    const out = await prepareDocsmitRun([envelopes[0]!], { receipt: 'card', invoiceDocsByJob: {}, payBlocksByJob: {}, payRowsByJob: {}, io: base.io })
    expect(built).toEqual(['window'])
    expect(out.prepared[0]!.sendType).toBe('Certified, Return Receipt')
    const refused = fakeIo({ invoke: async () => ({ data: { error: 'Docsmit says this address will not mail.', correction: 'No such street number', non_mailable: true }, error: null }) })
    expect((await prepareDocsmitRun([envelopes[0]!], { receipt: 'electronic', invoiceDocsByJob: {}, payBlocksByJob: {}, payRowsByJob: {}, io: refused.io })).held[0]!.why).toBe('Docsmit says this address will not mail. No such street number')
    const bucket = fakeIo({ upload: async () => 'storage is down' })
    expect((await prepareDocsmitRun([envelopes[0]!], { receipt: 'electronic', invoiceDocsByJob: {}, payBlocksByJob: {}, payRowsByJob: {}, io: bucket.io })).held[0]!.why).toBe('The copy did not reach the bucket: storage is down')
    const fat = fakeIo({ pages: async () => 60 })
    expect((await prepareDocsmitRun([envelopes[0]!], { receipt: 'electronic', invoiceDocsByJob: {}, payBlocksByJob: {}, payRowsByJob: {}, io: fat.io })).held[0]!.why).toMatch(/more than a flat holds/)
    expect(docsmitPayUrl([{ invoiceId: 'a', label: '', description: '', openAmount: 1, payable: false }, { invoiceId: 'b', label: '', description: '', openAmount: 1, payable: true }] as never)).toBe('https://clicktooling.com/pay/b')
    expect(docsmitPayUrl(undefined)).toBeNull()
  })

  it('send passes the answer through, or a refusal in the same shape; the patches put the provider and the piece on each copy', async () => {
    const ok = await sendDocsmitRun(['p1', 'p2'], { invoke: async (body) => ({ data: { ok: false, sent: ['p1'], stopped_at: 'p2', shortfall: 7.25, error: 'short', echo: body }, error: null }) })
    expect(ok).toMatchObject({ ok: false, sent: ['p1'], stopped_at: 'p2', shortfall: 7.25 })
    expect(await sendDocsmitRun(['p1'], { invoke: async () => ({ data: null, error: { message: 'boom' } }) })).toEqual({ ok: false, sent: [], error: 'boom' })
    const patches = docsmitRecipientPatches([{ key: 'e1', pieceId: 'p1' }, { key: 'e2', pieceId: 'p2' }, { key: 'e4', pieceId: 'p4' }], ok)
    expect(patches.get('e1')).toEqual({ via: 'docsmit', pieceId: 'p1', pieceStatus: 'sent', pieceProblem: null })
    expect(patches.get('e2')).toEqual({ via: 'docsmit', pieceId: 'p2', pieceStatus: 'failed', pieceProblem: 'short' })
    expect(patches.get('e4')).toEqual({ via: 'docsmit', pieceId: 'p4', pieceStatus: 'prepared', pieceProblem: 'Not sent: the batch stopped before it.' })
    expect(docsmitHeldWords([{ key: 'e2', n: 2, label: 'x', why: 'The address needs a city.' }])).toBe('1 envelope stays on paper: envelope 2 (The address needs a city).')
    expect(docsmitHeldWords([])).toBe('')
  })

  it('an answer with an error status is still read (v2.5532): a send stopped short says which envelopes went, a refused address says why', async () => {
    const stopped = { ok: false, sent: ['p1'], skipped: [], stopped_at: 'p2', shortfall: 7.25, error: 'Docsmit credit is short by $7.25, nothing more was sent.' }
    fn.invoke = async () => ({ data: null, error: new FunctionsHttpError(new Response(JSON.stringify(stopped), { status: 402 })) })
    expect(await sendDocsmitRun(['p1', 'p2'])).toMatchObject({ ok: false, sent: ['p1'], stopped_at: 'p2', shortfall: 7.25 })
    // A body that is not the function's answer leaves the plain refusal: nothing is taken as mailed.
    fn.invoke = async () => ({ data: null, error: new FunctionsHttpError(new Response('<html>bad gateway</html>', { status: 502 })) })
    expect(await sendDocsmitRun(['p1'])).toMatchObject({ ok: false, sent: [] })
    const { invoke: _real, ...rest } = fakeIo().io
    fn.invoke = async () => ({ data: null, error: new FunctionsHttpError(new Response(JSON.stringify({ error: 'Docsmit says this address will not mail.', correction: 'No such street number', non_mailable: true }), { status: 422 })) })
    const out = await prepareDocsmitRun([envelopes[0]!], { receipt: 'electronic', invoiceDocsByJob: {}, payBlocksByJob: {}, payRowsByJob: {}, io: rest })
    expect(out.held[0]!.why).toBe('Docsmit says this address will not mail. No such street number')
  })
})
