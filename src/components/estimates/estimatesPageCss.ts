/**
 * The Estimates pages' shared stylesheet strings: the page shell and the focus ring, used by the list
 * and the detail page alike. Moved from `src/pages/Estimates.tsx` with the list (v2.7629).
 */
export const ESTIMATES_PAGE_CLASS = 'estimates-page-modern'

/** Width clamp + responsive padding; modifiers cap content width on large screens. */
export const estimatesPageShellCss = `
  .${ESTIMATES_PAGE_CLASS} {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding: 1rem;
    margin-left: auto;
    margin-right: auto;
  }
  .${ESTIMATES_PAGE_CLASS}.estimates-page-shell--list {
    max-width: min(1100px, 100%);
  }
  .${ESTIMATES_PAGE_CLASS}.estimates-page-shell--detail {
    max-width: min(900px, 100%);
  }
  @media (max-width: 640px) {
    .${ESTIMATES_PAGE_CLASS} {
      padding: 0.75rem 0.5rem;
    }
  }
`

export const estimatesFocusVisibleCss = `
  .${ESTIMATES_PAGE_CLASS} input:not([type="radio"]):not([type="checkbox"]):focus-visible,
  .${ESTIMATES_PAGE_CLASS} textarea:focus-visible,
  .${ESTIMATES_PAGE_CLASS} button:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`
