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
  onSite,
  pWeekday,
  pDate,
  portalLeavesOut,
  portalLink,
  portalOnSite,
  portalQuoteDue,
  portalExclusionChoices,
  portalExclusionWords,
  portalSowExcluded,
  portalPreBid,
  portalSovCheck,
  portalSovReached,
  portalSovStart,
  claimedToDate,
  portalPapers,
  portalPromises,
  portalVetting,
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
  changeRequestState,
  openChangeRequests,
  portalCanAskChange,
  portalChangeRequests,
  backChargeCanTake,
  portalBackCharges,
  mailRecipients,
  portalMailGroup,
  portalWeeks,
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
    expect(todos[0]?.text).toBe('You said your Sitework quote for Boerne Retail Shell would come Wed Sep 30. Send it or give a new day.')
    expect(todos.slice(1).map((t) => t.key)).toEqual(['coi', 'w9'])
  })

  it('makes the master agreement red once a statement of work waits on it', () => {
    // Kendall: master agreement sent, Helotes HVAC awarded with its statement of work still a draft.
    expect(home('kendall').todos.find((t) => t.key === 'msa')?.tone).toBe('amber')
    const sent = gcReducer(state, { type: 'sendSow', projectId: 'helotes', packageId: 'dhvac' })
    expect(home('kendall', sent).todos[0]).toMatchObject({ key: 'msa', tone: 'red' })
  })

  it('asks Alamo to answer the rebar line the office could not read', () => {
    expect(home('alamo').todos.map((t) => t.text)).toEqual(['Answer one line of your Concrete quote for Boerne Retail Shell.'])
  })

  it('asks a company that never opened the plans to open them and send its number', () => {
    // Bexar Steel Erectors was asked on Boerne structural steel and has not opened the plans.
    expect(home('bexar').todos.map((t) => t.text)).toEqual(['Open the plans and send your Structural steel quote for Boerne Retail Shell by Mon Oct 5.'])
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
      text: 'You told Click your quote would come by Wed Sep 30. That day passed 2 days ago. Send your quote or give a new day.',
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
    expect(invite?.subject).toBe('Click Construction asks you to quote Electrical on Boerne Retail Shell')
    // The day we want quotes by: three days before our bid is due Thu Oct 8 (owner, 2026-10-04).
    expect(invite?.lines).toContain('Your quote is due Mon Oct 5.')
    expect(invite?.scope?.length).toBeGreaterThan(0)
    expect(invite).not.toHaveProperty('text')
  })

  it('tells Hillside the new set does not change Sitework, and Voltage that it changes Electrical', () => {
    const plans = (id: string) => {
      const lines = portalMessages(state, id).find((m) => m.kind === 'plans')?.lines ?? []
      return lines[lines.length - 1]
    }
    expect(plans('hillside')).toBe('It does not change Sitework. Open it so you price on the newest set.')
    expect(plans('voltage')).toBe('It changes Electrical. Open it, then confirm your quote or change it.')
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
      'Your Sitework quote for Boerne Retail Pad B ran out Sat Oct 17. Send it again to keep it good.',
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
      'You do not need to send a quote. Thank you for your time.',
    ])
    expect(won?.lines.join(' ')).not.toMatch(/Hill Country|lower number/)
    const died = portalMessages(lost('project_died'), 'lonestar').find((m) => m.kind === 'closed')
    expect(died?.lines.slice(2)).toEqual(['The customer stopped this project or put it on hold.', 'Thank you for your quote.'])
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

  it('counts a line that names no section as touched by its trade’s revised section, as the office does', () => {
    const later = gcReducer(withManual, {
      type: 'issuePlanSet',
      projectId: 'boerne',
      label: 'Addendum 2',
      note: 'Panel schedule revised.',
      sheets: [],
      addedSheets: [],
      touches: ['elec'],
      recipients: [],
      newTrades: [],
      specs: ['26 24 16'],
    })
    const r = read(later)
    // Line 0 names another section, so this set does not reach it (Addendum 1's sheets still do); line 2 names none, so it does.
    expect(r.lines[0]!.by).not.toContain('Addendum 2')
    expect(r.lines[2]!.specs).toEqual([])
    expect(r.lines[2]!.by).toContain('Addendum 2')
  })
})

describe('days on site, from our daily log', () => {
  const fair = state.projects.find((p) => p.id === 'fairoaksd')!
  const pkg = (id: string) => fair.packages.find((k) => k.id === id)!

  it('counts the days the log has Summit’s roofers there, and the last one', () => {
    const first = (fair.dailyLogs ?? []).map((l) => l.date).sort()[0]!
    const { days } = onSite(fair, 'froof', first, state.today)
    expect(days.length).toBeGreaterThan(1)
    expect(portalOnSite(fair, pkg('froof'), state.today)).toBe(
      `Our daily log has you on site ${days.length} days since ${pWeekday('en', first)}, the last on ${pWeekday('en', days[days.length - 1]!)}.`,
    )
  })

  it('names the log’s first day when it never had the company there, and says nothing on a job with no log', () => {
    // Guadalupe's concrete was done before the made-up log begins: the line must not say it never came.
    expect(portalOnSite(fair, pkg('fconc'), state.today)).toBe('Our daily log has not had you on site since Mon Sep 21.')
    const helotes = state.projects.find((p) => p.id === 'helotes')!
    expect(portalOnSite(helotes, helotes.packages[0]!, state.today)).toBeNull()
  })

  it('reads in Spanish', () => {
    expect(portalOnSite(fair, pkg('froof'), state.today, 'es')).toMatch(/^Nuestro registro diario lo tiene en la obra \d+ días desde el lun 21 sep, el último el \S+ \d+ \S+\.$/)
  })
})

