import type { CSSProperties, MouseEventHandler } from 'react'

/**
 * Shared Dashboard job-row styles/glyphs (v2.1004 job-row-family extraction):
 * used by the Assigned Jobs + Superintendent Jobs sections (and kept in
 * lockstep with DashboardTeamReadyToBillSection's rows). Moved verbatim from
 * `src/pages/Dashboard.tsx` module scope; exports added, no behavior change.
 */
// Shared job-row button/link styles. These were copy-pasted inline across the
// Assigned Jobs + Superintendent Jobs rows; hoisting them keeps the two blocks
// visually in lockstep and shrinks the render body.
export const JOB_ROW_LINK_ICON_COLUMN_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.25rem',
}
export const JOB_ROW_LINK_ICON_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  color: 'var(--text-muted)',
  padding: '0.35rem',
}
export const JOB_ROW_PICTURES_ICON_WRAP_STYLE: CSSProperties = {
  display: 'inline-flex',
  padding: '0.35rem',
}
/**
 * Mobile job-card atoms (v2.2067): the Assigned Jobs rows become bordered
 * cards on phones (same idiom as My Schedule), utility links become uniform
 * 42px bordered icon buttons, and the report count moves out from under the
 * Leave Report button into a labeled chip.
 */
export const jobCardMobileStyle = (reportDue: boolean): CSSProperties => ({
  // Longhands on purpose: mixing the `border` shorthand with a `borderLeft`
  // override in one React style object drops the border entirely.
  borderTop: '1px solid var(--border)',
  borderRight: '1px solid var(--border)',
  borderBottom: '1px solid var(--border)',
  borderLeft: reportDue ? '4px solid #f2c230' : '1px solid var(--border)',
  borderRadius: 12,
  padding: '0.75rem',
  marginBottom: '0.6rem',
  background: 'var(--surface)',
})
export const JOB_ROW_MOBILE_ICON_BUTTON_STYLE: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 10,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-muted)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  cursor: 'pointer',
  flexShrink: 0,
}
export const JOB_ROW_REPORT_CHIP_STYLE: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--text-link)',
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: 999,
  padding: '0.3rem 0.7rem',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
/** Full-width 44px action button for the mobile card's button row. */
export const jobCardMobileActionButtonStyle = (kind: 'primary' | 'due' | 'ghost', busy = false): CSSProperties => ({
  flex: 1,
  minHeight: 44,
  padding: '0.4rem 0.5rem',
  fontSize: '0.9375rem',
  fontWeight: kind === 'ghost' ? 500 : 600,
  borderRadius: 8,
  border: kind === 'ghost' ? '1px solid var(--border-strong)' : 'none',
  background: kind === 'due' ? '#f2c230' : kind === 'primary' ? '#3b82f6' : 'var(--surface)',
  color: kind === 'due' ? '#4a3800' : kind === 'primary' ? '#fff' : 'var(--text-link)',
  cursor: busy ? 'not-allowed' : 'pointer',
  opacity: busy ? 0.6 : 1,
  whiteSpace: 'nowrap',
})
/** Font Awesome Free 6.x — file-lines (OFL/CC-BY); the report-chip glyph. */
export const ReportFileGlyph = ({ size = 11 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width={Math.round(size * 0.82)} height={size} fill="currentColor" aria-hidden focusable={false}>
    <path d="M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zM256 0V128H384L256 0zM112 256H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16z" />
  </svg>
)
export const VIEW_REPORTS_BUTTON_STYLE: CSSProperties = {
  padding: '0.35rem 0.75rem',
  fontSize: '0.875rem',
  background: 'none',
  color: 'var(--text-link)',
  border: '1px solid #2563eb',
  borderRadius: 4,
  cursor: 'pointer',
}
/** "Send to Billing" job-row button — dims + blocks the click while its status update is in flight. */
export const sendToBillingButtonStyle = (busy: boolean): CSSProperties => ({
  padding: '0.35rem 0.75rem',
  fontSize: '0.875rem',
  background: 'var(--surface)',
  color: 'var(--text-link)',
  border: '1px solid #2563eb',
  borderRadius: 4,
  cursor: busy ? 'not-allowed' : 'pointer',
  opacity: busy ? 0.6 : 1,
})
export const DriveLinkGlyph = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
    <path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" />
  </svg>
)
export const JobPlansGlyph = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
    <path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" />
  </svg>
)

/**
 * Phone-call button for job rows (v2.1006): same 2.5em glyph as My Schedule's
 * call button; opens CallCustomerModal (mis-click guard + call-note logging)
 * instead of dialing directly.
 */
export const JobRowCallButton = ({ phone, onClick, boxed = false }: { phone: string; onClick: MouseEventHandler<HTMLButtonElement>; /** Mobile card form (v2.2067): 42px bordered square with a 20px glyph. */ boxed?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Call customer at ${phone}`}
    title={`Call customer at ${phone}`}
    style={
      boxed
        ? { ...JOB_ROW_MOBILE_ICON_BUTTON_STYLE, color: 'var(--text-link)' }
        : { flexShrink: 0, background: 'transparent', border: 'none', padding: '0.2rem', cursor: 'pointer', color: 'var(--text-link)', display: 'inline-flex', alignItems: 'center' }
    }
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={boxed ? 20 : '2.5em'} height={boxed ? 20 : '2.5em'} aria-hidden focusable={false} style={{ display: 'block' }}>
      <path
        fill="currentColor"
        d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C493 589.3 555.5 534 573.1 469.4L574.6 463.9C580 444.2 569.9 423.6 551.1 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 241.3 341 208.8 269.3L253 233.3C266.9 222 271.6 202.9 264.8 186.3L224.2 89z"
      />
    </svg>
  </button>
)

/**
 * Red phone for job rows with no customer phone on file (v2.1024): tapping it
 * asks Dispatch to add one — same affordance as the red customer-photos glyph
 * (DashboardJobPicturesLinkRow's missing state). Renders only once the phones
 * fetch has settled, so cards never flash red while numbers load.
 */
export const JobRowMissingPhoneButton = ({ onClick, boxed = false }: { onClick: MouseEventHandler<HTMLButtonElement>; /** Mobile card form (v2.2067): 42px bordered square with a 20px glyph. */ boxed?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="No phone on file — tap to ask Dispatch to add one"
    title="No phone on file — tap to ask Dispatch to add one"
    style={
      boxed
        ? { ...JOB_ROW_MOBILE_ICON_BUTTON_STYLE, color: 'var(--text-red-600)' }
        : { flexShrink: 0, background: 'transparent', border: 'none', padding: '0.2rem', cursor: 'pointer', color: 'var(--text-red-600)', display: 'inline-flex', alignItems: 'center' }
    }
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={boxed ? 20 : '2.5em'} height={boxed ? 20 : '2.5em'} aria-hidden focusable={false} style={{ display: 'block' }}>
      <path
        fill="currentColor"
        d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C493 589.3 555.5 534 573.1 469.4L574.6 463.9C580 444.2 569.9 423.6 551.1 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 241.3 341 208.8 269.3L253 233.3C266.9 222 271.6 202.9 264.8 186.3L224.2 89z"
      />
    </svg>
  </button>
)
