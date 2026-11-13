/**
 * A tech's page for one look (punch list #319 PR 7): `/first-look/<id>`, the link on the task the office sent with
 * **Ask a tech…**. It shows that one look, the customer's photos, video and words, and nothing else of the thread. The
 * person it was asked of answers one of two ways with a note, and the answer lands on the thread as a team note. Who
 * may open it is the database's call (the office, the asked tech, the crew of the job made from it): a look the
 * reader may not see reads as no look, and the page says so in words.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { LookFile } from '../components/firstLook/LookFile'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from '../hooks/useAuth'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../lib/deadPress'
import { LOOK_CARD_WORDS, lookAskedWords, type ThreadLook, type ThreadLookFile } from '../lib/firstLook/card'
import { TECH_READ_WORDS, techReadLine, type TechRead } from '../lib/firstLook/tech'
import { supabaseFirstLookThreadIo, type FirstLookThreadIo } from '../lib/firstLook/threadIo'
import { canOpenMessages } from '../lib/gc/access'
import { formatDenverCalendarDayShort } from '../utils/dateUtils'
import { formatErrorMessage } from '../utils/errorHandling'

const DEFAULT_IO = supabaseFirstLookThreadIo()
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const page: CSSProperties = { maxWidth: 640, margin: '0 auto', padding: '1rem', display: 'grid', gap: '0.9rem' }
const box: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.8rem', display: 'grid', gap: '0.6rem' }
const choice = (on: boolean): CSSProperties => ({
  minHeight: 48,
  borderRadius: 10,
  padding: '0.5rem 0.8rem',
  font: 'inherit',
  fontWeight: 700,
  cursor: 'pointer',
  textAlign: 'left',
  border: `2px solid ${on ? 'var(--border-blue)' : 'var(--border-strong)'}`,
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: 'var(--text-strong)',
})

export default function FirstLookRead({ io = DEFAULT_IO }: { io?: FirstLookThreadIo }) {
  const { id } = useParams()
  const { user, role } = useAuth()
  const { showToast } = useToastContext()
  const lookId = id && UUID_RE.test(id) ? id : null
  const [read, setRead] = useState<{ look: ThreadLook; files: ThreadLookFile[]; urls: Record<string, string> } | 'none' | null>(null)
  const [pick, setPick] = useState<TechRead | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const load = useCallback(async () => {
    if (!lookId) return setRead('none')
    try {
      const got = await io.lookById(lookId)
      if (!got) return setRead('none')
      const urls = await io.signLookFiles(got.files.map((f) => f.storage_path)).catch(() => ({}))
      setRead({ ...got, urls })
    } catch {
      setRead('none')
    }
  }, [io, lookId])

  useEffect(() => {
    void load()
  }, [load])

  if (read === null) return null
  if (read === 'none') {
    return (
      <div style={page} data-first-look-read="none">
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>{TECH_READ_WORDS.pageHead}</h1>
        <p style={{ margin: 0 }}>{TECH_READ_WORDS.notYours}</p>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>{TECH_READ_WORDS.notYoursHint}</p>
      </div>
    )
  }

  const { look, files, urls } = read
  const asked = Boolean(user?.id && look.asked_tech_ids?.includes(user.id))
  const mayAnswer = asked || canOpenMessages(role)
  const answered = techReadLine(look)
  let photoAt = 0
  let videoAt = 0

  const send = async () => {
    if (!pick) return showToast(TECH_READ_WORDS.pickFirst, 'error')
    setBusy(true)
    try {
      await io.answer(look.id, pick, note.trim() || null)
      setSent(true)
      showToast(TECH_READ_WORDS.sent, 'success')
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Your answer was not sent.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={page} data-first-look-read={look.id}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>{TECH_READ_WORDS.pageHead}</h1>
        <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {lookAskedWords(look, formatDenverCalendarDayShort(Date.parse(look.made_at)))}. {TECH_READ_WORDS.pageAsk}
        </p>
      </div>
      <section style={box} aria-label="What the customer sent">
        {files.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {files.map((f) => (
              <LookFile key={f.id} kind={f.kind} url={urls[f.storage_path]} label={f.kind === 'photo' ? `Photo ${++photoAt}` : `Video ${++videoAt}`} texted={false} />
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)' }}>{TECH_READ_WORDS.noFiles}</div>
        )}
        {(look.words?.trim() || look.place?.trim()) && (
          <div>
            <span style={{ color: 'var(--text-muted)' }}>{look.place?.trim() ? `${look.place.trim()}. ` : ''}</span>
            {look.words?.trim() && (
              <>
                <span style={{ color: 'var(--text-muted)' }}>{LOOK_CARD_WORDS.theirWords}: </span>
                {look.words.trim()}
              </>
            )}
          </div>
        )}
      </section>
      {answered && (
        <p data-tech-read style={{ margin: 0, fontWeight: 600 }}>
          {answered}
        </p>
      )}
      {mayAnswer ? (
        <section style={box} aria-label="Your answer">
          <div role="radiogroup" aria-label="Your read" style={{ display: 'grid', gap: '0.5rem' }}>
            {(['can_price', 'needs_visit'] as const).map((r) => (
              <button key={r} type="button" role="radio" aria-checked={pick === r} style={choice(pick === r)} onClick={() => setPick(r)}>
                {TECH_READ_WORDS[r]}
              </button>
            ))}
          </div>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.9rem' }}>
            {TECH_READ_WORDS.noteLabel}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder={TECH_READ_WORDS.notePlaceholder} style={{ font: 'inherit', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)' }} />
          </label>
          <button
            type="button"
            disabled={busy || !pick}
            title={pick ? undefined : TECH_READ_WORDS.pickFirst}
            onClick={() => void send()}
            style={{ minHeight: 48, borderRadius: 10, border: 'none', font: 'inherit', fontWeight: 700, ...(busy || !pick ? { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'not-allowed' } : { background: '#2563eb', color: 'white', cursor: 'pointer' }) }}
          >
            {TECH_READ_WORDS.send}
          </button>
          {sent && (
            <p role="status" style={{ margin: 0, color: 'var(--text-green-700)' }}>
              {TECH_READ_WORDS.sent}
            </p>
          )}
        </section>
      ) : (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>{TECH_READ_WORDS.readOnly}</p>
      )}
    </div>
  )
}
