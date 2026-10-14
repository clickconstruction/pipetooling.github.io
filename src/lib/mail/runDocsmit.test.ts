import { describe, expect, it } from 'vitest'
import { docsmitCandidates, docsmitCoverWindow, docsmitPrepareDraft, docsmitPriceWords, docsmitRunDoor, docsmitSendByStrip, docsmitSendOutcome, docsmitSendRecord, mailKindOf, type DocsmitEnvelopeLike } from './runDocsmit'

const owner = { recipient: { key: 'owner' as const }, notice: { itemId: 'it1', jobId: 'j650', jobNumber: '650', kind: 'notice_53_056', label: '650 · ATI' } }
const gc1 = { recipient: { key: 'original_contractor' as const }, notice: { itemId: 'it1', jobId: 'j650', jobNumber: '650', kind: 'notice_53_056', label: '650 · ATI' } }
const gc2 = { recipient: { key: 'original_contractor' as const }, notice: { itemId: 'it2', jobId: 'j712', jobNumber: '712', kind: 'notice_53_056', label: '712 · ATI B' } }
const envelopes: DocsmitEnvelopeLike[] = [
  { key: 'e1', n: 1, label: 'Owner of record', name: 'ATI Schertz Holdings LLC', address: '17300 IH 35 N, Schertz, TX 78154', method: 'certified_mail', tracking: '', contents: [owner] },
  { key: 'e2', n: 2, label: 'Original contractor', name: 'Loberg Contracting', address: '4303 Thousand Oaks Dr, San Antonio, TX 78217', method: 'certified_mail', tracking: '', contents: [gc1, gc2] },
  { key: 'e3', n: 3, label: 'Owner of record', name: 'Harlan Dental PLLC', address: '2200 Bandera Rd, San Antonio, TX 78228', method: 'hand', tracking: '', contents: [{ ...owner, notice: { ...owner.notice, itemId: 'it3', jobId: 'j688', jobNumber: '688' } }] },
  { key: 'e4', n: 4, label: 'Owner of record', name: 'Someone', address: 'no address yet', method: 'certified_mail', tracking: '', contents: [{ ...owner, notice: { ...owner.notice, itemId: 'it4', jobId: 'j700', jobNumber: '700' } }] },
]

