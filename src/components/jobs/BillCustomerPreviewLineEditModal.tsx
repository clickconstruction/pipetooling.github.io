import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import {
  STRIPE_INVOICE_LINE_DESCRIPTION_MAX,
  stripeInvoiceFixtureLineLength,
} from '../../lib/stripeInvoiceLineDescription'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'

export type BillCustomerLineEditSession =
  | {
      mode: 'fixture'
      jobId: string
      fixtureId: string
      initialName: string
      initialLineDescription: string
    }
  | {
      mode: 'material'
      jobId: string
      materialId: string
      initialDescription: string
      amountDollars: number
    }
  | {
      mode: 'stripe_override'
      initialLineDescription: string
    }

function overlayStyle(z: number): CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: z,
    padding: '1rem',
    boxSizing: 'border-box',
  }
}

const panelStyle: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 8,
  minWidth: 320,
  maxWidth: 480,
  width: '100%',
  maxHeight: '90vh',
  overflow: 'auto',
  padding: '1.25rem',
  boxSizing: 'border-box',
}

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontWeight: 500,
  fontSize: '0.875rem',
  color: 'var(--text-700)',
}

const controlStyle: CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  fontSize: '0.875rem',
  boxSizing: 'border-box',
  background: 'var(--surface)',
}

const textareaStyle: CSSProperties = {
  ...controlStyle,
  resize: 'vertical',
  lineHeight: 1.4,
  minHeight: '4.25rem',
}

const FIXTURE_TEXTAREA_LINE_HEIGHT_RATIO = 1.4

/** Fit content (including soft-wrapped lines) plus one extra line for typing. */
function syncTextareaHeightPlusOneLine(el: HTMLTextAreaElement | null): void {
  if (!el) return
  el.style.height = '0px'
  const cs = getComputedStyle(el)
  let lineHeight = parseFloat(cs.lineHeight)
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
    const fontSize = parseFloat(cs.fontSize)
    lineHeight = Number.isFinite(fontSize) ? fontSize * FIXTURE_TEXTAREA_LINE_HEIGHT_RATIO : 19.6
  }
  el.style.height = `${el.scrollHeight + lineHeight}px`
}

/** Fixture Name / Scope: auto-grow, no manual resize fight; cap very long paste. */
const fixtureAutoTextareaStyle: CSSProperties = {
  ...textareaStyle,
  resize: 'none',
  minHeight: '2.5rem',
  maxHeight: '40vh',
  overflowY: 'auto',
}

