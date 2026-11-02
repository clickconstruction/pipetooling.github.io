import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { canSetCompanyFolder, canUploadCompanyFiles, companyFileRows, companyFilesCountWords, companyUploadHold, companyUploadedWords, type CompanyFileRow } from '../../lib/documents/companyFolder'
import { CompanyFolderRefused, loadCompanyFiles, putCompanyFile } from '../../lib/documents/companyFilesIo'

/**
 * Documents → Company's folder (the Documents spike of 2026-11-01, the owner's ask): the company's papers live in one Drive
 * folder the office set on Where files go, listed here live from Drive the way the job window lists a job's folder, with
 * **Open the folder** for dropping files in Drive and **Upload a file** for the four office roles. No rows to keep: a
 * newer copy is the newer file in Drive. While no folder is set the tab says so and names the tab that sets it.
 */

const heading: CSSProperties = { margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-strong)' }
const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const btn: CSSProperties = { padding: '0.4rem 0.8rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 8, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: 'white' }
const th: CSSProperties = { textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '0.5rem 0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem', verticalAlign: 'middle' }
const fileLink: CSSProperties = { border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: '0.875rem', color: 'var(--text-link)', fontWeight: 500, textAlign: 'left' }

export function DocumentsCompanyFolder() {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const [read, setRead] = useState<{ folderUrl: string; rows: CompanyFileRow[]; count: number; capped: boolean } | null>(null)
  const [noFolder, setNoFolder] = useState(false)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement | null>(null)
  const canUpload = canUploadCompanyFiles(role)
  const canSet = canSetCompanyFolder(role)

  const load = useCallback(async () => {
    setReading(true)
    try {
      const r = await loadCompanyFiles()
      setRead({ folderUrl: r.folder.url, rows: companyFileRows(r.files), count: r.files.length, capped: r.capped })
      setNoFolder(false)
      setFailure(null)
    } catch (e) {
      if (e instanceof CompanyFolderRefused && e.why === 'no_company_folder') {
        setNoFolder(true)
        setRead(null)
        setFailure(null)
      } else setFailure(recoveryFailureFromError(e, 'The company folder did not read.'))
    } finally {
      setReading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const picked = async (file: File | null) => {
    if (!file || uploading) return
    const hold = companyUploadHold(file)
    if (hold) {
      showToast(hold, 'error')
      return
    }
    setUploading(file.name)
    try {
      await putCompanyFile(file)
      showToast(companyUploadedWords(file.name), 'success')
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The file was not put in the company folder.'), 'error')
    } finally {
      setUploading(null)
      if (picker.current) picker.current.value = ''
    }
  }

  return (
    <section data-testid="documents-company-folder" style={{ display: 'grid', gap: 10, marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h2 style={heading}>Company papers</h2>
          <p style={muted}>The W-9, the insurance and the licenses, as they sit in the company folder in Drive.</p>
        </div>
        {read ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" style={btn} onClick={() => openInExternalBrowser(read.folderUrl)}>
              Open the folder
            </button>
            {canUpload ? (
              <>
                <input
                  ref={picker}
                  type="file"
                  aria-label="A file from this computer for the company folder"
                  style={{ display: 'none' }}
                  onChange={(e) => void picked(e.target.files?.[0] ?? null)}
                />
                <button type="button" style={btnPrimary} disabled={uploading != null} onClick={() => picker.current?.click()}>
                  {uploading ? `Uploading ${uploading}…` : 'Upload a file'}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {failure ? <OfflineRetryPanel failure={failure} onRetry={load} surface="documents-company-folder" idempotent busy={reading} /> : null}
      {noFolder ? (
        canSet ? (
          <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'data', noun: 'company folder', page: { label: 'Where files go', tail: 'sets it.' } }), { to: '/documents?tab=where-files-go' })} />
        ) : (
          <EmptyState main="No company folder yet. The office sets it on Where files go." />
        )
      ) : null}
      {read && read.rows.length === 0 ? (
        canUpload ? (
          <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'company papers', control: 'Upload a file' }), { onPress: () => picker.current?.click() })} />
        ) : (
          <EmptyState main="No company papers yet. The office adds them with Upload a file." />
        )
      ) : null}
      {read && read.rows.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>File</th>
                <th style={{ ...th, width: '7rem' }}>Changed</th>
                <th style={{ ...th, width: '5rem', textAlign: 'right' }}>Size</th>
              </tr>
            </thead>
            <tbody>
              {read.rows.map((f) => (
                <tr key={f.id}>
                  <td style={td}>
                    <button type="button" style={fileLink} onClick={() => openInExternalBrowser(f.url)}>
                      {f.name}
                    </button>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{f.day}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{f.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ ...muted, marginTop: 6 }}>{companyFilesCountWords(read.count, read.capped)}</p>
        </div>
      ) : null}
      {reading && !read && !noFolder && !failure ? <p style={muted}>Reading the company folder…</p> : null}
    </section>
  )
}

export default DocumentsCompanyFolder