describe('a company we did not know', () => {
  // The office adds a stranger and asks it to quote Boerne's steel (question 3).
  const added = gcReducer(state, { type: 'addPartner', company: 'Brazos Steel', contact: 'Lupe Garza', trade: 'Structural steel', base: null, maxMiles: null, known: false })
  const id = added.partners[added.partners.length - 1]!.id
  const asked = gcReducer(added, { type: 'invite', projectId: 'boerne', packageId: 'steel', partnerId: id })
  const sent = gcReducer(asked, {
    type: 'tradeVettingForm',
    partnerId: id,
    form: { license: 'TX 12345', insurance: 'Lone Star Mutual, $1M / $2M', yearsInBusiness: 12, references: 'Ana Ruiz 210-555-0100', pastJobs: 'Two retail shells in Seguin' },
  })
  const partner = (s: GcState) => s.partners.find((p) => p.id === id)!

  it('asks for its form first, and a known company is asked for nothing', () => {
    expect(portalVetting(partner(asked))).toEqual({ state: 'send', words: 'not sent yet' })
    expect(portalTodos(asked, id).find((t) => t.key === 'vet')).toMatchObject({ tone: 'amber', text: 'Tell Click about your company. Click can pick your quote once you are approved.' })
    expect(portalVetting(state.partners.find((p) => p.id === 'lonestar')!).state).toBe('known')
  })

  it('says the office is checking it once the form is in, and stops asking', () => {
    expect(portalVetting(partner(sent))).toEqual({ state: 'checking', words: `Click is checking it · sent ${pDate('en', state.today)}` })
    expect(portalTodos(sent, id).some((t) => t.key === 'vet')).toBe(false)
  })

  it('shows an approval up to a limit, and emails it', () => {
    const ok = gcReducer(sent, { type: 'vetPartner', partnerId: id, status: 'approved', limit: 150_000, by: 'Dana Whitaker' })
    expect(portalVetting(partner(ok)).words).toBe('approved for jobs up to $150,000 each')
    const m = portalMessages(ok, id).find((x) => x.kind === 'vetted')
    expect(m?.subject).toBe('Your company is approved to work with Click')
    expect(m?.lines.slice(1)).toEqual(['Click checked your company and approved it.', 'You can be picked for jobs up to $150,000 each.'])
  })

  it('reads in Spanish', () => {
    expect(portalVetting(partner(sent), 'es').words).toBe(`Click la está revisando · enviada el ${pDate('es', state.today)}`)
  })
})

describe('the dates a company gave us', () => {
  // Voltage's insurance ran out Sep 15; it says the new certificate comes Oct 9 (question 8).
  const gave = gcReducer(state, { type: 'recordPromise', partnerId: 'voltage', kind: 'insurance', by: '2026-10-09', from: 'trade' })

  it('lists an open date with what it is for and how far off it is', () => {
    expect(portalPromises(gave, 'voltage').map((r) => [r.what, r.words, r.tone])).toEqual([
      ['The renewed insurance certificate', 'by Fri Oct 9, in 7 days', 'plain'],
    ])
    expect(portalPromises(state, 'voltage')).toEqual([])
  })

  it('turns red under Needs you once the day passes, and goes when it is kept', () => {
    const later = { ...gave, today: '2026-10-11' }
    expect(portalPromises(later, 'voltage')[0]?.words).toBe('by Fri Oct 9. That day passed 2 days ago.')
    expect(portalTodos(later, 'voltage').find((t) => t.key.startsWith('promise:'))).toMatchObject({
      tone: 'red',
      text: 'You told Click the renewed insurance certificate would come by Fri Oct 9. Send it or give a new day.',
    })
    const kept = gcReducer(later, { type: 'tradeUploadCoi', partnerId: 'voltage', expires: '2027-10-01' })
    expect(portalPromises(kept, 'voltage')).toEqual([])
  })

  it('moves to the new day the company gives', () => {
    const moved = gcReducer(gave, { type: 'recordPromise', partnerId: 'voltage', kind: 'insurance', by: '2026-10-16', from: 'trade' })
    expect(portalPromises(moved, 'voltage').map((r) => r.p.by)).toEqual(['2026-10-16'])
  })

  it('reads in Spanish', () => {
    expect(portalPromises(gave, 'voltage', 'es')[0]).toMatchObject({ what: 'El certificado de seguro renovado', words: 'a más tardar el vie 9 oct, en 7 días' })
  })

  it('says whether the company gave the day or Click asked for it when it sent a paper', () => {
    expect(portalPromises(gave, 'voltage')[0]).toMatchObject({ source: 'said', sourceWords: 'You gave this day' })
    // The office asks Hillside (no W-9 on file) for one by Oct 12 from its company window.
    const asked = gcReducer(state, { type: 'sendPaper', partnerId: 'hillside', paper: 'w9', by: '2026-10-12', note: '' })
    const row = portalPromises(asked, 'hillside').find((r) => r.p.kind === 'w9')
    expect(row).toMatchObject({ source: 'asked', sourceWords: 'Click asked for this day' })
    // Hillside moves it: now it is a day the company gave.
    const moved = gcReducer(asked, { type: 'recordPromise', partnerId: 'hillside', kind: 'w9', by: '2026-10-16', from: 'trade' })
    expect(portalPromises(moved, 'hillside').find((r) => r.p.kind === 'w9')?.source).toBe('said')
  })
})

describe('submittals to send, on the home', () => {
  const sub = (s: GcState) => portalTodos(s, 'coolbreeze').find((t) => t.key.endsWith(':submittals'))

  it('asks Cool Breeze for its controls shop drawings, landing on the block that holds them', () => {
    const t = sub(state)
    expect(t).toMatchObject({ projectId: 'fairoaksd', anchor: 'report:fhvac' })
    expect(t?.text.startsWith('1 submittal to send for HVAC on Fair Oaks Shops, Building D.')).toBe(true)
  })

  it('turns red and says so when the architect sent one back to revise', () => {
    // Its rooftop units come back to revise.
    const back: GcState = {
      ...state,
      projects: state.projects.map((p) =>
        p.id !== 'fairoaksd'
          ? p
          : {
              ...p,
              submittals: (p.submittals ?? []).map((x) =>
                x.id !== 'fairoaksd-sub-3' ? x : { ...x, rounds: x.rounds.map((r) => ({ ...r, answer: 'revise' as const, answerNote: 'Show the curb detail.' })) },
              ),
            },
      ),
    }
    const t = sub(back)
    expect(t?.tone).toBe('red')
    expect(t?.text).toContain('2 submittals to send for HVAC on Fair Oaks Shops, Building D. Click sent one back to revise.')
  })

  it('says nothing to a company with none to send, and reads in Spanish', () => {
    expect(portalTodos(state, 'summit').some((t) => t.key.endsWith(':submittals'))).toBe(false)
    expect(portalTodos(state, 'coolbreeze', undefined, 'es').find((t) => t.key.endsWith(':submittals'))?.text).toMatch(
      /^Tiene 1 documento para aprobación por enviar de HVAC para Fair Oaks Shops, Building D\./,
    )
  })
})

