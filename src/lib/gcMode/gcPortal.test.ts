/**
 * GC mode — design spike: the trade's portal kernel (gcPortal.ts) on the made-up data. Each test
 * names the company and the fixture fact it leans on, so a fixture change that breaks one says why.
 */
import { describe, expect, it } from 'vitest'
import {
  alternateWords,
  bidGoodUntil,
  bidRanOut,
  gcReducer,
  initialGcState,
  linkNeverOpened,
  portalFirstVisit,
  portalHome,
  portalLink,
  portalLines,
  portalLookAhead,
  portalMessages,
  portalPlanNews,
  portalPromiseLine,
  portalTodos,
  type GcState,
} from './gcModel'

const state = initialGcState()

function home(partnerId: string, s: GcState = state) {
  return portalHome(s, partnerId)
}

function ask(s: GcState, projectId: string, packageId: string, partnerId: string) {
  const project = s.projects.find((p) => p.id === projectId)
  const pkg = project?.packages.find((k) => k.id === packageId)
  const invite = pkg?.invites.find((i) => i.partnerId === partnerId)
  if (!project || !pkg || !invite) throw new Error(`no ask ${projectId}/${packageId}/${partnerId}`)
  return { project, pkg, invite }
}

describe('the company home', () => {
  it('sorts Brightline into one ask still bidding and one job', () => {
    const h = home('brightline')
    expect(h.bidding.map((a) => `${a.project.id}/${a.pkg.trade}`)).toEqual(['boerne/Electrical'])
    expect(h.jobs.map((j) => `${j.ask.project.id}/${j.ask.pkg.trade}`)).toEqual(['helotes/Electrical'])
    expect(h.past).toEqual([])
  })

  it('puts the job Voltage lost on Helotes in the past', () => {
    expect(home('voltage').past.map((a) => `${a.project.id}:${a.kind}`)).toEqual(['helotes:lost'])
  })

  it('puts the ask Comal passed on in the past', () => {
    expect(home('comal').past.map((a) => a.kind)).toEqual(['passed'])
  })

  it('asks Brightline to sign its statement of work, the one thing that needs it', () => {
    expect(home('brightline').todos.map((t) => t.text)).toEqual(['Sign your Electrical statement of work for Helotes Dental Office.'])
  })

  it('puts Voltage’s number on old plans first (due in six days), then its ran-out insurance', () => {
    const todos = home('voltage').todos
    expect(todos.map((t) => [t.tone, t.key])).toEqual([
      ['red', 'elec-voltage:stale'],
      ['red', 'coi'],
    ])
    expect(todos[1]?.text).toBe('Your insurance ran out Sep 15. Send a new certificate.')
  })

  it('tells Hillside its promised day passed, in red, above its paperwork', () => {
    const todos = home('hillside').todos
    expect(todos[0]).toMatchObject({ tone: 'red', key: 'site-hillside:late', projectId: 'boerne' })
    expect(todos[0]?.text).toBe('You said your Sitework number for Boerne Retail Shell would come Wed Sep 30. Send it or give a new day.')
    expect(todos.slice(1).map((t) => t.key)).toEqual(['coi', 'w9'])
  })

  it('makes the master agreement red once a statement of work waits on it', () => {
    // Kendall: master agreement sent, Helotes HVAC awarded with its statement of work still a draft.
    expect(home('kendall').todos.find((t) => t.key === 'msa')?.tone).toBe('amber')
    const sent = gcReducer(state, { type: 'sendSow', projectId: 'helotes', packageId: 'dhvac' })
    expect(home('kendall', sent).todos[0]).toMatchObject({ key: 'msa', tone: 'red' })
  })

  it('asks Alamo to answer the rebar line the office could not read', () => {
    expect(home('alamo').todos.map((t) => t.text)).toEqual(['Answer one line of your Concrete number for Boerne Retail Shell.'])
  })

  it('asks a company that never opened the plans to open them and send its number', () => {
    // Bexar Steel Erectors was asked on Boerne structural steel and has not opened the plans.
    expect(home('bexar').todos.map((t) => t.text)).toEqual(['Open the plans and send your Structural steel number for Boerne Retail Shell by Thu Oct 8.'])
  })

  it('has no money strip until a dollar moves, and adds it up once one has', () => {
    expect(home('lonestar').money).toBeNull()
    // Brightline has a job on Helotes, but its statement of work is not signed yet.
    expect(home('brightline').money).toBeNull()
    const m = home('hillcountry').money
    expect(m).not.toBeNull()
    expect(m?.paid).toBeGreaterThan(0)
  })

  it('reads the work done weighted by each line’s amount', () => {
    const job = home('hillcountry').jobs[0]
    const sov = job?.ask.pkg.sow?.sov ?? []
    const total = sov.reduce((s, l) => s + l.amount, 0)
    const weighted = Math.round(sov.reduce((s, l) => s + l.amount * l.pctReported, 0) / total)
    expect(job?.money?.donePct).toBe(weighted)
  })

  it('drops a done thing from the list once the company does it', () => {
    const signed = gcReducer(state, { type: 'tradeSignW9', partnerId: 'hillside' })
    expect(portalTodos(signed, 'hillside').map((t) => t.key)).not.toContain('w9')
  })
})

