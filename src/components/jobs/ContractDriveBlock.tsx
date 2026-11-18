/**
 * The Contract window's Drive block (punch list #377, PR 4): where a signed paper's copy in Google Drive is, in one
 * line, with the press that fits. Filed by the app, adopted where the office put it, waiting on the sweep, held with its
 * reason and its door, or voided. The line and its doors are `contractDriveLine` in the rules; this draws them and
 * owns the two acts: file it now, and add the scan a record lacks. A record that is not signed draws nothing.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { CONTRACT_DRIVE_WORDS, contractDriveLine, contractDriveUrl, type ContractDriveRow, type ContractHoldDoorTo } from '../../lib/jobs/jobContractDrive'
import {
  CONTRACT_FILE_MAX_BYTES,
  CONTRACT_SCAN_ACCEPT,
  addScanToSignedContract,
  contractDrivePressWords,
  fileContractInDrive,
  type ContractDriveColumns,
  type ContractDrivePress,
} from '../../lib/jobs/jobContractDriveIo'
import { RailGroup } from './ContractRailGroup'

export type ContractDriveBlockProps = {
  /** The contract row shown; its Drive columns are read as the rules read them. */
  row: ContractDriveRow
  jobId: string
  /** Closes the window before a door leads to another page. */
  onClose: () => void
  /** After the record itself changed (a scan added), so the window reads its rows again. */
  onRowChanged?: () => void
}

const btn: React.CSSProperties = {
  padding: '0.35rem 0.7rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  font: 'inherit',
  fontSize: '0.78rem',
  fontWeight: 600,
  cursor: 'pointer',
}
const linkStyle: React.CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }

const TOO_BIG_WORDS = 'Over 25 MB. Put it in the job’s folder in Drive and paste its link on the record.'

export default function ContractDriveBlock({ row, jobId, onClose, onRowChanged }: ContractDriveBlockProps) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const navigate = useNavigate()
  /** The Drive columns as the last press left them: the window's row is from its own read, a press is newer. */
  const [fresh, setFresh] = useState<ContractDriveColumns | null>(null)
  const [busy, setBusy] = useState(false)
  /** Where an adopted file sits, from the file index, when it has the file. */
  const [path, setPath] = useState<string | null>(null)
  const scanInput = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setFresh(null)
  }, [row.id])

  const shown: ContractDriveRow = fresh ? { ...row, ...fresh } : row
  const fileId = (shown.drive_file_id ?? '').trim()
  const adopted = shown.drive_file_origin === 'adopted'

  useEffect(() => {
    setPath(null)
    if (!fileId || !adopted) return
    let live = true
    void (async () => {
      // Fail-soft: the line reads without the path when the index has no row for the file.
      const { data } = await supabase.from('file_index').select('path').eq('drive_file_id', fileId).maybeSingle()
      const p = (data as { path?: string | null } | null)?.path
      if (live && typeof p === 'string' && p.trim()) setPath(p.trim())
    })().catch(() => {})
    return () => {
      live = false
    }
  }, [fileId, adopted])

  const filedYmd = shown.drive_filed_at ? calendarYmdInAppTzFromIso(shown.drive_filed_at) : ''
  const line = contractDriveLine(shown, { filedDay: filedYmd ? formatWorkDateYmdMonthDayShort(filedYmd) : null, path })
  if (line.state === 'none') return null

  const settle = (press: ContractDrivePress) => {
    if (press.drive) setFresh(press.drive)
    const said = contractDrivePressWords(press)
    showToast(said.words, said.tone)
  }

  const fileNow = async () => {
    setBusy(true)
    try {
      settle(await fileContractInDrive(row.id))
    } catch (e) {
      showToast(formatErrorMessage(e, 'The contract was not filed in Drive.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const addScan = async (file: File | null) => {
    if (!file) return
    if (file.size > CONTRACT_FILE_MAX_BYTES) {
      showToast(TOO_BIG_WORDS, 'warning')
      return
    }
    setBusy(true)
    try {
      settle(await addScanToSignedContract({ contractId: row.id, file, authUserId: user?.id ?? null }))
      onRowChanged?.()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The scan was not added.'), 'error')
    } finally {
      setBusy(false)
      if (scanInput.current) scanInput.current.value = ''
    }
  }

  const openJobFolder = async () => {
    try {
      const { data, error } = await supabase.from('jobs_ledger').select('google_drive_link').eq('id', jobId).maybeSingle()
      if (error) throw error
      const url = ((data as { google_drive_link?: string | null } | null)?.google_drive_link ?? '').trim()
      if (!url) {
        showToast('This job has no Drive folder link yet.', 'warning')
        return
      }
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The job’s folder did not open.'), 'error')
    }
  }

  const through = (to: ContractHoldDoorTo) => {
    if (to === 'add_scan') {
      scanInput.current?.click()
      return
    }
    if (to === 'drive_folder') {
      void openJobFolder()
      return
    }
    onClose()
    navigate(to === 'where_files_go' ? '/documents?tab=where-files-go' : `/jobs?edit=${jobId}`)
  }

  const held = line.state === 'held'
  const voided = line.state === 'voided'
  const ok = line.state === 'filed' || line.state === 'adopted'
  return (
    <RailGroup label={CONTRACT_DRIVE_WORDS.block}>
      <div
        data-testid="contract-drive-block"
        data-state={line.state}
        style={{
          flex: '1 1 220px',
          minWidth: 0,
          display: 'grid',
          gap: '0.3rem',
          padding: '0.5rem 0.65rem',
          borderRadius: 8,
          border: `1px solid ${held ? 'var(--text-amber-800)' : 'var(--border)'}`,
          background: held ? 'var(--bg-amber-tint)' : 'var(--surface)',
        }}
      >
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: held ? 'var(--text-amber-800)' : voided ? 'var(--text-red-700)' : 'var(--text-strong)', overflowWrap: 'anywhere' }}>
          {ok ? (
            <span aria-hidden style={{ color: 'var(--text-green-700)' }}>
              ✓{' '}
            </span>
          ) : null}
          {line.title}
        </div>
        {line.sub ? <div style={{ fontSize: '0.76rem', color: held ? 'var(--text-700)' : 'var(--text-muted)', overflowWrap: 'anywhere' }}>{line.sub}</div> : null}
        <div style={{ display: 'flex', gap: '0.4rem 0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {line.driveFileId ? (
            <a style={linkStyle} href={contractDriveUrl(line.driveFileId)} target="_blank" rel="noopener noreferrer" data-testid="contract-drive-open">
              {CONTRACT_DRIVE_WORDS.open} ↗
            </a>
          ) : null}
          {line.door ? (
            <button type="button" style={linkStyle} onClick={() => through(line.door!.to)} disabled={busy} data-testid="contract-drive-door">
              {line.door.label}
            </button>
          ) : null}
          {line.fileNow || line.retry ? (
            <button type="button" style={btn} onClick={() => void fileNow()} disabled={busy} data-testid="contract-drive-press">
              {busy ? CONTRACT_DRIVE_WORDS.filing : line.fileNow ? CONTRACT_DRIVE_WORDS.fileNow : CONTRACT_DRIVE_WORDS.retry}
            </button>
          ) : null}
        </div>
        <input ref={scanInput} type="file" accept={CONTRACT_SCAN_ACCEPT} hidden data-testid="contract-drive-scan" onChange={(e) => void addScan(e.target.files?.[0] ?? null)} />
      </div>
    </RailGroup>
  )
}
