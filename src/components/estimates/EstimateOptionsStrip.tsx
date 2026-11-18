import type { Dispatch, SetStateAction } from 'react'
import type { EstimateLineItemNormalized } from '../../lib/estimateLineItemNormalize'
import { formatEstimateMoney as formatMoney } from '../../lib/estimates/estimateListRows'
import {
  MAX_ESTIMATE_OPTIONS,
  defaultEstimateSelection,
  estimateOptionTotalCents,
  setEstimateAddOnPreticked,
  setRecommendedEstimateOption,
  type EstimateOption,
  type EstimateOptionKind,
} from '../../lib/estimates/estimateOptions'
import { estInputBase } from './estimatesPageStyles'

export interface EstimateOptionsStripProps {
  /** The row's options as held; empty is a plain single-price estimate. */
  estimateOptions: EstimateOption[]
  /** The same options with the viewed one's lines kept live. */
  syncedEstimateOptions: EstimateOption[]
  viewedOptionKey: string | null
  viewedOption: EstimateOption | null
  /** The viewed option's lines as typed, and their total. */
  lines: EstimateLineItemNormalized[]
  totalCents: number
  /** The option moves (`lib/estimates/estimateOptionsEditor`), applied by the page. */
  switchViewedOption: (key: string) => void
  addEstimateOption: () => void
  patchViewedOption: (patch: Partial<Pick<EstimateOption, 'name' | 'description'>>) => void
  setViewedOptionKind: (kind: EstimateOptionKind) => void
  removeViewedOption: () => void
  setEstimateOptions: Dispatch<SetStateAction<EstimateOption[]>>
  setPreviewSelectedOptionKeys: Dispatch<SetStateAction<string[]>>
}

/**
 * Estimate options on a draft: a card per option with its price, ＋ Option, and under them the
 * viewed option's name and pitch, Offered as (a choice or an add-on), ★ Recommended, ✓ Start ticked
 * and Remove option. With no options it is the one ＋ Option press.
 *
 * Moved whole from `EstimateDetail` (v2.7624, punch list #46 row 3, cut 6 of the Estimates map); the
 * markup is the page's own. The option state stays the page's: the line editor below works on the
 * viewed option's lines, and the draft's save reads all of it.
 */
