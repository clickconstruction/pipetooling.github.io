import { describe, expect, it } from 'vitest'
import {
  fileLooksCutShort,
  GONE_KEPT_DAYS,
  isLeftOff,
  nameKeyOf,
  ownPlumbingNumbers,
  parseCsv,
  planRollPull,
  pullErrorWords,
  rollNumberKey,
  rowChanges,
  TSBPE_FILES,
  TSBPE_OWN_ONLY_FILES,
  TSBPE_WEEKLY_FILES,
  tsbpeFile,
  tsbpeRows,
  ymdFromUsDate,
  zip5,
  type KeptRow,
  type RollRow,
} from '../../../supabase/functions/_shared/licenseRoll'

// Every person, number and company here is made up. The repo is public: no line of a real state file goes in a test.
const JP = tsbpeFile('JP')!
const RMP = tsbpeFile('RMP')!

const JP_HEAD = 'RANK,LICENSE_NBR,LIC_STATUS,LICENSE_DATE,EXPIRATION_DTE,LAST_NAME,FIRST_NAME,MIDDLE_NAME,SUFFIX,ZIP,COUNTY,MEDGAS_ENDR,MRF_ENDR,WS_ENDR'
const JP_TEXT = [
  JP_HEAD,
  'J,000412,Current,11/12/2026,08/31/2027,FENWICK,MARLON,T,,78130,COMAL,Yes,No,No',
  'J,000209,Expired,03/04/2012,06/30/2026,QUILL,TEODORO,,JR,78666-1234,HAYS,No,No,Yes',
  'J,000355,Current,01/01/1901,03/31/2027,"ROCHE, BETTINA",BETTINA,ANN,,78748,TRAVIS,No,No,No',
  'J,000777,Current,05/05/2020,02/28/2027,HARROW,INES,,,77002,HARRIS,No,No,No',
  '',
].join('\r\n')

function row(over: Partial<RollRow> = {}): RollRow {
  return {
    source: 'tsbpe',
    trade: 'plumbing',
    license_class: 'journeyman',
    license_number: '000412',
    status: 'current',
    licensed_on: '2026-11-12',
    expires_on: '2027-08-31',
    last_name: 'FENWICK',
    first_name: 'MARLON',
    middle_name: 'T',
    suffix: '',
    name_key: 'fenwick|marlon|t|78130',
    zip: '78130',
    county: 'COMAL',
    endorsements: ['medical_gas'],
    company: '',
    insurance_ends_on: null,
    ...over,
  }
}
function kept(over: Partial<KeptRow> = {}): KeptRow {
  return { ...row(), id: 'kept-1', ours: false, gone_on: null, ...over }
}
const OURS_COUNTIES = new Set(['BEXAR', 'TRAVIS', 'HAYS', 'COMAL', 'GUADALUPE'])
const NOBODY = { numbers: new Set<string>(), nameKeys: new Set<string>() }
function ids() {
  let n = 0
  return () => `new-${++n}`
}
function plan(over: Partial<Parameters<typeof planRollPull>[0]> = {}) {
  return planRollPull({ rows: [], kept: [], counties: OURS_COUNTIES, ours: new Set(), leftOff: NOBODY, today: '2026-11-23', newId: ids(), ...over })
}

describe('the board’s files', () => {
  it('names five files, and the weekly pull reads the four that are not apprentices', () => {
    expect(TSBPE_FILES.map((f) => f.file)).toEqual(['RMP', 'MP', 'JP', 'TP', 'PA'])
    expect(TSBPE_WEEKLY_FILES).toEqual(['RMP', 'MP', 'JP', 'TP'])
    expect(tsbpeFile(' jp ')?.license_class).toBe('journeyman')
    expect(tsbpeFile('XX')).toBeNull()
    expect(TSBPE_FILES.every((f) => f.url.startsWith('https://tsbpe.texas.gov/'))).toBe(true)
  })
})

describe('parseCsv', () => {
  it('reads quoted cells with commas, doubled quotes and line breaks, and skips a blank line', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n\n"two\nlines",z')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['two\nlines', 'z'],
    ])
  })
  it('drops a byte order mark and keeps an empty last cell', () => {
    expect(parseCsv('﻿a,b\n1,')).toEqual([
      ['a', 'b'],
      ['1', ''],
    ])
  })
})

describe('the small readers', () => {
  it('reads a US date, and refuses a blank, a day that is not one and the board’s 1901 placeholder', () => {
    expect(ymdFromUsDate('11/12/2026')).toBe('2026-11-12')
    expect(ymdFromUsDate('2/3/2019')).toBe('2019-02-03')
    expect(ymdFromUsDate('')).toBeNull()
    expect(ymdFromUsDate('02/30/2026')).toBeNull()
    expect(ymdFromUsDate('01/01/1901')).toBeNull()
  })
  it('takes five digits of a ZIP', () => {
    expect(zip5('78666-1234')).toBe('78666')
    expect(zip5('n/a')).toBe('')
  })
  it('keys a name the same however it is cased or punctuated', () => {
    expect(nameKeyOf('O’BRIEN-Lund', 'Silas', 'james', '78130-0001')).toBe('obrienlund|silas|j|78130')
    expect(nameKeyOf('obrien lund', 'SILAS', 'J.', '78130')).toBe('obrienlund|silas|j|78130')
  })
})

