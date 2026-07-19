import { useEffect, useMemo, useRef, useState } from 'react'
import { parseBankingImportCsv, type BankingImportRow } from '../../lib/parseBankingImportCsv'

export type ImportCsvSubmitPayload = {
  accountName: string
  rows: BankingImportRow[]
}

export type ImportCsvResult = {
  accountId: string
  accountName: string
  inserted: number
  skipped: number
}

export type MercuryImportCsvModalProps = {
  open: boolean
  onClose: () => void
  /** Resolves with the import summary on success; should reject on error so the modal stays open. */
  onSubmit: (payload: ImportCsvSubmitPayload) => Promise<ImportCsvResult>
}

function usd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function amountColor(n: number): string {
  if (n > 0) return '#047857'
  if (n < 0) return '#b91c1c'
  return '#374151'
}

export function MercuryImportCsvModal({ open, onClose, onSubmit }: MercuryImportCsvModalProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [parse, setParse] = useState<ReturnType<typeof parseBankingImportCsv> | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [accountName, setAccountName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [result, setResult] = useState<ImportCsvResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) return
    // Reset on close.
    setFileName(null)
    setParse(null)
    setParseError(null)
    setAccountName('')
    setSubmitting(false)
    setErrorMsg(null)
    setResult(null)
    setDragOver(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, submitting, onClose])

  const ingestFile = (file: File) => {
    setFileName(file.name)
    setErrorMsg(null)
    setResult(null)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '')
        const res = parseBankingImportCsv(text)
        setParse(res)
        setAccountName(res.accountName || file.name.replace(/\.csv$/i, ''))
        setParseError(res.rows.length === 0 ? (res.warnings[0] ?? 'No transactions found in this file.') : null)
      } catch (e) {
        setParse(null)
        setParseError(e instanceof Error ? e.message : 'Could not parse this CSV.')
      }
    }
    reader.onerror = () => setParseError('Could not read the file.')
    reader.readAsText(file)
  }

  const balanceMatch = useMemo(() => {
    if (!parse || parse.endingBalance == null) return null
    return Math.abs(parse.totalAmount - parse.endingBalance) < 0.005
  }, [parse])

  if (!open) return null

  const rows = parse?.rows ?? []
  const canSubmit = !submitting && !result && rows.length > 0 && accountName.trim() !== ''

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const r = await onSubmit({ accountName: accountName.trim(), rows })
      setResult(r)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (submitting) return
    onClose()
  }

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1260,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mercury-import-csv-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          maxWidth: 760,
          width: '100%',
          maxHeight: 'min(92vh, 760px)',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          padding: '1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <h2 id="mercury-import-csv-title" style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700 }}>
          Import transactions (CSV)
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-slate-600)', lineHeight: 1.5 }}>
          Upload a bank/QuickBooks register export for a closed or external account. Rows import as manual transactions
          under a new account that shows in the Ledger and can be labeled, attributed, and allocated like any other.
          Money out becomes a negative amount; re-importing the same rows is de-duplicated.
        </p>

        {/* Drop zone / file picker */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const f = e.dataTransfer.files?.[0]
            if (f) ingestFile(f)
          }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#2563eb' : '#cbd5e1'}`,
            borderRadius: 8,
            padding: '1rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'var(--bg-blue-tint)' : 'var(--bg-slate-tint)',
            fontSize: '0.85rem',
            color: 'var(--text-slate-600)',
          }}
        >
          {fileName ? <strong>{fileName}</strong> : 'Drop a .csv here, or click to choose a file'}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) ingestFile(f)
              e.target.value = ''
            }}
          />
        </div>

        {parseError ? (
          <p
            role="alert"
            style={{ margin: '0.85rem 0 0', padding: '0.5rem 0.75rem', borderRadius: 6, background: 'var(--bg-red-tint)', border: '1px solid #fecaca', color: 'var(--text-red-800)', fontSize: '0.8rem' }}
          >
            {parseError}
          </p>
        ) : null}

        {parse && rows.length > 0 ? (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', fontWeight: 600 }}>
              Account name
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                disabled={submitting || !!result}
                placeholder="e.g. Closed — Old Checking"
                style={{ padding: '0.4rem 0.55rem', borderRadius: 6, border: '1px solid var(--border)', fontWeight: 400 }}
              />
            </label>

            {/* Summary line */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.25rem', fontSize: '0.8rem', color: '#334155' }}>
              <span>
                <strong>{rows.length}</strong> transactions
              </span>
              <span>
                Net: <strong style={{ color: amountColor(parse.totalAmount) }}>{usd(parse.totalAmount)}</strong>
              </span>
              {parse.endingBalance != null ? (
                <span>
                  Ending balance: <strong>{usd(parse.endingBalance)}</strong>{' '}
                  {balanceMatch ? (
                    <span style={{ color: '#047857', fontWeight: 600 }}>✓ matches</span>
                  ) : (
                    <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}>⚠ differs by {usd(parse.totalAmount - (parse.endingBalance ?? 0))}</span>
                  )}
                </span>
              ) : null}
            </div>

            {parse.warnings.length > 0 ? (
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-slate-500)' }}>{parse.warnings.join(' ')}</p>
            ) : null}

            {/* Preview table */}
            <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: 'var(--bg-slate-100)' }}>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Payee</th>
                    <th style={thStyle}>Memo</th>
                    <th style={thStyle}>Category</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={tdStyle}>{r.postedDate}</td>
                      <td style={tdStyle}>{r.payee ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                      <td style={{ ...tdStyle, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.memo ?? ''}
                      </td>
                      <td style={tdStyle}>{r.category ?? ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: amountColor(r.amount), fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {usd(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {result ? (
          <p
            role="status"
            style={{ margin: '0.85rem 0 0', padding: '0.5rem 0.75rem', borderRadius: 6, background: 'var(--bg-emerald-tint)', border: '1px solid #a7f3d0', color: 'var(--text-emerald-800)', fontSize: '0.82rem' }}
          >
            Imported <strong>{result.inserted}</strong> transaction(s) into <strong>{result.accountName}</strong>
            {result.skipped > 0 ? ` (${result.skipped} duplicate(s) skipped)` : ''}. They now appear in the Banking Ledger.
          </p>
        ) : null}

        {errorMsg ? (
          <p
            role="alert"
            style={{ margin: '0.85rem 0 0', padding: '0.5rem 0.75rem', borderRadius: 6, background: 'var(--bg-red-tint)', border: '1px solid #fecaca', color: 'var(--text-red-800)', fontSize: '0.8rem' }}
          >
            {errorMsg}
          </p>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            style={{ padding: '0.5rem 1rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border)', borderRadius: 6, cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 500 }}
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result ? (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              style={{ padding: '0.5rem 1rem', background: canSubmit ? '#2563eb' : '#94a3b8', color: 'white', border: 'none', borderRadius: 6, cursor: canSubmit ? 'pointer' : 'not-allowed', fontWeight: 600 }}
            >
              {submitting ? 'Importing…' : `Import ${rows.length || ''} transaction${rows.length === 1 ? '' : 's'}`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.4rem 0.55rem',
  fontWeight: 600,
  color: 'var(--text-slate-600)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '0.35rem 0.55rem',
  color: 'var(--text-gray-800)',
}
