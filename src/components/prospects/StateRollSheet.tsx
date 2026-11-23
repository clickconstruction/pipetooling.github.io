/**
 * Prospects → State roll → a person's sheet (punch list #411, step three). The state's facts, what changed as our
 * pulls saw it, our notes, Add a note, and Leave off. Opened from a row on Everyone, and kept on the address as
 * `person=<id>` so a link opens the same sheet.
 *
 * Values are drawn in place: everything the state says is worked out, so it is plain bold and cannot be changed here.
 * Our notes are the office's own words. The Reach block (a cell, OK to text) is step four and is not drawn.
 */
import { useCallback, useEffect, useState } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { ValueLine, ValueLines, ValueSentence } from '../valuesInPlace/ValuesInPlace'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog, usePromptDialog } from '../../contexts/ConfirmDialogContext'
import { historyLines, leaveOffAsk, noteDraft, NOTE_MAX, personName, sheetFacts, sheetNotes, classWords } from '../../lib/licenseRoll/everyone'
import { addRollNote, deleteRollNote, leaveOffRoll, readNotesFor, readPersonSheet, type LeaveOffOutcome, type SheetRead } from '../../lib/licenseRoll/everyoneIo'
import { formatCompactNoteDateTime, todayYmdInAppTz } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'

const quiet = { fontSize: '0.8125rem', color: 'var(--text-muted)' } as const
const cap = { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '18px 0 6px' } as const
const press = { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: '0.875rem', minHeight: 44, cursor: 'pointer', fontFamily: 'inherit' } as const
const line = { padding: '6px 0', borderBottom: '1px dashed var(--border)', fontSize: '0.875rem', color: 'var(--text)' } as const