export default function BillCustomerPreviewLineEditModal({
  open,
  session,
  onClose,
  zIndex = 1030,
  materialEditDisabled = false,
  materialEditDisabledReason,
  onFixtureSaved,
  onMaterialSaved,
  onStripeOverrideSaved,
}: {
  open: boolean
  session: BillCustomerLineEditSession | null
  onClose: () => void
  zIndex?: number
  materialEditDisabled?: boolean
  materialEditDisabledReason?: string
  onFixtureSaved: () => void | Promise<void>
  onMaterialSaved: () => void | Promise<void>
  onStripeOverrideSaved: (lineDescription: string) => void | Promise<void>
}) {
  const [fixtureName, setFixtureName] = useState('')
  const [fixtureScope, setFixtureScope] = useState('')
  const [materialDescription, setMaterialDescription] = useState('')
  const [overrideText, setOverrideText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fixtureNameTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fixtureScopeTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!open || !session) {
      setError(null)
      setSaving(false)
      return
    }
    setError(null)
    if (session.mode === 'fixture') {
      setFixtureName(session.initialName)
      setFixtureScope(session.initialLineDescription)
    } else if (session.mode === 'material') {
      setMaterialDescription(session.initialDescription)
    } else {
      setOverrideText(session.initialLineDescription)
    }
  }, [open, session])

  useLayoutEffect(() => {
    if (!open || session?.mode !== 'fixture') return
    syncTextareaHeightPlusOneLine(fixtureNameTextareaRef.current)
    syncTextareaHeightPlusOneLine(fixtureScopeTextareaRef.current)
  }, [open, session, fixtureName, fixtureScope])

  function handleDiscard() {
    setError(null)
    onClose()
  }

  async function handleSave() {
    if (!session) return
    setError(null)

    if (session.mode === 'fixture') {
      const name = fixtureName.trim()
      const scope = fixtureScope.trim()
      if (!name) {
        setError('Name is required')
        return
      }
      const len = stripeInvoiceFixtureLineLength(name, scope)
      if (len > STRIPE_INVOICE_LINE_DESCRIPTION_MAX) {
        setError(
          `Combined name and scope is too long for Stripe (${len} / ${STRIPE_INVOICE_LINE_DESCRIPTION_MAX}). Shorten the text.`,
        )
        return
      }
      setSaving(true)
      try {
        await withSupabaseRetry(
          () =>
            supabase
              .from('jobs_ledger_fixtures')
              .update({ name, line_description: scope || null })
              .eq('id', session.fixtureId)
              .eq('job_id', session.jobId),
          'update fixture from Bill Customer',
        )
        await onFixtureSaved()
        onClose()
      } catch (e) {
        setError(formatErrorMessage(e, 'Could not save'))
      } finally {
        setSaving(false)
      }
      return
    }

    if (session.mode === 'material') {
      if (materialEditDisabled) {
        setError(materialEditDisabledReason ?? 'You cannot edit materials.')
        return
      }
      const desc = materialDescription.trim()
      if (!desc) {
        setError('Description is required')
        return
      }
      setSaving(true)
      try {
        await withSupabaseRetry(
          () =>
            supabase
              .from('jobs_ledger_materials')
              .update({ description: desc })
              .eq('id', session.materialId)
              .eq('job_id', session.jobId),
          'update material from Bill Customer',
        )
        await onMaterialSaved()
        onClose()
      } catch (e) {
        setError(formatErrorMessage(e, 'Could not save'))
      } finally {
        setSaving(false)
      }
      return
    }

    const t = overrideText.trim()
    if (t.length > STRIPE_INVOICE_LINE_DESCRIPTION_MAX) {
      setError(`Line on bill must be at most ${STRIPE_INVOICE_LINE_DESCRIPTION_MAX} characters`)
      return
    }
    setSaving(true)
    try {
      await onStripeOverrideSaved(t)
      onClose()
    } catch (e) {
      setError(formatErrorMessage(e, 'Could not apply'))
    } finally {
      setSaving(false)
    }
  }

  if (!open || !session) return null

  const title =
    session.mode === 'fixture'
      ? 'Edit Specific Work line'
      : session.mode === 'material'
        ? 'Edit materials line'
        : 'Edit line on bill'

  const fixtureStripeLineLen =
    session.mode === 'fixture' ? stripeInvoiceFixtureLineLength(fixtureName, fixtureScope) : 0
  const fixtureStripeLineOverLimit =
    session.mode === 'fixture' && fixtureStripeLineLen > STRIPE_INVOICE_LINE_DESCRIPTION_MAX

  return (
    <div
      style={overlayStyle(zIndex)}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) handleDiscard()
      }}
    >
      <div
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bill-customer-line-edit-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="bill-customer-line-edit-title"
          style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', textAlign: 'center' }}
        >
          {title}
        </h2>

        {session.mode === 'fixture' ? (
          <>
            <label style={labelStyle} htmlFor="bcf-name">
              Name
            </label>
            <textarea
              id="bcf-name"
              ref={fixtureNameTextareaRef}
              value={fixtureName}
              onChange={(e) => setFixtureName(e.target.value)}
              autoComplete="off"
              style={{ ...fixtureAutoTextareaStyle, marginBottom: '0.65rem' }}
            />
            <label style={labelStyle} htmlFor="bcf-scope">
              Scope (optional)
            </label>
            <textarea
              id="bcf-scope"
              ref={fixtureScopeTextareaRef}
              value={fixtureScope}
              onChange={(e) => setFixtureScope(e.target.value)}
              style={{ ...fixtureAutoTextareaStyle, marginBottom: '0.5rem' }}
              aria-describedby="bcf-stripe-len bcf-stripe-hint"
            />
            <div
              id="bcf-stripe-len"
              aria-live="polite"
              style={{
                margin: '0 0 0.35rem',
                fontSize: '0.75rem',
                color: fixtureStripeLineOverLimit ? '#d97706' : 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              ({fixtureStripeLineLen} / {STRIPE_INVOICE_LINE_DESCRIPTION_MAX})
            </div>
            <p
              id="bcf-stripe-hint"
              style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}
            >
              Shown on Stripe as <strong>Name — Scope</strong>.
            </p>
          </>
        ) : null}

        {session.mode === 'material' ? (
          <>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Amount:{' '}
              {session.amountDollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}{' '}
              (edit in Edit Job)
            </p>
            <label style={labelStyle} htmlFor="bcf-mat-desc">
              Description
            </label>
            <textarea
              id="bcf-mat-desc"
              value={materialDescription}
              onChange={(e) => setMaterialDescription(e.target.value)}
              style={{ ...textareaStyle, marginBottom: '0.5rem' }}
              disabled={materialEditDisabled}
            />
            {materialEditDisabled && materialEditDisabledReason ? (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-amber-700)' }}>
                {materialEditDisabledReason}
              </p>
            ) : null}
          </>
        ) : null}

        {session.mode === 'stripe_override' ? (
          <>
            <label style={labelStyle} htmlFor="bcf-override">
              Line on bill
            </label>
            <textarea
              id="bcf-override"
              value={overrideText}
              onChange={(e) => setOverrideText(e.target.value)}
              style={{ ...textareaStyle, marginBottom: '0.5rem' }}
              maxLength={STRIPE_INVOICE_LINE_DESCRIPTION_MAX}
            />
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Max {STRIPE_INVOICE_LINE_DESCRIPTION_MAX} characters. Replaces multi-line Specific Work on the Stripe
              invoice.
            </p>
          </>
        ) : null}

        {error ? (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-red-700)' }}>{error}</p>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={saving}
            style={{
              padding: '0.45rem 0.85rem',
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              borderRadius: 4,
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || (session.mode === 'material' && materialEditDisabled)}
            style={{
              padding: '0.45rem 0.85rem',
              border: 'none',
              background: saving ? '#93c5fd' : '#2563eb',
              color: '#fff',
              borderRadius: 4,
              cursor: saving || (session.mode === 'material' && materialEditDisabled) ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
