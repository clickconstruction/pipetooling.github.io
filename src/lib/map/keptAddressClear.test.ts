import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  KEPT_ADDRESS_CLEARED,
  KEPT_ADDRESS_NOT_SOURCES,
  KEPT_ADDRESS_SOURCES,
  keptAddressClearConfirm,
  keptAddressClearDrawn,
  keptAddressClearProblem,
  keptAddressLikePattern,
  keptAddressSearchPattern,
  keptAddressSearchProblem,
  keptAddressStreetLine,
  type KeptAddressSource,
} from './keptAddressClear'

const source = (table: string, column: string): KeptAddressSource => KEPT_ADDRESS_SOURCES.find((s) => s.table === table && s.column === column)!
const KEY = '1 tset street, austin, tx'

describe('keptAddressClearDrawn', () => {
  it('draws the block for a dev and for no other role', () => {
    expect(keptAddressClearDrawn('dev')).toBe(true)
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', '', null, undefined]) expect(keptAddressClearDrawn(role)).toBe(false)
  })
})

describe('the street line and its pattern', () => {
  it('reads the words before the first comma, one space between', () => {
    expect(keptAddressStreetLine(KEY)).toBe('1 tset street')
    expect(keptAddressStreetLine('  208   juniper bend ')).toBe('208 juniper bend')
    expect(keptAddressStreetLine('')).toBe('')
  })
  it('finds the line inside any address: each word in order, anything between and around', () => {
    expect(keptAddressLikePattern(KEY)).toBe('%1%tset%street%')
    expect(keptAddressLikePattern('208 juniper bend')).toBe('%208%juniper%bend%')
  })
  it('matches a wildcard typed in an address as itself', () => {
    expect(keptAddressLikePattern('100% main_st road, alder, tx')).toBe('%100\\%%main\\_st%road%')
  })
  it('gives no pattern for a line too short to tell apart, or with no letter or no digit', () => {
    for (const short of ['1 a', '12345', 'main street', '', ', austin, tx', '9 st']) expect(keptAddressLikePattern(short)).toBeNull()
  })
})

describe('keptAddressClearProblem', () => {
  it('lets an address go when no record holds its street line', () => {
    expect(keptAddressClearProblem(KEY, [])).toBe('')
    expect(keptAddressClearProblem(KEY, [{ source: source('jobs_ledger', 'job_address'), count: 0 }])).toBe('')
  })
  it('keeps an address a record is written under, and names every kind with its count', () => {
    expect(keptAddressClearProblem(KEY, [{ source: source('jobs_ledger', 'job_address'), count: 1 }])).toBe('Its street line is written on 1 job. It stays.')
    expect(
      keptAddressClearProblem(KEY, [
        { source: source('jobs_ledger', 'job_address'), count: 2 },
        { source: source('bids', 'address'), count: 0 },
        { source: source('customers', 'address'), count: 1 },
        { source: source('estimates', 'for_address'), count: 3 },
      ]),
    ).toBe('Its street line is written on 2 jobs, 1 customer and 3 estimates. It stays.')
  })
  it('keeps an address on each kind of record the brief names: an estimate, a customer, a GC company, a legal matter, the office', () => {
    for (const [table, column] of [
      ['estimates', 'for_address'],
      ['customers', 'address'],
      ['customer_addresses', 'address'],
      ['gc_companies', 'address'],
      ['legal_matter_people', 'mailing_address'],
      ['app_settings', 'value_text'],
      ['bids', 'address'],
    ] as const) {
      expect(keptAddressClearProblem(KEY, [{ source: source(table, column), count: 1 }])).toMatch(/^Its street line is written on 1 .+\. It stays\.$/)
    }
  })
  it('never clears on records that could not be read', () => {
    expect(keptAddressClearProblem(KEY, null)).toBe('The records could not be read, so nobody knows what is written under this address. Nothing was cleared.')
  })
  it('never clears an address too short to check, whatever was read', () => {
    expect(keptAddressClearProblem('9 st', [])).toBe('This address is too short to tell apart from the others. It stays.')
  })
})

describe('the sources against the database', () => {
  // The generated types are the list of what the database holds. A new column with address in its name fails here
  // until it is listed as a source or named as left out, so the rule cannot fall behind the schema unseen.
  const lines = readFileSync(resolve(process.cwd(), 'src/types/database.ts'), 'utf8').split('\n')
  const columns: string[] = []
  let table: string | null = null
  let section = ''
  let inRow = false
  for (const line of lines) {
    const head = /^    (Tables|Views|Functions|Enums|CompositeTypes): \{$/.exec(line)
    if (head) {
      section = head[1]!
      continue
    }
    if (section !== 'Tables') continue
    const t = /^      (\w+): \{$/.exec(line)
    if (t) {
      table = t[1]!
      inRow = false
      continue
    }
    if (/^        Row: \{$/.test(line)) {
      inRow = true
      continue
    }
    if (/^        \}/.test(line)) {
      inRow = false
      continue
    }
    const c = inRow && table ? /^          (\w+): string( \| null)?$/.exec(line) : null
    if (c && table && c[1]!.includes('address') && !/normalized|_id$|email|ip_address/.test(c[1]!)) columns.push(`${table}.${c[1]}`)
  }
  const listed = new Set(KEPT_ADDRESS_SOURCES.map((s) => `${s.table}.${s.column}`))
  const leftOut = new Set(KEPT_ADDRESS_NOT_SOURCES)

  it('reads the generated types', () => {
    expect(columns.length).toBeGreaterThan(15)
    expect(columns).toContain('jobs_ledger.job_address')
  })
  it('lists every address column the database holds, or names it as left out', () => {
    expect(columns.filter((c) => !listed.has(c) && !leftOut.has(c))).toEqual([])
  })
  it('lists no column the database does not hold', () => {
    const all = new Set(columns)
    expect([...listed].filter((c) => c !== 'app_settings.value_text' && !all.has(c))).toEqual([])
    expect([...leftOut].filter((c) => !all.has(c))).toEqual([])
  })
  it('lists no column twice, and gives each its words for one and for several', () => {
    expect(listed.size).toBe(KEPT_ADDRESS_SOURCES.length)
    for (const s of KEPT_ADDRESS_SOURCES) {
      expect(s.one).toMatch(/^1 /)
      expect(s.many).toContain('{n}')
    }
  })
})

describe('the search and the words', () => {
  it('asks for three letters before it reads the cache', () => {
    expect(keptAddressSearchProblem(' ts ')).toBe('Type 3 letters or more of the address.')
    expect(keptAddressSearchProblem('tse')).toBe('')
  })
  it('reads the cache for the typed words in order', () => {
    expect(keptAddressSearchPattern('  tset   street ')).toBe('%tset%street%')
    expect(keptAddressSearchPattern('50%')).toBe('%50\\%%')
  })
  it('names the act on the confirm button, never OK, and reads the address back', () => {
    expect(keptAddressClearConfirm(KEY)).toEqual({
      title: 'Clear this kept address?',
      message: '1 tset street, austin, tx. No record holds its street line. The map looks it up again the next time anyone types it.',
      confirmLabel: 'Clear the address',
    })
    expect(KEPT_ADDRESS_CLEARED).toBe('The kept address was cleared.')
  })
})
