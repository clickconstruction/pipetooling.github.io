import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import {
  AWAY_NOTE_DEFAULT,
  AWAY_NOTE_WORDS_MAX,
  AWAY_WORDS,
  awayNoteChipWords,
  awayNoteFootWords,
  awayNoteHelp,
  awayNoteProblem,
  buildAwayScreen,
  type AwayNoteDraft,
  type AwayOffice,
} from '../../lib/people/awayNote'
import { clearAwayNote, loadAwayNote, loadAwayOffice, saveAwayNote } from '../../lib/people/awayNoteIo'
import { AwayScreen } from '../away/AwayScreen'
import { BTN, BTN_BLUE, BTN_QUIET, BTN_RED, DESK_EDITOR_Z, deskBtn } from './personDeskShared'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * Leave a note (punch list #256 PR 8, v2.6587): the window on an archived desk, and in End employment, where the
 * office writes the one screen a teammate who left will see. The note in the office's words, a countdown to the day
 * back, whether the screen shows where the office is and the office line, and whether the office wants a Needs you
 * item on the day (PR 9). The right side is their screen, drawn by the same `AwayScreen` the sealed sign-in draws,
 * and it changes as the office types (the mock-up's draft 2, Taunya's ask of 2026-11-03: *"I would like to see a
 * preview of what they see"*). A *Today · On the day* switch shows the screen the countdown ends on. On a phone the
 * preview drops under the switches with a Preview link at the top. Save goes through the `away-note` function: a note
 * on an archived login opens their sign-in to this screen; Take the note down closes it again.
 */

const NARROW = '(max-width: 860px)'

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(NARROW).matches : false))
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(NARROW)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return narrow
}

const SWITCH_ROW: CSSProperties = { display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '0.6rem', alignItems: 'start', padding: '0.6rem 0', borderTop: '1px solid var(--border)', cursor: 'pointer' }
const SWITCH_SUB: CSSProperties = { display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }

