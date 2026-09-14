import { describe, expect, it } from 'vitest'
import {
  askableEntries,
  buildOpenJobAccountPayload,
  counterSentence,
  groupJobAccountStrip,
  openJobAccountCloseNote,
  openJobAccountRequestTitle,
  parseOpenJobAccountPayload,
  poMomentLine,
  stripHasOpen,
  stripSummary,
  telHref,
  type JobAccountStripRow,
} from './jobAccountStrip'

function row(overrides: Partial<JobAccountStripRow> & { job_id: string; supply_house_id: string; house_name: string }): JobAccountStripRow {
  return {
    policy: 'expects',
    account_id: null,
    status: null,
    account_ref: null,
    opened_via: null,
    opened_at: null,
    requested_at: null,
    requested_from_counter: null,
    account_note: null,
    rep_contact_id: null,
    rep_name: null,
    rep_phone: null,
    ...overrides,
  }
}

describe('groupJobAccountStrip', () => {
  it('groups per job, open first, then requested, then none, then not needed', () => {
    const map = groupJobAccountStrip([
      row({ job_id: 'j1', supply_house_id: 'reece', house_name: 'Reece' }),
      row({ job_id: 'j1', supply_house_id: 'moore', house_name: 'Moore Supply', status: 'not_needed', account_note: 'service call' }),
      row({ job_id: 'j1', supply_house_id: 'ferguson', house_name: 'Ferguson', status: 'open', account_ref: ' JA-4114 ', rep_contact_id: 'c1', rep_name: 'Curly Conley', rep_phone: '210-344-4950' }),
      row({ job_id: 'j1', supply_house_id: 'hughes', house_name: 'Hughes', policy: 'optional', status: 'requested', requested_from_counter: true }),
      row({ job_id: 'j2', supply_house_id: 'ferguson', house_name: 'Ferguson' }),
    ])
    const j1 = map.get('j1')!
    expect(j1.map((e) => `${e.houseName}:${e.state}`)).toEqual(['Ferguson:open', 'Hughes:requested', 'Reece:none', 'Moore Supply:not_needed'])
    expect(j1[0]!.accountRef).toBe('JA-4114')
    expect(j1[0]!.rep).toEqual({ id: 'c1', name: 'Curly Conley', phone: '210-344-4950' })
    expect(j1[1]!.requestedFromCounter).toBe(true)
    expect(j1[2]!.rep).toBeNull()
    expect(map.get('j2')!.map((e) => e.state)).toEqual(['none'])
  })

  it('summarises and reports open', () => {
    const map = groupJobAccountStrip([
      row({ job_id: 'j1', supply_house_id: 'ferguson', house_name: 'Ferguson', status: 'open' }),
      row({ job_id: 'j1', supply_house_id: 'reece', house_name: 'Reece' }),
    ])
    const entries = map.get('j1')!
    expect(stripSummary(entries)).toBe('Ferguson ✓ · Reece none yet')
    expect(stripHasOpen(entries)).toBe(true)
    expect(askableEntries(entries).map((e) => e.houseName)).toEqual(['Reece'])
  })
})

describe('counterSentence and telHref', () => {
  it('names the company, the property, and the reference', () => {
    expect(counterSentence({ companyName: 'Click Plumbing and Electrical', address: '4114 Pond Hill Rd, Bldg 2', accountRef: 'JA-4114' }))
      .toBe('Click Plumbing and Electrical · job account for 4114 Pond Hill Rd, Bldg 2 · ref JA-4114')
    expect(counterSentence({ companyName: '', address: null })).toBe('our company · job account for this property')
  })

  it('makes a tel href only from a real number', () => {
    expect(telHref('210-344-4950')).toBe('tel:2103444950')
    expect(telHref('(512) 360-0599')).toBe('tel:5123600599')
    expect(telHref('ext 12')).toBeNull()
    expect(telHref(null)).toBeNull()
  })
})

