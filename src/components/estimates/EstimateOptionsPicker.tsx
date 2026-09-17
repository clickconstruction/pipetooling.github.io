/**
 * The customer-facing option picker (v2.2457 plan, layout A "stacked choice cards" —
 * owner-picked). Renders between the estimate header and the document on the acceptance
 * page: one card per option, the recommended one badged and pre-selected, line items one
 * tap away. Selecting swaps the document + total the parent renders below.
 *
 * Add-ons (v2.3555): two groups. **Choose one** — the choices as radio cards, exactly one
 * selected (today's behavior). **Add to it** — the add-ons as checkbox cards, tick any, none
 * pre-ticked, priced with a `+`. An estimate whose options are all add-ons has one group,
 * *Pick what you want done*, priced plainly. The parent owns the selected set; every tap
 * reports the key and the kernel's toggle rule decides what changes.
 *
 * Also the staff rehearsal: the Customer-experience Page preview renders this exact
 * component, so the office sees precisely what the customer will.
 *
 * Customer surfaces are pinned light; the orange accent is the accept flow's existing
 * action color (saturated action colors stay literal per house rules).
 */
import type { CSSProperties } from 'react'
import type { EstimateOption } from '@/lib/estimates/estimateOptions'
import { estimateAddOnOptions, estimateChoiceOptions, estimateOptionTotalCents } from '@/lib/estimates/estimateOptions'

function formatMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100)
}

const cardStyle = (selected: boolean): CSSProperties => ({
  border: selected ? '1.5px solid #ea580c' : '1.5px solid var(--border-strong)',
  boxShadow: selected ? '0 0 0 1.5px #ea580c inset' : 'none',
  background: selected ? '#fff8f3' : 'var(--surface)',
  borderRadius: 12,
  padding: '0.7rem 0.8rem',
  marginBottom: '0.55rem',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  font: 'inherit',
  color: 'inherit',
  display: 'block',
  transition: 'border-color 0.12s, background 0.12s',
})

const groupHeadingStyle: CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: '#9a5b13',
  marginBottom: '0.45rem',
}

const badgeStyle: CSSProperties = {
  fontSize: '0.6rem',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  borderRadius: 999,
  padding: '0.12rem 0.5rem',
  whiteSpace: 'nowrap',
}

export type EstimateOptionsPickerProps = {
  options: EstimateOption[]
  /** The selected keys (the choice plus any ticked add-ons). The parent owns it. */
  selectedKeys: string[]
  /** One tap on a card — the parent applies `toggleEstimateOptionSelection`. */
  onToggle: (key: string) => void
  /** Sent/accepted views: cards render but clicks do nothing. */
  readOnly?: boolean
  /** Heading over the choices; CX-overridable later. */
  heading?: string
}

export default function EstimateOptionsPicker({ options, selectedKeys, onToggle, readOnly, heading }: EstimateOptionsPickerProps) {
  if (options.length < 2) return null
  const choices = estimateChoiceOptions(options)
  const addOns = estimateAddOnOptions(options)
  const hasChoices = choices.length > 0
  const selected = new Set(selectedKeys)

  const card = (o: EstimateOption) => {
    const isAddOn = o.kind === 'add_on'
    const on = selected.has(o.key)
    const total = estimateOptionTotalCents(o)
    const act = () => {
      if (!readOnly) onToggle(o.key)
    }
    return (
      // A div, not a <button>: the expandable "What's included" <details> inside would be
      // invalid interactive-in-interactive HTML. Keyboard: Enter/Space toggle.
      <div
        key={o.key}
        role={isAddOn ? 'checkbox' : 'radio'}
        aria-checked={on}
        aria-label={o.name.trim() || 'Option'}
        tabIndex={readOnly ? -1 : 0}
        onClick={act}
        onKeyDown={(e) => {
          if (readOnly) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            act()
          }
        }}
        style={{ ...cardStyle(on), cursor: readOnly ? 'default' : 'pointer' }}
      >
        <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.35rem 0.6rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
            {isAddOn ? (
              <span
                aria-hidden
                style={{
                  width: 14,
                  height: 14,
                  flex: '0 0 auto',
                  borderRadius: 3,
                  border: on ? '2px solid #ea580c' : '2px solid var(--border-strong)',
                  background: on ? '#ea580c' : 'var(--surface)',
                  boxSizing: 'border-box',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--surface)',
                  fontSize: 10,
                  fontWeight: 900,
                  lineHeight: 1,
                }}
              >
                {on ? '✓' : ''}
              </span>
            ) : (
              <span
                aria-hidden
                style={{
                  width: 14,
                  height: 14,
                  flex: '0 0 auto',
                  borderRadius: '50%',
                  border: on ? '4px solid #ea580c' : '2px solid var(--border-strong)',
                  background: 'var(--surface)',
                  boxSizing: 'border-box',
                }}
              />
            )}
            {o.name.trim() || 'Option'}
            {o.recommended ? <span style={{ ...badgeStyle, color: '#9a5b13', background: '#fdeed9' }}>Recommended</span> : null}
            {isAddOn && hasChoices ? <span style={{ ...badgeStyle, color: 'var(--text-blue-800)', background: 'var(--bg-blue-200)' }}>Add-on</span> : null}
          </span>
          <span style={{ fontWeight: 800, fontSize: '1.02rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {isAddOn && hasChoices ? `+ ${formatMoney(total)}` : formatMoney(total)}
          </span>
        </span>
        {o.description.trim() ? (
          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2, maxWidth: '48ch' }}>{o.description}</span>
        ) : null}
        {o.line_items.length > 0 ? (
          <details style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.4rem' }} onClick={(e) => e.stopPropagation()}>
            <summary style={{ cursor: 'pointer', color: '#b3541e', fontWeight: 600 }}>What&rsquo;s included</summary>
            <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem' }}>
              {o.line_items.map((l, i) => (
                <li key={i}>
                  {(l.line_item.trim() ? `${l.line_item.trim()} — ` : '') + l.description}
                  {' — '}
                  {formatMoney(l.amount_cents)}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    )
  }

  const tickAny = <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none', color: 'var(--text-muted)' }}> · tick any</span>
  // A pure-choice estimate keeps the words it has had since v2.2457.
  const choicesHeading = heading ?? (addOns.length > 0 ? 'Choose one' : 'Choose your option')

  return (
    <div style={{ margin: '1rem 0 0.4rem' }}>
      {hasChoices ? (
        <section role="radiogroup" aria-label={choicesHeading} data-testid="estimate-options-choices">
          <div style={groupHeadingStyle}>{choicesHeading}</div>
          {choices.map(card)}
        </section>
      ) : null}
      {addOns.length > 0 ? (
        <section role="group" aria-label={hasChoices ? 'Add to it' : 'Pick what you want done'} data-testid="estimate-options-add-ons" style={{ marginTop: hasChoices ? '0.6rem' : 0 }}>
          <div style={groupHeadingStyle}>
            {hasChoices ? 'Add to it' : heading ?? 'Pick what you want done'}
            {tickAny}
          </div>
          {addOns.map(card)}
        </section>
      ) : null}
    </div>
  )
}
