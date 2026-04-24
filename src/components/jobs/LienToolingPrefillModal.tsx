import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { buildLienToolingPrefillState } from '../../lib/buildLienToolingPrefillFromJob'
import {
  buildLienToolingFormUrl,
  lienToolingOrigin,
  type LienToolingFormPage,
  type LienToolingPrefillState,
} from '../../lib/lienToolingPrefillUrl'
import { getPhysicalInvoiceIssuerDraft } from '../../lib/physicalInvoiceIssuer'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { useToastContext } from '../../contexts/ToastContext'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

type FieldKind = 'text' | 'textarea' | 'date' | 'number' | 'checkbox'

type FieldDef = { key: string; label: string; kind: FieldKind }

const DEMAND_FIELDS: FieldDef[] = [
  { key: 'business-name', label: 'Your business name', kind: 'text' },
  { key: 'sender-name', label: 'Your full name / title', kind: 'text' },
  { key: 'business-address', label: 'Business street address', kind: 'text' },
  { key: 'business-city', label: 'Business city', kind: 'text' },
  { key: 'business-state', label: 'Business state', kind: 'text' },
  { key: 'business-zip', label: 'Business ZIP', kind: 'text' },
  { key: 'business-phone', label: 'Business phone', kind: 'text' },
  { key: 'business-email', label: 'Business email', kind: 'text' },
  { key: 'client-name', label: 'Client name', kind: 'text' },
  { key: 'client-address', label: 'Client address', kind: 'text' },
  { key: 'client-city', label: 'Client city', kind: 'text' },
  { key: 'client-state', label: 'Client state', kind: 'text' },
  { key: 'client-zip', label: 'Client ZIP', kind: 'text' },
  { key: 'invoice-number', label: 'Invoice #', kind: 'text' },
  { key: 'invoice-date', label: 'Invoice date', kind: 'date' },
  { key: 'due-date', label: 'Due date', kind: 'date' },
  { key: 'payment-deadline', label: 'Payment deadline', kind: 'date' },
  { key: 'service-description', label: 'Service description', kind: 'textarea' },
  { key: 'service-dates', label: 'Service date(s)', kind: 'text' },
  { key: 'completion-date', label: 'Completion date', kind: 'date' },
  { key: 'invoice-total', label: 'Invoice total ($)', kind: 'number' },
  { key: 'payments-received', label: 'Payments received ($)', kind: 'number' },
  { key: 'outstanding-balance', label: 'Outstanding balance ($)', kind: 'number' },
  { key: 'include-late-fees', label: 'Include late fees statement', kind: 'checkbox' },
  { key: 'include-notarial', label: 'Include notarial block', kind: 'checkbox' },
  { key: 'payment-method', label: 'Payment method (optional)', kind: 'text' },
]

const MECHANICS_FIELDS: FieldDef[] = [
  { key: 'claimant-name', label: "Claimant's full legal name", kind: 'text' },
  { key: 'company-name', label: 'Company name', kind: 'text' },
  { key: 'claimant-address', label: 'Claimant address', kind: 'text' },
  { key: 'claimant-city', label: 'Claimant city', kind: 'text' },
  { key: 'claimant-state', label: 'Claimant state', kind: 'text' },
  { key: 'claimant-zip', label: 'Claimant ZIP', kind: 'text' },
  { key: 'owner-name', label: 'Owner name', kind: 'text' },
  { key: 'owner-address', label: 'Owner address', kind: 'text' },
  { key: 'owner-city', label: 'Owner city', kind: 'text' },
  { key: 'owner-state', label: 'Owner state', kind: 'text' },
  { key: 'owner-zip', label: 'Owner ZIP', kind: 'text' },
  { key: 'property-address', label: 'Property address', kind: 'text' },
  { key: 'property-city', label: 'Property city', kind: 'text' },
  { key: 'property-state', label: 'Property state', kind: 'text' },
  { key: 'property-zip', label: 'Property ZIP', kind: 'text' },
  { key: 'property-county', label: 'Property county (filing)', kind: 'text' },
  { key: 'legal-description', label: 'Legal description (Pull from county records)', kind: 'textarea' },
  { key: 'work-description', label: 'Work description', kind: 'textarea' },
  { key: 'work-start', label: 'Work start', kind: 'date' },
  { key: 'work-end', label: 'Work end', kind: 'date' },
  { key: 'unpaid-amount', label: 'Unpaid amount ($)', kind: 'number' },
  { key: 'customer-name', label: 'Customer (contract with)', kind: 'text' },
  { key: 'notice-date', label: 'Notice date', kind: 'date' },
  { key: 'contractor-name', label: 'Contractor name', kind: 'text' },
  { key: 'contractor-address', label: 'Contractor address', kind: 'text' },
  { key: 'contractor-city', label: 'Contractor city', kind: 'text' },
  { key: 'contractor-state', label: 'Contractor state', kind: 'text' },
  { key: 'contractor-zip', label: 'Contractor ZIP', kind: 'text' },
]

