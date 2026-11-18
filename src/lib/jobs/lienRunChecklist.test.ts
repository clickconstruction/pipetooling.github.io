import { describe, expect, it } from 'vitest'
import { LIEN_RUN_SHEET_CSS, lienRunBatchPlans, lienRunChecklistRows, lienRunMailLink, lienRunNothingToClaim, lienRunRowLine, lienRunRowNext, lienRunSheetHtml, lienRunTickDay } from './lienRunChecklist'
import type { RunNotice, RunRecipient } from './lienDeskRun'
import type { LienNoticeSignature } from './lienNoticeSignature'

const owner = (tracking = ''): RunRecipient => ({ key: 'owner', label: 'Owner of record', name: 'Elwick Holdings LLC', address: '4 Example Way, Schertz, TX', email: '', method: 'certified_mail', tracking })
const gc = (tracking = ''): RunRecipient => ({ key: 'original_contractor', label: 'Original contractor', name: 'Lowbeck Contracting', address: '2904 Corporate Cr', email: 'office@lowbeck.test', method: 'certified_mail', tracking })

const typed: LienNoticeSignature = { mode: 'type', printedName: 'Robert Douglas', pngDataUrl: null, signedAtIso: '2026-10-09T19:14:00Z', recordId: 'L650-AAAA', signedWords: 'Signed October 9, 2026', auditLine: '', onDeviceOf: null, pen: null }
const pen: LienNoticeSignature = { ...typed, mode: 'pen', signedAtIso: '2026-10-10T17:00:00Z', pen: { recordedByName: 'Taunya', how: 'watched', confirmedAtIso: null } }