describe('plan news and promises', () => {
  it('warns Voltage of Addendum 1, which changes Electrical', () => {
    const { project, pkg, invite } = ask(state, 'boerne', 'elec', 'voltage')
    expect(portalPlanNews(project, pkg, invite).forTrade.map((s) => s.label)).toEqual(['Addendum 1'])
  })

  it('does not warn Hillside of Addendum 1, which leaves Sitework alone', () => {
    const { project, pkg, invite } = ask(state, 'boerne', 'site', 'hillside')
    const news = portalPlanNews(project, pkg, invite)
    expect(news.behind).toBe(true)
    expect(news.forTrade).toEqual([])
  })

  it('reads a passed promise as late', () => {
    const { invite } = ask(state, 'boerne', 'site', 'hillside')
    expect(portalPromiseLine(invite, state.today, 'Click')).toEqual({
      text: 'You told Click your number would come by Wed Sep 30. That day passed 2 days ago. Send your number or give a new day.',
      late: true,
    })
  })
})

describe('how a company arrives', () => {
  it('gives each company its own link', () => {
    expect(portalLink('voltage')).toMatch(/^clicktooling\.com\/t\/[0-9A-Z]{7}$/)
    expect(portalLink('voltage')).toBe(portalLink('voltage'))
    expect(portalLink('voltage')).not.toBe(portalLink('brightline'))
  })

  it('lists what we sent Voltage, newest first', () => {
    expect(portalMessages(state, 'voltage').map((m) => `${m.on} ${m.kind} ${m.projectId}`)).toMatchInlineSnapshot(`
      [
        "2026-09-29 plans boerne",
        "2026-09-19 invite boerne",
        "2026-09-19 invite helotes",
      ]
    `)
  })

  it('writes the invitation as an email and a text, with the link in the text', () => {
    const invite = portalMessages(state, 'voltage').find((m) => m.kind === 'invite' && m.projectId === 'boerne')
    expect(invite?.subject).toBe('Click Construction asks you to bid Electrical on Boerne Retail Shell')
    expect(invite?.lines).toContain('Your number is due Thu Oct 8.')
    expect(invite?.scope?.length).toBeGreaterThan(0)
    expect(invite?.text).toContain(portalLink('voltage'))
  })

  it('tells Hillside the new set does not change Sitework, and Voltage that it changes Electrical', () => {
    const plans = (id: string) => {
      const lines = portalMessages(state, id).find((m) => m.kind === 'plans')?.lines ?? []
      return lines[lines.length - 1]
    }
    expect(plans('hillside')).toBe('It does not change Sitework. Open it so you price on the newest set.')
    expect(plans('voltage')).toBe('It changes Electrical. Open it, then confirm your number or change it.')
  })

  it('welcomes a company the first time it opens its link, and not after Got it', () => {
    // AquaShield Sprinkler has never been asked and never signed anything.
    const asked = gcReducer(state, { type: 'invite', projectId: 'boerne', packageId: 'fire', partnerId: 'aquashield' })
    expect(portalFirstVisit(asked, 'aquashield')).toBe(true)
    const opened = gcReducer(asked, { type: 'tradeOpenPortal', partnerId: 'aquashield' })
    expect(portalFirstVisit(opened, 'aquashield')).toBe(false)
    expect(gcReducer(opened, { type: 'tradeOpenPortal', partnerId: 'aquashield' })).toBe(opened)
  })

  it('does not welcome a company that already used its portal', () => {
    for (const p of state.partners.filter((x) => x.id !== 'aquashield')) {
      const used = portalHome(state, p.id).bidding.length + portalHome(state, p.id).jobs.length + portalHome(state, p.id).past.length > 0
      if (used) expect([p.id, portalFirstVisit(state, p.id)]).toEqual([p.id, false])
    }
  })
})