describe('Your papers', () => {
  it('lists Guadalupe’s own papers, then its Fair Oaks job’s, newest first', () => {
    const p = portalPapers(state, 'guadalupe')
    expect(p.company.map((x) => x.title)).toEqual(['Master agreement', 'W-9', 'Insurance certificate'])
    expect(p.company[0]).toMatchObject({ words: 'signed Jun 12', open: { kind: 'msa' } })
    const job = p.jobs[0]!
    expect(`${job.project.name} · ${job.trade}`).toBe('Fair Oaks Shops, Building D · Concrete')
    expect(job.papers.map((x) => `${x.title} | ${x.words}`)).toEqual([
      'Unconditional waiver, pay application 2 | signed after we paid Sep 7',
      'Pay application 2 | sent Aug 29 · paid Sep 7',
      'Conditional waiver, pay application 2 | signed Aug 29',
      'Unconditional waiver, pay application 1 | signed after we paid Aug 9',
      'Pay application 1 | sent Jul 31 · paid Aug 9',
      'Conditional waiver, pay application 1 | signed Jul 31',
      'Concrete statement of work | signed Jun 9',
    ])
    // A pay application and its waivers open the application; the statement of work opens the job.
    expect(job.papers[1]!.open).toMatchObject({ kind: 'payApp', projectId: 'fairoaksd', packageId: 'fconc' })
    expect(job.papers[6]!.open).toEqual({ kind: 'project', projectId: 'fairoaksd' })
  })

  it('has no job papers for a company whose statement of work is not signed yet', () => {
    expect(portalPapers(state, 'brightline').jobs).toEqual([])
  })

  it('adds a new company’s form once it is sent, and reads in Spanish', () => {
    const added = gcReducer(state, { type: 'addPartner', company: 'Brazos Steel', contact: 'Lupe Garza', trade: 'Structural steel', base: null, maxMiles: null, known: false })
    const id = added.partners[added.partners.length - 1]!.id
    const sent = gcReducer(added, { type: 'tradeVettingForm', partnerId: id, form: { license: 'TX 1', insurance: 'Mutual', yearsInBusiness: 3, references: 'Ana', pastJobs: 'Seguin' } })
    expect(portalPapers(sent, id).company.map((x) => x.title)).toEqual(['Your company form'])
    expect(portalPapers(state, 'guadalupe', 'es').jobs[0]!.papers[0]!.title).toBe('Renuncia incondicional, solicitud de pago 2')
  })
})

describe('the trade’s own schedule of values', () => {
  it('starts with the three stages, in the portal’s language', () => {
    expect(portalSovStart()).toEqual(['Rough-in', 'Top out', 'Trim'])
    expect(portalSovStart('es')).toEqual(['Obra negra', 'Antes de cerrar muros', 'Acabados'])
  })

  it('sends none when nothing is typed, and says how far off the lines are', () => {
    expect(portalSovCheck([{ label: 'Rough-in', amount: 0 }], 100_000).state).toBe('empty')
    expect(portalSovCheck([{ label: 'Rough-in', amount: 40_000 }, { label: 'Trim', amount: 50_000 }], 100_000)).toMatchObject({
      state: 'short',
      words: 'Your lines add up to $90,000. That is $10,000 short.',
    })
    expect(portalSovCheck([{ label: 'Rough-in', amount: 60_000 }, { label: 'Trim', amount: 50_000 }], 100_000).state).toBe('over')
    const ok = portalSovCheck([{ label: ' Rough-in ', amount: 60_000 }, { label: 'Trim', amount: 40_000 }, { label: '', amount: 5 }], 100_000)
    expect(ok).toMatchObject({ state: 'ok', lines: [{ label: 'Rough-in', amount: 60_000 }, { label: 'Trim', amount: 40_000 }] })
  })

  it('says where Pecan Valley’s billing stands on its own lines', () => {
    const pkg = state.projects.find((p) => p.id === 'fairoaksd')!.packages.find((k) => k.id === 'felec')!
    const lines = pkg.sow!.theirSov!
    const words = portalSovReached(lines, claimedToDate(pkg.sow!))
    expect(words).toMatch(/^Billed \$[\d,]+ to date: /)
    expect(portalSovReached(lines, 0)).toBe('Nothing billed yet.')
    expect(portalSovReached([{ label: 'Rough-in', amount: 50_000 }, { label: 'Top out', amount: 50_000 }], 60_000, 'es')).toBe(
      'Facturado $60,000 a la fecha: completo hasta Rough-in, 20% de Top out.',
    )
  })

  it('keeps the schedule the company sends with its quote', () => {
    const inv = state.projects.find((p) => p.id === 'boerne')!.packages.find((k) => k.id === 'steel')!.invites.find((i) => i.partnerId === 'bexar')!
    const sent = gcReducer(state, {
      type: 'tradeSubmitBid',
      projectId: 'boerne',
      packageId: 'steel',
      inviteId: inv.id,
      amount: 150_000,
      includes: {},
      note: '',
      sov: [
        { label: 'Rough-in', amount: 100_000 },
        { label: 'Trim', amount: 50_000 },
      ],
    })
    const bid = sent.projects.find((p) => p.id === 'boerne')!.packages.find((k) => k.id === 'steel')!.invites.find((i) => i.partnerId === 'bexar')!.bid
    expect(bid?.sov).toEqual([
      { label: 'Rough-in', amount: 100_000 },
      { label: 'Trim', amount: 50_000 },
    ])
  })
})

