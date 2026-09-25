import { CARD, FAINT, HAIR, INK, MUTED, PAPER_RED } from '../../lib/portal/portalTheme'
import { formatPortalDate, formatPortalUsd, type PortalPropertyNotice } from '../../lib/portal/portalPayload'
import { portalNoticeMonthsWords } from '../../../supabase/functions/_shared/portalPropertyNotices'

/**
 * The notice on your property (v2.3825, punch list #45 PR 2): one card per recorded § 53.056
 * notice on a job this viewer owns — shown on its own once the notice is recorded as sent (the
 * owner's decision, 2026-09-25). Its words follow counsel's owner letter of 2026-09-22: you did
 * not hire us and this is not a lawsuit; one number; what § 53.081 lets the owner hold back;
 * three clean ways to finish it, none a joint check; call us. Counsel has the card's wording to
 * look at (`to-dos/owner-decisions-pending.md`). Customer-facing ⇒ the statement's own light palette.
 */
export function PortalPropertyNoticeCard({ notice, phone, companyName }: { notice: PortalPropertyNotice; phone: string; companyName: string }) {
  const gc = notice.gcName || 'your builder'
  const us = notice.claimantName || companyName
  const amount = formatPortalUsd(notice.claim)
  const months = portalNoticeMonthsWords(notice.months)
  const mailed = formatPortalDate(notice.mailedOn) ?? notice.mailedOn
  const tel = phone.replace(/[^\d+]/g, '')
  return (
    <div data-portal-property-notice style={{ margin: '1.2rem 0', background: CARD, border: `1px solid ${HAIR}`, borderLeft: `3px solid ${PAPER_RED}`, padding: '1rem 1.2rem', fontSize: 14, color: INK, lineHeight: 1.5 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: PAPER_RED, marginBottom: 6 }}>Notice on your property · mailed {mailed}</div>
      <p style={{ margin: '0 0 8px' }}>
        {notice.address ? <b>{notice.address}. </b> : null}
        We did work on your property under {gc}. {gc} has not paid us <b>{amount}</b>
        {months ? ` for work in ${months}` : ''}. On {mailed} we mailed you the notice of claim Texas law requires (Tex. Prop. Code § 53.056). You did not hire us, and this is not a lawsuit.
      </p>
      <p style={{ margin: '0 0 6px', color: MUTED }}>You may hold back {amount} from anything you still owe {gc}. The clean ways to finish it, before your next payment to {gc}:</p>
      <ol style={{ margin: '0 0 8px', paddingLeft: 20 }}>
        <li>{gc} pays us {amount}, payable only to {us}. We send you a release the day it clears.</li>
        <li>You hold back {amount} from your next payment to {gc} and call us, so we know it is held.</li>
        <li>If {gc} tells you in writing that you may pay us directly, pay us. We cannot take a joint check.</li>
      </ol>
      {phone ? (
        <a
          href={tel ? `tel:${tel}` : undefined}
          data-portal-property-notice-call
          style={{ display: 'inline-block', padding: '6px 12px', background: INK, color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
        >
          Call {notice.contactPerson || 'us'} · {phone}
        </a>
      ) : null}
      <div style={{ fontSize: 11.5, color: FAINT, marginTop: 8 }}>
        {notice.jobNumbers.length ? `Job${notice.jobNumbers.length === 1 ? '' : 's'} ${notice.jobNumbers.join(', ')} · ` : ''}
        Nothing here is billed to you, and it is not in your balance.
      </div>
    </div>
  )
}
