import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { PhoneSheet } from '../PhoneSheet'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'
import { ChangeableValue, ValueLine, ValueLines, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { useVoiceNote, type VoiceNoteWindow } from '../../hooks/useVoiceNote'
import { mergeHeard, voicePressLabel } from '../../lib/reports/voiceNote'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { APP_CALENDAR_TZ, formatDenverTimeOnly, todayYmdInAppTz } from '../../utils/dateUtils'
import { writeUpIo, type WriteUpIo } from '../../lib/people/writeUpIo'
import { shrinkPhoto } from '../../lib/materials/photoShrink'
import { mintPressId } from '../../lib/offline/pressThroughOutbox'
import { canAddPhoto, WRITE_UP_PHOTO_WORDS, type WriteUpDraftPhoto } from '../../lib/people/writeUpPhotos'
import {
  additionDraft,
  canAddTo,
  canTakeBack,
  firstName,
  KEPT_WRITE_UP_STATE_WORDS,
  keptWriteUpLine,
  MY_WRITE_UP_STATE_WORDS,
  myWriteUpLine,
  myWriteUpNote,
  myWriteUpState,
  myWriteUpsHeadline,
  newWriteUpDraft,
  parseWriteUpTime,
  searchWriteUpPeople,
  splitWriteUpPeople,
  TALKED_CHOICES,
  talkedQuestion,
  timeWords,
  todayGroupTitle,
  toggleSeen,
  witnessChoices,
  WRITE_UP_KINDS,
  WRITE_UP_MAX_WORDS,
  WRITE_UP_WORDS,
  writeUpDayWords,
  writeUpDraftStarted,
  writeUpJobLabel,
  writeUpFields,
  writeUpMissing,
  writeUpPersonLine,
  writeUpReadBack,
  writeUpVoiceWords,
  type KeptWriteUp,
  type MyWriteUpRow,
  type MyWriteUpState,
  type WriteUpDraft,
  type WriteUpList,
  type WriteUpPerson,
} from '../../lib/people/writeUp'

/**
 * Write someone up (punch list #410): the sheet behind the Dashboard's press. Four steps in one window: who it is
 * about (the crew on the job today first), what happened (who, when and which job filled in, a kind, the words typed
 * or spoken), the read-back, and the writer's own write-ups. Nothing is saved until **Send write-up to HR** on the
 * read-back. The draft lives with the caller (`onDraft`), so a stray press outside the sheet closes it and loses
 * nothing. The send goes through the outbox (PR 4): with no signal the write-up is kept on the phone, listed as
 * *Waiting for signal*, and sent when the signal is back, once. Up to four photos ride with it (PR 5): each is shrunk
 * on the phone, sent ahead of the write-up, or kept on the phone with it when there is no signal. The rules and the
 * words are `lib/people/writeUp.ts` and `writeUpPhotos.ts`. `io`, `now`, `voiceWindow` and `shrink` are the smoke's seams.
 */

type Step = 'who' | 'what' | 'read' | 'mine'

const PRESS_BLUE = '#2563eb'
const NO_JOB = 'none'

const press: CSSProperties = { minHeight: 52, borderRadius: 10, fontFamily: 'inherit', fontSize: '1rem', fontWeight: 700, padding: '0 0.9rem', cursor: 'pointer', flex: 1 }
const primaryPress: CSSProperties = { ...press, border: 'none', background: PRESS_BLUE, color: '#fff' }
const quietPress: CSSProperties = { ...press, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)' }
const deadPress: CSSProperties = { ...press, border: 'none', background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }
const linkPress: CSSProperties = { minHeight: 44, border: 'none', background: 'none', padding: '0 0.75rem 0 0', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 650, color: 'var(--text-link)', cursor: 'pointer' }
const headPress: CSSProperties = { width: 48, height: 48, border: 'none', background: 'none', fontFamily: 'inherit', fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', flex: 'none' }
const groupHead: CSSProperties = { margin: 0, padding: '0.7rem 0.9rem 0.3rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const fieldHead: CSSProperties = { display: 'block', fontWeight: 700, fontSize: '0.95rem', margin: '1rem 0 0.45rem' }
const hintLine: CSSProperties = { margin: '0.4rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }
const textBox: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', color: 'inherit', fontFamily: 'inherit', fontSize: '1rem', padding: '0.65rem 0.75rem' }

const chip = (on: boolean): CSSProperties => ({
  minHeight: 46,
  padding: '0 0.9rem',
  borderRadius: 23,
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
  border: `1px solid ${on ? PRESS_BLUE : 'var(--border-strong)'}`,
  background: on ? PRESS_BLUE : 'var(--surface)',
  color: on ? '#fff' : 'var(--text-base)',
})

const STATE_TONE: Record<MyWriteUpState, CSSProperties> = {
  waiting: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  filed: { background: 'var(--bg-subtle)', color: 'var(--text-green-700)' },
  set_aside: { background: 'var(--bg-muted)', color: 'var(--text-muted)' },
  taken_back: { background: 'var(--bg-muted)', color: 'var(--text-muted)' },
}

/** Now on the app's clock: the day and the time of day a new draft starts with. */
function nowOnAppClock(at: Date): { ymd: string; hhmm: string } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: APP_CALENDAR_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(at)
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return { ymd: todayYmdInAppTz(at), hhmm: `${part('hour') === '24' ? '00' : part('hour')}:${part('minute')}` }
}

const clockTime = (iso: string): string => formatDenverTimeOnly(Date.parse(iso)).toLowerCase()

export interface WriteUpSheetProps {
  userId: string
  /** A draft kept from an earlier open of the sheet. */
  initialDraft: WriteUpDraft | null
  /** Every change to the draft, and null once it is sent: the caller keeps it while the sheet is closed. */
  onDraft: (draft: WriteUpDraft | null) => void
  onClose: () => void
  io?: WriteUpIo
  now?: () => Date
  voiceWindow?: VoiceNoteWindow | null
  shrink?: typeof shrinkPhoto
}

export function WriteUpSheet({ userId, initialDraft, onDraft, onClose, io = writeUpIo, now = () => new Date(), voiceWindow, shrink = shrinkPhoto }: WriteUpSheetProps) {
  const [step, setStep] = useState<Step>(initialDraft ? 'what' : 'who')
  const [list, setList] = useState<WriteUpList | null>(null)
  const [listFailure, setListFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [listBusy, setListBusy] = useState(true)
  const [mine, setMine] = useState<MyWriteUpRow[] | null>(null)
  const [mineFailure, setMineFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [draft, setDraftState] = useState<WriteUpDraft | null>(initialDraft)
  const [query, setQuery] = useState('')
  const [otherName, setOtherName] = useState('')
  const [otherOpen, setOtherOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendFailure, setSendFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [sentAt, setSentAt] = useState<string | null>(null)
  const [keptAt, setKeptAt] = useState<string | null>(null)
  /** The same time, readable by the outbox's listener, which outlives the render that set it. */
  const keptAtRef = useRef<string | null>(null)
  const [kept, setKept] = useState<KeptWriteUp[]>(() => io.kept(userId))
  const [takeBack, setTakeBack] = useState<{ id: string; reason: string; busy: boolean; failure: string | null } | null>(null)
  /** The moment Send was first pressed on this read-back: a Retry keeps it. */
  const pressedAtRef = useRef<number | null>(null)
  const photoInput = useRef<HTMLInputElement | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoFailure, setPhotoFailure] = useState<string | null>(null)

  /** The newest draft, for a handler that fires before the next draw: two quick presses never undo each other. */
  const draftRef = useRef<WriteUpDraft | null>(initialDraft)
  const setDraft = useCallback(
    (next: WriteUpDraft | null) => {
      draftRef.current = next
      setDraftState(next)
      onDraft(next)
    },
    [onDraft],
  )
  /** Leaving a draft with nothing in it drops it: a person picked by mistake is not a write-up left unfinished. */
  const dropIfEmpty = useCallback(() => {
    const current = draftRef.current
    if (current && !writeUpDraftStarted(current)) setDraft(null)
  }, [setDraft])
  const leave = useCallback(() => {
    dropIfEmpty()
    onClose()
  }, [dropIfEmpty, onClose])
  /** One change to the form, worked out from the newest draft. */
  const patch = useCallback(
    (change: (d: WriteUpDraft) => Partial<WriteUpDraft>) => {
      const current = draftRef.current
      if (current) setDraft({ ...current, ...change(current) })
    },
    [setDraft],
  )

  const loadList = useCallback(async () => {
    setListBusy(true)
    try {
      setList(await io.list())
      setListFailure(null)
    } catch (e) {
      setListFailure(recoveryFailureFromError(e, WRITE_UP_WORDS.loadFailed))
    } finally {
      setListBusy(false)
    }
  }, [io])

  const loadMine = useCallback(async () => {
    try {
      setMine(await io.mine(userId))
      setMineFailure(null)
    } catch (e) {
      setMineFailure(recoveryFailureFromError(e, WRITE_UP_WORDS.mineFailed))
    }
  }, [io, userId])

  useEffect(() => {
    void loadList()
    void loadMine()
  }, [loadList, loadMine])

  // A kept write-up that lands, or is refused, changes both lists: the phone's and the server's.
  useEffect(
    () =>
      io.onKeptChange(() => {
        const next = io.kept(userId)
        setKept(next)
        // The note that says one is kept goes once none waits. It has gone, so the note says sent, or it was
        // refused, and its own line says why.
        if (keptAtRef.current && !next.some((k) => k.state === 'waiting')) {
          keptAtRef.current = null
          setKeptAt(null)
          if (next.length === 0) setSentAt(clockTime(new Date().toISOString()))
        }
        void loadMine()
      }),
    [io, userId, loadMine],
  )

  const today = list?.today || todayYmdInAppTz(now())
  const groups = useMemo(() => splitWriteUpPeople({ people: list?.people ?? [], today }), [list, today])
  const found = useMemo(() => searchWriteUpPeople(list?.people ?? [], query), [list, query])
  const nameOf = useMemo(() => new Map((list?.people ?? []).map((p) => [p.person_id, p] as const)), [list])

  const voice = useVoiceNote(
    (heard) => {
      patch((d) => ({ words: mergeHeard(d.words, heard) }))
    },
    voiceWindow,
  )
  const voiceWords = writeUpVoiceWords(voice.state)

  /** One shot from the camera or the library: shrunk on the phone, then a tile on the draft. */
  const addPhoto = async (file: File | undefined) => {
    if (!file || !draft || !canAddPhoto(draft.photos.length)) return
    setPhotoBusy(true)
    setPhotoFailure(null)
    try {
      const shrunk = await shrink(file)
      let url = ''
      try {
        url = URL.createObjectURL(shrunk.blob)
      } catch {
        // a page that cannot make one draws the tile without a picture
      }
      const photo: WriteUpDraftPhoto = { id: mintPressId(), blob: shrunk.blob, url, takenAt: now().toISOString(), originalBytes: file.size, width: shrunk.width, height: shrunk.height }
      patch((d) => ({ photos: [...d.photos, photo] }))
    } catch {
      setPhotoFailure(WRITE_UP_PHOTO_WORDS.failed)
    } finally {
      setPhotoBusy(false)
      if (photoInput.current) photoInput.current.value = ''
    }
  }

  const dropPhoto = (id: string) => {
    const gone = draftRef.current?.photos.find((p) => p.id === id)
    if (gone?.url) URL.revokeObjectURL(gone.url)
    patch((d) => ({ photos: d.photos.filter((p) => p.id !== id) }))
  }

  const pick = (person: WriteUpPerson) => {
    if (!list) return
    setDraft(newWriteUpDraft(person, list, nowOnAppClock(now())))
    setQuery('')
    setStep('what')
  }

  const readBack = () => {
    if (!draft || writeUpMissing(draft)) return
    pressedAtRef.current = null
    setSendFailure(null)
    setStep('read')
  }

  const send = async () => {
    if (!draft || sending) return
    setSending(true)
    setSendFailure(null)
    pressedAtRef.current ??= now().getTime()
    try {
      const sent = await io.send(userId, writeUpFields(draft), pressedAtRef.current, draft.photos)
      if (sent.kind === 'refused') {
        setSendFailure({ kind: 'server', message: `${WRITE_UP_WORDS.sendFailed.replace(/\.$/, '')}: ${sent.message}` })
        return
      }
      if (sent.kind === 'failed') {
        setSendFailure(recoveryFailureFromError(sent.error, WRITE_UP_WORDS.sendFailed))
        return
      }
      for (const p of draft.photos) if (p.url) URL.revokeObjectURL(p.url)
      const at = clockTime(new Date(pressedAtRef.current).toISOString())
      setSentAt(sent.kind === 'landed' ? at : null)
      setKeptAt(sent.kind === 'queued' ? at : null)
      keptAtRef.current = sent.kind === 'queued' ? at : null
      setDraft(null)
      pressedAtRef.current = null
      setKept(io.kept(userId))
      await loadMine()
      setStep('mine')
    } catch (e) {
      setSendFailure(recoveryFailureFromError(e, WRITE_UP_WORDS.sendFailed))
    } finally {
      setSending(false)
    }
  }

  const runTakeBack = async () => {
    if (!takeBack || takeBack.busy || takeBack.reason.trim() === '') return
    setTakeBack({ ...takeBack, busy: true, failure: null })
    try {
      await io.takeBack(takeBack.id, takeBack.reason.trim())
      setTakeBack(null)
      await loadMine()
    } catch (e) {
      setTakeBack({ ...takeBack, busy: false, failure: recoveryFailureFromError(e, WRITE_UP_WORDS.takeBackFailed).message })
    }
  }

  const addTo = (row: MyWriteUpRow) => {
    const person = nameOf.get(row.subject_person_id)
    if (!person || !list) return
    setDraft(additionDraft({ id: row.id, kind: row.kind }, person, list, nowOnAppClock(now())))
    setStep('what')
  }

  const back =
    step === 'what'
      ? () => {
          const to = draft?.addsTo ? 'mine' : 'who'
          dropIfEmpty()
          setStep(to)
        }
      : step === 'read'
        ? () => setStep('what')
        : null
  const title = step === 'who' ? WRITE_UP_WORDS.whoTitle : step === 'what' ? WRITE_UP_WORDS.whatTitle : step === 'read' ? WRITE_UP_WORDS.readTitle : WRITE_UP_WORDS.mineTitle

  // ── who ──────────────────────────────────────────────────────────────────

  const personRow = (p: WriteUpPerson) => (
    <button
      key={p.person_id}
      type="button"
      onClick={() => pick(p)}
      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', minHeight: 60, padding: '0.4rem 0.9rem', border: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 650, fontSize: '1rem' }}>{p.name}</span>
        <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{writeUpPersonLine(p, today, clockTime)}</span>
      </span>
      <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '1.25rem' }}>
        ›
      </span>
    </button>
  )

  const group = (head: string, people: WriteUpPerson[]) =>
    people.length === 0 ? null : (
      <section key={head} aria-label={head}>
        <h3 style={groupHead}>{head}</h3>
        {people.map(personRow)}
      </section>
    )

  const whoBody = (): ReactNode => {
    if (listFailure) return <OfflineRetryPanel failure={listFailure} onRetry={loadList} surface="write-up-people" idempotent busy={listBusy} style={{ margin: '1rem 0.9rem' }} />
    if (!list) return <p style={{ margin: 0, padding: '1.5rem 0.9rem', color: 'var(--text-muted)' }}>{WRITE_UP_WORDS.loading}</p>
    if (!list.allowed) return <p style={{ margin: 0, padding: '1.5rem 0.9rem' }}>{WRITE_UP_WORDS.notAllowed}</p>
    const searching = query.trim() !== ''
    return (
      <>
        <div style={{ padding: '0.75rem 0.9rem 0.25rem' }}>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={WRITE_UP_WORDS.search} aria-label={WRITE_UP_WORDS.search} style={{ ...textBox, minHeight: 48 }} />
        </div>
        {searching ? (
          found.length > 0 ? (
            found.map(personRow)
          ) : (
            <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'people', query }), { onPress: () => setQuery('') })} />
          )
        ) : (
          <>
            {group(todayGroupTitle(groups.today), groups.today)}
            {group(WRITE_UP_WORDS.week, groups.week)}
            {group(WRITE_UP_WORDS.rest, groups.rest)}
          </>
        )}
      </>
    )
  }

  // ── what ─────────────────────────────────────────────────────────────────

  const whatBody = (d: WriteUpDraft): ReactNode => {
    const jobChoices = [...(list?.jobs ?? []).map((j) => ({ value: j.job_id, label: writeUpJobLabel(j) })), { value: NO_JOB, label: WRITE_UP_WORDS.noJob }]
    if (d.job && !jobChoices.some((c) => c.value === d.job?.id)) jobChoices.unshift({ value: d.job.id, label: d.job.label })
    const witnesses = list ? witnessChoices(list, d) : []
    const typed = d.seenBy.filter((s) => !s.person_id)
    return (
      <>
        <div style={{ padding: '0.5rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
          <ValueLines>
            <ValueLine label={WRITE_UP_WORDS.about}>
              <WorkedOutValue>{d.person.name}</WorkedOutValue>
            </ValueLine>
            <ValueLine label={WRITE_UP_WORDS.when}>
              <ChangeableValue text={writeUpDayWords(d.date, today)} label="the day it happened" type="date" value={d.date} max={today} onKeep={(v) => patch(() => ({ date: v }))} />{' '}
              <ChangeableValue
                text={timeWords(d.time) || 'no time'}
                label="the time it happened"
                type="text"
                value={timeWords(d.time)}
                canClear
                hint="Like 12:20 pm"
                check={(v) => (v.trim() === '' || parseWriteUpTime(v) ? null : 'Type a time like 12:20 pm.')}
                onKeep={(v) => patch(() => ({ time: parseWriteUpTime(v) ?? '' }))}
              />
            </ValueLine>
            <ValueLine label={WRITE_UP_WORDS.job}>
              <ChangeableValue
                text={d.job?.label ?? WRITE_UP_WORDS.noJob}
                label="the job it happened on"
                type="choice"
                value={d.job?.id ?? NO_JOB}
                choices={jobChoices}
                onKeep={(v) => patch((d) => ({ job: v === NO_JOB ? null : { id: v, label: jobChoices.find((c) => c.value === v)?.label ?? '' }, seenBy: d.seenBy.filter((s) => !s.person_id) }))}
              />
            </ValueLine>
          </ValueLines>
        </div>
        <div style={{ padding: '0 0.9rem 1rem' }}>
          <span style={fieldHead} id="write-up-kind">
            {WRITE_UP_WORDS.kind}
          </span>
          <div role="group" aria-labelledby="write-up-kind" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {WRITE_UP_KINDS.map((k) => (
              <button key={k.key} type="button" aria-pressed={d.kind === k.key} onClick={() => patch(() => ({ kind: k.key }))} style={chip(d.kind === k.key)}>
                {k.label}
              </button>
            ))}
          </div>

          <label style={fieldHead} htmlFor="write-up-words">
            {WRITE_UP_WORDS.words}
          </label>
          <textarea id="write-up-words" rows={5} value={d.words} maxLength={WRITE_UP_MAX_WORDS} onChange={(e) => patch(() => ({ words: e.target.value }))} placeholder={WRITE_UP_WORDS.wordsPlaceholder} style={{ ...textBox, resize: 'vertical', lineHeight: 1.45 }} />
          <button type="button" onClick={voice.press} aria-label={voicePressLabel(voice.state)} style={{ ...quietPress, flex: 'none', width: '100%', minHeight: 48, marginTop: '0.5rem', color: 'var(--text-link)', fontWeight: 650, textAlign: 'left' }}>
            {voiceWords.title}
          </button>
          <p style={hintLine}>{voiceWords.hint}</p>
          <p style={hintLine}>{WRITE_UP_WORDS.wordsHint}</p>

          <span style={fieldHead} id="write-up-photos">
            {WRITE_UP_PHOTO_WORDS.field}
          </span>
          <div role="group" aria-labelledby="write-up-photos" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {d.photos.map((p, i) => (
              <div key={p.id} data-write-up-photo style={{ position: 'relative', width: 84, height: 84, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--bg-muted)' }}>
                {p.url ? <img src={p.url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <span style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Photo {i + 1}</span>}
                <button type="button" onClick={() => dropPhoto(p.id)} aria-label={`${WRITE_UP_PHOTO_WORDS.remove}, photo ${i + 1}`} style={{ position: 'absolute', top: 0, right: 0, width: 44, height: 44, border: 'none', background: 'none', fontFamily: 'inherit', cursor: 'pointer', padding: 0 }}>
                  <span aria-hidden="true" style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', lineHeight: 1 }}>
                    ×
                  </span>
                </button>
              </div>
            ))}
            {canAddPhoto(d.photos.length) ? (
              <button type="button" disabled={photoBusy} onClick={() => photoInput.current?.click()} style={{ width: 84, height: 84, borderRadius: 10, border: '1.5px dashed var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 650, cursor: 'pointer', padding: '0.25rem' }}>
                {d.photos.length === 0 ? WRITE_UP_PHOTO_WORDS.take : WRITE_UP_PHOTO_WORDS.add}
              </button>
            ) : null}
          </div>
          <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden aria-label={WRITE_UP_PHOTO_WORDS.take} onChange={(e) => void addPhoto(e.target.files?.[0])} />
          {!canAddPhoto(d.photos.length) ? <p style={hintLine}>{WRITE_UP_PHOTO_WORDS.full}</p> : null}
          {photoFailure ? (
            <p role="alert" style={{ ...hintLine, color: 'var(--text-red-700)' }}>
              {photoFailure}
            </p>
          ) : null}

          <span style={fieldHead} id="write-up-seen">
            {WRITE_UP_WORDS.seen}
          </span>
          <div role="group" aria-labelledby="write-up-seen" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button type="button" aria-pressed={d.sawIt} onClick={() => patch((d) => ({ sawIt: !d.sawIt }))} style={chip(d.sawIt)}>
              {WRITE_UP_WORDS.iDid}
            </button>
            {witnesses.map((w) => {
              const on = d.seenBy.some((s) => s.person_id === w.person_id)
              return (
                <button key={w.person_id} type="button" aria-pressed={on} onClick={() => patch((d) => ({ seenBy: toggleSeen(d.seenBy, { person_id: w.person_id, name: w.name }) }))} style={chip(on)}>
                  {w.name}
                </button>
              )
            })}
            {typed.map((s) => (
              <button key={`typed:${s.name}`} type="button" aria-pressed onClick={() => patch((d) => ({ seenBy: toggleSeen(d.seenBy, s) }))} style={chip(true)}>
                {s.name}
              </button>
            ))}
            <button type="button" aria-expanded={otherOpen} onClick={() => setOtherOpen(!otherOpen)} style={chip(false)}>
              {WRITE_UP_WORDS.someoneElse}
            </button>
          </div>
          {otherOpen ? (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input type="text" value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder={WRITE_UP_WORDS.someoneElsePlaceholder} aria-label={WRITE_UP_WORDS.someoneElse} maxLength={80} style={{ ...textBox, minHeight: 48, flex: 1 }} />
              <button
                type="button"
                disabled={otherName.trim() === ''}
                onClick={() => {
                  const name = otherName.trim()
                  patch((d) => (d.seenBy.some((s) => !s.person_id && s.name.toLowerCase() === name.toLowerCase()) ? {} : { seenBy: [...d.seenBy, { name }] }))
                  setOtherName('')
                  setOtherOpen(false)
                }}
                style={otherName.trim() === '' ? { ...deadPress, flex: 'none', minHeight: 48 } : { ...quietPress, flex: 'none', minHeight: 48 }}
              >
                {WRITE_UP_WORDS.addName}
              </button>
            </div>
          ) : null}

          <span style={fieldHead} id="write-up-talked">
            {talkedQuestion(d.person.name)}
          </span>
          <div role="group" aria-labelledby="write-up-talked" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button type="button" aria-pressed={d.talked === true} onClick={() => patch((d) => ({ talked: d.talked === true ? null : true }))} style={chip(d.talked === true)}>
              {TALKED_CHOICES.yes}
            </button>
            <button type="button" aria-pressed={d.talked === false} onClick={() => patch((d) => ({ talked: d.talked === false ? null : false }))} style={chip(d.talked === false)}>
              {TALKED_CHOICES.notYet}
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── read it back ─────────────────────────────────────────────────────────

  const readBody = (d: WriteUpDraft): ReactNode => (
    <>
      <div style={{ padding: '0.5rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
        <ValueLines>
          {writeUpReadBack(d).map((line) => (
            <ValueLine key={line.label} label={line.label}>
              <WorkedOutValue>{line.value}</WorkedOutValue>
            </ValueLine>
          ))}
        </ValueLines>
      </div>
      <div style={{ padding: '0.9rem' }}>
        <blockquote style={{ margin: 0, padding: '0.1rem 0 0.1rem 0.75rem', borderLeft: '3px solid var(--border-strong)', whiteSpace: 'pre-wrap' }}>{d.words.trim()}</blockquote>
        {d.photos.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
            {d.photos.map((p, i) => (p.url ? <img key={p.id} src={p.url} alt={`Photo ${i + 1}`} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-strong)' }} /> : null))}
          </div>
        ) : null}
        <p style={{ ...hintLine, marginTop: '0.9rem' }}>{WRITE_UP_WORDS.readNote}</p>
        <OfflineRetryPanel failure={sendFailure} onRetry={send} surface="write-up-send" busy={sending} offlineMessage={WRITE_UP_WORDS.sendOffline} style={{ marginTop: '0.75rem' }} />
      </div>
    </>
  )

  // ── the writer's own ─────────────────────────────────────────────────────

  const mineBody = (): ReactNode => (
    <>
      {sentAt ? (
        <p style={{ margin: '0.75rem 0.9rem', padding: '0.65rem 0.75rem', borderRadius: 10, background: 'var(--bg-subtle)', fontSize: '0.9rem' }}>
          <b>Sent to HR at {sentAt}.</b> {WRITE_UP_WORDS.sentNote}
        </p>
      ) : null}
      {keptAt ? (
        <p role="status" style={{ margin: '0.75rem 0.9rem', padding: '0.65rem 0.75rem', borderRadius: 10, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.9rem', fontWeight: 600 }}>
          Kept on this phone at {keptAt}. {WRITE_UP_WORDS.keptNote}
        </p>
      ) : null}
      {kept.map((k) => (
        <article key={k.id} data-kept-write-up={k.state} style={{ padding: '0.7rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <b style={{ fontSize: '1rem', flex: 1, minWidth: 0 }}>{nameOf.get(k.subject_person_id)?.name ?? 'Someone off the list'}</b>
            <span style={{ ...(k.state === 'waiting' ? STATE_TONE.waiting : STATE_TONE.set_aside), display: 'inline-flex', alignItems: 'center', minHeight: 24, padding: '0 0.55rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{KEPT_WRITE_UP_STATE_WORDS[k.state]}</span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{keptWriteUpLine(k)}</div>
          <div style={{ fontSize: '0.8125rem', marginTop: '0.35rem' }}>{k.state === 'refused' ? `${WRITE_UP_WORDS.keptRefusedNote} ${k.reason ?? ''}`.trim() : `Kept on this phone since ${clockTime(new Date(k.pressedAt).toISOString())}.`}</div>
        </article>
      ))}
      {mineFailure ? <OfflineRetryPanel failure={mineFailure} onRetry={loadMine} surface="write-up-mine" idempotent style={{ margin: '1rem 0.9rem' }} /> : null}
      {mine && mine.length === 0 && kept.length === 0 && !mineFailure ? <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'write-ups', control: WRITE_UP_WORDS.another }), { onPress: () => setStep('who') })} /> : null}
      {(mine ?? []).map((row) => {
        const state = myWriteUpState(row)
        const note = myWriteUpNote(row)
        const taking = takeBack?.id === row.id ? takeBack : null
        return (
          <article key={row.id} style={{ padding: '0.7rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <b style={{ fontSize: '1rem', flex: 1, minWidth: 0 }}>{nameOf.get(row.subject_person_id)?.name ?? 'Someone off the list'}</b>
              <span style={{ ...STATE_TONE[state], display: 'inline-flex', alignItems: 'center', minHeight: 24, padding: '0 0.55rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{MY_WRITE_UP_STATE_WORDS[state]}</span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{myWriteUpLine(row)}</div>
            {note ? <div style={{ fontSize: '0.8125rem', marginTop: '0.35rem' }}>{note}</div> : null}
            {taking ? (
              <div style={{ marginTop: '0.5rem' }}>
                <label style={{ ...fieldHead, margin: '0 0 0.35rem' }} htmlFor={`take-back-${row.id}`}>
                  {WRITE_UP_WORDS.takeBackWhy}
                </label>
                <input id={`take-back-${row.id}`} type="text" value={taking.reason} maxLength={500} onChange={(e) => setTakeBack({ ...taking, reason: e.target.value })} placeholder={WRITE_UP_WORDS.takeBackPlaceholder} style={{ ...textBox, minHeight: 48 }} />
                {taking.failure ? (
                  <p role="alert" style={{ ...hintLine, color: 'var(--text-red-700)' }}>
                    {taking.failure}
                  </p>
                ) : null}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setTakeBack(null)} style={{ ...quietPress, minHeight: 48 }}>
                    {WRITE_UP_WORDS.keepIt}
                  </button>
                  <button type="button" disabled={taking.busy || taking.reason.trim() === ''} onClick={() => void runTakeBack()} style={taking.reason.trim() === '' ? { ...deadPress, minHeight: 48 } : { ...primaryPress, minHeight: 48 }}>
                    {taking.busy ? WRITE_UP_WORDS.taking : WRITE_UP_WORDS.takeBack}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {canAddTo(row) && nameOf.has(row.subject_person_id) ? (
                  <button type="button" onClick={() => addTo(row)} style={linkPress}>
                    {WRITE_UP_WORDS.addTo}
                  </button>
                ) : null}
                {canTakeBack(row) ? (
                  <button type="button" onClick={() => setTakeBack({ id: row.id, reason: '', busy: false, failure: null })} style={linkPress}>
                    {WRITE_UP_WORDS.takeBack}
                  </button>
                ) : null}
              </div>
            )}
          </article>
        )
      })}
    </>
  )

  // ── the foot ─────────────────────────────────────────────────────────────

  const foot = (): ReactNode => {
    if (step === 'who') {
      const waiting = kept.filter((k) => k.state === 'waiting').length
      const headline = [waiting > 0 ? `${waiting} waiting for signal` : '', myWriteUpsHeadline(mine ?? [])].filter(Boolean).join(' · ')
      if (!headline) return null
      return (
        <button type="button" onClick={() => setStep('mine')} style={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: 60, padding: '0.4rem 0.9rem', border: 'none', background: 'var(--surface)', color: 'inherit', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 650 }}>{WRITE_UP_WORDS.mineTitle}</span>
            <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{headline}</span>
          </span>
          <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '1.25rem' }}>
            ›
          </span>
        </button>
      )
    }
    if (step === 'what' && draft) {
      const missing = writeUpMissing(draft)
      return (
        <div style={{ display: 'flex', padding: '0.75rem 0.9rem' }}>
          <button type="button" disabled={missing != null} onClick={readBack} style={missing ? deadPress : primaryPress}>
            {missing ?? WRITE_UP_WORDS.readBack}
          </button>
        </div>
      )
    }
    if (step === 'read' && draft) {
      return (
        <div style={{ display: 'flex', gap: '0.6rem', padding: '0.75rem 0.9rem' }}>
          <button type="button" onClick={() => setStep('what')} disabled={sending} style={{ ...quietPress, flex: 0.6 }}>
            {WRITE_UP_WORDS.fix}
          </button>
          <button type="button" onClick={() => void send()} disabled={sending} style={primaryPress}>
            {sending ? WRITE_UP_WORDS.sending : WRITE_UP_WORDS.send}
          </button>
        </div>
      )
    }
    if (step === 'mine') {
      return (
        <div style={{ display: 'flex', gap: '0.6rem', padding: '0.75rem 0.9rem' }}>
          <button type="button" onClick={leave} style={quietPress}>
            {WRITE_UP_WORDS.done}
          </button>
          <button type="button" onClick={() => { setSentAt(null); setKeptAt(null); setStep('who') }} style={{ ...quietPress, border: 'none', color: 'var(--text-link)' }}>
            {WRITE_UP_WORDS.another}
          </button>
        </div>
      )
    }
    return null
  }

  const footNode = foot()
  const body = step === 'who' ? whoBody() : step === 'what' && draft ? whatBody(draft) : step === 'read' && draft ? readBody(draft) : mineBody()

  return (
    <PhoneSheet label={title} width={480} dataAttrs={{ 'data-write-up-sheet': step }} onClose={leave}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0 0.25rem 0 0.9rem', borderBottom: '1px solid var(--border)', flex: 'none' }}>
        {back ? (
          <button type="button" onClick={back} aria-label="Back" style={{ ...headPress, marginLeft: '-0.9rem', color: 'var(--text-link)' }}>
            ‹
          </button>
        ) : null}
        <h2 style={{ margin: 0, fontSize: '1.1rem', flex: 1, minWidth: 0 }}>
          {title}
          {step === 'what' && draft?.addsTo ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · adding to one you sent about {firstName(draft.person.name)}</span> : null}
        </h2>
        <button type="button" onClick={leave} aria-label="Close" style={headPress}>
          ×
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>{body}</div>
      {footNode ? <div style={{ flex: 'none', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>{footNode}</div> : null}
    </PhoneSheet>
  )
}
