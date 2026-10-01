import type { LienWaiverFoot } from '../../lib/jobsDocuments/lienWaiverRelease'

/**
 * The foot of an unsigned waiver as the on-screen previews draw it (v2.4285): the rule the
 * signature will sit on, then the signer and company, his title when set, and the blank the
 * day signed fills. The print page, the PDF and the email render the same block from
 * `buildLienWaiverFootHtml` / the PDF foot; this is the React twin for the window, the sign
 * modal and the leader's Waivers to sign seat.
 */
export function LienWaiverFootPreview({ foot }: { foot: LienWaiverFoot }) {
  return (
    <div data-testid="lien-waiver-foot" style={{ marginTop: '2.4em', maxWidth: 420 }}>
      <div style={{ height: '2.2em' }} />
      <div style={{ borderTop: '1px solid var(--text-base)', paddingTop: '0.4em', lineHeight: 1.45 }}>
        <strong>{foot.name}</strong>, {foot.company}
      </div>
      {foot.title ? <div style={{ fontSize: '0.9em', lineHeight: 1.5, color: 'var(--text-muted)' }}>{foot.title}</div> : null}
      <div style={{ fontSize: '0.9em', lineHeight: 1.5, color: 'var(--text-muted)' }}>{foot.signed ?? 'Signed ______________________'}</div>
    </div>
  )
}
