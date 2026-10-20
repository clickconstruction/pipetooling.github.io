/**
 * GC mode's customer portal (O7c): what a GC job's customer sees (`gcPortalJobs`), whose press it is (`gcPortalOwns`),
 * and the database's refusals in their words (`gcPortalRefusalWords`), from supabase/functions/_shared/gcPortal.ts.
 */
import { describe, expect, it } from 'vitest'
import { bytesSha256Hex, gcContractSignWords, gcContractTermsLines, gcPortalJobs, gcPortalOwns, gcPortalRefusalWords, parseContractSign, type GcPortalRows } from '../../../supabase/functions/_shared/gcPortal'
import { parsePortalGcContract } from '../portal/portalPayload'

const rows = (over: Partial<GcPortalRows> = {}): GcPortalRows => ({
  projects: [
    { id: 'p-shell', name: 'Retail Shell', customer_id: 'owner' },
    { id: 'p-clinic', name: 'Clinic', customer_id: 'owner' },
    { id: 'p-bid', name: 'Still bidding', customer_id: 'owner' },
    { id: 'p-other', name: 'Someone else’s', customer_id: 'other' },
  ],
  gc: [
    { project_id: 'p-shell', stage: 'building' },
    { project_id: 'p-clinic', stage: 'closed' },
    { project_id: 'p-bid', stage: 'bidding' },
    { project_id: 'p-other', stage: 'building' },
  ],
  changeOrders: [
    { id: 'co-3', project_id: 'p-shell', number: 3, description: ' A larger water heater ', price: '1000', days: 0, sent_on: '2026-10-07', status: 'sent' },
    { id: 'co-2', project_id: 'p-shell', number: 2, description: 'A floor box', price: -500, days: 2, sent_on: '2026-10-06', status: 'sent' },
    { id: 'co-1', project_id: 'p-shell', number: 1, description: 'Signed already', price: 900, days: 0, sent_on: '2026-09-01', status: 'signed' },
    { id: 'co-9', project_id: 'p-bid', number: 1, description: 'Not ours yet', price: 100, days: 0, sent_on: '2026-10-01', status: 'sent' },
    { id: 'co-8', project_id: 'p-other', number: 1, description: 'Not theirs', price: 100, days: 0, sent_on: '2026-10-01', status: 'sent' },
  ],
  acceptances: [{ project_id: 'p-clinic', accepted_on: '2026-10-02', how: 'portal' }],
  payApps: [
    { project_id: 'p-shell', number: 1, final: false, work_to_date: '40000' },
    { project_id: 'p-shell', number: 2, final: false, work_to_date: '99999.6' },
    { project_id: 'p-clinic', number: 1, final: false, work_to_date: 50000 },
  ],
  contractNow: { 'p-shell': 100000, 'p-clinic': 50000 },
  ...over,
})

describe('the GC section of a customer’s portal', () => {
  it('shows their won jobs, each change order waiting on them in order, and the work to accept once every line is billed', () => {
    expect(gcPortalJobs(rows(), 'owner')).toEqual([
      { projectId: 'p-clinic', name: 'Clinic', changeOrders: [], canAccept: false, accepted: { on: '2026-10-02', how: 'portal' } },
      {
        projectId: 'p-shell',
        name: 'Retail Shell',
        changeOrders: [
          { id: 'co-2', number: 2, description: 'A floor box', price: -500, days: 2, sentOn: '2026-10-06' },
          { id: 'co-3', number: 3, description: 'A larger water heater', price: 1000, days: 0, sentOn: '2026-10-07' },
        ],
        canAccept: true,
        accepted: null,
      },
    ])
  })

  it('offers Accept the work only when the last progress bill covers the price today, half a dollar’s slack', () => {
    const short = rows({ payApps: [{ project_id: 'p-shell', number: 2, final: false, work_to_date: 99_999.4 }] })
    expect(gcPortalJobs(short, 'owner').find((j) => j.projectId === 'p-shell')?.canAccept).toBe(false)
    // A final pay application is not a progress bill; no price read, no Accept.
    const finalOnly = rows({ payApps: [{ project_id: 'p-shell', number: 3, final: true, work_to_date: 100_000 }] })
    expect(gcPortalJobs(finalOnly, 'owner').find((j) => j.projectId === 'p-shell')?.canAccept).toBe(false)
    expect(gcPortalJobs(rows({ contractNow: {} }), 'owner').find((j) => j.projectId === 'p-shell')?.canAccept).toBe(false)
  })

  it('leaves out a job with nothing to answer, and anyone else’s', () => {
    const quiet = rows({ changeOrders: [], acceptances: [], payApps: [] })
    expect(gcPortalJobs(quiet, 'owner')).toEqual([])
    expect(gcPortalJobs(rows(), 'other').map((j) => j.projectId)).toEqual(['p-other'])
  })

  it('takes a press only on the link’s own customer’s project', () => {
    expect(gcPortalOwns({ customer_id: 'owner' }, 'owner')).toBe(true)
    expect(gcPortalOwns({ customer_id: 'other' }, 'owner')).toBe(false)
    expect(gcPortalOwns({ customer_id: null }, 'owner')).toBe(false)
    expect(gcPortalOwns(null, 'owner')).toBe(false)
  })

  it('says the database’s refusals to the customer in their words', () => {
    expect(gcPortalRefusalWords('Change order 2 is not waiting on the customer.')).toBe('That change order is already answered.')
    expect(gcPortalRefusalWords('They accepted the work on Oct 7.')).toBe('The work is already accepted.')
    expect(gcPortalRefusalWords('Bill every line first. They accept the work once our pay applications have billed all of it.')).toBe('The work can be accepted once every line of it is billed.')
    expect(gcPortalRefusalWords('Keep the reason to one short line.')).toBe('Keep the reason to one short line.')
    expect(gcPortalRefusalWords('Only a job we won is accepted.')).toBe('That job cannot be accepted here.')
    expect(gcPortalRefusalWords('permission denied for table gc_change_orders')).toBe('Something went wrong. Please try again, or call our office.')
  })
})

