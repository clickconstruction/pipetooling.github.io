/**
 * Every email to a trade partner (P3-a): what `gc-trade-email` reads from a request, who at the company gets it, the
 * email itself, and the office's side (`tradeEmail.ts`). The function's copies of the portal's rules and words are held
 * to the originals here, on the same records.
 */
import { describe, expect, it } from 'vitest'
import {
  buildGcTradeEmail,
  GC_TRADE_EMAIL_FROM_NAME,
  newTradeToken,
  parseTradeEmail,
  spanishHeld,
  TRADE_EMAIL_ERRORS,
  TRADE_EMAIL_KINDS,
  TRADE_EMAIL_WORDS,
  TRADE_MAIL_GROUPS,
  tradeEmailGroup,
  tradeEmailReach,
  tradeEmailRecipients,
  tradeGreeting,
  tradePortalLinkUrl,
  type TradeMailCompany,
  type TradeMailPerson,
} from '../../../supabase/functions/_shared/gcTradeEmail'
import { PORTAL_SPANISH_ON as SUBMIT_SPANISH_ON } from '../../../supabase/functions/_shared/gcTradeSubmit'
import { gcTradePortalSample } from '../../../supabase/functions/_shared/gcTradePortalSample'
import { GC_COMPANY } from './company'
import { inviteMessage, mailRecipients, portalMailGroup, type PortalMessage } from './portal'
import { PORTAL_SPANISH_ON, portalString } from './portalI18n'
import {
  answerEmail,
  answerEmailKey,
  answerRecipients,
  answerSentWords,
  backChargeEmail,
  backChargeEmailKey,
  changeAskEmail,
  changeAskEmailKey,
  GC_TRADE_EMAIL_REFUSALS,
  gcTradeEmailRefusal,
  inviteEmailLines,
  readTradeEmailAnswer,
  tradeMailLang,
} from './tradeEmail'
import { stageOf, tradePortalState } from './tradePortalState'
import type { GcState, Partner } from './types'

const COMPANY = '11111111-2222-4333-8444-555555555555'
const PROJECT = '66666666-7777-4888-9999-000000000000'

const good = (over: Record<string, unknown> = {}) => ({
  companyId: COMPANY,
  kind: 'invite',
  key: 'ask-1:invite',
  projectId: PROJECT,
  lang: 'en',
  subject: 'Click Construction asks you to quote Electrical on Fair Oaks',
  lines: ['We would like your quote.', { items: ['Service and gear'] }],
  ...over,
})

describe('parseTradeEmail', () => {
  it('reads every kind, with paper taking its own group', () => {
    for (const kind of TRADE_EMAIL_KINDS) {
      const parsed = parseTradeEmail(good({ kind, ...(kind === 'paper' ? { group: 'contracts' } : {}) }))
      expect(parsed.ok, kind).toBe(true)
      if (parsed.ok) expect(parsed.req.group).toBe(kind === 'paper' ? 'contracts' : null)
    }
  })

  it('reads a message about the company itself, with no project', () => {
    const parsed = parseTradeEmail(good({ kind: 'msa', projectId: null }))
    expect(parsed.ok && parsed.req.projectId).toBe(null)
    const left = parseTradeEmail({ ...good({ kind: 'msa' }), projectId: undefined })
    expect(left.ok && left.req.projectId).toBe(null)
  })

  it('trims the lines and drops the empty ones, and a list left with no items', () => {
    const parsed = parseTradeEmail(good({ key: '  ask-1:invite ', lines: ['  First.  ', '   ', { title: '  Leave out:  ', items: [' Permits ', ''] }, { items: ['  '] }] }))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.req.key).toBe('ask-1:invite')
    expect(parsed.req.lines).toEqual(['First.', { title: 'Leave out:', items: ['Permits'] }])
  })

  it('refuses a shape the office screens never send', () => {
    const long = (n: number) => 'x'.repeat(n)
    const bad: unknown[] = [
      null,
      'invite',
      [],
      good({ companyId: 'not-an-id' }),
      good({ kind: 'letter' }),
      good({ key: '' }),
      good({ key: '   ' }),
      good({ key: long(201) }),
      good({ projectId: 'p1' }),
      good({ lang: 'fr' }),
      good({ lang: undefined }),
      good({ subject: '' }),
      good({ subject: long(201) }),
      good({ lines: 'one line' }),
      good({ lines: [] }),
      good({ lines: ['  '] }),
      good({ lines: Array.from({ length: 41 }, () => 'x') }),
      good({ lines: [long(2001)] }),
      good({ lines: [{ items: 'Service' }] }),
      good({ lines: [{ items: Array.from({ length: 101 }, () => 'x') }] }),
      good({ lines: [42] }),
      good({ group: 'pay' }),
      good({ kind: 'paper' }),
      good({ kind: 'paper', group: 'job' }),
    ]
    for (const body of bad) expect(parseTradeEmail(body).ok, JSON.stringify(body)?.slice(0, 80)).toBe(false)
  })
})

