import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import EstimateAcceptBody from './EstimateAcceptBody'
import {
  ESTIMATE_EXPERIENCE_APP_KEY_LIST,
  parseEstimateCustomerExperienceSnapshot,
  resolveEstimateCustomerExperience,
  toClientCustomerExperience,
} from '../../lib/estimateCustomerExperience'
import { parseAcceptHeaderBrand } from '../../lib/estimateAcceptHeaderBrand'

const PREVIEW_EMAIL_ACCEPT_URL = 'https://example.com/estimate/accept?t=preview'

type EstimateRow = Tables<'estimates'>

type CustomerAcceptanceRecordModalProps = {
  open: boolean
  onClose: () => void
  estimateId: string | null
}

export default function CustomerAcceptanceRecordModal({
  open,
  onClose,
  estimateId,
}: CustomerAcceptanceRecordModalProps) {
  const [row, setRow] = useState<EstimateRow | null>(null)
  const [appCxSettings, setAppCxSettings] = useState<{ key: string; value_text: string | null }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setRow(null)
      setAppCxSettings([])
      setError(null)
      setLoading(false)
      setSignedUrl(null)
      return
    }
    if (!estimateId?.trim()) {
      setRow(null)
      setError('Missing estimate.')
      return
    }

    const id = estimateId.trim()
    let cancelled = false
    setLoading(true)
    setError(null)
    setRow(null)
    setSignedUrl(null)

    void (async () => {
      try {
        const [estResult, cxResult] = await Promise.all([
          withSupabaseRetry(
            async () => await supabase.from('estimates').select('*').eq('id', id).maybeSingle(),
            'load estimate for acceptance modal',
          ),
          withSupabaseRetry(
            async () =>
              await supabase.from('app_settings').select('key, value_text').in('key', ESTIMATE_EXPERIENCE_APP_KEY_LIST),
            'load app_settings for acceptance modal',
          ),
        ])

        if (cancelled) return

        const est = estResult as EstimateRow | null
        const cxList = (cxResult ?? []) as { key: string; value_text: string | null }[]
        setAppCxSettings(cxList)

        if (!est) {
          setError('Estimate not found.')
          return
        }
        if (est.status !== 'customer_accepted') {
          setError('This estimate is not in accepted status.')
          return
        }
        setRow(est)
      } catch (e) {
        if (!cancelled) setError(formatErrorMessage(e, 'Could not load acceptance record'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, estimateId])

  useEffect(() => {
    const path = row?.acceptor_signature_storage_path?.trim()
    if (!path) {
      setSignedUrl(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const signed = await withSupabaseRetry(
          async () => await supabase.storage.from('estimate-acceptor-signatures').createSignedUrl(path, 3600),
          'estimate acceptor signature url modal',
        )
        if (cancelled) return
        setSignedUrl(signed?.signedUrl ?? null)
      } catch {
        if (!cancelled) setSignedUrl(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [row?.acceptor_signature_storage_path, row?.id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const experienceClient = useMemo(() => {
    if (!row || row.status !== 'customer_accepted') return null
    const snap = parseEstimateCustomerExperienceSnapshot(row.customer_experience_sent)
    const resolved = snap
      ? snap
      : resolveEstimateCustomerExperience(appCxSettings, row.customer_experience_overrides, {
          acceptUrl: PREVIEW_EMAIL_ACCEPT_URL,
          title: row.title ?? '',
          estimateNumber: row.estimate_number,
        })
    return toClientCustomerExperience(resolved)
  }, [row, appCxSettings])

  if (!open) return null

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-acceptance-record-title"
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: 'min(92vh, 900px)',
          overflow: 'auto',
          background: 'white',
          borderRadius: 8,
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e5e7eb',
            position: 'sticky',
            top: 0,
            background: 'white',
            zIndex: 1,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 id="customer-acceptance-record-title" style={{ margin: 0, fontSize: '1.1rem' }}>
              Accepted estimate
            </h2>
            {row && row.status === 'customer_accepted' ? (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
                {row.acceptor_printed_name?.trim() ? (
                  <>
                    <strong>Signed as:</strong> {row.acceptor_printed_name.trim()}
                    {row.acceptor_consented_at ? (
                      <>
                        {' '}
                        · <strong>Accepted:</strong> {new Date(row.acceptor_consented_at).toLocaleString()}
                      </>
                    ) : null}
                  </>
                ) : row.acceptor_consented_at ? (
                  <>
                    <strong>Accepted:</strong> {new Date(row.acceptor_consented_at).toLocaleString()}
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {row && row.status === 'customer_accepted' ? (
              <Link to={`/estimates/${row.estimate_number}`} style={{ fontSize: '0.9rem' }} onClick={onClose}>
                Open estimate
              </Link>
            ) : null}
            <button type="button" onClick={onClose} style={{ padding: '0.4rem 0.85rem' }}>
              Close
            </button>
          </div>
        </div>

        <div style={{ padding: '1rem 1.25rem 1.5rem' }}>
          {loading ? <p style={{ margin: 0, color: '#6b7280' }}>Loading…</p> : null}
          {error ? (
            <p style={{ margin: 0, color: '#b91c1c' }} role="alert">
              {error}
            </p>
          ) : null}
          {!loading && !error && row && experienceClient ? (
            <div
              style={{
                fontFamily: 'system-ui, sans-serif',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '1rem',
                background: '#fafafa',
              }}
            >
              <EstimateAcceptBody
                variant="staffPreview"
                previewBanner="Record of what the customer accepted (read-only)."
                estimate={{
                  title: row.title || '',
                  for_line: row.for_address?.trim() || null,
                  valid_until: row.valid_until ?? null,
                  line_items_snapshot: row.line_items_snapshot,
                  terms_snapshot: row.terms_snapshot ?? '',
                  total_cents: row.total_cents,
                }}
                experience={experienceClient}
                printedName={row.acceptor_printed_name?.trim() ?? ''}
                agreed={false}
                onPrintedNameChange={() => {}}
                onAgreedChange={() => {}}
                formError={null}
                submitting={false}
                onSubmit={() => undefined}
                headerBrand={parseAcceptHeaderBrand(row.accept_header_brand)}
                staffAcceptedRecord={{
                  printedName: row.acceptor_printed_name?.trim() ?? '',
                  consentedAtIso: row.acceptor_consented_at,
                  drawSignatureUrl: row.acceptor_signature_storage_path?.trim() ? signedUrl : null,
                  drawSignatureLoading:
                    !!(row.acceptor_signature_storage_path?.trim()) && !signedUrl,
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
