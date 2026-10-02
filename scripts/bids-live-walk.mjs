#!/usr/bin/env node
/**
 * The Bids live walk (2026-10-02): an estimator's day on a throwaway version of a test bid, run
 * headless against a local dev server, which talks to PROD. docs/E2E_SMOKE.md → "The Bids live
 * walk" says when to use it. Run it on `main`, run it on the branch, diff the two.
 *
 *   node scripts/bids-live-walk.mjs login                       # dev-login once → e2e/.auth/bids-walk.json
 *   node scripts/bids-live-walk.mjs walk     out/main           # the 20 steps → out/main/walk-result.json
 *   node scripts/bids-live-walk.mjs snapshot out/main 398,490   # each bid's four tabs as text → snapshot.json
 *   node scripts/bids-live-walk.mjs diff     out/main out/branch
 *
 * PORT (default 5173) is the dev server's port. BID (default 398) is the test bid, BP398 "ZZ Test".
 *
 * What it writes, and only this: a version named "ZZ walk (delete me)" on the test bid, made from
 * "To Plans", edited, then deleted; and the bid's labor rate, changed and put back. The last step
 * checks "To Plans" reads as it did. If a run dies half way, the next run reuses the leftover
 * version and deletes it; or open the bid and delete it by hand.
 * `login` stores a real prod session. Delete e2e/.auth/bids-walk.json when you are done.
 */
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { unifiedDiff } from './lib/unifiedDiff.mjs'

const PORT = process.env.PORT || 5173
const BID = process.env.BID || '398'
const BASE = `http://localhost:${PORT}`
const STATE = resolve('e2e/.auth/bids-walk.json')
const NAME = 'ZZ walk (delete me)'
const [mode, argA, argB] = process.argv.slice(2)

const esc = (s) => s.replace(/[()]/g, '\\$&')
async function open(view = 'new2') {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1700, height: 1300 }, storageState: STATE, acceptDownloads: true })
  await ctx.addInitScript((v) => { try { window.localStorage.setItem('bids_takeoff_view_v1', v) } catch {} }, view)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon|net::ERR/.test(m.text())) errors.push('console: ' + m.text().slice(0, 240)) })
  return { b, ctx, page, errors }
}
async function openBid(page, n = BID) {
  await page.goto(`${BASE}/bids?tab=takeoffs`)
  await page.evaluate(() => window.sessionStorage.removeItem('bids.sharedBidId'))
  await page.goto(`${BASE}/bids?tab=takeoffs`)
  await page.waitForTimeout(2500)
  const mine = page.getByRole('checkbox', { name: /Only my bids/ }).first()
  if (await mine.count() && await mine.isChecked()) await mine.uncheck()
  await page.getByPlaceholder(/Search bids/).first().fill(n)
  await page.waitForTimeout(1200)
  await page.getByText(new RegExp(`^B${n} · `)).first().click()
  await page.waitForTimeout(5000)
}
const versionButton = (page, name) => page.getByRole('button', { name: new RegExp('^' + esc(name)) }).first()
const text = (page) => page.evaluate(() => (document.querySelector('.pageWrap') || document.body).innerText)
async function tab(page, name, wait = 5000) { await page.getByRole('button', { name, exact: true }).first().click(); await page.waitForTimeout(wait) }
async function deleteVersion(page, name) {
  const chip = page.locator('span', { has: page.getByRole('button', { name: new RegExp('^' + esc(name)) }) }).last()
  await chip.getByTitle('Rename / delete version').click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Delete', exact: true }).first().click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
  await page.waitForTimeout(5000)
}
async function createVersion(page, name, from = 'To Plans') {
  await page.getByRole('button', { name: '+ version' }).first().click()
  await page.waitForTimeout(800)
  const sel = page.locator('select').filter({ hasText: from }).last()
  const opt = await sel.locator('option').filter({ hasText: from }).first().getAttribute('value')
  await sel.selectOption(opt)
  await page.getByPlaceholder('e.g. Value Engineered').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByText(`Created version "${name}".`).waitFor({ timeout: 30000 })
  await page.waitForTimeout(6000)
}