export function PersonDeskAwayNoteModal({
  userId,
  displayName,
  archived,
  hasLogin,
  leftYmd = null,
  readOnly,
  onClose,
  onChanged,
}: {
  userId: string
  displayName: string
  /** The account half is archived: Save opens their sign-in to the screen. */
  archived: boolean
  /** A login stands behind the row (`users.login_attached_at`); with none, nothing opens. */
  hasLogin: boolean
  /** The day their employment ended, for the preview's bar; today stands in when the desk does not know it. */
  leftYmd?: string | null
  readOnly: boolean
  onClose: () => void
  onChanged?: () => void
}) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const narrow = useNarrow()
  const todayYmd = todayYmdInAppTz()
  const firstName = displayName.trim().split(/\s+/)[0] || null
  const [draft, setDraft] = useState<AwayNoteDraft>(AWAY_NOTE_DEFAULT)
  const [hadNote, setHadNote] = useState(false)
  const [updatedYmd, setUpdatedYmd] = useState<string | null>(null)
  const [office, setOffice] = useState<AwayOffice | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'save' | 'clear' | null>(null)
  const [onTheDay, setOnTheDay] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let on = true
    void Promise.all([loadAwayNote(userId), loadAwayOffice().catch(() => null)])
      .then(([note, off]) => {
        if (!on) return
        setDraft(note.draft)
        setHadNote(note.row != null)
        setUpdatedYmd(note.row?.updated_at ? note.row.updated_at.slice(0, 10) : null)
        setOffice(off)
      })
      .catch((e: unknown) => on && setError(formatErrorMessage(e, 'Could not read the note')))
      .finally(() => on && setLoaded(true))
    return () => {
      on = false
    }
  }, [userId])
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const problem = useMemo(() => awayNoteProblem(draft, todayYmd), [draft, todayYmd])
  const screen = useMemo(
    () => buildAwayScreen({ draft, firstName, now, leftYmd: leftYmd ?? todayYmd, updatedYmd, todayYmd, office, onTheDay: onTheDay && draft.countdownYmd != null }),
    [draft, firstName, now, leftYmd, updatedYmd, todayYmd, office, onTheDay],
  )
  const set = (patch: Partial<AwayNoteDraft>) => setDraft((d) => ({ ...d, ...patch }))

  async function save() {
    if (problem || readOnly) return
    setBusy('save')
    setError(null)
    try {
      const { sealed } = await saveAwayNote(userId, draft)
      showToast(sealed ? `${displayName}'s sign-in now opens to the note.` : `Note for ${displayName} saved.`, 'success')
      onChanged?.()
      onClose()
    } catch (e) {
      setError(formatErrorMessage(e, 'The note did not save'))
    } finally {
      setBusy(null)
    }
  }

  async function takeDown() {
    if (readOnly) return
    const ok = await confirmDialog({
      message: archived && hasLogin ? `Take ${displayName}'s note down? Their sign-in closes again until they are brought back.` : `Take ${displayName}'s note down?`,
      confirmLabel: 'Take the note down',
      danger: true,
    })
    if (!ok) return
    setBusy('clear')
    setError(null)
    try {
      await clearAwayNote(userId)
      showToast(`${displayName}'s note is down.`, 'success')
      onChanged?.()
      onClose()
    } catch (e) {
      setError(formatErrorMessage(e, 'The note did not come down'))
    } finally {
      setBusy(null)
    }
  }

  const title = `Leave a note for ${displayName}`
  const preview = (
    <div id="away-note-preview" style={{ background: 'var(--bg-subtle)', borderLeft: narrow ? 'none' : '1px solid var(--border)', borderTop: narrow ? '1px solid var(--border)' : 'none', padding: '12px 16px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>What {firstName ?? 'they'} {firstName ? 'sees' : 'see'}</span>
        <span role="group" aria-label="Preview day" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
          {(
            [
              [false, 'Today'],
              [true, 'On the day'],
            ] as const
          ).map(([v, label]) => (
            <button key={label} type="button" aria-pressed={onTheDay === v} disabled={v && draft.countdownYmd == null} onClick={() => setOnTheDay(v)} style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 700, border: 'none', padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', background: onTheDay === v ? 'var(--text-strong)' : 'transparent', color: onTheDay === v ? 'var(--surface)' : 'var(--text-muted)' }}>
              {label}
            </button>
          ))}
        </span>
      </div>
      <div style={{ margin: '0 auto', width: 343, maxWidth: '100%', background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)', borderRadius: 22, overflow: 'hidden' }}>
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.875rem' }}>
          ClickTooling <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{AWAY_WORDS.signOut}</span>
        </div>
        <div style={{ padding: '16px 14px 18px' }}>
          <AwayScreen screen={screen} preview />
        </div>
      </div>
      <div style={{ fontSize: '0.71875rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>{AWAY_WORDS.previewFoot}</div>
    </div>
  )

  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: DESK_EDITOR_Z, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(920px, 96vw)', maxHeight: 'min(92vh, 100%)', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ padding: '0.85rem 1rem 0.55rem', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>{title}</h2>
            {narrow ? (
              <a href="#away-note-preview" style={{ fontSize: '0.75rem', color: 'var(--text-link)' }}>
                Preview
              </a>
            ) : null}
            <button type="button" aria-label="Close" onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)' }}>
              ×
            </button>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hadNote ? awayNoteChipWords(archived) : 'The one screen they see while they are away. Nothing else opens.'}</span>
          {error ? (
            <span role="alert" style={{ fontSize: '0.75rem', color: 'var(--text-red-600)' }}>
              {error}
            </span>
          ) : null}
        </div>

        <div style={{ overflow: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 375px' }}>
            <div style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem' }}>
              <label htmlFor="away-note-words" style={{ display: 'block', fontWeight: 700, marginBottom: 4, color: 'var(--text-strong)' }}>
                The note
              </label>
              <textarea
                id="away-note-words"
                rows={5}
                value={draft.words}
                maxLength={AWAY_NOTE_WORDS_MAX + 50}
                disabled={!loaded || busy != null}
                onChange={(e) => set({ words: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', resize: 'vertical', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--surface)', color: 'var(--text-strong)' }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>
                {awayNoteHelp(firstName)} {draft.words.length > AWAY_NOTE_WORDS_MAX - 100 ? `${draft.words.length.toLocaleString('en-US')} of ${AWAY_NOTE_WORDS_MAX}.` : ''}
              </div>

              <label style={{ ...SWITCH_ROW, marginTop: 10 }}>
                <input type="checkbox" checked={draft.countdownYmd != null} disabled={busy != null} onChange={(e) => set({ countdownYmd: e.target.checked ? draft.countdownYmd ?? '' : null, alertOnDay: e.target.checked ? draft.alertOnDay : false })} aria-label="Count down to the day back" />
                <span>
                  <b>Count down to the day back</b>
                  <span style={SWITCH_SUB}>Days, hours and minutes, with a bar for how far along they are.</span>
                  {draft.countdownYmd != null ? <input type="date" value={draft.countdownYmd} min={todayYmd} disabled={busy != null} onChange={(e) => set({ countdownYmd: e.target.value })} aria-label="The day back" style={{ marginTop: 5, font: 'inherit', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 9px', background: 'var(--surface)', color: 'var(--text-strong)' }} /> : null}
                </span>
              </label>
              <label style={SWITCH_ROW}>
                <input type="checkbox" checked={draft.showWhere} disabled={busy != null} onChange={(e) => set({ showWhere: e.target.checked })} aria-label="Show where we are" />
                <span>
                  <b>Show where we are</b>
                  <span style={SWITCH_SUB}>{office?.address ? `${office.address}, from Settings → Office address.` : 'The office address from Settings → Office address. None is set yet.'} They can press a button to see how far away they are.</span>
                </span>
              </label>
              <label style={SWITCH_ROW}>
                <input type="checkbox" checked={draft.showCall} disabled={busy != null} onChange={(e) => set({ showCall: e.target.checked })} aria-label="Call or text button" />
                <span>
                  <b>Call or text button</b>
                  <span style={SWITCH_SUB}>{office?.phone ? `The office line, ${office.phone}.` : 'The office line, from Settings → Templates → Dispatch phone. None is set yet.'}</span>
                </span>
              </label>
              <label style={{ ...SWITCH_ROW, opacity: draft.countdownYmd == null ? 0.6 : 1 }}>
                <input type="checkbox" checked={draft.alertOnDay} disabled={busy != null || draft.countdownYmd == null} onChange={(e) => set({ alertOnDay: e.target.checked })} aria-label="Tell me when the countdown ends" />
                <span>
                  <b>Tell me when the countdown ends</b>
                  <span style={SWITCH_SUB}>{AWAY_WORDS.alertHelp}</span>
                </span>
              </label>
              {problem ? (
                <div role="alert" style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-red-600)' }}>
                  {problem}
                </div>
              ) : null}
            </div>
            {preview}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 1rem', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)', fontSize: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', maxWidth: '48ch' }}>{awayNoteFootWords(firstName, { archived, hasLogin })}</span>
          <span style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto' }}>
            {hadNote ? (
              <button type="button" style={deskBtn(BTN_RED, busy != null || readOnly)} disabled={busy != null || readOnly} onClick={() => void takeDown()}>
                {busy === 'clear' ? 'Taking down…' : 'Take the note down'}
              </button>
            ) : (
              <button type="button" style={BTN_QUIET} onClick={onClose} disabled={busy != null}>
                Cancel
              </button>
            )}
            <button type="button" style={deskBtn(loaded && !problem && !readOnly ? BTN_BLUE : BTN, !loaded || problem != null || busy != null || readOnly)} disabled={!loaded || problem != null || busy != null || readOnly} onClick={() => void save()}>
              {busy === 'save' ? 'Saving…' : 'Save note'}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
