import { useState } from 'react'
import { driveViewUrl } from '../../../../supabase/functions/_shared/driveLink'
import { driveOf, type LineFile } from '../../../lib/messages/lineFiles'
import { saveToDrive as saveToDriveIo } from '../../../lib/messages/messagesIo'
import { SAVE_WORDS, saveTarget, savedWords, type DriveHalf, type SaveTarget } from '../../../lib/messages/saveToDrive'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { Btn } from '../gcUi'
import { useMessagesReread } from './useMessagesReread'

export type SaveToDriveIo = (attachmentId: string, half: DriveHalf) => Promise<{ driveFileId: string; url: string }>

const muted = { color: 'var(--text-muted)' } as const
const link = { color: 'var(--text-link)' } as const

/**
 * Messages, cut 7f: Save to Drive on a file that came in (the mock-up `files-out-mockups.html`, screen 8). The button
 * sits beside Open in the message window's Attachments. It opens under the row, not as another window: where the file
 * goes, the pick of Team only or Plans on a GC project, and Save it. Once saved, the row says where it went and opens
 * it in Drive. A file saved before, by a press or the photo sweep, says it is in Drive.
 */
export function SaveToDrive({ file, jobKey, jobLabel, save = saveToDriveIo }: { file: LineFile; jobKey: string | null; jobLabel: string | null; save?: SaveToDriveIo }) {
  const reread = useMessagesReread()
  const target = saveTarget(file, jobKey)
  const [open, setOpen] = useState(false)
  const [half, setHalf] = useState<DriveHalf>(target.kind === 'halves' ? target.pick : 'team_only')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ url: string; target: SaveTarget; half: DriveHalf | null } | null>(null)
  const already = driveOf(file).driveFileId

  if (saved || already) {
    const url = saved?.url ?? driveViewUrl(already!)
    return (
      <span data-saved-to-drive={file.id} style={{ fontSize: '0.8rem', ...muted }}>
        {savedWords(saved?.target ?? null, saved?.half ?? null)}{' '}
        <a href={url} target="_blank" rel="noopener noreferrer" style={link}>
          {SAVE_WORDS.openInDrive}
        </a>
      </span>
    )
  }
  if (!open) {
    return (
      <Btn onClick={() => setOpen(true)} title="Copies our copy into the job’s Drive folder, so the job’s files show it.">
        {SAVE_WORDS.button}
      </Btn>
    )
  }

  const go = () => {
    setBusy(true)
    setProblem(null)
    const goingHalf: DriveHalf = target.kind === 'halves' ? half : 'team_only'
    save(file.id, goingHalf).then(
      (r) => {
        setSaved({ url: r.url, target, half: target.kind === 'halves' ? goingHalf : null })
        setBusy(false)
        reread()
      },
      (e: unknown) => {
        setProblem(formatErrorMessage(e, 'The file was not saved to Drive.'))
        setBusy(false)
      },
    )
  }

  return (
    <div
      data-save-to-drive={file.id}
      style={{ flexBasis: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.7rem', background: 'var(--surface)', display: 'grid', gap: '0.45rem' }}
    >
      <strong style={{ fontSize: '0.88rem' }}>{SAVE_WORDS.title(jobLabel ?? 'the job')}</strong>
      {target.kind === 'noJob' && <span style={muted}>{SAVE_WORDS.noJob}</span>}
      {target.kind === 'photos' && <span style={muted}>{SAVE_WORDS.photos}</span>}
      {target.kind === 'folder' && <span style={muted}>{SAVE_WORDS.folder}</span>}
      {target.kind === 'halves' && (
        <div role="radiogroup" aria-label="Which half of the job’s folder" style={{ display: 'grid', gap: '0.3rem' }}>
          {(['team_only', 'plans'] as const).map((h) => {
            const words = h === 'team_only' ? SAVE_WORDS.teamOnly : SAVE_WORDS.plans
            return (
              <label key={h} style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', cursor: 'pointer' }}>
                <input type="radio" name={`save-half-${file.id}`} checked={half === h} onChange={() => setHalf(h)} />
                <span>
                  <strong>{words.label}</strong> <span style={muted}>{words.hint}</span>
                </span>
              </label>
            )
          })}
        </div>
      )}
      {problem && <span style={{ color: 'var(--text-red-700)', fontSize: '0.82rem' }}>{problem}</span>}
      <span style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
        <Btn onClick={() => setOpen(false)} disabled={busy}>
          {SAVE_WORDS.notNow}
        </Btn>
        {target.kind !== 'noJob' && (
          <Btn kind="primary" onClick={go} disabled={busy}>
            {busy ? SAVE_WORDS.saving : SAVE_WORDS.save}
          </Btn>
        )}
      </span>
    </div>
  )
}