describe('the sheets behind each line', () => {
  it('marks the Electrical lines Addendum 1 touches for Voltage, the whole-trade lines with them', () => {
    // Voltage priced the bid set. Addendum 1 changed E-201 and E-301 (E-301 is the panel schedules).
    // Service and gear and Fire alarm name no sheet, so they stand for every Electrical sheet.
    const { project, pkg, invite } = ask(state, 'boerne', 'elec', 'voltage')
    const r = portalLines(project, pkg, invite)
    expect(r.sets.map((x) => x.label)).toEqual(['Addendum 1'])
    expect(r.lines.filter((l) => l.by.length > 0).map((l) => [l.item.label, l.wholeTrade, l.changed])).toEqual([
      ['Service and gear', true, ['E-201', 'E-301']],
      ['Panels and feeders', false, ['E-301']],
      ['Fire alarm', true, ['E-201', 'E-301']],
    ])
    expect(r.otherSheets).toEqual([])
  })

  it('leaves the lighting lines alone: E-101 did not change', () => {
    const { project, pkg, invite } = ask(state, 'boerne', 'elec', 'voltage')
    const untouched = portalLines(project, pkg, invite).lines.filter((l) => l.by.length === 0)
    expect(untouched.map((l) => l.item.label)).toEqual(['Lighting', 'Site lighting'])
  })

  it('gives each line its sheets, guessed from its words on a made-up project', () => {
    const { project, pkg, invite } = ask(state, 'boerne', 'elec', 'voltage')
    const lighting = portalLines(project, pkg, invite).lines.find((l) => l.item.label === 'Lighting')
    expect(lighting).toMatchObject({ sheets: ['E-101'], guessed: true, wholeTrade: false, changed: [] })
  })

  it('marks nothing for Brightline, who priced Addendum 1 already', () => {
    const { project, pkg, invite } = ask(state, 'boerne', 'elec', 'brightline')
    expect(portalLines(project, pkg, invite).sets).toEqual([])
  })

  it('marks nothing once Voltage confirms its number on the new plans', () => {
    const confirmed = gcReducer(state, { type: 'tradeConfirmBid', projectId: 'boerne', packageId: 'elec', inviteId: 'elec-voltage' })
    const { project, pkg, invite } = ask(confirmed, 'boerne', 'elec', 'voltage')
    expect(portalLines(project, pkg, invite).sets).toEqual([])
  })

  it('marks nothing for a company that never opened the plans', () => {
    const { project, pkg, invite } = ask(state, 'boerne', 'steel', 'bexar')
    expect(portalLines(project, pkg, invite).sets).toEqual([])
  })
})

