import { describe, expect, it } from 'vitest'
import { runAddressLines, runDividerHtml, runDocumentWords, runEnvelopeHold, runMailing, runPageFoot, runSheetHtml } from './lienRunPaper'
import { runEnvelopes } from './runEnvelopes'
import type { RunNotice, RunRecipient } from './lienDeskRun'
import { plainWordsFailures } from '../plainWords'

const owner = (over: Partial<RunRecipient> = {}): RunRecipient => ({ key: 'owner', label: 'Owner of record', name: 'TC/JP SEGUIN 2019 LLC', address: '9993 IH 10 WEST SUITE 102, SAN ANTONIO, TX 78230', email: '', method: 'certified_mail', tracking: '', ...over })
const gc = (over: Partial<RunRecipient> = {}): RunRecipient => ({ key: 'original_contractor', label: 'Original contractor', name: 'Southern Post Construction', address: '2209 N. 23rd St., McAllen, TX 78501', email: 'ap@southernpost.test', method: 'certified_mail', tracking: '', ...over })
const notice = (over: Partial<RunNotice> = {}): RunNotice => ({
  itemId: 'it878',
  jobId: 'j878',
  kind: 'notice_53_056',
  label: '878 · Take 5- Seguin',
  jobNumber: '878',
  months: ['2026-07', '2026-08', '2026-09'],
  amount: 38625,
  fields: { noticeDate: '2026-09-24', projectDescription: 'Take 5- Seguin — 380 TX-123, Seguin, TX 78155', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Southern Post Construction', contractedWithIfDifferent: '', claimAmount: '38625.00', contactPerson: 'Malachi Whites', claimantAddress: '5501 Balcones Dr A141, Austin, TX 78731' },
  extras: {},
  coverLetter: 'Dear owner,\n\nThis page is a cover letter.',
  coverNote: null,
  ownerUnconfirmed: false,
  recipients: [owner(), gc()],
  ...over,
})
const issuer = { companyName: 'Click Plumbing and Electrical', addressText: '5501 Balcones Dr A141\nAustin, TX 78731', phone: '(512) 360-0599', email: 'office@clickplumbing.com', tagline: '', licenseLine: '' }
const ownerDocs = ['Cover letter', '§ 53.056 notice · copy for owner of record', 'Pay codes', 'Unpaid invoice 1 of 4', 'Unpaid invoice 2 of 4', 'Unpaid invoice 3 of 4', 'Unpaid invoice 4 of 4']

describe('what cannot be mailed is held (v2.4971)', () => {
  it('no mailing address, or nothing to claim, holds the envelope with the reason; a good one is null', () => {
    const [envOwner, envGc] = runEnvelopes([notice()])
    expect(runEnvelopeHold(envOwner!)).toBeNull()
    expect(runEnvelopeHold(envGc!)).toBeNull()
    const [noAddr] = runEnvelopes([notice({ recipients: [gc({ address: '' })] })])
    expect(runEnvelopeHold(noAddr!)).toBe('No mailing address. Set it on the customer, then print this envelope from the run.')
    const [zero] = runEnvelopes([notice({ amount: 0, recipients: [owner()] })])
    expect(runEnvelopeHold(zero!)).toBe('Nothing to send: the claim is $0. The notice stays on the desk.')
    const [both] = runEnvelopes([notice({ amount: 0, recipients: [gc({ address: '' })] })])
    expect(runEnvelopeHold(both!)).toMatch(/^No mailing address, and the claim is \$0\./)
    // Hand delivery needs a name, not an address; email needs an email.
    expect(runEnvelopeHold(runEnvelopes([notice({ recipients: [gc({ address: '', method: 'hand' })] })])[0]!)).toBeNull()
    expect(runEnvelopeHold(runEnvelopes([notice({ recipients: [gc({ address: '', email: '', method: 'email' })] })])[0]!)).toMatch(/^No email on file\./)
    for (const w of [runEnvelopeHold(noAddr!)!, runEnvelopeHold(zero!)!, runEnvelopeHold(both!)!]) expect(plainWordsFailures(w)).toEqual([])
  })

  it('runMailing renumbers: the ones that go out 1 to N, the held ones after, and the window lists them in that order', () => {
    const envs = runEnvelopes([notice({ recipients: [gc({ address: '' })] }), notice({ itemId: 'it2', jobId: 'j2', label: '898 · Reliant', jobNumber: '898', amount: 4800, recipients: [owner({ name: 'EPC SPARTI LLC', address: '550 HERITAGE DR STE 200, JUPITER, FL 33458' }), gc({ name: 'Knight Contracting', address: '2904 Corporate CR, Flower Mound, TX 75028', email: '' })] })])
    expect(envs.map((e) => e.n)).toEqual([1, 2, 3])
    const m = runMailing(envs)
    expect(m.mailed.map((e) => [e.n, e.name])).toEqual([
      [1, 'EPC SPARTI LLC'],
      [2, 'Knight Contracting'],
    ])
    expect(m.held.map((h) => [h.env.n, h.env.name, h.why])).toEqual([[3, 'Southern Post Construction', 'No mailing address. Set it on the customer, then print this envelope from the run.']])
    expect(m.all.map((e) => e.n)).toEqual([1, 2, 3])
  })
})

describe('the words for a stack of documents', () => {
  it('counts documents, never pages, and names them in print order', () => {
    expect(runDocumentWords(ownerDocs)).toEqual({ count: 7, words: '7 documents · counsel’s letter, the notice, the pay page, 4 unpaid invoices' })
    expect(runDocumentWords(['§ 53.056 notice · copy for original contractor'])).toEqual({ count: 1, words: '1 document · the notice' })
    expect(runDocumentWords([...ownerDocs, 'Cover note', '§ 53.057 retainage notice · copy for owner of record', 'Conditional release · $500.00', 'Unpaid invoice'])).toEqual({ count: 11, words: '11 documents · counsel’s letter, the cover note, the conditional release, 2 notices, the pay page, 5 unpaid invoices' })
    expect(runDocumentWords([])).toEqual({ count: 0, words: 'nothing' })
  })

  it('the address reads as the envelope does', () => {
    expect(runAddressLines('9993 IH 10 WEST SUITE 102, SAN ANTONIO, TX 78230')).toEqual(['9993 IH 10 WEST SUITE 102', 'SAN ANTONIO, TX 78230'])
    expect(runAddressLines('% SABRA HEALTH CARE REIT INC, 18500 VON KARMAN AVE STE 550, IRVINE, CA 92612')).toEqual(['% SABRA HEALTH CARE REIT INC', '18500 VON KARMAN AVE STE 550', 'IRVINE, CA 92612'])
    expect(runAddressLines('4 Example Way, Schertz, TX')).toEqual(['4 Example Way', 'Schertz, TX'])
    expect(runAddressLines('')).toEqual([])
  })
})

describe('the sheet, the divider and the foot', () => {
  it('the sheet: one row per envelope with the number, the name and address, what is inside, three ticks and a tracking box the width of the row; a held one in red with no box', () => {
    const envs = runEnvelopes([notice(), notice({ itemId: 'it2', jobId: 'j2', label: '1008 · Trip Charges', jobNumber: '1008', amount: 0, recipients: [gc({ name: 'RMC- Dudley Mason', address: '', email: '' })] })])
    const m = runMailing(envs)
    const html = runSheetHtml({ mailing: m, todayYmd: '2026-10-08', issuer, docsFor: (env) => (env.label === 'Owner of record' ? ownerDocs : ['§ 53.056 notice · copy for original contractor']) })
    expect(html).toContain('Today’s mail <span>· 2 envelopes · 8 documents · October 8, 2026</span>')
    expect(html).toContain('Work down the list. Tick each box as you go.')
    expect(html).toContain('<b>1 envelope is held back</b>')
    expect(html).toContain('<td class="n">1</td><td class="to"><strong>TC/JP SEGUIN 2019 LLC</strong><small>9993 IH 10 WEST SUITE 102<br>SAN ANTONIO, TX 78230</small></td>')
    expect(html).toContain('<b>7 documents</b> · counsel’s letter, the notice, the pay page, 4 unpaid invoices<br>878 · Take 5- Seguin · $38,625.00')
    expect(html).toContain('<span>☐ stuffed</span><span>☐ slip on</span><span>☐ mailed</span>')
    expect((html.match(/<tr class="runtrk"><td colspan="4"><div><span class="lab">Tracking number<\/span><span class="box"><small>20 digits from the green slip<\/small>/g) ?? []).length).toBe(2)
    expect(html).toContain('<tr class="runrow held" data-run-sheet-envelope="3" data-run-held="yes"><td class="n">3</td><td class="to"><strong>RMC- Dudley Mason · no mailing address</strong><small class="why">No mailing address, and the claim is $0. Nothing to send. The notice stays on the desk.</small></td><td class="in"><b>Held</b><br>1008 · Trip Charges · $0.00</td><td class="done">—</td></tr>')
  })

  it('the divider: the band, the face as the envelope printer prints it, the number, what follows, the ticks, the box; it says it stays on the desk', () => {
    const [env] = runMailing(runEnvelopes([notice()])).mailed
    const html = runDividerHtml(env!, 13, issuer, ownerDocs)
    expect(html).toContain('<div class="rundiv" data-run-divider="1"><div class="band"></div>')
    expect(html).toContain('<div class="ret">Click Plumbing and Electrical<br>5501 Balcones Dr A141<br>Austin, TX 78731</div>')
    expect(html).toContain('CERTIFIED MAIL · RETURN RECEIPT REQUESTED<span>Article no.')
    expect(html).toContain('<div class="to"><strong>TC/JP SEGUIN 2019 LLC</strong><br>9993 IH 10 WEST SUITE 102<br>SAN ANTONIO, TX 78230</div>')
    expect(html).toContain('<div class="facen">Envelope 1 of 13 · Owner of record</div>')
    expect(html).toContain('<span class="num">1</span><span class="of">of 13 envelopes</span>')
    expect(html).toContain('<b>7 documents follow this page</b> · counsel’s letter, the notice, the pay page, 4 unpaid invoices. The next divider is envelope 2.')
    expect(html).toContain('<span>☐ 7 documents counted</span><span>☐ sealed · slip on</span><span>☐ mailed</span>')
    expect(html).toContain('<span class="lab">Tracking number</span><span class="box">')
    expect(html).toContain('Pull this page out before you seal.')
    expect(runDividerHtml({ ...env!, n: 13 }, 13, issuer, ['§ 53.056 notice · copy for owner of record'])).toContain('<b>1 document follows this page</b> · the notice. This is the last envelope.')
  })

  it('the foot names the job, the copy and the document’s place — never the run’s count', () => {
    const foot = runPageFoot(notice(), owner(), 'Pay codes', 3, 7)
    expect(foot).toBe('<div class="runfoot" data-run-page-foot><span><b>Job #878</b> · copy for the owner of record</span><span>Pay codes · 3 of 7</span></div>')
    expect(foot).not.toMatch(/envelope/i)
  })
})

describe('an unsigned notice is held (v2.5086)', () => {
  it('a builder that said the leader has not signed holds the envelope with the reason; a notice the builder said nothing about is not held for it; the address comes first', () => {
    const run = runMailing(runEnvelopes([notice({ signature: null })]))
    expect(run.mailed).toHaveLength(0)
    expect(run.held).toHaveLength(2)
    expect(run.held[0]!.why).toBe('Unsigned: the leader signs it from his phone, or draws it here with Leader here, sign ▸.')
    expect(runMailing(runEnvelopes([notice()])).held).toHaveLength(0)
    const noAddress = runMailing(runEnvelopes([notice({ signature: null, recipients: [owner({ address: '' }), gc()] })]))
    expect(noAddress.held[0]!.why).toMatch(/^No mailing address/)
  })
})
