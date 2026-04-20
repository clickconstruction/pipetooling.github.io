/**
 * Font Awesome Free v7.2.0 — https://fontawesome.com License — https://fontawesome.com/license/free
 * Copyright 2026 Fonticons, Inc.
 * Icon: book (solid). Path scaled from official 448×512 viewBox into 640×640 canvas.
 */
import type { CSSProperties } from 'react'

type Props = {
  size?: number
  style?: CSSProperties
}

export default function JobBookIcon({ size = 20, style }: Props) {
  const fixedSize = !(style && ('width' in style || 'height' in style))
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 640"
      {...(fixedSize ? { width: size, height: size } : {})}
      aria-hidden
      focusable="false"
      style={{ display: 'block', ...style }}
    >
      <g transform="translate(40 0) scale(1.25)">
        <path
          fill="currentColor"
          d="M384 512L96 512c-53 0-96-43-96-96L0 96C0 43 43 0 96 0L400 0c26.5 0 48 21.5 48 48l0 288c0 20.9-13.4 38.7-32 45.3l0 66.7c17.7 0 32 14.3 32 32s-14.3 32-32 32l-32 0zM96 384c-17.7 0-32 14.3-32 32s14.3 32 32 32l256 0 0-64-256 0zm32-232c0 13.3 10.7 24 24 24l176 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-176 0c-13.3 0-24 10.7-24 24zm24 72c-13.3 0-24 10.7-24 24s10.7 24 24 24l176 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-176 0z"
        />
      </g>
    </svg>
  )
}
