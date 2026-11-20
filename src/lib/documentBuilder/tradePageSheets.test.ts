import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { INSURANCE_SHEET_FIXTURE } from './insuranceSheet.fixture'
import { layOver, startJobSheet } from './sheet'
import { TRADE_SHEET_WORDS, agentMailto, mustNameLine, tradeSheetWords, tradeSheetsFrom } from './tradePageSheets'

const SHEET = layOver(INSURANCE_SHEET_FIXTURE, startJobSheet({ name: 'Cedar Park Medical Office', place: '410 Sample Street', insured: ['Pecan Ridge Holdings, Ltd.'] }))
const row = (over: Record<string, unknown> = {}) => ({ sheetId: 's1', projectId: 'p1', job: 'Cedar Park Medical Office', revision: 2, sheet: JSON.parse(JSON.stringify(SHEET)), linkCode: 'abcdefgh23456789', opened: false, changed: true, ...over })

describe('the sheets out of the trade portal’s answer', () => {
  it('reads each sheet whole', () => {
    expect(tradeSheetsFrom({ sheets: [row()] })).toEqual([{ sheetId: 's1', projectId: 'p1', job: 'Cedar Park Medical Office', revision: 2, sheet: SHEET, linkCode: 'abcdefgh23456789', opened: false, changed: true }])
  })

  it('draws no block for an answer from before the sheets, and leaves out a sheet it cannot read', () => {
    expect(tradeSheetsFrom({ today: '2026-11-20', slice: {} })).toEqual([])
    expect(tradeSheetsFrom(null)).toEqual([])
    expect(tradeSheetsFrom({ sheets: 'none' })).toEqual([])
    expect(tradeSheetsFrom({ sheets: [row({ sheet: { co: 'Acme Plumbing' } }), row({ sheetId: 's2', linkCode: '' }), null] }).map((s) => [s.sheetId, s.linkCode])).toEqual([['s2', null]])
  })
})

describe('the words of the block', () => {
  it('says who the certificate must name, in both languages', () => {
    expect(mustNameLine('en', ['Pecan Ridge Holdings', 'Lone Oak Property Management'])).toBe('It must name Pecan Ridge Holdings and Lone Oak Property Management.')
    expect(mustNameLine('en', ['Pecan Ridge Holdings, Ltd.'])).toBe('It must name Pecan Ridge Holdings, Ltd.')
    expect(mustNameLine('es', ['Pecan Ridge Holdings', 'Lone Oak Property Management', 'Mesa Verde Partners'])).toBe('Debe nombrar a Pecan Ridge Holdings, Lone Oak Property Management y Mesa Verde Partners.')
    expect(mustNameLine('en', [' ', ''])).toBe('')
  })

  it('starts a mail to their insurance agent with the sheet’s own link, and none with no link', () => {
    const mail = agentMailto('en', { job: 'Cedar Park Medical Office', linkCode: 'abcdefgh23456789' }, 'https://app.example')
    expect(decodeURIComponent(mail ?? '')).toBe('mailto:?subject=Insurance requirements for Cedar Park Medical Office&body=This page says what my certificate of insurance must show on Cedar Park Medical Office. It needs no login: https://app.example/d/abcdefgh23456789')
    expect(agentMailto('en', { job: 'Cedar Park Medical Office', linkCode: null }, 'https://app.example')).toBeNull()
    expect(decodeURIComponent(agentMailto('es', { job: '', linkCode: 'abcdefgh23456789' }, 'https://app.example') ?? '')).toContain('en este trabajo')
  })

  it('has every word in both languages, in plain words', () => {
    for (const key of Object.keys(TRADE_SHEET_WORDS) as Array<keyof typeof TRADE_SHEET_WORDS>) {
      expect(TRADE_SHEET_WORDS[key].en.trim(), key).not.toBe('')
      expect(TRADE_SHEET_WORDS[key].es.trim(), key).not.toBe('')
    }
    const texts = (Object.keys(TRADE_SHEET_WORDS) as Array<keyof typeof TRADE_SHEET_WORDS>).flatMap((k) => [tradeSheetWords('en', k, { names: 'a name', job: 'a job', url: 'a link' }), tradeSheetWords('es', k, { names: 'un nombre', job: 'un trabajo', url: 'un enlace' })])
    expect(texts.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})