describe('tsbpeRows', () => {
  it('reads a journeyman file into rows', () => {
    const read = tsbpeRows(JP, JP_TEXT)
    expect(read.seen).toBe(4)
    expect(read.skipped).toBe(0)
    expect(read.rows[0]).toEqual(row())
    expect(read.rows[1]).toMatchObject({ license_number: '000209', status: 'expired', licensed_on: '2012-03-04', expires_on: '2026-06-30', suffix: 'JR', zip: '78666-1234', name_key: 'quill|teodoro||78666', county: 'HAYS', endorsements: ['water_supply'] })
  })
  it('keeps no licensed day when the board has none on file', () => {
    expect(tsbpeRows(JP, JP_TEXT).rows[2]).toMatchObject({ last_name: 'ROCHE, BETTINA', licensed_on: null })
  })
  it('reads the company and the insurance day off a responsible master', () => {
    const text = [
      'RANK,LICENSE_NBR,LIC_STATUS,LICENSE_DATE,EXPIRATION_DTE,LAST_NAME,FIRST_NAME,MIDDLE_NAME,SUFFIX,ADDR1,ADDR2,ADDR3,CITY,STATE,ZIP,PHONE,COUNTY,MEDGAS_ENDR,MRF_ENDR,WS_ENDR,INS_EXPIRY_DTE,PLUMB_COMPANY,INSURANCE_COMPANY,AGENT_PHONE',
      'M,000044,Current,06/01/2009,05/31/2027,PRUETT,HARLAN,,,12 Sample Rd,,,Seguin,TX,78155,8305550100,GUADALUPE,No,No,No,12/02/2026,PRUETT PLUMBING,Sample Mutual,830-555-0111',
    ].join('\n')
    const [r] = tsbpeRows(RMP, text).rows
    expect(r).toMatchObject({ license_class: 'responsible_master', company: 'PRUETT PLUMBING', insurance_ends_on: '2026-12-02', county: 'GUADALUPE', zip: '78155' })
    // The business address and phone are in the file and are not kept.
    expect(JSON.stringify(r)).not.toContain('Sample Rd')
    expect(JSON.stringify(r)).not.toContain('8305550100')
  })
  it('refuses a file whose layout changed, naming the column', () => {
    expect(() => tsbpeRows(JP, 'RANK,LICENSE_NBR,LAST_NAME\nJ,1,X')).toThrow('The board’s JP file has no LIC_STATUS column'.replace('’', "'"))
  })
  it('skips a line with no number, no name or a status it does not know, and a number met twice', () => {
    const text = [JP_HEAD, 'J,,Current,,,A,B,,,78130,COMAL,No,No,No', 'J,1,Current,,,,B,,,78130,COMAL,No,No,No', 'J,2,Revoked,,,A,B,,,78130,COMAL,No,No,No', 'J,3,Current,,,A,B,,,78130,COMAL,No,No,No', 'J,3,Expired,,,A,B,,,78130,COMAL,No,No,No'].join('\n')
    const read = tsbpeRows(JP, text)
    expect(read.rows.map((r) => r.license_number)).toEqual(['3'])
    expect(read.rows[0]!.status).toBe('current')
    expect(read.skipped).toBe(4)
  })
})

