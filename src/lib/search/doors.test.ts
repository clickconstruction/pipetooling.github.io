import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appRoutePathsFromSource, pathMatchesRoute } from '../twins/appDirectoryCheck'
import { getZonedSettingsGroups } from '../settingsGroups'
import { SETTINGS_HASH_ANCHOR_TO_TAB } from '../settingsDeepLink'
import { DEV_DOORS } from '../settings/devDoors'
import { ROLES } from '../userRoles'
import { isPathAllowedForRole } from '../layoutRouteAccess'
import { buildHelpGuideRegistry, type HelpGuide } from '../helpGuides'
import {
  allDoors,
  doorAllowedByRouteGuard,
  doorPath,
  doorQuery,
  doorsFor,
  flattenDoorGroups,
  isDevOnly,
  isNumberQuery,
  plainViewer,
  scoreDoor,
  searchDoors,
  type Door,
  type DoorViewer,
} from './doors'

const root = resolve(__dirname, '../../..')
const appSource = readFileSync(resolve(root, 'src/App.tsx'), 'utf8')
const routes = appRoutePathsFromSource(appSource)

/** The routes under the signed-in Layout: the ones `src/App.tsx` declares without a leading slash. */
function signedInRoutes(src: string): string[] {
  const out = new Set<string>()
  for (const m of src.matchAll(/<Route\b[^>]*\bpath="([^"/][^"]*)"/g)) if (m[1] !== '*') out.add(`/${m[1]!}`)
  return [...out]
}

const guides: HelpGuide[] = [
  { slug: 'bill-a-customer-and-get-paid', title: 'bill a customer and get paid', category: 'Billing & Money', roles: 'all', keywords: ['bill', 'invoice', 'get paid'], order: 1, where: '/jobs?tab=billing', body: '' },
  { slug: 'send-lien-notices-from-the-lien-desk', title: 'send lien notices from the Lien desk', category: 'Billing & Money', roles: ['dev', 'master_technician', 'assistant', 'controller'], keywords: ['lien desk', 'lien notice'], order: 2, body: '' },
]
const todos = [
  { number: 126, name: 'Quick replies by keyboard, and a starter set for the office', group: 'gated' as const },
  { number: 181, name: 'Go anywhere: the search box opens a page, a Settings card, a guide or a window by name', group: 'gated' as const },
]
const sources = { guides, todos }

const every: DoorViewer[] = ROLES.flatMap((role) => [
  plainViewer(role),
  { ...plainViewer(role), estimatorProspectsAccess: true, teamProspectsAccess: true },
  { ...plainViewer(role), farmModeActive: true },
])

describe('doors — the parsers', () => {
  it('reads the route part of a link', () => {
    expect(doorPath('/jobs?tab=stages&legal=1')).toBe('/jobs')
    expect(doorPath('/settings#settings-page-pins')).toBe('/settings')
    expect(doorPath('/settings?tab=settings-phone-texts#settings-phone-texts-hours')).toBe('/settings')
    expect(doorPath('/gc')).toBe('/gc')
  })
  it('reads a prefix, strips a leading "how do I" and a trailing "?"', () => {
    expect(doorQuery('> office hours')).toEqual({ only: 'place', words: 'office hours' })
    expect(doorQuery('?bill a customer')).toEqual({ only: 'guide', words: 'bill a customer' })
    expect(doorQuery('# quick')).toEqual({ only: 'todo', words: 'quick' })
    expect(doorQuery('How do I bill a customer?')).toEqual({ only: null, words: 'bill a customer' })
    expect(doorQuery('where is the lien desk')).toEqual({ only: null, words: 'the lien desk' })
    expect(doorQuery('  1418 ')).toEqual({ only: null, words: '1418' })
  })
  it('knows a number from a word', () => {
    expect(isNumberQuery('1418')).toBe(true)
    expect(isNumberQuery('J1418')).toBe(true)
    expect(isNumberQuery('b 352')).toBe(true)
    expect(isNumberQuery('e12')).toBe(true)
    expect(isNumberQuery('office hours')).toBe(false)
    expect(isNumberQuery('53.056')).toBe(false)
  })
})