describe('the bid form', () => {
  const lonestarBids = (days: number) =>
    gcReducer(
      gcReducer(gcReducer(state, { type: 'invite', projectId: 'padb', packageId: 'bsite', partnerId: 'lonestar' }), {
        type: 'tradeOpenPlans',
        projectId: 'padb',
        packageId: 'bsite',
        inviteId: 'bsite-lonestar',
      }),
      {
        type: 'tradeSubmitBid',
        projectId: 'padb',
        packageId: 'bsite',
        inviteId: 'bsite-lonestar',
        amount: 92_500,
        includes: { 'bsite-1': 'yes', 'bsite-2': 'yes', 'bsite-3': 'yes' },
        note: '',
        goodForDays: days,
        alternates: [{ label: 'Asphalt paving in place of concrete', amount: -6_000 }],
        quoteFile: 'lonestar-pad-b.pdf',
      },
    )

  it('keeps how long the number holds, its alternates and the quote file on the bid', () => {
    const bid = ask(lonestarBids(30), 'padb', 'bsite', 'lonestar').invite.bid
    expect(bid).toMatchObject({ goodForDays: 30, quoteFile: 'lonestar-pad-b.pdf', alternates: [{ amount: -6_000 }] })
    expect(bid && bidGoodUntil(bid)).toBe('2026-11-01')
  })

  it('leaves a bid sent without them as it was', () => {
    const bid = ask(state, 'boerne', 'site', 'lonestar').invite.bid
    expect(bid && 'goodForDays' in bid).toBe(false)
    expect(bid && bidGoodUntil(bid)).toBeNull()
  })

  it('says a number ran out the day after its last good day, and asks for it again', () => {
    const s = lonestarBids(15)
    const bid = ask(s, 'padb', 'bsite', 'lonestar').invite.bid
    if (!bid) throw new Error('no bid')
    expect(bidRanOut(bid, '2026-10-17')).toBe(false)
    expect(bidRanOut(bid, '2026-10-18')).toBe(true)
    const later = { ...s, today: '2026-10-18' }
    expect(portalTodos(later, 'lonestar').find((t) => t.key === 'bsite-lonestar:ranout')?.text).toBe(
      'Your Sitework number for Boerne Retail Pad B ran out Sat Oct 17. Send it again to keep it good.',
    )
  })

  it('words an alternate that adds and one that takes off', () => {
    expect(alternateWords({ label: 'LED high bays', amount: 4_200 })).toBe('LED high bays adds $4,200')
    expect(alternateWords({ label: 'Owner buys the fixtures', amount: -12_000 })).toBe('Owner buys the fixtures takes off $12,000')
  })

  it('answers a line the office could not read without touching the number', () => {
    const before = ask(state, 'boerne', 'conc', 'alamo').invite.bid
    const s = gcReducer(state, { type: 'tradeAnswerLines', projectId: 'boerne', packageId: 'conc', inviteId: 'conc-alamo', answers: { 'conc-4': 'yes' } })
    const after = ask(s, 'boerne', 'conc', 'alamo').invite.bid
    expect(after?.includes['conc-4']).toBe('yes')
    expect([after?.amount, after?.submittedOn]).toEqual([before?.amount, before?.submittedOn])
    expect(s.log[0]?.text).toBe('Alamo Concrete answered on Concrete: Rebar supply is in their number.')
    expect(portalTodos(s, 'alamo').map((t) => t.key)).not.toContain('conc-alamo:unclear')
  })

  it('ignores an answer for a line that was already clear', () => {
    expect(gcReducer(state, { type: 'tradeAnswerLines', projectId: 'boerne', packageId: 'conc', inviteId: 'conc-alamo', answers: { 'conc-1': 'no' } })).toBe(state)
  })
})

