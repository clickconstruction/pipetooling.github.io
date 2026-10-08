import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { setEmailKey, setEmailRecipients, setEmailSummary, setEmailWords, setSendRows, type SetEmailInvite } from './setEmail'

const trades = [
  { id: 'conc', trade: 'Concrete' },
  { id: 'elec', trade: 'Electrical' },
  { id: 'plmb', trade: 'Plumbing' },
]
const companies = [
  { id: 'c-alamo', name: 'Alamo Concrete', lang: 'en' as const },
  { id: 'c-pecan', name: 'Pecan Valley Electric', lang: 'es' as const },
  { id: 'c-both', name: 'Both Ways Builders', lang: 'en' as const },
  { id: 'c-out', name: 'Says No Plumbing', lang: 'en' as const },
]
const invites: SetEmailInvite[] = [
  { id: 'i1', packageId: 'conc', companyId: 'c-alamo', status: 'bid' },
  { id: 'i2', packageId: 'elec', companyId: 'c-pecan', status: 'opened' },
  { id: 'i3', packageId: 'plmb', companyId: 'c-both', status: 'invited' },
  { id: 'i4', packageId: 'conc', companyId: 'c-both', status: 'invited' },
  { id: 'i5', packageId: 'plmb', companyId: 'c-out', status: 'declined' },
]

describe('the set email: who hears', () => {
  it('while we bid: every company asked, once each, not the one that said no, the changed trades first', () => {
    const r = setEmailRecipients({ stage: 'bidding', trades, invites, companies, touches: ['conc'] })
    expect(r.map((x) => [x.companyName, x.trades.join('+'), x.touched])).toEqual([
      ['Alamo Concrete', 'Concrete', true],
      ['Both Ways Builders', 'Concrete+Plumbing', true],
      ['Pecan Valley Electric', 'Electrical', false],
    ])
  })

  it('once the job is ours: only the awarded company on each trade, and nobody before awards exist', () => {
    expect(setEmailRecipients({ stage: 'buyout', trades, invites, companies, touches: ['conc'] })).toEqual([])
    const r = setEmailRecipients({ stage: 'building', trades, invites, companies, touches: ['conc'], awardedInviteIds: ['i1', 'i2'] })
    expect(r.map((x) => x.companyId)).toEqual(['c-alamo', 'c-pecan'])
  })

  it('sends one company one set once', () => {
    expect(setEmailKey('p1', 2)).toBe('p1:plans:2')
  })
})

describe('the set email: the words', () => {
  const set = { label: 'Addendum 1', project: 'Boerne Retail Shell', note: 'Footing F3 is wider.', sheets: ['S-101', 'S-102'] }

  it('are the portal’s own plans message, without the greeting, in English', () => {
    expect(setEmailWords('en', set, { trades: ['Concrete', 'Plumbing'], touched: true })).toEqual({
      subject: 'Addendum 1 for Boerne Retail Shell',
      lines: [
        'Addendum 1 for Boerne Retail Shell is out. Footing F3 is wider.',
        'Sheets S-101, S-102.',
        'It changes Concrete and Plumbing. Open it, then confirm your quote or change it.',
      ],
    })
  })

  it('in Spanish for a company that reads it, and with no sheet line when the set names none', () => {
    const w = setEmailWords('es', { ...set, sheets: [] }, { trades: ['Electrical'], touched: false })
    expect(w.subject).toBe('Addendum 1 de Boerne Retail Shell')
    expect(w.lines).toEqual(['Ya salió Addendum 1 de Boerne Retail Shell. Footing F3 is wider.', 'No cambia Electrical. Ábralo para cotizar con el juego más reciente.'])
  })

  it('keep the plain-words rules in English', () => {
    for (const touched of [true, false]) {
      for (const line of setEmailWords('en', set, { trades: ['Concrete'], touched }).lines) expect(plainWordsFailures(line), line).toEqual([])
    }
  })
})