describe('Spanish held', () => {
  it('refuses es while the portal’s Spanish is held, and the flag matches the portal’s', () => {
    expect(SUBMIT_SPANISH_ON).toBe(PORTAL_SPANISH_ON)
    expect(spanishHeld({ lang: 'es' })).toBe(!PORTAL_SPANISH_ON)
    expect(spanishHeld({ lang: 'en' })).toBe(false)
  })

  it('sends in the company’s language once Spanish is on, English until then', () => {
    expect(tradeMailLang('es')).toBe(PORTAL_SPANISH_ON ? 'es' : 'en')
    expect(tradeMailLang('en')).toBe('en')
    expect(tradeMailLang(null)).toBe('en')
    expect(tradeMailLang('fr')).toBe('en')
  })
})

describe('the group for each kind', () => {
  const stateWith = (stage: string): GcState => ({ projects: [{ id: PROJECT, stage: stageOf(stage) }], paperSends: [] }) as unknown as GcState

  it('matches portalMailGroup for every kind on every stage of the row', () => {
    for (const stage of ['bidding', 'buyout', 'building', 'closed']) {
      for (const kind of TRADE_EMAIL_KINDS) {
        if (kind === 'paper') continue
        const m = { key: 'k', on: '2026-10-08', kind, projectId: PROJECT, subject: 's', lines: [] } as PortalMessage
        expect(tradeEmailGroup(kind, stage, null), `${kind} on ${stage}`).toBe(portalMailGroup(stateWith(stage), m))
      }
    }
  })

  it('sends plans and answers to the job’s people once the job is ours', () => {
    expect(tradeEmailGroup('plans', 'bidding', null)).toBe('quotes')
    expect(tradeEmailGroup('answer', 'buyout', null)).toBe('job')
    expect(tradeEmailGroup('plans', 'building', null)).toBe('job')
    expect(tradeEmailGroup('invite', 'building', null)).toBe('quotes')
    expect(tradeEmailGroup('plans', null, null)).toBe('quotes')
  })

  it('takes a paper’s group from the request', () => {
    expect(tradeEmailGroup('paper', null, 'contracts')).toBe('contracts')
    expect(tradeEmailGroup('paper', null, 'pay')).toBe('pay')
  })
})