describe('the pre-bid meeting in the portal', () => {
  const set = gcReducer(state, { type: 'schedulePreBid', projectId: 'boerne', on: '2026-10-06', at: '10:00', place: 'the site', host: 'architect', mandatory: true })
  const boerne = (s: GcState) => s.projects.find((p) => p.id === 'boerne')!

  it('tells a company still quoting when and where, and that it is required', () => {
    expect(portalPreBid(set, boerne(set), 'lonestar')).toMatchObject({
      when: 'Tue Oct 6 at 10 AM, at the site.',
      host: 'Run by Marsh & Vale Architects.',
      rule: 'You have to come to quote this project.',
      after: 'Bring your questions about the plans.',
    })
    // Comal passed on its trade: it is not asked.
    expect(portalPreBid(set, boerne(set), 'comal')).toBeNull()
    expect(portalPreBid(state, boerne(state), 'lonestar')).toBeNull()
  })

  it('asks under Needs you before it, and emails the invitation', () => {
    expect(portalTodos(set, 'lonestar').find((t) => t.key === 'prebid:boerne')).toMatchObject({
      tone: 'amber',
      text: 'Come to the pre-bid meeting for Boerne Retail Shell, Tue Oct 6 at 10 AM. It is required to quote.',
    })
    const m = portalMessages(set, 'lonestar').find((x) => x.kind === 'preBid')
    expect(m?.subject).toBe('Boerne Retail Shell: pre-bid meeting Tue Oct 6, required to quote')
    expect(m?.lines.slice(1, 4)).toEqual(['You are invited to the pre-bid meeting for Boerne Retail Shell.', 'When: Tue Oct 6 at 10 AM.', 'Where: the site.'])
    expect(m?.on).toBe(state.today)
    // Moved a day later: the invitation is dated the day it moved.
    const moved = gcReducer({ ...set, today: '2026-10-03' }, { type: 'schedulePreBid', projectId: 'boerne', on: '2026-10-07', at: '10:00', place: 'the site', host: 'architect', mandatory: true })
    expect(portalMessages(moved, 'lonestar').find((x) => x.kind === 'preBid')?.on).toBe('2026-10-03')
  })

  it('says who came once it is held, and flags a required one missed in red', () => {
    const held = gcReducer(set, { type: 'recordPreBidAttendance', projectId: 'boerne', partnerIds: ['lonestar'] })
    expect(portalPreBid(held, boerne(held), 'lonestar')?.after).toBe('You came. Thank you.')
    expect(portalPreBid(held, boerne(held), 'tricounty')?.missed).toBe(true)
    expect(portalTodos(held, 'tricounty').find((t) => t.key === 'prebid:boerne')).toMatchObject({ tone: 'red', text: 'You missed the required pre-bid meeting for Boerne Retail Shell. Call Click.' })
    expect(portalTodos(held, 'lonestar').some((t) => t.key === 'prebid:boerne')).toBe(false)
  })

  it('reads in Spanish, the time in Spanish too', () => {
    expect(portalPreBid(set, boerne(set), 'lonestar', 'es')?.when).toBe('mar 6 oct a las 10 a. m., en the site.')
    // The Spanish time ends "m.": no sentence adds a second period after it.
    const es = [...portalTodos(set, 'lonestar', undefined, 'es').map((t) => t.text), ...(portalMessages(set, 'lonestar', 'es').find((x) => x.kind === 'preBid')?.lines ?? [])]
    expect(es.filter((x) => x.includes('m..'))).toEqual([])
  })
})

describe('what a company’s quote leaves out', () => {
  const boerne = (s: GcState) => s.projects.find((p) => p.id === 'boerne')!
  const steel = (s: GcState) => boerne(s).packages.find((k) => k.id === 'steel')!

  it('offers the trade’s usual exclusions first, then everyone’s', () => {
    const choices = portalExclusionChoices(state, steel(state))
    expect(choices.slice(0, 3)).toEqual(['Crane', 'Fireproofing', 'Touch-up paint'])
    expect(choices).toContain('Sales tax')
  })

  it('says them in a sentence, with a unit price where one was given, in both languages', () => {
    const list = [{ name: 'Rock excavation', unitPrice: { amount: 38, unit: 'cy' } }, { name: 'Sales tax' }]
    expect(portalExclusionWords(list)).toBe('rock excavation ($38 per cy if it comes up) and sales tax')
    expect(portalExclusionWords(list, 'es')).toBe('excavación en roca ($38 por cy si se necesita) y impuesto sobre ventas')
  })

  it('keeps what the quote left out and every tick answered, and the award carries it to the statement of work', () => {
    const inv = steel(state).invites.find((i) => i.partnerId === 'bexar')!
    const sent = gcReducer(state, {
      type: 'tradeSubmitBid',
      projectId: 'boerne',
      packageId: 'steel',
      inviteId: inv.id,
      amount: 160_000,
      includes: {},
      note: '',
      exclusions: [{ name: 'Crane' }, { name: 'Fireproofing', unitPrice: { amount: 4, unit: 'sf' } }],
      exclusionsAnswered: ['Crane', 'Fireproofing', 'Touch-up paint', 'Sales tax'],
    })
    const bid = steel(sent).invites.find((i) => i.partnerId === 'bexar')!.bid!
    expect(bid.exclusions?.map((e) => e.name)).toEqual(['Crane', 'Fireproofing'])
    expect(bid.exclusionsAnswered).toContain('Sales tax')
    const won = gcReducer(sent, { type: 'award', projectId: 'boerne', packageId: 'steel', inviteId: inv.id })
    const sow = steel(won).sow
    expect(sow && portalSowExcluded(sow)).toEqual(['Crane', 'Fireproofing, $4 per sf if it comes up'])
  })
})

describe('the day a quote is due', () => {
  const boerne = state.projects.find((p) => p.id === 'boerne')!

  it('is the day we want quotes by, three days before our bid is due', () => {
    expect(boerne.bidDue).toBe('2026-10-08')
    expect(portalQuoteDue(boerne)).toBe('2026-10-05')
  })

  it('gives a company asked after that day our bid day in its invitation', () => {
    const late = gcReducer({ ...state, today: '2026-10-06' }, { type: 'invite', projectId: 'boerne', packageId: 'steel', partnerId: 'ironhorse' })
    const m = portalMessages(late, 'ironhorse').find((x) => x.kind === 'invite' && x.projectId === 'boerne')
    expect(m?.lines).toContain('Your quote is due Thu Oct 8.')
  })
})

