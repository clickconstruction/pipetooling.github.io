import { describe, expect, it } from 'vitest'
import { lienRunEnvelopePropertyLine, lienRunProperties, type LienRunPropertyDesk } from './lienRunEnvelopeProperty'

type NoticeEntry = LienRunPropertyDesk['notices'][number]
type AffidavitEntry = LienRunPropertyDesk['affidavits'][number]

const noticeEntry = (jobId: string, pile: NoticeEntry['pile'], over: Partial<NoticeEntry> = {}): NoticeEntry => ({ jobId, gcCustomerId: 'gc1', pile, earliestDeadline: null, item: null, sentItem: null, ...over })
const affidavitEntry = (jobId: string, pile: AffidavitEntry['pile'], over: Partial<AffidavitEntry> = {}): AffidavitEntry => ({
  jobId,
  isSub: true,
  pile,
  gates: [{ key: 'notice', ok: pile !== 'needs_notice', label: '' }],
  deadline: '2027-01-15',
  item: null,
  ...over,
})
const sentTo = (day: string) => [{ kind: 'notice_53_056', months_covered: ['2026-09'], sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: day }] }]

/** ZZ Test Kettle, one property record (`p1`) with six jobs, and a second property (`p2`) with two. */
const desk = (over: Partial<LienRunPropertyDesk> = {}): LienRunPropertyDesk => ({
  jobsById: {
    j1: { customer_address_id: 'p1', gc_customer_id: 'gc1' },
    j2: { customer_address_id: 'p1', gc_customer_id: 'gc1' },
    j3: { customer_address_id: 'p1', gc_customer_id: 'gc1' },
    j4: { customer_address_id: 'p1', gc_customer_id: 'gc1' },
    j5: { customer_address_id: 'p1', gc_customer_id: 'gc1' },
    j6: { customer_address_id: 'p1', gc_customer_id: 'gc1' },
    k1: { customer_address_id: 'p2', gc_customer_id: 'gc1' },
    k2: { customer_address_id: 'p2', gc_customer_id: 'gc1' },
    loose: { customer_address_id: null, gc_customer_id: 'gc1' },
  },
  addressesById: { p1: { address: '212 Kettle Dr, Sampleton, TX 78000' }, p2: { address: '9 Example St\nSampleton, TX 78000' } },
  notices: [noticeEntry('j1', 'ready'), noticeEntry('j2', 'sent'), noticeEntry('j3', 'sent'), noticeEntry('j4', 'sent'), noticeEntry('j5', 'sent'), noticeEntry('k1', 'ready'), noticeEntry('k2', 'awaiting'), noticeEntry('loose', 'ready')],
  affidavits: [affidavitEntry('j1', 'needs_notice'), affidavitEntry('j2', 'ready'), affidavitEntry('j3', 'ready'), affidavitEntry('j4', 'ready'), affidavitEntry('j5', 'ready'), affidavitEntry('j6', 'held'), affidavitEntry('k2', 'needs_notice')],
  filingsByJob: { j2: sentTo('2026-10-14'), j3: sentTo('2026-10-14'), j4: sentTo('2026-10-14'), j5: sentTo('2026-09-22'), j6: sentTo('2026-09-22') },
  ...over,
})

describe('lienRunProperties: the desk’s jobs by property record', () => {
  it('groups jobs by the property record they point at, with the record’s street, and leaves out a job with none', () => {
    const got = lienRunProperties(desk())
    expect([...got.keys()]).toEqual(['p1', 'p2'])
    expect(got.get('p1')!.street).toBe('212 Kettle Dr')
    expect(got.get('p2')!.street).toBe('9 Example St')
    expect(got.get('p1')!.jobs.map((j) => j.jobId)).toEqual(['j1', 'j2', 'j3', 'j4', 'j5', 'j6'])
  })

  it('a job’s notice reads as the whole-property view words it: its bin while live, else the day it went', () => {
    const p1 = lienRunProperties(desk()).get('p1')!
    const of = (id: string) => p1.jobs.find((j) => j.jobId === id)!
    expect(of('j1').notice).toMatchObject({ state: 'going', words: 'Approved · to print' })
    expect(of('j2').notice).toMatchObject({ state: 'sent', words: 'Notice sent Oct 14' })
    // j6 has no entry in the notices' queue: its recorded filing still says the day.
    expect(of('j6').notice).toMatchObject({ state: 'sent', words: 'Notice sent Sep 22', pile: null })
  })

  it('a sent pile with no filing in hand is on record with no day, never a guessed one', () => {
    const p1 = lienRunProperties(desk({ filingsByJob: {} })).get('p1')!
    expect(p1.jobs.find((j) => j.jobId === 'j2')!.notice).toMatchObject({ state: 'sent', words: 'Notice on record' })
  })

  it('with no affidavit row, a job with no GC needs no notice, as By job’s book reads it', () => {
    const got = lienRunProperties(desk({ jobsById: { o2: { customer_address_id: 'p9', gc_customer_id: null } }, notices: [noticeEntry('o2', 'sent', { gcCustomerId: null })], affidavits: [], filingsByJob: {} }))
    expect(got.get('p9')!.jobs[0]!.notice.state).toBe('none_needed')
  })

  it('a job contracted with the owner needs no notice, from its affidavit row', () => {
    const got = lienRunProperties(desk({ jobsById: { o1: { customer_address_id: 'p9', gc_customer_id: null } }, notices: [], affidavits: [affidavitEntry('o1', 'ready', { isSub: false })], filingsByJob: {} }))
    expect(got.get('p9')!.jobs[0]!.notice.state).toBe('none_needed')
    expect(got.get('p9')!.jobs[0]!.affidavit).toMatchObject({ state: 'ready', aside: 'last day Jan 15' })
  })

  it('an affidavit held by a closed gate names what is missing', () => {
    const got = lienRunProperties(desk({ affidavits: [affidavitEntry('j6', 'held', { item: { status: 'approved' } as AffidavitEntry['item'], gates: [{ key: 'legal', ok: false, label: '' }] })] }))
    expect(got.get('p1')!.jobs.find((j) => j.jobId === 'j6')!.affidavit).toMatchObject({ state: 'held', aside: 'missing legal' })
  })
})