async function walk(OUT) {
  mkdirSync(OUT, { recursive: true })
  const { b, page, errors } = await open()
  const R = {}
  const step = async (name, fn) => {
    try { R[name] = await fn(); console.log('ok  ', name, '→', JSON.stringify(R[name]).slice(0, 260)) }
    catch (e) { R[name] = 'FAILED: ' + e.message.split('\n')[0]; console.log('FAIL', name, '→', e.message.split('\n').slice(0, 14).join(' | ')); await page.screenshot({ path: `${OUT}/walk-fail-${name.replace(/\W+/g, '_')}.png`, fullPage: true }).catch(() => {}) }
  }
  const kpis = async () => { const t = await text(page); const m = /COSTED\s+(\d+ of \d+)\s+MATERIALS\s+(\$[\d,.]+)/.exec(t); return m ? { costed: m[1], materials: m[2] } : { raw: t.slice(0, 200) } }
  const stages = async () => { const t = await text(page); const i = t.indexOf('STAGES · MATERIALS BY STAGE'); return i < 0 ? null : t.slice(i, i + 260).replace(/\s*\n+\s*/g, ' | ') }
  const toast = async (re, ms = 15000) => { const l = page.getByText(re).first(); await l.waitFor({ timeout: ms }); return (await l.innerText()).slice(0, 160) }
  const fixtureRow = (label) => page.locator('tr', { has: page.getByRole('group', { name: `Stage for ${label}`, exact: true }) }).first()

  await openBid(page)
  const BID_ID = new URL(page.url()).searchParams.get('bidId')
  await step('00 To Plans before', async () => { await versionButton(page, 'To Plans').click(); await page.waitForTimeout(4000); return kpis() })
  if (!(await page.getByText(NAME).count())) await createVersion(page, NAME)
  await versionButton(page, NAME).click()
  await page.waitForTimeout(5000)
  await step('01 sandbox opens like its source', kpis)
  await step('02 no Materials pills', async () => ({ byStage: await page.getByRole('button', { name: 'By Stage', exact: true }).count(), combined: await page.getByRole('button', { name: 'Combined', exact: true }).count() }))

  await step('03 Apply the book suggestion on WC', async () => {
    const before = await kpis()
    await page.getByRole('button', { name: 'Apply', exact: true }).first().click()
    const t = await toast(/Added \d+ part line|from the book|Filled|part line/i).catch(() => '(no toast)')
    await page.waitForTimeout(4000)
    return { before, after: await kpis(), toast: t }
  })

  await step('04 Add part line on WH and pick a part', async () => {
    const before = await kpis()
    const row = page.locator('tr', { has: page.getByRole('group', { name: 'Stage for WH', exact: true }) }).first()
    await row.getByText('Add part line').click()
    const input = page.getByPlaceholder('Search parts…').last()
    await input.waitFor({ timeout: 10000 })
    await input.fill('valve')
    await page.waitForTimeout(1500)
    const first = page.locator('ul li').filter({ hasNotText: /Loading parts|No parts match/ }).first()
    const picked = (await first.innerText()).split('\n')[0].slice(0, 80)
    await first.click()
    await page.waitForTimeout(4000)
    return { before, after: await kpis(), picked }
  })

  await step('05 Change that line quantity to 3', async () => {
    const before = await kpis()
    const row = page.locator('tr', { has: page.getByRole('button', { name: 'Remove part line' }) }).last()
    const qty = row.locator('input.rough-takeoff-qty-input').first()
    await qty.click()
    await page.keyboard.type('3')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(3000)
    return { before, after: await kpis(), rowText: (await row.innerText()).replace(/\s*\n+\s*/g, ' | ').slice(0, 200) }
  })

  await step('06 Stage box on Toilets', async () => {
    const before = await stages()
    await page.getByRole('group', { name: 'Stage for Toilets', exact: true }).getByRole('button', { name: /^1 Rough In/ }).click()
    await page.waitForTimeout(3000)
    return { before, after: await stages() }
  })

  await step('07 Fill from rules & book (stages)', async () => {
    await page.getByRole('button', { name: /Fill from rules/ }).first().click()
    await page.waitForTimeout(5000)
    return { stages: await stages() }
  })

  await step('08 Fill from book (lines)', async () => {
    const before = await kpis()
    const btn = page.getByRole('button', { name: /^Fill from book/ }).first()
    const label = await btn.innerText()
    const disabled = await btn.isDisabled()
    let t = '(button disabled)'
    if (!disabled) { await btn.click(); t = await toast(/fixture|Filled|part line|book/i, 20000).catch(() => '(no toast)'); await page.waitForTimeout(5000) }
    return { label, before, after: await kpis(), toast: t }
  })

  await step('09 Add assembly on 2" PVC', async () => {
    const before = await kpis()
    const row = page.locator('tr', { has: page.getByRole('group', { name: /^Stage for ft of 2" PVC$/ }) }).first()
    await row.getByText('Add assembly').click()
    const search = page.getByPlaceholder('Search assemblies by name or description…')
    await search.waitFor({ timeout: 10000 })
    await search.fill('toilet')
    await page.waitForTimeout(1000)
    const item = page.getByTitle('Expand this assembly into individual part lines').first()
    const picked = (await item.innerText()).split('\n')[0].slice(0, 60)
    await item.click()
    const t = await toast(/Added \d+ part line/i, 20000).catch(() => '(no toast)')
    await page.waitForTimeout(4000)
    return { before, after: await kpis(), picked, toast: t }
  })

  await step('10 Remove the last part line', async () => {
    const before = await kpis()
    const rm = page.locator('button[aria-label="Remove part line"]')
    await rm.first().waitFor({ timeout: 15000 })
    const n0 = await rm.count()
    await rm.last().scrollIntoViewIfNeeded()
    await rm.last().dispatchEvent('click') // the floating bottom bar sits over the last row in a tall headless page
    await page.getByText('Remove this line?').waitFor({ timeout: 8000 })
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await page.waitForTimeout(3500)
    return { linesBefore: n0, linesAfter: await rm.count(), before, after: await kpis() }
  })

  await step('11 Print the takeoff', async () => {
    const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 15000 }), page.getByRole('button', { name: 'Print', exact: true }).first().click()])
    await popup.waitForLoadState('domcontentloaded').catch(() => {})
    await popup.waitForTimeout(1500)
    const html = await popup.content()
    await popup.close().catch(() => {})
    return { title: (/<title>([^<]*)<\/title>/.exec(html) || [])[1], tables: (html.match(/<table/g) || []).length, bytes: html.length }
  })

  await step('12 One at a time and back', async () => {
    await page.getByRole('tab', { name: 'One at a time' }).click()
    await page.waitForTimeout(2500)
    const focus = await page.getByTestId('takeoff-focus-view').count()
    await page.getByRole('tab', { name: 'Sheet' }).click()
    await page.waitForTimeout(2500)
    return { focusView: focus, railView: await page.getByTestId('takeoff-cost-rail-view').count() }
  })

  const takeoffKpis = await kpis()
  await step('13 Labor shows the same materials', async () => {
    await tab(page, 'Labor', 7000)
    const t = await text(page)
    const m = /materials\s+(\$[\d,.]+|—)\s*(\(takeoff\))?/.exec(t)
    const pills = ['materials from takeoff', 'no materials yet'].filter((p) => t.includes(p))
    return { laborMaterials: m ? m[1] : null, takeoffMaterials: takeoffKpis.materials, same: m ? m[1] === takeoffKpis.materials : false, pills, byStage: await page.getByRole('button', { name: 'By Stage', exact: true }).count() }
  })

  await step('14 Labor: change the rate, autosave, read it back, put it back', async () => {
    const RATE = 'input[aria-label="Labor rate, dollars per hour"]'
    const cell = page.locator(RATE).first()
    const orig = await cell.inputValue()
    const next = String((parseFloat(orig || '0') || 0) + 1)
    await cell.click(); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.type(next)
    await page.waitForTimeout(300)
    const stateSoon = await cell.getAttribute('data-save-state')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(5000)
    const stateLater = await cell.getAttribute('data-save-state')
    await page.reload(); await page.waitForTimeout(8000)
    const cell2 = page.locator(RATE).first()
    const persisted = await cell2.inputValue()
    await cell2.click(); await page.keyboard.press('ControlOrMeta+a'); if (orig) await page.keyboard.type(orig); else await page.keyboard.press('Backspace')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(5000)
    await page.reload(); await page.waitForTimeout(8000)
    return { orig, typed: next, stateSoon, stateLater: stateLater ?? 'saved', persisted, restored: await page.locator(RATE).first().inputValue() }
  })

  await step('15 Labor print', async () => {
    const btn = page.getByRole('button', { name: /^Print/ }).first()
    const label = await btn.innerText()
    const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 15000 }), btn.click()])
    await popup.waitForLoadState('domcontentloaded').catch(() => {})
    await popup.waitForTimeout(1500)
    const html = await popup.content()
    await popup.close().catch(() => {})
    return { button: label, title: (/<title>([^<]*)<\/title>/.exec(html) || [])[1], hasMaterials: /Materials total \(pre-tax\)/.test(html), hasPO: /PO \(/.test(html), bytes: html.length }
  })

  await step('16 Pricing', async () => {
    await tab(page, 'Pricing', 9000)
    const t = await text(page)
    const head = /(\d+% margin · profit \$[\d,.]+)/.exec(t)
    const money = (t.match(/(?:Materials|materials|Labor|Cost|Revenue|Profit)[^\n]{0,24}\$[\d,.]+/g) || []).slice(0, 12)
    const i = t.indexOf('FIXTURE OR TIE-IN')
    return { head: head ? head[1] : null, money, tableHead: i < 0 ? null : t.slice(i, i + 700).replace(/\s*\n+\s*/g, ' | '), byStage: await page.getByRole('button', { name: 'By Stage', exact: true }).count() }
  })

  await step('17 Cover Letter', async () => {
    await tab(page, 'Cover Letter', 9000)
    const t = await text(page)
    const amt = /\(\$[\d,]+\.\d\d\)/.exec(t)
    return { amount: amt ? amt[0] : null, chars: t.length }
  })

  await step('18 Approval PDF downloads', async () => {
    await page.goto(`${BASE}/bids?tab=submission-followup&bidId=${BID_ID}`)
    const btn = page.getByRole('button', { name: 'Approval PDF' }).first()
    await btn.waitFor({ timeout: 30000 }).catch(() => {})
    if (!(await btn.count())) { await page.screenshot({ path: `${OUT}/walk-followup.png`, fullPage: true }); return { skipped: 'no Approval PDF button on this view' } }
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), btn.click()])
    const p = `${OUT}/approval.pdf`
    await dl.saveAs(p)
    const raw = readFileSync(p).toString('latin1')
    return { file: dl.suggestedFilename(), bytes: statSync(p).size, pages: (raw.match(/\/Type\s*\/Page[^s]/g) || []).length }
  })

  // clean up: back to Takeoffs, delete the sandbox, check To Plans is untouched
  await step('19 delete the sandbox version', async () => {
    await page.goto(`${BASE}/bids?tab=takeoffs&bidId=${BID_ID}`)
    await page.waitForTimeout(8000)
    await deleteVersion(page, NAME)
    return { stillListed: await page.getByText(NAME).count() }
  })
  await step('20 To Plans after', async () => { await versionButton(page, 'To Plans').click(); await page.waitForTimeout(5000); return kpis() })
  R.errors = [...new Set(errors)]
  console.log('page errors:', JSON.stringify(R.errors.slice(0, 8), null, 1))
  writeFileSync(`${OUT}/walk-result.json`, JSON.stringify(R, null, 1))
  await b.close()
    return R
}