describe('the messages for sent and start days', () => {
  it('sends Kendall its master agreement on the day it went out', () => {
    const msa = portalMessages(state, 'kendall').find((m) => m.kind === 'msa')
    expect(msa).toMatchObject({ on: '2026-09-29', projectId: null, subject: 'Your master agreement with Click Construction' })
  })

  it('dates the master agreement the day the office sends it', () => {
    const sent = gcReducer(state, { type: 'sendMsa', partnerId: 'hillside' })
    expect(portalMessages(sent, 'hillside')[0]).toMatchObject({ kind: 'msa', on: '2026-10-02' })
  })

  it('sends Brightline its statement of work with the price and what is held back', () => {
    const sow = portalMessages(state, 'brightline').find((m) => m.kind === 'sow')
    expect(sow?.on).toBe('2026-09-30')
    expect(sow?.lines).toContain('Your statement of work is ready: $56,900, based on the Permit set.')
    expect(sow?.lines).toContain('We hold back 10% of each draw until the job is done.')
  })

  it('tells the companies on a started job the day work begins, by email and by text', () => {
    const start = portalMessages(state, 'summit').find((m) => m.kind === 'start')
    expect(start?.subject).toBe('Work starts on Fair Oaks Shops, Building D Mon Jul 6')
    expect(start?.text).toContain(portalLink('summit'))
  })

  it('tells only the companies on the job when we press Start', () => {
    const started = gcReducer(gcReducer(state, { type: 'setStartDate', projectId: 'helotes', date: '2026-10-12' }), { type: 'startProject', projectId: 'helotes' })
    expect(portalMessages(started, 'hillcountry').map((m) => m.kind)).toContain('start')
    expect(portalMessages(started, 'voltage').map((m) => m.kind)).not.toContain('start')
  })
})

describe('Needs you on a job being built', () => {
  it('asks Summit to fix the pay application we sent back, not to ask for new money', () => {
    const keys = portalTodos(state, 'summit').map((t) => t.key)
    expect(keys.some((k) => k.endsWith(':back'))).toBe(true)
    expect(keys.some((k) => k.endsWith(':draw'))).toBe(false)
  })

  it('asks Guadalupe for nothing while its closeout waits on us', () => {
    expect(portalTodos(state, 'guadalupe')).toEqual([])
  })

  it('does not offer Pecan Valley a draw while its insurance has run out', () => {
    const todos = portalTodos(state, 'pecanvalley')
    expect(todos[0]?.key).toBe('coi')
    expect(todos.some((t) => t.key.endsWith(':draw'))).toBe(false)
  })
})

describe('a draw approved for less', () => {
  const ids = { projectId: 'helotes', packageId: 'dry' }
  const typed = { periodTo: '2026-10-02', address: '418 River Rd, Boerne, TX 78006', license: '', signedBy: 'Rosa Medina', signedTitle: 'Office manager' }
  const asked = gcReducer(state, { type: 'tradeSendPayApp', ...ids, toPct: { 'dry-2': 60 }, ...typed })
  const less = gcReducer(asked, { type: 'approveDrawLess', ...ids, drawId: 'dry-draw-2', weApprove: { 'dry-2': 40 }, note: 'The hall is not taped.' })
  const draw = less.projects.find((p) => p.id === 'helotes')?.packages.find((k) => k.id === 'dry')?.sow?.draws[1]

  it('tells Hill Country what we approved of what it asked, until it is paid', () => {
    if (!draw?.asked) throw new Error('no approve-less draw')
    const line = portalTodos(less, 'hillcountry').find((t) => t.key.includes(':less:'))
    expect(line?.text).toBe(
      `Click approved ${'$' + draw.net.toLocaleString('en-US')} of the ${'$' + draw.asked.net.toLocaleString('en-US')} you asked for on Helotes Dental Office. The rest is still yours to ask for.`,
    )
    const paid = gcReducer(less, { type: 'payDraw', ...ids, drawId: 'dry-draw-2' })
    expect(portalTodos(paid, 'hillcountry').some((t) => t.key.includes(':less:'))).toBe(false)
  })

  it('sends a message on the day we approved less, with our reason', () => {
    const m = portalMessages(less, 'hillcountry').find((x) => x.kind === 'less')
    expect(m?.subject).toBe('Pay application 2 on Helotes Dental Office: approved for less')
    expect(m?.lines).toContain('The hall is not taped.')
    expect(m?.on).toBe(less.today)
  })

  it('says nothing about less on a draw approved as asked', () => {
    const approved = gcReducer(asked, { type: 'approveDraw', ...ids, drawId: 'dry-draw-2' })
    expect(portalTodos(approved, 'hillcountry').some((t) => t.key.includes(':less:'))).toBe(false)
    expect(portalMessages(approved, 'hillcountry').some((x) => x.kind === 'less')).toBe(false)
  })
})

