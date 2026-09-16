import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { customerJourneys, findStep, firstRenderableStep } from './customerJourneys'
import { SAMPLE_TOKEN, SAMPLE_TOKEN_DONE, SAMPLE_TOKEN_GC } from './customerSample'

describe('customerJourneys (What customers see)', () => {
  const journeys = customerJourneys()
  it('five audiences, steps in the order they are met, ids unique', () => {
    expect(journeys.map((j) => j.id)).toEqual(['homeowner', 'gc', 'sub', 'house', 'firm'])
    const ids = journeys.flatMap((j) => j.steps.map((s) => s.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(journeys[0]!.steps.map((s) => s.id).slice(0, 4)).toEqual(['estimate-email', 'estimate-page', 'estimate-terms', 'estimate-thankyou'])
  })
  it('page steps open the real public routes with the sample tokens', () => {
    const pages = journeys.flatMap((j) => j.steps).filter((s) => s.render.kind === 'page')
    for (const s of pages) {
      const { path, absolute } = s.render as { path: string; absolute?: boolean }
      expect(absolute ? /^(https?:)?\/\//.test(path) || path.startsWith('/functions/v1/') : path.startsWith('/')).toBe(true)
      expect([SAMPLE_TOKEN, SAMPLE_TOKEN_DONE, SAMPLE_TOKEN_GC].some((tok) => path.endsWith(`=${tok}`) || path.endsWith(`/${tok}`)), path).toBe(true)
    }
    expect(findStep(journeys, 'homeowner', 'estimate-thankyou')?.render).toEqual({ kind: 'page', path: `/estimate/accept?t=${SAMPLE_TOKEN_DONE}` })
    expect(findStep(journeys, 'gc', 'gc-portal')?.render).toEqual({ kind: 'page', path: `/portal?t=${SAMPLE_TOKEN_GC}` })
    expect(findStep(journeys, 'sub', 'sub-contract')?.render).toEqual({ kind: 'page', path: `/contract/accept?t=${SAMPLE_TOKEN}` })
    // v2.3509: the paper steps render from the sample by the app's own builders; the terms page is the live page.
    expect(findStep(journeys, 'homeowner', 'bill-by-email')?.render).toEqual({ kind: 'paper', paper: 'bill-by-email' })
    expect(findStep(journeys, 'gc', 'owner-notice')?.render).toEqual({ kind: 'paper', paper: 'owner-notice' })
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
    const gcIds = journeys.find((j) => j.id === 'gc')!.steps.map((s) => s.id)
    expect(gcIds[gcIds.length - 1]).toBe('owner-notice')
  })
  it('every renderable step names what it reflects; external and soon steps carry a note', () => {
    for (const s of journeys.flatMap((j) => j.steps)) {
      if (s.render.kind === 'page' || s.render.kind === 'email' || s.render.kind === 'paper' || s.render.kind === 'html') expect(s.reflects.length).toBeGreaterThan(0)
      else expect(s.render.note.length).toBeGreaterThan(10)
    }
  })
  it('every step says what the person can do there and points at a help guide that exists (v2.3507)', () => {
    for (const s of journeys.flatMap((j) => j.steps)) {
      expect(s.customerCan.length, s.id).toBeGreaterThan(15)
      expect(existsSync(resolve(__dirname, `../content/help/${s.guide}.md`)), `${s.id} → ${s.guide}`).toBe(true)
    }
  })
  it('lands on the estimate email first', () => {
    expect(firstRenderableStep(journeys)).toEqual({ journeyId: 'homeowner', stepId: 'estimate-email' })
    expect(findStep(journeys, 'sub', 'nope')).toBeNull()
  })
  it('captions read in office words — no function names or route paths where the office reads them (v2.3518)', () => {
    for (const s of journeys.flatMap((j) => j.steps)) {
      expect(s.sublabel, s.id).not.toMatch(/\b[a-z]+(-[a-z]+){2,}\b/) // a function folder name like send-job-contract
      expect(s.sublabel, s.id).not.toMatch(/^\/[a-z]/) // a route path
    }
    expect(findStep(journeys, 'firm', 'firm-confirmed-page')?.render).toEqual({ kind: 'html', html: 'legal-confirmed-page' })
  })
})
