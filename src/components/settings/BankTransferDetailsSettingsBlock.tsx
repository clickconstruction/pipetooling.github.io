/**
 * Settings → Company → Bank transfer details (v2.3308): where dev and master
 * enter the company's ACH / wire remittance details and the check mailing
 * address. One Supabase row, never a source file — the repo is public. The
 * customer portal's collapsed "Prefer to pay by bank transfer?" card and the
 * Accounts Receivable modal's panel both read this row. Self-contained
 * (loads/saves its own row) like OfficeAddressSettingsBlock.
 */
import { useCallback, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { fetchCompanyBankTransferDetails, saveCompanyBankTransferDetails } from '../../lib/companyBankTransferDetails'
import {
  bankTransferDetailsComplete,
  EMPTY_BANK_TRANSFER_DETAILS,
  routingNumberProblem,
  type BankTransferDetails,
} from '../../lib/bankTransferDetails'

const fieldStyle = { width: '100%', boxSizing: 'border-box' as const, padding: '0.45rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: '0.875rem' }
const labelStyle = { display: 'block', fontWeight: 600, fontSize: '0.8125rem', marginBottom: 4 }

type FieldKey = Exclude<keyof BankTransferDetails, 'showOnPortal'>

const FIELDS: Array<{ key: FieldKey; label: string; hint?: string; wide?: boolean; mono?: boolean }> = [
  { key: 'payeeName', label: 'Pay to (beneficiary name)', hint: 'The legal name on the account, exactly as the bank has it.' },
  { key: 'accountKind', label: 'Account kind', hint: 'Checking, usually.' },
  { key: 'routingNumber', label: 'Routing number (ABA)', mono: true },
  { key: 'accountNumber', label: 'Account number', mono: true },
  { key: 'bankName', label: 'Bank name', hint: "The receiving bank's name — for a Mercury account, the partner bank." },
  { key: 'bankNote', label: 'Note under the bank name', hint: 'e.g. "Your bank may show this name instead of ours — that is correct."', wide: true },
  { key: 'beneficiaryAddress', label: 'Beneficiary address', hint: 'The address the bank has on the account (some wire forms require it).', wide: true },
  { key: 'checkMailingAddress', label: 'Where checks must be mailed', hint: 'The statement reads "Checks can only be received at … Checks mailed anywhere else need to be re-issued." Leave blank to hide the checks box.', wide: true },
]

export default function BankTransferDetailsSettingsBlock() {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<BankTransferDetails>(EMPTY_BANK_TRANSFER_DETAILS)

  const loadFromServer = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetchCompanyBankTransferDetails()
      setDraft(d ?? EMPTY_BANK_TRANSFER_DETAILS)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load the bank transfer details'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const routingProblem = routingNumberProblem(draft.routingNumber)
  const complete = bankTransferDetailsComplete(draft)

  const save = async () => {
    if (routingProblem) {
      showToast(routingProblem, 'warning')
      return
    }
    setSaving(true)
    try {
      await saveCompanyBankTransferDetails(draft, user?.id ?? null)
      showToast(
        complete.transfer || complete.checks
          ? draft.showOnPortal
            ? 'Saved. Customers see "Prefer to pay by bank transfer?" on their statement.'
            : 'Saved. The statement card is off until you turn it on.'
          : 'Saved. Nothing shows to customers until the payee, routing and account are filled, or a check address is set.',
        'success',
      )
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the bank transfer details'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginBottom: '1.5rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => {
            const next = !prev
            if (next) void loadFromServer()
            return next
          })
        }}
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', margin: 0, padding: '1rem', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, textAlign: 'left' }}
      >
        <span style={{ fontSize: '0.75rem' }}>{open ? '▼' : '▶'}</span>
        Bank transfer details (ACH · wire · where checks go)
      </button>
      {open ? (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-page)' }}>
          <p style={{ margin: '0.75rem 0', color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5 }}>
            What a customer sees when they open <strong>Prefer to pay by bank transfer?</strong> on their statement page, and what the office reads in
            the Accounts Receivable modal. Stored in the database only — never in the app's source — and readable by office roles. A
            routing and account number is what is printed on every paper check; keep the receiving account swept and the guard line does the rest.
          </p>
          {loading ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem 1rem' }}>
                {FIELDS.map((f) => (
                  <div key={f.key} style={f.wide ? { gridColumn: '1 / -1' } : undefined}>
                    <label htmlFor={`bank-transfer-${f.key}`} style={labelStyle}>
                      {f.label}
                    </label>
                    <input
                      id={`bank-transfer-${f.key}`}
                      value={draft[f.key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                      inputMode={f.mono ? 'numeric' : undefined}
                      autoComplete="off"
                      style={{ ...fieldStyle, fontFamily: f.mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined }}
                    />
                    {f.key === 'routingNumber' && routingProblem ? (
                      <div style={{ color: '#b42318', fontSize: '0.75rem', marginTop: 3 }}>{routingProblem}</div>
                    ) : f.hint ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 3 }}>{f.hint}</div>
                    ) : null}
                  </div>
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.9rem', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={draft.showOnPortal} onChange={(e) => setDraft((d) => ({ ...d, showOnPortal: e.target.checked }))} />
                Show on the customer statement page
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.9rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {complete.transfer ? 'Transfer details complete.' : 'Transfer details need the payee, routing and account.'}{' '}
                  {complete.checks ? 'Checks line on.' : 'No checks line.'}
                </span>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
