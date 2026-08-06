/**
 * Font Awesome Free v7.3.1 — https://fontawesome.com License — https://fontawesome.com/license/free
 * Copyright 2026 Fonticons, Inc.
 * Icon: bars / hamburger menu (solid), native 448×512 viewBox. Marks the
 * Pipeline "Section tools" dropdown that sits just left of the Waiting →
 * Working → … stage jump strip (Jobs → Pipeline).
 */
import type { CSSProperties } from 'react'

type Props = {
  size?: number
  style?: CSSProperties
}

export default function StagesSectionToolsIcon({ size = 12, style }: Props) {
  const fixedSize = !(style && ('width' in style || 'height' in style))
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 448 512"
      {...(fixedSize ? { width: size, height: size } : {})}
      aria-hidden
      focusable="false"
      style={{ display: 'block', ...style }}
    >
      <path
        fill="currentColor"
        d="M0 96C0 78.3 14.3 64 32 64l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 128C14.3 128 0 113.7 0 96zM0 256c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 288c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32L32 448c-17.7 0-32-14.3-32-32s14.3-32 32-32l384 0c17.7 0 32 14.3 32 32z"
      />
    </svg>
  )
}
