/**
 * Equipment pre-use check (punch list #270): the sheet the crew signs on a machine. The morning walk, or the short
 * leaving check: one question open at a time marked Next, Yes / No / Not here at 44 px, a note and a photo under a No,
 * the gauges drawn the way they look on the machine (full screen on a phone), the hour meter with yesterday's reading
 * under it, four photos and one for anything wrong, where it is tonight on the leaving check, and the sign press. Every
 * press writes its row at once; a No on a holding question holds the machine and tells Dispatch on the sign. A rental
 * whose agreement is not in yet opens with a first stop, the photo of the paper the yard handed over, and the sign press
 * waits for it (punch list #271); the office types the number off that photo on the fleet board.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import * as S from '../jobMode/sheetStyles'
import { CameraGlyph } from '../materials/PhotoPress'
import { shrinkPhoto } from '../../lib/materials/photoShrink'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  AGREEMENT_SHOTS,
  CHECK_KIND_WORDS,
  FLEET_ROOT_WORDS,
  LEFT_WHERE_WORDS,
  SHOT_ORDER,
  SHOT_WORDS,
  agreementDue,
  agreementPhotoWords,
  agreementState,
  clockWords,
  heldWhy,
  hoursLine,
  lastHours,
  lastSignedCheck,
  levelWords,
  machineFolderName,
  nextOpen,
  photoFileName,
  questionsFor,
  rentalWords,
  signPressWords,
  signWords,
  todayDay,
  verdictOf,
  walkProgress,
  type AgreementShot,
  type Answer,
  type CheckKind,
  type LeftWhere,
  type LevelDef,
  type Machine,
  type MachineCheck,
  type MachinePhoto,
  type MachineQuestion,
  type MachinePick,
} from '../../lib/machines/machines'
import { addCheckPhoto, holdMachine, patchCheck, photoSrc, signCheck, startCheck } from '../../lib/machines/checksIo'
import { JobLookupBox, type JobPick } from './JobLookupBox'
import { LevelGauge } from './LevelGauge'
import { LevelGaugeSheet } from './LevelGaugeSheet'

const PICK_WORDS: Record<MachinePick, string> = { yes: 'Yes', no: 'No', not_here: 'Not here' }
const chip: CSSProperties = { flex: 1, minHeight: 44, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }
const chipOn: Record<MachinePick, CSSProperties> = {
  yes: { background: '#16a34a', color: '#fff', borderColor: '#16a34a' },
  no: { background: '#dc2626', color: '#fff', borderColor: '#dc2626' },
  not_here: { background: '#6b7280', color: '#fff', borderColor: '#6b7280' },
}
const statement: CSSProperties = { display: 'grid', gridTemplateColumns: '1.4rem minmax(0, 1fr)', gap: '0.15rem 0.5rem', alignItems: 'start', width: '100%', padding: '0.55rem 0', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', textAlign: 'left', font: 'inherit', color: 'var(--text-strong)', cursor: 'pointer' }
const glyph: Record<MachinePick, CSSProperties> = { yes: { fontWeight: 700, color: 'var(--text-green-700)' }, no: { fontWeight: 700, color: 'var(--text-red-700)' }, not_here: { fontWeight: 700, color: 'var(--text-muted)' } }
const openBox: CSSProperties = { border: '1.5px solid var(--border-strong)', borderRadius: 12, padding: '0.7rem 0.75rem', display: 'grid', gap: '0.55rem', background: 'var(--surface)', marginTop: '0.35rem' }
const nextTag: CSSProperties = { display: 'inline-block', padding: '0.05rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'var(--bg-blue-200)', color: 'var(--text-blue-700)' }
const holdTag: CSSProperties = { ...nextTag, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
const meta: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const noteStyle: CSSProperties = { width: '100%', minHeight: 44, padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid var(--border-strong)', font: 'inherit', fontSize: '1rem', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-strong)' }
const lvlBox: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.5rem 0.7rem', marginTop: '0.4rem' }
const tile: CSSProperties = { aspectRatio: '1', borderRadius: 10, border: '1.5px dashed var(--border-strong)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-700)', cursor: 'pointer', padding: '0.25rem', textAlign: 'center', overflow: 'hidden', position: 'relative' }

type Fields = Parameters<typeof patchCheck>[1]

export interface MachineCheckSheetProps {
  machine: Machine
  questions: readonly MachineQuestion[]
  /** The machine's recent checks, for yesterday's levels, the last reading and today's open row. */
  checks: readonly MachineCheck[]
  /** The job the phone is on; null asks. */
  jobId: string | null
  jobWords: string | null
  userId: string | null
  byName: string
  /** The office opening a check to read it, from the fleet board. */
  checkId?: string | null
  /** The morning walk, or the short leaving check. */
  kind?: CheckKind
  /** Above the clock-out review or the I'm here sheet when it opens from one. */
  zIndex?: number
  /** After a write, so the host reads again. */
  onChanged?: () => void
  onClose: () => void
}

