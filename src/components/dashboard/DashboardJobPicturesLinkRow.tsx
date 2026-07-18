import { openInExternalBrowser } from '../../lib/openInExternalBrowser'

/**
 * Customer-pictures link glyph (or red "ask Dispatch" fallback button), shared
 * by the Dashboard job-row family (Team Ready to Bill / Assigned Jobs /
 * Superintendent Jobs) and the My Schedule section. Moved verbatim from
 * `src/pages/Dashboard.tsx` (extraction-series refactor; no behavior change).
 */
export function DashboardJobPicturesLinkRow({
  jobPicturesLink,
  layout = 'stacked',
  onMissingClick,
  size = 'default',
}: {
  jobPicturesLink: string | null | undefined
  layout?: 'stacked' | 'inline'
  onMissingClick?: () => void
  /** `large` matches the My Schedule Leave Report button height. */
  size?: 'default' | 'large'
}) {
  const url = jobPicturesLink?.trim()
  const glyphSize = size === 'large' ? '2.5em' : '1.25em'
  const glyph = (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={glyphSize} height={glyphSize} fill="currentColor" aria-hidden="true">
      <path d="M128 160C128 124.7 156.7 96 192 96L512 96C547.3 96 576 124.7 576 160L576 416C576 451.3 547.3 480 512 480L192 480C156.7 480 128 451.3 128 416L128 160zM56 192C69.3 192 80 202.7 80 216L80 512C80 520.8 87.2 528 96 528L456 528C469.3 528 480 538.7 480 552C480 565.3 469.3 576 456 576L96 576C60.7 576 32 547.3 32 512L32 216C32 202.7 42.7 192 56 192zM224 224C241.7 224 256 209.7 256 192C256 174.3 241.7 160 224 160C206.3 160 192 174.3 192 192C192 209.7 206.3 224 224 224zM420.5 235.5C416.1 228.4 408.4 224 400 224C391.6 224 383.9 228.4 379.5 235.5L323.2 327.6L298.7 297C294.1 291.3 287.3 288 280 288C272.7 288 265.8 291.3 261.3 297L197.3 377C191.5 384.2 190.4 394.1 194.4 402.4C198.4 410.7 206.8 416 216 416L488 416C496.7 416 504.7 411.3 508.9 403.7C513.1 396.1 513 386.9 508.4 379.4L420.4 235.4z" />
    </svg>
  )
  if (url) {
    const link = (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open customer pictures"
        aria-label="Open customer pictures"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          openInExternalBrowser(url)
        }}
        style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-blue-500)', textDecoration: 'none' }}
      >
        {/* Font Awesome Free 7.x — images (OFL) */}
        {glyph}
      </a>
    )
    if (layout === 'inline') return link
    return <div style={{ marginTop: 6 }}>{link}</div>
  }
  if (onMissingClick) {
    const missingBtn = (
      <button
        type="button"
        title="No customer photos link — tap to ask Dispatch to set one"
        aria-label="No customer photos link — tap to ask Dispatch to set one"
        onClick={(e) => {
          e.stopPropagation()
          onMissingClick()
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--text-red-600)',
        }}
      >
        {glyph}
      </button>
    )
    if (layout === 'inline') return missingBtn
    return <div style={{ marginTop: 6 }}>{missingBtn}</div>
  }
  return null
}