export default function EstimateOptionsStrip({
  estimateOptions,
  syncedEstimateOptions,
  viewedOptionKey,
  viewedOption,
  lines,
  totalCents,
  switchViewedOption,
  addEstimateOption,
  patchViewedOption,
  setViewedOptionKind,
  removeViewedOption,
  setEstimateOptions,
  setPreviewSelectedOptionKeys,
}: EstimateOptionsStripProps) {
  return (
    <div style={{ marginBottom: estimateOptions.length > 0 ? '0.9rem' : '0.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'stretch' }}>
        {syncedEstimateOptions.map((o) => {
          const on = o.key === viewedOptionKey
          const total = o.key === viewedOptionKey ? totalCents : estimateOptionTotalCents(o)
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => switchViewedOption(o.key)}
              aria-pressed={on}
              title={on ? 'Editing this option' : 'Edit this option'}
              style={{
                font: 'inherit',
                textAlign: 'left',
                minWidth: '10rem',
                border: on ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
                boxShadow: on ? '0 0 0 1px #3b82f6 inset' : 'none',
                background: on ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                color: 'var(--text-strong)',
                borderRadius: 9,
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'block', fontWeight: 700, fontSize: '0.8rem' }}>
                {o.recommended ? <span aria-label="Recommended" style={{ color: '#d97706' }}>★ </span> : null}
                {o.name.trim() || 'Option'}
              </span>
              <span style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums' }}>
                {o.kind === 'add_on' && syncedEstimateOptions.some((p) => p.kind === 'choice') ? `+ ${formatMoney(total)}` : formatMoney(total)}
              </span>
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {(o.key === viewedOptionKey ? lines : o.line_items).length} line item{(o.key === viewedOptionKey ? lines : o.line_items).length === 1 ? '' : 's'}
                {on ? ' · editing' : ''}
              </span>
              {/* v2.3556: how this option is offered — the customer picks one choice, ticks any add-ons */}
              <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: o.kind === 'add_on' ? 'var(--text-blue-800)' : 'var(--text-amber-700)' }}>
                {o.kind === 'add_on' ? '+ add-on' : 'one of the choices'}
              </span>
            </button>
          )
        })}
        {estimateOptions.length < MAX_ESTIMATE_OPTIONS ? (
          <button
            type="button"
            onClick={addEstimateOption}
            title={
              estimateOptions.length === 0
                ? 'Offer the customer a choice — turns this estimate into two options, starting from the current line items'
                : 'Add another option (starts as a copy of the one you’re editing)'
            }
            style={{
              font: 'inherit',
              fontWeight: 700,
              fontSize: '0.8rem',
              color: 'var(--text-link)',
              border: '1px dashed var(--border-strong)',
              background: 'none',
              borderRadius: 9,
              padding: estimateOptions.length === 0 ? '0.4rem 0.8rem' : '0.5rem 0.9rem',
              cursor: 'pointer',
              alignSelf: 'center',
            }}
          >
            ＋ Option
          </button>
        ) : null}
      </div>
      {viewedOption ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '0.55rem' }}>
          <input
            type="text"
            value={viewedOption.name}
            onChange={(e) => patchViewedOption({ name: e.target.value })}
            placeholder="Option name"
            aria-label="Option name"
            style={{ ...estInputBase, width: '11rem' }}
          />
          <input
            type="text"
            value={viewedOption.description}
            onChange={(e) => patchViewedOption({ description: e.target.value })}
            placeholder="Pitch the customer sees under the name — why this option, what's the warranty…"
            aria-label="Option description"
            style={{ ...estInputBase, flex: '1 1 16rem' }}
          />
          {/* v2.3556: Offered as — a choice (the customer picks exactly one) or an add-on (they tick any) */}
          <span role="group" aria-label="Offered as" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
            {(
              [
                ['choice', 'One of the choices', 'The customer picks exactly one choice; the ★ one is pre-selected'],
                ['add_on', 'An add-on', 'Rides along with whatever they choose — they tick any; one you mark Start ticked begins ticked'],
              ] as const
            ).map(([kind, label, title]) => {
              const on = viewedOption.kind === kind
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setViewedOptionKind(kind)}
                  aria-pressed={on}
                  title={title}
                  style={{
                    font: 'inherit',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: 'none',
                    padding: '0.3rem 0.6rem',
                    background: on ? '#2563eb' : 'var(--surface)',
                    color: on ? 'white' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </span>
          {(() => {
            const starBlocked = viewedOption.kind === 'add_on' && syncedEstimateOptions.some((o) => o.kind === 'choice')
            return (
              <button
                type="button"
                onClick={() => setEstimateOptions((prev) => setRecommendedEstimateOption(prev, viewedOption.key))}
                aria-pressed={viewedOption.recommended}
                disabled={starBlocked}
                title={
                  starBlocked
                    ? 'The star marks a choice — add-ons are never pre-selected'
                    : viewedOption.recommended
                      ? 'This is the recommended option — pre-selected on the customer page'
                      : 'Make this the recommended option'
                }
                style={{
                  font: 'inherit',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  padding: '0.3rem 0.6rem',
                  background: viewedOption.recommended ? 'var(--bg-amber-tint)' : 'var(--surface)',
                  color: viewedOption.recommended ? 'var(--text-amber-700)' : 'var(--text-muted)',
                  cursor: starBlocked ? 'not-allowed' : 'pointer',
                  opacity: starBlocked ? 0.55 : 1,
                }}
              >
                ★ Recommended
              </button>
            )
          })()}
          {/* v2.5018 (the owner's call of 2026-10-09): the office may pre-tick a recommended add-on; the customer unticks freely. */}
          {viewedOption.kind === 'add_on' ? (
            <button
              type="button"
              onClick={() =>
                setEstimateOptions((prev) => {
                  const next = setEstimateAddOnPreticked(prev, viewedOption.key, !viewedOption.preticked)
                  setPreviewSelectedOptionKeys(defaultEstimateSelection(next))
                  return next
                })
              }
              aria-pressed={viewedOption.preticked === true}
              title={viewedOption.preticked ? 'Recommended: it starts ticked on the customer page, and they can untick it' : 'Recommend this add-on: it starts ticked on the customer page'}
              style={{
                font: 'inherit',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                padding: '0.3rem 0.6rem',
                background: viewedOption.preticked ? 'var(--bg-amber-tint)' : 'var(--surface)',
                color: viewedOption.preticked ? 'var(--text-amber-700)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              ✓ Start ticked
            </button>
          ) : null}
          <button
            type="button"
            onClick={removeViewedOption}
            title={estimateOptions.length === 2 ? 'Remove this option — the estimate goes back to a single price' : 'Remove this option'}
            style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.3rem 0.6rem', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            Remove option
          </button>
          <span style={{ flex: '1 1 16rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Choices: the customer picks exactly one. Add-ons: they tick any. Make every option an add-on when there is nothing to choose between.
          </span>
        </div>
      ) : null}
    </div>
  )
}