export function StateRollSheet({
  rollId,
  authUserId,
  onClose,
  onLeftOff,
  onNotesChanged,
}: {
  rollId: string
  authUserId: string | null
  onClose: () => void
  /** The person was left off: the list reads again, and the toast offers the way back. */
  onLeftOff: (outcome: LeaveOffOutcome) => void
  /** A note was kept or taken back: the list's counts read again. */
  onNotesChanged: () => void
}) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const promptDialog = usePromptDialog()
  const [read, setRead] = useState<SheetRead | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const [draftWhy, setDraftWhy] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setRead(await readPersonSheet(rollId))
      setFailure(null)
    } catch (e) {
      setFailure(formatErrorMessage(e))
    }
  }, [rollId])

  useEffect(() => {
    setRead(null)
    void load()
  }, [load])

  const row = read?.row ?? null
  const title = row ? personName(row) : 'A person on the state roll'

  const reloadNotes = useCallback(async () => {
    if (!row) return
    const notes = await readNotesFor(row)
    setRead((r) => (r ? { ...r, notes } : r))
    onNotesChanged()
  }, [row, onNotesChanged])

  const keepNote = useCallback(async () => {
    if (!row || draft == null || writing) return
    const checked = noteDraft(draft)
    if (!checked.ok) {
      setDraftWhy(checked.why)
      return
    }
    setWriting(true)
    try {
      await addRollNote(row, checked.body)
      setDraft(null)
      setDraftWhy(null)
      showToast('The note is kept.', 'success')
      await reloadNotes()
    } catch (e) {
      setDraftWhy(formatErrorMessage(e))
    } finally {
      setWriting(false)
    }
  }, [row, draft, writing, showToast, reloadNotes])

  const takeBack = useCallback(
    async (noteId: string) => {
      const ok = await confirmDialog({ title: 'Delete this note?', message: 'The note goes for everyone who reads the roll.', confirmLabel: 'Delete the note', danger: true })
      if (!ok) return
      try {
        await deleteRollNote(noteId)
        showToast('The note is deleted.', 'success')
        await reloadNotes()
      } catch (e) {
        showToast(formatErrorMessage(e), 'error')
      }
    },
    [confirmDialog, showToast, reloadNotes],
  )

  const leaveOff = useCallback(async () => {
    if (!row || busy) return
    const ask = leaveOffAsk(row)
    const why = await promptDialog({ title: ask.title, message: ask.message, confirmLabel: ask.confirmLabel, placeholder: 'How they asked, if you know' })
    if (why == null) return
    setBusy(true)
    try {
      const outcome = await leaveOffRoll(row.id, why)
      onLeftOff({ ...outcome, shownAs: outcome.shownAs || personName(row) })
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
      setBusy(false)
    }
  }, [row, busy, promptDialog, onLeftOff, showToast])

  const today = todayYmdInAppTz()

  const footer = row ? (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      {row.ours ? (
        <span style={quiet}>This license is one of ours, so it stays on the roll.</span>
      ) : (
        <button type="button" onClick={() => void leaveOff()} aria-disabled={busy} style={{ ...press, color: 'var(--text-red-700)' }}>
          {busy ? 'Leaving off…' : 'Leave off'}
        </button>
      )}
      <button type="button" onClick={onClose} style={press}>
        Close
      </button>
    </div>
  ) : undefined

  return (
    <ResponsiveModalShell title={title} onRequestClose={onClose} footer={footer} maxWidthDesktop={620}>
      <div data-roll-sheet={rollId} style={{ padding: '4px 2px 8px', overflowWrap: 'anywhere' }}>
        {failure && !read ? (
          <div role="alert">
            <div style={{ color: 'var(--text-strong)', fontWeight: 700 }}>The person could not be read.</div>
            <div style={{ ...quiet, margin: '4px 0 10px' }}>{failure}</div>
            <button type="button" onClick={() => void load()} style={press}>
              Read it again
            </button>
          </div>
        ) : !read ? (
          <div style={quiet}>Reading the person…</div>
        ) : !row ? (
          <div>
            <div style={{ color: 'var(--text-strong)', fontWeight: 700 }}>This person is not on the roll now.</div>
            <div style={{ ...quiet, marginTop: 4 }}>They may have been left off, moved out of our counties or dropped off the state’s file.</div>
          </div>
        ) : (
          <>
            <div>
              <ValueLines>
                {sheetFacts(row, today).map((f) => (
                  <ValueLine key={f.label} label={f.label}>
                    <ValueSentence text={f.text} />
                  </ValueLine>
                ))}
              </ValueLines>
            </div>

            <h3 style={cap}>What changed, as we saw it</h3>
            {read.changes.length === 0 ? (
              <EmptyState main="Nothing changed since our first pull." compact />
            ) : (
              <div data-roll-history>
                {historyLines(read.changes, read.firstPullDay).map((h) => (
                  <div key={h.id} style={{ ...line, display: 'grid', gridTemplateColumns: '104px minmax(0, 1fr)', gap: 8 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{h.day}</span>
                    <span>
                      <ValueSentence text={h.text} />
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ ...quiet, marginTop: 6 }}>The state keeps no history. This starts on our first pull.</div>

            <h3 style={cap}>Our notes</h3>
            <SheetNotesList notes={sheetNotes(row, read.notes)} authUserId={authUserId} onDelete={(id) => void takeBack(id)} onAdd={() => setDraft('')} adding={draft != null} />

            {draft == null ? (
              sheetNotes(row, read.notes).length > 0 && (
                <button type="button" onClick={() => setDraft('')} style={{ ...press, marginTop: 10 }}>
                  Add a note
                </button>
              )
            ) : (
              <div style={{ marginTop: 10 }}>
                <label style={{ display: 'block', ...quiet, marginBottom: 4 }} htmlFor={`roll-note-${rollId}`}>
                  A note for the office. Nobody outside sees it.
                </label>
                <textarea
                  id={`roll-note-${rollId}`}
                  value={draft}
                  autoFocus
                  maxLength={NOTE_MAX}
                  rows={3}
                  onChange={(e) => {
                    setDraft(e.target.value)
                    setDraftWhy(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      setDraft(null)
                      setDraftWhy(null)
                    }
                  }}
                  style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '1rem', padding: 8, borderRadius: 8, border: '1.5px solid #2563eb', background: 'var(--surface)', color: 'var(--text)' }}
                />
                {draftWhy && (
                  <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)', marginTop: 4 }}>
                    {draftWhy}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button type="button" onClick={() => void keepNote()} aria-disabled={writing} style={{ ...press, background: '#2563eb', color: '#fff', borderColor: '#2563eb', fontWeight: 600 }}>
                    {writing ? 'Keeping…' : 'Keep the note'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(null)
                      setDraftWhy(null)
                    }}
                    style={press}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ResponsiveModalShell>
  )
}

function SheetNotesList({ notes, authUserId, onDelete, onAdd, adding }: { notes: ReturnType<typeof sheetNotes>; authUserId: string | null; onDelete: (id: string) => void; onAdd: () => void; adding: boolean }) {
  if (notes.length === 0) {
    const words = emptyWords({ kind: 'make', noun: 'notes', control: 'Add a note' })
    return adding ? <div style={quiet}>{words.main}</div> : <EmptyState {...emptyWordsWithPress(words, { onPress: onAdd })} />
  }
  return (
    <div data-roll-notes>
      {notes.map((n) => (
        <div key={n.id} data-roll-note={n.id} style={line}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ color: 'var(--text-muted)' }}>{formatCompactNoteDateTime(n.noted_at)}</span> <b>{n.noted_by_name || 'Someone here'}</b>
              {n.onAnotherLicense && (
                <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 999, padding: '0 8px', whiteSpace: 'nowrap' }}>
                  On their {classWords(n.license_class).toLowerCase()} license, same name and ZIP
                </span>
              )}
              <div style={{ marginTop: 2, whiteSpace: 'pre-wrap' }}>{n.body}</div>
            </div>
            {authUserId && n.noted_by === authUserId && (
              <button type="button" onClick={() => onDelete(n.id)} aria-label="Delete my note" style={{ ...press, minHeight: 44, padding: '6px 10px', fontSize: '0.8125rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
