import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import {
  LIEN_FILING_BATCH_WORDS,
  lienDocNumberFromName,
  lienFilingBatchPress,
  lienFilingByWords,
  lienFilingCheck,
  lienFilingDayOk,
  lienFilingFilesPlan,
  lienFilingFilesWords,
  lienFilingLeadWords,
  lienFilingNotRecordedWords,
  lienFilingRecordedWords,
  type LienFilingTarget,
} from '../../lib/jobs/lienFilingBatch'
import { recordLienFiling, saveLienFilingScan } from '../../lib/jobs/lienFilingBatchIo'
import { LIEN_DOC_NUMBER_WORDS, lienDocNumberClean, type LienDocKnown } from '../../lib/jobs/lienDocNumber'
import { LIEN_SERVE_STAGE_WORDS } from '../../lib/jobs/lienServeStage'
import { formatErrorMessage } from '../../utils/errorHandling'

type Props = {
  /** Every lien in Ready to file (`lienFilingTargets`). */
  targets: ReadonlyArray<LienFilingTarget>
  /** Every filed lien's document number on the desk (`lienDocKnownFromFilings`), for the check on a typed one. */
  known: ReadonlyArray<LienDocKnown>
  todayYmd: string
  isMobile?: boolean
  /** The person signed in: a filing is recorded as theirs. */
  authUserId: string | null
  /** The desk reads again, once, on the way out when a lien was recorded. */
  onChanged: () => void
  onClose: () => void
  /** A lien's own Lien window: for a paper the desk cannot draw, and to take back a lien recorded by mistake. */
  onOpenLien: (jobId: string) => void
  /** The door on to the copies, once liens are on record. Absent draws none. */
  onMailCopies?: () => void
  /** The writes, handed in by a test. */
  record?: typeof recordLienFiling
  saveScan?: typeof saveLienFilingScan
  zIndex?: number
}