describe('the weekly look-ahead', () => {
  const fairOaks = (s: GcState) => {
    const p = s.projects.find((x) => x.id === 'fairoaksd')
    if (!p) throw new Error('no Fair Oaks D')
    return p
  }
  const mark = { type: 'tradeMarkLookAhead' as const, projectId: 'fairoaksd', packageId: 'felec', lineId: 'felec-3', weekOf: '2026-09-28' }

  it('shows Pecan Valley last week while it is unmarked, this week, and the next two', () => {
    const weeks = portalLookAhead(state, 'pecanvalley', fairOaks(state))
    expect(weeks.map((w) => `${w.when} ${w.weekOf}`)).toEqual(['last 2026-09-21', 'this 2026-09-28', 'next 2026-10-05', 'later 2026-10-12'])
    expect(weeks[1]?.items.map((i) => [i.row.label, i.state, i.canMark])).toEqual([
      ['Panels and feeders', 'waiting', true],
      ['Lighting', 'unmarked', true],
    ])
    expect(weeks[2]?.items.every((i) => !i.canMark)).toBe(true)
  })

  it('asks Pecan Valley for last week late, and for this week since it is Friday', () => {
    const texts = portalTodos(state, 'pecanvalley').map((t) => t.text)
    expect(texts).toContain("Mark last week's work on Fair Oaks Shops, Building D: 2 still to mark.")
    expect(texts).toContain("Mark this week's work on Fair Oaks Shops, Building D: 1 to mark.")
  })

  it('does not ask for this week before Friday', () => {
    const thursday = { ...state, today: '2026-10-01' }
    expect(portalTodos(thursday, 'pecanvalley').some((t) => t.key === 'fairoaksd:lookahead')).toBe(false)
  })

  it('keeps the mark waiting on our superintendent, and lets the company change it until then', () => {
    const notDone = gcReducer(state, { ...mark, done: false, reason: 'materials' })
    const m1 = fairOaks(notDone).schedule?.lookAhead.find((x) => x.weekOf === '2026-09-28' && x.lineId === 'felec-3')
    expect(m1).toMatchObject({ done: false, reason: 'materials', verifiedOn: null, markedOn: state.today })
    expect(notDone.log[0]?.text).toBe('Pecan Valley Electric marked Lighting on Electrical not done for the week of Mon Sep 28: materials.')
    const changed = gcReducer(notDone, { ...mark, done: true })
    const marks = fairOaks(changed).schedule?.lookAhead.filter((x) => x.weekOf === '2026-09-28' && x.lineId === 'felec-3') ?? []
    expect(marks).toHaveLength(1)
    expect(marks[0]).toMatchObject({ done: true })
    expect(marks[0] && 'reason' in marks[0]).toBe(false)
  })

  it('leaves a verified mark as our superintendent left it', () => {
    // Our own crew's top out this week is already verified; Summit's is waiting.
    const verified = fairOaks(state).schedule?.lookAhead.find((x) => x.verifiedOn)
    if (!verified) throw new Error('no verified mark')
    expect(gcReducer(state, { type: 'tradeMarkLookAhead', projectId: 'fairoaksd', packageId: 'fsteel', lineId: verified.lineId, weekOf: verified.weekOf, done: false, reason: 'crew' })).toBe(state)
  })

  it('shows nothing on a job that is not being built yet', () => {
    expect(portalLookAhead(state, 'hillcountry', state.projects.find((p) => p.id === 'helotes') ?? fairOaks(state))).toEqual([])
  })
})

