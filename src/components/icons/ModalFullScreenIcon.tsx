/**
 * The full-screen toggle's glyph (v2.4045): two diagonal arrows — out to the
 * corners in a window, in from the corners while full screen. Stroke follows
 * `currentColor` so the button's text color themes it.
 */
export function ModalFullScreenIcon({ fullScreen, size = 16 }: { fullScreen: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {fullScreen ? (
        <>
          <path d="M13.5 6.5h-4v-4" />
          <path d="M9.5 6.5 14 2" />
          <path d="M2.5 9.5h4v4" />
          <path d="M6.5 9.5 2 14" />
        </>
      ) : (
        <>
          <path d="M9.5 2.5h4v4" />
          <path d="M13.5 2.5 9 7" />
          <path d="M6.5 13.5h-4v-4" />
          <path d="M2.5 13.5 7 9" />
        </>
      )}
    </svg>
  )
}
