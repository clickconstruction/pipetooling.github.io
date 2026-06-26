import type { CSSProperties } from 'react'
import { renderContractBodyToSafeHtml } from '../../lib/renderContractBodyToSafeHtml'

type ContractBodyDisplayProps = {
  format: string | null | undefined
  bodyHtml: string | null | undefined
  /** Extra style for scroll container (modal views). */
  scrollStyles?: CSSProperties
}

export function ContractBodyDisplay({ format, bodyHtml, scrollStyles }: ContractBodyDisplayProps) {
  const safe = renderContractBodyToSafeHtml(bodyHtml, format)
  if (!safe.trim()) return null

  return (
    <div
      style={{ fontSize: '0.875rem', lineHeight: 1.5, ...scrollStyles }}
      // eslint-disable-next-line react/no-danger -- output of renderContractBodyToSafeHtml (escaped plain text / allowlist-sanitized html)
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}
