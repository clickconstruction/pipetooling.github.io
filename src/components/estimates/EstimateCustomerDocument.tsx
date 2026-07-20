import { Fragment, type ReactNode } from 'react'
import { formatValidUntilForDisplay } from '../../lib/formatEstimateValidUntilDisplay'
import type { EstimateAcceptHeaderBrand } from '../../lib/estimateAcceptHeaderBrand'
import { acceptHeaderBrandImageSrc, acceptHeaderBrandLabel } from '../../lib/estimateAcceptHeaderBrand'
import {
  normalizeEstimateLineItemsFromJson,
  type EstimateLineItemNormalized,
} from '../../lib/estimateLineItemNormalize'

export type EstimatePublicLineItem = EstimateLineItemNormalized

export function estimatePublicLineItems(raw: unknown): EstimatePublicLineItem[] {
  return normalizeEstimateLineItemsFromJson(raw)
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function formatQuantityDisplay(q: number): string {
  if (Number.isInteger(q)) return String(q)
  return String(q)
}

const lineTableThStyle = {
  textAlign: 'left' as const,
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--text-700)',
  padding: '0.35rem 0.5rem',
  borderBottom: '1px solid var(--border)',
}

const lineTableTdStyle = {
  fontSize: '0.875rem',
  color: 'var(--text-700)',
  padding: '0.4rem 0.5rem',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top' as const,
}

const lineTableTdMainBeforeDescStyle = {
  ...lineTableTdStyle,
  borderBottom: 'none',
  paddingBottom: '0.15rem',
}

const lineTableTdDescStyle = {
  fontSize: '0.8125rem',
  color: 'var(--text-muted)',
  padding: '0 0.5rem 0.4rem',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top' as const,
}

const srOnlyStyle = {
  position: 'absolute' as const,
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden' as const,
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap' as const,
  border: 0,
}

export function EstimateLineItemsTable({ lines }: { lines: EstimatePublicLineItem[] }) {
  if (lines.length === 0) {
    return <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>—</p>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.875rem',
        }}
      >
        <thead>
          <tr>
            <th style={lineTableThStyle}>Line item</th>
            <th style={{ ...lineTableThStyle, width: '4.5rem' }}>Count</th>
            <th style={{ ...lineTableThStyle, width: '6.5rem' }}>Unit price</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((row, i) => {
            const desc = (row.description ?? '').trim()
            const mainStyle = desc ? lineTableTdMainBeforeDescStyle : lineTableTdStyle
            return (
              <Fragment key={i}>
                <tr>
                  <td style={mainStyle}>{(row.line_item ?? '').trim() || '—'}</td>
                  <td style={{ ...mainStyle, fontVariantNumeric: 'tabular-nums' }}>
                    {formatQuantityDisplay(row.quantity)}
                  </td>
                  <td style={{ ...mainStyle, fontVariantNumeric: 'tabular-nums' }}>
                    {formatMoney(row.unit_price_cents)}
                  </td>
                </tr>
                {desc ? (
                  <tr>
                    <td colSpan={3} style={lineTableTdDescStyle}>
                      <span style={srOnlyStyle}>Description: </span>
                      {desc}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
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
    color: 'var(--text-700)',
  } as const
  const expiryLabel = validThroughPrefix.trimEnd()

  return (
    // Customer-facing document: pinned light so it matches what the customer
    // receives regardless of the viewer's theme (see index.css theme tokens).
    <div data-theme="light">
      {previewBanner ? (
        <div style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '0.5rem 0.75rem', borderRadius: 6 }}>
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
        <EstimateLineItemsTable lines={lines} />
        <p style={{ fontWeight: 600, textAlign: 'right', width: '100%', marginTop: '0.75rem' }}>
          {totalLabel}: {formatMoney(totalCents)}
        </p>
      </section>

      {termsBody ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>{termsHeading}</h2>
          <div
            style={{
              whiteSpace: 'pre-wrap',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '1rem',
              fontSize: '0.9rem',
            }}
          >
            {termsBody}
          </div>
        </section>
      ) : null}
    </div>
  )
}