export function MachineCheckSheet({ machine, questions: allQuestions, checks, jobId: jobIdIn, jobWords: jobWordsIn, userId, byName, checkId, kind: kindIn, zIndex, onChanged, onClose }: MachineCheckSheetProps) {
  const today = todayDay()
  const [job, setJob] = useState<JobPick | null>(jobIdIn ? { id: jobIdIn, words: jobWordsIn ?? '' } : machine.jobId ? { id: machine.jobId, words: machine.jobWords ?? '' } : null)
  const kind: CheckKind = kindIn ?? 'pre'
  const kw = CHECK_KIND_WORDS[kind]
  const questions = useMemo(() => questionsFor(allQuestions, machine, kind), [allQuestions, machine, kind])

  // the check this sheet writes: the one asked for, else today's unfinished one of this kind by this person, else a new row once a job is known
  const [check, setCheck] = useState<MachineCheck | null>(() => {
    if (checkId) return checks.find((c) => c.id === checkId) ?? null
    return checks.find((c) => c.machineId === machine.id && c.day === today && c.kind === kind && c.verdict === 'unfinished' && c.byName === byName) ?? null
  })
  const readOnly = Boolean(checkId && check && check.signedAt)
  const [problem, setProblem] = useState<string | null>(null)
  const starting = useRef(false)
  useEffect(() => {
    if (check || !job || checkId || starting.current) return
    starting.current = true
    startCheck({ machine, kind, jobId: job.id, byUserId: userId, byName })
      .then((c) => setCheck({ ...c, jobWords: job.words }))
      .catch((e) => setProblem(formatErrorMessage(e, 'The check did not start.')))
      .finally(() => {
        starting.current = false
      })
  }, [check, job, checkId, machine, kind, userId, byName])

  // the photos still in the bucket draw through signed URLs; a filed one is in Drive and draws as its name
  const checkIdNow = check?.id
  useEffect(() => {
    if (!check) return
    const waiting = check.photos.filter((p) => !p.src && !p.filedAt)
    if (waiting.length === 0) return
    let live = true
    Promise.all(waiting.map(async (p) => [p.id, await photoSrc(machine.id, p.id)] as const)).then((pairs) => {
      if (!live) return
      setCheck((c) => (c ? { ...c, photos: c.photos.map((p) => ({ ...p, src: pairs.find(([id]) => id === p.id)?.[1] ?? p.src })) } : c))
    })
    return () => {
      live = false
    }
    // once per check: the photos a press adds already carry their own src
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIdNow, machine.id])

  // every press writes its own fields; the gauges, the hours and a note write a beat after the last move
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function save(id: string, fields: Fields) {
    patchCheck(id, fields)
      .then(() => onChanged?.())
      .catch((e) => setProblem(formatErrorMessage(e, 'That did not save.')))
  }
  function patch(fn: (c: MachineCheck) => MachineCheck, fields: (c: MachineCheck) => Fields, slow = false) {
    setCheck((c) => {
      if (!c) return c
      const next = fn(c)
      if (slow) {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => save(next.id, fields(next)), 500)
      } else {
        save(next.id, fields(next))
      }
      return next
    })
  }

  const answers = check?.answers ?? []
  const open = nextOpen(questions, answers)
  const [reopened, setReopened] = useState<string | null>(null)
  const openQ = reopened ? (questions.find((x) => x.id === reopened) ?? open) : open
  const progress = walkProgress(questions, answers)
  const walkDone = progress.answered === progress.asked
  const verdict = verdictOf(questions, answers)
  const others = useMemo(() => checks.filter((c) => c.id !== check?.id), [checks, check?.id])
  const last = lastSignedCheck(others, machine.id)
  const lastH = lastHours(others, machine.id)
  const hLine = hoursLine(check?.hours ?? null, lastH, today)
  const [sending, setSending] = useState(false)
  const phone = useIsMobile()
  const [bigGauge, setBigGauge] = useState<LevelDef | null>(null)
  const [otherJob, setOtherJob] = useState<JobPick | null>(null)
  const leaveAnswered = kind !== 'post' || (check?.leftWhere != null && (check.leftWhere !== 'other' || otherJob != null))
  // a rental's agreement: the stop at the top until the number is typed or the paper is photographed, this check's photos counted
  const all = useMemo(() => (check ? [check, ...others] : others), [check, others])
  const agreement = agreementState(machine, all)
  const agreementOwed = agreementDue(machine, kind, all)
  const agreementShotHere = check?.photos.some((p) => p.shot === 'agreement' || p.shot === 'agreement_more') ?? false
  const showAgreement = machine.rental != null && (agreementShotHere || (agreementOwed && !readOnly))
  const agreementTail = machine.rental && agreement === 'typed' ? agreementPhotoWords(all, machine.id) : null
  const rental = machine.rental ? rentalWords(machine.rental, today, agreement) : null

  function pick(q: MachineQuestion, p: MachinePick) {
    patch(
      (c) => {
        const rest = c.answers.filter((a) => a.questionId !== q.id)
        const prev = c.answers.find((a) => a.questionId === q.id)
        const a: Answer = { questionId: q.id, pick: p, note: prev?.note ?? '', photoId: prev?.photoId ?? null, at: new Date().toISOString() }
        return { ...c, answers: [...rest, a] }
      },
      (c) => ({ answers: c.answers }),
    )
    // a No keeps its row open for the note and the photo; any other pick moves the walk on
    setReopened(p === 'no' ? q.id : null)
  }
  function note(q: MachineQuestion, text: string) {
    patch((c) => ({ ...c, answers: c.answers.map((a) => (a.questionId === q.id ? { ...a, note: text } : a)) }), (c) => ({ answers: c.answers }), true)
  }
  async function takePhoto(shot: string, words: string, file: File): Promise<MachinePhoto | null> {
    if (!check) return null
    try {
      const shrunk = await shrinkPhoto(file, 1600, 0.8)
      const photo = await addCheckPhoto({ check, machine, shot, fileName: photoFileName(check, machine, words), blob: shrunk.blob, byUserId: userId })
      setCheck((c) => (c ? { ...c, photos: [...c.photos.filter((p) => p.shot !== shot), photo] } : c))
      onChanged?.()
      return photo
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The photo did not save.'))
      return null
    }
  }
  async function noPhoto(q: MachineQuestion, file: File) {
    const photo = await takePhoto(`no:${q.id}`, `No · ${q.words.toLowerCase()}`, file)
    if (photo) patch((c) => ({ ...c, answers: c.answers.map((a) => (a.questionId === q.id ? { ...a, photoId: photo.id } : a)) }), (c) => ({ answers: c.answers }))
  }
  async function sign() {
    if (!check || !job) return
    setSending(true)
    try {
      await signCheck({ ...check, verdict }, machine, verdict, otherJob ? { id: otherJob.id, words: otherJob.words } : null)
      if (verdict === 'held' && userId && !check.dispatchedAt) await holdMachine({ ...check, verdict }, machine, job, userId)
      onChanged?.()
      onClose()
    } catch (e) {
      setProblem(formatErrorMessage(e, verdict === 'held' ? 'Dispatch was not told.' : 'The check did not sign.'))
    } finally {
      setSending(false)
    }
  }

  const title = `${kw.title} · ${machine.unitLabel}`
  const who = `${machine.make} ${machine.model}${job ? ` on ${job.words}` : ''} · ${check ? `${check.byName} · ${clockWords(check.startedAt)}` : byName}`
  const photoOf = (shot: string) => check?.photos.find((p) => p.shot === shot)

  const foot =
    readOnly || !check ? (
      <div style={S.footerRow}>
        <button type="button" style={S.secondaryBtn} onClick={onClose}>
          Close
        </button>
      </div>
    ) : (
      <div style={{ width: '100%', display: 'grid', gap: '0.4rem' }}>
        <button type="button" style={walkDone && leaveAnswered && !agreementOwed ? (verdict === 'held' ? { ...S.primaryBtn, background: '#d97706' } : S.primaryBtn) : { ...S.primaryBtn, ...S.disabled }} disabled={!walkDone || !leaveAnswered || agreementOwed || sending} onClick={() => void sign()}>
          {sending ? 'Signing…' : agreementOwed ? 'Photo of the agreement first' : !walkDone ? `${progress.asked - progress.answered} left${kind === 'pre' ? ' on the walk' : ''}` : !leaveAnswered ? 'Say where it is tonight' : signPressWords(machine, verdict, kind)}
        </button>
        <button type="button" style={S.quietMuted} onClick={onClose}>
          Finish later, keep what I did
        </button>
      </div>
    )

  return (
    <ResponsiveModalShell title={title} onRequestClose={onClose} footer={foot} maxWidthDesktop={520} zIndex={zIndex}>
      <p style={{ ...meta, margin: '0.25rem 0 0.5rem', color: 'var(--text-700)' }}>{who}</p>
      {rental ? (
        <p style={{ ...meta, color: rental.late ? 'var(--text-red-700)' : 'var(--text-amber-800)', fontWeight: 600 }} data-rental-line>
          {rental.words}
          {agreementTail ? ` · ${agreementTail}` : ''}. {kind === 'pre' ? 'The photos today are the evidence if they claim damage.' : 'At return, the four sides and the hour meter are the evidence.'}
        </p>
      ) : null}
      {last && !readOnly ? (
        <p style={meta}>
          Last checked by {last.byName} · {last.day === today ? 'today' : last.day} {clockWords(last.signedAt ?? last.startedAt)}
          {last.hours != null ? ` · ${last.hours.toLocaleString()} h` : ''}
        </p>
      ) : null}

      {!job ? (
        <>
          <p style={S.label}>Which job is it on?</p>
          <p style={{ ...meta, marginBottom: '0.4rem' }}>The check files on the job you pick.</p>
          <JobLookupBox onPick={setJob} />
        </>
      ) : null}

      {check ? (
        <>
          {showAgreement ? (
            <div data-agreement-stop={agreementOwed ? 'owed' : 'in'}>
              <p style={S.label}>The rental agreement</p>
              <p style={{ ...meta, marginBottom: '0.4rem' }}>{agreementOwed ? 'Photo of the paper the yard handed you. The office types the number off it.' : 'The agreement is in. The office types the number off the photo.'}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                {(['agreement', 'agreement_more'] as AgreementShot[]).map((k) => (
                  <ShotTile key={k} k={k} words={AGREEMENT_SHOTS[k].tile} photo={photoOf(k)} readOnly={readOnly} onFile={(f) => void takePhoto(k, AGREEMENT_SHOTS[k].file, f)} />
                ))}
              </div>
            </div>
          ) : null}
          <p style={S.label}>{kw.lead}</p>
          {kind === 'post' ? <p style={{ ...meta, marginBottom: '0.3rem' }}>Short on purpose: only what using {machine.unitLabel} changes. The morning walk finds the rest.</p> : null}
          <p style={meta} data-machine-progress>
            {progress.answered} of {progress.asked} answered{progress.nos ? ` · ${progress.nos} No` : ''}{verdict === 'held' ? ` · ${machine.unitLabel} is held` : ''}
          </p>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', margin: '0.3rem 0 0.4rem' }} aria-hidden>
            <i style={{ display: 'block', height: 6, width: `${progress.asked ? Math.round((progress.answered / progress.asked) * 100) : 0}%`, background: verdict === 'held' ? '#dc2626' : '#16a34a' }} />
          </div>
          {questions.map((q) => {
            const a = answers.find((x) => x.questionId === q.id)
            const isOpen = !readOnly && openQ?.id === q.id
            const aPhoto = a?.photoId ? check.photos.find((p) => p.id === a.photoId) : undefined
            if (!isOpen) {
              return (
                <button key={q.id} type="button" style={statement} onClick={() => !readOnly && setReopened(q.id)} disabled={readOnly && !a}>
                  <span style={a ? glyph[a.pick] : { color: 'var(--text-muted)' }} aria-hidden>
                    {a ? (a.pick === 'yes' ? '✓' : a.pick === 'no' ? '✗' : '—') : '○'}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: a ? 500 : 600 }}>{q.words}</span>
                    {a ? (
                      <span style={{ ...meta, display: 'block' }}>
                        {PICK_WORDS[a.pick]} · {check.byName} · {clockWords(a.at)}
                        {q.holdsMachine && a.pick === 'no' ? ' · holds the machine' : ''}
                      </span>
                    ) : q.holdsMachine ? (
                      <span style={{ ...meta, display: 'block' }}>a No holds the machine</span>
                    ) : null}
                    {a?.note ? <span style={{ ...meta, display: 'block', fontStyle: 'italic' }}>“{a.note}”</span> : null}
                    {aPhoto?.src ? <img src={aPhoto.src} alt="" style={{ display: 'block', width: 56, height: 56, objectFit: 'cover', borderRadius: 6, marginTop: '0.25rem' }} /> : aPhoto ? <span style={{ ...meta, display: 'block' }}>📷 {aPhoto.fileName}</span> : null}
                  </span>
                </button>
              )
            }
            return (
              <div key={q.id} style={openBox} data-machine-question={q.id}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={nextTag}>{a ? 'Open' : 'Next'}</span>
                  {q.holdsMachine ? <span style={holdTag}>a No holds it</span> : null}
                </div>
                <p style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-strong)' }}>{q.words}</p>
                <div role="group" aria-label={q.words} style={{ display: 'flex', gap: '0.5rem' }}>
                  {(['yes', 'no', 'not_here'] as MachinePick[]).map((p) => (
                    <button key={p} type="button" aria-pressed={a?.pick === p} style={a?.pick === p ? { ...chip, ...chipOn[p] } : chip} onClick={() => pick(q, p)}>
                      {PICK_WORDS[p]}
                    </button>
                  ))}
                </div>
                {a?.pick === 'no' ? (
                  <>
                    <input type="text" value={a.note} placeholder="What is wrong? (a few words)" aria-label="What is wrong" onChange={(e) => note(q, e.target.value)} style={noteStyle} maxLength={200} />
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ ...S.secondaryBtn, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CameraGlyph size={16} /> {aPhoto ? 'Another photo' : 'Take the photo'}
                        <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && void noPhoto(q, e.target.files[0])} />
                      </label>
                      {aPhoto?.src ? <img src={aPhoto.src} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }} /> : null}
                      <button type="button" style={S.quietLink} onClick={() => setReopened(null)}>
                        Close this one
                      </button>
                    </div>
                    {q.holdsMachine ? <p style={S.warn}>This holds {machine.unitLabel}. The sign press tells Dispatch, with the note and the photo.</p> : null}
                  </>
                ) : a ? (
                  <button type="button" style={{ ...S.quietLink, justifySelf: 'start' }} onClick={() => setReopened(null)}>
                    Close this one
                  </button>
                ) : null}
              </div>
            )
          })}

          {machine.levels.length ? (
            <>
              <p style={S.label}>Levels</p>
              <p style={{ ...meta, marginBottom: '0.4rem' }}>
                Each gauge is drawn the way it looks on {machine.unitLabel}. {phone ? 'Tap one and it opens big, then drag the fill to where it sits.' : 'Drag the fill to where it sits.'} A guess is fine; the words say what you set.
              </p>
              <div style={{ ...lvlBox, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.9rem 0.25rem', padding: '0.6rem 0.3rem' }}>
                {machine.levels.map((d) => (
                  <div key={d.key} style={{ display: 'grid', justifyItems: 'center', gap: '0.3rem' }}>
                    <LevelGauge def={d} value={check.levels[d.key]} last={last?.levels[d.key]} readOnly={readOnly} onChange={(v) => patch((c) => ({ ...c, levels: { ...c.levels, [d.key]: v } }), (c) => ({ levels: c.levels }), true)} onOpen={phone && !readOnly ? () => setBigGauge(d) : undefined} />
                    <GaugeShot def={d} photo={photoOf(`gauge:${d.key}`)} low={levelWords(d, check.levels[d.key]).low} readOnly={readOnly} onFile={(f) => void takePhoto(`gauge:${d.key}`, `${d.name.toLowerCase()} gauge`, f)} />
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <p style={S.label}>Hour meter</p>
          <div style={{ ...lvlBox, display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.2rem 0.6rem', alignItems: 'center' }}>
            <b style={{ fontSize: '0.9375rem' }}>Hours on the dash</b>
            <input
              type="number"
              inputMode="numeric"
              value={check.hours ?? ''}
              readOnly={readOnly}
              placeholder="h"
              aria-label="Hours on the dash"
              onChange={(e) => patch((c) => ({ ...c, hours: e.target.value === '' ? null : Number(e.target.value) }), (c) => ({ hours: c.hours }), true)}
              style={{ ...S.field, width: 120, minHeight: 44, borderColor: hLine.bad ? '#d97706' : undefined, gridRow: '1 / span 2', gridColumn: 2 }}
            />
            <span style={{ ...meta, gridColumn: 1, color: hLine.bad ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>{hLine.words}</span>
          </div>

          <p style={S.label}>Photos</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
            {SHOT_ORDER.filter((k) => k !== 'wrong').map((k) => (
              <ShotTile key={k} k={k} words={SHOT_WORDS[k]} photo={photoOf(k)} readOnly={readOnly} onFile={(f) => void takePhoto(k, SHOT_WORDS[k].toLowerCase(), f)} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginTop: '0.4rem' }}>
            <ShotTile k="wrong" words={SHOT_WORDS.wrong} photo={photoOf('wrong')} readOnly={readOnly} onFile={(f) => void takePhoto('wrong', SHOT_WORDS.wrong.toLowerCase(), f)} />
            {kind === 'post' && machine.rental ? <ShotTile k="return_slip" words={AGREEMENT_SHOTS.return_slip.tile} photo={photoOf('return_slip')} readOnly={readOnly} onFile={(f) => void takePhoto('return_slip', AGREEMENT_SHOTS.return_slip.file, f)} /> : null}
          </div>
          <p style={{ ...meta, marginTop: '0.4rem' }}>
            Every photo here files in {machine.unitLabel}’s own Drive folder, <b>{FLEET_ROOT_WORDS} › {machineFolderName(machine)}</b>, as <b>{photoFileName(check, machine, 'front')}</b> and the like, within a few minutes.
          </p>

          {kind === 'post' ? (
            <>
              <p style={S.label}>Where is it tonight?</p>
              <div role="group" aria-label="Where is it tonight" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.4rem' }} data-left-where={check.leftWhere ?? ''}>
                {(['job', 'yard', 'other'] as LeftWhere[]).map((w) => (
                  <button key={w} type="button" aria-pressed={check.leftWhere === w} disabled={readOnly} style={check.leftWhere === w ? { ...chip, ...chipOn.yes, minHeight: 48, fontSize: '0.875rem' } : { ...chip, minHeight: 48, fontSize: '0.875rem' }} onClick={() => patch((c) => ({ ...c, leftWhere: w }), (c) => ({ leftWhere: c.leftWhere, leftJobId: c.leftWhere === 'other' ? (otherJob?.id ?? null) : null }))}>
                    {LEFT_WHERE_WORDS[w]}
                  </button>
                ))}
              </div>
              {check.leftWhere === 'other' && !readOnly ? (
                otherJob ? (
                  <p style={{ ...meta, marginTop: '0.4rem' }}>
                    Going to <b>{otherJob.words}</b>.{' '}
                    <button type="button" style={S.quietLink} onClick={() => setOtherJob(null)}>
                      Change
                    </button>
                  </p>
                ) : (
                  <div style={{ marginTop: '0.4rem' }}>
                    <JobLookupBox
                      onPick={(j) => {
                        setOtherJob(j)
                        if (check) save(check.id, { leftJobId: j.id })
                      }}
                      placeholder="Which job is it going to?"
                    />
                  </div>
                )
              ) : null}
              <p style={{ ...meta, marginTop: '0.4rem' }}>The answer moves {machine.unitLabel} on the board, so tomorrow’s crew and Dispatch see where it is.</p>
            </>
          ) : null}

          <p style={S.label}>Sign</p>
          <div style={{ ...lvlBox, fontSize: '0.9375rem', color: 'var(--text-700)' }}>
            {check.signedAt ? (
              <>
                {signWords(machine, check.byName, check.verdict === 'held' ? 'held' : 'safe', kind)} · {clockWords(check.signedAt)}
                {check.runAnyway ? ` · ${check.runAnyway.byName} said run it anyway at ${clockWords(check.runAnyway.at)}` : ''}
              </>
            ) : walkDone ? (
              signWords(machine, byName, verdict, kind)
            ) : (
              `The sign line reads once the ${kind === 'pre' ? 'walk' : 'check'} is done.`
            )}
            {check.verdict === 'held' && check.signedAt ? <span style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-red-700)' }}>Held · {heldWhy(check)}</span> : null}
          </div>
          {problem ? <p style={S.warn}>{problem}</p> : null}
          {bigGauge ? <LevelGaugeSheet def={bigGauge} value={check.levels[bigGauge.key]} last={last?.levels[bigGauge.key]} onChange={(v) => patch((c) => ({ ...c, levels: { ...c.levels, [bigGauge.key]: v } }), (c) => ({ levels: c.levels }), true)} onClose={() => setBigGauge(null)} /> : null}
          <p style={{ ...meta, margin: '0.75rem 0 0.5rem' }}>Each press saves by itself.</p>
        </>
      ) : job ? (
        <p style={S.muted}>{problem ?? 'Starting…'}</p>
      ) : null}
    </ResponsiveModalShell>
  )
}

/** The camera under a gauge: optional, and a low reading asks for it, so a fuel claim or a hold carries its proof. */
function GaugeShot({ def, photo, low, readOnly, onFile }: { def: LevelDef; photo: MachinePhoto | undefined; low: boolean; readOnly: boolean; onFile: (f: File) => void }) {
  if (readOnly && !photo) return null
  const ask = low && !photo
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', minHeight: 32, padding: '0 0.55rem', borderRadius: 8, border: `1px ${photo ? 'solid #16a34a' : ask ? 'solid #d97706' : 'dashed var(--border-strong)'}`, background: ask ? 'var(--bg-amber-100)' : 'var(--surface)', fontSize: '0.75rem', fontWeight: 700, color: ask ? 'var(--text-amber-800)' : 'var(--text-700)', cursor: readOnly ? 'default' : 'pointer' }} data-gauge-shot={def.key}>
      {photo?.src ? <img src={photo.src} alt={`${def.name} gauge`} style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }} /> : <CameraGlyph size={14} />}
      {photo ? 'Photo taken' : ask ? 'Low · add the photo' : 'Photo of the gauge'}
      {readOnly ? null : <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />}
    </label>
  )
}

/** One photo tile: the shot's key for the row, its words on the tile, the picture once taken. */
function ShotTile({ k, words, photo, readOnly, onFile }: { k: string; words: string; photo: MachinePhoto | undefined; readOnly: boolean; onFile: (f: File) => void }) {
  return (
    <label style={photo ? { ...tile, border: '1.5px solid #16a34a' } : tile} data-machine-shot={k}>
      {photo?.src ? <img src={photo.src} alt={words} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : photo ? <span style={{ fontSize: '0.65rem', color: 'var(--text-green-700)' }}>in Drive</span> : <CameraGlyph size={18} />}
      <span style={photo?.src ? { position: 'absolute', left: 0, right: 0, bottom: 0, background: 'rgba(17,24,39,.65)', color: '#fff', fontSize: '0.65rem', padding: '0.15rem' } : undefined}>{words}</span>
      {readOnly ? null : <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />}
    </label>
  )
}

export default MachineCheckSheet
