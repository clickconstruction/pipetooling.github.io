import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { JobFile } from '../../../../lib/documents/jobFiles'
import { attachPicker, previewFacts, type Audience } from '../../../../lib/documents/outgoing'
import type { AttachIo } from '../../../../lib/messages/attachIo'
import { fileTag, previewHref, replyFileFromDevice, replyFileFromJob, type ReplyFile } from '../../../../lib/messages/replyFiles'
import { formatErrorMessage } from '../../../../utils/errorHandling'
import { PhoneSheet } from '../../../PhoneSheet'
import { Btn } from '../../gcUi'

const muted = { color: 'var(--text-muted)' } as const
const tag = { fontSize: '0.7rem', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, padding: '0 0.3rem', marginLeft: '0.35rem' } as const

/**
 * Messages, cut 7f: the Attach picker (the mock-up `files-out-mockups.html`, screens 2 and 3, on branch spike/gc-mode),
 * over `outgoing.attachPicker`. The job's one list, each file with its size, how it goes when it goes as our link, its
 * page in their portal, and a small tag for where it lives; then a file from this computer and a photo. While Drive's
 * folder reads, its rows wait under the app's own; a folder that will not read says so and leaves the rest. Preview
 * shows a file's facts with Open in a tab and Attach it. A sheet from the bottom on a phone (`PhoneSheet`).
 */
export function AttachPicker({
  jobKey,
  jobName,
  audience,
  hasPortal,
  io,
  onPick,
  onClose,
}: {
  /** The reply's job, as the thread keys it. Null: on nobody's job. */
  jobKey: string | null
  /** *B482 Boerne Retail Shell*, for the head and the preview. */
  jobName: string | null
  audience: Audience
  hasPortal: boolean
  io: AttachIo
  onPick: (file: ReplyFile) => void
  onClose: () => void
}) {
  const [files, setFiles] = useState<JobFile[] | null>(jobKey ? null : [])
  const [driveFailed, setDriveFailed] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<JobFile | null>(null)
  const computer = useRef<HTMLInputElement | null>(null)
  const photo = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!jobKey) return
    let live = true
    io.loadJobFiles(jobKey).then(
      (read) => {
        if (!live) return
        setFiles(read.files)
        setDriveFailed(read.driveFailed)
      },
      (e: unknown) => {
        if (!live) return
        setFiles([])
        setProblem(formatErrorMessage(e, 'The job’s files did not read.'))
      },
    )
    return () => {
      live = false
    }
  }, [io, jobKey])

  const picker = attachPicker(jobName, files ?? [], audience, [], hasPortal)
  const byKey = new Map((files ?? []).map((f) => [f.key, f]))
  const fromDevice = (from: 'computer' | 'photo') => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onPick(replyFileFromDevice(file, from))
  }

  return (
    <PhoneSheet label="Attach a file" title="Attach a file" width={560} maxHeight="85vh" dataAttrs={{ 'data-attach-picker': '' }} onClose={onClose}>
      <div style={{ padding: '0.8rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.45rem', fontSize: '0.875rem' }}>
        {problem && (
          <div role="alert" style={{ color: 'var(--text-red-700)' }}>
            {problem}
          </div>
        )}
        {previewing && (
          <div data-attach-preview style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.6rem 0.7rem', display: 'grid', gap: '0.35rem', background: 'var(--surface)' }}>
            <strong>{previewing.name}</strong>
            <span style={muted}>{previewFacts(previewing, null, jobName).join(' · ')}</span>
            <span style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Btn onClick={() => setPreviewing(null)}>Close</Btn>
              {previewHref(previewing, jobKey) && (
                <a href={previewHref(previewing, jobKey)!} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', alignSelf: 'center' }}>
                  Open in a tab
                </a>
              )}
              <Btn kind="primary" onClick={() => onPick(replyFileFromJob(previewing))}>
                Attach it
              </Btn>
            </span>
          </div>
        )}
        <div style={{ fontWeight: 600 }}>{picker.jobHead}</div>
        {jobKey && files === null && <div style={muted}>Reading the job’s Drive folder…</div>}
        {driveFailed && <div style={muted}>The job’s Drive folder did not read. The rest of its files are here.</div>}
        {picker.jobEmpty && files !== null && <div style={muted}>{picker.jobEmpty}</div>}
        {picker.jobRows.map((r) => {
          const f = byKey.get(r.key)!
          return (
            <div key={r.key} data-attach-row={r.key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => onPick(replyFileFromJob(f))}
                style={{ flex: 1, minWidth: 200, textAlign: 'left', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--text-base)', display: 'grid', gap: '0.1rem' }}
              >
                <span>
                  {r.name}
                  <span style={tag}>{fileTag(f)}</span>
                </span>
                {r.facts.length > 0 && <span style={{ ...muted, fontSize: '0.8rem' }}>{r.facts.join(' · ')}</span>}
              </button>
              <Btn onClick={() => setPreviewing(f)}>Preview</Btn>
            </div>
          )
        })}
        <div style={{ fontWeight: 600, marginTop: '0.4rem' }}>Or</div>
        {picker.device.map((r) => {
          const from = r.key === 'device:photo' ? 'photo' : 'computer'
          return (
            <button
              key={r.key}
              type="button"
              data-attach-device={from}
              onClick={() => (from === 'photo' ? photo : computer).current?.click()}
              style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.45rem 0.6rem', cursor: 'pointer', display: 'grid', gap: '0.1rem', color: 'var(--text-base)' }}
            >
              <span>{r.name}</span>
              <span style={{ ...muted, fontSize: '0.8rem' }}>{r.facts.join(' · ')}</span>
            </button>
          )
        })}
        <input ref={computer} type="file" hidden aria-label="A file from this computer" onChange={fromDevice('computer')} />
        <input ref={photo} type="file" accept="image/*" hidden aria-label="A photo" onChange={fromDevice('photo')} />
      </div>
    </PhoneSheet>
  )
}