const RELEASE_FIELDS: FieldDef[] = [
  { key: 'lien-reference', label: 'Lien reference #', kind: 'text' },
  { key: 'payment-date', label: 'Date of payment / satisfaction', kind: 'date' },
  { key: 'claimant-name', label: "Claimant's full legal name", kind: 'text' },
  { key: 'company-name', label: 'Company name', kind: 'text' },
  { key: 'claimant-address', label: 'Claimant address', kind: 'text' },
  { key: 'claimant-city', label: 'Claimant city', kind: 'text' },
  { key: 'claimant-state', label: 'Claimant state', kind: 'text' },
  { key: 'claimant-zip', label: 'Claimant ZIP', kind: 'text' },
  { key: 'filing-date', label: 'Filing date', kind: 'date' },
  { key: 'property-description', label: 'Legal description (should match filed lien)', kind: 'textarea' },
  { key: 'owner-name', label: 'Owner name', kind: 'text' },
  { key: 'property-county', label: 'County', kind: 'text' },
  { key: 'property-address', label: 'Property address', kind: 'text' },
  { key: 'property-city', label: 'Property city', kind: 'text' },
  { key: 'property-state', label: 'Property state', kind: 'text' },
  { key: 'property-zip', label: 'Property ZIP', kind: 'text' },
]

function fieldsForForm(form: LienToolingFormPage): FieldDef[] {
  switch (form) {
    case 'demand-letter':
      return DEMAND_FIELDS
    case 'mechanics-lien':
      return MECHANICS_FIELDS
    case 'release-lien':
      return RELEASE_FIELDS
    default: {
      const _e: never = form
      return _e
    }
  }
}

export default function LienToolingPrefillModal({
  open,
  onClose,
  job,
  invoice,
  senderNameFallback,
  authEmail,
}: {
  open: boolean
  onClose: () => void
  job: JobWithDetails | null
  invoice: JobsLedgerInvoice | null
  /** Resolved sender line: e.g. job master’s People “Full name and title” (`users.notes`) with session name fallback. */
  senderNameFallback: string
  authEmail: string
}) {
  const { showToast } = useToastContext()
  const [formType, setFormType] = useState<LienToolingFormPage>('demand-letter')
  const [draft, setDraft] = useState<LienToolingPrefillState>({})

  const issuer = useMemo(() => (open ? getPhysicalInvoiceIssuerDraft() : null), [open])

  const rebuildDraft = useCallback(
    (page: LienToolingFormPage) => {
      if (!job) return
      setDraft(
        buildLienToolingPrefillState(page, {
          job,
          invoice,
          issuer,
          senderNameFallback: senderNameFallback.trim() || '—',
          senderEmailFallback: authEmail.trim(),
        }),
      )
    },
    [job, invoice, issuer, senderNameFallback, authEmail],
  )

  useEffect(() => {
    if (!open || !job) return
    rebuildDraft(formType)
  }, [open, job, formType, rebuildDraft])

  const shareUrl = useMemo(() => {
    if (!job || Object.keys(draft).length === 0) return ''
    return buildLienToolingFormUrl(lienToolingOrigin(), formType, draft)
  }, [job, formType, draft])

  const setField = (key: string, value: string | boolean) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const copyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      showToast('Lien Tooling link copied.', 'success')
    } catch {
      showToast('Could not copy link.', 'error')
    }
  }

  const openLien = () => {
    if (!shareUrl) return
    openInExternalBrowser(shareUrl)
  }

  if (!open || !job) return null

  const fieldList = fieldsForForm(formType)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lien-tooling-prefill-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 8,
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>
          <h2 id="lien-tooling-prefill-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Open Lien Tooling
          </h2>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
            Confirm fields below, then copy a shareable link or open Lien Tooling. Sender details use Settings → Physical
            invoice issuer when set.
          </p>
        </div>

        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.35rem' }}>Form</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {(
              [
                ['demand-letter', 'Demand letter'],
                ['mechanics-lien', "Mechanic's lien"],
                ['release-lien', 'Release of lien'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFormType(value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8125rem',
                  borderRadius: 6,
                  border: formType === value ? '2px solid #2563eb' : '1px solid #d1d5db',
                  background: formType === value ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  fontWeight: formType === value ? 600 : 400,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', flex: 1 }}>
          {fieldList.map((f) => {
            const raw = draft[f.key]
            if (f.kind === 'checkbox') {
              const checked = Boolean(raw)
              return (
                <label
                  key={f.key}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.875rem' }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setField(f.key, e.target.checked)}
                  />
                  {f.label}
                </label>
              )
            }
            const strVal = raw === undefined || raw === null ? '' : String(raw)
            if (f.kind === 'textarea') {
              return (
                <label key={f.key} style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                  <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>{f.label}</span>
                  <textarea
                    value={strVal}
                    onChange={(e) => setField(f.key, e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontFamily: 'inherit',
                      fontSize: '0.875rem',
                    }}
                  />
                </label>
              )
            }
            return (
              <label key={f.key} style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>{f.label}</span>
                <input
                  type={f.kind === 'date' ? 'date' : f.kind === 'number' ? 'number' : 'text'}
                  step={f.kind === 'number' ? '0.01' : undefined}
                  value={strVal}
                  onChange={(e) => setField(f.key, e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    fontSize: '0.875rem',
                  }}
                />
              </label>
            )
          })}
        </div>

        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void copyLink()}
            disabled={!shareUrl}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: 'white',
              border: '1px solid #2563eb',
              color: '#2563eb',
              borderRadius: 4,
              cursor: shareUrl ? 'pointer' : 'not-allowed',
            }}
          >
            Copy link
          </button>
          <button
            type="button"
            onClick={openLien}
            disabled={!shareUrl}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: shareUrl ? 'pointer' : 'not-allowed',
              fontWeight: 500,
            }}
          >
            Open Lien Tooling
          </button>
        </div>
      </div>
    </div>
  )
}
