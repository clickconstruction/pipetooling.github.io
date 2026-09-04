import { Fragment, type ReactNode } from 'react'
import { formatValidUntilForDisplay } from '../../lib/formatEstimateValidUntilDisplay'
import type { EstimateAcceptHeaderBrand } from '../../lib/estimateAcceptHeaderBrand'
import { acceptHeaderBrandImageSrc, acceptHeaderBrandLabel } from '../../lib/estimateAcceptHeaderBrand'
import {
  normalizeEstimateLineItemsFromJson,
  type EstimateLineItemNormalized,
} from '../../lib/estimateLineItemNormalize'
import {
  changeOrderDocDisplayTitle,
  formatSignedCentsUsd,
  type EstimateChangeOrderFields,
} from '../../lib/estimateChangeOrder'

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

/**
 * Phone layout for the lines (v2.2772, owner pick B): one block per line — name, description,
 * then "qty × unit" and the amount on one row. The three-column table left the name ~150 px on a
 * 390 px phone, so names wrapped one word per line. Both layouts render; index.css shows one
 * (`.estimate-doc-lines--stack` under 520 px, the table above it and in print).
 */
export function EstimateLineItemsStack({ lines }: { lines: EstimatePublicLineItem[] }) {
  return (
    <div className="estimate-doc-lines--stack" role="list">
      {lines.map((row, i) => {
        const desc = (row.description ?? '').trim()
        const amount = row.amount_cents ?? row.quantity * row.unit_price_cents
        return (
          <div key={i} role="listitem" style={{ padding: '0.55rem 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-strong)' }}>{(row.line_item ?? '').trim() || '—'}</div>
            {desc ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 1 }}>{desc}</div> : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {formatQuantityDisplay(row.quantity)} × {formatMoney(row.unit_price_cents)}
              </span>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-strong)' }}>{formatMoney(amount)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function EstimateLineItemsTable({ lines }: { lines: EstimatePublicLineItem[] }) {
  if (lines.length === 0) {
    return <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>—</p>
  }
  return (
    <div className="estimate-doc-lines--table" style={{ overflowX: 'auto' }}>
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
  /** When set, a 'together with our Terms and Conditions' line links the company terms page under the terms body. */
  termsPageHref?: string | null
  /** Label before amount, e.g. "Total"; colon and space added before currency */
  totalLabel?: string
  /** Top-right logo on acceptance document */
  headerBrand?: EstimateAcceptHeaderBrand | null
  /** CO train (v2.1834): set on change orders — renders the narrative block and signs the money. */
  changeOrder?: EstimateChangeOrderFields | null
  /** Estimate Options (v2.2457): the option picker, slotted between the header block and the line items. */
  beforeLineItems?: ReactNode
  /** v2.2772: the total-first card under the meta rows (the accept page passes it; records and PDFs don't). */
  summary?: ReactNode
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
  termsPageHref = null,
  totalLabel = 'Total',
  headerBrand = null,
  changeOrder = null,
  beforeLineItems = null,
  summary = null,
}: EstimateCustomerDocumentProps) {
  const displayTitle = changeOrder ? changeOrderDocDisplayTitle(title) : title
  const lines = normalizeEstimateLineItemsFromJson(lineItemsSnapshot, { allowNegative: changeOrder != null })
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
    // The document paints its own white paper (v2.2481). Two mirror bugs otherwise: on the
    // public accept page the landing shell's light-on-photo text bled into every element
    // without its own color token (title, option names/prices, headings, total, terms); in
    // the dark-mode app the pinned-light TOKENS resolved dark-on-dark against the host card.
    // A customer document is a white sheet wherever it renders — ground and ink together.
    <div
      data-theme="light"
      style={{ background: 'var(--surface)', color: 'var(--text-strong)', padding: '1rem 1.25rem', borderRadius: 8 }}
    >
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
        <h1 className="estimate-doc-title" style={{ margin: 0, flex: '1 1 12rem', minWidth: 0 }}>{displayTitle || titleFallback}</h1>
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

      {summary}

      {changeOrder ? (
        <section style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-rule)', paddingTop: '1.1rem', fontSize: '0.9rem', color: 'var(--text-700)' }}>
          <h2 style={{ fontSize: '1.1rem' }}>Change order</h2>
          <p style={{ margin: '0.25rem 0', whiteSpace: 'pre-wrap' }}>
            <strong>Description of change:</strong> {changeOrder.description_of_change.trim() || '—'}
          </p>
          <p style={{ margin: '0.25rem 0', whiteSpace: 'pre-wrap' }}>
            <strong>Reason for change:</strong> {changeOrder.reason_for_change.trim() || '—'}
          </p>
          <p style={{ margin: '0.25rem 0' }}>
            <strong>Impact on schedule:</strong> {changeOrder.impact_on_schedule.trim() || '—'}
          </p>
          {changeOrder.response_requested_by.trim() ? (
            <p style={{ margin: '0.25rem 0' }}>
              <strong>Response requested by:</strong> {formatValidUntilForDisplay(changeOrder.response_requested_by)}
            </p>
          ) : null}
        </section>
      ) : null}

      {beforeLineItems}

      <section style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-rule)', paddingTop: '1.1rem' }}>
        <h2 style={{ fontSize: '1.1rem' }}>{lineItemsHeading}</h2>
        <EstimateLineItemsTable lines={lines} />
        {lines.length > 0 ? <EstimateLineItemsStack lines={lines} /> : null}
        <p style={{ fontWeight: 600, textAlign: 'right', width: '100%', marginTop: '0.75rem' }}>
          {totalLabel}: {changeOrder ? formatSignedCentsUsd(totalCents) : formatMoney(totalCents)}
        </p>
      </section>

      {termsBody || termsPageHref ? (
        <section style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-rule)', paddingTop: '1.1rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>{termsHeading}</h2>
          {termsBody ? (
            /* v2.2728: a quiet pull-quote instead of an input-looking box — the
               terms are prose the customer agreed to, not a field. */
            <blockquote
              style={{
                margin: 0,
                padding: '0.15rem 0 0.15rem 1rem',
                borderLeft: '3px solid var(--text-orange-700)',
                whiteSpace: 'pre-wrap',
                fontSize: '0.95rem',
                lineHeight: 1.55,
                color: 'var(--text-strong)',
              }}
            >
              {termsBody}
            </blockquote>
          ) : null}
          {termsPageHref ? (
            <p style={{ margin: termsBody ? '0.75rem 0 0' : 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {termsBody ? 'These apply together with our ' : 'This estimate is subject to our '}
              <a href={termsPageHref} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600 }}>
                Terms and Conditions ↗
              </a>
              .
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