describe('searchDoors — the rank', () => {
  const fixture: Door[] = [
    { id: 'page:a', kind: 'page', label: 'Billing', where: 'Jobs · Billing', words: ['bill a customer', 'invoice'], to: '/jobs?tab=billing', gate: () => true },
    { id: 'settings:hours', kind: 'settings', label: 'Office hours', where: 'Settings · Phone and texts', words: ['open and close'], to: '/settings?tab=settings-phone-texts#settings-phone-texts-hours', gate: () => true },
    { id: 'guide:bill', kind: 'guide', label: 'bill a customer and get paid', where: 'Guide · Billing & Money', words: ['invoice'], to: '/help?g=bill-a-customer-and-get-paid', gate: () => true },
    { id: 'guide:gc', kind: 'guide', label: 'bill the customer on a GC job', where: 'Guide · Billing & Money', words: [], to: '/help?g=bill-the-customer-on-a-gc-job', gate: () => true },
    { id: 'guide:remind', kind: 'guide', label: 'remind a customer to pay a GC bill', where: 'Guide · Billing & Money', words: [], to: '/help?g=remind', gate: () => true },
    { id: 'guide:four', kind: 'guide', label: 'see every bill on a job', where: 'Guide · Billing & Money', words: [], to: '/help?g=four', gate: () => true },
    { id: 'todo:126', kind: 'todo', label: '#126 Quick replies by keyboard', where: 'Punch list · Needs an owner decision', words: [], to: '/punch-list#n126', gate: () => true },
    { id: 'window:lien', kind: 'window', label: 'Legal desk', where: 'Jobs · Stages', words: ['collections', 'lien'], to: '/jobs?tab=stages&legal=1', gate: () => true },
  ]

  it('scores a label prefix over a label word over a keyword over the where line, and every word must match', () => {
    expect(scoreDoor(fixture[0]!, ['bill'])).toBe(120)
    expect(scoreDoor(fixture[1]!, ['hours'])).toBe(100)
    expect(scoreDoor(fixture[0]!, ['invoice'])).toBe(50)
    expect(scoreDoor(fixture[0]!, ['jobs'])).toBe(25)
    expect(scoreDoor(fixture[0]!, ['bill', 'zzz'])).toBeNull()
    // Word starts only: "ill" is inside "Billing", not the start of a word.
    expect(scoreDoor(fixture[0]!, ['ill'])).toBeNull()
  })
  it('groups by kind in the kinds’ order, three a group, the rest counted; a tie goes to the shorter label', () => {
    const groups = searchDoors('bill', fixture)
    // Two label prefixes (bill a customer…, bill the customer…) before two label words (see every bill…, remind … bill), the shorter first in each pair.
    expect(groups.map((g) => [g.key, g.label, g.doors.map((d) => d.id), g.more])).toEqual([
      ['page', 'Pages', ['page:a'], 0],
      ['guide', 'Guides', ['guide:bill', 'guide:gc', 'guide:four'], 1],
    ])
    expect(flattenDoorGroups(groups).map((d) => d.id)).toEqual(['page:a', 'guide:bill', 'guide:gc', 'guide:four'])
  })
  it('strips the question and finds the guide first by its title', () => {
    const groups = searchDoors('how do I bill a customer', fixture)
    expect(groups[0]?.key).toBe('page')
    expect(groups[1]?.doors[0]?.id).toBe('guide:bill')
  })
  it('a number alone finds no door, and a prefix narrows to one kind drawn whole', () => {
    expect(searchDoors('1418', fixture)).toEqual([])
    expect(searchDoors('J1418', fixture)).toEqual([])
    expect(searchDoors('#126', fixture).map((g) => [g.key, g.doors.map((d) => d.id)])).toEqual([['todo', ['todo:126']]])
    expect(searchDoors('? bill', fixture).map((g) => [g.key, g.doors.length, g.more])).toEqual([['guide', 4, 0]])
    expect(searchDoors('> hours', fixture).map((g) => [g.key, g.doors.map((d) => d.id)])).toEqual([['settings', ['settings:hours']]])
    expect(searchDoors('bill', fixture, { only: 'guide' }).map((g) => g.key)).toEqual(['guide'])
  })
  it('a guide is not matched by its category, a page still is by its where line', () => {
    const office: Door = { id: 'guide:pay', kind: 'guide', label: 'see everyone\u2019s pay setup', where: 'Guide · Office', words: ['pay'], to: '/help?g=pay', gate: () => true }
    expect(scoreDoor(office, ['office'])).toBeNull()
    const card: Door = { id: 'settings:x', kind: 'settings', label: 'Inboxes', where: 'Settings · Phone and texts', words: [], to: '/settings?tab=settings-phone-texts', gate: () => true }
    expect(scoreDoor(card, ['phone'])).toBe(25)
  })

  it('words typed as one phrase rank the door that holds the phrase whole above one that holds the words apart', () => {
    const apart: Door = { id: 'guide:man', kind: 'guide', label: 'see man hours for the office and the field', where: 'Guide · Office', words: [], to: '/help?g=man', gate: () => true }
    const whole: Door = { id: 'guide:push', kind: 'guide', label: 'turn on the reply push', where: 'Guide · Office', words: ['reply push', 'office hours'], to: '/help?g=push', gate: () => true }
    const card: Door = { id: 'settings:hours', kind: 'settings', label: 'Office hours', where: 'Settings · Phone and texts', words: [], to: '/settings?tab=settings-phone-texts#settings-phone-texts-hours', gate: () => true }
    expect(scoreDoor(apart, ['office', 'hours'])).toBe(200)
    expect(scoreDoor(whole, ['office', 'hours'])).toBe(250)
    expect(scoreDoor(card, ['office', 'hours'])).toBe(420)
    const groups = searchDoors('office hours', [apart, whole, card])
    expect(groups.map((g) => [g.key, g.doors.map((d) => d.id)])).toEqual([
      ['settings', ['settings:hours']],
      ['guide', ['guide:push', 'guide:man']],
    ])
  })

  it('a window draws with the pages, and one letter finds nothing', () => {
    expect(searchDoors('lien', fixture).map((g) => [g.key, g.doors.map((d) => d.id)])).toEqual([['page', ['window:lien']]])
    expect(searchDoors('b', fixture)).toEqual([])
  })
})