describe('rowChanges', () => {
  it('says nothing when nothing differs', () => {
    expect(rowChanges(kept(), row())).toEqual({ patch: {}, changes: [] })
  })
  it('reads a later expiry on a current license as renewed', () => {
    const d = rowChanges(kept({ expires_on: '2026-08-31' }), row())
    expect(d.patch).toEqual({ expires_on: '2027-08-31' })
    expect(d.changes).toEqual([{ kind: 'renewed', was: { expires_on: '2026-08-31' }, now_is: { expires_on: '2027-08-31' } }])
  })
  it('reads current to expired as lapsed, and back as current again, each once', () => {
    expect(rowChanges(kept(), row({ status: 'expired' })).changes.map((c) => c.kind)).toEqual(['lapsed'])
    const back = rowChanges(kept({ status: 'expired', expires_on: '2026-08-31' }), row())
    expect(back.changes.map((c) => c.kind)).toEqual(['current_again'])
    expect(back.patch).toEqual({ status: 'current', expires_on: '2027-08-31' })
  })
  it('reads a new county or ZIP as moved, and a ZIP+4 on the same ZIP as nothing to say', () => {
    expect(rowChanges(kept(), row({ county: 'HAYS', zip: '78666', name_key: 'fenwick|marlon|t|78666' })).changes).toEqual([{ kind: 'moved', was: { county: 'COMAL', zip: '78130' }, now_is: { county: 'HAYS', zip: '78666' } }])
    const plus4 = rowChanges(kept(), row({ zip: '78130-0001' }))
    expect(plus4.changes).toEqual([])
    expect(plus4.patch).toEqual({ zip: '78130-0001' })
  })
  it('reads an endorsement added and a name changed', () => {
    const d = rowChanges(kept(), row({ endorsements: ['medical_gas', 'water_supply'], last_name: 'FENWICK-ROCHE', name_key: 'fenwickroche|marlon|t|78130' }))
    expect(d.changes.map((c) => c.kind)).toEqual(['endorsement', 'named'])
    expect(d.patch).toMatchObject({ endorsements: ['medical_gas', 'water_supply'], last_name: 'FENWICK-ROCHE', name_key: 'fenwickroche|marlon|t|78130' })
  })
  it('keeps the insurance day in step with no line of history', () => {
    const d = rowChanges(kept({ insurance_ends_on: '2026-12-02' }), row({ insurance_ends_on: '2027-12-02' }))
    expect(d.changes).toEqual([])
    expect(d.patch).toEqual({ insurance_ends_on: '2027-12-02' })
  })
})

describe('planRollPull', () => {
  it('keeps a row of our counties on a first pull, as first seen, and leaves the rest', () => {
    const p = plan({ rows: tsbpeRows(JP, JP_TEXT).rows })
    expect(p.inserts.map((r) => r.license_number)).toEqual(['000412', '000209', '000355'])
    expect(p.inserts[0]).toMatchObject({ id: 'new-1', ours: false, first_seen_on: '2026-11-23', last_seen_on: '2026-11-23' })
    expect(p.changes.map((c) => [c.roll_id, c.kind])).toEqual([
      ['new-1', 'first_seen'],
      ['new-2', 'first_seen'],
      ['new-3', 'first_seen'],
    ])
    expect(p.counts).toEqual({ seen: 4, kept: 3, added: 3, changed: 0, gone: 0 })
    expect(p.markedGone).toBe(0)
  })
  it('keeps one of our own numbers whatever the county', () => {
    const p = plan({ rows: [row({ license_number: '000777', county: 'HARRIS' })], ours: new Set(['777']) })
    expect(p.inserts).toHaveLength(1)
    expect(p.inserts[0]!.ours).toBe(true)
  })
  it('never keeps a person left off, by number or by name, and takes off one already kept', () => {
    const byNumber = { numbers: new Set(['000412']), nameKeys: new Set<string>() }
    const byName = { numbers: new Set<string>(), nameKeys: new Set(['fenwick|marlon|t|78130']) }
    expect(isLeftOff(row(), byNumber)).toBe(true)
    expect(plan({ rows: [row()], leftOff: byNumber }).inserts).toEqual([])
    // A new rank is a new number: the name still holds.
    expect(plan({ rows: [row({ license_class: 'master', license_number: '000087' })], leftOff: byName }).inserts).toEqual([])
    const off = plan({ rows: [row()], kept: [kept()], leftOff: byName })
    expect(off.deletes).toEqual(['kept-1'])
    expect(off.changes).toEqual([])
    // Left off and gone from the file as well.
    expect(plan({ rows: [], kept: [kept()], leftOff: byNumber }).deletes).toEqual(['kept-1'])
  })
  it('stamps a kept row as seen and writes nothing more when it has not changed', () => {
    const p = plan({ rows: [row()], kept: [kept()] })
    expect(p).toMatchObject({ inserts: [], patches: [], changes: [], deletes: [], seenIds: ['kept-1'] })
    expect(p.counts).toEqual({ seen: 1, kept: 1, added: 0, changed: 0, gone: 0 })
  })
  it('patches a kept row that changed and says what a person would read', () => {
    const p = plan({ rows: [row({ status: 'expired' })], kept: [kept()] })
    expect(p.patches).toEqual([{ id: 'kept-1', patch: { status: 'expired' } }])
    expect(p.changes).toEqual([{ roll_id: 'kept-1', kind: 'lapsed', was: { status: 'current', expires_on: '2027-08-31' }, now_is: { status: 'expired', expires_on: '2027-08-31' } }])
    expect(p.counts.changed).toBe(1)
  })
  it('takes a kept row off when it moves out of our counties', () => {
    const p = plan({ rows: [row({ county: 'HARRIS' })], kept: [kept()] })
    expect(p.deletes).toEqual(['kept-1'])
    expect(p.counts).toMatchObject({ kept: 0, gone: 1 })
  })
  it('marks a row gone the first time the file lacks it, waits, then takes it off', () => {
    const first = plan({ rows: [], kept: [kept()] })
    expect(first.patches).toEqual([{ id: 'kept-1', patch: { gone_on: '2026-11-23' } }])
    expect(first.changes.map((c) => c.kind)).toEqual(['gone'])
    expect(first.deletes).toEqual([])
    expect(first.markedGone).toBe(1)

    const waiting = plan({ rows: [], kept: [kept({ gone_on: '2026-11-23' })], today: '2026-12-14' })
    expect(waiting).toMatchObject({ patches: [], changes: [], deletes: [], markedGone: 0 })

    const after = plan({ rows: [], kept: [kept({ gone_on: '2026-11-23' })], today: '2026-12-21' })
    expect(GONE_KEPT_DAYS).toBe(28)
    expect(after.deletes).toEqual(['kept-1'])
  })
  it('brings a gone row back when the file has it again', () => {
    const p = plan({ rows: [row()], kept: [kept({ gone_on: '2026-11-16' })] })
    expect(p.patches).toEqual([{ id: 'kept-1', patch: { gone_on: null } }])
    expect(p.changes).toEqual([{ roll_id: 'kept-1', kind: 'back', was: { gone_on: '2026-11-16' }, now_is: {} }])
    expect(p.counts.changed).toBe(1)
  })
  it('turns ours on and off with no line of history', () => {
    const on = plan({ rows: [row()], kept: [kept()], ours: new Set(['412']) })
    expect(on.patches).toEqual([{ id: 'kept-1', patch: { ours: true } }])
    expect(on.changes).toEqual([])
    expect(on.counts.changed).toBe(0)
  })
})

