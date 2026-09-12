/**
 * The company's bank transfer details for the office (v2.3308) — the same
 * record the portal card shows, in the app's own theme, so whoever is on the
 * phone with a customer in the Accounts Receivable modal can read the
 * routing and account number off the screen or copy them into a reply.
 * Loads when opened; a role the RLS refuses, or an empty row, reads as
 * "not entered yet" with the Settings door.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompanyBankTransferDetails } from '../../hooks/useCompanyBankTransferDetails'
import {
  bankTransferDetailsComplete,
  bankTransferGuardLine,
  checkMailingSentence,
  groupDigits,
} from '../../lib/bankTransferDetails'

function CopyChip({ value }: { value: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      aria-label={`Copy ${value}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        } catch {
          /* clipboard blocked — the value is on screen */
        }
      }}
      style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, cursor: 'pointer' }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

export type BankTransferDetailsPanelProps = {
  open: boolean
  /** Office phone for the guard line (the same one the portal prints). */
  phone: string
  canEdit: boolean
}

export default function BankTransferDetailsPanel({ open, phone, canEdit }: BankTransferDetailsPanelProps) {
  const { details, loading, error } = useCompanyBankTransferDetails(open)
  if (!open) return null
  const c = bankTransferDetailsComplete(details)
  const checks = details ? checkMailingSentence(details.checkMailingAddress) : null
  const settingsDoor = canEdit ? (
    <Link to="/settings?tab=settings-company" style={{ color: 'var(--text-link)', fontWeight: 600 }}>
      Settings → Company
    </Link>
  ) : (
    <span>a master or dev can enter them at Settings → Company</span>
  )
  const k = { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--text-muted)', whiteSpace: 'nowrap' as const }
  const v = { fontVariantNumeric: 'tabular-nums' as const, fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' as const }
  return (
    <div data-testid="ar-bank-transfer-panel" style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-page)', fontSize: '0.8125rem' }}>
      {loading ? (
        <span style={{ color: 'var(--text-muted)' }}>Loading the bank transfer details…</span>
      ) : error ? (
        <span style={{ color: 'var(--text-muted)' }}>{error}</span>
      ) : !c.transfer && !c.checks ? (
        <span style={{ color: 'var(--text-muted)' }}>No bank transfer details entered yet — {settingsDoor}.</span>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.5rem 1.5rem' }}>
          {c.transfer && details ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.3rem 0.75rem', alignItems: 'center' }}>
              <span style={k}>Pay to</span><span style={v}>{details.payeeName}</span><CopyChip value={details.payeeName} />
              <span style={k}>Routing</span><span style={v}>{groupDigits(details.routingNumber)}</span><CopyChip value={details.routingNumber} />
              <span style={k}>Account</span><span style={v}>{groupDigits(details.accountNumber)} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {details.accountKind}</span></span><CopyChip value={details.accountNumber} />
              {details.bankName ? (<><span style={k}>Bank</span><span style={{ ...v, fontWeight: 500 }}>{details.bankName}{details.bankNote ? <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{details.bankNote}</span> : null}</span><span /></>) : null}
              {details.beneficiaryAddress ? (<><span style={k}>Address</span><span style={{ ...v, fontWeight: 400 }}>{details.beneficiaryAddress} <span style={{ color: 'var(--text-muted)' }}>· for bank ACH and wires, not for mail</span></span><span /></>) : null}
            </div>
          ) : <span />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', color: 'var(--text-muted)' }}>
            {checks ? <div><span style={{ ...k, marginRight: 6 }}>Checks</span><span style={{ color: 'var(--text)' }}>{checks}</span></div> : null}
            <div style={{ fontSize: '0.75rem' }}>{bankTransferGuardLine(phone)}</div>
            <div style={{ fontSize: '0.75rem' }}>
              Customers see this block on their statement page{details?.showOnPortal === false ? ' — currently turned off' : ''}. Edit at {settingsDoor}.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