async function snapshot(OUT, BIDS) {
  const TABS = ['Takeoffs', 'Labor', 'Pricing', 'Cover Letter']
  mkdirSync(OUT, { recursive: true })
  const { b, page, errors } = await open()
  const result = {}
  for (const n of BIDS) {
    result[n] = {}
    await page.goto(`${BASE}/bids?tab=takeoffs`)
    await page.evaluate(() => window.sessionStorage.removeItem('bids.sharedBidId'))
    await page.goto(`${BASE}/bids?tab=takeoffs`)
    await page.waitForTimeout(2500)
    const mine = page.getByRole('checkbox', { name: /Only my bids/ }).first()
    if (await mine.count()) { if (await mine.isChecked()) await mine.uncheck() } else { await page.getByText('Only my bids').first().click() }
    await page.waitForTimeout(600)
    const box = page.getByPlaceholder(/Search bids/)
    await box.first().fill(n)
    await page.waitForTimeout(1200)
    const row = page.getByText(new RegExp(`^B${n} · `)).first()
    try { await row.click({ timeout: 6000 }) } catch {
      result[n] = { notFound: (await page.evaluate(() => (document.querySelector('.pageWrap') || document.body).innerText)).slice(0, 700) }
      continue
    }
    await page.waitForTimeout(1500)
    for (const tab of TABS) {
      await page.getByRole('button', { name: tab, exact: true }).first().click()
      await page.waitForTimeout(5000)
      const text = await page.evaluate(() => (document.querySelector('.pageWrap') || document.body).innerText)
      const pills = {
        byStageButton: await page.getByRole('button', { name: 'By Stage', exact: true }).count(),
        combinedButton: await page.getByRole('button', { name: 'Combined', exact: true }).count(),
        createPOs: await page.getByText('Create purchase orders for Stages').count(),
        focusView: await page.getByTestId('takeoff-focus-view').count(),
        railView: await page.getByTestId('takeoff-cost-rail-view').count(),
      }
      result[n][tab] = { pills, text }
      await page.screenshot({ path: `${OUT}/B${n}-${tab.replace(/ /g, '')}.png`, fullPage: false })
    }
  }
  writeFileSync(`${OUT}/snapshot.json`, JSON.stringify(result, null, 1))
  console.log('errors:', JSON.stringify([...new Set(errors)].slice(0, 12), null, 1))
  for (const n of BIDS) { if (result[n].notFound) { console.log(n, 'NOT FOUND', result[n].notFound.replace(/\n/g, ' | ').slice(0, 500)); continue } for (const t of TABS) console.log(n, t, JSON.stringify(result[n][t].pills), result[n][t].text.length) }
  await b.close()
}