describe('a trade asks for a change (owner, 2026-10-04)', () => {
  const fairOaks = (s: GcState) => {
    const project = s.projects.find((p) => p.id === 'fairoaksd')
    const pkg = project?.packages.find((k) => k.id === 'fsite')
    if (!project || !pkg) throw new Error('no Fair Oaks sitework')
    return { project, pkg }
  }
  const rows = (s: GcState, lang: 'en' | 'es' = 'en') => {
    const { project, pkg } = fairOaks(s)
    return portalChangeRequests(project, pkg, 'tricounty', lang)
  }

  it('shows Tri-County the rock it asked about, waiting on us', () => {
    const [row] = rows(state)
    expect(row).toMatchObject({ state: 'asked', chip: 'sent', why: 'Something on site no one could see', asked: 'You asked $14,820 · sent Sep 30 · +2 working days', words: 'Click is looking at it.' })
    expect(openChangeRequests(fairOaks(state).project).map((r) => r.id)).toEqual(['fairoaksd-cr-1'])
    expect(rows(state, 'es')[0]).toMatchObject({ chip: 'enviado', asked: 'Pidió $14,820 · enviado el 30 sep · +2 días hábiles', words: 'Click lo está revisando.' })
  })

  it('lets only the company on a signed statement of work ask', () => {
    const { project, pkg } = fairOaks(state)
    expect(portalCanAskChange(project, pkg, 'tricounty')).toBe(true)
    expect(portalCanAskChange(project, pkg, 'hillside')).toBe(false)
    const helotes = state.projects.find((p) => p.id === 'helotes')
    const sent = helotes?.packages.find((k) => k.id === 'delec')
    if (!helotes || !sent) throw new Error('no Helotes electrical')
    expect(portalCanAskChange(helotes, sent, 'brightline')).toBe(false)

    const askAs = (partnerId: string, description = 'Owner wants two more yard lights', amount = 3_400) =>
      gcReducer(state, { type: 'tradeAskChange', projectId: 'fairoaksd', packageId: 'fsite', partnerId, description, reason: 'owner', amount, days: 0, file: null })
    expect(askAs('hillside')).toBe(state)
    expect(askAs('tricounty', '  ')).toBe(state)
    expect(askAs('tricounty', 'Two more yard lights', 0)).toBe(state)

    const asked = askAs('tricounty')
    expect(rows(asked).map((r) => r.request.id)).toEqual(['fairoaksd-cr-2', 'fairoaksd-cr-1'])
    expect(rows(asked)[0]).toMatchObject({ why: 'The customer asked for more', asked: 'You asked $3,400 · sent Oct 2' })
    expect(asked.log[0]).toMatchObject({ who: 'trade', text: 'Tri-County Site asked for a change on Fair Oaks Shops, Building D: Owner wants two more yard lights, $3,400.' })
  })

  it('tells the company why we turned it down, on the page and by email', () => {
    const noNote = gcReducer(state, { type: 'turnDownChangeRequest', projectId: 'fairoaksd', requestId: 'fairoaksd-cr-1', note: ' ' })
    expect(noNote).toBe(state)
    const down = gcReducer(state, { type: 'turnDownChangeRequest', projectId: 'fairoaksd', requestId: 'fairoaksd-cr-1', note: 'The soils report showed rock there, so it was in your quote.' })
    expect(rows(down)[0]).toMatchObject({ state: 'turnedDown', chip: 'turned down', words: 'Click turned it down on Oct 2: The soils report showed rock there, so it was in your quote.' })
    expect(openChangeRequests(fairOaks(down).project)).toEqual([])
    const m = portalMessages(down, 'tricounty').find((x) => x.key === 'fairoaksd-cr-1:down')
    expect(m?.subject).toBe('About the change you asked for on Fair Oaks Shops, Building D')
    expect(m?.lines.slice(1)).toEqual([
      'You asked for a change to your Sitework work: Rock at the north footings, about 390 cubic yards to break out and haul off, $14,820.',
      'We are not making it a change order: The soils report showed rock there, so it was in your quote.',
      'Open your portal to see where it stands.',
    ])
    // Once answered, it cannot be answered again.
    expect(gcReducer(down, { type: 'draftChangeOrderFromRequest', projectId: 'fairoaksd', requestId: 'fairoaksd-cr-1', description: 'Rock', cost: 14_820, price: 0, days: 2 })).toBe(down)
  })

  it('follows it through the change order to the customer and back to their signature, showing their part only', () => {
    const drafted = gcReducer(state, { type: 'draftChangeOrderFromRequest', projectId: 'fairoaksd', requestId: 'fairoaksd-cr-1', description: 'Break out and haul rock at the north footings', cost: 14_000, price: 0, days: 2 })
    const { project } = fairOaks(drafted)
    const co = project.changeOrders?.[0]
    expect(co).toMatchObject({ number: 1, packageId: 'fsite', reason: 'field', cost: 14_000, days: 2, status: 'draft' })
    expect(changeRequestState(project, project.changeRequests?.[0] ?? (null as never)).co?.id).toBe(co?.id)
    expect(rows(drafted)[0]).toMatchObject({ state: 'drafting', chip: 'being written up' })

    const sent = gcReducer(drafted, { type: 'sendChangeOrder', projectId: 'fairoaksd', changeOrderId: co?.id ?? '' })
    expect(rows(sent)[0]?.words).toBe('Click sent it to the customer as change order 1 on Oct 2. Your part: $14,000.')
    const sentMail = portalMessages(sent, 'tricounty').find((x) => x.key === 'fairoaksd-cr-1:sent')
    expect(sentMail?.subject).toBe('Your change on Fair Oaks Shops, Building D went to the customer')
    expect(sentMail?.lines).toContain('We sent it to the customer as change order 1. Your part: $14,000.')
    // Our price to the customer, with our fee, never reaches the trade.
    const price = `$${(co?.price ?? 0).toLocaleString('en-US')}`
    expect(co?.price).toBeGreaterThan(14_000)
    expect(JSON.stringify(portalMessages(sent, 'tricounty'))).not.toContain(price)
    expect(JSON.stringify(rows(sent))).not.toContain(price)

    const no = gcReducer(sent, { type: 'ownerDeclineChangeOrder', projectId: 'fairoaksd', changeOrderId: co?.id ?? '' })
    expect(rows(no)[0]).toMatchObject({ state: 'customerNo', words: 'The customer said no to change order 1 on Oct 2. Click will call you about what comes next.' })
    expect(portalMessages(no, 'tricounty').find((x) => x.key === 'fairoaksd-cr-1:no')?.subject).toBe('The customer said no to change order 1')

    const yes = gcReducer(sent, { type: 'ownerSignChangeOrder', projectId: 'fairoaksd', changeOrderId: co?.id ?? '' })
    expect(rows(yes)[0]).toMatchObject({ state: 'customerYes', chip: 'customer said yes' })
    const toSign = gcReducer(yes, { type: 'sendTradeChange', projectId: 'fairoaksd', changeOrderId: co?.id ?? '' })
    expect(rows(toSign)[0]).toMatchObject({ state: 'toSign', words: 'Change order 1 is ready for you to sign, above. Your part: $14,000.' })
    const signed = gcReducer(toSign, { type: 'tradeSignChange', projectId: 'fairoaksd', changeOrderId: co?.id ?? '' })
    expect(rows(signed)[0]).toMatchObject({ state: 'signed', words: 'You signed change order 1 on Oct 2. It is a line of your statement of work: $14,000.' })
    expect(rows(signed, 'es')[0]?.words).toBe('Firmó la orden de cambio 1 el 2 oct. Es una partida de su orden de trabajo: $14,000.')
  })
})

