import { describe, expect, it } from 'vitest'
import { lienFootBlockedSentence, buildLienDeskGates, lienSentGatesFold, lienGateMark, lienGateMonthLine, ownerSourceWords, propertyKindClockWords, propertyKindLine, propertyKindRuleWords, propertyKindSwitchWarning, sharedWithWords, type LienDeskGatesInput, lienAffidavitFootBlockedSentence, lienAffidavitGateShortWords, lienGateShortWords } from './lienDeskGates'

const clear: LienDeskGatesInput = {
  ownerName: 'Sablow Texas Holdings Lp',
  ownerMailingAddress: '18500 Von Karman Ave Ste 550, Irvine, CA 92612',
  gcName: 'TF Halden',
  gcAddress: '',
  propertyKind: 'non_residential',
  county: 'Comal',
  monthLabels: ['Jul'],
  pickedMonthsCount: 1,
  pendingSessions: 0,
}

describe('buildLienDeskGates', () => {
  it('keeps the four gates in their fixed slots', () => {
    const { gates } = buildLienDeskGates(clear)
    expect(gates.map((g) => [g.n, g.key])).toEqual([[1, 'owner'], [2, 'gc'], [3, 'kind'], [4, 'months']])
  })

  it('all clear reads ready, with the names as the values', () => {
    const { gates, verdict } = buildLienDeskGates(clear)
    expect(verdict).toEqual({ ready: true, blockers: 0, checks: 0, headline: 'Ready to go out', summary: 'All 4 clear' })
    expect(gates.map((g) => g.value)).toEqual(['Sablow Texas Holdings Lp', 'TF Halden', 'Commercial · Comal', 'Jul'])
  })

  it('a missing owner blocks; an unknown property kind is only a check', () => {
    const { gates, verdict } = buildLienDeskGates({ ...clear, ownerName: '', ownerMailingAddress: '', propertyKind: null })
    expect(gates[0]).toMatchObject({ tone: 'blocker', value: 'Missing' })
    expect(gates[2]).toMatchObject({ tone: 'check', value: 'Unknown' })
    expect(verdict).toMatchObject({ ready: false, blockers: 1, checks: 1, headline: "Can't go out yet", summary: '1 blocker · 1 to check' })
  })

  it('an unknown property kind alone still goes out', () => {
    const { verdict } = buildLienDeskGates({ ...clear, propertyKind: '' })
    expect(verdict).toMatchObject({ ready: true, headline: 'Ready to go out', summary: '1 to check' })
  })

  it('an owner with no mailing address, a public owner, no GC and no month each block', () => {
    expect(buildLienDeskGates({ ...clear, ownerMailingAddress: ' ' }).gates[0]).toMatchObject({ tone: 'blocker', value: 'No mailing address' })
    expect(buildLienDeskGates({ ...clear, ownerName: 'City of New Braunfels' }).gates[0]).toMatchObject({ tone: 'blocker', value: 'Public property' })
    expect(buildLienDeskGates({ ...clear, gcName: '' }).gates[1]).toMatchObject({ tone: 'blocker', value: 'No GC on the job' })
    const none = buildLienDeskGates({ ...clear, gcName: '', pickedMonthsCount: 0 })
    expect(none.gates[3]).toMatchObject({ tone: 'blocker', value: 'No month picked' })
    expect(none.verdict.summary).toBe('2 blockers')
  })

  it('residential names its clock and pending sessions ride in the months tooltip', () => {
    const { gates } = buildLienDeskGates({ ...clear, propertyKind: 'residential', county: '', pendingSessions: 2 })
    expect(gates[2]).toMatchObject({ value: 'Residential', title: 'Residential — the 2nd-month clock' })
    expect(gates[3]?.title).toBe('2 sessions awaiting approval not counted')
  })

  it('marks', () => {
    expect([lienGateMark('ok'), lienGateMark('blocker'), lienGateMark('check')]).toEqual(['✓', '✗', '!'])
  })
})