describe('for the office: a company that never opened its link', () => {
  const asked = gcReducer(state, { type: 'invite', projectId: 'boerne', packageId: 'fire', partnerId: 'aquashield' })

  it('flags AquaShield the day we ask it, amber', () => {
    expect(linkNeverOpened(asked, 'aquashield')).toEqual({ since: '2026-10-02', days: 0, late: false })
  })

  it('turns late once past the days a company should take to open the plans', () => {
    expect(linkNeverOpened({ ...asked, today: '2026-10-05' }, 'aquashield')?.late).toBe(false)
    expect(linkNeverOpened({ ...asked, today: '2026-10-06' }, 'aquashield')?.late).toBe(true)
  })

  it('clears once the company opens its link', () => {
    const opened = gcReducer(asked, { type: 'tradeOpenPortal', partnerId: 'aquashield' })
    expect(linkNeverOpened(opened, 'aquashield')).toBeNull()
  })

  it('flags no one in the made-up data, where every company asked has used its portal', () => {
    expect(state.partners.filter((p) => linkNeverOpened(state, p.id)).map((p) => p.id)).toEqual([])
  })
})

describe('a change order to sign', () => {
  const drafted = gcReducer(state, {
    type: 'draftChangeOrder',
    projectId: 'helotes',
    description: 'Add a soffit over the reception desk, per A-201',
    reason: 'owner',
    schedule: '+1 working day',
    packageId: 'dry',
    cost: 3_100,
    price: 0,
  })
  const orders = drafted.projects.find((p) => p.id === 'helotes')?.changeOrders ?? []
  const coId = orders[orders.length - 1]?.id ?? ''
  const sent = [
    { type: 'sendChangeOrder' as const, projectId: 'helotes', changeOrderId: coId },
    { type: 'ownerSignChangeOrder' as const, projectId: 'helotes', changeOrderId: coId },
    { type: 'sendTradeChange' as const, projectId: 'helotes', changeOrderId: coId },
  ].reduce((s2, a) => gcReducer(s2, a), drafted)

  it('asks Hill Country to sign it, with what it adds', () => {
    const line = portalTodos(sent, 'hillcountry').find((t) => t.key.endsWith(':sign'))
    expect(line?.text).toMatch(/^Sign change order \d+ on Helotes Dental Office\. It adds \$3,100\.$/)
  })

  it('sends a message the day we send it, in Spanish too', () => {
    const m = portalMessages(sent, 'hillcountry').find((x) => x.kind === 'change')
    expect(m?.lines).toContain('We have a change to your Framing and drywall work on Helotes Dental Office: Add a soffit over the reception desk, per A-201.')
    expect(m?.lines).toContain('It adds $3,100 to your statement of work.')
    expect(portalMessages(sent, 'hillcountry', 'es').find((x) => x.kind === 'change')?.lines).toContain('Suma $3,100 a su orden de trabajo.')
  })

  it('drops the line once signed, and the job money counts the change', () => {
    const before = portalHome(sent, 'hillcountry').jobs[0]?.money?.price ?? 0
    const signed = gcReducer(sent, { type: 'tradeSignChange', projectId: 'helotes', changeOrderId: coId })
    expect(portalTodos(signed, 'hillcountry').some((t) => t.key.endsWith(':sign'))).toBe(false)
    expect(portalHome(signed, 'hillcountry').jobs[0]?.money?.price).toBe(before + 3_100)
  })
})
