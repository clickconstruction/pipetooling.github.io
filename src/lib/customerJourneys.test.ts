import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { customerJourneys, findStep, firstRenderableStep, LIEN_STAGES, SAMPLE_EMAIL_IDS, SAMPLE_TEXT_IDS } from './customerJourneys'
import { plainWordsFailures } from './plainWords'
import { SAMPLE_TOKEN, SAMPLE_TOKEN_DONE, SAMPLE_TOKEN_GC, SAMPLE_TOKEN_LOW, SAMPLE_TOKEN_OWNER } from './customerSample'

describe('customerJourneys (What customers see)', () => {
  const journeys = customerJourneys()
  it('five audiences and the lien letters, steps in the order they are met, ids unique', () => {
    expect(journeys.map((j) => j.id)).toEqual(['homeowner', 'gc', 'lien', 'sub', 'house', 'firm'])
    const ids = journeys.flatMap((j) => j.steps.map((s) => s.id))
    expect(new Set(ids).size).toBe(ids.length)
    // Punch list #319: the First look comes before the estimate, as a caller meets it.
    expect(journeys[0]!.steps.map((s) => s.id).slice(0, 7)).toEqual(['first-look-text', 'first-look-page', 'first-look-thanks', 'estimate-email', 'estimate-page', 'estimate-terms', 'estimate-thankyou'])
  })
  it('every email step is on the list the tab builds samples from (v2.3617)', () => {
    for (const j of journeys) for (const s of j.steps) if (s.render.kind === 'email') expect(SAMPLE_EMAIL_IDS).toContain(s.render.email)
  })
  it('every text step is on the list of texts the tab builds from the kernels (Messages cut 5)', () => {
    const texts = journeys.flatMap((j) => j.steps).flatMap((s) => (s.render.kind === 'text' ? [s.render.text] : []))
    expect([...texts].sort()).toEqual([...SAMPLE_TEXT_IDS].sort())
  })
  it('page steps open the real public routes with the sample tokens', () => {
    const pages = journeys.flatMap((j) => j.steps).filter((s) => s.render.kind === 'page')
    for (const s of pages) {
      const { path, absolute } = s.render as { path: string; absolute?: boolean }
      expect(absolute ? /^(https?:)?\/\//.test(path) || path.startsWith('/functions/v1/') : path.startsWith('/')).toBe(true)
      // SAMPLE_TOKEN_LOW (v2.5934): a page's answer below its best, the rating page's after two stars.
      expect([SAMPLE_TOKEN, SAMPLE_TOKEN_DONE, SAMPLE_TOKEN_GC, SAMPLE_TOKEN_OWNER, SAMPLE_TOKEN_LOW].some((tok) => path.endsWith(`=${tok}`) || path.endsWith(`/${tok}`)), path).toBe(true)
    }
    expect(findStep(journeys, 'homeowner', 'estimate-thankyou')?.render).toEqual({ kind: 'page', path: `/estimate/accept?t=${SAMPLE_TOKEN_DONE}` })
    expect(findStep(journeys, 'gc', 'gc-portal')?.render).toEqual({ kind: 'page', path: `/portal?t=${SAMPLE_TOKEN_GC}` })
    expect(findStep(journeys, 'sub', 'sub-contract')?.render).toEqual({ kind: 'page', path: `/contract/accept?t=${SAMPLE_TOKEN}` })
    // v2.3509: the paper steps render from the sample by the app's own builders; the terms page is the live page.
    expect(findStep(journeys, 'homeowner', 'bill-by-email')?.render).toEqual({ kind: 'paper', paper: 'bill-by-email' })
    expect(findStep(journeys, 'lien', 'owner-notice')?.render).toEqual({ kind: 'paper', paper: 'owner-notice' })
    expect(findStep(journeys, 'homeowner', 'estimate-terms')?.render).toEqual({ kind: 'page', path: `/estimate/terms?t=${SAMPLE_TOKEN}` })
    // The contract email comes right before the page it links to (v2.2777).
    const subIds = journeys.find((j) => j.id === 'sub')!.steps.map((s) => s.id)
    expect(subIds.indexOf('sub-contract-email')).toBe(subIds.indexOf('sub-contract') - 1)
    expect(findStep(journeys, 'sub', 'sub-contract-email')?.render).toEqual({ kind: 'email', email: 'contract' })
    // v2.3505: the surfaces that shipped after the tab are on it as Next-release cards, each naming the PR that renders it.
    // v2.3512: every surface renders, opens as a PDF, or is named as sent by another system — no step waits on a release. A new one may
    // be added as `soon` while its release is built, but it must name the PR that renders it.
    const soon = journeys.flatMap((j) => j.steps).filter((s) => s.render.kind === 'soon')
    for (const s of soon) expect((s.render as { note: string }).note).toMatch(/Planned as PR \d/)
    expect(soon.length).toBe(0)
    // The customer's agreement sits in the homeowner journey between the thank-you and the bill — it is not the sub's contract.
    const homeIds = journeys.find((j) => j.id === 'homeowner')!.steps.map((s) => s.id)
    expect(homeIds.indexOf('job-contract-page')).toBeGreaterThan(homeIds.indexOf('estimate-thankyou'))
    expect(homeIds.indexOf('job-contract-page')).toBeLessThan(homeIds.indexOf('bill-email'))
    // Collections paper ends the journey it belongs to.
    expect(homeIds[homeIds.length - 2]).toBe('demand-letter')
    // Punch list #326: the notice to the owner left the GC's journey for the lien letters, where it is step 1.
    const gcIds = journeys.find((j) => j.id === 'gc')!.steps.map((s) => s.id)
    expect(gcIds).not.toContain('owner-notice')
  })
  it('the lien letters: every letter on an unpaid job, in the order it goes, then the two beside the order (punch list #326)', () => {
    const lien = journeys.find((j) => j.id === 'lien')!
    expect(lien.steps.map((s) => s.id)).toEqual([
      'lien-cover-letter',
      'owner-notice',
      'lien-courtesy-email-owner',
      'lien-courtesy-text-owner',
      'lien-courtesy-email-gc',
      'lien-courtesy-text-gc',
      'lien-letter-paid-out',
      'lien-letter-quiet',
      'lien-affidavit',
      'lien-release-of-record',
      'lien-demand-letter',
      'lien-retainage',
    ])
    // Each step says where it stands: a numbered step of the ladder, or beside it. The numbers never go back.
    const stages = lien.steps.map((s) => s.when.split(' · ')[0])
    expect(stages).toEqual(['Step 1', 'Step 1', 'Step 2', 'Step 2', 'Step 2', 'Step 2', 'Step 3', 'Step 3', 'Step 4', 'Step 5', 'Beside the order', 'Beside the order'])
    // The order is said once over the cards, in plain words, and every numbered stage has a step that opens with its number.
    expect(lien.stages).toEqual([...LIEN_STAGES])
    expect(LIEN_STAGES.map((st) => st.n)).toEqual(['1', '2', '3', '4', '5', '', ''])
    for (const st of LIEN_STAGES) {
      expect(plainWordsFailures(st.when), st.name).toEqual([])
      if (st.n) expect(stages).toContain(`Step ${st.n}`)
    }
    expect(journeys.filter((j) => j.stages).map((j) => j.id)).toEqual(['lien'])
    // Nothing waits on a release: every one draws, as a paper, an email or a text.
    expect(lien.steps.map((s) => s.render.kind)).toEqual(['paper', 'paper', 'email', 'text', 'email', 'text', 'paper', 'paper', 'paper', 'paper', 'paper', 'paper'])
    // The demand letter is the homeowner's own paper, shown here too; the homeowner's journey keeps its step for A person.
    expect(findStep(journeys, 'lien', 'lien-demand-letter')?.render).toEqual({ kind: 'paper', paper: 'demand-letter' })
    expect(findStep(journeys, 'homeowner', 'demand-letter')?.render).toEqual({ kind: 'paper', paper: 'demand-letter' })
  })
  it('every renderable step names what it reflects; external and soon steps carry a note', () => {
    for (const s of journeys.flatMap((j) => j.steps)) {
      if (s.render.kind === 'page' || s.render.kind === 'email' || s.render.kind === 'paper' || s.render.kind === 'text') expect(s.reflects.length).toBeGreaterThan(0)
      else expect(s.render.note.length).toBeGreaterThan(10)
    }
  })
  it('every step says what the person can do there and points at a help guide that exists (v2.3507)', () => {
    for (const s of journeys.flatMap((j) => j.steps)) {
      expect(s.customerCan.length, s.id).toBeGreaterThan(15)
      expect(existsSync(resolve(__dirname, `../content/help/${s.guide}.md`)), `${s.id} → ${s.guide}`).toBe(true)
    }
  })
  it('lands on the first page a caller meets: Show us the problem (punch list #319; the estimate email before it)', () => {
    expect(firstRenderableStep(journeys)).toEqual({ journeyId: 'homeowner', stepId: 'first-look-page' })
    expect(findStep(journeys, 'sub', 'nope')).toBeNull()
  })
  it('captions read in office words — no function names or route paths where the office reads them (v2.3518)', () => {
    for (const s of journeys.flatMap((j) => j.steps)) {
      expect(s.sublabel, s.id).not.toMatch(/\b[a-z]+(-[a-z]+){2,}\b/) // a function folder name like send-job-contract
      expect(s.sublabel, s.id).not.toMatch(/^\/[a-z]/) // a route path
    }
    expect(findStep(journeys, 'firm', 'firm-confirmed-page')?.render).toEqual({ kind: 'page', path: `/legal/confirm?t=${SAMPLE_TOKEN}` })
  })
})
