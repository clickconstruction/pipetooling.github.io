import { SAMPLE_BANNER_TEXT } from '../lib/customerSampleMode'

/**
 * The strip at the top of a public page opened with the sample token (What customers see,
 * v2.2758). The strip pins itself light like the surfaces it sits on. `text` lets a page that is
 * not the customer's say whose view it is (the law firm's portal, punch list #85 item 3).
 */
export function SampleModeBanner({ text = SAMPLE_BANNER_TEXT }: { text?: string } = {}) {
  return (
    <div
      role="status"
      data-theme="light"
      style={{
        margin: '0 0 0.9rem',
        padding: '0.45rem 0.75rem',
        borderRadius: 6,
        background: 'var(--bg-amber-50)',
        border: '1px solid var(--border-amber)',
        color: 'var(--text-amber-800)',
        fontSize: '0.8rem',
        fontWeight: 600,
      }}
    >
      {text}
    </div>
  )
}
