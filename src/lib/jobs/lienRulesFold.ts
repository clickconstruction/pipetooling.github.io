import type { LienRuleDateRow } from './lienRulesDates'

/**
 * The § Rules window's shape over the rendered guide (v2.4826). The guide is one copy of the
 * rules, rendered flat: an `h2` per group, an `h3` per rule, the rule's paragraphs after it.
 * This file reads that DOM once (`indexLienRules`), dresses each rule so it can fold to its
 * question and its first paragraph (`dressLienRules`), folds and unfolds (`setLienRulesOpen`),
 * and swaps the clock rule's example table for live rows (`swapLienRuleDates`). It never sets
 * `hidden`: `helpGuideFind.ts` owns that attribute for narrowing, and a fold is `data-folded`
 * on the rule's members, which the window's CSS hides. The HTML string is never touched.
 */

export type LienRule = {
  id: string
  title: string
  groupId: string
  group: string
  head: HTMLElement
  /** The first paragraph after the heading: the short answer, shown folded. */
  lead: HTMLElement | null
  /** The *Counsel has not read this.* paragraph, shown folded too. */
  counsel: HTMLElement | null
  /** The *Cite.* paragraph's text after the label. */
  cite: string
  /** Everything after the heading up to the next heading, the lead and the counsel line included. */
  members: HTMLElement[]
}

export type LienRuleGroup = { id: string; title: string; head: HTMLElement; rules: LienRule[]; members: HTMLElement[] }

export type LienRulesIndex = { groups: LienRuleGroup[]; rules: LienRule[] }

export const COUNSEL_LABEL = 'Counsel has not read this.'
const CITE_LABEL = 'Cite.'

/** Groups with no rules are the page's own sections (How to use this page, Find a rule): the window folds them away. */
export const LIEN_RULES_PAGE_SECTIONS = new Set(['how-to-use-this-page', 'find-a-rule'])

function labelOf(el: Element): string {
  const strong = el.firstElementChild
  return strong && strong.tagName === 'STRONG' && strong === el.firstChild ? (strong.textContent ?? '').trim() : ''
}

export function indexLienRules(root: ParentNode): LienRulesIndex {
  const groups: LienRuleGroup[] = []
  const rules: LienRule[] = []
  let group: LienRuleGroup | null = null
  let rule: LienRule | null = null
  for (const el of Array.from(root.children) as HTMLElement[]) {
    if (el.tagName === 'H2') {
      group = { id: el.id, title: (el.textContent ?? '').trim(), head: el, rules: [], members: [] }
      groups.push(group)
      rule = null
      continue
    }
    if (el.tagName === 'H3') {
      // A dressed heading carries its cite as a tag; the title is the span the dress left, else the whole text.
      const titleEl = el.querySelector('[data-rule-title]')
      rule = { id: el.id, title: ((titleEl ?? el).textContent ?? '').trim(), groupId: group?.id ?? '', group: group?.title ?? '', head: el, lead: null, counsel: null, cite: '', members: [] }
      rules.push(rule)
      group?.rules.push(rule)
      continue
    }
    if (rule) {
      rule.members.push(el)
      const label = el.tagName === 'P' ? labelOf(el) : ''
      if (!rule.lead && el.tagName === 'P' && !label) rule.lead = el
      else if (label === COUNSEL_LABEL) rule.counsel = el
      else if (label === CITE_LABEL) rule.cite = (el.textContent ?? '').replace(CITE_LABEL, '').trim()
    } else if (group) {
      group.members.push(el)
    }
  }
  return { groups, rules }
}

/**
 * Dress the DOM once: each rule's heading becomes a button that folds and unfolds, its own
 * text in a `[data-rule-title]` span and the cite as a tag beside it (so a second index reads
 * the same title and `headingAnchor` the same id); the lead and the counsel line are marked so they stay visible
 * folded; the page's own sections and every *Back to Find a rule* line are folded away.
 */
