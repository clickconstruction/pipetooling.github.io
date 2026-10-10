/**
 * GC mode, the real build, the Building lane's U6b: the emails the Draws window sends a trade through the Portal lane's
 * P3 sender (`gc-trade-email`): a draw we paid (kind `paid`), one we approved for less (`less`), and a change to its
 * statement of work to sign (`change`). The words are the Portal's own: the prototype's `portalMessages` (spike
 * `gcPortal.ts`) word for word, without the greeting the sender adds. Each is keyed once per record
 * (`<draw id>:paid`, `<draw id>:less`, `<change order id>:change`), so a repeat sends nothing. Agreed with the Portal
 * lane (Helper 13, 2026-10-09): this file is these kinds' home. A back-charge's emails are the Portal's
 * (`backChargeEmail`, P4b-iii), sent from here as Building charges, settles and takes one. Pure: the sends are the
 * page's, through `sendGcTradeEmail`.
 */
import { pt, type PortalLang } from './portalI18n'
import { backChargeEmail, backChargeEmailKey, type BackChargeEmailStage, type TradeEmailRequest } from './tradeEmail'
import type { BackCharge, ChangeOrder, Draw, GcProject } from './types'
import { money } from './words'

/**
 * The trade reports its work and signs a change in its portal (the Portal's P5c-3b). Before then a change's email waited,
 * since it asks the trade to open its portal and sign. P5c-3b set this to true in the PR that ships those screens, as
 * `SOW_SIGN_SCREEN_LIVE` did for P2c.
 */
export const DRAW_PORTAL_LIVE = true

/**
 * The trade signs its unconditional waiver in its portal, on the app's own waiver paper (P5c-3b). Held until the owner
 * says a trade may sign its lien waiver electronically (portal-p5.md, the owner's call 2): until then the portal draws
 * no waiver press, `submit-gc-trade-portal` refuses the kind (its copy in `_shared/gcTradeSubmit.ts`), and a paid
 * draw's email leaves out the line that asks for the waiver there. A one-line follow-up turns it on.
 */
export const WAIVER_SIGN_LIVE = false

/**
 * The trade reads a pay application we sent back in its portal, our note and the lines we doubt (the Portal's P5c-3c-i,
 * the pay application's door). Before then the Draws window's send-back form told the office to call or email them with
 * it too. The fixed one comes back by email until `WAIVER_SIGN_LIVE`, since a pay application signs a waiver.
 */
export const PAY_APP_PORTAL_LIVE = true

export type DrawEmail = Omit<TradeEmailRequest, 'group'>

/** Who an email goes to, and what it is about. */
export interface DrawEmailTo {
  companyId: string
  projectId: string
  project: string
  trade: string
  lang: PortalLang
}

type Words = Parameters<typeof pt>[1]

/** Who an email about a trade's money goes to: the company we awarded it, on its job. Null: none. The language comes with the send. */
export function drawEmailFor(project: GcProject, packageId: string): Omit<DrawEmailTo, 'lang'> | null {
  const pkg = project.packages.find((k) => k.id === packageId)
  const companyId = pkg?.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId
  if (!pkg || !companyId) return null
  return { companyId, projectId: project.id, project: project.name, trade: pkg.trade }
}

/** A draw we paid: what we paid, what we hold of it, and the waiver it asks for once the portal takes it. Null until paid. */
export function paidEmail(to: DrawEmailTo, d: Draw): DrawEmail | null {
  if (d.status !== 'paid') return null
  const t = (key: Words, vars?: Record<string, string | number>) => pt(to.lang, key, vars)
  const amount = money(d.net)
  return {
    companyId: to.companyId,
    kind: 'paid',
    key: `${d.id}:paid`,
    projectId: to.projectId,
    lang: to.lang,
    subject: d.final ? t('mPaidFinalSubject', { project: to.project }) : t('mPaidSubject', { n: d.number, project: to.project }),
    lines: [
      d.final ? t('mPaidFinalWhat', { amount, trade: to.trade, project: to.project }) : t('mPaidWhat', { amount, n: d.number, trade: to.trade, project: to.project }),
      ...(!d.final && d.retainage > 0 ? [t('mPaidHeld', { amount: money(d.retainage) })] : []),
      ...(WAIVER_SIGN_LIVE && d.waiver === 'conditional' ? [t(d.final ? 'mPaidFinalWaiver' : 'mPaidWaiver')] : []),
    ],
  }
}

/** A draw we approved for less than asked: what we approved, what they asked, and why. Null unless it was. */
export function lessEmail(to: DrawEmailTo, d: Draw): DrawEmail | null {
  if (!d.asked) return null
  const t = (key: Words, vars?: Record<string, string | number>) => pt(to.lang, key, vars)
  return {
    companyId: to.companyId,
    kind: 'less',
    key: `${d.id}:less`,
    projectId: to.projectId,
    lang: to.lang,
    subject: t('mLessSubject', { n: d.number, project: to.project }),
    lines: [
      t('mLessApproved', { approved: money(d.net), asked: money(d.asked.net), n: d.number, trade: to.trade, project: to.project }),
      ...(d.asked.note ? [d.asked.note] : []),
      t('mLessRest'),
    ],
  }
}

/** A change to the trade's statement of work, sent for it to sign in its portal. Null until it was sent. */
export function changeEmail(to: DrawEmailTo, co: ChangeOrder): DrawEmail | null {
  if (!DRAW_PORTAL_LIVE || !co.tradeChange) return null
  const t = (key: Words, vars?: Record<string, string | number>) => pt(to.lang, key, vars)
  const amount = money(Math.abs(co.cost))
  return {
    companyId: to.companyId,
    kind: 'change',
    key: `${co.id}:change`,
    projectId: to.projectId,
    lang: to.lang,
    subject: t('mChangeSubject', { n: co.number, project: to.project }),
    lines: [
      t('mChangeWhat', { trade: to.trade, project: to.project, description: co.description.replace(/\.$/, '') }),
      t(co.cost >= 0 ? 'mChangeAdds' : 'mChangeTakes', { amount }),
      t('mChangeOpen'),
    ],
  }
}

/** A back-charge's email (kind `backCharge`): sent, kept or dropped, or taken off a draw, once a stage by `<charge id>:<stage>`. Null: not at that stage. */
export function chargeEmail(to: DrawEmailTo, charge: BackCharge, stage: BackChargeEmailStage, drawNumber: number | null = null): DrawEmail | null {
  const mail = backChargeEmail(stage, { project: to.project, trade: to.trade, charge, drawNumber }, to.lang)
  if (!mail) return null
  return { companyId: to.companyId, kind: 'backCharge', key: backChargeEmailKey(charge.id, stage), projectId: to.projectId, lang: to.lang, subject: mail.subject, lines: mail.lines }
}