describe('the sections under the gates (v2.3670)', () => {
  it('gate 3 names the clock the kind sets, and keeps the caveat while it is unknown', () => {
    expect(propertyKindClockWords('non_residential', 'Comal')).toBe("Commercial · Comal County — each month's notice is due by the 15th of the 3rd month after the work.")
    expect(propertyKindClockWords('residential', '')).toBe("Residential — each month's notice is due by the 15th of the 2nd month after the work.")
    // A kind not set dates as residential, the earlier month, and still asks for the kind (v2.5031).
    expect(propertyKindClockWords('', 'Comal')).toBe('Not set — residential dates shown, the earlier ones; a commercial property is a month later. Set the kind.')
  })

  it('gate 1 says where a filed owner came from', () => {
    expect(ownerSourceWords('property_record')).toBe('From the property record · every job here uses it.')
    expect(ownerSourceWords('job_override')).toBe('Set on this job · the property record’s owner is not used here.')
    expect(ownerSourceWords('none')).toBe('')
  })

  it('gate 4 reads one line per month, with the crew when it is known', () => {
    expect(lienGateMonthLine('Jul 2026', 5.2, '1 person · 2 days')).toBe('Jul 2026 · 5.2 approved hours · 1 person · 2 days')
    expect(lienGateMonthLine('Aug 2026', 1, '')).toBe('Aug 2026 · 1 approved hour')
  })
})

describe('a job with no clock hours is dated from its creation month (v2.3747)', () => {
  it('the months gate says so instead of "Approved hours", and still clears', () => {
    const { gates, verdict } = buildLienDeskGates({ ...clear, monthLabels: ['Aug'], datedFromCreation: true })
    expect(gates[3]).toMatchObject({ key: 'months', label: 'Dated from creation', value: 'Aug', tone: 'ok' })
    expect(gates[3]!.title).toContain('dated from the job’s creation · no clock hours')
    expect(verdict.ready).toBe(true)
    expect(buildLienDeskGates({ ...clear, pickedMonthsCount: 0, datedFromCreation: true }).gates[3]).toMatchObject({ label: 'Dated from creation', tone: 'blocker' })
  })

  it('gate 3 as one line (v2.4718): the kind and county, the rule under it, the warning while the chooser is open, and who shares the record', () => {
    expect(propertyKindLine('residential', 'Bexar')).toBe('Residential · Bexar County')
    expect(propertyKindLine('non_residential', '')).toBe('Commercial')
    expect(propertyKindLine('', 'Comal')).toBe('Not set · Comal County')
    expect(propertyKindRuleWords('residential')).toBe('Notice due the 15th of the 2nd month after the work')
    expect(propertyKindRuleWords('non_residential')).toBe('Notice due the 15th of the 3rd month after the work')
    expect(propertyKindSwitchWarning('residential')).toBe('Commercial makes each notice due the 15th of the 3rd month after the work, and the affidavit a month later. Every date on the job moves.')
    expect(propertyKindSwitchWarning('non_residential')).toMatch(/^Residential makes each notice due the 15th of the 2nd month/)
    expect(sharedWithWords(['273', '866', '1009', '858'])).toBe('shared with 273, 866, 1009, 858')
    expect(sharedWithWords([])).toBe('')
  })
})