describe('the recipients', () => {
  const companies: { about: string; company: TradeMailCompany; people: TradeMailPerson[] }[] = [
    { about: 'a main contact who gets every kind', company: { contact_name: 'Dana Ortiz', email: 'dana@example.com', contact_gets: null }, people: [] },
    {
      about: 'a bookkeeper for pay',
      company: { contact_name: 'Dana Ortiz', email: 'dana@example.com', contact_gets: ['quotes', 'job', 'contracts'] },
      people: [{ name: 'Marcus Lee', email: 'marcus@example.com', gets: ['pay'] }],
    },
    {
      about: 'a foreman on the job beside the main contact',
      company: { contact_name: 'Ana Ruiz', email: 'ana@example.com', contact_gets: null },
      people: [
        { name: 'Luis Ruiz', email: 'luis@example.com', gets: ['job'] },
        { name: 'Pat Gray', email: null, gets: ['job', 'pay'] },
      ],
    },
    { about: 'a main contact who gets no kind and nobody else', company: { contact_name: 'Sam Pike', email: 'sam@example.com', contact_gets: [] }, people: [] },
    { about: 'a main contact with no email', company: { contact_name: 'Jo Hart', email: null, contact_gets: null }, people: [{ name: 'Kim Hart', email: 'kim@example.com', gets: ['quotes'] }] },
  ]
  const partnerOf = (c: TradeMailCompany, people: TradeMailPerson[]): Partner =>
    ({
      contact: c.contact_name ?? '',
      email: c.email ?? '',
      people: people.map((p, i) => ({ id: `p${i}`, name: p.name ?? '', email: p.email ?? '', role: '', gets: p.gets ?? [] })),
      ...(c.contact_gets === null ? {} : { contactGets: c.contact_gets }),
    }) as unknown as Partner
  const same = (r: { name: string; email: string | null; main: boolean }) => ({ name: r.name, email: r.email || null, main: r.main })

  it('matches mailRecipients for every group on each company', () => {
    for (const { about, company, people } of companies) {
      for (const group of TRADE_MAIL_GROUPS) {
        expect(tradeEmailRecipients(company, people, group).map(same), `${about}, ${group}`).toEqual(mailRecipients(partnerOf(company, people), group).map(same))
      }
    }
  })

  it('skips anyone without an email and sends to one address once', () => {
    const [, , foreman] = companies
    const to = tradeEmailRecipients(foreman!.company, foreman!.people, 'job')
    expect(tradeEmailReach(to)).toEqual([
      { name: 'Ana Ruiz', email: 'ana@example.com' },
      { name: 'Luis Ruiz', email: 'luis@example.com' },
    ])
    expect(tradeEmailReach([{ name: 'A', email: 'a@x.com', main: true }, { name: 'B', email: 'A@X.com', main: false }, { name: 'C', email: 'not an email', main: false }])).toEqual([{ name: 'A', email: 'a@x.com' }])
  })

  it('leaves no one when nobody in the group has an email', () => {
    expect(tradeEmailReach(tradeEmailRecipients({ contact_name: 'Jo Hart', email: null, contact_gets: null }, [], 'pay'))).toEqual([])
  })
})

describe('the email', () => {
  it('greets the people it goes to by first name', () => {
    expect(tradeGreeting('en', ['Dana Ortiz'], 'Sample Electric Co.')).toBe('Hello Dana,')
    expect(tradeGreeting('en', ['Marcus Lee', 'Dana Ortiz'], 'Sample Electric Co.')).toBe('Hello Marcus and Dana,')
    expect(tradeGreeting('en', ['Marcus Lee', 'Ana Ruiz', 'Dana Ortiz'], 'Sample Electric Co.')).toBe('Hello Marcus, Ana and Dana,')
    expect(tradeGreeting('es', ['Marcus Lee', 'Dana Ortiz'], 'Sample Electric Co.')).toBe('Hola Marcus y Dana:')
    expect(tradeGreeting('en', ['', '  '], 'Sample Electric Co.')).toBe('Hello Sample Electric Co.,')
  })

  const input = {
    lang: 'en' as const,
    recipients: ['Dana Ortiz', 'Marcus Lee'],
    company: 'Sample Electric Co.',
    subject: '  Click Construction asks you to quote Electrical on Fair Oaks ',
    lines: ['We would like your quote for <Electrical>.', { items: ['Service and gear', 'Panels & feeders'] }, { title: 'Known exclusions:', items: ['Permits'] }],
    linkUrl: 'https://clicktooling.com/t/abc123',
    signer: 'Avery Lin',
    gc: 'Click Construction',
  }

  it('carries the lines, the lists, the button to the portal and who it is from', () => {
    const { subject, html, text } = buildGcTradeEmail(input)
    expect(subject).toBe('Click Construction asks you to quote Electrical on Fair Oaks')
    expect(html).toContain('Hello Dana and Marcus,')
    expect(html).toContain('We would like your quote for &lt;Electrical&gt;.')
    expect(html).toContain('<li style="margin:0 0 2px">Panels &amp; feeders</li>')
    expect(html).toContain('Known exclusions:</p><ul')
    expect(html).toContain('href="https://clicktooling.com/t/abc123"')
    expect(html).toContain('>Open your portal</a>')
    expect(html).toContain(TRADE_EMAIL_WORDS.linkYours.en)
    expect(html).toContain('Thank you,<br>Avery Lin<br>Click Construction')
    expect(text.split('\n')).toEqual([
      'Hello Dana and Marcus,',
      '',
      'We would like your quote for <Electrical>.',
      '',
      '- Service and gear',
      '- Panels & feeders',
      '',
      'Known exclusions:',
      '- Permits',
      '',
      'Open your portal: https://clicktooling.com/t/abc123',
      '',
      TRADE_EMAIL_WORDS.linkYours.en,
      '',
      'Thank you,',
      'Avery Lin',
      'Click Construction',
    ])
  })

  it('is built in Spanish too, for the day it turns on', () => {
    const { html } = buildGcTradeEmail({ ...input, lang: 'es' })
    expect(html).toContain('Hola Dana y Marcus:')
    expect(html).toContain('>Abrir su portal</a>')
    expect(html).toContain('Gracias,<br>')
  })

  it('links the company’s portal by its token', () => {
    expect(tradePortalLinkUrl('https://clicktooling.com/', 'abc')).toBe('https://clicktooling.com/t/abc')
    expect(tradePortalLinkUrl('http://localhost:5303', 'sample')).toBe('http://localhost:5303/t/sample')
  })

  it('makes a new link’s token as mint_gc_trade_portal_link does: 64 hex characters', () => {
    const a = newTradeToken()
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(newTradeToken()).not.toBe(a)
  })

  it('says the portal’s own words, and comes from our company’s name', () => {
    for (const key of Object.keys(TRADE_EMAIL_WORDS) as (keyof typeof TRADE_EMAIL_WORDS)[]) {
      expect(TRADE_EMAIL_WORDS[key], key).toEqual(portalString(key))
    }
    expect(GC_TRADE_EMAIL_FROM_NAME).toBe(GC_COMPANY.name)
  })
})

