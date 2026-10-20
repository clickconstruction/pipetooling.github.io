/**
 * GC mode, the statement of work's email (the Board's B6-a-ii): what Send to their portal to sign emails the company
 * awarded, through the Portal lane's P3 sender (`gc-trade-email`, kind `sow`, key `<sow id>:sow`, so a repeat sends
 * nothing). The words are the Portal's own: the prototype's `portalMessages` sow message (spike `gcPortal.ts`) without
 * the greeting the sender adds, and without the company window's paper-send lines, which come with B6-b. Agreed with
 * the Portal lane on 2026-10-08: this file is the sow kind's home. Pure: the write is `sendGcSow`'s (gcIo.ts).
 */
import { partnerById, planLabel } from './lookups'
import { pt, type PortalLang } from './portalI18n'
import type { TradeEmailRequest } from './tradeEmail'
import type { GcState } from './types'
import { money } from './words'

/**
 * The trade signs a statement of work in its portal since the Portal's P2c-ii (its sign screen, on P2c-i's
 * `gc_trade_sign_sow`). Before it, Send to their portal to sign marked it sent and emailed nothing, since the email
 * tells the trade to open its portal and sign. Now a dev may tick Email it now beside the send; the box starts off.
 */
export const SOW_SIGN_SCREEN_LIVE = true

export type SowEmail = Omit<TradeEmailRequest, 'group'>

/** The email for a trade's statement of work, to the company awarded. Null when there is none, or the company is gone. */
export function sowEmailRequest(state: GcState, projectId: string, packageId: string, sowId: string, lang: PortalLang): SowEmail | null {
  const project = state.projects.find((p) => p.id === projectId)
  const pkg = project?.packages.find((k) => k.id === packageId)
  const sow = pkg?.sow
  const invite = pkg?.invites.find((i) => i.id === pkg.awardedInviteId)
  const partner = invite ? partnerById(state, invite.partnerId) : undefined
  if (!project || !pkg || !sow || !partner) return null
  const t = (key: Parameters<typeof pt>[1], vars?: Record<string, string | number>) => pt(lang, key, vars)
  const name = project.name
  return {
    companyId: partner.id,
    kind: 'sow',
    key: `${sowId}:sow`,
    projectId,
    lang,
    subject: t('mSowSubject', { trade: pkg.trade, project: name }),
    lines: [
      t('mSowPicked', { trade: pkg.trade, project: name }),
      t('mSowReady', { price: money(sow.price), plans: planLabel(project, sow.basedOnRev) }),
      t('mSowHold', { pct: sow.retainagePct }),
      t('mSowOpen'),
    ],
  }
}