describe('the index agrees with the app — a door cannot rot silently', () => {
  const doors = allDoors(sources)

  it('has the kinds, unique ids, non-empty labels and lowercase words', () => {
    expect(doors.length).toBeGreaterThan(150)
    const ids = doors.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const d of doors) {
      expect(d.label.trim(), d.id).not.toBe('')
      expect(d.where.trim(), d.id).not.toBe('')
      for (const w of d.words) expect(w, `${d.id}: ${w}`).toBe(w.toLowerCase())
    }
    for (const kind of ['page', 'window', 'settings', 'guide', 'todo'] as const) expect(doors.some((d) => d.kind === kind), kind).toBe(true)
  })

  it('every page, window and settings door’s path is a route src/App.tsx serves', () => {
    const drift = doors
      .filter((d) => d.kind !== 'guide' && d.kind !== 'todo')
      .filter((d) => !routes.some((r) => pathMatchesRoute(doorPath(d.to), r)))
      .map((d) => `${d.id}: ${d.to}`)
    expect(drift).toEqual([])
  })

  it('every signed-in route has a door, except the ones with a param or no role gate', () => {
    // `/` is the Layout's own index; `/my-statement` opens for a partner by a per-person flag the viewer does not carry;
    // a route with a `:param` is a record's page, which today's rows find.
    const skipped = new Set(['/', '/my-statement'])
    const missing = signedInRoutes(appSource)
      .filter((r) => !r.includes(':') && !skipped.has(r))
      .filter((r) => !doors.some((d) => doorPath(d.to) === r))
    expect(missing).toEqual([])
  })

  it('every Settings group and every anchor the deep links know has a door', () => {
    const groups = new Set(ROLES.flatMap((r) => getZonedSettingsGroups(r).map((g) => g.id)))
    const missingGroups = [...groups].filter((id) => !doors.some((d) => d.to === `/settings?tab=${id}`))
    expect(missingGroups).toEqual([])
    // `settings-time-off` is a legacy bookmark: the section moved to the Dashboard in v2.1544.
    const anchors = Object.keys(SETTINGS_HASH_ANCHOR_TO_TAB).filter((a) => a !== 'settings-time-off')
    const missingAnchors = anchors.filter((a) => !doors.some((d) => d.to.endsWith(`#${a}`)))
    expect(missingAnchors).toEqual([])
  })

  it('every window door names the file that reads its query key, and that file still reads it', () => {
    const drift: string[] = []
    for (const d of doors) {
      if (d.kind !== 'window' || d.id.startsWith('dev:')) continue
      if (!d.reads) {
        if (/[?#]/.test(d.to)) drift.push(`${d.id}: a window with a query and no reads`)
        continue
      }
      const path = resolve(root, d.reads.file)
      if (!existsSync(path)) {
        drift.push(`${d.id}: ${d.reads.file} is not in the repo`)
        continue
      }
      if (!readFileSync(path, 'utf8').includes(d.reads.text)) drift.push(`${d.id}: ${d.reads.file} no longer holds "${d.reads.text}"`)
    }
    expect(drift).toEqual([])
  })

  it('no door leads to a bounce: a door a viewer may open is a path the route guard lets that viewer enter', () => {
    const drift: string[] = []
    for (const v of every) {
      for (const d of doorsFor(v, sources)) {
        if (d.kind === 'guide' || d.kind === 'todo') continue
        if (!doorAllowedByRouteGuard(d, v)) drift.push(`${v.role}${v.estimatorProspectsAccess ? '+prospects' : ''}${v.farmModeActive ? '+farm' : ''}: ${d.id}`)
      }
    }
    expect(drift).toEqual([])
  })

  it('folds the Dev doors card in, and isDevOnly names the rows that open for a dev alone', () => {
    for (const row of DEV_DOORS) {
      const door = doors.find((d) => d.id === `dev:${row.id}`) ?? doors.find((d) => d.to === row.to && d.label.toLowerCase() === row.label.toLowerCase())
      expect(door, row.id).toBeTruthy()
    }
    const training = doors.find((d) => d.to === '/settings?tab=settings-training')!
    expect(isDevOnly(training)).toBe(true)
    const dashboard = doors.find((d) => d.id === 'page:/dashboard')!
    expect(isDevOnly(dashboard)).toBe(false)
    // A card the office reads and the owner sets is not dev-only in the box: the office can get there.
    const hours = doors.find((d) => d.to === '/settings?tab=settings-phone-texts#settings-phone-texts-hours')!
    expect(isDevOnly(hours)).toBe(false)
    expect(hours.gate(plainViewer('assistant'))).toBe(true)
    expect(doors.filter(isDevOnly).length).toBeGreaterThan(20)
  })

  it('gates: the punch list and the Bridge for the owner and the developers, Banking for the controller, no Crew P&L for the owner', () => {
    const open = (role: DoorViewer['role'], id: string) => doorsFor(plainViewer(role), sources).some((d) => d.id === id)
    expect(open('dev', 'todo:126')).toBe(true)
    expect(open('master_technician', 'todo:126')).toBe(true)
    expect(open('assistant', 'todo:126')).toBe(false)
    expect(open('estimator', 'page:/punch-list')).toBe(false)
    expect(open('assistant', 'page:/banking')).toBe(false)
    expect(open('controller', 'page:/banking')).toBe(true)
    expect(open('master_technician', 'page:/jobs?tab=teams-summary')).toBe(false)
    expect(open('assistant', 'page:/jobs?tab=combined-labor')).toBe(false)
    expect(open('controller', 'page:/jobs?tab=combined-labor')).toBe(true)
    expect(open('helpers', 'page:/dashboard')).toBe(true)
    expect(open('helpers', 'page:/jobs?tab=stages')).toBe(false)
    expect(open('primary', 'page:/bids?tab=pricing')).toBe(false)
    expect(open('primary', 'page:/bids?tab=rfi')).toBe(true)
    expect(open('estimator', 'page:/prospects')).toBe(false)
    expect(doorsFor({ ...plainViewer('estimator'), estimatorProspectsAccess: true }, sources).some((d) => d.id === 'page:/prospects')).toBe(true)
    expect(open('assistant', 'guide:send-lien-notices-from-the-lien-desk')).toBe(true)
    expect(open('helpers', 'guide:send-lien-notices-from-the-lien-desk')).toBe(false)
    expect(open('helpers', 'guide:bill-a-customer-and-get-paid')).toBe(true)
  })

  it('Go there draws only where the viewer may go: never past the route guard, a hidden Settings tab or a shut door', () => {
    const forRole = (role: DoorViewer['role']) => doorsFor(plainViewer(role), sources).find((d) => d.id === 'guide:bill-a-customer-and-get-paid')
    // The guide is for everyone; its page, the Billing tab, is the office's.
    expect(forRole('assistant')?.also?.to).toBe('/jobs?tab=billing')
    expect(forRole('estimator')).toBeTruthy()
    expect(forRole('estimator')?.also).toBeUndefined()
    expect(forRole('helpers')?.also).toBeUndefined()
    // A superintendent may enter /jobs, but the Billing tab's own door is gated shut, so no Go there.
    expect(forRole('superintendent')?.also).toBeUndefined()
    const drift: string[] = []
    for (const v of every) {
      for (const d of doorsFor(v, sources)) {
        if (d.also && !isPathAllowedForRole(v.role, doorPath(d.also.to), v.estimatorProspectsAccess)) drift.push(`${v.role}: ${d.id} → ${d.also.to}`)
      }
    }
    expect(drift).toEqual([])
  })

  it('a guide with a where line carries Go there, and every real guide’s where is a route src/App.tsx serves', () => {
    const bill = doors.find((d) => d.id === 'guide:bill-a-customer-and-get-paid')!
    expect(bill.also).toEqual({ label: 'Go there', to: '/jobs?tab=billing' })
    expect(doors.find((d) => d.id === 'guide:send-lien-notices-from-the-lien-desk')!.also).toBeUndefined()
    const helpDir = resolve(root, 'src/content/help')
    const raw: Record<string, string> = {}
    for (const f of readdirSync(helpDir).filter((x) => x.endsWith('.md'))) raw[`../content/help/${f}`] = readFileSync(resolve(helpDir, f), 'utf8')
    const real = buildHelpGuideRegistry(raw)
    const withWhere = real.filter((g) => g.where)
    expect(withWhere.length).toBeGreaterThan(100)
    const drift = withWhere.filter((g) => !routes.some((r) => pathMatchesRoute(doorPath(g.where!), r))).map((g) => `${g.slug}: ${g.where}`)
    expect(drift).toEqual([])
    for (const g of withWhere) expect(g.where, g.slug).toMatch(/^\/[a-z]/)
  })

  it('the four searches of the mock-up land where it drew them', () => {
    const dev = doorsFor(plainViewer('dev'), sources)
    expect(searchDoors('1418', dev)).toEqual([])
    const hours = searchDoors('office hours', dev)
    expect(hours[0]?.key).toBe('settings')
    expect(hours[0]?.doors[0]?.to).toBe('/settings?tab=settings-phone-texts#settings-phone-texts-hours')
    const bill = searchDoors('how do I bill a customer', dev)
    expect(bill.find((g) => g.key === 'page')?.doors[0]?.to).toBe('/jobs?tab=billing')
    expect(bill.find((g) => g.key === 'guide')?.doors[0]?.to).toBe('/help?g=bill-a-customer-and-get-paid')
    const lien = searchDoors('lien', dev)
    expect(lien.find((g) => g.key === 'guide')?.doors[0]?.to).toBe('/help?g=send-lien-notices-from-the-lien-desk')
    expect(lien.find((g) => g.key === 'settings')?.doors.some((d) => d.to === '/settings#settings-lien-sign-code')).toBe(true)
    const assistant = doorsFor(plainViewer('assistant'), sources)
    expect(searchDoors('lien', assistant).find((g) => g.key === 'settings')?.doors.some((d) => d.to === '/settings#settings-lien-sign-code') ?? false).toBe(false)
    expect(searchDoors('# quick', dev).map((g) => [g.key, g.doors.map((d) => d.id)])).toEqual([['todo', ['todo:126']]])
    expect(searchDoors('# quick', assistant)).toEqual([])
  })
})