describe('the office’s side', () => {
  it('has words for every refusal the function can answer', () => {
    expect(Object.keys(GC_TRADE_EMAIL_REFUSALS).sort()).toEqual(Object.keys(TRADE_EMAIL_ERRORS).sort())
    expect(gcTradeEmailRefusal('noEmail')).toBe(GC_TRADE_EMAIL_REFUSALS.noEmail)
    expect(gcTradeEmailRefusal('somethingNew')).toBe(GC_TRADE_EMAIL_REFUSALS.failed)
  })

  it('reads a send, a send made before, and a refusal', () => {
    expect(readTradeEmailAnswer({ companyId: COMPANY, messageId: 'm1', emailSendLogId: 'l1', to: ['Dana Ortiz'] }, null)).toEqual({ ok: true, companyId: COMPANY, messageId: 'm1', emailSendLogId: 'l1', to: ['Dana Ortiz'], already: false })
    expect(readTradeEmailAnswer({ companyId: COMPANY, messageId: 'm1', emailSendLogId: null, to: [], already: true }, null)).toMatchObject({ ok: true, emailSendLogId: null, already: true })
    expect(readTradeEmailAnswer(null, { error: 'noEmail' })).toEqual({ ok: false, key: 'noEmail', detail: null })
    expect(readTradeEmailAnswer(null, { error: 'sendFailed', detail: 'Resend 403' })).toEqual({ ok: false, key: 'sendFailed', detail: 'Resend 403' })
    expect(readTradeEmailAnswer({ error: 'notOnProject' }, null)).toEqual({ ok: false, key: 'notOnProject', detail: null })
    expect(readTradeEmailAnswer(null, { error: 'Something else' })).toEqual({ ok: false, key: 'failed', detail: null })
    expect(readTradeEmailAnswer('junk', null)).toEqual({ ok: false, key: 'failed', detail: null })
  })

  it('sends an invitation’s words without the greeting, its lines as a list and what it leaves out', () => {
    const today = '2026-10-08'
    const { state, partnerId } = tradePortalState(gcTradePortalSample(today), today)
    const project = state.projects[0]!
    const pkg = project.packages[0]!
    const m = inviteMessage(project, pkg, pkg.invites[0]!, state.partners.find((p) => p.id === partnerId)!, 'en')
    const lines = inviteEmailLines(m, 'en')
    expect(lines[0]).toBe('We would like your quote for Electrical on Sample Retail Shell.')
    expect(lines.slice(-2)).toEqual([
      { items: ['Service and gear', 'Panels and feeders', 'Lighting'] },
      { title: 'Known exclusions. Leave these out, someone else does them:', items: ['Permits and fees (the owner does it)'] },
    ])
    expect(parseTradeEmail(good({ lines })).ok).toBe(true)
  })
})

