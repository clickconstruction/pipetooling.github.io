/**
 * The accepted-estimate record, as a body (v2.2709): loads the estimate +
 * customer-experience settings + the drawn-signature URL and renders the
 * read-only EstimateAcceptBody box. `CustomerAcceptanceRecordModal` (Estimates)
 * and `JobSignedAgreementModal` (Jobs) both mount it; `onLoaded` hands the
 * row up so the host can write its own banner and facts.
 */
import { useEffect, useMemo, useState } from 'react'
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
import { parseCustomerAttachmentSent } from '../../lib/estimateCustomerAttachment'
import { signedRecordId } from '../../lib/signedRecordId'

const PREVIEW_EMAIL_ACCEPT_URL = 'https://example.com/estimate/accept?t=preview'

export type EstimateRecordRow = Tables<'estimates'>

export function CustomerAcceptanceRecordBody({
  open,
  estimateId,
  onLoaded,
  previewBanner = 'Record of what the customer accepted (read-only).',
}: {
  open: boolean
  estimateId: string | null
  /** Fires with the loaded row (or null on error) so the host can render its own header. */
  onLoaded?: (row: EstimateRecordRow | null) => void
  previewBanner?: string
}) {
  const [row, setRow] = useState<EstimateRecordRow | null>(null)
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
      onLoaded?.(null)
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
          withSupabaseRetry(async () => await supabase.from('estimates').select('*').eq('id', id).maybeSingle(), 'load estimate for acceptance record'),
          withSupabaseRetry(
            async () => await supabase.from('app_settings').select('key, value_text').in('key', ESTIMATE_EXPERIENCE_APP_KEY_LIST),
            'load app_settings for acceptance record',
          ),
        ])
        if (cancelled) return
        const est = estResult as EstimateRecordRow | null
        setAppCxSettings((cxResult ?? []) as { key: string; value_text: string | null }[])
        if (!est) {
          setError('Estimate not found.')
          onLoaded?.(null)
          return
        }
        if (est.status !== 'customer_accepted') {
          setError('This estimate is not in accepted status.')
          onLoaded?.(null)
          return
        }
        setRow(est)
        onLoaded?.(est)
      } catch (e) {
        if (!cancelled) {
          setError(formatErrorMessage(e, 'Could not load acceptance record'))
          onLoaded?.(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          'estimate acceptor signature url',
        )
        if (!cancelled) setSignedUrl(signed?.signedUrl ?? null)
      } catch {
        if (!cancelled) setSignedUrl(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [row])

  const experienceClient = useMemo(() => {
    if (!row || row.status !== 'customer_accepted') return null
    const snap = parseEstimateCustomerExperienceSnapshot(row.customer_experience_sent)
    const resolved = snap
      ? snap
      : resolveEstimateCustomerExperience(
          appCxSettings,
          row.customer_experience_overrides,
          { acceptUrl: PREVIEW_EMAIL_ACCEPT_URL, title: row.title ?? '', estimateNumber: row.estimate_number },
          { docKind: row.doc_kind },
        )
    return toClientCustomerExperience(resolved)
  }, [row, appCxSettings])

  const recordCustomerAttachment = useMemo(() => (row ? parseCustomerAttachmentSent(row.customer_attachment_sent) : null), [row])

  if (loading) return <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading…</p>
  if (error)
    return (
      <p style={{ margin: 0, color: 'var(--text-red-700)' }} role="alert">
        {error}
      </p>
    )
  if (!row || !experienceClient) return null
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', background: 'var(--bg-page)' }}>
      <EstimateAcceptBody
        variant="staffPreview"
        previewBanner={previewBanner}
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
          drawSignatureLoading: !!row.acceptor_signature_storage_path?.trim() && !signedUrl,
          ip: row.acceptor_ip,
          userAgent: row.acceptor_user_agent,
          recordId: signedRecordId('E', row.estimate_number, row.id),
        }}
        customerAttachment={recordCustomerAttachment}
      />
    </div>
  )
}

export default CustomerAcceptanceRecordBody