export function dressLienRules(root: ParentNode, index: LienRulesIndex): void {
  for (const r of index.rules) {
    r.head.setAttribute('data-rule', r.id)
    r.head.setAttribute('role', 'button')
    r.head.setAttribute('tabindex', '0')
    r.head.setAttribute('aria-expanded', 'false')
    if (!r.head.querySelector('[data-rule-title]')) {
      const title = r.head.ownerDocument.createElement('span')
      title.setAttribute('data-rule-title', '')
      while (r.head.firstChild) title.appendChild(r.head.firstChild)
      r.head.appendChild(title)
    }
    if (r.cite && !r.head.querySelector('[data-rule-cite]')) {
      const tag = r.head.ownerDocument.createElement('span')
      tag.setAttribute('data-rule-cite', '')
      tag.textContent = r.cite
      r.head.appendChild(tag)
    }
    r.lead?.setAttribute('data-rule-lead', '')
    r.counsel?.setAttribute('data-rule-counsel', '')
    for (const m of r.members) m.setAttribute('data-rule-of', r.id)
  }
  for (const g of index.groups) {
    g.head.setAttribute('data-rule-group', g.id)
    const away = LIEN_RULES_PAGE_SECTIONS.has(g.id)
    if (away) g.head.setAttribute('data-page-section', '')
    for (const m of g.members) {
      m.setAttribute('data-group-of', g.id)
      if (away) m.setAttribute('data-page-section', '')
    }
  }
  for (const a of Array.from(root.querySelectorAll('a[data-anchor="find-a-rule"]'))) {
    const p = a.parentElement
    if (p && p.tagName === 'P' && p.childElementCount === 1) p.setAttribute('data-page-section', '')
  }
}

/** Fold every rule but the ones named; a folded rule keeps its heading, its lead and its counsel line. */
export function setLienRulesOpen(index: LienRulesIndex, open: ReadonlySet<string>): void {
  for (const r of index.rules) {
    const isOpen = open.has(r.id)
    r.head.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
    r.head.setAttribute('data-open', isOpen ? 'yes' : 'no')
    for (const m of r.members) {
      const stays = m === r.lead || m === r.counsel
      m.setAttribute('data-folded', isOpen || stays ? 'no' : 'yes')
    }
  }
}

/** The rules a find hit: any whose heading or members hold a mark. */
export function lienRulesHit(index: LienRulesIndex): Set<string> {
  const hit = new Set<string>()
  const has = (el: Element) => el.matches('mark[data-find]') || !!el.querySelector('mark[data-find]')
  for (const r of index.rules) if (has(r.head) || r.members.some(has)) hit.add(r.id)
  return hit
}

/** The rule whose heading is at or just above `y` (the body's top edge plus a little), for the rail. */
export function lienRuleAt(index: LienRulesIndex, y: number): string {
  let at = ''
  for (const r of index.rules) {
    if (r.head.hidden) continue
    if (r.head.getBoundingClientRect().top <= y) at = r.id
    else break
  }
  return at || index.rules.find((r) => !r.head.hidden)?.id || ''
}

/** Replace the clock rule's example rows with live ones; the lit row is the job's. Returns false when the table is not there. */
export function swapLienRuleDates(index: LienRulesIndex, ruleId: string, rows: ReadonlyArray<LienRuleDateRow>): boolean {
  const rule = index.rules.find((r) => r.id === ruleId)
  const table = rule?.members.map((m) => (m.tagName === 'TABLE' ? m : m.querySelector('table'))).find(Boolean) ?? null
  const body = table?.querySelector('tbody')
  if (!table || !body || !rows.length) return false
  const doc = table.ownerDocument
  body.textContent = ''
  for (const r of rows) {
    const tr = doc.createElement('tr')
    if (r.lit) tr.setAttribute('data-lit', 'yes')
    for (const cell of [r.monthWords, r.noticeCommercial, r.noticeHouse, r.lienCommercial, r.lienHouse]) {
      const td = doc.createElement('td')
      td.textContent = cell
      tr.appendChild(td)
    }
    body.appendChild(tr)
  }
  table.setAttribute('data-live-dates', 'yes')
  return true
}