describe('a run that mails through Docsmit, the pure side (the Docsmit train, PR 5a)', () => {
  it('the candidates are the certified envelopes, with the party, the problems, the one job or none, and the window lines', () => {
    const c = docsmitCandidates(envelopes)
    expect(c.map((x) => x.key)).toEqual(['e1', 'e2', 'e4'])
    expect(c[0]).toMatchObject({ recipient: 'owner', kind: 'lien_notice_53_056', jobId: 'j650', jobNumber: '650', itemIds: ['it1'], problems: [], windowLines: ['ATI Schertz Holdings LLC', '17300 IH 35 N', 'Schertz, TX 78154'] })
    expect(c[0]!.party.organization).toBe('ATI Schertz Holdings LLC')
    expect(c[1]).toMatchObject({ recipient: 'original_contractor', jobId: null, itemIds: ['it1', 'it2'] })
    expect(c[2]!.problems).toEqual(['a city', 'a two-letter state', 'a ZIP or ZIP+4'])
    // A combined notice (#35 PR 3) stands for every job at the property: each job's desk item is inside (v2.5532).
    const combined = { ...envelopes[0]!, contents: [{ ...owner, notice: { ...owner.notice, parts: [{ itemId: 'it1' }, { itemId: 'it9' }] } }] }
    expect(docsmitCandidates([combined])[0]!.itemIds).toEqual(['it1', 'it9'])
    expect(mailKindOf('retainage_53_057')).toBe('lien_retainage_53_057')
    expect(mailKindOf('affidavit_53_054')).toBe('other')
  })

  it('the door: hidden while paused, dim with nothing certified or nothing clean, named with the count otherwise', () => {
    const c = docsmitCandidates(envelopes)
    expect(docsmitRunDoor({ paused: true }, c)).toMatchObject({ show: false })
    expect(docsmitRunDoor({ paused: false }, [])).toMatchObject({ show: true, enabled: false, why: 'No envelope in this run is on certified mail.' })
    expect(docsmitRunDoor({ paused: false }, [c[2]!])).toMatchObject({ enabled: false, why: 'Every certified envelope needs a city, a two-letter state, a ZIP or ZIP+4 first.' })
    expect(docsmitRunDoor({ paused: false }, c)).toEqual({ show: true, enabled: true, label: 'Mail through Docsmit · 2 envelopes', why: '1 envelope with a problem stay on paper.' })
    expect(docsmitRunDoor({ paused: false }, [c[0]!]).label).toBe('Mail through Docsmit · 1 envelope')
  })

  it('the prepare draft carries the code, the envelope by pages, the send type and the party as the function takes it; the cover window follows', () => {
    const c = docsmitCandidates(envelopes)[0]!
    let n = 0
    const d = docsmitPrepareDraft(c, 7, { receipt: 'card', filingIds: ['f1'], random: () => ((n += 0.11) % 1) })
    expect(d.shortCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
    expect(d.envelope).toEqual({ envelope: 'Flat', sheets: 7, problem: null })
    expect(d.piece).toEqual({ kind: 'lien_notice_53_056', source_ids: ['f1'], job_id: 'j650', recipient: 'owner', short_code: d.shortCode, name: '', organization: 'ATI Schertz Holdings LLC', address1: '17300 IH 35 N', address2: '', city: 'Schertz', state: 'TX', postal_code: '78154', send_type: 'Certified, Return Receipt', envelope: 'Flat', sheets: 7 })
    expect(docsmitPrepareDraft(c, 60, { receipt: 'electronic', shortCode: 'KX7M2QRT' }).envelope.problem).toMatch(/more than a flat holds/)
    // With no filings yet, the piece names the desk items inside (v2.5532), so the desk knows the send before the record.
    expect(docsmitPrepareDraft(docsmitCandidates(envelopes)[1]!, 4, { receipt: 'electronic', shortCode: 'KX7M2QRT' }).piece.source_ids).toEqual(['it1', 'it2'])
    const w = docsmitCoverWindow(c, 'https://clicktooling.com/pay/abc', 'KX7M2QRT', { png: 'data:png', svg: null })
    expect(w).toEqual({ lines: c.windowLines, qr: { png: 'data:png', svg: null, display: 'clicktooling.com/pay/abc?m=KX7M2QRT', caption: 'Scan to see and pay the bills this notice is about.' } })
    expect(docsmitCoverWindow(c, null, 'KX7M2QRT', { png: null, svg: null }).qr).toBeNull()
  })

  it('the price line against the balance: fine, low, short, unknown', () => {
    const prepared = [
      { key: 'e1', pieceId: 'p1', price: 9.85, correction: null, sheets: 4, envelope: '#10' as const },
      { key: 'e2', pieceId: 'p2', price: 12.4, correction: 'ZIP+4', sheets: 9, envelope: 'Flat' as const },
    ]
    expect(docsmitPriceWords(prepared, 120, 25)).toEqual({ total: 22.25, priced: 2, words: '2 envelopes · $22.25 · balance $120.00', short: false, low: false })
    expect(docsmitPriceWords(prepared, 40, 25)).toMatchObject({ words: '2 envelopes · $22.25 · balance $40.00 · $17.75 left after, add credit soon', low: true, short: false })
    expect(docsmitPriceWords(prepared, 15, 25)).toMatchObject({ words: '2 envelopes · $22.25 · balance $15.00 · Docsmit credit is short by $7.25', short: true })
    expect(docsmitPriceWords([prepared[0]!, { ...prepared[1]!, price: null }], null, 25).words).toBe('2 envelopes · $9.85 (1 not priced yet) · balance unknown')
  })

  it('a send’s answer: all mailed; stopped short with the shortfall at the envelope; the rest stay on paper', () => {
    const prepared = [{ key: 'e1', pieceId: 'p1' }, { key: 'e2', pieceId: 'p2' }, { key: 'e4', pieceId: 'p4' }]
    expect(docsmitSendOutcome({ ok: true, sent: ['p1', 'p2', 'p4'] }, prepared)).toEqual({ mailedKeys: ['e1', 'e2', 'e4'], heldKeys: [], words: '3 envelopes mailed through Docsmit.' })
    expect(docsmitSendOutcome({ ok: false, sent: ['p1'], stopped_at: 'p2', shortfall: 7.25 }, prepared)).toEqual({ mailedKeys: ['e1'], heldKeys: ['e2', 'e4'], words: '1 envelope mailed through Docsmit. Docsmit credit is short by $7.25 at envelope 2; nothing more was sent. The rest stay on paper.' })
    expect(docsmitSendOutcome({ ok: false, sent: [], stopped_at: 'p1', error: 'Docsmit refused p1: boom. Nothing more was sent.' }, prepared).words).toBe('Nothing mailed. Docsmit refused p1: boom. Nothing more was sent. The rest stay on paper.')
    expect(docsmitSendRecord('p1', ' 9407 1118 ')).toEqual({ tracking: '9407 1118', via: 'docsmit', piece_id: 'p1' })
    expect(docsmitSendRecord('p1', null)).toEqual({ tracking: '', via: 'docsmit', piece_id: 'p1' })
  })

  it('the send-by strip: the day less the buffer at the cutoff, or late past it; nothing without a window', () => {
    const s = { cutoffLocal: '15:00', sendByBufferDays: 1 }
    expect(docsmitSendByStrip('2026-10-15', s, { ymd: '2026-10-13', local: '09:00' })).toEqual({ words: 'Send to Docsmit by 2026-10-14 at 3:00 pm', late: false, ymd: '2026-10-14' })
    expect(docsmitSendByStrip('2026-10-15', s, { ymd: '2026-10-14', local: '15:01' })).toMatchObject({ late: true, words: "Past Docsmit's cutoff for 2026-10-15: this month mails late. Send to Docsmit by 2026-10-14 at 3:00 pm was the last call." })
    expect(docsmitSendByStrip(null, s, { ymd: '2026-10-13', local: '09:00' })).toBeNull()
  })
})