describe('back-charges a company can see (owner, 2026-10-05)', () => {
  const steel = (s: GcState) => {
    const project = s.projects.find((p) => p.id === 'fairoaksd')
    const pkg = project?.packages.find((k) => k.id === 'fsteel')
    if (!project || !pkg?.sow) throw new Error('no Fair Oaks steel')
    return { project, pkg, sow: pkg.sow }
  }
  const rows = (s: GcState, lang: 'en' | 'es' = 'en') => {
    const { project, pkg } = steel(s)
    return portalBackCharges(project, pkg, 'ironhorse', s.today, lang)
  }
  const ids = { projectId: 'fairoaksd', packageId: 'fsteel' }
  const charge = (s: GcState) => steel(s).sow.backCharges?.[0] ?? (null as never)

  it('shows Iron Horse the charge to answer, on its home and by email', () => {
    expect(rows(state)[0]).toMatchObject({ state: 'open', chip: 'answer by Oct 5', line: '$1,250 · sent Sep 30', canAnswer: true })
    expect(rows(state)[0]?.words).toBe('Agree, or dispute it and say why. With no answer by Oct 5, it can come off your next draw.')
    expect(portalTodos(state, 'ironhorse').find((t) => t.key === 'fsteel-bc-1:answer')).toMatchObject({
      text: 'Click charged you $1,250 on Fair Oaks Shops, Building D. Agree or dispute it by Mon Oct 5.',
      tone: 'amber',
      anchor: 'charges:fsteel',
    })
    const m = portalMessages(state, 'ironhorse').find((x) => x.key === 'fsteel-bc-1:sent')
    expect(m?.subject).toBe('A charge on Fair Oaks Shops, Building D: $1,250')
    expect(m?.lines.slice(1)).toEqual([
      'We are charging you $1,250 on your Structural steel work: Your crew cut the temporary power line on the north side while setting joists. Our electrician spliced it the same day.',
      'Agree or dispute it in your portal by Mon Oct 5. With no answer, it can come off your next draw.',
      'Open your portal to see it.',
    ])
    expect(rows(state, 'es')[0]).toMatchObject({ chip: 'conteste a más tardar el 5 oct', line: '$1,250 · enviado el 30 sep' })
    // Not before its answer day.
    expect(backChargeCanTake(charge(state), state.today)).toBe(false)
  })

  it('turns red once the answer day goes by, and can then come off a draw', () => {
    const later = { ...state, today: '2026-10-06' }
    expect(rows(later)[0]).toMatchObject({ state: 'noAnswer', chip: 'no answer', canAnswer: true })
    expect(portalTodos(later, 'ironhorse').find((t) => t.key === 'fsteel-bc-1:answer')?.tone).toBe('red')
    expect(backChargeCanTake(charge(later), later.today)).toBe(true)
  })

  it('lets the office charge only the company on a signed statement of work, with a reason and an amount', () => {
    const charged = (amount: number, reason: string, projectId = 'fairoaksd', packageId = 'fsteel') => gcReducer(state, { type: 'backCharge', projectId, packageId, amount, reason, photo: null })
    expect(charged(0, 'Cleanup')).toBe(state)
    expect(charged(400, '  ')).toBe(state)
    // Helotes electrical's statement of work is sent, not signed.
    expect(charged(400, 'Cleanup', 'helotes', 'delec')).toBe(state)
    const two = charged(400, 'Haul off the deck crates left at the loading dock')
    expect(charge(two)).toBeTruthy()
    expect(steel(two).sow.backCharges?.[1]).toMatchObject({ id: 'fsteel-bc-2', amount: 400, sentOn: '2026-10-02', answerBy: '2026-10-07', status: 'open', photo: null })
    expect(two.log[0]).toMatchObject({ who: 'office', text: 'Charged Iron Horse Fabrication $400 on Fair Oaks Shops, Building D: Haul off the deck crates left at the loading dock' })
  })

  it('takes an agreed charge off an approved draw, once, and tells them', () => {
    const agreed = gcReducer(state, { type: 'tradeAnswerBackCharge', ...ids, chargeId: 'fsteel-bc-1', agree: true, note: '' })
    expect(rows(agreed)[0]).toMatchObject({ state: 'agreed', chip: 'you agreed', canAnswer: false, words: 'You agreed on Oct 2. It comes off your next draw.' })
    expect(portalTodos(agreed, 'ironhorse').some((t) => t.key === 'fsteel-bc-1:answer')).toBe(false)
    // Draw 2 is only asked for: nothing to take it off yet.
    const early = gcReducer(agreed, { type: 'takeBackCharge', ...ids, chargeId: 'fsteel-bc-1', drawId: 'fsteel-draw-2' })
    expect(early).toBe(agreed)
    const approved = gcReducer(agreed, { type: 'approveDraw', ...ids, drawId: 'fsteel-draw-2' })
    const taken = gcReducer(approved, { type: 'takeBackCharge', ...ids, chargeId: 'fsteel-bc-1', drawId: 'fsteel-draw-2' })
    const draw = steel(taken).sow.draws.find((d) => d.id === 'fsteel-draw-2')
    expect(draw).toMatchObject({ net: 77_950, backCharges: [{ chargeId: 'fsteel-bc-1', amount: 1_250 }] })
    expect(rows(taken)[0]).toMatchObject({ state: 'taken', chip: 'taken off draw 2', words: 'Taken off draw 2 on Oct 2.' })
    expect(taken.log[0]?.text).toBe("Took the $1,250 back-charge off Iron Horse Fabrication's draw 2 on Fair Oaks Shops, Building D: $77,950 to pay.")
    expect(portalMessages(taken, 'ironhorse').find((x) => x.key === 'fsteel-bc-1:taken')?.subject).toBe('Draw 2 on Fair Oaks Shops, Building D is $1,250 less')
    expect(portalPay(taken, 'ironhorse').rows.find((r) => r.draw.id === 'fsteel-draw-2')?.draw.net).toBe(77_950)
    expect(gcReducer(taken, { type: 'takeBackCharge', ...ids, chargeId: 'fsteel-bc-1', drawId: 'fsteel-draw-2' })).toBe(taken)
  })

  it('answers a dispute: kept with our reason, or dropped', () => {
    expect(gcReducer(state, { type: 'tradeAnswerBackCharge', ...ids, chargeId: 'fsteel-bc-1', agree: false, note: ' ' })).toBe(state)
    const disputed = gcReducer(state, { type: 'tradeAnswerBackCharge', ...ids, chargeId: 'fsteel-bc-1', agree: false, note: 'The line was not marked and ran under the joist bundle' })
    expect(rows(disputed)[0]).toMatchObject({ state: 'disputed', chip: 'you disputed it', theirReason: 'Your reason: The line was not marked and ran under the joist bundle', words: 'You disputed it on Oct 2. Click answers next.' })
    expect(gcReducer(disputed, { type: 'settleBackCharge', ...ids, chargeId: 'fsteel-bc-1', keep: true, note: '' })).toBe(disputed)

    const kept = gcReducer(disputed, { type: 'settleBackCharge', ...ids, chargeId: 'fsteel-bc-1', keep: true, note: 'The line was flagged on the site plan your foreman signed' })
    expect(rows(kept)[0]).toMatchObject({ state: 'kept', chip: 'Click kept it', words: 'Click kept it on Oct 2: The line was flagged on the site plan your foreman signed. It comes off your next draw.' })
    expect(portalMessages(kept, 'ironhorse').find((x) => x.key === 'fsteel-bc-1:settled')?.lines[1]).toBe(
      'We read your reason and are keeping the $1,250 charge: The line was flagged on the site plan your foreman signed.',
    )
    expect(backChargeCanTake(charge(kept), kept.today)).toBe(true)

    const dropped = gcReducer(disputed, { type: 'settleBackCharge', ...ids, chargeId: 'fsteel-bc-1', keep: false, note: 'You are right, the line was not marked.' })
    expect(rows(dropped)[0]).toMatchObject({ state: 'dropped', chip: 'dropped', tone: 'green', words: 'Click dropped it on Oct 2: You are right, the line was not marked.' })
    expect(rows(dropped, 'es')[0]?.words).toBe('Click lo canceló el 2 oct: You are right, the line was not marked.')
    expect(backChargeCanTake(charge(dropped), dropped.today)).toBe(false)
  })
})

