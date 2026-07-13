import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import EstimateAcceptBody from '../components/estimates/EstimateAcceptBody'
import { isEstimateUuidSegment, parseEstimateQuoteNumberSegment } from '../lib/estimateRouteSegment'
import {
  ESTIMATE_EXPERIENCE_APP_KEY_LIST,
  fallbackClientCustomerExperience,
  parseEstimateCustomerExperienceSnapshot,
  resolveEstimateCustomerExperience,
  toClientCustomerExperience,
} from '../lib/estimateCustomerExperience'
import { readAndConsumeStaffAcceptPreviewSnapshot } from '../lib/estimateStaffAcceptPreview'
import type { EstimateAcceptHeaderBrand } from '../lib/estimateAcceptHeaderBrand'
import { parseAcceptHeaderBrand } from '../lib/estimateAcceptHeaderBrand'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import type { Tables } from '../types/database'
import {
  parseCustomerAttachmentSent,
  type CustomerAttachmentPayload,
} from '../lib/estimateCustomerAttachment'

const PREVIEW_EMAIL_ACCEPT_URL = 'https://example.com/estimate/accept?t=preview'

type EstimateRow = Tables<'estimates'>

export default function EstimateAcceptStaffPreview() {
  const { id: segment } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [row, setRow] = useState<EstimateRow | null>(null)
  const [experience, setExperience] = useState(fallbackClientCustomerExperience())
  const [docTitle, setDocTitle] = useState('')
  const [validUntil, setValidUntil] = useState<string | null>(null)
  const [lineItemsSnapshot, setLineItemsSnapshot] = useState<unknown>([])
  const [termsSnapshot, setTermsSnapshot] = useState('')
  const [totalCents, setTotalCents] = useState(0)
  const [docForLine, setDocForLine] = useState<string | null>(null)
  const [previewHeaderBrand, setPreviewHeaderBrand] = useState<EstimateAcceptHeaderBrand | null>(null)
  const [customerAttachment, setCustomerAttachment] = useState<CustomerAttachmentPayload | null>(null)

  const load = useCallback(async () => {
    if (!segment?.trim()) {
      setError('Missing estimate.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      let data: EstimateRow | null = null

      if (isEstimateUuidSegment(segment)) {
        const one = await withSupabaseRetry(
          async () => await supabase.from('estimates').select('*').eq('id', segment).maybeSingle(),
          'load estimate staff preview',
        )
        data = (one ?? null) as EstimateRow | null
      } else {
        const n = parseEstimateQuoteNumberSegment(segment)
        if (n === null) {
          setError('Invalid estimate.')
          setLoading(false)
          return
        }
        const one = await withSupabaseRetry(
          async () => await supabase.from('estimates').select('*').eq('estimate_number', n).maybeSingle(),
          'load estimate staff preview',
        )
        data = (one ?? null) as EstimateRow | null
      }

      if (!data) {
        setError('Estimate not found or access denied.')
        setLoading(false)
        return
      }

      setRow(data)

      const appRows = await withSupabaseRetry(
        async () =>
          await supabase.from('app_settings').select('key, value_text').in('key', ESTIMATE_EXPERIENCE_APP_KEY_LIST),
        'load estimate app_settings staff preview',
      )

      const appSettings = (appRows ?? []) as { key: string; value_text: string | null }[]

      const staffSnapshot = readAndConsumeStaffAcceptPreviewSnapshot(data.id)

      let title = data.title ?? ''
      let terms = data.terms_snapshot ?? ''
      let lines = data.line_items_snapshot
      let vu = data.valid_until
      let tc = data.total_cents

      if (staffSnapshot) {
        title = staffSnapshot.title
        terms = staffSnapshot.terms
        lines = staffSnapshot.line_items
        vu = staffSnapshot.valid_until
        tc = staffSnapshot.total_cents
      }

      setDocTitle(title)
      setValidUntil(vu)
      setLineItemsSnapshot(lines)
      setTermsSnapshot(terms)
      setTotalCents(tc)

      let resolvedForLine: string | null = null
      if (staffSnapshot !== null && staffSnapshot.for_line !== undefined) {
        resolvedForLine = staffSnapshot.for_line
      } else {
        const override = String(data.for_address ?? '').trim()
        if (override) {
          resolvedForLine = override
        } else if (data.customer_id) {
          const cid = data.customer_id
          const custRow = (await withSupabaseRetry(
            async () => await supabase.from('customers').select('address').eq('id', cid).maybeSingle(),
            'load customer address for staff accept preview',
          )) as { address: string | null } | null
          const addr = String(custRow?.address ?? '').trim()
          resolvedForLine = addr || null
        }
      }
      setDocForLine(resolvedForLine)

      const templateVars = {
        acceptUrl: PREVIEW_EMAIL_ACCEPT_URL,
        title: title.trim() || '',
        estimateNumber: data.estimate_number,
      }

      let client = fallbackClientCustomerExperience()

      if (staffSnapshot) {
        const overridesJson =
          staffSnapshot.overrides != null ? staffSnapshot.overrides : data.customer_experience_overrides
        const resolved = resolveEstimateCustomerExperience(appSettings, overridesJson, templateVars)
        client = toClientCustomerExperience(resolved)
      } else {
        const sentSnap = parseEstimateCustomerExperienceSnapshot(data.customer_experience_sent)
        if (sentSnap) {
          client = toClientCustomerExperience(sentSnap)
        } else {
          const resolved = resolveEstimateCustomerExperience(
            appSettings,
            data.customer_experience_overrides,
            templateVars,
          )
          client = toClientCustomerExperience(resolved)
        }
      }

      setExperience(client)

      let headerBrand: EstimateAcceptHeaderBrand | null = parseAcceptHeaderBrand(data.accept_header_brand)
      if (staffSnapshot && 'accept_header_brand' in staffSnapshot) {
        const ab = staffSnapshot.accept_header_brand
        headerBrand = ab === 'elec' || ab === 'plum' ? ab : null
      }
      setPreviewHeaderBrand(headerBrand)

      const snapAtt = staffSnapshot?.customer_attachment
      const rowAtt = parseCustomerAttachmentSent(data.customer_attachment_sent)
      setCustomerAttachment(snapAtt ?? rowAtt ?? null)
    } catch (e) {
      setError(formatErrorMessage(e, 'Could not load estimate'))
    } finally {
      setLoading(false)
    }
  }, [segment])

  useEffect(() => {
    void load()
  }, [load])

  const pageShellStyle: CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    padding: '2rem',
    maxWidth: 640,
    margin: '0 auto',
  }

  if (loading) {
    return (
      <div style={pageShellStyle}>
        <p>Loading…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={pageShellStyle}>
        <p style={{ color: 'var(--text-red-700)' }}>{error}</p>
        <p style={{ marginTop: '0.75rem' }}>
          <Link to="/estimates">← Estimates</Link>
        </p>
      </div>
    )
  }

  if (!row) return null

  return (
    <div style={pageShellStyle}>
      <EstimateAcceptBody
        variant="staffPreview"
        estimate={{
          title: docTitle,
          for_line: docForLine,
          valid_until: validUntil,
          line_items_snapshot: lineItemsSnapshot,
          terms_snapshot: termsSnapshot,
          total_cents: totalCents,
        }}
        experience={experience}
        printedName=""
        agreed={false}
        onPrintedNameChange={() => {}}
        onAgreedChange={() => {}}
        formError={null}
        submitting={false}
        onSubmit={() => undefined}
        headerBrand={previewHeaderBrand}
        customerAttachment={customerAttachment}
      />
    </div>
  )
}