describe('an answer about the plans (P3-b)', () => {
  const stateWith = (stage: string, over: { lostOn?: string | null; awardedInviteId?: string | null } = {}): GcState =>
    ({
      projects: [
        {
          id: PROJECT,
          stage,
          lostOn: over.lostOn ?? null,
          packages: [
            {
              id: 'elec',
              awardedInviteId: over.awardedInviteId ?? null,
              invites: [
                { id: 'i1', partnerId: 'c1', status: 'opened' },
                { id: 'i2', partnerId: 'c2', status: 'declined' },
                { id: 'i3', partnerId: 'c3', status: 'invited' },
                { id: 'i4', partnerId: 'c1', status: 'bid' },
              ],
            },
            { id: 'plumb', awardedInviteId: null, invites: [{ id: 'i5', partnerId: 'c4', status: 'opened' }] },
          ],
        },
      ],
      partners: [
        { id: 'c1', company: 'Pecan Valley Electric' },
        { id: 'c2', company: 'Hill Country Power' },
        { id: 'c3', company: 'Sample Electric Co.' },
        { id: 'c4', company: 'Guadalupe Plumbing' },
      ],
    }) as unknown as GcState

  it('goes to every company still asked on the trade while we bid, each once, never one that passed', () => {
    expect(answerRecipients(stateWith('pursuing'), PROJECT, 'elec')).toEqual([
      { companyId: 'c1', company: 'Pecan Valley Electric' },
      { companyId: 'c3', company: 'Sample Electric Co.' },
    ])
  })

  it('goes only to the company we awarded once the job is ours, and to nobody before the award', () => {
    expect(answerRecipients(stateWith('buyout'), PROJECT, 'elec')).toEqual([])
    expect(answerRecipients(stateWith('building', { awardedInviteId: 'i3' }), PROJECT, 'elec')).toEqual([{ companyId: 'c3', company: 'Sample Electric Co.' }])
  })

  it('goes to nobody on a bid we lost, for a question about the job as a whole, or with no company record', () => {
    expect(answerRecipients(stateWith('pursuing', { lostOn: '2026-10-07' }), PROJECT, 'elec')).toEqual([])
    expect(answerRecipients(stateWith('pursuing'), PROJECT, null)).toEqual([])
    expect(answerRecipients(null, PROJECT, 'elec')).toEqual([])
    expect(answerRecipients(stateWith('pursuing'), 'another', 'elec')).toEqual([])
  })

  it('says what it is about, the question and the answer, and the set that carried it', () => {
    const a = { project: 'Fair Oaks Clinic', trade: 'Electrical', question: ' Is the panel a 400 A? ', answer: 'Yes, 400 A.', setLabel: null }
    expect(answerEmail(a, 'en')).toEqual({
      subject: 'An answer about the Electrical plans on Fair Oaks Clinic',
      lines: ['A question about the Electrical plans on Fair Oaks Clinic has an answer.', 'The question: Is the panel a 400 A?', 'The answer: Yes, 400 A.'],
    })
    expect(answerEmail({ ...a, setLabel: 'Addendum 1' }, 'en').lines.slice(-1)).toEqual(['It is part of Addendum 1.'])
    expect(answerEmail(a, 'es').subject).toBe('Una respuesta sobre los planos de Electrical en Fair Oaks Clinic')
    expect(parseTradeEmail(good({ kind: 'answer', key: answerEmailKey('q1'), ...answerEmail(a, 'en') })).ok).toBe(true)
    expect(answerEmailKey('q1')).toBe('q1:answer')
  })

  it('tells the office who has it and who it did not reach, in its words', () => {
    expect(answerSentWords(['Pecan Valley Electric', 'Sample Electric Co.'], [])).toEqual({ done: 'The answer went to Pecan Valley Electric and Sample Electric Co.', problem: null })
    expect(answerSentWords(['Hill Country Power'], []).done).toBe('The answer went to Hill Country Power.')
    expect(answerSentWords([], [{ company: 'Hill Country Power', key: 'noEmail' }])).toEqual({ done: null, problem: `Hill Country Power: ${GC_TRADE_EMAIL_REFUSALS.noEmail}` })
  })
})