describe('who at the company gets which emails (owner, 2026-10-05)', () => {
  const company = (s: GcState, id: string) => {
    const p = s.partners.find((x) => x.id === id)
    if (!p) throw new Error(`no ${id}`)
    return p
  }
  const mail = (s: GcState, id: string, key: string) => portalMessages(s, id).find((m) => m.key === key)

  it('sends everything to the main contact until the company names others', () => {
    for (const m of portalMessages(state, 'hillside')) {
      expect(m.to).toEqual(['Greg Paulk'])
      expect(m.lines[0]).toBe('Hello Greg,')
    }
    expect(mail(state, 'hillside', 'boerne:plans:1')?.group).toBe('quotes')
  })

  it("sends Pecan Valley's pay to its bookkeeper and the rest to Marcus", () => {
    expect(mail(state, 'pecanvalley', 'felec-draw-1:paid')).toMatchObject({ group: 'pay', to: ['Dana Whitfield'] })
    expect(mail(state, 'pecanvalley', 'felec-draw-1:paid')?.lines[0]).toBe('Hello Dana,')
    // Fair Oaks is ours: its start day goes to the job's people, its old invitation to quotes.
    expect(mail(state, 'pecanvalley', 'fairoaksd:start')).toMatchObject({ group: 'job', to: ['Marcus Bell'] })
    expect(mail(state, 'pecanvalley', 'felec-pecanvalley:invite')).toMatchObject({ group: 'quotes', to: ['Marcus Bell'] })
    expect(mailRecipients(company(state, 'pecanvalley'), 'pay')).toEqual([{ name: 'Dana Whitfield', email: 'dana@pecanvalleyelectric.example', main: false }])
  })

  it("files the office's paper sends by their paper, and plans by the job's stage", () => {
    // A second W-9 ask is a reminder with its own email (the first one rides on the portal's own).
    let w9 = gcReducer(state, { type: 'sendPaper', partnerId: 'hillside', paper: 'w9', by: '2026-10-09', note: '' })
    w9 = gcReducer(w9, { type: 'sendPaper', partnerId: 'hillside', paper: 'w9', by: '2026-10-12', note: '' })
    const reminder = portalMessages(w9, 'hillside').find((x) => x.key.startsWith('send:'))
    expect(reminder).toBeTruthy()
    expect(reminder && portalMailGroup(w9, reminder)).toBe('pay')
    const plansOnAJob = { key: 'x', on: state.today, kind: 'plans' as const, projectId: 'fairoaksd', subject: '', lines: [] }
    expect(portalMailGroup(state, plansOnAJob)).toBe('job')
    expect(portalMailGroup(state, { ...plansOnAJob, projectId: 'boerne' })).toBe('quotes')
  })

  it('adds a person who gets what is ticked, greeting both when two share a kind', () => {
    const add = (name: string, email: string, gets: ('quotes' | 'job' | 'contracts' | 'pay')[]) =>
      gcReducer(state, { type: 'tradeAddPerson', partnerId: 'hillside', name, email, role: 'Estimator', gets })
    expect(add(' ', 'ana@hillside.example', ['quotes'])).toBe(state)
    expect(add('Ana Ruiz', 'not an email', ['quotes'])).toBe(state)
    expect(add('Ana Ruiz', 'ana@hillside.example', [])).toBe(state)
    const added = add('Ana Ruiz', 'ana@hillside.example', ['quotes'])
    expect(company(added, 'hillside').people).toEqual([{ id: 'hillside-p-1', name: 'Ana Ruiz', email: 'ana@hillside.example', role: 'Estimator', gets: ['quotes'] }])
    expect(added.log[0]).toMatchObject({ who: 'trade', text: 'Hillside Excavation added Ana Ruiz, Estimator, to its emails: quotes and plans.' })
    expect(mail(added, 'hillside', 'site-hillside:invite')).toMatchObject({ to: ['Greg Paulk', 'Ana Ruiz'] })
    expect(mail(added, 'hillside', 'site-hillside:invite')?.lines[0]).toBe('Hello Greg and Ana,')
    expect(portalMessages(added, 'hillside', 'es').find((m) => m.key === 'site-hillside:invite')?.lines[0]).toBe('Hola Greg y Ana:')
  })

  it('never leaves a kind of email with no one, and gives it back when a person goes', () => {
    const set = (s: GcState, personId: string | null, gets: ('quotes' | 'job' | 'contracts' | 'pay')[]) => gcReducer(s, { type: 'tradeSetGets', partnerId: 'pecanvalley', personId, gets })
    // Dana is the only one on pay: she cannot drop it, nor be left with nothing.
    expect(set(state, 'pecanvalley-p-1', [])).toBe(state)
    expect(set(state, null, ['quotes', 'job'])).toBe(state)
    const shared = set(state, 'pecanvalley-p-1', ['pay', 'contracts'])
    const marcusLess = set(shared, null, ['quotes', 'job'])
    expect(company(marcusLess, 'pecanvalley').contactGets).toEqual(['quotes', 'job'])
    expect(marcusLess.log[0]?.text).toBe('Pecan Valley Electric set Marcus Bell to get quotes and plans, the job.')
    const gone = gcReducer(marcusLess, { type: 'tradeRemovePerson', partnerId: 'pecanvalley', personId: 'pecanvalley-p-1' })
    expect(company(gone, 'pecanvalley')).toMatchObject({ people: [], contactGets: ['quotes', 'job', 'contracts', 'pay'] })
    expect(mail(gone, 'pecanvalley', 'felec-draw-1:paid')?.to).toEqual(['Marcus Bell'])
  })
})

