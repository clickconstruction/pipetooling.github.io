/**
 * The firm portal's sample matter (v2.3639; one coherent story since v2.4638): the fixture
 * `legal-portal` answers the sample token with, and the page builds for itself, must survive the
 * real parser and the desk's own packet kernel, and must tell one story on any day it is opened:
 * a GC-paid commercial job with a property record, a dated check, a § 53.056 notice sent in time
 * with the owner's answers, a final demand whose deadline has passed, one promise kept and one
 * broken, the firm's fee, its question and the office's answer, and a Lien grid with three jobs.
 */
import { describe, expect, it } from 'vitest'
import { sampleLegalPortalResponse, sampleStatutoryFifteenth } from '../../../supabase/functions/_shared/customerSampleFixtures'
import { buildMatterPacket, parseLegalPortalPayload, portalFeeModel } from './legalPortalPayload'
import { statutoryFifteenth } from '../jobs/lienDeadlines'
import { assembleLienBookInput } from '../jobs/lienTimelineBookAssemble'
import { buildLienTimelineBook, lienGridRows } from '../jobs/lienTimelineBook'
import { ymdPlusDays } from '../../../supabase/functions/_shared/customerSample'

const company = { name: 'Click Plumbing and Electrical', cityLine: 'Kyle, TX', licenseLine: '', phone: '(512) 555-0100', email: 'office@example.com' }

// Month ends, a leap day, weekends and a year turn: the story must hold on every one.
const DAYS = ['2026-09-20', '2026-10-05', '2026-10-31', '2027-01-01', '2027-02-03', '2028-02-29', '2028-03-31', '2026-12-26']

