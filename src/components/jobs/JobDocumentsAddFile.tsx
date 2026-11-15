import { useRef, useState, type CSSProperties } from 'react'
import type { JobDocumentFolderLink } from '../../lib/jobs/jobDocumentsTab'
import { ADD_FILE_WORDS, ADD_SHEET_WORDS, addFileConfirmLabel, addFileSizeWords, addFileTooBig, addFileWhereFor, addedWords, folderPhotoFileName } from '../../lib/jobs/jobFolderAddFile'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { PhoneSheet } from '../PhoneSheet'
import { shrinkPhoto } from '../../lib/materials/photoShrink'
import { readTakenAt } from '../../lib/photos/photoTakenAt'
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
/** The phone's sheet rows (punch list #355 H): 48 px each, the words and a quiet line. */
const sheetRow: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%', minHeight: 48, padding: '0.5rem 1rem', border: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '1rem', fontWeight: 600, textAlign: 'left', cursor: 'pointer', textDecoration: 'none' }
const sheetSub: CSSProperties = { fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-muted)' }

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
  byName = null,
}: {
  jobId: string
  folder: JobDocumentFolderLink
  io?: JobFolderAddFileIo
  onAdded?: () => void
  /** Who takes the photo (punch list #355 H): the shot's name carries it; *Someone* with no name. */
  byName?: string | null
}) {
  const where = addFileWhereFor(folder.label)
  const input = useRef<HTMLInputElement>(null)
  // Punch list #355 H (v2.7282): on a phone the press is Add ▾ and opens a sheet; Take a photo goes straight into the folder.
  const phone = useNarrowViewport640()
  const camera = useRef<HTMLInputElement>(null)
  const [sheet, setSheet] = useState(false)
  const [shot, setShot] = useState<string | null>(null)
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
  const shotTaken = async (f: File | null) => {
    if (!f || busy) return
    setProblem(null)
    setAdded(null)
    setShot(ADD_SHEET_WORDS.shrinking)
    try {
      const at = await readTakenAt(f)
      const small = await shrinkPhoto(f)
      const type = small.shrunk ? 'image/jpeg' : f.type || 'image/jpeg'
      const named = new File([small.blob], folderPhotoFileName({ at, byName: byName?.trim() || 'Someone', folder: folder.label, mime: type }), { type })
      if (addFileTooBig(named.size)) {
        setProblem(ADD_FILE_WORDS.tooBig)
        return
      }
      setShot(ADD_SHEET_WORDS.sending)
      const r = await io.put(jobId, where, named)
      setAdded({ name: named.name, url: r.url })
      onAdded?.()
    } catch (e) {
      setProblem(formatErrorMessage(e, ADD_FILE_WORDS.failed))
    } finally {
      setShot(null)
    }
  }

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
      <input ref={camera} type="file" accept="image/*" capture="environment" aria-label={`${ADD_SHEET_WORDS.photo}: ${folder.label}`} tabIndex={-1} style={{ display: 'none' }} onChange={(e) => { void shotTaken(e.target.files?.[0] ?? null); e.target.value = '' }} />
      {!file && !added && phone ? (
        <button type="button" style={{ ...documentsQuietButton, minHeight: 40, padding: '0 0.8rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-link)', marginLeft: 'auto' }} onClick={() => setSheet(true)} aria-haspopup="dialog" aria-label={ADD_SHEET_WORDS.title(folder.label)} disabled={shot != null}>
          {shot ?? ADD_SHEET_WORDS.button}
        </button>
      ) : !file && !added ? (
        <button type="button" style={{ ...documentsQuietButton, padding: '0.1rem 0.5rem', fontSize: '0.75rem' }} onClick={pick} title={ADD_FILE_WORDS.where[where]}>
          {ADD_FILE_WORDS.button}
        </button>
      ) : null}
      {sheet ? (
        <PhoneSheet label={ADD_SHEET_WORDS.title(folder.label)} title={ADD_SHEET_WORDS.title(folder.label)} width={420} onClose={() => setSheet(false)}>
          <div role="menu" aria-label={ADD_SHEET_WORDS.title(folder.label)} style={{ display: 'grid', paddingBottom: '0.25rem' }} data-add-sheet={folder.label}>
            <button type="button" role="menuitem" style={sheetRow} onClick={() => { setSheet(false); camera.current?.click() }}>
              📷 {ADD_SHEET_WORDS.photo}
              <span style={sheetSub}>{ADD_SHEET_WORDS.photoSub}</span>
            </button>
            <button type="button" role="menuitem" style={sheetRow} onClick={() => { setSheet(false); pick() }}>
              📎 {ADD_SHEET_WORDS.file}
              <span style={sheetSub}>{ADD_SHEET_WORDS.fileSub}</span>
            </button>
            <a role="menuitem" href={folder.url} target="_blank" rel="noopener noreferrer" style={{ ...sheetRow, borderBottom: 'none', color: 'var(--text-link)' }} onClick={() => setSheet(false)}>
              ▲ {ADD_SHEET_WORDS.drive}
            </a>
          </div>
        </PhoneSheet>
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
