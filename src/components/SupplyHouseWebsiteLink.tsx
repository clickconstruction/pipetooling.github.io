import type { CSSProperties } from 'react'
import { openInExternalBrowser } from '../lib/openInExternalBrowser'
import { supplyHouseWebsitePortalHref } from '../lib/supplyHouseWebsite'

/** Renders nothing when URL is empty; otherwise a compact "Open website" control for supply house portal links. */
export function SupplyHouseWebsiteLink({
  websiteUrl,
  style,
}: {
  websiteUrl: string | null | undefined
  style?: CSSProperties
}) {
  const href = supplyHouseWebsitePortalHref(websiteUrl)
  if (!href) return null
  return (
    <button
      type="button"
      onClick={() => openInExternalBrowser(href)}
      style={{
        padding: '0.15rem 0.5rem',
        fontSize: '0.75rem',
        fontWeight: 500,
        color: 'var(--text-link)',
        background: 'var(--bg-blue-tint)',
        border: '1px solid var(--border-blue)',
        borderRadius: 4,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      Open website
    </button>
  )
}