describe('lienFootBlockedSentence (v2.4797)', () => {
  it('says the stop and the one thing to do, for each gate', () => {
    expect(lienFootBlockedSentence({ key: 'owner', value: 'Missing', label: 'Owner of record', n: 1 }, 2)).toBe("Don't send yet. Enter the owner of record and a mailing address on the property record first.")
    expect(lienFootBlockedSentence({ key: 'owner', value: 'No mailing address', label: 'Owner of record', n: 1 }, 2)).toBe("Don't send yet. Add the owner's mailing address on the property record first.")
    expect(lienFootBlockedSentence({ key: 'owner', value: 'Public property', label: 'Owner of record', n: 1 }, 2)).toContain('public property, so no lien notice can go')
    expect(lienFootBlockedSentence({ key: 'gc', value: 'No GC on the job', label: 'Original contractor', n: 2 }, 2)).toBe("Don't send yet. Set the GC on the job first.")
    expect(lienFootBlockedSentence({ key: 'months', value: 'No month picked', label: 'Approved hours', n: 4 }, 0)).toBe("Don't send yet. Pick at least one month first.")
    expect(lienFootBlockedSentence(null, 0)).toBe("Don't send yet. Pick at least one month first.")
    expect(lienFootBlockedSentence(null, 1)).toBe("Don't send yet. Clear what the gates show first.")
  })

  it('the stop window’s hold chip and the affidavit’s hold sentence (v2.4806)', () => {
    expect(lienGateShortWords({ key: 'owner', value: 'Missing', label: 'Owner of record' })).toBe('owner of record missing')
    expect(lienGateShortWords({ key: 'owner', value: 'No mailing address', label: 'Owner of record' })).toBe('owner has no mailing address')
    expect(lienGateShortWords({ key: 'gc', value: 'No GC on the job', label: 'Original contractor' })).toBe('no GC on the job')
    expect(lienGateShortWords({ key: 'months', value: 'No month picked', label: 'Approved hours' })).toBe('no month picked')
    expect(lienGateShortWords({ key: 'kind', value: 'Unknown', label: 'Property kind' })).toBe('property kind unknown')
    expect(lienAffidavitFootBlockedSentence({ key: 'owner', label: '' })).toBe("Don't file yet. Enter the owner of record and a mailing address on the property record first.")
    expect(lienAffidavitFootBlockedSentence({ key: 'legal', label: '' })).toBe("Don't file yet. Add the county and the legal description on the property record first.")
    expect(lienAffidavitFootBlockedSentence({ key: 'notice', label: '' })).toBe("Don't file yet. Send the § 53.056 notice first. A late one counts while this window is open.")
    expect(lienAffidavitFootBlockedSentence({ key: 'homestead', label: '' })).toContain('§ 53.254')
    expect(lienAffidavitFootBlockedSentence({ key: 'contractor', label: '' })).toBe("Don't file yet. Add the general contractor's address on its customer record first.")
    expect(lienAffidavitGateShortWords({ key: 'contractor' })).toBe('no address for the general contractor')
    expect(lienAffidavitFootBlockedSentence({ key: 'homestead_answer', label: '' })).toBe("Don't file yet. Answer whether this home is the owner's homestead on the property record first.")
    expect(lienAffidavitGateShortWords({ key: 'homestead_answer' })).toBe('homestead question not answered')
    expect(lienAffidavitFootBlockedSentence({ key: 'public_owner', label: '' })).toBe("Don't file yet. This is public property, so no lien can be filed. Ask the attorney about the payment bond.")
    expect(lienAffidavitGateShortWords({ key: 'public_owner' })).toBe('public property')
    // The notice's own gate asks every name too (punch list #314): the printed name can be an attention line.
    expect(buildLienDeskGates({ ...clear, ownerName: 'ATTN REAL ESTATE MANAGER', ownerIsPublic: true }).gates[0]).toMatchObject({ value: 'Public property', tone: 'blocker' })
    expect(buildLienDeskGates({ ...clear, ownerName: 'ATTN REAL ESTATE MANAGER' }).gates[0]).toMatchObject({ tone: 'ok' })
    expect(buildLienDeskGates({ ...clear, ownerName: 'City of Sample', ownerIsPublic: undefined }).gates[0]).toMatchObject({ value: 'Public property' })
    expect(lienAffidavitFootBlockedSentence(null)).toBe("Don't file yet. Clear what the gates show first.")
    expect(lienAffidavitGateShortWords({ key: 'legal' })).toBe('county or legal description missing')
  })
})

describe('the fifth gate: nothing billed (v2.4969)', () => {
  it('is drawn only when the sent bills owe nothing and money is still on the job', () => {
    expect(buildLienDeskGates({ ...clear, billedOpen: 4_000, unbilled: 1_000 }).gates.map((g) => g.key)).toEqual(['owner', 'gc', 'kind', 'months'])
    expect(buildLienDeskGates({ ...clear, billedOpen: 0, unbilled: 0 }).gates).toHaveLength(4)
    expect(buildLienDeskGates(clear).gates).toHaveLength(4)
    const { gates, verdict } = buildLienDeskGates({ ...clear, billedOpen: 0, unbilled: 6_400, sentBills: 0 })
    expect(gates[4]).toMatchObject({ n: 5, key: 'billed', label: 'Nothing billed', value: 'Bill the work first', tone: 'blocker' })
    expect(gates[4]!.title).toMatch(/No bill has gone out/)
    expect(verdict).toMatchObject({ ready: false, blockers: 1, headline: "Can't go out yet", summary: '1 blocker' })
    expect(buildLienDeskGates({ ...clear, billedOpen: 0, unbilled: 1_000, sentBills: 2 }).gates[4]!.title).toMatch(/sent bills are paid/)
  })

  it('the footer sentence and the stop chip name it', () => {
    const gate = buildLienDeskGates({ ...clear, billedOpen: 0, unbilled: 6_400 }).gates[4]!
    expect(lienFootBlockedSentence(gate, 1)).toBe("Don't send yet. Bill the work first. A notice claims what is billed.")
    expect(lienGateShortWords(gate)).toBe('nothing billed')
  })
})

