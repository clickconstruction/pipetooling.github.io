/**
 * GC mode, the trade partner portal's P5c-4 (to-dos/gc-mode/mockups/portal-p5.md): the two emails a trade gets at its
 * closeout, through the Portal's P3 sender (`gc-trade-email`), in the pay group. We accepted its work (`accepted`, keyed
 * `<sow id>:accepted`): what we hold, that its final pay application asks for it, and when the retainage comes, never the
 * customer's day. Its final pay application came in by email or on paper (`finalIn`, keyed `<draw id>:finalIn`): what
 * it asks, when we pay it, and the final release after. A final the trade sends from its portal needs no email: the
 * portal shows it. While `WAIVER_SIGN_LIVE` holds every waiver a trade signs, each says to email what the portal cannot
 * take yet. Pure, in the company's language: the sends are Building's Closeout window's, through `emailTheTrade` with its
 * tick (GcProjects.tsx, `closeoutWrite`).
 */
import { TRADE_RETAINAGE_WAIT_DAYS } from './building'
import { GC_COMPANY } from './company'
import { WAIVER_SIGN_LIVE, type DrawEmail, type DrawEmailTo } from './drawEmail'
import { pt } from './portalI18n'
import type { Draw, Sow } from './types'
import { money } from './words'

type Words = Parameters<typeof pt>[1]

const words = (to: DrawEmailTo) => (key: Words, vars?: Record<string, string | number>) => pt(to.lang, key, { gc: GC_COMPANY.shortName, ...vars })

/** We accepted the trade's work: what we hold of its retainage and how it asks for it. Null until the work is accepted. */
export function acceptedEmail(to: DrawEmailTo, sow: Sow, held: number): DrawEmail | null {
  if (!sow.id || !sow.acceptedOn) return null
  const t = words(to)
  return {
    companyId: to.companyId,
    kind: 'accepted',
    key: `${sow.id}:accepted`,
    projectId: to.projectId,
    lang: to.lang,
    subject: t('mAcceptedSubject', { trade: to.trade, project: to.project }),
    lines: [
      t('mAcceptedWhat', { trade: to.trade, project: to.project }),
      ...(held > 0
        ? [t('mAcceptedHeld', { amount: money(held) }), t(WAIVER_SIGN_LIVE ? 'mAcceptedAskPortal' : 'mAcceptedAskEmail'), t('mRetainageWhen', { days: TRADE_RETAINAGE_WAIT_DAYS })]
        : []),
    ],
  }
}

/** The trade's final pay application came in: what it asks, when we pay it, and the final release after. Null: not a final. */
export function finalInEmail(to: DrawEmailTo, d: Draw): DrawEmail | null {
  if (!d.final) return null
  const t = words(to)
  return {
    companyId: to.companyId,
    kind: 'finalIn',
    key: `${d.id}:finalIn`,
    projectId: to.projectId,
    lang: to.lang,
    subject: t('mFinalInSubject', { project: to.project }),
    lines: [
      t('mFinalInWhat', { amount: money(d.net), trade: to.trade, project: to.project }),
      t('mRetainageWhen', { days: TRADE_RETAINAGE_WAIT_DAYS }),
      t(WAIVER_SIGN_LIVE ? 'mFinalInReleasePortal' : 'mFinalInReleaseEmail'),
    ],
  }
}
