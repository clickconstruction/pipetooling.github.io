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
  portalLeavesOut,
  portalLink,
  portalLines,
  portalLookAhead,
  portalMessages,
  portalContacts,
  portalPay,
  portalQuestions,
  questionsCloseOn,
  questionsOpen,
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

  it('writes the invitation as an email (email only for now)', () => {
    const invite = portalMessages(state, 'voltage').find((m) => m.kind === 'invite' && m.projectId === 'boerne')
    expect(invite?.subject).toBe('Click Construction asks you to bid Electrical on Boerne Retail Shell')
    expect(invite?.lines).toContain('Your number is due Thu Oct 8.')
    expect(invite?.scope?.length).toBeGreaterThan(0)
    expect(invite).not.toHaveProperty('text')
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
  // The office sets sheets on three Electrical lines; the other two it leaves for the whole trade.
  const officeSet = (s: GcState): GcState => ({
    ...s,
    projects: s.projects.map((p) =>
      p.id !== 'boerne'
        ? p
        : {
            ...p,
            packages: p.packages.map((k) =>
              k.id !== 'elec'
                ? k
                : {
                    ...k,
                    scope: k.scope.map((item) =>
                      item.label === 'Panels and feeders' ? { ...item, sheets: ['E-301'] } : item.label.endsWith('ighting') ? { ...item, sheets: ['E-101'] } : item,
                    ),
                  },
            ),
          },
    ),
  })

  it('shows no sheet the office did not set: on made-up Boerne every line stands for the whole trade', () => {
    // Voltage priced the bid set; Addendum 1 changed E-201 and E-301, so every Electrical line is touched.
    const { project, pkg, invite } = ask(state, 'boerne', 'elec', 'voltage')
    const r = portalLines(project, pkg, invite)
    expect(r.lines.every((l) => l.sheets.length === 0 && l.wholeTrade)).toBe(true)
    expect(r.lines.map((l) => [l.item.label, l.changed])).toEqual([
      ['Service and gear', ['E-201', 'E-301']],
      ['Panels and feeders', ['E-201', 'E-301']],
      ['Lighting', ['E-201', 'E-301']],
      ['Fire alarm', ['E-201', 'E-301']],
      ['Site lighting', ['E-201', 'E-301']],
    ])
  })

  it('shows the sheets the office set, and marks only the lines Addendum 1 touches', () => {
    const s = officeSet(state)
    const { project, pkg, invite } = ask(s, 'boerne', 'elec', 'voltage')
    const r = portalLines(project, pkg, invite)
    expect(r.lines.map((l) => [l.item.label, l.sheets, l.wholeTrade, l.changed])).toEqual([
      ['Service and gear', [], true, ['E-201', 'E-301']],
      ['Panels and feeders', ['E-301'], false, ['E-301']],
      ['Lighting', ['E-101'], false, []],
      ['Fire alarm', [], true, ['E-201', 'E-301']],
      ['Site lighting', ['E-101'], false, []],
    ])
    expect(r.otherSheets).toEqual([])
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

  it('tells the companies on a started job the day work begins, by email', () => {
    const start = portalMessages(state, 'summit').find((m) => m.kind === 'start')
    expect(start?.subject).toBe('Work starts on Fair Oaks Shops, Building D Mon Jul 6')
    expect(start).not.toHaveProperty('text')
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

  it('asks Guadalupe only for its punch item while its closeout waits on us', () => {
    expect(portalTodos(state, 'guadalupe').map((t) => t.key)).toEqual(['fconc-guadalupe:punch'])
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

describe('Your pay', () => {
  it('lists Hill Country’s paid pay application with its days, made up for draws from before', () => {
    const pay = portalPay(state, 'hillcountry')
    const first = pay.rows.find((r) => r.draw.id === 'dry-draw-1')
    expect(first?.state).toBe('paid')
    expect(first?.draw.approvedOn).toBeDefined()
    expect(first?.draw.paidOn).toBeDefined()
    expect(pay.totals.paid).toBeGreaterThan(0)
  })

  it('says when an approved one should arrive, and turns late after that day', () => {
    const ids = { projectId: 'helotes', packageId: 'dry' }
    const asked = gcReducer(state, { type: 'tradeReport', ...ids, sovId: 'dry-3', pct: 100 })
    const req = gcReducer(asked, { type: 'tradeRequestDraw', ...ids })
    const draws = req.projects.find((p) => p.id === 'helotes')?.packages.find((k) => k.id === 'dry')?.sow?.draws ?? []
    const drawId = draws[draws.length - 1]?.id ?? ''
    expect(portalPay(req, 'hillcountry').rows.find((r) => r.draw.id === drawId)?.state).toBe('checking')
    const approved = gcReducer(req, { type: 'approveDraw', ...ids, drawId })
    const row = portalPay(approved, 'hillcountry').rows.find((r) => r.draw.id === drawId)
    expect(row).toMatchObject({ state: 'approved', payBy: '2026-10-12' })
    expect(portalPay({ ...approved, today: '2026-10-13' }, 'hillcountry').rows.find((r) => r.draw.id === drawId)?.state).toBe('late')
    const paid = gcReducer(approved, { type: 'payDraw', ...ids, drawId })
    const message = portalMessages(paid, 'hillcountry').find((m) => m.kind === 'paid' && m.key.startsWith(drawId))
    expect(message?.on).toBe(state.today)
    expect(message?.lines.some((l) => l.startsWith('We hold '))).toBe(true)
  })

  it('has nothing for a company with no job', () => {
    expect(portalPay(state, 'lonestar').rows).toEqual([])
  })
})

describe('who to call', () => {
  const project = (id: string) => {
    const p = state.projects.find((x) => x.id === id)
    if (!p) throw new Error(`no project ${id}`)
    return p
  }

  it('puts the superintendent on site first on a job being built', () => {
    const c = portalContacts(project('fairoaksd'))
    expect(c.bidding).toBe(false)
    expect(c.team.map((x) => [x.role, x.name])).toEqual([
      ['superintendent', 'Luis Ortega'],
      ['projectManager', 'Dana Whitaker'],
    ])
  })

  it('gives the project manager alone while we bid', () => {
    const c = portalContacts(project('boerne'))
    expect(c.bidding).toBe(true)
    expect(c.team.map((x) => x.role)).toEqual(['projectManager'])
  })
})

describe('questions about the plans', () => {
  const boerne = (s: GcState) => {
    const p = s.projects.find((x) => x.id === 'boerne')
    if (!p) throw new Error('no Boerne')
    return p
  }

  it('closes three days before the bid is due, only while we bid', () => {
    expect(questionsCloseOn(boerne(state))).toBe('2026-10-05')
    expect(questionsOpen(boerne(state), '2026-10-04')).toBe(true)
    expect(questionsOpen(boerne(state), '2026-10-05')).toBe(false)
    expect(questionsCloseOn(state.projects.find((p) => p.id === 'helotes') ?? boerne(state))).toBeNull()
  })

  it('shows a company its own question, and another company only the answered ones sent to it, without who asked', () => {
    const asked = gcReducer(state, { type: 'tradeAskQuestion', projectId: 'boerne', packageId: 'elec', partnerId: 'voltage', text: 'Is the tenant panel 200A or 400A?', sheets: ['E-301'] })
    const q = boerne(asked).questions.find((x) => x.text.startsWith('Is the tenant panel'))
    if (!q) throw new Error('no question')
    expect(portalQuestions(boerne(asked), 'elec', 'voltage').map((p) => [p.q.id, p.mine, p.state])).toContainEqual([q.id, true, 'asked'])
    expect(portalQuestions(boerne(asked), 'elec', 'brightline').some((p) => p.q.id === q.id)).toBe(false)

    const answered = gcReducer(gcReducer(asked, { type: 'sendQuestionToArchitect', projectId: 'boerne', questionId: q.id }), {
      type: 'answerQuestion',
      projectId: 'boerne',
      questionId: q.id,
      answer: '400A, per the revised one-line.',
      recipients: ['voltage', 'brightline'],
    })
    const theirs = portalQuestions(boerne(answered), 'elec', 'brightline').find((p) => p.q.id === q.id)
    expect(theirs).toMatchObject({ mine: false, state: 'answered', answerOn: state.today })
    const todo = portalTodos(answered, 'brightline').find((t) => t.key === `${q.id}:answer`)
    expect(todo?.text).toBe('A question about the Electrical plans on Boerne Retail Shell has an answer.')
    const m = portalMessages(answered, 'brightline').find((x) => x.kind === 'answer')
    expect(m?.lines).toContain('The answer: 400A, per the revised one-line.')
    expect(m?.lines.join(' ')).not.toContain('Voltage')
  })
})

describe('insurance running out soon', () => {
  const sent = (expires: string) => gcReducer(state, { type: 'tradeUploadCoi', partnerId: 'lonestar', expires })

  it('warns from 30 days out, amber, and not before', () => {
    expect(portalTodos(sent('2026-11-02'), 'lonestar').some((t) => t.key === 'coi:soon')).toBe(false)
    const soon = portalTodos(sent('2026-10-20'), 'lonestar').find((t) => t.key === 'coi:soon')
    expect(soon).toMatchObject({ tone: 'amber', text: 'Your insurance runs out Tue Oct 20, in 18 days. Send a new certificate before then.' })
  })

  it('says tomorrow and today on the last two days', () => {
    expect(portalTodos(sent('2026-10-03'), 'lonestar').find((t) => t.key === 'coi:soon')?.text).toBe('Your insurance runs out tomorrow, Sat Oct 3. Send a new certificate.')
    expect(portalTodos(sent('2026-10-02'), 'lonestar').find((t) => t.key === 'coi:soon')?.text).toBe('Your insurance runs out today, Fri Oct 2. Send a new certificate.')
  })

  it('emails the warning 30 days before, while the certificate still holds', () => {
    const m = portalMessages(sent('2026-10-20'), 'lonestar').find((x) => x.kind === 'coi')
    expect(m).toMatchObject({ on: '2026-09-20', subject: 'Your insurance runs out Tue Oct 20' })
    expect(portalMessages(sent('2026-11-02'), 'lonestar').some((x) => x.kind === 'coi')).toBe(false)
  })
})

describe('a project we lost', () => {
  const lost = (why: 'price' | 'project_died', s: GcState = state) =>
    gcReducer(s, { type: 'markLost', projectId: 'boerne', why, wonBy: 'Hill Country Builders', note: 'Owner went with a lower number.' })

  it('moves Hillside’s Boerne ask from Bidding to Before, and Comal stays passed', () => {
    const h = home('hillside', lost('price'))
    expect(h.bidding.some((a) => a.project.id === 'boerne')).toBe(false)
    expect(h.past.filter((a) => a.project.id === 'boerne').map((a) => a.kind)).toEqual(['closed'])
    expect(home('comal', lost('price')).past.map((a) => a.kind)).toEqual(['passed'])
  })

  it('asks nothing more on it', () => {
    const before = portalTodos(state, 'hillside').filter((t) => t.projectId === 'boerne')
    expect(before.length).toBeGreaterThan(0)
    expect(portalTodos(lost('price'), 'hillside').filter((t) => t.projectId === 'boerne')).toEqual([])
  })

  it('says we did not win, or that the project died, and never the price or who won', () => {
    const won = portalMessages(lost('price'), 'hillside').find((m) => m.kind === 'closed')
    expect(won?.lines.slice(1)).toEqual([
      'This is about Sitework on Boerne Retail Shell.',
      'Click did not win this project.',
      'You do not need to send a number. Thank you for your time.',
    ])
    expect(won?.lines.join(' ')).not.toMatch(/Hill Country|lower number/)
    const died = portalMessages(lost('project_died'), 'lonestar').find((m) => m.kind === 'closed')
    expect(died?.lines.slice(2)).toEqual(['The owner stopped this project or put it on hold.', 'Thank you for your number.'])
  })

  it('emails each company still on a trade there the day it is marked, in its language, and not one that passed', () => {
    const m = portalMessages(lost('price'), 'hillside').find((x) => x.kind === 'closed')
    expect(m).toMatchObject({ on: state.today, projectId: 'boerne', subject: 'Boerne Retail Shell: Click is not building it' })
    expect(portalMessages(lost('price'), 'comal').some((x) => x.kind === 'closed')).toBe(false)
    const es = gcReducer(lost('price'), { type: 'setPartnerLanguage', partnerId: 'hillside', lang: 'es' })
    expect(portalMessages(es, 'hillside').find((x) => x.kind === 'closed')?.subject).toBe('Boerne Retail Shell: Click no lo va a construir')
  })

  it('opens again when the office brings it back', () => {
    const back = gcReducer(lost('price'), { type: 'reopenLost', projectId: 'boerne' })
    expect(home('hillside', back).bidding.some((a) => a.project.id === 'boerne')).toBe(true)
    expect(portalMessages(back, 'hillside').some((x) => x.kind === 'closed')).toBe(false)
  })
})

describe('the punch list on the home', () => {
  const punch = (s: GcState) => portalTodos(s, 'guadalupe').find((t) => t.key.endsWith(':punch'))

  it('asks Guadalupe to fix the one open item on Fair Oaks D, amber', () => {
    expect(punch(state)).toMatchObject({ projectId: 'fairoaksd', tone: 'amber', text: '1 punch item to fix on Concrete for Fair Oaks Shops, Building D.' })
  })

  it('turns red and says so when we checked one and it was not fixed', () => {
    const back = gcReducer(state, { type: 'checkPunchItem', projectId: 'fairoaksd', itemId: 'fairoaksd-punch-2', fixed: false, note: 'Still cracked by the door.' })
    expect(punch(back)).toMatchObject({
      tone: 'red',
      text: '2 punch items to fix on Concrete for Fair Oaks Shops, Building D. Click checked one and it is not fixed yet.',
    })
  })

  it('goes away once every item is marked fixed', () => {
    const fixed = gcReducer(state, { type: 'tradeFixPunchItem', projectId: 'fairoaksd', itemId: 'fairoaksd-punch-1' })
    expect(punch(fixed)).toBeUndefined()
  })

  it('reads in Spanish with the Building lane’s word for a punch item', () => {
    expect(portalTodos(state, 'guadalupe', undefined, 'es').find((t) => t.key.endsWith(':punch'))?.text).toBe(
      'Tiene 1 pendiente por arreglar en Concrete para Fair Oaks Shops, Building D.',
    )
  })
})

describe('not in your scope', () => {
  // The made-up projects carry no list; New Project fills one from the trade's usual list.
  const withList = (excludes: { label: string; by: string }[]): GcState => ({
    ...state,
    projects: state.projects.map((p) =>
      p.id !== 'boerne' ? p : { ...p, packages: p.packages.map((k) => (k.id === 'elec' ? { ...k, excludes } : k)) },
    ),
  })
  const list = [
    { label: 'Gas piping', by: 'HVAC' },
    { label: 'Fire caulking', by: 'Fire sprinkler' },
    { label: 'Temporary power', by: 'us' },
    { label: 'Utility company fees', by: 'the owner' },
    { label: '  ', by: 'HVAC' },
    { label: 'Trenching', by: '' },
  ]
  const elec = (s: GcState) => s.projects.find((p) => p.id === 'boerne')!.packages.find((k) => k.id === 'elec')!

  it('says what the number leaves out and who does it, a trade in lower case with HVAC kept', () => {
    expect(portalLeavesOut(elec(withList(list)))).toEqual([
      'Gas piping (HVAC does it)',
      'Fire caulking (fire sprinkler does it)',
      'Temporary power (Click does it)',
      'Utility company fees (the owner does it)',
      'Trenching',
    ])
  })

  it('reads in Spanish with the trade as typed', () => {
    expect(portalLeavesOut(elec(withList(list)), 'es').slice(0, 4)).toEqual([
      'Gas piping (lo hace HVAC)',
      'Fire caulking (lo hace Fire sprinkler)',
      'Temporary power (lo hace Click)',
      'Utility company fees (lo hace el dueño)',
    ])
  })

  it('rides in the invitation, and an older project without a list says nothing', () => {
    const invite = (s: GcState) => portalMessages(s, 'voltage').find((m) => m.kind === 'invite' && m.projectId === 'boerne')
    expect(invite(withList(list))?.leavesOut?.[0]).toBe('Gas piping (HVAC does it)')
    expect(invite(state)).not.toHaveProperty('leavesOut')
    expect(portalLeavesOut(elec(state))).toEqual([])
  })
})

describe('a sheet a newer set took out', () => {
  // Addendum 2 on Boerne takes E-301 out. Voltage priced Electrical on the Bid set.
  const takeOut = (s: GcState): GcState =>
    gcReducer(s, {
      type: 'issuePlanSet',
      projectId: 'boerne',
      label: 'Addendum 2',
      note: 'The panel schedules move onto E-201.',
      sheets: ['E-201', 'E-301'],
      addedSheets: [],
      touches: ['elec'],
      recipients: [],
      newTrades: [],
      removedSheets: ['E-301'],
    })
  const withSheets = (s: GcState): GcState => ({
    ...s,
    projects: s.projects.map((p) =>
      p.id !== 'boerne'
        ? p
        : { ...p, packages: p.packages.map((k) => (k.id !== 'elec' ? k : { ...k, scope: k.scope.map((it, i) => (i === 1 ? { ...it, sheets: ['E-301'] } : it)) })) },
    ),
  })
  const read = (s: GcState) => {
    const project = s.projects.find((p) => p.id === 'boerne')!
    const pkg = project.packages.find((k) => k.id === 'elec')!
    return portalLines(project, pkg, pkg.invites.find((i) => i.partnerId === 'voltage')!)
  }

  it('is no changed sheet to open: a line that named it shows it taken out', () => {
    const r = read(takeOut(withSheets(state)))
    const line = r.lines[1]!
    expect(line.gone).toEqual(['E-301'])
    expect(line.changed).not.toContain('E-301')
    expect(r.otherSheets).not.toContain('E-301')
  })

  it('is listed once as the trade’s, when no line named it', () => {
    const r = read(takeOut(state))
    expect(r.goneSheets).toEqual(['E-301'])
    expect(r.lines.every((l) => l.gone.length === 0)).toBe(true)
    expect(r.otherSheets).not.toContain('E-301')
  })

  it('has nothing taken out before the set goes out', () => {
    expect(read(state).goneSheets).toEqual([])
  })
})

describe('a line’s spec sections on the bid form', () => {
  // The made-up projects have no manual: give Boerne one, and two Electrical lines a section each.
  const withManual: GcState = {
    ...state,
    projects: state.projects.map((p) =>
      p.id !== 'boerne'
        ? p
        : {
            ...p,
            specs: [
              { id: '26 05 19', title: 'Low-voltage wire' },
              { id: '26 24 16', title: 'Panelboards' },
            ],
            packages: p.packages.map((k) =>
              k.id !== 'elec' ? k : { ...k, scope: k.scope.map((it, i) => (i === 0 ? { ...it, specs: ['26 05 19'] } : i === 1 ? { ...it, specs: ['26 24 16'] } : it)) },
            ),
          },
    ),
  }
  const read = (s: GcState) => {
    const project = s.projects.find((p) => p.id === 'boerne')!
    const pkg = project.packages.find((k) => k.id === 'elec')!
    return portalLines(project, pkg, pkg.invites.find((i) => i.partnerId === 'voltage')!)
  }

  it('shows the sections the office set, with their titles, and none on a line without', () => {
    const r = read(withManual)
    expect(r.lines[1]!.specs).toEqual([{ id: '26 24 16', title: 'Panelboards', changed: false, gone: false }])
    expect(r.lines[2]!.specs).toEqual([])
  })

  it('reads a renamed section’s new title, marks it revised, and the line as touched', () => {
    const later = gcReducer(withManual, {
      type: 'issuePlanSet',
      projectId: 'boerne',
      label: 'Addendum 2',
      note: 'Switchboard added.',
      sheets: [],
      addedSheets: [],
      touches: ['elec'],
      recipients: [],
      newTrades: [],
      specs: ['26 24 16', '26 05 19'],
      retitledSpecs: [{ id: '26 24 16', title: 'Panelboards and switchboards' }],
      removedSpecs: ['26 05 19'],
    })
    const r = read(later)
    expect(r.lines[1]!.specs).toEqual([{ id: '26 24 16', title: 'Panelboards and switchboards', changed: true, gone: false }])
    expect(r.lines[1]!.by).toContain('Addendum 2')
    expect(r.lines[0]!.specs).toEqual([{ id: '26 05 19', title: 'Low-voltage wire', changed: false, gone: true }])
  })
})
