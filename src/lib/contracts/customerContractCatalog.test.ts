/**
 * The guard behind Settings → Contracts & terms: every customer-facing public page has a
 * catalog entry or a stated reason, every entry points at steps and guides that exist, and every
 * sentence the catalog repeats from a page is still on that page. The test reads the real files.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { customerJourneys } from '../customerJourneys'
import { CUSTOMER_SURFACES } from '../customerSurfaceRegistry'
import { getZonedSettingsGroups } from '../settingsGroups'
import { SETTINGS_HASH_ANCHOR_TO_TAB } from '../settingsDeepLink'
import { DEFAULT_TERMS_AND_WARRANTY } from '../bidDocuments/coverLetter'
import { DEFAULT_JOB_CONTRACT_TERMS_PLAIN } from '../jobs/jobContractDocument'
import {
  COMPARE_MAX,
  CONTRACTS_TAB_ID,
  CONTRACT_ROUTE_REASONS,
  CUSTOMER_CONTRACT_CATALOG,
  canEditStandardTerms,
  contractAnchorId,
  contractCatalogCounts,
  contractCatalogProblems,
  contractCountsLine,
  contractEditAction,
  contractEntriesForStep,
  contractPinProblems,
  contractSettingKeys,
  contractSourceLine,
  parseStepParam,
  resolveContractTexts,
  stepParam,
  toggleCompare,
  type ContractBookDoc,
  type ContractCatalogData,
  type ContractCatalogEntry,
} from './customerContractCatalog'

const ROOT = resolve(__dirname, '../../..')
const readRepoFile = (file: string): string | null => {
  const p = resolve(ROOT, file)
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

const entry = (id: string): ContractCatalogEntry => {
  const e = CUSTOMER_CONTRACT_CATALOG.find((x) => x.id === id)
  if (!e) throw new Error(`no catalog entry ${id}`)
  return e
}

const EMPTY: ContractCatalogData = { settings: new Map(), bookDocs: [] }
const doc = (over: Partial<ContractBookDoc> = {}): ContractBookDoc => ({ id: 'doc-1', document_name: 'Service agreement', book_body_html: '1. Scope. Ours.', book_body_format: 'plain', book_version_date: '2026-09-20', ...over })

describe('the catalog agrees with the app', () => {
  const journeys = customerJourneys()

  it('every customer-facing public page has an entry or a reason', () => {
    expect(contractCatalogProblems({ entries: CUSTOMER_CONTRACT_CATALOG, journeys, surfaces: CUSTOMER_SURFACES, routeReasons: CONTRACT_ROUTE_REASONS })).toEqual([])
  })

  it('every pinned sentence is still in its file', () => {
    expect(contractPinProblems(CUSTOMER_CONTRACT_CATALOG, readRepoFile)).toEqual([])
  })

  it('every guide it names exists', () => {
    for (const e of CUSTOMER_CONTRACT_CATALOG) {
      if (e.guide) expect(readRepoFile(`src/content/help/${e.guide}.md`), `${e.id} → ${e.guide}`).not.toBeNull()
    }
  })

  it('every Settings door opens a tab a dev has, on an anchor the deep link knows', () => {
    const tabs = new Set(getZonedSettingsGroups('dev').map((g) => g.id))
    for (const e of CUSTOMER_CONTRACT_CATALOG) {
      if (e.edit.kind !== 'settings') continue
      expect(tabs.has(e.edit.tabId), `${e.id} → ${e.edit.tabId}`).toBe(true)
      if (e.edit.anchorId !== e.edit.tabId) expect(SETTINGS_HASH_ANCHOR_TO_TAB[e.edit.anchorId], `${e.id} → #${e.edit.anchorId}`).toBe(e.edit.tabId)
    }
    expect(tabs.has(CONTRACTS_TAB_ID)).toBe(true)
  })

  it('the anchors it lands on are on the page', () => {
    const catalogs = readRepoFile('src/components/settings/SettingsCatalogsProspectsTab.tsx') ?? ''
    const coverLetter = readRepoFile('src/components/settings/BidCoverLetterDefaultsSettingsBlock.tsx') ?? ''
    for (const e of CUSTOMER_CONTRACT_CATALOG) {
      if (e.edit.kind !== 'settings' || e.edit.anchorId === e.edit.tabId) continue
      expect(`${catalogs}\n${coverLetter}`.includes(`id="${e.edit.anchorId}"`), `${e.id} → #${e.edit.anchorId}`).toBe(true)
    }
  })

  it('names both groups and reads a setting once per key', () => {
    expect(new Set(CUSTOMER_CONTRACT_CATALOG.map((e) => e.group))).toEqual(new Set(['signed', 'notice']))
    const keys = contractSettingKeys()
    expect(keys).toContain('estimate_public_terms_body')
    expect(keys).toContain('bid_cover_letter_terms_default_v1')
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('contractCatalogProblems', () => {
  const journeys = customerJourneys()
  const surfaces = CUSTOMER_SURFACES
  const base = entry('estimate-terms')

  it('names a customer page nothing covers', () => {
    const problems = contractCatalogProblems({ entries: [], journeys, surfaces, routeReasons: {} })
    expect(problems.some((p) => p.includes('/bid-room') && p.includes('no entry'))).toBe(true)
    expect(problems.some((p) => p.includes('/sign-in'))).toBe(false) // staff pages are not the catalog's
    expect(problems.some((p) => p.includes('/sub '))).toBe(false) // nor the sub's
  })

  it('names a step, a route and a reason that do not exist', () => {
    const bad: ContractCatalogEntry = { ...base, id: 'x', seenOn: [{ journeyId: 'homeowner', stepId: 'nope' }], routes: ['/nowhere'] }
    const problems = contractCatalogProblems({ entries: [bad], journeys, surfaces, routeReasons: { '/gone': 'old' } })
    expect(problems.some((p) => p.includes('homeowner/nope'))).toBe(true)
    expect(problems.some((p) => p.includes('/nowhere'))).toBe(true)
    expect(problems.some((p) => p.includes('/gone'))).toBe(true)
  })

  it('refuses a duplicate id, a bad id, and a route that is both covered and excused', () => {
    const problems = contractCatalogProblems({ entries: [base, base, { ...base, id: 'Bad Id' }], journeys, surfaces, routeReasons: { '/estimate/terms': 'no' } })
    expect(problems.some((p) => p.includes('listed twice'))).toBe(true)
    expect(problems.some((p) => p.includes('lowercase-dash'))).toBe(true)
    expect(problems.some((p) => p.includes('pick one'))).toBe(true)
  })

  it('refuses an entry with neither wording nor a sample', () => {
    const bare: ContractCatalogEntry = { ...base, id: 'bare', source: { kind: 'code', text: null }, seenOn: [], routes: [] }
    expect(contractCatalogProblems({ entries: [bare], journeys, surfaces, routeReasons: {} }).some((p) => p.includes('no wording and no sample'))).toBe(true)
  })
})

describe('contractPinProblems', () => {
  const pinned: ContractCatalogEntry = { ...entry('estimate-terms'), id: 'p', pins: [{ file: 'a.tsx', text: 'I agree to the terms.' }] }

  it('passes when the sentence is there', () => {
    expect(contractPinProblems([pinned], () => '<span>I agree to the terms.</span>')).toEqual([])
  })

  it('names a sentence the page changed, and a file that is gone', () => {
    expect(contractPinProblems([pinned], () => '<span>I accept the terms.</span>')[0]).toContain('no longer in a.tsx')
    expect(contractPinProblems([pinned], () => null)[0]).toContain('does not exist')
  })
})

describe('resolveContractTexts', () => {
  it('a Settings text: yours when set, the built-in when blank, nothing when there is no built-in', () => {
    const bid = entry('bid-terms')
    expect(resolveContractTexts(bid, { ...EMPTY, settings: new Map([['bid_cover_letter_terms_default_v1', '  Net 30.  ']]) })).toMatchObject([{ key: 'bid-terms', text: 'Net 30.', status: 'yours', versionLabel: null }])
    expect(resolveContractTexts(bid, { ...EMPTY, settings: new Map([['bid_cover_letter_terms_default_v1', '   ']]) })).toMatchObject([{ text: DEFAULT_TERMS_AND_WARRANTY, status: 'built_in' }])
    expect(resolveContractTexts(bid, EMPTY)).toMatchObject([{ status: 'built_in' }])
    expect(resolveContractTexts(entry('estimate-terms'), EMPTY)).toMatchObject([{ text: '', status: 'blank' }])
  })

  it('the Book: the built-in wording when it holds no customer document', () => {
    const [t] = resolveContractTexts(entry('job-standard-terms'), EMPTY)
    expect(t).toMatchObject({ key: 'job-standard-terms', text: DEFAULT_JOB_CONTRACT_TERMS_PLAIN, status: 'built_in', versionLabel: null, doc: null })
    expect(t?.title).toContain('Built-in service agreement terms')
  })

  it('the Book: one text per customer document, dated, named when there is more than one', () => {
    const one = resolveContractTexts(entry('job-standard-terms'), { ...EMPTY, bookDocs: [doc()] })
    expect(one).toHaveLength(1)
    expect(one[0]).toMatchObject({ key: 'job-standard-terms:doc-1', title: 'Job service agreement — standard terms', text: '1. Scope. Ours.', status: 'yours', format: 'plain' })
    expect(one[0]?.versionLabel).toBe('Sep 20')
    const two = resolveContractTexts(entry('job-standard-terms'), { ...EMPTY, bookDocs: [doc(), doc({ id: 'doc-2', document_name: 'Commercial', book_body_format: 'html', book_body_html: '<p>x</p>' })] })
    expect(two.map((t) => t.title)).toEqual(['Job service agreement — standard terms · Service agreement', 'Job service agreement — standard terms · Commercial'])
    expect(two[1]?.format).toBe('html')
  })

  it('the Book: a document with no wording reads as nothing set', () => {
    expect(resolveContractTexts(entry('job-standard-terms'), { ...EMPTY, bookDocs: [doc({ book_body_html: '  ' })] })[0]?.status).toBe('blank')
  })

  it('wording in the app is fixed, and carries its version when it has one', () => {
    expect(resolveContractTexts(entry('esign-consent'), EMPTY)[0]).toMatchObject({ status: 'fixed', versionLabel: 'version 2' })
    expect(resolveContractTexts(entry('esign-consent'), EMPTY)[0]?.text).toContain('I agree to sign electronically.')
    expect(resolveContractTexts(entry('job-payment-line'), EMPTY)[0]?.text).toContain('Full amount due on completion of the work.')
    expect(resolveContractTexts(entry('job-lien-waiver'), EMPTY)[0]).toMatchObject({ status: 'fixed', text: '' })
  })

  it('a box typed on each record has no wording of its own', () => {
    expect(resolveContractTexts(entry('estimate-terms-box'), EMPTY)).toMatchObject([{ status: 'per_record', text: '' }])
  })

  it('the website terms are a copy of a page kept elsewhere, dated by the day it was copied (v2.4135)', () => {
    const [t] = resolveContractTexts(entry('website-terms'), EMPTY)
    expect(t).toMatchObject({ key: 'website-terms', status: 'external', versionLabel: 'copied Sep 29, 2026', doc: null })
    expect(t?.text).toContain('Venue for any legal action shall lie exclusively in Guadalupe County, Texas.')
    expect(contractSourceLine(entry('website-terms'))).toBe('A page Housecall Pro hosts. The wording here is a copy, copied Sep 29, 2026; open the live page to read it as it stands today.')
    expect(contractEditAction(entry('website-terms'), t!, 'assistant')).toMatchObject({ kind: 'link', label: 'Open the live page', href: 'https://pro.housecallpro.com/ClickPlumbing/712596/terms' })
    expect(entry('website-terms').area).toBe('website')
  })

  it('wording kept in a Settings form is not called fixed', () => {
    expect(resolveContractTexts(entry('invoice-footers'), EMPTY)).toMatchObject([{ status: 'in_settings', text: '', versionLabel: null }])
    expect(contractSourceLine(entry('invoice-footers'))).toContain('Footer presets in Settings')
    expect(contractEditAction(entry('invoice-footers'), resolveContractTexts(entry('invoice-footers'), EMPTY)[0]!, 'dev')).toMatchObject({ kind: 'settings', tabId: 'settings-jobs' })
  })
})

describe('contractEditAction', () => {
  const data: ContractCatalogData = { ...EMPTY, bookDocs: [doc()] }
  const bookText = resolveContractTexts(entry('job-standard-terms'), data)[0]!
  const builtInText = resolveContractTexts(entry('job-standard-terms'), EMPTY)[0]!
  const bidText = resolveContractTexts(entry('bid-terms'), EMPTY)[0]!

  it('the office edits a Book document on the card', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller'] as const) {
      expect(canEditStandardTerms(role)).toBe(true)
      expect(contractEditAction(entry('job-standard-terms'), bookText, role).kind).toBe('modal')
    }
    expect(canEditStandardTerms('estimator')).toBe(false)
    expect(contractEditAction(entry('job-standard-terms'), bookText, 'estimator').kind).toBe('note')
  })

  it('the built-in wording has no editor, and says how to get one', () => {
    const a = contractEditAction(entry('job-standard-terms'), builtInText, 'dev')
    expect(a).toMatchObject({ kind: 'note' })
    expect(a.kind === 'note' ? a.text : '').toContain('Contract library')
  })

  it('a dev-only Settings text opens for a dev and says who edits it to everyone else', () => {
    expect(contractEditAction(entry('bid-terms'), bidText, 'dev')).toMatchObject({ kind: 'settings', tabId: 'settings-catalogs', anchorId: 'settings-bid-cover-letter-defaults' })
    const a = contractEditAction(entry('bid-terms'), bidText, 'master_technician')
    expect(a.kind === 'note' ? a.text : '').toContain('A dev edits this')
  })

  it('a page door and a fixed text', () => {
    expect(contractEditAction(entry('estimate-terms-box'), resolveContractTexts(entry('estimate-terms-box'), EMPTY)[0]!, 'assistant')).toMatchObject({ kind: 'page', to: '/estimates' })
    expect(contractEditAction(entry('esign-consent'), resolveContractTexts(entry('esign-consent'), EMPTY)[0]!, 'dev').kind).toBe('note')
  })
})

describe('the doors to What customers see', () => {
  const journeys = customerJourneys()

  it('a step names the texts it shows', () => {
    expect(contractEntriesForStep('homeowner', 'estimate-terms').map((e) => e.id)).toEqual(['estimate-terms', 'esign-consent'])
    expect(contractEntriesForStep('gc', 'bid-room').map((e) => e.id)).toEqual(['bid-terms', 'bid-exclusions', 'signing-sentences', 'esign-consent'])
    expect(contractEntriesForStep('house', 'quote-page')).toEqual([])
  })

  it('the step param round-trips and refuses what is not a step', () => {
    expect(stepParam({ journeyId: 'gc', stepId: 'bid-room' })).toBe('gc/bid-room')
    expect(parseStepParam('gc/bid-room', journeys)).toEqual({ journeyId: 'gc', stepId: 'bid-room' })
    expect(parseStepParam('gc/nope', journeys)).toBeNull()
    expect(parseStepParam('nobody/bid-room', journeys)).toBeNull()
    expect(parseStepParam('gc/bid-room/extra', journeys)).toBeNull()
    expect(parseStepParam(null, journeys)).toBeNull()
  })

  it('a card has an anchor', () => {
    expect(contractAnchorId('bid-terms')).toBe('settings-contract-bid-terms')
  })
})

describe('toggleCompare', () => {
  it('ticks, unticks, and lets a fourth pick replace the oldest', () => {
    expect(toggleCompare([], 'a')).toEqual(['a'])
    expect(toggleCompare(['a', 'b'], 'a')).toEqual(['b'])
    expect(COMPARE_MAX).toBe(3)
    expect(toggleCompare(['a', 'b', 'c'], 'd')).toEqual(['b', 'c', 'd'])
  })
})

describe('the count', () => {
  it('counts each kind once and says how many are dated', () => {
    const data: ContractCatalogData = { settings: new Map([['bid_cover_letter_terms_default_v1', 'Net 30.']]), bookDocs: [doc()] }
    const texts = ['bid-terms', 'bid-exclusions', 'estimate-terms', 'job-standard-terms', 'esign-consent', 'estimate-terms-box'].flatMap((id) => resolveContractTexts(entry(id), data))
    const c = contractCatalogCounts(texts)
    expect(c).toEqual({ texts: 6, yours: 2, builtIn: 1, blank: 1, fixed: 1, perRecord: 1, inSettings: 0, external: 0, dated: 2 })
    expect(contractCountsLine(c)).toBe('6 texts · 2 your wording · 1 built-in · 1 with nothing set · 1 fixed in the app · 1 typed each time · 2 dated')
    expect(contractCountsLine({ texts: 2, yours: 0, builtIn: 1, blank: 0, fixed: 0, perRecord: 0, inSettings: 1, external: 0, dated: 0 })).toBe('2 texts · 1 built-in · 1 set in Settings · 0 dated')
    expect(contractCountsLine({ texts: 1, yours: 0, builtIn: 0, blank: 0, fixed: 0, perRecord: 0, inSettings: 0, external: 1, dated: 1 })).toBe('1 text · 1 hosted elsewhere · 1 dated')
  })
})

describe('contractSourceLine', () => {
  it('says where each kind of wording is kept', () => {
    expect(contractSourceLine(entry('bid-terms'))).toContain('falls back to the built-in')
    expect(contractSourceLine(entry('estimate-terms'))).toContain('leaves the page empty')
    expect(contractSourceLine(entry('job-standard-terms'))).toContain('Contract Book')
    expect(contractSourceLine(entry('esign-consent'))).toBe('Written in the app.')
    expect(contractSourceLine(entry('job-lien-waiver'))).toContain('around the facts of each record')
    expect(contractSourceLine(entry('estimate-terms-box'))).toContain('Typed on each estimate')
  })
})
