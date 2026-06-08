import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import {
  buildBidPricingPackageEmailHtml,
  buildBidPricingPackageExternalRows,
  buildBidPricingPackagePlainText,
  buildBidPricingPackageTableHtml,
  packageRowRevenueTotalCents,
  type PackageRowInput,
} from '../../lib/buildBidPricingPackageHtml'
import { buildBidPricingPackageSmsText } from '../../lib/buildBidPricingPackageSmsText'
import { buildBidPackageMailtoUrl } from '../../lib/bidPackageMailto'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { pickMasterTechRecipients } from '../../lib/packageSendMasterTechRecipients'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { BidWithBuilder, EstimatorUser } from '../../types/bidWithBuilder'
import {
  type LedgerPrefixMap,
  formatBidLedgerNumberLabel,
  resolveBidLedgerPrefix,
} from '../../lib/ledgerDisplayPrefixes'

const MODAL_Z = 10050

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: MODAL_Z,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '1.5rem 1rem',
  overflowY: 'auto',
}

const panel: CSSProperties = {
  background: 'white',
  borderRadius: 8,
  maxWidth: 720,
  width: '100%',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  padding: '1.25rem 1.25rem 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
}

const sectionStyle: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  padding: '0.75rem 1rem',
  background: '#fafafa',
}

const sectionLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.04em',
  color: '#6b7280',
  textTransform: 'uppercase',
  marginBottom: '0.5rem',
}

const previewWrapStyle: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  padding: '0.5rem',
  maxHeight: 320,
  overflowY: 'auto',
  background: 'white',
}

export type PackageAndSendPricingRowInput = PackageRowInput

export type PackageAndSendBidPricingModalProps = {
  open: boolean
  onClose: () => void
  bid: BidWithBuilder
  priceBookVersionId: string
  priceBookVersionName: string
  pricingRows: ReadonlyArray<PackageAndSendPricingRowInput>
  totalRevenue: number
  estimatorUsers: ReadonlyArray<EstimatorUser>
  prefixMap: LedgerPrefixMap
  currentUserName: string | null
  onRequestEditBid: () => void
}

type SendState =
  | { kind: 'idle' }
  | { kind: 'mailto'; running: boolean }
  | { kind: 'resend'; running: boolean }
  | { kind: 'sms'; running: boolean }

function bidPackageLabel(bid: BidWithBuilder, prefixMap: LedgerPrefixMap): string {
  const name = (bid.project_name ?? '').trim() || 'Bid'
  const num = bid.bid_number?.trim()
  if (num) {
    const numbered = formatBidLedgerNumberLabel(
      resolveBidLedgerPrefix(bid.service_type_id, prefixMap),
      num,
    )
    return `${numbered} ${name}`
  }
  return name
}

function recipientOptionLabel(u: EstimatorUser): string {
  const name = (u.name ?? '').trim()
  const email = (u.email ?? '').trim()
  if (name && email) return `${name} · ${email}`
  if (email) return email
  if (name) return name
  return '—'
}

function chipLabelForUser(u: EstimatorUser): string {
  const fullName = (u.name ?? '').trim()
  if (fullName) {
    const firstName = fullName.split(/\s+/)[0]
    return firstName || fullName
  }
  const email = (u.email ?? '').trim()
  if (email) {
    const at = email.indexOf('@')
    return at > 0 ? email.slice(0, at) : email
  }
  return '—'
}

async function copyTableHtmlToClipboard(html: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  const clipboard = navigator.clipboard as
    | (Clipboard & { write?: (data: ClipboardItem[]) => Promise<void> })
    | undefined
  if (!clipboard) return false
  try {
    if (typeof window !== 'undefined' && typeof window.ClipboardItem !== 'undefined' && clipboard.write) {
      const item = new window.ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([html], { type: 'text/plain' }),
      })
      await clipboard.write([item])
      return true
    }
    await clipboard.writeText(html)
    return true
  } catch {
    return false
  }
}

