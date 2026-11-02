/**
 * The job window's Documents tab **In the folders** section (v2.6299): what is in the job's five Drive folders, read
 * live from Drive when the tab opens, so a person knows what exists before going to look. Each folder is a block:
 * its name, its count and *Open in Drive*, then the newest rows, each with its name as the door to the file, when and
 * how big and who, and where it came from, *From the app · a report photo* or *Added in Drive*. An empty folder says
 * what fills it; a folder not made yet says when the app makes it; a held job shows the hold's words instead; a read
 * that fails says why with Try again. Nothing is kept: the app stores only what it filed itself.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { SHOW_FIRST, fileMetaWords, filesReadFailedWords, fromWords, hasAnyFolder, moreWords, sectionCountWords, sectionEmptyWords, type JobFolderFilesRead } from '../../lib/jobs/jobFolderFiles'
import { supabaseJobFolderFilesIo, type JobFolderFilesIo } from '../../lib/jobs/jobFolderFilesIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'
import { documentsChip, documentsHeading } from './jobDocumentsStyles'

const line: CSSProperties = { fontSize: '0.875rem', color: 'var(--text-700)' }
const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const doorBtn: CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', fontWeight: 600, font: 'inherit', fontSize: '0.8125rem' }
const folderName: CSSProperties = { margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }
const fileLink: CSSProperties = { fontSize: '0.875rem', color: 'var(--text-link)', textDecoration: 'none', fontWeight: 500, overflowWrap: 'anywhere' }
const appChip: CSSProperties = { ...documentsChip, marginLeft: 0, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' }
const handChip: CSSProperties = { ...documentsChip, marginLeft: 0, background: 'var(--bg-muted)', color: 'var(--text-600)' }

export function JobDocumentsFolderFiles({ job, io: ioProp }: { job: Pick<JobWithDetails, 'id' | 'google_drive_link' | 'job_pictures_link' | 'job_plans_link'>; io?: JobFolderFilesIo }) {
  const io = useMemo(() => ioProp ?? supabaseJobFolderFilesIo(), [ioProp])
  const linked = Boolean(job.google_drive_link || job.job_pictures_link || job.job_plans_link)
  const [read, setRead] = useState<JobFolderFilesRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    setRead(null)
    setError(null)
    if (!linked) return
    io.list(job.id).then(
      (r) => live && setRead(r),
      (e: unknown) => live && setError(formatErrorMessage(e, 'The folders did not answer.')),
    )
    return () => {
      live = false
    }
  }, [io, job.id, linked, tick])

  // Nothing linked: the Job folders section above already says so and offers the press.
  if (!linked) return null
  if (read && !read.job.hold && !hasAnyFolder(read)) return null

  const state = error ? 'failed' : !read ? 'loading' : read.job.hold ? 'held' : 'files'
  return (
    <section aria-labelledby="job-documents-folder-files" data-job-documents-folder-files={state} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <h3 id="job-documents-folder-files" style={documentsHeading}>
        In the folders
      </h3>
      {error ? (
        <p style={{ ...muted, color: 'var(--text-amber-800)' }}>
          {filesReadFailedWords(error)}{' '}
          <button type="button" style={doorBtn} onClick={() => setTick((t) => t + 1)}>
            Try again
          </button>
        </p>
      ) : !read ? (
        <p style={muted}>Reading the folders…</p>
      ) : read.job.hold ? (
        <p style={{ ...line, margin: 0, color: 'var(--text-amber-800)', fontWeight: 600 }}>{read.job.hold}</p>
      ) : (
        read.sections.map((s) => {
          const shown = s.files.slice(0, SHOW_FIRST)
          const more = moreWords(s)
          const empty = sectionEmptyWords(s)
          return (
            <div key={s.key} data-folder-section={s.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h4 style={folderName}>{s.name}</h4>
                <span style={{ ...muted, margin: 0 }}>{sectionCountWords(s)}</span>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ ...doorBtn, marginLeft: 'auto' }}>
                    Open in Drive ↗
                  </a>
                ) : null}
              </div>
              {shown.length === 0 ? (
                <EmptyState compact main={empty.main} tail={empty.tail} />
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {shown.map((f) => {
                    const from = fromWords(f)
                    const meta = fileMetaWords(f)
                    return (
                      <li key={f.id} data-folder-file style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {f.url ? (
                            <a href={f.url} target="_blank" rel="noopener noreferrer" style={fileLink}>
                              {f.name}
                            </a>
                          ) : (
                            <span style={{ ...fileLink, color: 'var(--text-strong)' }}>{f.name}</span>
                          )}
                          <span style={from.tone === 'app' ? appChip : handChip}>{from.text}</span>
                        </div>
                        {meta ? <span style={{ ...muted, margin: 0 }}>{meta}</span> : null}
                      </li>
                    )
                  })}
                </ul>
              )}
              {more ? (
                <p style={muted}>
                  {more}
                  {s.url ? (
                    <>
                      {' · '}
                      <a href={s.url} target="_blank" rel="noopener noreferrer" style={doorBtn}>
                        Open the folder
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          )
        })
      )}
      {read && !read.job.hold ? <p style={muted}>Read from Drive just now. A file put in a folder by hand shows the next time this tab opens.</p> : null}
    </section>
  )
}

export default JobDocumentsFolderFiles
