import { containsUrl, splitLinkSegments } from '../../lib/linkifySegments'

/**
 * Free text with pasted URLs rendered as SHORT clickable hostname links
 * (v2.961) — long query strings can no longer overflow mobile cards. Anchors
 * stop propagation so links inside draggable/long-pressable cards never
 * trigger card behavior.
 */
export default function LinkifiedText({ text }: { text: string }) {
  if (!containsUrl(text)) return <>{text}</>
  return (
    <>
      {splitLinkSegments(text).map((segment, i) =>
        segment.kind === 'text' ? (
          <span key={i}>{segment.text}</span>
        ) : (
          <a
            key={i}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ color: 'var(--text-link)', fontWeight: 600, overflowWrap: 'anywhere' }}
          >
            🔗 {segment.label}
          </a>
        ),
      )}
    </>
  )
}
