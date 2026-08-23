#!/usr/bin/env node
/**
 * Dialog-role sweep (v2.2188, PR 2 of the modal scroll-lock plan).
 *
 * Adds `role="dialog" aria-modal="true"` to modal panels that never got one, so
 * the app-wide scroll lock (v2.2186) detects them explicitly — and so assistive
 * tech announces them as dialogs. Mechanical and re-runnable (rebase rule: re-run
 * this, never hand-resolve its diff).
 *
 * Per file with a fixed `inset: 0` backdrop and no role="dialog":
 *  - if an element already has aria-modal="true" → add role="dialog" to it
 *  - else, for each dark backdrop (position: 'fixed' + inset: 0 + rgba(0,0,0,…)
 *    in one style literal): tag the first plain element inside it (div/form/
 *    section/article) as the panel; if the first child isn't a plain element,
 *    tag the backdrop itself
 *  - files listed in SKIP (click-catchers, timelines, swipe surfaces) are left alone
 *
 * Usage: node scripts/codemods/dialog-role-sweep.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { globSync } from 'glob'

const DRY = process.argv.includes('--dry')
const SKIP = new Set([
  'src/components/JobReportsModal.tsx',
  'src/components/schedule/DispatchAddBlockTimeRange.tsx',
  'src/components/schedule/ScheduleDispatchHub.tsx',
  'src/components/schedule/ScheduleDispatchGrid.tsx',
  'src/components/shared/SwipeToConfirm.tsx',
  'src/components/jobs/JobsStagesThreadPanel.tsx',
  'src/components/jobs/ScheduleDayTimeline.tsx',
  'src/components/checklist/ChecklistTechTreeTab.tsx',
  'src/components/Toast.tsx',
])

const files = globSync('src/**/*.tsx', { ignore: ['**/*.test.tsx'] }).sort()
let touched = 0
let panels = 0
let backdrops = 0
let ariaOnly = 0
const report = []

for (const f of files) {
  if (SKIP.has(f)) continue
  let s = readFileSync(f, 'utf8')
  if (!s.includes('inset: 0') || s.includes('role="dialog"')) continue
  const before = s

  if (s.includes('aria-modal="true"')) {
    // role missing on the element that already declares aria-modal — but only
    // when that element's own opening tag carries no role (alertdialog counts)
    s = s.replace(/aria-modal="true"/g, (match, offset, str) => {
      const tagStart = str.lastIndexOf('<', offset)
      const openSoFar = str.slice(tagStart, offset)
      if (/\brole=/.test(openSoFar)) return match
      const tagEnd = str.indexOf('>', offset)
      if (/\brole=/.test(str.slice(offset, tagEnd))) return match
      ariaOnly += 1
      return 'role="dialog" aria-modal="true"'
    })
  } else {
    // walk each opening <div … style={{ … position: 'fixed' … inset: 0 … rgba(0,0,0 … }} …>
    const tagRe = /<div\b(?:(?!<\/div>)[\s\S]){0,1400}?>/g
    let m
    const edits = []
    while ((m = tagRe.exec(s))) {
      const tag = m[0]
      // the opening tag must close before any child; crude but effective: stop at first ">" that ends the tag
      const tagEnd = tag.indexOf('>')
      const open = tag.slice(0, tagEnd + 1)
      if (!/position: '?fixed'?/.test(open) || !/inset: 0/.test(open) || !/rgba\(0, ?0, ?0/.test(open)) continue
      if (/\brole=/.test(open)) continue
      // find the first child element after the backdrop's opening tag
      const after = s.slice(m.index + open.length)
      const child = /^[\s\S]*?<([A-Za-z][\w.]*)\b/.exec(after)
      const childTag = child ? child[1] : null
      const isPlain = childTag && /^(div|form|section|article|dialog)$/.test(childTag)
      if (isPlain) {
        // tag the panel: insert after "<div" (etc.) of that child, unless it already has a role
        const childStart = m.index + open.length + child[0].length - child[1].length - 1
        const childOpenEnd = s.indexOf('>', childStart)
        const childOpen = s.slice(childStart, childOpenEnd + 1)
        if (/\brole=/.test(childOpen)) continue
        edits.push({ at: childStart + 1 + childTag.length, kind: 'panel' })
      } else {
        edits.push({ at: m.index + 4, kind: 'backdrop' })
      }
    }
    // apply from the end so offsets stay valid
    edits.sort((a, b) => b.at - a.at)
    for (const e of edits) {
      s = s.slice(0, e.at) + ' role="dialog" aria-modal="true"' + s.slice(e.at)
      if (e.kind === 'panel') panels += 1
      else backdrops += 1
    }
  }

  if (s !== before) {
    touched += 1
    report.push(f)
    if (!DRY) writeFileSync(f, s)
  }
}

console.log(`${DRY ? '[dry] ' : ''}files touched: ${touched} · panels tagged: ${panels} · backdrops tagged (fallback): ${backdrops} · aria-modal-only fixed: ${ariaOnly}`)
console.log(report.join('\n'))
