import { describe, expect, it } from 'vitest'
import type { NeedsYouItem } from '../dashboardNeedsYou'
import { NEEDS_YOU_ITEM_ACTOR, needsYouViewerActors } from '../needsYouActor'
import { plainWordsFailures } from '../plainWords'
import {
  DASHBOARD_VIEW_PICKER_WORDS,
  DASHBOARD_VIEW_WORDS,
  DASHBOARD_VIEWS,
  SHORT_DASHBOARD_ALONE_KEYS,
  DASHBOARD_VIEW_ROLES,
  SHORT_DASHBOARD_WORDS,
  canHaveShortDashboard,
  canSetDashboardView,
  canSetDashboardViewFor,
  dashboardViewStorageKey,
  parseDashboardView,
  shortDashboardGreeting,
  shortDashboardRead,
  shortPageFor,
  splitForShortDashboard,
} from './shortDashboard'

const item = (key: NeedsYouItem['key']): Pick<NeedsYouItem, 'key'> => ({ key })

describe('shortDashboard · the leader’s Dashboard, distilled', () => {
  it('anything but short is the full Dashboard, so a missing column changes nothing', () => {
    expect(parseDashboardView('short')).toBe('short')
    for (const v of ['full', '', null, undefined, 'SHORT', 3]) expect(parseDashboardView(v)).toBe('full')
    expect(DASHBOARD_VIEWS).toEqual(['short', 'full'])
  })

  it('the leader, a dev and a superintendent take a view; the office may set it for them', () => {
    expect(DASHBOARD_VIEW_ROLES).toEqual(['master_technician', 'dev', 'superintendent'])
    for (const r of DASHBOARD_VIEW_ROLES) expect(canHaveShortDashboard(r), r).toBe(true)
    for (const r of ['assistant', 'controller', 'estimator', 'primary', 'subcontractor', 'helpers', '', null, undefined]) expect(canHaveShortDashboard(r), String(r)).toBe(false)
    for (const r of ['dev', 'master_technician', 'assistant']) expect(canSetDashboardViewFor(r), r).toBe(true)
    for (const r of ['controller', 'estimator', 'subcontractor', 'superintendent', null]) expect(canSetDashboardViewFor(r), String(r)).toBe(false)
  })

  it('one setting gives the short form of whichever home the person uses', () => {
    // Job Mode off: the short Dashboard, for every role that takes a view.
    for (const r of DASHBOARD_VIEW_ROLES) expect(shortPageFor(r, false), r).toBe('dashboard')
    // Job Mode on: the short Job Mode page is a superintendent's. A leader and a dev keep the full card.
    expect(shortPageFor('superintendent', true)).toBe('job_mode')
    expect(shortPageFor('master_technician', true)).toBeNull()
    expect(shortPageFor('dev', true)).toBeNull()
    // A role that takes no view has no short page, whichever home it uses.
    for (const r of ['assistant', 'controller', 'estimator', 'primary', 'subcontractor', 'helpers', null, undefined]) {
      expect(shortPageFor(r, false), String(r)).toBeNull()
      expect(shortPageFor(r, true), String(r)).toBeNull()
    }
  })

  it('the office presses any row that takes a view, and a person presses his own', () => {
    const can = (viewerRole: string | null, viewerUserId: string | null, targetUserId: string | null, targetRole: string | null) => canSetDashboardView({ viewerRole, viewerUserId, targetUserId, targetRole })
    // The office, for a leader and for a superintendent.
    for (const office of ['dev', 'master_technician', 'assistant']) {
      expect(can(office, 'u-office', 'u-lead', 'master_technician'), office).toBe(true)
      expect(can(office, 'u-office', 'u-super', 'superintendent'), office).toBe(true)
    }
    // A superintendent for his own row, and for nobody else's.
    expect(can('superintendent', 'u-super', 'u-super', 'superintendent')).toBe(true)
    expect(can('superintendent', 'u-super', 'u-other', 'superintendent')).toBe(false)
    expect(can('superintendent', 'u-super', 'u-lead', 'master_technician')).toBe(false)
    // A role that takes no view has no row to press, its own included.
    expect(can('estimator', 'u-est', 'u-est', 'estimator')).toBe(false)
    expect(can('assistant', 'u-office', 'u-est', 'estimator')).toBe(false)
    expect(can('subcontractor', 'u-sub', 'u-sub', 'subcontractor')).toBe(false)
    // The controller reads. Nobody signed in presses nothing, and neither does a row with no account.
    expect(can('controller', 'u-con', 'u-super', 'superintendent')).toBe(false)
    expect(can(null, null, 'u-super', 'superintendent')).toBe(false)
    expect(can('assistant', 'u-office', null, 'superintendent')).toBe(false)
  })

  it('every line on the list is one the leader’s own role presses', () => {
    const leader = needsYouViewerActors('master_technician')
    for (const key of SHORT_DASHBOARD_ALONE_KEYS) expect(leader.has(NEEDS_YOU_ITEM_ACTOR[key]), key).toBe(true)
  })

  it('sorts the lines three ways and keeps the order it was given', () => {
    const items = [item('bulk-delete'), item('contract-missing'), item('lien-notice-approve'), item('tagged-notes'), item('robot-blocked'), item('team-reviews'), item('lien-waivers-to-sign'), item('label-approvals'), item('tally-self')]
    const s = splitForShortDashboard(items, 'master_technician')
    expect(s.waiting.map((i) => i.key)).toEqual(['lien-notice-approve', 'tagged-notes', 'lien-waivers-to-sign'])
    expect(s.alsoYours.map((i) => i.key)).toEqual(['bulk-delete', 'team-reviews', 'tally-self'])
    expect(s.office.map((i) => i.key)).toEqual(['contract-missing', 'robot-blocked', 'label-approvals'])
    expect(s.waiting.length + s.alsoYours.length + s.office.length).toBe(items.length)
  })

  it('an assistant never gets the leader’s lines on her own list', () => {
    const s = splitForShortDashboard([item('lien-notice-approve'), item('contract-missing'), item('tagged-notes')], 'assistant')
    expect(s.waiting.map((i) => i.key)).toEqual(['tagged-notes'])
    expect(s.office.map((i) => i.key)).toEqual(['lien-notice-approve'])
  })

  it('never says the list is ready while the Lien desk is being read, or after its read failed', () => {
    const base = { lienOn: true, lienHasData: false, lienLoading: false, lienStarted: false, waiversLoading: false, settled: false }
    expect(shortDashboardRead(base)).toBe('reading')
    expect(shortDashboardRead({ ...base, lienLoading: true, lienStarted: true })).toBe('reading')
    expect(shortDashboardRead({ ...base, lienStarted: true })).toBe('failed')
    // Settled once does not hide a desk that later lost its data.
    expect(shortDashboardRead({ ...base, lienStarted: true, settled: true })).toBe('failed')
    expect(shortDashboardRead({ ...base, lienHasData: true, lienStarted: true })).toBe('ready')
    expect(shortDashboardRead({ ...base, lienHasData: true, lienStarted: true, waiversLoading: true })).toBe('reading')
    // A re-read after a signature keeps the list on screen.
    expect(shortDashboardRead({ ...base, lienHasData: true, lienStarted: true, waiversLoading: true, settled: true })).toBe('ready')
    // A viewer with no Lien desk waits on the waivers alone.
    expect(shortDashboardRead({ ...base, lienOn: false })).toBe('ready')
  })

  it('greets by the hour and counts in whole words', () => {
    expect(shortDashboardGreeting('Marcus', 8)).toBe('Morning, Marcus')
    expect(shortDashboardGreeting('Marcus', 13)).toBe('Afternoon, Marcus')
    expect(shortDashboardGreeting(' ', 19)).toBe('Evening')
    expect(SHORT_DASHBOARD_WORDS.count(0)).toBe('')
    expect(SHORT_DASHBOARD_WORDS.count(1)).toBe('1 thing waits on you.')
    expect(SHORT_DASHBOARD_WORDS.count(3)).toBe('3 things wait on you.')
    expect(SHORT_DASHBOARD_WORDS.office(0)).toBe('Nothing else is open.')
    expect(SHORT_DASHBOARD_WORDS.office(1)).toBe('The office is handling 1 other thing.')
    expect(SHORT_DASHBOARD_WORDS.office(23)).toBe('The office is handling 23 other things.')
    expect(SHORT_DASHBOARD_WORDS.doorNote(0)).toBe('Money, crew, jobs and the full Dashboard.')
    // A superintendent's door names what is behind it for him. His count lines are everyone's.
    expect(SHORT_DASHBOARD_WORDS.doorNote(0, 'superintendent')).toBe('Clock In, your hours, your crew and the full Dashboard.')
    expect(SHORT_DASHBOARD_WORDS.doorNote(0, 'master_technician')).toBe('Money, crew, jobs and the full Dashboard.')
    expect(SHORT_DASHBOARD_WORDS.doorNote(2, 'superintendent')).toBe('2 more of yours are in there.')
    expect(SHORT_DASHBOARD_WORDS.doorNote(1)).toBe('1 more of yours is in there.')
    expect(SHORT_DASHBOARD_WORDS.doorNote(4)).toBe('4 more of yours are in there.')
  })

  it('every sentence a first-timer reads is plain words', () => {
    const w = SHORT_DASHBOARD_WORDS
    const sentences = [
      w.title,
      w.count(1),
      w.count(3),
      w.failed,
      w.failedPress,
      w.empty.main,
      w.empty.tail,
      w.office(0),
      w.office(1),
      w.office(23),
      w.door,
      w.doorNote(0),
      w.doorNote(0, 'superintendent'),
      w.doorNote(1),
      w.doorNote(4),
      w.rateCrew.title,
      w.rateCrew.detail,
      w.back,
      DASHBOARD_VIEW_PICKER_WORDS.label,
      DASHBOARD_VIEW_PICKER_WORDS.hintFor('Marcus'),
      DASHBOARD_VIEW_PICKER_WORDS.hintSelf,
      DASHBOARD_VIEW_PICKER_WORDS.notSaved,
      ...DASHBOARD_VIEWS.flatMap((v) => [DASHBOARD_VIEW_WORDS[v].label, DASHBOARD_VIEW_WORDS[v].hint]),
    ]
    for (const s of sentences) expect(plainWordsFailures(s), s).toEqual([])
  })

  it('remembers the view per person on the device', () => {
    expect(dashboardViewStorageKey('abc')).toBe('dashboard_view_abc')
  })
})

describe('the bar\'s Dashboard tab on Short', () => {
  it('opens the Dashboard page, where the short page is drawn', async () => {
    const { SHORT_DASHBOARD_PATH, SHORT_DASHBOARD_HOME_STATE, isShortDashboardHomePress } = await import('./shortDashboard')
    expect(SHORT_DASHBOARD_PATH).toBe('/dashboard')
    expect(isShortDashboardHomePress(SHORT_DASHBOARD_HOME_STATE)).toBe(true)
  })

  it('reads only its own mark as the way home', async () => {
    const { isShortDashboardHomePress } = await import('./shortDashboard')
    for (const state of [null, undefined, 'x', {}, { shortHome: false }, { shortHome: 'true' }]) expect(isShortDashboardHomePress(state)).toBe(false)
  })
})
