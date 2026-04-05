import type { ReactNode } from 'react'
import { formatValidUntilForDisplay } from '../../lib/formatEstimateValidUntilDisplay'
import type { EstimateAcceptHeaderBrand } from '../../lib/estimateAcceptHeaderBrand'
import { acceptHeaderBrandImageSrc, acceptHeaderBrandLabel } from '../../lib/estimateAcceptHeaderBrand'

export type EstimatePublicLineItem = { description?: string; amount_cents?: number }

export function estimatePublicLineItems(raw: unknown): EstimatePublicLineItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => {
    const o = x as Record<string, unknown>
    return {
      description: String(o.description ?? ''),
      amount_cents: Math.max(0, Math.round(Number(o.amount_cents ?? 0))),
    }
  })
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export type EstimateCustomerDocumentProps = {
  title: string
  /** Effective For line: override or CRM address; empty/null shows em dash */
  forLine?: string | null
  validUntil: string | null
  lineItemsSnapshot: unknown
  termsSnapshot: string
  totalCents: number
  previewBanner?: ReactNode
  /** When title is empty */
  titleFallback?: string
  validThroughPrefix?: string
  lineItemsHeading?: string
  termsHeading?: string
  /** Label before amount, e.g. "Total"; colon and space added before currency */
  totalLabel?: string
  /** Top-right logo on acceptance document */
  headerBrand?: EstimateAcceptHeaderBrand | null
}

export default function EstimateCustomerDocument({
  title,
  forLine = null,
  validUntil,
  lineItemsSnapshot,
  termsSnapshot,
  totalCents,
  previewBanner,
  titleFallback = 'Estimate',
  validThroughPrefix = 'Expires on: ',
  lineItemsHeading = 'Line items',
  termsHeading = 'Terms',
  totalLabel = 'Total',
  headerBrand = null,
}: EstimateCustomerDocumentProps) {
  const lines = estimatePublicLineItems(lineItemsSnapshot)
  const termsBody = (termsSnapshot ?? '').trim()
  const docMetaRowStyle = {
    margin: '0.5rem 0 0',
    fontSize: '0.9rem',
    color: '#374151',
  } as const
  const expiryLabel = validThroughPrefix.trimEnd()

  return (
    <>
      {previewBanner ? (
        <div style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#6b7280', background: '#f9fafb', padding: '0.5rem 0.75rem', borderRadius: 6 }}>
          {previewBanner}
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
          marginTop: 0,
        }}
      >
        <h1 style={{ margin: 0, flex: '1 1 12rem', minWidth: 0 }}>{title || titleFallback}</h1>
        {headerBrand ? (
          <div
            style={{
              width: 140,
              height: 56,
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            <img
              src={acceptHeaderBrandImageSrc(headerBrand)}
              alt={acceptHeaderBrandLabel(headerBrand)}
              width={140}
              height={56}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
        ) : null}
      </div>
      <p style={docMetaRowStyle}>
        <strong>For:</strong> {forLine?.trim() ? forLine.trim() : '—'}
      </p>
      {validUntil ? (
        <p style={docMetaRowStyle}>
          {expiryLabel ? (
            <>
              <strong>{expiryLabel}</strong> {formatValidUntilForDisplay(validUntil)}
            </>
          ) : (
            <>
              {validThroughPrefix}
              {formatValidUntilForDisplay(validUntil)}
            </>
          )}
        </p>
      ) : null}

      <section style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem' }}>{lineItemsHeading}</h2>
        <ul style={{ paddingLeft: '1.25rem' }}>
          {lines.length === 0 ? (
            <li>—</li>
          ) : (
            lines.map((row, i) => (
              <li key={i} style={{ marginBottom: '0.35rem' }}>
                {(row.description ?? '').trim() || 'Item'} — {formatMoney(Number(row.amount_cents ?? 0))}
              </li>
            ))
          )}
        </ul>
        <p style={{ fontWeight: 600, textAlign: 'right', width: '100%' }}>
          {totalLabel}: {formatMoney(totalCents)}
        </p>
      </section>

      {termsBody ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>{termsHeading}</h2>
          <div
            style={{
              whiteSpace: 'pre-wrap',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '1rem',
              fontSize: '0.9rem',
            }}
          >
            {termsBody}
          </div>
        </section>
      ) : null}
    </>
  )
}