const small: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const btn: CSSProperties = { padding: '0.4rem 0.95rem', fontSize: '0.8125rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, cursor: 'pointer' }
const press: CSSProperties = { ...btn, border: '1px solid transparent', background: '#2563eb', color: '#ffffff' }
const dead: CSSProperties = { ...btn, border: '1px solid var(--border)', background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'not-allowed' }
const outline: CSSProperties = { ...btn, border: '1px solid #2563eb', color: 'var(--text-link)' }
const field: CSSProperties = { padding: '0.3rem 0.45rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', minWidth: 0 }
const ACCEPT = 'application/pdf,image/*'

type Said = { tone: 'ok' | 'warn' | 'bad'; words: string; anyway?: boolean }
const SAID_COLOR: Record<Said['tone'], string> = { ok: 'var(--text-green-800)', warn: 'var(--text-amber-700)', bad: 'var(--text-red-700)' }
type Recorded = { filingId: string; number: string; filedYmd: string; scanSaved: boolean }

function chipStyle(tone: 'quiet' | 'soon' | 'late'): CSSProperties {
  return { fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: 999, whiteSpace: 'nowrap', background: tone === 'late' ? 'var(--bg-red-tint)' : tone === 'soon' ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)', color: tone === 'late' ? 'var(--text-red-700)' : tone === 'soon' ? 'var(--text-amber-700)' : 'var(--text-muted)' }
}

/**
 * **Back from the clerk: record the filings** (v2.7856, the owner's pick of 2026-11-18; `lienFilingBatch.ts` has the
 * story). Every lien in *Ready to file*, one line a lien, each taking the number the County Clerk stamped on it.
 *
 * A lien is recorded as its number is typed: Enter, or leaving the box, on a number that passes its check. A number
 * another lien holds is held. A number that is not the county's shape is asked about, and **Record it anyway**
 * records it. Enter moves on to the next lien.
 *
 * **Choose the stamped liens** takes the clerk's files at once. Each goes to the lien whose job number is in its
 * name, and a document number in the name is typed in. Such a number waits for a look at the stamp: Enter on it
 * records it, and the counted press at the foot records every one that waits.
 *
 * A recorded lien stays on its line until the window closes, with what was written and the door to take it back.
 */
export default function LienFilingBatchWindow({ targets, known, todayYmd, isMobile, authUserId, onChanged, onClose: onCloseProp, onOpenLien, onMailCopies, record = recordLienFiling, saveScan = saveLienFilingScan, zIndex = 1200 }: Props) {
  const isTopmost = useModalStackEntry()
  const [filedOn, setFiledOn] = useState(todayYmd)
  const [typed, setTyped] = useState<Record<string, string>>({})
  // The numbers that came from a file's name and wait for a look at the stamp.
  const [fromName, setFromName] = useState<Record<string, boolean>>({})
  const [files, setFiles] = useState<Record<string, File>>({})
  const [said, setSaid] = useState<Record<string, Said>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [recorded, setRecorded] = useState<Record<string, Recorded>>({})
  const [filesSaid, setFilesSaid] = useState<{ went: string; left: string[] } | null>(null)
  const [running, setRunning] = useState(false)
  const inFlight = useRef<Set<string>>(new Set())
  const recordedRef = useRef<Record<string, Recorded>>({})
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})
  const chooser = useRef<HTMLInputElement | null>(null)
  const oneFile = useRef<Record<string, HTMLInputElement | null>>({})
  // Every lien shown since the window opened: one the desk drops from its list after a read stays on its line.
  const seen = useRef<Map<string, LienFilingTarget>>(new Map())
  const order = useRef<string[]>([])

  const rows = useMemo(() => {
    for (const t of targets) {
      if (!seen.current.has(t.jobId)) order.current.push(t.jobId)
      seen.current.set(t.jobId, t)
    }
    return order.current.map((id) => seen.current.get(id)!).filter(Boolean)
  }, [targets])

  const onClose = useCallback(() => {
    if (Object.keys(recordedRef.current).length > 0) onChanged()
    onCloseProp()
  }, [onChanged, onCloseProp])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isTopmost()) return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isTopmost, onClose])

  const stack = (over: Record<string, string> = {}) => rows.map((t) => ({ jobId: t.jobId, county: t.county, number: recordedRef.current[t.jobId]?.number ?? over[t.jobId] ?? typed[t.jobId] ?? '', jobLabel: t.jobLabel }))

  /** Record one lien now. Answers whether it is on record. `anyway` records a number the check asked about. */
  const recordRow = async (t: LienFilingTarget, value: string, anyway = false): Promise<boolean> => {
    const id = t.jobId
    const number = lienDocNumberClean(value)
    if (!number || recordedRef.current[id] || inFlight.current.has(id)) return Boolean(recordedRef.current[id])
    if (!lienFilingDayOk(filedOn)) {
      setSaid((cur) => ({ ...cur, [id]: { tone: 'bad', words: LIEN_FILING_BATCH_WORDS.needDay } }))
      return false
    }
    const check = lienFilingCheck({ target: t, number, filedYmd: filedOn, known, stack: stack({ [id]: number }) })
    if (check.kind === 'twin') {
      setSaid((cur) => ({ ...cur, [id]: { tone: 'bad', words: check.words } }))
      return false
    }
    if (check.kind === 'odd' && !anyway) {
      setSaid((cur) => ({ ...cur, [id]: { tone: 'warn', words: check.words, anyway: true } }))
      return false
    }
    inFlight.current.add(id)
    setBusy((cur) => ({ ...cur, [id]: true }))
    try {
      const done = await record({ target: t, number, filedYmd: filedOn, createdBy: authUserId, file: files[id] ?? null })
      const row: Recorded = { filingId: done.filingId, number, filedYmd: filedOn, scanSaved: done.scanSaved }
      recordedRef.current = { ...recordedRef.current, [id]: row }
      setRecorded(recordedRef.current)
      setFromName((cur) => ({ ...cur, [id]: false }))
      setSaid((cur) => ({ ...cur, [id]: done.scanProblem ? { tone: 'warn', words: `${lienFilingRecordedWords(filedOn)} Its stamped lien did not save: ${done.scanProblem.replace(/[.\s]+$/, '')}. Add it again.` } : { tone: 'ok', words: lienFilingRecordedWords(filedOn) } }))
      return true
    } catch (e) {
      setSaid((cur) => ({ ...cur, [id]: { tone: 'bad', words: lienFilingNotRecordedWords(formatErrorMessage(e, 'the record was not saved')) } }))
      return false
    } finally {
      inFlight.current.delete(id)
      setBusy((cur) => ({ ...cur, [id]: false }))
    }
  }

  const focusAfter = (jobId: string) => {
    const at = rows.findIndex((t) => t.jobId === jobId)
    const next = rows.slice(at + 1).find((t) => !recordedRef.current[t.jobId] && t.fields)
    if (next) inputs.current[next.jobId]?.focus()
    else inputs.current[jobId]?.blur()
  }

  /** The numbers that came from file names and still wait: the counted press records each, and keeps going past one that fails. */
  const waiting = rows.filter((t) => fromName[t.jobId] && !recorded[t.jobId] && t.fields && lienDocNumberClean(typed[t.jobId] ?? ''))
  const anyFromName = rows.some((t) => fromName[t.jobId]) || waiting.length > 0
  const recordWaiting = async () => {
    if (running || waiting.length === 0) return
    setRunning(true)
    try {
      for (const t of waiting) await recordRow(t, typed[t.jobId] ?? '')
    } finally {
      setRunning(false)
    }
  }

  /** A file for a lien: held until the lien is recorded, or saved at once on a lien already on record. */
  const takeFile = async (t: LienFilingTarget, file: File) => {
    const id = t.jobId
    const done = recordedRef.current[id]
    if (done) {
      setBusy((cur) => ({ ...cur, [id]: true }))
      try {
        const problem = await saveScan({ target: t, filingId: done.filingId, number: done.number, filedYmd: done.filedYmd, file })
        if (!problem) {
          recordedRef.current = { ...recordedRef.current, [id]: { ...done, scanSaved: true } }
          setRecorded(recordedRef.current)
        }
        setSaid((cur) => ({ ...cur, [id]: problem ? { tone: 'bad', words: `Its stamped lien did not save: ${problem.replace(/[.\s]+$/, '')}.` } : { tone: 'ok', words: lienFilingRecordedWords(done.filedYmd) } }))
      } finally {
        setBusy((cur) => ({ ...cur, [id]: false }))
      }
      return
    }
    setFiles((cur) => ({ ...cur, [id]: file }))
    const number = lienDocNumberFromName(file.name, t.jobNumber)
    if (number && !lienDocNumberClean(typed[id] ?? '')) {
      setTyped((cur) => ({ ...cur, [id]: number }))
      setFromName((cur) => ({ ...cur, [id]: true }))
    }
  }

  const chooseMany = (picked: File[]) => {
    const open = rows.filter((t) => !recordedRef.current[t.jobId] && t.fields)
    const plan = lienFilingFilesPlan(picked, open, new Set(Object.keys(files)))
    const nextFiles = { ...files }
    const nextTyped = { ...typed }
    const nextFrom = { ...fromName }
    for (const m of plan.matched) {
      nextFiles[m.jobId] = picked[m.index]!
      if (m.number && !lienDocNumberClean(nextTyped[m.jobId] ?? '')) {
        nextTyped[m.jobId] = m.number
        nextFrom[m.jobId] = true
      }
    }
    setFiles(nextFiles)
    setTyped(nextTyped)
    setFromName(nextFrom)
    setFilesSaid(lienFilingFilesWords(plan))
  }

  const recordedCount = Object.keys(recorded).length
  const left = rows.filter((t) => !recorded[t.jobId]).length

  const line = (t: LienFilingTarget) => {
    const id = t.jobId
    const done = recorded[id]
    const s = said[id]
    const by = lienFilingByWords(t)
    const file = files[id]
    return (
      <div key={id} data-lien-filing-row={t.jobNumber} data-lien-filing-recorded={done ? 'yes' : 'no'} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.7rem', display: 'grid', gap: '0.3rem', ...(done ? { background: 'var(--bg-green-tint)' } : {}) }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 16rem)', gap: '0.35rem 0.6rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'center', minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{t.jobLabel}</span>
            {t.county ? <span style={small}>{t.county} County Clerk</span> : null}
            {!done && by ? <span style={chipStyle(by.tone)}>{by.words}</span> : null}
          </div>
          {done ? (
            <span data-lien-filing-number style={{ fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
              {LIEN_DOC_NUMBER_WORDS.short} <strong>{done.number}</strong>
            </span>
          ) : t.fields ? (
            <input
              ref={(el) => {
                inputs.current[id] = el
              }}
              type="text"
              inputMode="numeric"
              value={typed[id] ?? ''}
              disabled={Boolean(busy[id])}
              onChange={(e) => {
                setTyped((cur) => ({ ...cur, [id]: e.target.value }))
                // A number a hand has changed is the hand's: it records when the box is left, as a typed one does.
                setFromName((cur) => (cur[id] ? { ...cur, [id]: false } : cur))
                setSaid((cur) => (cur[id] ? { ...cur, [id]: { tone: 'ok', words: '' } } : cur))
              }}
              onBlur={(e) => {
                // A number from a file's name waits for a look at the stamp: Enter, or the press at the foot, records it.
                if (!fromName[id]) void recordRow(t, e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                const value = (e.target as HTMLInputElement).value
                if (!lienDocNumberClean(value)) return focusAfter(id)
                void recordRow(t, value).then((ok) => {
                  if (ok) focusAfter(id)
                })
              }}
              placeholder={LIEN_DOC_NUMBER_WORDS.placeholder}
              aria-label={`Job ${t.jobNumber}, document number`}
              autoComplete="off"
              style={{ ...field, ...(isMobile ? { minHeight: 44 } : {}), ...(s?.tone === 'bad' ? { borderColor: 'var(--text-red-700)' } : s?.tone === 'warn' ? { borderColor: 'var(--text-amber-700)' } : {}) }}
            />
          ) : null}
        </div>
        {!done && !t.fields ? (
          <div data-lien-filing-no-paper style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'center', fontSize: '0.75rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-amber-700)' }}>{LIEN_FILING_BATCH_WORDS.noPaper}</span>
            <button type="button" onClick={() => onOpenLien(id)} style={{ ...btn, padding: '0.2rem 0.6rem', fontSize: '0.75rem', ...(isMobile ? { minHeight: 44 } : {}) }}>
              {LIEN_FILING_BATCH_WORDS.openLien}
            </button>
          </div>
        ) : null}
        {busy[id] ? <div style={small}>{LIEN_FILING_BATCH_WORDS.recording}</div> : null}
        {s?.words && !busy[id] ? (
          <div data-lien-filing-said={s.tone} role={s.tone === 'ok' ? 'status' : 'alert'} style={{ fontSize: '0.75rem', fontWeight: 600, color: SAID_COLOR[s.tone] }}>
            {s.words}{' '}
            {s.anyway ? (
              <button type="button" data-lien-filing-anyway onMouseDown={(e) => e.preventDefault()} onClick={() => void recordRow(t, typed[id] ?? '', true)} style={{ ...btn, padding: '0.2rem 0.6rem', fontSize: '0.75rem', ...(isMobile ? { minHeight: 44 } : {}) }}>
                {LIEN_FILING_BATCH_WORDS.anyway}
              </button>
            ) : null}
          </div>
        ) : null}
        {done || t.fields ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'center' }}>
            <input
              ref={(el) => {
                oneFile.current[id] = el
              }}
              type="file"
              accept={ACCEPT}
              aria-label={`Job ${t.jobNumber}, ${LIEN_FILING_BATCH_WORDS.addOne.toLowerCase()}`}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void takeFile(t, f)
                e.target.value = ''
              }}
              style={{ display: 'none' }}
            />
            {done?.scanSaved ? (
              <span data-lien-filing-file="saved" style={{ ...small, color: 'var(--text-green-800)', fontWeight: 600 }}>✓ Stamped lien saved</span>
            ) : !done && file ? (
              <>
                <span data-lien-filing-file="chosen" style={{ ...small, color: 'var(--text-green-800)', fontWeight: 600, overflowWrap: 'anywhere' }}>✓ {file.name}</span>
                <span style={small}>{fromName[id] ? LIEN_FILING_BATCH_WORDS.fromName : 'Saved with the lien when its number is recorded.'}</span>
              </>
            ) : (
              <>
                <button type="button" disabled={Boolean(busy[id])} onClick={() => oneFile.current[id]?.click()} style={{ ...btn, padding: '0.25rem 0.7rem', fontSize: '0.78rem', ...(isMobile ? { minHeight: 44 } : {}) }}>
                  {LIEN_FILING_BATCH_WORDS.addOne}
                </button>
                {!done ? <span style={small}>{LIEN_FILING_BATCH_WORDS.addOneHint}</span> : null}
              </>
            )}
            {done ? (
              <button type="button" data-lien-filing-take-back onClick={() => onOpenLien(id)} title={LIEN_FILING_BATCH_WORDS.wrongLien} style={{ border: 'none', background: 'none', padding: 0, marginLeft: 'auto', font: 'inherit', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', ...(isMobile ? { minHeight: 44 } : {}) }}>
                {LIEN_FILING_BATCH_WORDS.openLien}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={LIEN_FILING_BATCH_WORDS.title}
      data-testid="lien-filing-batch-window"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex }}
    >
      <div style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: isMobile ? 0 : 10, width: isMobile ? '100%' : 'min(46rem, calc(100vw - 2rem))', maxHeight: isMobile ? '100%' : 'calc(100% - 2rem)', height: isMobile ? '100%' : undefined, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>{LIEN_FILING_BATCH_WORDS.title}</div>
            <div data-lien-filing-lead style={{ ...small, marginTop: '0.15rem' }}>
              {lienFilingLeadWords(left, recordedCount)}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, padding: '0.25rem 0.6rem', ...(isMobile ? { minHeight: 44, minWidth: 44 } : {}) }}>
            ×
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '0.9rem 1.1rem', display: 'grid', gap: '0.7rem' }}>
          {rows.length === 0 ? (
            <div data-lien-filing-none style={{ display: 'grid', gap: '0.4rem' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{LIEN_FILING_BATCH_WORDS.none}</div>
              <div style={small}>{LIEN_FILING_BATCH_WORDS.noneNext}</div>
            </div>
          ) : (
            <>
              <label style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', fontSize: '0.8125rem', fontWeight: 600 }}>
                {LIEN_FILING_BATCH_WORDS.day}
                <input type="date" value={filedOn} onChange={(e) => setFiledOn(e.target.value)} aria-label={LIEN_FILING_BATCH_WORDS.day} style={{ ...field, ...(isMobile ? { minHeight: 44 } : {}) }} />
                <span style={{ ...small, fontWeight: 400 }}>{LIEN_FILING_BATCH_WORDS.dayHint}</span>
              </label>
              {left > 0 ? (
                <div data-lien-filing-chooser style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.7rem', alignItems: 'center', border: '1px dashed var(--border-strong)', borderRadius: 8, padding: '0.55rem 0.7rem' }}>
                  <input
                    ref={chooser}
                    type="file"
                    multiple
                    accept={ACCEPT}
                    aria-label={LIEN_FILING_BATCH_WORDS.choose}
                    onChange={(e) => {
                      const picked = Array.from(e.target.files ?? [])
                      if (picked.length > 0) chooseMany(picked)
                      e.target.value = ''
                    }}
                    style={{ display: 'none' }}
                  />
                  <button type="button" onClick={() => chooser.current?.click()} style={{ ...outline, ...(isMobile ? { minHeight: 44 } : {}) }}>
                    {filesSaid ? LIEN_FILING_BATCH_WORDS.chooseMore : LIEN_FILING_BATCH_WORDS.choose}
                  </button>
                  <span style={{ ...small, flex: '1 1 16rem', minWidth: 0 }}>{filesSaid ? filesSaid.went : LIEN_FILING_BATCH_WORDS.chooseHint}</span>
                  {filesSaid?.left.map((l) => (
                    <span key={l} data-lien-filing-file-left role="alert" style={{ flexBasis: '100%', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-amber-700)', overflowWrap: 'anywhere' }}>
                      {l}
                    </span>
                  ))}
                </div>
              ) : null}
              {left > 0 ? <div style={small}>{LIEN_FILING_BATCH_WORDS.hint}</div> : null}
              {rows.map(line)}
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', justifyContent: 'flex-end', padding: '0.7rem 1.1rem', borderTop: '1px solid var(--border)' }}>
          {rows.length > 0 ? (
            <span data-lien-filing-foot style={{ ...small, marginRight: 'auto' }}>
              {LIEN_FILING_BATCH_WORDS.foot}
            </span>
          ) : null}
          <button type="button" onClick={onClose} data-lien-filing-close style={{ ...btn, ...(isMobile ? { minHeight: 44 } : {}) }}>
            {LIEN_FILING_BATCH_WORDS.close}
          </button>
          {anyFromName && left > 0 ? (
            <button type="button" data-lien-filing-record-waiting disabled={waiting.length === 0 || running} onClick={() => void recordWaiting()} style={{ ...(waiting.length === 0 ? dead : press), ...(running ? { cursor: 'wait' } : {}), ...(isMobile ? { minHeight: 44 } : {}) }}>
              {running ? LIEN_FILING_BATCH_WORDS.recording : lienFilingBatchPress(waiting.length)}
            </button>
          ) : null}
          {recordedCount > 0 && onMailCopies ? (
            <button
              type="button"
              data-lien-filing-mail
              onClick={() => {
                onChanged()
                recordedRef.current = {}
                onMailCopies()
              }}
              style={{ ...(left === 0 ? press : outline), ...(isMobile ? { minHeight: 44 } : {}) }}
            >
              {LIEN_SERVE_STAGE_WORDS.print} ›
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