describe('gate 4 on a job with no month at all (v2.6384, job 890 after its windows closed)', () => {
  it('says No month open, not No month picked, and its words say why', () => {
    const { gates, verdict } = buildLienDeskGates({ ...clear, monthLabels: [], pickedMonthsCount: 0, monthsOnJob: 0 })
    expect(gates[3]).toMatchObject({ key: 'months', tone: 'blocker', value: 'No month open', label: 'Approved hours' })
    expect(gates[3]!.title).toMatch(/every month’s window has closed/i)
    expect(verdict.ready).toBe(false)
    expect(lienGateShortWords(gates[3]!)).toBe('no month open')
    expect(lienFootBlockedSentence(gates[3]!, 0)).toBe("Don't send yet. Every month’s window has closed, so no new notice can name a month.")
  })
  it('with months on the job and none ticked, it still asks for the tick, dated-from-creation label and all', () => {
    expect(buildLienDeskGates({ ...clear, monthLabels: ['Jul'], pickedMonthsCount: 0, monthsOnJob: 1 }).gates[3]).toMatchObject({ value: 'No month picked', label: 'Approved hours' })
    expect(buildLienDeskGates({ ...clear, monthLabels: ['Jul'], pickedMonthsCount: 0, monthsOnJob: 1, datedFromCreation: true }).gates[3]).toMatchObject({ value: 'No month picked', label: 'Dated from creation' })
    expect(buildLienDeskGates({ ...clear, monthLabels: [], pickedMonthsCount: 0 }).gates[3]).toMatchObject({ value: 'No month picked' })
    expect(lienGateShortWords({ key: 'months', value: 'No month picked', label: 'Approved hours' })).toBe('no month picked')
  })
})

describe('lienSentGatesFold — the gates as one line on a sent notice (v2.6625, punch list #248)', () => {
  const monthShort = (k: string) => ({ '2026-07': 'Jul', '2026-08': 'Aug' })[k] ?? k
  it('reads the day it went, then the owner, the GC, the kind and the months the notice named, with no verdict', () => {
    const { gates } = buildLienDeskGates({ ...clear, ownerName: 'Karrow Ulric', gcName: 'RLC- Dunmere Mallin', propertyKind: 'residential', county: 'Bexar', monthLabels: [], pickedMonthsCount: 0, monthsOnJob: 0 })
    const fold = lienSentGatesFold({ sentOn: 'Oct 14', gates, noticeMonths: ['2026-07', '2026-08'], monthShort })
    expect(fold.head).toBe('Sent Oct 14')
    expect(fold.line).toBe('Sent Oct 14 · Karrow Ulric · RLC- Dunmere Mallin · Residential · Bexar · Jul + Aug')
    expect(fold.rows.map((r) => [r.n, r.label, r.value])).toEqual([
      [1, 'Owner of record', 'Karrow Ulric'],
      [2, 'Original contractor', 'RLC- Dunmere Mallin'],
      [3, 'Property kind', 'Residential · Bexar'],
      [4, 'Months the notice named', 'Jul + Aug'],
    ])
  })
  it('a gate that is not clear reads in plain words, never as a blocker: the paper already went', () => {
    const { gates } = buildLienDeskGates({ ...clear, ownerName: '', ownerMailingAddress: '', gcName: '', propertyKind: '', monthLabels: [], pickedMonthsCount: 0, monthsOnJob: 0 })
    const fold = lienSentGatesFold({ sentOn: 'Oct 14', gates, noticeMonths: [], monthShort })
    expect(fold.line).toBe('Sent Oct 14 · owner not on file · no GC on the job · kind unknown · no month named')
    expect(lienSentGatesFold({ sentOn: 'Oct 14', gates: buildLienDeskGates({ ...clear, ownerMailingAddress: '' }).gates, noticeMonths: ['2026-07'], monthShort }).rows[0]!.value).toBe('no mailing address')
  })
})
