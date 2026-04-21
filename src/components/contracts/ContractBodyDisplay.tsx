import type { CSSProperties } from 'react'
import { sanitizeContractSigningHtml } from '../../lib/sanitizeContractSigningHtml'
import { markdownSourceToSafeHtml, parseContractBodyFormat } from '../../lib/contractBodyFormat'

type ContractBodyDisplayProps = {
  format: string | null | undefined
  bodyHtml: string | null | undefined
  /** Extra style for scroll container (modal views). */
  scrollStyles?: CSSProperties
}

export function ContractBodyDisplay({ format, bodyHtml, scrollStyles }: ContractBodyDisplayProps) {
  const f = parseContractBodyFormat(format)
  const raw = bodyHtml?.trim() ?? ''
  if (!raw) return null

  if (f === 'plain') {
    return (
      <div style={{ fontSize: '0.875rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...scrollStyles }}>
        {raw}
      </div>
    )
  }

  if (f === 'markdown') {
    const safe = markdownSourceToSafeHtml(raw)
    if (!safe.trim()) return null
    return (
      <div
        style={{ fontSize: '0.875rem', lineHeight: 1.5, ...scrollStyles }}
        // eslint-disable-next-line react/no-danger -- sanitized after marked + sanitizeContractSigningHtml
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    )
  }

  const safe = sanitizeContractSigningHtml(raw)
  if (!safe.trim()) return null

  return (
    <div
      style={{ fontSize: '0.875rem', lineHeight: 1.5, ...scrollStyles }}
      // eslint-disable-next-line react/no-danger -- sanitized in sanitizeContractSigningHtml (DOMParser allowlist)
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}
