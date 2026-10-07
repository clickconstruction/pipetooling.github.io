// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { helpGuideMarkdownToSafeHtml } from '../helpGuideHtml'
import { applyHeadingAnchors, headingAnchor } from '../helpGuideAnchors'
import { markFindMatches } from '../helpGuideFind'
import { LIEN_RULES_GUIDE_SLUG, LIEN_RULE_CITES } from './lienRuleCites'
import { dressLienRules, indexLienRules, lienRulesHit, setLienRulesOpen, swapLienRuleDates } from './lienRulesFold'
import { lienRuleDateRows } from './lienRulesDates'

const source = readFileSync(`${process.cwd()}/src/content/help/${LIEN_RULES_GUIDE_SLUG}.md`, 'utf8')
const body = source.replace(/^---\n[\s\S]*?\n---\n/, '')

function mount() {
  const root = document.createElement('div')
  root.innerHTML = helpGuideMarkdownToSafeHtml(body)
  document.body.appendChild(root)
  applyHeadingAnchors(root)
  const index = indexLienRules(root)
  dressLienRules(root, index)
  return { root, index }
}

describe('indexLienRules over the real guide (v2.4826)', () => {
  it('reads every rule with its group, a lead sentence and a cite', () => {
    const { index } = mount()
    expect(index.rules.length).toBeGreaterThanOrEqual(20)
    for (const r of index.rules) {
      expect(r.lead, `${r.title} has a lead paragraph`).not.toBeNull()
      expect(r.cite, `${r.title} has a cite`).not.toBe('')
      expect(r.group, `${r.title} sits in a group`).not.toBe('')
    }
    expect(index.groups.map((g) => g.title)).toEqual(['How to use this page', 'Find a rule', 'The clock', 'The notice', 'The lien', 'The demand letter', 'Interest', 'Limits on a collection letter', 'Not yet read by counsel'])
  })
  it('every door cite lands on an indexed rule', () => {
    const { index } = mount()
    const ids = new Set(index.rules.map((r) => r.id))
    for (const heading of Object.values(LIEN_RULE_CITES)) expect(ids.has(headingAnchor(heading)), heading).toBe(true)
  })
  it('the two rules counsel has not read carry their line, and no other rule does', () => {
    const { index } = mount()
    const withCounsel = index.rules.filter((r) => r.counsel).map((r) => r.id)
    expect(withCounsel).toEqual(['how-soon-the-lien-can-be-filed', 'a-late-notice-can-still-carry-the-affidavit'])
  })
})

describe('dressLienRules + setLienRulesOpen', () => {
  it('folds every rule but the open one to its question, its lead and its counsel line; the cite rides on the heading', () => {
    const { root, index } = mount()
    setLienRulesOpen(index, new Set(['what-the-notice-is-and-where-it-goes']))
    const notice = index.rules.find((r) => r.id === 'what-the-notice-is-and-where-it-goes')!
    expect(notice.head.getAttribute('aria-expanded')).toBe('true')
    expect(notice.members.every((m) => m.getAttribute('data-folded') === 'no')).toBe(true)
    expect(notice.head.querySelector('[data-rule-cite]')?.textContent).toBe('§ 53.056(a-1) to (a-3), § 53.003')
    const clock = index.rules.find((r) => r.id === 'when-each-date-falls')!
    expect(clock.head.getAttribute('aria-expanded')).toBe('false')
    expect(clock.lead?.getAttribute('data-folded')).toBe('no')
    expect(clock.members.filter((m) => m !== clock.lead).every((m) => m.getAttribute('data-folded') === 'yes')).toBe(true)
    const late = index.rules.find((r) => r.id === 'a-late-notice-can-still-carry-the-affidavit')!
    expect(late.counsel?.getAttribute('data-folded')).toBe('no')
    // The page's own sections and the Back links are folded away.
    expect(root.querySelector('h2#find-a-rule')?.hasAttribute('data-page-section')).toBe(true)
    expect(root.querySelectorAll('p[data-page-section]').length).toBeGreaterThanOrEqual(7)
    expect(root.querySelector('h2#the-clock')?.hasAttribute('data-page-section')).toBe(false)
  })
  it('a second index of a dressed body reads the same titles and ids', () => {
    const { root, index } = mount()
    const again = indexLienRules(root)
    dressLienRules(root, again)
    expect(again.rules.map((r) => r.title)).toEqual(index.rules.map((r) => r.title))
    expect(again.rules.map((r) => r.id)).toEqual(index.rules.map((r) => r.id))
    expect(root.querySelectorAll('[data-rule-cite]').length).toBe(index.rules.filter((r) => r.cite).length)
  })
  it('a find names the rules it hit', () => {
    const { root, index } = mount()
    markFindMatches(root, 'homestead')
    const hit = lienRulesHit(index)
    expect(hit.has('a-homestead-needs-one-more-statement')).toBe(true)
    expect(hit.has('what-the-affidavit-needs-before-it-can-be-filed')).toBe(true)
    expect(hit.has('what-a-justice-court-can-hear')).toBe(false)
  })
})

describe('swapLienRuleDates', () => {
  it('rebuilds the clock table from live rows and lights the job row', () => {
    const { index } = mount()
    const rows = lienRuleDateRows('2026-10-07', { workMonth: '2026-07' })
    expect(swapLienRuleDates(index, 'when-each-date-falls', rows)).toBe(true)
    const table = index.rules.find((r) => r.id === 'when-each-date-falls')!.members.map((m) => m.querySelector('table') ?? (m.tagName === 'TABLE' ? m : null)).find(Boolean)!
    const trs = Array.from(table.querySelectorAll('tbody tr'))
    expect(trs.map((tr) => tr.firstElementChild?.textContent)).toEqual(['June', 'July', 'August'])
    expect(trs.map((tr) => tr.getAttribute('data-lit'))).toEqual([null, 'yes', null])
    expect(trs[1]?.children[3]?.textContent).toBe('Nov 16')
  })
  it('says so when a rule has no table', () => {
    const { index } = mount()
    expect(swapLienRuleDates(index, 'what-a-justice-court-can-hear', lienRuleDateRows('2026-10-07'))).toBe(false)
  })
})