describe('our own people’s numbers', () => {
  it('compares a number as digits with no leading zeros, however it is written', () => {
    expect(rollNumberKey('000412')).toBe('412')
    expect(rollNumberKey('#412')).toBe('412')
    expect(rollNumberKey('J-00412')).toBe('412')
    expect(rollNumberKey(' 412 ')).toBe('412')
    expect(rollNumberKey('none')).toBe('')
    expect(rollNumberKey(null)).toBe('')
  })
  it('sorts our plumbing numbers by the class of file each would be found in', () => {
    const own = ownPlumbingNumbers([
      { trade: 'plumbing', cls: 'apprentice', number: '000901' },
      { trade: 'plumbing', cls: 'journeyman', number: '#412' },
      { trade: 'plumbing', cls: 'master', number: 'M-087' },
      { trade: 'plumbing', cls: 'tradesman', number: null },
      { trade: 'electrical', cls: 'journeyman', number: '555' },
      { trade: null, cls: null, number: '777' },
    ])
    expect([...own.apprentice!]).toEqual(['901'])
    expect([...own.journeyman!]).toEqual(['412'])
    // A master may be a responsible master, so the number is looked for in both files.
    expect([...own.master!]).toEqual(['87'])
    expect([...own.responsible_master!]).toEqual(['87'])
    expect(own.tradesman).toBeUndefined()
  })
  it('reads the apprentice file for our own numbers alone', () => {
    expect(TSBPE_OWN_ONLY_FILES).toEqual(['PA'])
    const apprentices = [row({ license_class: 'apprentice', license_number: '000901' }), row({ license_class: 'apprentice', license_number: '000902', name_key: 'voss|calder||78130' })]
    // No county is kept from this file: the one who stays is ours, though both live in Comal.
    const p = plan({ rows: apprentices, counties: new Set<string>(), ours: new Set(['901']) })
    expect(p.inserts.map((r) => [r.license_number, r.ours])).toEqual([['000901', true]])
    expect(p.counts).toMatchObject({ seen: 2, kept: 1, added: 1 })
  })
  it('takes one of ours off when the number is no longer ours and the county is not one we keep', () => {
    const p = plan({ rows: [row({ county: 'HARRIS' })], kept: [kept({ county: 'HARRIS', ours: true })] })
    expect(p.deletes).toEqual(['kept-1'])
  })
})

describe('the guards', () => {
  it('does not believe a file that would mark over a third of the kept rows gone', () => {
    expect(fileLooksCutShort(0, 0)).toBe(false)
    expect(fileLooksCutShort(20, 20)).toBe(false)
    expect(fileLooksCutShort(300, 100)).toBe(false)
    expect(fileLooksCutShort(300, 101)).toBe(true)
  })
  it('puts a failure in words, and never more than a few lines', () => {
    expect(pullErrorWords(new Error('The board answered 503.'))).toBe('The board answered 503.')
    expect(pullErrorWords({ message: 'refused' })).toBe('refused')
    expect(pullErrorWords(null)).toBe('The pull stopped without saying why.')
    expect(pullErrorWords('x'.repeat(900))).toHaveLength(400)
  })
})
