import { useRef, useState, type CSSProperties } from 'react'
import type { JobDocumentFolderLink } from '../../lib/jobs/jobDocumentsTab'
import { ADD_FILE_WORDS, addFileConfirmLabel, addFileSizeWords, addFileTooBig, addFileWhereFor, addedWords } from '../../lib/jobs/jobFolderAddFile'
import { supabaseJobFolderAddFileIo, type JobFolderAddFileIo } from '../../lib/jobs/jobFolderAddFileIo'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { formatErrorMessage } from '../../utils/errorHandling'
import { documentsQuietButton } from './jobDocumentsStyles'

const muted: CSSProperties = { color: 'var(--text-muted)' }
const small: CSSProperties = { fontSize: '0.8125rem' }
const panel: CSSProperties = {
  flexBasis: '100%',
  display: 'grid',
  gap: '0.4rem',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.55rem 0.7rem',
  background: 'var(--surface)',
  maxWidth: '34rem',
}
const linkPress: CSSProperties = { border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--text-link)', fontWeight: 600 }

/**
 * Add a file to one of a job's Drive folders from the Documents tab (v2.6303, the owner's ask after punch list #236):
 * a small press beside each Job folders row. It opens this computer's file picker, then a panel under the row with the
 * file's name and size, where it goes, and a press that names the act and the folder. The file goes through
 * `drive-link`'s `put` as the service account, so the person needs no Drive window; the line then says it is there
 * with Open in Drive. A file over 10 MB is told so with no press; a refusal shows its reason and keeps the file picked.
 * A row the press does not serve draws nothing.
 */
export function JobDocumentsAddFile({
  jobId,
  folder,
  io = supabaseJobFolderAddFileIo,
  onAdded,
}: {
  jobId: string
  folder: JobDocumentFolderLink
  io?: JobFolderAddFileIo
  onAdded?: () => void
}) {
  const where = addFileWhereFor(folder.label)
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [added, setAdded] = useState<{ name: string; url: string } | null>(null)
  if (!where) return null

  const pick = () => {
    setProblem(null)
    input.current?.click()
  }
  const chosen = (f: File | null) => {
    setFile(f)
    setAdded(null)
    setProblem(f && addFileTooBig(f.size) ? ADD_FILE_WORDS.tooBig : null)
  }
  const go = async () => {
    if (!file || busy || addFileTooBig(file.size)) return
    setBusy(true)
    setProblem(null)
    try {
      const r = await io.put(jobId, where, file)
      setAdded({ name: file.name, url: r.url })
      setFile(null)
      onAdded?.()
    } catch (e) {
      setProblem(formatErrorMessage(e, ADD_FILE_WORDS.failed))
    } finally {
      setBusy(false)
    }
  }
  const tooBig = file != null && addFileTooBig(file.size)

  return (
    <>
      <input
        ref={input}
        type="file"
        aria-label={ADD_FILE_WORDS.title(folder.label)}
        style={{ display: 'none' }}
        onChange={(e) => {
          chosen(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      {!file && !added ? (
        <button type="button" style={{ ...documentsQuietButton, padding: '0.1rem 0.5rem', fontSize: '0.75rem' }} onClick={pick} title={ADD_FILE_WORDS.where[where]}>
          {ADD_FILE_WORDS.button}
        </button>
      ) : null}
      {added ? (
        <span data-added-file={folder.label} style={{ ...small, ...muted }}>
          {addedWords(added.name, folder.label)}{' '}
          <a href={added.url} target="_blank" rel="noopener noreferrer">
            {ADD_FILE_WORDS.openInDrive}
          </a>
          {' · '}
          <button type="button" style={linkPress} onClick={pick}>
            {ADD_FILE_WORDS.another}
          </button>
        </span>
      ) : null}
      {file ? (
        <span data-add-file={folder.label} style={panel}>
          <strong style={{ fontSize: '0.875rem' }}>{ADD_FILE_WORDS.title(folder.label)}</strong>
          <span style={small}>
            {file.name} <span style={muted}>· {addFileSizeWords(file.size)}</span>
          </span>
          <span style={{ ...small, ...muted }}>{ADD_FILE_WORDS.where[where]}</span>
          {problem ? <span style={{ ...small, color: 'var(--text-red-700)' }}>{problem}</span> : null}
          <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" style={documentsQuietButton} disabled={busy} onClick={() => chosen(null)}>
              {ADD_FILE_WORDS.notNow}
            </button>
            <button type="button" style={documentsQuietButton} disabled={busy} onClick={pick}>
              {ADD_FILE_WORDS.choose}
            </button>
            {!tooBig ? (
              <button
                type="button"
                style={{
                  ...documentsQuietButton,
                  fontWeight: 600,
                  border: `1px solid ${busy ? DEAD_PRESS_FILL : '#2563eb'}`,
                  background: busy ? DEAD_PRESS_FILL : '#2563eb',
                  color: busy ? DEAD_PRESS_TEXT : 'white',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
                disabled={busy}
                onClick={() => void go()}
              >
                {busy ? ADD_FILE_WORDS.adding : addFileConfirmLabel(folder.label)}
              </button>
            ) : null}
          </span>
        </span>
      ) : null}
      {!file && !added && problem ? <span style={{ ...small, color: 'var(--text-red-700)' }}>{problem}</span> : null}
    </>
  )
}