describe('poMomentLine', () => {
  const base = groupJobAccountStrip([
    row({ job_id: 'j1', supply_house_id: 'ferguson', house_name: 'Ferguson', rep_contact_id: 'c1', rep_name: 'Curly Conley', rep_phone: '210-344-4950' }),
    row({ job_id: 'j1', supply_house_id: 'reece', house_name: 'Reece', status: 'open', account_ref: 'R-88214', opened_via: 'phone', opened_at: '2026-09-14T18:00:00Z' }),
    row({ job_id: 'j1', supply_house_id: 'moore', house_name: 'Moore Supply', status: 'requested', requested_at: '2026-09-14T18:40:00Z', requested_from_counter: true }),
    row({ job_id: 'j1', supply_house_id: 'hughes', house_name: 'Hughes', status: 'not_needed', account_note: 'service call' }),
  ]).get('j1')!
  const by = (name: string) => base.find((e) => e.houseName === name)!

  it('says nothing for a house with no entry', () => {
    expect(poMomentLine(null, '964 · Pondhill demo')).toBeNull()
  })

  it('nudges amber with the rep when there is no account, offering every action', () => {
    const line = poMomentLine(by('Ferguson'), '964 · Pondhill demo')!
    expect(line.tone).toBe('amber')
    expect(line.text).toBe('No job account at Ferguson for 964 · Pondhill demo yet. Ferguson expects one per property. Curly Conley opens them: 210-344-4950.')
    expect([line.canCall, line.canMarkOpened, line.canSendPacket, line.canNotNeeded]).toEqual([true, true, true, true])
  })

  it('reads teal with the reference and how when open, no actions', () => {
    const line = poMomentLine(by('Reece'), 'x')!
    expect(line.tone).toBe('teal')
    expect(line.text).toContain('Reece job account open · ref R-88214 · ')
    expect(line.text).toContain('by phone')
    expect(line.canMarkOpened).toBe(false)
  })

  it('names the counter ask when requested, and the reason when not needed', () => {
    const asked = poMomentLine(by('Moore Supply'), 'x')!
    expect(asked.tone).toBe('amber')
    expect(asked.text).toContain('from the counter — not open yet')
    expect(asked.text).toContain('No job-accounts rep on file')
    const no = poMomentLine(by('Hughes'), 'x')!
    expect(no.tone).toBe('muted')
    expect(no.text).toBe('Hughes job account not needed · service call.')
    expect(no.canMarkOpened).toBe(true)
    expect(no.canNotNeeded).toBe(false)
  })
})

describe('the errand', () => {
  const houses = [
    { id: 'ferguson', name: 'Ferguson', repName: 'Curly Conley', repPhone: '210-344-4950' },
    { id: 'reece', name: 'Reece', repName: null, repPhone: null },
  ]

  it('builds and parses the payload, dropping junk', () => {
    const payload = buildOpenJobAccountPayload({ houses, fromCounter: true, note: '  rough-in for the slab  ' })
    expect(payload).toEqual({ supply_houses: houses, from_counter: true, note: 'rough-in for the slab' })
    expect(parseOpenJobAccountPayload(payload)).toEqual(payload)
    expect(parseOpenJobAccountPayload({ supply_houses: [{ id: '', name: 'x' }, 'junk', { id: 'a', name: 'A' }], from_counter: 'yes' }))
      .toEqual({ supply_houses: [{ id: 'a', name: 'A', repName: null, repPhone: null }], from_counter: false, note: '' })
    expect(parseOpenJobAccountPayload(null).supply_houses).toEqual([])
    expect(buildOpenJobAccountPayload({ houses: [], fromCounter: false, note: '' })).toBeNull()
  })

  it('titles the request and words the close', () => {
    expect(openJobAccountRequestTitle('964 · Pondhill demo', houses, true)).toBe('Open a job account at Ferguson, Reece for 964 · Pondhill demo — asked from the counter, buying now')
    expect(openJobAccountRequestTitle('964 · Pondhill demo', [], false)).toBe('Open a job account at the supply house for 964 · Pondhill demo')
    expect(openJobAccountCloseNote('Ferguson', 'open', 'JA-4114')).toBe('Ferguson job account open · ref JA-4114')
    expect(openJobAccountCloseNote('Ferguson', 'open', '')).toBe('Ferguson job account open.')
    expect(openJobAccountCloseNote('Ferguson', 'not_needed', '')).toBe('Ferguson job account not needed — see the job.')
  })
})