describe('a back-charge’s emails (P4b-iii)', () => {
  const charge = { id: 'bc1', amount: 1250, reason: 'Cleanup after the rough-in', photo: null, sentOn: '2026-10-01', answerBy: '2026-10-06', status: 'open' as const }
  const on = { project: 'Fair Oaks Shops', trade: 'Drywall' }

  it('sends the charge with its answer day, keyed once per charge', () => {
    expect(backChargeEmail('sent', { ...on, charge }, 'en')).toEqual({
      subject: 'A charge on Fair Oaks Shops: $1,250',
      lines: [
        'We are charging you $1,250 on your Drywall work: Cleanup after the rough-in.',
        'Agree or dispute it in your portal by Tue Oct 6. With no answer, it can come off your next draw.',
        'Open your portal to see it.',
      ],
    })
    expect(backChargeEmailKey('bc1', 'sent')).toBe('bc1:sent')
  })

  it('sends the office’s keep or drop with its note, and nothing before it', () => {
    expect(backChargeEmail('settled', { ...on, charge }, 'en')).toBeNull()
    expect(backChargeEmail('settled', { ...on, charge: { ...charge, status: 'kept', settled: { on: '2026-10-08', note: 'Our photos show it' } } }, 'en')).toEqual({
      subject: 'We are keeping the charge on Fair Oaks Shops',
      lines: ['We read your reason and are keeping the $1,250 charge: Our photos show it.', 'Open your portal to see it.'],
    })
    expect(backChargeEmail('settled', { ...on, charge: { ...charge, status: 'dropped', settled: { on: '2026-10-08', note: 'Fair point.' } } }, 'es')?.subject).toBe('Cancelamos el cargo en Fair Oaks Shops')
  })

  it('sends the draw it came off once U6 takes it', () => {
    expect(backChargeEmail('taken', { ...on, charge: { ...charge, status: 'agreed' } }, 'en')).toBeNull()
    expect(backChargeEmail('taken', { ...on, charge: { ...charge, status: 'agreed', taken: { drawId: 'd2', on: '2026-10-09' } }, drawNumber: 2 }, 'en')).toEqual({
      subject: 'Draw 2 on Fair Oaks Shops is $1,250 less',
      lines: ['We took the $1,250 charge off draw 2: Cleanup after the rough-in.', 'Open your portal to see it.'],
    })
  })
})

describe('the office’s answers to a change request (P4b-iii)', () => {
  const request = { id: 'cr1', packageId: 'site', partnerId: 'p1', askedOn: '2026-10-05', description: 'Rock in the pad.', reason: 'field' as const, amount: 14820, days: 2, file: null, changeOrderId: null, turnedDown: null }
  const on = { project: 'Fair Oaks Shops', trade: 'Sitework' }

  it('turns it down with the office’s note', () => {
    expect(changeAskEmail('down', { ...on, request }, 'en')).toBeNull()
    expect(changeAskEmail('down', { ...on, request: { ...request, turnedDown: { on: '2026-10-07', note: 'It was in the geotech report.' } } }, 'en')).toEqual({
      subject: 'About the change you asked for on Fair Oaks Shops',
      lines: ['You asked for a change to your Sitework work: Rock in the pad, $14,820.', 'We are not making it a change order: It was in the geotech report.', 'Open your portal to see where it stands.'],
    })
    expect(changeAskEmailKey('cr1', 'down')).toBe('cr1:down')
  })

  it('sends its part of the change order, never our price to the customer, and the customer’s no', () => {
    const changeOrder = { number: 4, cost: 14820 }
    const sent = changeAskEmail('sent', { ...on, request, changeOrder }, 'en')
    expect(sent).toEqual({
      subject: 'Your change on Fair Oaks Shops went to the customer',
      lines: ['You asked for a change to your Sitework work: Rock in the pad, $14,820.', 'We sent it to the customer as change order 4. Your part: $14,820.', 'Open your portal to see where it stands.'],
    })
    expect(changeAskEmail('no', { ...on, request, changeOrder }, 'en')?.lines[0]).toBe('The customer said no to change order 4 on Fair Oaks Shops. We will call you about what comes next.')
    expect(changeAskEmail('sent', { ...on, request }, 'en')).toBeNull()
  })
})
