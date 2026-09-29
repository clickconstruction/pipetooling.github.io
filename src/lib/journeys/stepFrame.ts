/**
 * The iframe a journey step renders in (v2.4098, out of SettingsWhatCustomersSeeTab so the
 * Contracts & terms reader shows the same frame): a same-origin page URL with the sample token,
 * the built sample email as srcDoc, or the paper's preview as srcDoc.
 */
import type { JourneyStep } from '../customerJourneys'
import type { PaperSample } from './paperSamples'

export type SampleEmails = Record<string, { subject: string; html: string; text: string; /** The From line the inbox shows (v2.4138). */ from?: string }>

export type StepFrame = { key: string; attrs: { src?: string; srcDoc?: string; sandbox?: string; title: string } }

export function stepFrameProps(step: JourneyStep, emails: SampleEmails | null, papers: Partial<Record<string, PaperSample>>, origin: string, reloadNonce: number): StepFrame | null {
  if (step.render.kind === 'paper') {
    const p = papers[step.render.paper]
    if (!p) return null
    return { key: `${step.id}-${reloadNonce}`, attrs: { srcDoc: p.html, sandbox: '', title: step.label } }
  }
  if (step.render.kind === 'page') {
    const base = step.render.absolute ? step.render.path : `${origin}${step.render.path}`
    return { key: `${step.id}-${reloadNonce}`, attrs: { src: `${base}${base.includes('?') ? '&' : '?'}v=${reloadNonce}`, title: step.label } }
  }
  if (step.render.kind === 'email') {
    const m = emails?.[step.render.email]
    if (!m) return null
    return { key: `${step.id}-${reloadNonce}`, attrs: { srcDoc: m.html, sandbox: '', title: step.label } }
  }
  return null
}

/** The page a step opens in a new tab, when it is a page. */
export function stepOpenUrl(step: JourneyStep, origin: string): string | null {
  if (step.render.kind !== 'page') return null
  return step.render.absolute ? step.render.path : `${origin}${step.render.path}`
}