describe('sampleLegalPortalResponse — one referred matter, one story', () => {
  for (const today of DAYS) {
    const d = (n: number) => ymdPlusDays(today, n)
    it(`parses, builds the packet and tells the same story on ${today}`, () => {
      const parsed = parseLegalPortalPayload(sampleLegalPortalResponse(company, today))
      expect(parsed).not.toBeNull()
      expect(parsed!.matters).toHaveLength(1)
      const m = parsed!.matters[0]!
      const packet = buildMatterPacket(m, today, portalFeeModel(parsed!))
      expect(packet).not.toBeNull()
      const p = packet!

      // The GC is the payer, so Click is the subcontractor: the note to the firm and the job agree.
      expect(p.account.payer).toMatchObject({ name: 'Brazos Ridge Contracting', viaGc: true })
      expect(m.noteToFirm).toMatch(/demand on Brazos Ridge Contracting, the GC/)
      expect(p.theory.key).toBe('contract')

      // The money: $18,400 billed on two bills, one $4,000 check with its date and number.
      expect(p.account.totals).toMatchObject({ billed: 18_400, paid: 4_000, balance: 14_400 })
      const pay = p.account.ledger.find((e) => e.kind === 'payment')!
      expect(pay.ymd).toBe(d(-84))
      expect(pay.text).toMatch(/check · ref 2291/)
      expect(p.account.ledger.filter((e) => e.kind === 'invoice').map((e) => e.amount)).toEqual([4_000, 14_400])

      // The property record: county, owner of record, legal description, parcel, ready for a lien.
      expect(p.account.properties).toHaveLength(1)
      expect(p.account.properties[0]).toMatchObject({ county: 'Hays', propertyKind: 'commercial', lienReady: true })
      expect(p.account.properties[0]!.owner).toMatch(/Alvarado Holdings LLC/)
      expect(p.account.properties[0]!.legalDescription).toMatch(/Lot 4, Block B/)
      expect(p.account.properties[0]!.parcelId).toMatch(/R104417/)

      // The § 53.056 notice went out in time for every work month, to the owner and the GC, with the owner's answers.
      expect(p.paper.envelopes).toHaveLength(1)
      const notice = p.paper.envelopes[0]!
      expect(notice.kind).toBe('notice_53_056')
      expect(notice.wentOutYmd).toBe(d(-40))
      expect(notice.months.length).toBeGreaterThan(0)
      expect(notice.months.every((x) => !x.asInformation)).toBe(true)
      expect(notice.sends.map((s) => s.recipient)).toEqual(['owner', 'original_contractor'])
      expect(notice.answers?.ownerCall).toMatchObject({ owesGc: 'yes', owesAmount: 12_000, reserved: 'held' })
      expect(notice.answers?.pile).toBe('A')

      // The final demand: sent by certified mail with tracking, its deadline passed.
      expect(p.paper.demandLetters).toHaveLength(1)
      expect(p.paper.demandLetters[0]).toMatchObject({ sentYmd: d(-28), deadlineYmd: d(-18), deadlinePassed: true, exhibits: 3 })
      expect(p.paper.demandLetters[0]!.tracking).toMatch(/9407/)
      // Its enclosures are the real rows' shape: { label, kind, title, pages }.
      const enclosures = ((m as unknown as { demandLetters: Array<{ fields: { enclosures: unknown[] } }> }).demandLetters[0]!.fields.enclosures)
      expect(enclosures.every((e) => typeof e === 'object' && e !== null && 'label' in e && 'kind' in e && 'title' in e && 'pages' in e)).toBe(true)

      // The GC's office is in Hays County, with the property, and no name in the story reads "Sample".
      expect(p.account.customerAddress).toMatch(/San Marcos, TX/)
      expect(JSON.stringify(m)).not.toMatch(/Sample (Contracting|Holdings|Pkwy|Commerce|Dental|Builders)|Jordan Sample|SAMPLE 00/)

      // A notice is mailed, never filed: "What the company did" dates it by its first send (item 9 review).
      expect(p.feesAndSteps.steps.find((s) => s.kind === 'filing')?.ymd).toBe(d(-40))
      // …and by the day its record was made when no send is recorded.
      const unsent = { ...m, lienFilings: m.lienFilings.map((f) => ({ ...f, sends: [] })) }
      expect(buildMatterPacket(unsent, today, portalFeeModel(parsed!))!.feesAndSteps.steps.find((s) => s.kind === 'filing')?.ymd).toBe(d(-40))

      // The lien is alive: the affidavit window is still open.
      const clock = p.paper.lienClock[0]!
      expect(['notice_open', 'affidavit_open']).toContain(clock.status)
      expect(clock.filingLeft).toBeGreaterThan(0)

      // Two promises: the first kept by the check, the second broken. The collections note says the same.
      const promiseText = p.theirWord.timeline.filter((e) => e.kind === 'promise').map((e) => e.text)
      expect(promiseText).toHaveLength(2)
      expect(promiseText[0]).toMatch(/· kept/)
      expect(promiseText[1]).toMatch(/· broken/)
      expect(p.theirWord).toMatchObject({ kept: 1, broken: 1, decided: 2 })
      expect(m.jobs[0]!.collections_note).toMatch(/first draw on its promise, then missed the second/)
      // Everything said is after the first bill, so every entry goes to counsel.
      expect(p.theirWord.heldCount).toBe(0)

      // Field evidence with GPS on every visit.
      expect(p.evidence[0]).toMatchObject({ reports: 2, reportsWithGps: 2, sessions: 4, sessionsWithGps: 4 })

      // The firm's fee, its question (seen by the office) and the office's answer.
      expect(m.entries.map((e) => [e.kind, e.via_portal])).toEqual([['fee', true], ['question', true], ['answer', false]])
      expect(m.entries[1]!.acknowledged_at).toBeTruthy()

      // Click's particulars, plainly sample.
      for (const k of ['license', 'agent', 'custodian', 'affiant'] as const) expect(parsed!.particulars[k]).toMatch(/\(sample\)/)
    })

    it(`draws a Lien grid of three jobs on ${today}`, () => {
      const parsed = parseLegalPortalPayload(sampleLegalPortalResponse(company, today))!
      expect(parsed.lienBook).not.toBeNull()
      const book = buildLienTimelineBook(assembleLienBookInput(parsed.lienBook!, today))
      expect(book.rows).toHaveLength(3)
      const grid = lienGridRows(book.rows, today)
      const matter = grid.find((g) => g.job.startsWith('1042'))!
      expect(matter.owner).toMatch(/Alvarado Holdings LLC/)
      expect(matter.notices).not.toMatch(/MISSED/)
      expect(matter.affidavit).not.toMatch(/MISSED|lien gone/)
      expect(grid.find((g) => g.job.startsWith('1063'))!.notices).toBe('none needed (with the owner)')
      expect(book.gcs.map((g) => g.name)).toEqual(['Brazos Ridge Contracting', 'Hill Country Builders'])
      // The grid opens on Something due: the repipe's affidavit copy is always due to be served.
      expect(book.counts.due).toBeGreaterThan(0)
      expect(book.rows.find((r) => r.jobId === 'sample-book-job-repipe')?.lens).toBe('due')
    })
  }

  it('reads the statutory 15th as the client’s lien clock does', () => {
    for (const ymd of ['2026-01-31', '2026-02-28', '2026-06-01', '2026-11-30', '2027-12-15', '2028-02-29']) {
      for (const n of [2, 3, 4]) expect(sampleStatutoryFifteenth(ymd, n)).toBe(statutoryFifteenth(ymd, n))
    }
  })
})