describe('our contract in their portal (the Board’s B6-d-iii)', () => {
  const send = (over: Partial<NonNullable<GcPortalRows['contractSends']>[number]> = {}) => ({
    id: 's2', project_id: 'p-shell', sign_by: '2026-10-16', total: '187000', file_name: 'Shell contract.pdf', signed_on: null, signer_printed_name: null, created_at: '2026-10-09T15:00:00Z', ...over,
  })
  const terms = (over: Partial<NonNullable<GcPortalRows['terms']>[number]> = {}) => [
    { project_id: 'p-shell', owner_retainage_pct: '10', owner_pay_days: 30, owner_contract_signed_on: null, lost_on: null, ...over },
  ]
  const shell = (r: GcPortalRows) => gcPortalJobs(r, 'owner').find((j) => j.projectId === 'p-shell')

  it('offers the newest send to sign, its price as one number, the terms and the file to read', () => {
    const r = rows({ contractSends: [send({ id: 's1', total: 185000, created_at: '2026-10-05T15:00:00Z' }), send()], terms: terms(), contractUrls: { s2: 'https://files.example/s2.pdf' } })
    expect(shell(r)?.contract).toEqual({
      state: 'toSign', sendId: 's2', signBy: '2026-10-16', total: 187000, fileName: 'Shell contract.pdf', fileUrl: 'https://files.example/s2.pdf',
      retainagePct: 10, retainageStep: null, payDays: 30, lateInterestPctPerMonth: null, lateFinishPerDay: null,
    })
  })

  it('carries every term we bill by, and says each one as a sentence', () => {
    const r = rows({
      contractSends: [send()],
      terms: terms({ owner_retainage_step_at_pct: 50, owner_retainage_step_to_pct: '5', owner_retainage_step_way: 'rest', owner_late_interest_pct_per_month: '1.5', owner_late_finish_per_day: 250 }),
    })
    const c = shell(r)?.contract
    expect(c).toMatchObject({ retainageStep: { atPct: 50, toPct: 5, way: 'rest' }, lateInterestPctPerMonth: 1.5, lateFinishPerDay: 250 })
    if (c?.state !== 'toSign') throw new Error('to sign')
    expect(gcContractTermsLines(c, (n) => `$${n}`)).toEqual([
      'We bill once a month for the work done.',
      'Part of each bill, 10%, is held until the work is half done.',
      'Then it drops to 5% on the rest.',
      'Each bill is due 30 days after the architect certifies it.',
      'A late bill carries interest of 1.5% a month.',
      'Each day the work finishes late takes $250 off our price.',
    ])
    expect(gcContractTermsLines({ retainagePct: 0, retainageStep: null, payDays: null, lateInterestPctPerMonth: null, lateFinishPerDay: null }, String)).toEqual(['We bill once a month for the work done.'])
  })

  it('a send whose price is no longer whole shows with no form to sign', () => {
    expect(shell(rows({ contractSends: [send()], terms: terms(), priceChanged: ['s2'] }))?.contract).toMatchObject({ state: 'toSign', priceChanged: true })
  })

  it('fingerprints a file as the send did', async () => {
    expect(await bytesSha256Hex(new TextEncoder().encode('abc').buffer)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('a job with only our contract to sign shows', () => {
    const quiet = rows({ changeOrders: [], acceptances: [], payApps: [], contractSends: [send()], terms: terms() })
    expect(gcPortalJobs(quiet, 'owner').map((j) => j.projectId)).toEqual(['p-shell'])
    expect(shell(quiet)?.contract?.state).toBe('toSign')
  })

  it('signed here: who signed and when; signed on paper or a job lost: nothing to show for it', () => {
    expect(shell(rows({ contractSends: [send({ signed_on: '2026-10-12', signer_printed_name: 'Pat Oak' })], terms: terms({ owner_contract_signed_on: '2026-10-12' }), contractUrls: { s2: 'https://files.example/s2.pdf' } }))?.contract).toEqual({ state: 'signed', signedOn: '2026-10-12', signer: 'Pat Oak', fileName: 'Shell contract.pdf', fileUrl: 'https://files.example/s2.pdf' })
    expect(shell(rows({ contractSends: [send()], terms: terms({ owner_contract_signed_on: '2026-10-11' }) }))?.contract).toBeUndefined()
    expect(shell(rows({ contractSends: [send()], terms: terms({ lost_on: '2026-10-11' }) }))?.contract).toBeUndefined()
    expect(shell(rows())?.contract).toBeUndefined()
  })

  it('reads the signature’s request: the send, the name, a drawing or none, and the consent first', () => {
    const consent = { version: 1, lang: 'en', audience: 'customer', documentNoun: 'contract', clauseText: 'I agree.' }
    const id = '00000000-0000-0000-0000-0000000000c5'
    expect(parseContractSign({ sendId: id, printedName: ' Pat Oak ', esignConsent: consent })).toEqual({ ok: true, sendId: id, printedName: 'Pat Oak', png: null, consent })
    expect(parseContractSign({ sendId: id, printedName: 'Pat Oak', signaturePngBase64: 'data:image/png;base64,AAAA', esignConsent: consent })).toMatchObject({ ok: true, png: 'data:image/png;base64,AAAA' })
    expect(parseContractSign({ sendId: 'nope', printedName: 'Pat Oak', esignConsent: consent })).toEqual({ ok: false, error: 'Bad request' })
    expect(parseContractSign({ sendId: id, printedName: '  ', esignConsent: consent })).toEqual({ ok: false, error: 'Type your name to sign.' })
    expect(parseContractSign({ sendId: id, printedName: 'Pat Oak' })).toEqual({ ok: false, error: 'Tick the box to agree to sign electronically.' })
  })

  it('says each refusal of the signing in the customer’s words', () => {
    expect(gcContractSignWords('notNewest')).toBe('We sent you a newer one. Refresh the page and sign that one.')
    expect(gcContractSignWords('priceChanged')).toBe('Our price changed after we sent this. We will send you the new one.')
    expect(gcContractSignWords('alreadySigned')).toBe('You signed it already. Thank you.')
    expect(gcContractSignWords('notYours')).toBe('That contract is not on your account.')
    expect(gcContractSignWords('permission denied for function gc_customer_sign_owner_contract')).toBe('Something went wrong. Please try again, or call our office.')
  })

  it('the page takes only a contract it can sign rightly', () => {
    const ok = { state: 'toSign', sendId: 's2', signBy: '2026-10-16', total: 187000, fileName: 'c.pdf', fileUrl: 'https://files.example/c.pdf', retainagePct: 10, retainageStep: { atPct: 50, toPct: 5, way: 'all' }, payDays: 30, lateInterestPctPerMonth: 1.5, lateFinishPerDay: null }
    expect(parsePortalGcContract(ok)).toEqual(ok)
    expect(parsePortalGcContract({ ...ok, fileUrl: 'javascript:alert(1)' })).toMatchObject({ fileUrl: null })
    expect(parsePortalGcContract({ ...ok, signBy: 'soon' })).toBeNull()
    expect(parsePortalGcContract({ ...ok, total: -1 })).toBeNull()
    expect(parsePortalGcContract({ ...ok, priceChanged: true })).toMatchObject({ priceChanged: true })
    expect(parsePortalGcContract({ state: 'signed', signedOn: '2026-10-12', signer: '', fileName: 'c.pdf', fileUrl: 'https://files.example/c.pdf' })).toEqual({ state: 'signed', signedOn: '2026-10-12', signer: null, fileName: 'c.pdf', fileUrl: 'https://files.example/c.pdf' })
    expect(parsePortalGcContract(null)).toBeNull()
  })
})