describe('your weeks across every job (owner, 2026-10-05)', () => {
  /** A second job just like Fair Oaks D, its schedule moved by some days: the same companies on two jobs at once. */
  const withSecondJob = (shiftDays: number): GcState => {
    const fairOaks = state.projects.find((p) => p.id === 'fairoaksd')
    if (!fairOaks?.schedule) throw new Error('no Fair Oaks schedule')
    const shift = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + shiftDays * 86_400_000).toISOString().slice(0, 10)
    const schedule = { ...fairOaks.schedule, activities: fairOaks.schedule.activities.map((a) => ({ ...a, start: shift(a.start), finish: shift(a.finish) })) }
    return { ...state, projects: [...state.projects, { ...fairOaks, id: 'fairoakse', name: 'Fair Oaks Shops, Building E', schedule }] }
  }

  it("lays out Pecan Valley's next four weeks on Fair Oaks, with the inspections", () => {
    const weeks = portalWeeks(state, 'pecanvalley')
    expect(weeks.map((w) => w.title)).toEqual(['This week · Sep 28', 'Next week · Oct 5', 'Week of Oct 12', 'Week of Oct 19'])
    expect(weeks[0]?.items.map((i) => [i.name, i.days, i.finishes])).toEqual([
      ['Electrical · Panels and feeders', 'Mon Sep 28 to Fri Oct 2', true],
      ['Electrical · Lighting', 'Mon Sep 28 to Fri Oct 2', false],
    ])
    expect(weeks[0]?.inspections.map((x) => x.words)).toEqual(['Fair Oaks Shops, Building D · Electrical service inspection, Fri Oct 2'])
    expect(weeks[3]?.items.map((i) => i.name)).toEqual(['Electrical · Lighting', 'Electrical · Site lighting'])
    expect(weeks.every((w) => w.overlaps.length === 0)).toBe(true)
    // A company with no scheduled work gets no page.
    expect(portalWeeks(state, 'hillside')).toEqual([])
  })

  it('says when two jobs want the company on the same days, and its first day on a job', () => {
    const two = withSecondJob(14)
    const [week] = portalWeeks(two, 'coolbreeze')
    expect(week?.items.map((i) => [i.project.id, i.name, i.firstOnJob])).toEqual([
      ['fairoaksd', 'HVAC · Ductwork', false],
      ['fairoakse', 'HVAC · Ductwork', true],
    ])
    expect(week?.overlaps).toEqual(['Your work on Fair Oaks Shops, Building D and Fair Oaks Shops, Building E overlaps Mon Sep 28 to Fri Oct 2. Tell Click if one crew cannot do both.'])
    expect(portalWeeks(two, 'coolbreeze', 'es')[0]?.overlaps[0]).toBe(
      'Su trabajo en Fair Oaks Shops, Building D y Fair Oaks Shops, Building E se cruza del lun 28 sep al vie 2 oct. Avísele a Click si una sola cuadrilla no puede con todo.',
    )
  })
})
