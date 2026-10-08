
import { describe, expect, it } from 'vitest'
import { onSite } from './buildingLog'
import { alternateWords, bidGoodUntil, openChangeRequests, portalChangeRequests, portalContacts, portalExclusionWords, portalLeavesOut, portalLink, portalLookAhead, portalOnSite, portalPlanNews, portalWeeks } from './portal'
import { pWeekday } from './portalI18n'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const state = initialGcState()

function ask(s: GcState, projectId: string, packageId: string, partnerId: string) {
  const project = s.projects.find((p) => p.id === projectId)
  const pkg = project?.packages.find((k) => k.id === packageId)
  const invite = pkg?.invites.find((i) => i.partnerId === partnerId)
  if (!project || !pkg || !invite) throw new Error(`no ask ${projectId}/${packageId}/${partnerId}`)
  return { project, pkg, invite }
}

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
})

describe('how a company arrives', () => {
  it('gives each company its own link', () => {
    expect(portalLink('voltage')).toMatch(/^clicktooling\.com\/t\/[0-9A-Z]{7}$/)
    expect(portalLink('voltage')).toBe(portalLink('voltage'))
    expect(portalLink('voltage')).not.toBe(portalLink('brightline'))
  })
})

describe('the bid form', () => {
  it('leaves a bid sent without them as it was', () => {
    const bid = ask(state, 'boerne', 'site', 'lonestar').invite.bid
    expect(bid && 'goodForDays' in bid).toBe(false)
    expect(bid && bidGoodUntil(bid)).toBeNull()
  })

  it('words an alternate that adds and one that takes off', () => {
    expect(alternateWords({ label: 'LED high bays', amount: 4_200 })).toBe('LED high bays adds $4,200')
    expect(alternateWords({ label: 'Owner buys the fixtures', amount: -12_000 })).toBe('Owner buys the fixtures takes off $12,000')
  })
})

describe('the weekly look-ahead', () => {
  const fairOaks = (s: GcState) => {
    const p = s.projects.find((x) => x.id === 'fairoaksd')
    if (!p) throw new Error('no Fair Oaks D')
    return p
  }

  it('shows Pecan Valley last week while it is unmarked, this week, and the next two', () => {
    const weeks = portalLookAhead(state, 'pecanvalley', fairOaks(state))
    expect(weeks.map((w) => `${w.when} ${w.weekOf}`)).toEqual(['last 2026-09-21', 'this 2026-09-28', 'next 2026-10-05', 'later 2026-10-12'])
    expect(weeks[1]?.items.map((i) => [i.row.label, i.state, i.canMark])).toEqual([
      ['Panels and feeders', 'waiting', true],
      ['Lighting', 'unmarked', true],
    ])
    expect(weeks[2]?.items.every((i) => !i.canMark)).toBe(true)
  })

  it('shows nothing on a job that is not being built yet', () => {
    expect(portalLookAhead(state, 'hillcountry', state.projects.find((p) => p.id === 'helotes') ?? fairOaks(state))).toEqual([])
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

describe('what a company’s quote leaves out', () => {
  it('says them in a sentence, with a unit price where one was given, in both languages', () => {
    const list = [{ name: 'Rock excavation', unitPrice: { amount: 38, unit: 'cy' } }, { name: 'Sales tax' }]
    expect(portalExclusionWords(list)).toBe('rock excavation ($38 per cy if it comes up) and sales tax')
    expect(portalExclusionWords(list, 'es')).toBe('excavación en roca ($38 por cy si se necesita) y impuesto sobre ventas')
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