function notice(partial: Partial<RunNotice> = {}): RunNotice {
  return {
    itemId: 'it1',
    jobId: 'j650',
    kind: 'notice_53_056',
    label: '650 · AXO Schertz',
    jobNumber: '650',
    months: ['2026-06'],
    amount: 33_500,
    fields: { noticeDate: '2026-09-14', projectDescription: 'AXO Schertz', claimantName: 'Click', laborMaterialsType: 'Plumbing', originalContractorName: 'Lowbeck Contracting', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Robert', claimantAddress: '5501 Balcones Dr' },
    extras: {},
    coverLetter: null,
    coverNote: null,
    ownerUnconfirmed: false,
    recipients: [owner(), gc()],
    signature: typed,
    leader: { userId: 'u-rob', name: 'Robert Douglas' },
    ...partial,
  }
}

describe('lienRunChecklistRows', () => {
  it('reads the three ticks off the notice: the print stamp with who, the typed name, and every envelope’s number', () => {
    const [r] = lienRunChecklistRows({ notices: [notice({ printedAt: '2026-10-08T16:00:00Z', printedBy: 'Taunya', recipients: [owner('9407 1118 9876 5432 1098'), gc('9407 1118 9876 5432 1111')] })] })
    expect(r!.printed).toEqual({ at: '2026-10-08T16:00:00Z', by: 'Taunya' })
    expect(r!.signed).toEqual({ how: 'typed', at: '2026-10-09T19:14:00Z', by: 'Robert Douglas' })
    expect(r!.mailed).toEqual({ tracking: '9407 1118 9876 5432 1098 · 9407 1118 9876 5432 1111', sentOn: null })
    expect(r!.waitsOn).toBeNull()
    expect(r!.line).toBe('mailed · ready to record')
    expect(r!.recipients.map((x) => [x.key, x.mailed, x.needsNumber])).toEqual([['owner', true, true], ['original_contractor', true, true]])
    expect(r!.amount).toBe(33_500)
    expect(r!.label).toBe('650 · AXO Schertz')
  })

  it('waits on the ticks in the owner’s order: print, then sign, then mail; one envelope’s number alone is not mailed', () => {
    const unprinted = lienRunChecklistRows({ notices: [notice({ signature: null })] })[0]!
    expect(unprinted.waitsOn).toBe('print')
    expect(unprinted.line).toBe('not printed')
    const unsigned = lienRunChecklistRows({ notices: [notice({ printedAt: '2026-10-08T16:00:00Z', signature: null })] })[0]!
    expect(unsigned.waitsOn).toBe('sign')
    expect(unsigned.line).toBe('printed · not signed')
    expect(unsigned.held).toBeNull()
    const half = lienRunChecklistRows({ notices: [notice({ printedAt: '2026-10-08T16:00:00Z', recipients: [owner('9407 1118 9876 5432 1098'), gc()] })] })[0]!
    expect(half.mailed).toBeNull()
    expect(half.waitsOn).toBe('mail')
    expect(half.line).toBe('signed · not mailed')
  })

  it('a pen record reads as pen with the day and who wrote it; a builder that said nothing about signing needs no tick', () => {
    const [p, none] = lienRunChecklistRows({ notices: [notice({ printedAt: '2026-10-08T16:00:00Z', signature: pen }), notice({ itemId: 'it2', printedAt: '2026-10-08T16:00:00Z', signature: undefined })] })
    expect(p!.signed).toEqual({ how: 'pen', at: '2026-10-10T17:00:00Z', by: 'Taunya' })
    expect(none!.signed).toBe('not_needed')
    expect(none!.waitsOn).toBe('mail')
    expect(none!.line).toBe('printed · not mailed')
  })

  it('a print in this sitting wins over the row’s stamp; by hand or by email needs no number; a hold is named apart from the ticks', () => {
    const now = new Map([['it1', { at: '2026-11-15T20:00:00Z', by: 'Taunya' }]])
    const [r] = lienRunChecklistRows({ notices: [notice({ printedAt: null })], printedNow: now })
    expect(r!.printed).toEqual({ at: '2026-11-15T20:00:00Z', by: 'Taunya' })
    const [hand] = lienRunChecklistRows({ notices: [notice({ printedAt: '2026-10-08T16:00:00Z', recipients: [{ ...owner(), method: 'hand' }, { ...gc(), method: 'hand' }] })] })
    expect(hand!.mailed).toEqual({ tracking: 'by hand', sentOn: null })
    const [email] = lienRunChecklistRows({ notices: [notice({ recipients: [{ ...owner(), method: 'email', email: 'o@x.test' }, { ...gc(), method: 'email' }] })] })
    expect(email!.paperless).toBe(true)
    expect(email!.waitsOn).toBeNull()
    const noAddress = notice({ printedAt: null })
    noAddress.recipients[0] = { ...noAddress.recipients[0]!, name: '', address: '' }
    const [held] = lienRunChecklistRows({ notices: [noAddress] })
    expect(held!.held).toMatch(/^Owner of record:/)
    expect(held!.waitsOn).toBe('print')
    expect(held!.nothingToClaim).toBe(false)
  })

  it('a job that owes nothing now holds its row (v2.7337): the words name what the paper says, and the hold comes before an address', () => {
    // Printed with a claim, paid since: the run's amount is the open balance today, the fields are the paper.
    const [paid] = lienRunChecklistRows({ notices: [notice({ printedAt: '2026-10-09T15:32:00Z', signature: null, amount: 0, fields: { ...notice().fields, claimAmount: '6150.75' } })] })
    expect(paid!.nothingToClaim).toBe(true)
    expect(paid!.held).toBe('Nothing to claim: the job owes $0 now. The paper says $6,151.')
    // The ticks stay facts: it printed, nobody signed it.
    expect(paid!.printed).toEqual({ at: '2026-10-09T15:32:00Z', by: null })
    expect(paid!.line).toBe('printed · not signed')
    // Never printed, or a paper that said $0 itself: nothing to quote.
    expect(lienRunNothingToClaim(notice({ amount: 0 }))).toBe('Nothing to claim: the job owes $0 now.')
    expect(lienRunNothingToClaim(notice({ amount: 0, printedAt: '2026-10-09T15:32:00Z', fields: { ...notice().fields, claimAmount: '0.00' } }))).toBe('Nothing to claim: the job owes $0 now.')
    expect(lienRunNothingToClaim(notice({ amount: 0.004 }))).not.toBeNull()
    expect(lienRunNothingToClaim(notice())).toBeNull()
    const both = notice({ amount: 0 })
    both.recipients[0] = { ...both.recipients[0]!, name: '', address: '' }
    expect(lienRunChecklistRows({ notices: [both] })[0]!.held).toBe('Nothing to claim: the job owes $0 now.')
  })
})

describe('what was mailed rides on the row', () => {
  it('a row carries its notice’s mailed files, and none reads as an empty list', () => {
    const kept = { url: 'https://drive.google.com/file/d/f1/view', driveFileId: 'f1', name: 'Lien notice as mailed · 650 · 2026-11-16.pdf', at: '2026-11-16T18:00:00.000Z', by: 'u1' }
    const rows = lienRunChecklistRows({ notices: [notice({ itemId: 'a', mailedCopies: [kept] }), notice({ itemId: 'b' })] })
    expect(rows.map((r) => r.mailedCopies)).toEqual([[kept], []])
  })
})

describe('lienRunBatchPlans', () => {
  const rows = () =>
    lienRunChecklistRows({
      notices: [
        notice({ itemId: 'a', label: 'A', printedAt: null, signature: null }),
        notice({ itemId: 'b', label: 'B', printedAt: '2026-10-08T16:00:00Z', signature: null }),
        notice({ itemId: 'c', label: 'C', printedAt: '2026-10-08T16:00:00Z', recipients: [owner('9407 1118 9876 5432 1098'), gc('9407 1118 9876 5432 1111')] }),
        notice({ itemId: 'd', label: 'D', printedAt: '2026-10-08T16:00:00Z' }),
        notice({ itemId: 'e', label: 'E', printedAt: '2026-10-08T16:00:00Z', signature: null, leader: { userId: 'u-dale', name: 'Dale' } }),
      ],
    })

  it('Mark N printed takes the unprinted rows the run does not hold', () => {
    const noAddress = notice({ itemId: 'f', label: 'F', printedAt: null })
    noAddress.recipients[0] = { ...noAddress.recipients[0]!, name: '', address: '' }
    const plans = lienRunBatchPlans([...rows(), ...lienRunChecklistRows({ notices: [noAddress] })])
    expect(plans.print.ready.map((r) => r.itemId)).toEqual(['a'])
    expect(plans.print.held.map((h) => [h.itemId, h.why])).toEqual([['f', 'Owner of record: nobody to send to']])
    expect(plans.print.words.button).toBe('Mark 1 printed · 1 held ▸')
    expect(plans.print.words.dead).toBe(false)
  })

  it('Mark N signed takes the printed, unsigned rows of one leader and holds the rest with why', () => {
    const plans = lienRunBatchPlans(rows())
    expect(plans.sign.ready.map((r) => r.itemId)).toEqual(['b'])
    expect(plans.sign.held.map((h) => [h.itemId, h.why])).toEqual([
      ['a', 'not printed yet'],
      ['e', 'Dale’s, on the next press'],
    ])
    expect(plans.sign.words.button).toBe('Mark 1 signed · 2 wait ▸')
  })

  it('Record N mailings takes the printed rows whose every envelope has its number, and names what the rest owe', () => {
    const plans = lienRunBatchPlans(rows())
    expect(plans.mail.ready.map((r) => r.itemId)).toEqual(['c'])
    expect(plans.mail.held.map((h) => [h.itemId, h.why])).toEqual([
      ['a', 'not printed yet'],
      ['b', 'no tracking numbers yet'],
      ['d', 'no tracking numbers yet'],
      ['e', 'no tracking numbers yet'],
    ])
    expect(plans.mail.words.button).toBe('Record 1 mailing · 4 wait ▸')
    expect(plans.mail.words.foot).toBe('4 are held. They stay here with the reason. The 1 ready one records now.')
  })

  it('a row with nothing to claim is held from every press and never picks the signer (v2.7337)', () => {
    const paid = (itemId: string, extra: Partial<RunNotice> = {}) => notice({ itemId, label: itemId.toUpperCase(), amount: 0, signature: null, fields: { ...notice().fields, claimAmount: '2400.00' }, ...extra })
    const plans = lienRunBatchPlans(
      lienRunChecklistRows({
        notices: [
          // First in the run, printed, another leader's: it must not make Dale the signer.
          paid('p1', { printedAt: '2026-10-09T15:32:00Z', leader: { userId: 'u-dale', name: 'Dale' } }),
          notice({ itemId: 'b', label: 'B', printedAt: '2026-10-08T16:00:00Z', signature: null }),
          // Numbered before the job was paid: it does not record either.
          paid('p2', { printedAt: '2026-10-09T15:32:00Z', signature: typed, recipients: [owner('9407 1118 9876 5432 1098'), gc('9407 1118 9876 5432 1111')] }),
          paid('p3', { printedAt: null }),
        ],
      }),
    )
    const why = 'Nothing to claim: the job owes $0 now. The paper says $2,400.'
    expect(plans.sign.ready.map((r) => r.itemId)).toEqual(['b'])
    expect(plans.sign.held.map((h) => [h.itemId, h.why])).toEqual([
      ['p1', why],
      ['p3', 'Nothing to claim: the job owes $0 now.'],
    ])
    expect(plans.sign.words.button).toBe('Mark 1 signed · 2 wait ▸')
    expect(plans.print.ready).toEqual([])
    expect(plans.print.held.map((h) => h.itemId)).toEqual(['p3'])
    expect(plans.mail.ready).toEqual([])
    expect(plans.mail.held.map((h) => [h.itemId, h.why])).toEqual([
      ['p1', why],
      ['b', 'no tracking numbers yet'],
      ['p2', why],
      ['p3', 'Nothing to claim: the job owes $0 now.'],
    ])
  })

  it('dead only when nothing is ready, and a dead press keeps its noun whether or not rows are held (v2.7477)', () => {
    const none = lienRunBatchPlans([])
    expect(none.print.words).toEqual({ button: 'Mark printed', foot: null, dead: true })
    expect(none.mail.words).toEqual({ button: 'Record mailings', foot: null, dead: true })
    const owed = lienRunBatchPlans(lienRunChecklistRows({ notices: [notice({ printedAt: '2026-10-08T16:00:00Z' })] }))
    expect(owed.mail.words.dead).toBe(true)
    expect(owed.mail.words.button).toBe('Record mailings')
    expect(owed.print.words.dead).toBe(true)
  })
})

describe('the words around the checklist', () => {
  it('the Signed batch leaves a paid job out of its count (v2.7337)', () => {
    const paid = (itemId: string) => notice({ itemId, printedAt: '2026-10-09T15:32:00Z', signature: null, amount: 0 })
    const live = (itemId: string) => notice({ itemId, printedAt: '2026-10-08T16:00:00Z', signature: null })
    // The desk of 2026-11-15: seven printed, five paid since.
    const seven = lienRunChecklistRows({ notices: [live('a'), live('b'), paid('c'), paid('d'), paid('e'), paid('f'), paid('g')] })
    expect(lienRunBatchPlans(seven).sign.words.button).toBe('Mark 2 signed · 5 wait ▸')
  })

  it('the pile row’s line names the tick it waits on', () => {
    expect(lienRunRowLine(false, false, false)).toBe('not printed')
    expect(lienRunRowLine(true, false, false)).toBe('printed · not signed')
    expect(lienRunRowLine(true, true, false)).toBe('signed · not mailed')
    expect(lienRunRowLine(true, 'not_needed', false)).toBe('printed · not mailed')
    expect(lienRunRowLine(true, true, true)).toBe('mailed · ready to record')
  })

  it('a tick’s day is short', () => {
    expect(lienRunTickDay('2026-11-15T20:00:00Z')).toBe('Nov 15')
    expect(lienRunTickDay(null)).toBe('')
  })
})

describe('the sheet and its codes', () => {
  it('the code’s address opens the desk with the run on that envelope’s Mailed box', () => {
    expect(lienRunMailLink('it1')).toBe('https://clicktooling.com/lien-desk?run=it1&mail=1')
    expect(lienRunMailLink('a b', 'http://localhost:5173')).toBe('http://localhost:5173/lien-desk?run=a%20b&mail=1')
  })

  it('one row per notice with its label, who, amount, three boxes drawn from the facts, and a code', () => {
    const rs = lienRunChecklistRows({ notices: [notice({ printedAt: '2026-10-08T16:00:00Z', printedBy: 'Taunya' }), notice({ itemId: 'it2', label: '688 · Harlan Dental', printedAt: null, signature: null, amount: 1200 })] })
    const html = lienRunSheetHtml({ rows: rs, todayYmd: '2026-11-15', dayWords: 'November 15, 2026', issuerName: 'Click Plumbing', codeFor: (id) => `<img alt="" data-code="${id}"/>` })
    expect(html).toContain('data-run-checklist-sheet')
    expect(html).toContain('The run <span>· 2 notices · November 15, 2026</span>')
    expect(html).toContain('<strong>650 · AXO Schertz</strong><small>Owner: Elwick Holdings LLC · GC: Lowbeck Contracting</small>')
    expect(html).toContain('$33,500')
    expect(html).toContain('☑ Printed Oct 8 · Taunya')
    expect(html).toContain('☑ Signed Oct 9 · typed')
    expect(html).toContain('☐ Mailed')
    expect(html).toContain('data-code="it1"')
    expect(html).toContain('data-code="it2"')
    expect(html).toContain('<strong>688 · Harlan Dental</strong>')
    expect(html).toContain('☐ Printed</span>')
    expect(html).toContain('☐ Signed</span>')
    expect(html).not.toContain('<script')
    expect(LIEN_RUN_SHEET_CSS).toContain('.runchecklist')
  })
})

describe('a parted notice is the row’s hold (v2.7517)', () => {
  it('the row is held with both figures, so Mark printed and Record leave it and say why', () => {
    const parted = { parts: ['claim' as const], paperClaim: 51_000, nowClaim: 33_500, paperRetainage: 0, nowRetainage: 0, source: 'bills' as const }
    const rows = lienRunChecklistRows({ notices: [notice({ parted })] })
    expect(rows[0]!.held).toBe('The paper claims $51,000.00. The bills now come to $33,500.00, $17,500.00 less. It prints once the notice is redrawn from the bills.')
    const plans = lienRunBatchPlans(rows)
    expect(plans.print.ready).toHaveLength(0)
    expect(plans.print.held.map((h) => h.why)).toEqual([rows[0]!.held])
  })
})

describe('lienRunRowNext · the one thing to do next on a row (v2.7695)', () => {
  const printed = { printedAt: '2026-10-08T16:00:00Z', printedBy: 'Taunya' }
  const copy = { url: 'https://drive.google.com/file/d/f1/view', driveFileId: 'f1', name: 'Lien notice as mailed · 650 · 2026-10-08.pdf', at: '', by: null }
  const next = (n: Parameters<typeof notice>[0]) => lienRunRowNext(lienRunChecklistRows({ notices: [notice(n)] })[0]!)

  it('walks the four steps in order: print, sign, the file in the envelope, then each number and receipt', () => {
    expect(next({ signature: null })).toBe('Get Robert Douglas’s signature, or print it for a pen.')
    expect(next({})).toBe('Print the notice.')
    expect(next({ ...printed, signature: null })).toBe('Get Robert Douglas’s signature.')
    expect(next({ ...printed })).toBe('Scan what goes in the envelope and add the file.')
    expect(next({ ...printed, mailedCopies: [copy] })).toBe('Add the owner’s receipt. The number fills in from a photo.')
    expect(next({ ...printed, mailedCopies: [copy], recipients: [{ ...owner(), receiptUrl: 'https://d/r' }, gc()] })).toBe('Type the owner’s mail number.')
    expect(next({ ...printed, mailedCopies: [copy], recipients: [{ ...owner('9407 1'), receiptUrl: 'https://d/r' }, gc('9407 2')] })).toBe('Add the GC’s receipt.')
    expect(next({ ...printed, mailedCopies: [copy], recipients: [{ ...owner('9407 1'), receiptUrl: 'https://d/r1' }, { ...gc('9407 2'), receiptUrl: 'https://d/r2' }] })).toBe('Ready to record.')
  })

  it('carries each copy’s receipt on its cell', () => {
    const [r] = lienRunChecklistRows({ notices: [notice({ recipients: [{ ...owner('9407 1'), receiptUrl: ' https://d/r1 ' }, gc()] })] })
    expect(r!.recipients.map((x) => x.receiptUrl)).toEqual(['https://d/r1', ''])
  })

  it('asks for nothing the screen has no press for, and says nothing on a held row', () => {
    const row = lienRunChecklistRows({ notices: [notice({ ...printed, recipients: [owner('9407 1'), gc('9407 2')] })] })[0]!
    expect(lienRunRowNext(row, { canAddCopy: false, canAddReceipt: false })).toBe('Ready to record.')
    expect(lienRunRowNext({ ...row, held: 'no mailing address' })).toBeNull()
    expect(lienRunRowNext({ ...row, nothingToClaim: true })).toBeNull()
  })
})