export function PackageAndSendBidPricingModal({
  open,
  onClose,
  bid,
  priceBookVersionId,
  priceBookVersionName,
  pricingRows,
  totalRevenue,
  estimatorUsers,
  prefixMap,
  currentUserName,
  onRequestEditBid,
}: PackageAndSendBidPricingModalProps) {
  const [recipientUserId, setRecipientUserId] = useState<string>('')
  const [sendState, setSendState] = useState<SendState>({ kind: 'idle' })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const masterTechRecipients = useMemo(
    () => pickMasterTechRecipients(estimatorUsers),
    [estimatorUsers],
  )

  useEffect(() => {
    if (!open) return
    const loneMasterTech =
      masterTechRecipients.length === 1 ? masterTechRecipients[0] : null
    setRecipientUserId(loneMasterTech ? loneMasterTech.id : '')
    setSendState({ kind: 'idle' })
    setErrorMessage(null)
    setSuccessMessage(null)
  }, [open, masterTechRecipients])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  const bidLabel = useMemo(() => bidPackageLabel(bid, prefixMap), [bid, prefixMap])
  const plansLink = useMemo(() => {
    const v = (bid.plans_link ?? '').trim()
    return v.length > 0 ? v : null
  }, [bid.plans_link])
  const countToolingPlansLink = useMemo(() => {
    const v = (bid.count_tooling_plans_link ?? '').trim()
    return v.length > 0 ? v : null
  }, [bid.count_tooling_plans_link])

  const externalRows = useMemo(
    () => buildBidPricingPackageExternalRows(pricingRows),
    [pricingRows],
  )
  const tableHtml = useMemo(
    () => buildBidPricingPackageTableHtml({ externalRows, totalRevenue }),
    [externalRows, totalRevenue],
  )
  const plainTextBody = useMemo(
    () =>
      buildBidPricingPackagePlainText({
        externalRows,
        totalRevenue,
        bidLabel,
        plansLink,
        countToolingPlansLink,
      }),
    [externalRows, totalRevenue, bidLabel, plansLink, countToolingPlansLink],
  )
  const smsText = useMemo(
    () =>
      buildBidPricingPackageSmsText({
        bidLabel,
        plansLink,
        countToolingPlansLink,
        externalRows,
        totalRevenue,
      }),
    [bidLabel, plansLink, countToolingPlansLink, externalRows, totalRevenue],
  )
  const emailHtml = useMemo(
    () =>
      buildBidPricingPackageEmailHtml({
        bidLabel,
        plansLink,
        countToolingPlansLink,
        tableHtml,
        senderName: currentUserName,
      }),
    [bidLabel, plansLink, countToolingPlansLink, tableHtml, currentUserName],
  )

  const recipientOptions: SearchableSelectOption[] = useMemo(() => {
    return estimatorUsers
      .filter((u) => (u.email ?? '').trim().length > 0)
      .map((u) => ({ value: u.id, label: recipientOptionLabel(u) }))
  }, [estimatorUsers])

  const selectedRecipient = useMemo(
    () => estimatorUsers.find((u) => u.id === recipientUserId) ?? null,
    [estimatorUsers, recipientUserId],
  )
  const selectedRecipientEmail = (selectedRecipient?.email ?? '').trim()

  const blockedNoPlans = plansLink == null
  const blockedNoRows = externalRows.length === 0
  const blockedNoRecipient = selectedRecipientEmail.length === 0
  const sending = sendState.kind !== 'idle' && (sendState.kind === 'mailto' || sendState.kind === 'resend') && sendState.running

  const sendDisabledBase = blockedNoPlans || blockedNoRows || blockedNoRecipient || sending
  const disabledReason = blockedNoRows
    ? 'No fixtures to send — every row is hidden or has count 0.'
    : blockedNoPlans
      ? 'Add a Job Plans URL to this bid before sending.'
      : blockedNoRecipient
        ? 'Pick a recipient with an email on file.'
        : null

  const copyForTextRunning = sendState.kind === 'sms' && sendState.running
  const copyForTextDisabled = blockedNoRows || copyForTextRunning
  const copyForTextDisabledReason = blockedNoRows
    ? 'No fixtures to copy — every row is hidden or has count 0.'
    : null

  async function logMailtoAttempt(): Promise<void> {
    if (!selectedRecipient || !priceBookVersionId) return
    const revenueCents = packageRowRevenueTotalCents(externalRows)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.rpc('log_bid_pricing_package_send', {
            p_bid_id: bid.id,
            p_price_book_version_id: priceBookVersionId,
            p_recipient_user_id: selectedRecipient.id,
            p_recipient_email: selectedRecipientEmail,
            p_revenue_total_cents: revenueCents,
            p_row_count: externalRows.length,
            p_plans_link: plansLink ?? '',
          }),
        'log bid pricing package mailto send',
      )
    } catch {
      // Logging is best-effort; the user already opened their mail client.
    }
  }

  async function handleCopyForText(): Promise<void> {
    if (copyForTextDisabled) return
    setErrorMessage(null)
    setSuccessMessage(null)
    setSendState({ kind: 'sms', running: true })
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        throw new Error('Clipboard unavailable in this browser.')
      }
      await navigator.clipboard.writeText(smsText)
      setSuccessMessage('Text copied to clipboard — paste into your text app.')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not copy to clipboard.')
    } finally {
      setSendState({ kind: 'idle' })
    }
  }

  async function handleSendViaMyMail(): Promise<void> {
    if (sendDisabledBase || !selectedRecipient) return
    setErrorMessage(null)
    setSuccessMessage(null)
    setSendState({ kind: 'mailto', running: true })
    try {
      const mailtoUrl = buildBidPackageMailtoUrl({
        recipientEmail: selectedRecipientEmail,
        bidLabel,
        plainTextBody,
      })
      const copied = await copyTableHtmlToClipboard(tableHtml)
      openInExternalBrowser(mailtoUrl)
      await logMailtoAttempt()
      setSuccessMessage(
        copied
          ? 'Mail draft opened — table copied to clipboard, paste into the email.'
          : 'Mail draft opened. (Could not auto-copy the table to your clipboard.)',
      )
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not open mail client.')
    } finally {
      setSendState({ kind: 'idle' })
    }
  }

  async function handleSendForMe(): Promise<void> {
    if (sendDisabledBase || !selectedRecipient) return
    setErrorMessage(null)
    setSuccessMessage(null)
    setSendState({ kind: 'resend', running: true })
    try {
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean
        error?: string
        resend_id?: string
      }>('send-bid-pricing-package', {
        body: {
          bid_id: bid.id,
          price_book_version_id: priceBookVersionId,
          recipient_user_id: selectedRecipient.id,
        },
      })
      if (error) {
        setErrorMessage(error.message || 'Send failed.')
        return
      }
      if (!data?.ok) {
        setErrorMessage(data?.error || 'Send failed.')
        return
      }
      setSuccessMessage(`Sent to ${recipientOptionLabel(selectedRecipient)}.`)
      window.setTimeout(() => {
        onClose()
      }, 900)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Send failed.')
    } finally {
      setSendState({ kind: 'idle' })
    }
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      style={overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Package and send pricing for ${bidLabel}`}
        style={panel}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>Package and send</h2>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
              {bidLabel}
              {priceBookVersionName ? ` · ${priceBookVersionName}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              lineHeight: 1,
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0.25rem 0.5rem',
            }}
          >
            ×
          </button>
        </div>

        <div style={sectionStyle}>
          <p style={sectionLabelStyle}>Job plans</p>
          {plansLink ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => openInExternalBrowser(plansLink)}
                style={{
                  padding: '0.4rem 0.75rem',
                  background: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Open plans
              </button>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  wordBreak: 'break-all',
                  overflowWrap: 'anywhere',
                }}
              >
                {plansLink}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: '#92400e', fontSize: '0.875rem' }}>
                No job plans URL on this bid.
              </span>
              <button
                type="button"
                onClick={onRequestEditBid}
                style={{
                  padding: '0.35rem 0.75rem',
                  background: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  color: '#111827',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                }}
              >
                Edit bid
              </button>
            </div>
          )}
        </div>

        <div style={sectionStyle}>
          <p style={sectionLabelStyle}>CountTooling Plans</p>
          {countToolingPlansLink ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => openInExternalBrowser(countToolingPlansLink)}
                style={{
                  padding: '0.4rem 0.75rem',
                  background: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Open takeoff
              </button>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  wordBreak: 'break-all',
                  overflowWrap: 'anywhere',
                }}
              >
                {countToolingPlansLink}
              </span>
            </div>
          ) : (
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              No CountTooling Plans link on this bid.
            </span>
          )}
        </div>

        <div style={sectionStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '0.5rem',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <p style={{ ...sectionLabelStyle, marginBottom: 0 }}>Pricing preview</p>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {externalRows.length} {externalRows.length === 1 ? 'row' : 'rows'}
              {' · '}includes the four columns the recipient will see
            </span>
          </div>
          <div
            className="package-send-preview"
            style={previewWrapStyle}
            // eslint-disable-next-line react/no-danger -- app-generated pricing-table HTML; values are escaped by the tested buildBidPricingPackageTableHtml builder
            dangerouslySetInnerHTML={{ __html: tableHtml }}
          />
        </div>

        <div style={sectionStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
              marginBottom: '0.5rem',
            }}
          >
            <p style={{ ...sectionLabelStyle, marginBottom: 0 }}>Send to</p>
            {masterTechRecipients.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.35rem',
                  justifyContent: 'flex-end',
                }}
                aria-label="Master technician quick picks"
              >
                {masterTechRecipients.map((mt) => {
                  const selected = recipientUserId === mt.id
                  const full = recipientOptionLabel(mt)
                  return (
                    <button
                      key={mt.id}
                      type="button"
                      onClick={() => setRecipientUserId(mt.id)}
                      title={full}
                      aria-label={`Send to ${full}`}
                      aria-pressed={selected}
                      style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: 999,
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        border: selected ? '1px solid #2563eb' : '1px solid #d1d5db',
                        background: selected ? '#2563eb' : 'white',
                        color: selected ? 'white' : '#111827',
                        lineHeight: 1.2,
                      }}
                    >
                      {chipLabelForUser(mt)}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
          <SearchableSelect
            value={recipientUserId}
            onChange={(v) => setRecipientUserId(v)}
            options={recipientOptions}
            emptyOption={{ value: '', label: '— Pick a user —' }}
            placeholder="Pick a user"
            searchable
            listAriaLabel="Recipient"
            listMaxHeightPx={240}
            portalZIndex={MODAL_Z + 10}
          />
          {disabledReason ? (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: '#92400e' }}>
              {disabledReason}
            </p>
          ) : null}
          {errorMessage ? (
            <p
              style={{
                margin: '0.5rem 0 0',
                padding: '0.5rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 4,
                fontSize: '0.8125rem',
                color: '#991b1b',
              }}
            >
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? (
            <p
              style={{
                margin: '0.5rem 0 0',
                padding: '0.5rem',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 4,
                fontSize: '0.8125rem',
                color: '#065f46',
              }}
            >
              {successMessage}
            </p>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => void handleSendForMe()}
            disabled={sendDisabledBase}
            title={
              sendDisabledBase && disabledReason
                ? disabledReason
                : 'Send the email now from PipeTooling.'
            }
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: 4,
              background: sendDisabledBase ? '#9ca3af' : '#2563eb',
              color: 'white',
              cursor: sendDisabledBase ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {sendState.kind === 'resend' && sendState.running ? 'Sending…' : 'Send for me'}
          </button>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              marginLeft: 'auto',
            }}
          >
            <button
              type="button"
              onClick={() => void handleCopyForText()}
              disabled={copyForTextDisabled}
              title={
                copyForTextDisabled && copyForTextDisabledReason
                  ? copyForTextDisabledReason
                  : 'Copy an SMS-friendly summary to your clipboard so you can paste it into a text.'
              }
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: copyForTextDisabled ? '#e5e7eb' : '#f3f4f6',
                color: copyForTextDisabled ? '#9ca3af' : '#111827',
                cursor: copyForTextDisabled ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {copyForTextRunning ? 'Copying…' : 'Copy for text'}
            </button>
            <button
              type="button"
              onClick={() => void handleSendViaMyMail()}
              disabled={sendDisabledBase}
              title={
                sendDisabledBase && disabledReason
                  ? disabledReason
                  : 'Open your mail client with the link in the body; the table is copied to your clipboard.'
              }
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: sendDisabledBase ? '#e5e7eb' : '#f3f4f6',
                color: sendDisabledBase ? '#9ca3af' : '#111827',
                cursor: sendDisabledBase ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {sendState.kind === 'mailto' && sendState.running ? 'Opening…' : 'Send via my mail'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Preview-only HTML for screen-reader / debugging context; not shown */}
        <span hidden aria-hidden data-debug-email-html={emailHtml.length} />
      </div>
    </div>,
    document.body,
  )
}
