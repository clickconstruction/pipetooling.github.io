/**
 * The eye that means *on the portal*: Edit Job → Stages draws one per stage row (open = the GC
 * sees it, crossed = not), and since v2.5770 the Pipeline row's owner-sees glyph draws the same
 * eye (open = the owner sees the bills, hollow = some, crossed = none). One drawing, one meaning.
 */
import type { CSSProperties } from 'react'

export type EyeIconVariant = 'open' | 'hollow' | 'crossed'

export default function EyeIcon({ variant, size = 15, style }: { variant: EyeIconVariant; size?: number; style?: CSSProperties }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={style}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" fill={variant === 'open' ? 'currentColor' : 'none'} />
      {variant === 'crossed' ? <path d="M4 4l16 16" /> : null}
    </svg>
  )
}