describe('the set email: the facts a trade acts on', () => {
  it('carries each company’s touched lines and, by trade, the lines the set adds', () => {
    const r = setEmailRecipients({
      stage: 'bidding',
      trades,
      invites,
      companies,
      touches: ['conc', 'plmb'],
      linesByPackage: { conc: { touched: ['Footings'], added: ['Pier caps'] }, plmb: { touched: ['Underground'], added: [] } },
    })
    const both = r.find((x) => x.companyId === 'c-both')!
    expect(both.linesTouched).toEqual(['Footings', 'Underground'])
    expect(both.linesAdded).toEqual([{ trade: 'Concrete', lines: ['Pier caps'] }])
  })

  it('reads in the portal’s order: out, sheets, your lines, added lines by trade, changes, due', () => {
    const w = setEmailWords(
      'en',
      { label: 'Addendum 1', project: 'Boerne Retail Shell', note: 'Footing F3 is wider.', sheets: ['S-101'], quoteDueOn: '2026-10-15' },
      { trades: ['Concrete', 'Plumbing'], touched: true, linesTouched: ['Footings', 'Underground'], linesAdded: [{ trade: 'Concrete', lines: ['Pier caps', 'Ramp'] }] },
    )
    expect(w.lines).toEqual([
      'Addendum 1 for Boerne Retail Shell is out. Footing F3 is wider.',
      'Sheets S-101.',
      'It touches these lines of your quote: Footings, Underground.',
      'It adds these lines to Concrete: Pier caps, Ramp.',
      'It changes Concrete and Plumbing. Open it, then confirm your quote or change it.',
      'Your quote is due Oct 15.',
    ])
  })

  it('in Spanish too, and leaves out a line with nothing to say', () => {
    const w = setEmailWords('es', { label: 'Addendum 1', project: 'Boerne', note: '', sheets: [] }, { trades: ['Electrical'], touched: true, linesTouched: ['Lighting'], linesAdded: [] })
    expect(w.lines).toEqual([
      'Ya salió Addendum 1 de Boerne.',
      'Toca estas partidas de su cotización: Lighting.',
      'Cambia Electrical. Ábralo y luego confirme su cotización o cámbiela.',
    ])
  })

  it('says, while we bid, the day the quote is due, last', () => {
    const w = setEmailWords('en', { label: 'Addendum 1', project: 'Boerne Retail Shell', note: '', sheets: [], quoteDueOn: '2026-10-15' }, { trades: ['Concrete'], touched: true })
    expect(w.lines[w.lines.length - 1]).toBe('Your quote is due Oct 15.')
    const es = setEmailWords('es', { label: 'Addendum 1', project: 'Boerne Retail Shell', note: '', sheets: [], quoteDueOn: '2026-10-15' }, { trades: ['Concrete'], touched: false })
    expect(es.lines[es.lines.length - 1]).toBe('Su cotización vence el 15 oct.')
  })
})

describe('the set email: what the sends write', () => {
  const recipients = [
    { companyId: 'c-alamo', touched: true },
    { companyId: 'c-pecan', touched: false },
    { companyId: 'c-both', touched: true },
  ]
  const results = [
    { companyId: 'c-alamo', outcome: 'sent' as const, messageId: 'm1', emailSendLogId: 'e1', to: ['dana@alamo.test'], already: false },
    { companyId: 'c-pecan', outcome: 'no email' as const },
    { companyId: 'c-both', outcome: 'failed' as const, error: 'sendFailed' },
  ]

  it('one gc_plan_set_sends row per company that got it, none for no address or a failed send', () => {
    expect(setSendRows('set-2', recipients, results)).toEqual([{ set_id: 'set-2', company_id: 'c-alamo', touched: true, email_send_log_id: 'e1' }])
  })

  it('says how it went in one line', () => {
    expect(setEmailSummary(results)).toBe('Emailed 1 company. 1 has no email on file. 1 did not go out. Press Try again.')
    expect(setEmailSummary([results[0]!])).toBe('Emailed 1 company.')
    for (const s of [setEmailSummary(results)]) expect(plainWordsFailures(s)).toEqual([])
  })
})
