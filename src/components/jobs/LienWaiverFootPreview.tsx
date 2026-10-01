import type { LienWaiverFoot } from '../../lib/jobsDocuments/lienWaiverRelease'

/**
 * The foot of an unsigned waiver as the on-screen previews draw it (v2.4285): the rule the
 * signature will sit on, then the signer and company, his title when set, and the blank the
 * day signed fills. The print page, the PDF and the email render the same block from
 * `buildLienWaiverFootHtml` / the PDF foot; this is the React twin for the window, the sign
 * modal and the leader's Waivers to sign seat.
 *
 * v2.4314: `highlight` marks the block for the Release of Lien window's step that fills it — a
 * dashed outline and a tag such as "5 · He signs here". It never prints.
 *
 * v2.4335: `inkUrl` is the drawn signature of a signed waiver, sitting on the line above the name.
 */
export function LienWaiverFootPreview({ foot, highlight = null, inkUrl = null }: { foot: LienWaiverFoot; highlight?: string | null; inkUrl?: string | null }) {
  const lines = (
    <>
      {inkUrl ? (
        <img data-testid="lien-waiver-foot-ink" src={inkUrl} alt={`Signature of ${foot.name}`} style={{ display: 'block', height: '3.6em', width: 'auto', maxWidth: '100%', objectFit: 'contain', objectPosition: 'left bottom' }} />
      ) : (
        <div style={{ height: '2.2em' }} />
      )}
      <div style={{ borderTop: '1px solid var(--text-base)', paddingTop: '0.4em', lineHeight: 1.45 }}>
        <strong>{foot.name}</strong>, {foot.company}
      </div>
      {foot.title ? <div style={{ fontSize: '0.9em', lineHeight: 1.5, color: 'var(--text-muted)' }}>{foot.title}</div> : null}
      <div style={{ fontSize: '0.9em', lineHeight: 1.5, color: 'var(--text-muted)' }}>{foot.signed ?? 'Signed ______________________'}</div>
    </>
  )
  if (!highlight) {
    return (
      <div data-testid="lien-waiver-foot" style={{ marginTop: '2.4em', maxWidth: 420 }}>
        {lines}
      </div>
    )
  }
  return (
    <div data-testid="lien-waiver-foot" data-highlight="true" style={{ marginTop: '2.4em', maxWidth: 440, position: 'relative', border: '2px dashed #2563eb', borderRadius: 8, padding: '0.6em 0.75em 0.5em', background: 'var(--bg-blue-tint)' }}>
      <span
        style={{
          position: 'absolute',
          top: '-0.85em',
          left: '0.6em',
          background: '#2563eb',
          color: '#ffffff',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: '0.72rem',
          fontWeight: 700,
          borderRadius: 999,
          padding: '0.1em 0.65em',
          whiteSpace: 'nowrap',
        }}
      >
        {highlight}
      </span>
      {lines}
    </div>
  )
}
