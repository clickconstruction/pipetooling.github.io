import type { ReactNode } from 'react'
import type { PhoneDockIcon } from '../../lib/phoneDock'

/**
 * The phone dock's icon set (punch list #30): one stroke glyph per registry shape, so a page
 * swapped into a slot from the More sheet arrives with an icon the bar already knows.
 */
const SHAPES: Record<PhoneDockIcon | 'more', ReactNode> = {
  jobs: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 3v2h6V3M8 10h8M8 14h8M8 18h5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor" stroke="none" />,
  inbox: (
    <>
      <path d="M3 13h5l2 3h4l2-3h5" />
      <path d="M5 13l2.5-8h9L19 13v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
    </>
  ),
  gauge: (
    <>
      <path d="M4 18a9 9 0 1 1 16 0" />
      <path d="M12 15 16 9" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  store: (
    <>
      <path d="M4 9 5.5 4h13L20 9" />
      <path d="M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
      <path d="M5 11v10h14V11M10 21v-6h4v6" />
    </>
  ),
  dollar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v12M15 9.5c0-1.5-1.3-2.5-3-2.5s-3 1-3 2.5 1.3 2.2 3 2.5 3 1 3 2.5-1.3 2.5-3 2.5-3-1-3-2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  doc: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 13h6M10 17h6" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="5" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  map: (
    <>
      <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5a3.5 3.5 0 0 1 0 7M18 13.5a6 6 0 0 1 3.5 6.5" />
    </>
  ),
  bank: (
    <>
      <path d="m3 9 9-5 9 5H3zM5 9v8M10 9v8M14 9v8M19 9v8M3 21h18" />
    </>
  ),
  flag: <path d="M6 21V4h11l-2 4 2 4H6" />,
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" stroke="none" />
    </>
  ),
}

export function PhoneDockGlyph({ icon, size = 22 }: { icon: PhoneDockIcon | 'more'; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {SHAPES[icon]}
    </svg>
  )
}
