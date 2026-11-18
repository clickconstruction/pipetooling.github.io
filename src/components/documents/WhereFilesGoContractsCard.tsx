/**
 * Documents → Where files go, the Signed contracts card (punch list #377, PR 5): where each signed job contract's copy
 * in Google Drive stands, and one press that files what is ready. The counts are `contractDriveCounts` over the signed
 * papers, the press says its count through `batchWords`, and a held paper is listed with its reason and the door to its
 * job, where the Contract window holds the press for that one paper. The app files them by itself every ten minutes;
 * the press is for someone who does not want to wait.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import {
  CONTRACTS_ALL_FILED_WORDS,
  CONTRACTS_CARD_WORDS,
  CONTRACTS_NONE_SIGNED_WORDS,
  CONTRACT_HOLD_WORDS,
  contractDriveCounts,
  contractHoldDoor,
  contractsHeldLine,
  fileContractsOutcome,
  fileContractsWords,
  type ContractDriveHoldKind,
} from '../../lib/jobs/jobContractDrive'
import { fileSignedContractsInDrive, readSignedContractsForDrive, type ContractForDrive } from '../../lib/documents/whereFilesGoContractsIo'

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 8, alignContent: 'start', minWidth: 0 }
const cardH: CSSProperties = { margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-strong)', lineHeight: 1.25 }
const muted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const words: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-700)' }
const chip: CSSProperties = { display: 'inline-block', fontSize: '0.72rem', fontWeight: 600, padding: '1px 8px', borderRadius: 999, whiteSpace: 'nowrap', background: 'var(--bg-muted)', color: 'var(--text-700)' }
const chipGreen: CSSProperties = { ...chip, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }
const chipAmber: CSSProperties = { ...chip, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
const press: CSSProperties = { padding: '0.4rem 0.8rem', background: '#2563eb', color: 'white', border: '1px solid #2563eb', borderRadius: 8, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }
const pressDead: CSSProperties = { ...press, background: DEAD_PRESS_FILL, borderColor: 'var(--border-strong)', color: DEAD_PRESS_TEXT, cursor: 'default' }
const door: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)', whiteSpace: 'nowrap' }

/** *972 · Oak Hollow Bldg C*, the desk's shape; the customer when the job has neither. */
function jobLabelOf(c: ContractForDrive): string {
  const label = [(c.job?.hcp_number ?? '').trim(), (c.job?.job_name ?? '').trim()].filter(Boolean).join(' · ')
  return label || (c.job?.customer_name ?? '').trim() || 'A job'
}

export default function WhereFilesGoContractsCard() {
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<ContractForDrive[] | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(false)
  const [filing, setFiling] = useState<{ filed: number; held: number } | null>(null)
  /** What the last press did, under the button until the next one. */
  const [after, setAfter] = useState<string | null>(null)

  const read = useCallback(async () => {
    setReading(true)
    try {
      setRows(await readSignedContractsForDrive())
      setFailure(null)
    } catch (e) {
      setFailure(recoveryFailureFromError(e, 'The signed contracts did not read.'))
    } finally {
      setReading(false)
    }
  }, [])
  useEffect(() => {
    void read()
  }, [read])

  const counts = rows ? contractDriveCounts(rows) : null
  const label = counts ? fileContractsWords(counts.waiting, counts.held.length) : null

  const file = async () => {
    setFiling({ filed: 0, held: 0 })
    setAfter(null)
    try {
      const done = await fileSignedContractsInDrive((soFar) => setFiling(soFar))
      const said = fileContractsOutcome(done.filed, done.held)
      setAfter(said.line)
      showToast(said.line, said.tone)
      await read()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The contracts were not filed in Drive.'), 'error')
    } finally {
      setFiling(null)
    }
  }

  const heldLine = counts ? contractsHeldLine(counts.held.length) : null
  return (
    <section style={card} aria-label={CONTRACTS_CARD_WORDS.title} data-testid="wfg-contracts-card">
      <h4 style={cardH}>{CONTRACTS_CARD_WORDS.title}</h4>
      <p style={words}>{CONTRACTS_CARD_WORDS.where}</p>
      <p style={words} data-testid="wfg-contracts-who">{CONTRACTS_CARD_WORDS.who}</p>
      {failure ? <OfflineRetryPanel failure={failure} onRetry={read} surface="where-files-go-contracts" idempotent busy={reading} /> : null}
      {!counts && !failure ? <p style={{ ...muted, margin: 0 }}>Reading the signed contracts…</p> : null}
      {counts && label ? (
        <>
          <div style={{ display: 'flex', gap: '6px 8px', flexWrap: 'wrap', alignItems: 'center' }} data-testid="wfg-contracts-counts">
            <span style={chip}>{counts.signed === 1 ? '1 signed contract' : `${counts.signed} signed contracts`}</span>
            <span style={chipGreen}>{counts.inDrive} in Drive</span>
            <span style={counts.waiting > 0 ? chipAmber : chip}>{counts.waiting} waiting</span>
            <span style={counts.held.length > 0 ? chipAmber : chip}>{counts.held.length} held</span>
          </div>
          {counts.waiting === 0 && counts.held.length === 0 ? (
            <p style={{ margin: 0, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', fontSize: '0.8125rem', fontWeight: 600 }} data-testid="wfg-contracts-good">
              {counts.signed > 0 ? CONTRACTS_ALL_FILED_WORDS : CONTRACTS_NONE_SIGNED_WORDS}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: '8px 12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" style={label.dead || filing ? pressDead : press} disabled={label.dead || filing != null} onClick={() => void file()} data-testid="wfg-contracts-press">
              {filing ? `Filing… ${filing.filed} filed${filing.held > 0 ? ` · ${filing.held} held` : ''}` : label.button}
            </button>
            <span style={muted}>{after ?? CONTRACTS_CARD_WORDS.sweep}</span>
          </div>
          {heldLine ? (
            <p style={{ margin: 0, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.8125rem', fontWeight: 600 }} data-testid="wfg-contracts-held-line">
              {heldLine}
            </p>
          ) : null}
          {counts.held.length > 0 ? (
            <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 6 }} data-testid="wfg-contracts-held">
              {counts.held.map((c) => {
                const kind = (c.drive_file_hold ?? '') as ContractDriveHoldKind
                const toEdit = contractHoldDoor(kind)?.to === 'job_edit'
                return (
                  <li key={c.id} style={{ listStyle: 'none', display: 'flex', gap: '4px 12px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '0.8125rem' }}>
                    <span style={{ flex: '1 1 220px', minWidth: 0, overflowWrap: 'anywhere' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{jobLabelOf(c)}</span>
                      {c.job?.customer_name ? <span style={muted}> · {c.job.customer_name}</span> : null}
                      <span style={{ display: 'block', color: 'var(--text-700)' }}>{(c.drive_file_hold_words ?? '').trim() || CONTRACT_HOLD_WORDS[kind] || ''}</span>
                    </span>
                    <Link to={`/jobs?edit=${encodeURIComponent(c.job_id)}`} style={door}>
                      {toEdit ? 'Open the job’s Edit tab' : 'Open the job'}
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