describe('lienRunEnvelopePropertyLine: one line for the envelope', () => {
  const properties = lienRunProperties(desk())

  it('the owner’s envelope with one job says where the property’s other jobs stand, and counts its liens whole', () => {
    const line = lienRunEnvelopePropertyLine({ inside: [{ jobId: 'j1', propertyId: 'p1' }], properties })!
    expect(line.words).toBe('At this property: 1 notice in this envelope · 3 notices sent Oct 14 · 2 on Sep 22 · 4 lien affidavits ready to file · 1 held')
    expect(line.presses).toEqual([{ addressId: 'p1', label: 'See the property ›' }])
  })

  it('a contractor’s envelope that spans properties gets one line that totals them, with a press a property', () => {
    const line = lienRunEnvelopePropertyLine({ inside: [{ jobId: 'j1', propertyId: 'p1' }, { jobId: 'k1', propertyId: 'p2' }], properties })!
    expect(line.words).toBe('At these 2 properties: 2 notices in this envelope · 3 notices sent Oct 14 · 2 on Sep 22 · 1 awaiting approval · 4 lien affidavits ready to file · 1 waiting on a notice · 1 held')
    expect(line.presses).toEqual([
      { addressId: 'p1', label: 'See 212 Kettle Dr ›' },
      { addressId: 'p2', label: 'See 9 Example St ›' },
    ])
  })

  it('a job in the envelope with an affidavit of its own still counts in the property’s liens', () => {
    // j6 is on the desk by its affidavit alone, so with these two affidavits the desk holds five jobs here, not six.
    const withLien = lienRunProperties(desk({ affidavits: [affidavitEntry('j1', 'ready'), affidavitEntry('j2', 'ready')] }))
    expect(lienRunEnvelopePropertyLine({ inside: [{ jobId: 'j1', propertyId: 'p1' }], properties: withLien })!.words).toBe('At this property: 1 notice in this envelope · 3 notices sent Oct 14 · 1 on Sep 22 · 2 lien affidavits ready to file')
  })

  it('every job at the property inside the envelope: nothing to add, so no line', () => {
    expect(lienRunEnvelopePropertyLine({ inside: [{ jobId: 'k1', propertyId: 'p2' }, { jobId: 'k2', propertyId: 'p2' }], properties })).toBeNull()
  })

  it('a job with no property record, or a property the desk does not hold, adds no line and is not counted', () => {
    expect(lienRunEnvelopePropertyLine({ inside: [{ jobId: 'loose', propertyId: null }], properties })).toBeNull()
    expect(lienRunEnvelopePropertyLine({ inside: [{ jobId: 'x', propertyId: 'gone' }], properties })).toBeNull()
    const line = lienRunEnvelopePropertyLine({ inside: [{ jobId: 'j1', propertyId: 'p1' }, { jobId: 'loose', propertyId: null }], properties })!
    expect(line.words.startsWith('At this property: 1 notice in this envelope · ')).toBe(true)
  })

  it('a host that hands no properties gets no line', () => {
    expect(lienRunEnvelopePropertyLine({ inside: [{ jobId: 'j1', propertyId: 'p1' }], properties: null })).toBeNull()
  })

  it('a property with no street on its record is named by its place in the envelope', () => {
    const bare = lienRunProperties(desk({ addressesById: {} }))
    const line = lienRunEnvelopePropertyLine({ inside: [{ jobId: 'j1', propertyId: 'p1' }, { jobId: 'k1', propertyId: 'p2' }], properties: bare })!
    expect(line.presses.map((p) => p.label)).toEqual(['See property 1 ›', 'See property 2 ›'])
  })
})