async function login() {
  mkdirSync(dirname(STATE), { recursive: true })
  const b = await chromium.launch()
  const ctx = await b.newContext()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/dev-login?as=1&to=` + encodeURIComponent('/bids?tab=takeoffs'))
  await page.waitForURL((u) => new URL(u).pathname === '/bids', { timeout: 60000 })
  await page.waitForTimeout(2000)
  await ctx.storageState({ path: STATE })
  await b.close()
  console.log(`signed in as the dev login; session saved to ${STATE} (a real prod session: delete it when done)`)
}

/** Steps whose results differ between two walks, and the changed lines between two snapshots. */
function diff(a, b) {
  let differing = 0
  const read = (dir, f) => (existsSync(`${dir}/${f}`) ? JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) : null)
  const wa = read(a, 'walk-result.json'), wb = read(b, 'walk-result.json')
  if (wa && wb) {
    for (const k of [...new Set([...Object.keys(wa), ...Object.keys(wb)])].sort()) {
      if (JSON.stringify(wa[k]) === JSON.stringify(wb[k])) continue
      differing += 1
      console.log(`walk step differs: ${k}\n   ${a}: ${JSON.stringify(wa[k])?.slice(0, 400)}\n   ${b}: ${JSON.stringify(wb[k])?.slice(0, 400)}`)
    }
    if (!differing) console.log('walk: every step gives the same result')
  }
  const sa = read(a, 'snapshot.json'), sb = read(b, 'snapshot.json')
  if (sa && sb) {
    let lines = 0
    for (const n of Object.keys(sa)) for (const tab of Object.keys(sa[n] ?? {})) {
      if (!sb[n]?.[tab]?.text || !sa[n][tab].text) continue
      const changed = unifiedDiff(sa[n][tab].text.split('\n'), sb[n][tab].text.split('\n'))
      lines += changed.length
      if (changed.length) console.log(`B${n} ${tab}: ${changed.length} changed line(s)\n   ${changed.slice(0, 12).map((l) => l.slice(0, 160)).join('\n   ')}`)
    }
    if (!lines) console.log('snapshot: every tab reads the same')
    differing += lines
  }
  if (!wa && !sa) console.log(`nothing to compare in ${a}`)
  return differing
}

if (mode !== 'login' && mode !== 'diff' && !existsSync(STATE)) {
  console.error('no saved session: run `node scripts/bids-live-walk.mjs login` first (the dev server must be up)')
  process.exit(2)
}
if (mode === 'login') await login()
else if (mode === 'walk' && argA) { const R = await walk(argA); process.exit(Object.values(R).some((v) => typeof v === 'string' && v.startsWith('FAILED')) || R.errors.length ? 1 : 0) }
else if (mode === 'snapshot' && argA) await snapshot(argA, (argB || BID).split(','))
else if (mode === 'diff' && argA && argB) process.exit(diff(argA, argB) ? 1 : 0)
else { console.error('usage: bids-live-walk.mjs login | walk <out> | snapshot <out> [bids] | diff <outA> <outB>'); process.exit(2) }
