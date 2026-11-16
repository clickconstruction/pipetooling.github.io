import { describe, expect, it } from 'vitest'
import type { NeedsYouItem } from '../dashboardNeedsYou'
import { NEEDS_YOU_ITEM_ACTOR, needsYouViewerActors } from '../needsYouActor'
import { plainWordsFailures } from '../plainWords'
import {
  DASHBOARD_VIEW_PICKER_WORDS,
  DASHBOARD_VIEW_WORDS,
  DASHBOARD_VIEWS,
  SHORT_DASHBOARD_ALONE_KEYS,
  SHORT_DASHBOARD_WORDS,
  canHaveShortDashboard,
  canSetDashboardViewFor,
  dashboardViewStorageKey,
  parseDashboardView,
  shortDashboardGreeting,
  shortDashboardRead,
  splitForShortDashboard,
} from './shortDashboard'

const item = (key: NeedsYouItem['key']): Pick<NeedsYouItem, 'key'> => ({ key })

describe('shortDashboard · the leader’s Dashboard, distilled', () => {
  it('anything but short is the full Dashboard, so a missing column changes nothing', () => {
    expect(parseDashboardView('short')).toBe('short')
    for (const v of ['full', '', null, undefined, 'SHORT', 3]) expect(parseDashboardView(v)).toBe('full')
    expect(DASHBOARD_VIEWS).toEqual(['short', 'full'])
  })

  it('is drawn for the leader and a dev; the office may set it for them', () => {
    expect(canHaveShortDashboard('master_technician')).toBe(true)
    expect(canHaveShortDashboard('dev')).toBe(true)
    for (const r of ['assistant', 'controller', 'estimator', 'primary', 'subcontractor', 'helpers', 'superintendent', null]) expect(canHaveShortDashboard(r), String(r)).toBe(false)
    for (const r of ['dev', 'master_technician', 'assistant']) expect(canSetDashboardViewFor(r), r).toBe(true)
    for (const r of ['controller', 'estimator', 'subcontractor', null]) expect(canSetDashboardViewFor(r), String(r)).toBe(false)
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
