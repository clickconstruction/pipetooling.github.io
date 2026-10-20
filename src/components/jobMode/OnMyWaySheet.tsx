/**
 * Job Mode's **On my way** (v2.5573, punch list #112): the sheet behind the big green button. Where to (the day's
 * still-open jobs, the suggested one picked), the office's On my way line filled for this customer in the orange box
 * with the minutes guessed from the phone to the job, what the press will do, and a button that says exactly that.
 * The press clocks first (the session is the tech's pay) and texts second (a courtesy); a text that cannot go is said
 * in its row and never promised. The phone at the job already makes the press an I'm here. The rules are
 * `lib/jobMode/onMyWay.ts`; the reads are `lib/jobModeOnMyWayIo.ts`; the clock-in is the Dashboard's bridge.
 *
 * Since v2.5590 (the tech's bio, punch list #114) the first time this customer hears from the tech, the bio the
 * office wrote follows the line as a second text: it shows under the line with **Not this time** and **Edit bio**,
 * the window on top where the tech ticks the lines for this customer (`BioPickWindow`); the press texts the line,
 * then the bio, each said in the toast.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useToastContext } from '../../contexts/ToastContext'
import type { UpdateFocusApplyDirectFn } from '../../contexts/UpdateFocusOpenerBridgeContext'
import type { UserRole } from '../../hooks/useAuth'
import { formatErrorMessage } from '../../utils/errorHandling'
import { scheduleTodayDateKey } from '../../lib/jobScheduleChicago'
import { jobModeFills, previewOf, type JobModeBlock } from '../../lib/jobModeMessageCustomer'
import type { JobModeCustomer } from '../../lib/jobModeMessageCustomerIo'
import { supabaseOnMyWayIo, type OnMyWayIo } from '../../lib/jobModeOnMyWayIo'
import { jobModeMessagesOffered } from '../../lib/messages/jobBox'
import { recordNavClick } from '../../lib/navClickTelemetry'
import type { LatLng } from '../../lib/jobTravelEstimate'
import type { PhoneLine } from '../../lib/quickReplies/phone'
import { bioPickedLines, bioText, liveLines, usualPicks, type BioLine } from '../../lib/bio/bio'
import {
  acts,
  guessDrive,
  guessMiles,
  hereNote,
  minutesOf,
  ON_MY_WAY_WORDS,
  pastWindowWords,
  pressLine,
  stepMinutes,
  textHold,
  travelNote,
  type PhonePress,
} from '../../lib/jobMode/onMyWay'
import { BioPickWindow } from './BioPickWindow'
import * as S from './sheetStyles'

/** The press's row in `ui_nav_clicks`: `#text`, `#text-bio`, `#no-text` or `#start-here`. */
export const ON_MY_WAY_CONTROL = 'job_mode_on_my_way'

/** One of today's still-open jobs, as the card names it. */
export interface OnMyWayDestination {
  jobId: string
  /** "PLUM 512 · Whitfield water heater" */
  label: string
  /** "10:30 AM · 1208 Mesquite Ln" */
  sublabel: string
  suggested: boolean
  jobName: string | null
  jobAddress: string | null
  /** The block's end, "13:00:00", for the past-the-window line. */
  timeEnd: string | null
}

export interface OnMyWaySheetProps {
  userId: string
  /** The signed-in tech's name. */
  me: string | null
  role: UserRole | null | undefined
  destinations: OnMyWayDestination[]
  initialJobId: string | null
  /** The job the tech leaves, as the card names it, or null before the first clock-in. */
  leaving: string | null
  /** A session is open and the tech may clock out: the Done for the day row. */
  canFinishDay: boolean
  apply: UpdateFocusApplyDirectFn
  onFinishDay: () => void
  /** After the press: the card reads the session and Job updates again. */
  onDone: () => void
  onClose: () => void
  /** For a smoke. */
  io?: OnMyWayIo
  today?: string
  now?: () => number
}

const firstOf = (name: string | null) => name?.trim().split(/\s+/)[0] || null

const bioFirstLine: CSSProperties = { margin: '0.9rem 0 0', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-amber-800)' }
const bioRowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem' }
const editBioBtn: CSSProperties = { ...S.secondaryBtn, minHeight: 40, padding: '0 0.8rem', fontSize: '0.875rem' }

export function OnMyWaySheet({ userId, me, role, destinations, initialJobId, leaving, canFinishDay, apply, onFinishDay, onDone, onClose, io: ioProp, today = scheduleTodayDateKey(), now = Date.now }: OnMyWaySheetProps) {
  const { showToast } = useToastContext()
  const io = useMemo(() => ioProp ?? supabaseOnMyWayIo(), [ioProp])
  const [jobId, setJobId] = useState<string | null>(initialJobId ?? destinations.find((d) => d.suggested)?.jobId ?? destinations[0]?.jobId ?? null)
  const dest = destinations.find((d) => d.jobId === jobId) ?? null

  const [lines, setLines] = useState<PhoneLine[] | null>(null)
  const [textsOn, setTextsOn] = useState<boolean | null>(null)
  const [myPoint, setMyPoint] = useState<LatLng | null | undefined>(undefined)
  const [customer, setCustomer] = useState<{ jobId: string; customer: JobModeCustomer } | null>(null)
  const [blocks, setBlocks] = useState<JobModeBlock[]>([])
  const [jobPoint, setJobPoint] = useState<{ jobId: string; point: LatLng | null } | undefined>(undefined)
  const [typed, setTyped] = useState('')
  const touched = useRef(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** The tech's bio: `undefined` while reading, `null` while the push is not in. */
  const [myBio, setMyBio] = useState<BioLine[] | null | undefined>(undefined)
  /** Whether this job's customer already has the tech's bio, per job. */
  const [introducedState, setIntroducedState] = useState<{ jobId: string; value: boolean | null } | undefined>(undefined)
  /** The lines picked for this customer; null takes the usual picks. */
  const [picked, setPicked] = useState<string[] | null>(null)
  const [bioHeld, setBioHeld] = useState(false)
  const [pickOpen, setPickOpen] = useState(false)

  // Once: the phone's lines, the switch, the phone's own point, the tech's bio.
  useEffect(() => {
    let live = true
    io.loadPressLines().then(
      (l) => live && setLines(l),
      (e: unknown) => live && setProblem(formatErrorMessage(e, 'The phone’s lines could not be read.')),
    )
    void io.loadTextsOn().then((on) => live && setTextsOn(on))
    void io.loadMyPoint().then((p) => live && setMyPoint(p), () => live && setMyPoint(null))
    void io.loadMyBio(userId).then((b) => live && setMyBio(b), () => live && setMyBio(null))
    return () => {
      live = false
    }
  }, [io, userId])

  // Per destination: the customer, the tech's blocks, the job's point.
  useEffect(() => {
    if (!dest) return
    let live = true
    const id = dest.jobId
    io.loadCustomer(id).then(
      (c) => live && setCustomer({ jobId: id, customer: c }),
      (e: unknown) => live && setProblem(formatErrorMessage(e, 'Their messages could not be read.')),
    )
    void io.loadBlocks(id, userId, today).then((b) => live && setBlocks(b), () => live && setBlocks([]))
    void io.loadJobPoint(dest.jobAddress).then((p) => live && setJobPoint({ jobId: id, point: p }), () => live && setJobPoint({ jobId: id, point: null }))
    return () => {
      live = false
    }
  }, [io, dest, userId, today])

  const theirs = customer?.jobId === jobId ? customer.customer : null
  const first = firstOf(theirs?.customerName ?? null)
  /** The tech's own first name, for the bio's opener. */
  const myFirst = firstOf(me)

  // Once the customer is read: has their thread had the tech's bio?
  useEffect(() => {
    if (!customer || !jobId || customer.jobId !== jobId) return
    let live = true
    const id = jobId
    io.loadIntroduced(customer.customer.contactId, userId).then(
      (v) => live && setIntroducedState({ jobId: id, value: v }),
      () => live && setIntroducedState({ jobId: id, value: null }),
    )
    return () => {
      live = false
    }
  }, [io, customer, jobId, userId])

  const pointsPending = myPoint === undefined || jobPoint === undefined || jobPoint.jobId !== jobId
  const guess = useMemo(() => (pointsPending ? null : guessDrive(myPoint ?? null, jobPoint?.point ?? null)), [pointsPending, myPoint, jobPoint])

  // The guess fills the minutes once, unless the tech already typed.
  useEffect(() => {
    if (guess && !touched.current) setTyped(String(guess.minutes))
  }, [guess])

  const sameSite = guess?.sameSite ?? false
  /** The line the press sends: the I'm here line once the phone says the tech is already at the job. */
  const press: PhonePress = sameSite ? 'im_here' : 'on_my_way'
  const line = lines ? pressLine(lines, press) : null
  const loading = lines === null || textsOn === null || (dest != null && theirs === null && problem === null)
  const hold = loading ? null : textHold({ offered: jobModeMessagesOffered(role), hasCustomer: Boolean(theirs?.customerId), textsOn: textsOn === true, line })
  const minutes = minutesOf(typed)
  const fills = useMemo(
    () => jobModeFills({ customerName: theirs?.customerName ?? null, me, jobName: dest?.jobName ?? null, jobAddress: dest?.jobAddress ?? null, blocks, today }),
    [theirs?.customerName, me, dest?.jobName, dest?.jobAddress, blocks, today],
  )
  const typedFills: Record<string, string> = press === 'on_my_way' && minutes != null ? { minutes: String(minutes) } : {}
  const lang = theirs?.lang ?? 'en'
  const preview = line && !hold ? previewOf(line, fills, typedFills, lang) : null

  // The bio: the first time this customer hears from the tech, it follows the line.
  const bioLines = useMemo(() => myBio ?? [], [myBio])
  const bioLive = useMemo(() => liveLines(bioLines), [bioLines])
  const pickedIds = useMemo(() => picked ?? usualPicks(bioLines), [picked, bioLines])
  const introducedHere = introducedState?.jobId === jobId ? introducedState.value : undefined
  const bioBlock = press === 'on_my_way' && !loading && !hold && !sameSite && Boolean(theirs?.customerId) && introducedHere === false && bioLive.length > 0 && !bioHeld
  const bioWords = useMemo(() => (bioBlock ? bioText({ lines: bioLines, picked: pickedIds, first: myFirst, lang }) : null), [bioBlock, bioLines, pickedIds, myFirst, lang])
  const bioGoes = bioBlock && bioWords != null
  const bioCount = useMemo(() => (bioGoes ? { lines: bioPickedLines({ lines: bioLines, picked: pickedIds, first: myFirst, lang }).length, of: bioLive.length } : null), [bioGoes, bioLines, pickedIds, myFirst, lang, bioLive.length])

  const a = dest ? acts({ press: 'on_my_way', jobLabel: dest.label, first, leaving, hold, sameSite, bio: bioCount }) : null
  const window = press === 'on_my_way' && dest?.timeEnd ? pastWindowWords(now(), minutes, { timeEnd: dest.timeEnd }) : null
  const needsMinutes = press === 'on_my_way' && !hold && preview?.stop != null
  const canGo = Boolean(dest) && !busy && !loading && !needsMinutes

  const pick = (id: string) => {
    setJobId(id)
    touched.current = false
    setTyped('')
    setPicked(null)
    setBioHeld(false)
  }

  /** The press: clock first, then the text, then the bio the first time, each said in the toast. */
  const go = async (travel: 'on-the-way' | 'on-site', withText: boolean) => {
    if (!dest || busy) return
    setBusy(true)
    try {
      const notes = travel === 'on-the-way' ? travelNote(dest.label, minutes) : hereNote(dest.label)
      const res = await apply({ jobLedgerId: dest.jobId, bidId: null, notes, travel })
      if (!res.ok) {
        showToast(res.error ?? 'Could not clock you in.', 'error')
        return
      }
      const texting = withText && !hold && line && theirs?.customerId
      const withBio = Boolean(texting) && travel === 'on-the-way' && bioGoes
      recordNavClick(userId, role ?? null, ON_MY_WAY_CONTROL, travel === 'on-site' && !withText ? '#start-here' : texting ? (withBio ? '#text-bio' : '#text') : '#no-text')
      let sent: string | null = null
      let bioSaid: string | null = null
      if (texting) {
        try {
          await io.send({ from: 'job_mode', customerId: theirs.customerId!, contactId: theirs.contactId, jobId: dest.jobId, quickReplyId: line.id, fills: typedFills })
          sent = ON_MY_WAY_WORDS.sent(first)
        } catch (e) {
          showToast(formatErrorMessage(e, ON_MY_WAY_WORDS.textFailed), 'error')
        }
        if (sent && withBio) {
          try {
            await io.send({ from: 'job_mode', kind: 'bio', customerId: theirs.customerId!, contactId: theirs.contactId, jobId: dest.jobId, lineIds: pickedIds })
            bioSaid = ON_MY_WAY_WORDS.bioSent
          } catch (e) {
            showToast(formatErrorMessage(e, ON_MY_WAY_WORDS.bioFailed), 'error')
          }
        }
      }
      const did = travel === 'on-the-way' ? ON_MY_WAY_WORDS.onTheWay(dest.label) : ON_MY_WAY_WORDS.arrived(null)
      showToast([did, sent, bioSaid].filter(Boolean).join(' '), 'success')
      onDone()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const primaryStyle = press === 'im_here' ? S.hereBtn : S.primaryBtn
  const footer = (
    <div style={S.footerRow}>
      {a?.secondary ? (
        <button type="button" style={busy ? { ...S.secondaryBtn, ...S.disabled } : S.secondaryBtn} disabled={!canGo} onClick={() => void go(press === 'im_here' ? 'on-site' : 'on-the-way', false)} data-testid="on-my-way-secondary">
          {a.secondary}
        </button>
      ) : press === 'on_my_way' ? (
        <button type="button" style={busy ? { ...S.secondaryBtn, ...S.disabled } : S.secondaryBtn} disabled={busy || !dest} onClick={() => void go('on-site', false)} data-testid="on-my-way-start-here">
          {ON_MY_WAY_WORDS.startHere}
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        style={canGo ? primaryStyle : { ...primaryStyle, ...S.disabled }}
        disabled={!canGo}
        title={needsMinutes ? ON_MY_WAY_WORDS.waitMinutes : undefined}
        onClick={() => void go(press === 'im_here' ? 'on-site' : 'on-the-way', true)}
        data-testid="on-my-way-primary"
      >
        {busy ? 'One moment…' : (a?.primary ?? ON_MY_WAY_WORDS.title)}
      </button>
    </div>
  )

  return (
    <ResponsiveModalShell title={ON_MY_WAY_WORDS.title} onRequestClose={() => !busy && !pickOpen && onClose()} footer={footer}>
      <div data-testid="on-my-way-sheet">
        <p style={{ ...S.label, marginTop: 0 }}>{ON_MY_WAY_WORDS.whereTo}</p>
        {destinations.length === 0 ? (
          <p role="status" style={S.muted}>
            {ON_MY_WAY_WORDS.noDestination}
          </p>
        ) : (
          destinations.map((d) => {
            const picked = d.jobId === jobId
            return (
              <button
                key={d.jobId}
                type="button"
                style={picked ? { ...S.destBtn, ...S.destPicked } : S.destBtn}
                aria-pressed={picked}
                disabled={busy}
                onClick={() => pick(d.jobId)}
                data-testid="on-my-way-destination"
              >
                <span style={{ fontWeight: 700 }}>{d.label}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: picked ? '#15803d' : 'var(--text-muted)', alignSelf: 'center' }}>{d.suggested ? ON_MY_WAY_WORDS.suggested : ''}</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', gridColumn: 1 }}>{d.sublabel}</span>
              </button>
            )
          })
        )}

        {problem ? (
          <p role="alert" style={{ ...S.muted, color: 'var(--text-red-700)' }}>
            {problem}
          </p>
        ) : null}

        {sameSite ? <p style={S.warn}>{ON_MY_WAY_WORDS.alreadyThere}</p> : null}

        {preview ? (
          <>
            <p style={S.label}>{ON_MY_WAY_WORDS.gets(first)}</p>
            <p style={S.bubble} data-testid="on-my-way-preview">
              {preview.text}
            </p>
            {press === 'on_my_way' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 48px', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                  <button type="button" style={S.stepBtn} aria-label={ON_MY_WAY_WORDS.less} disabled={busy} onClick={() => { touched.current = true; setTyped(String(stepMinutes(minutes, -1))) }}>
                    −
                  </button>
                  <label style={{ display: 'grid', gap: '0.1rem', justifyItems: 'center' }}>
                    <input
                      style={S.field}
                      value={typed}
                      inputMode="numeric"
                      aria-label={`${ON_MY_WAY_WORDS.minutes} out`}
                      placeholder="minutes"
                      disabled={busy}
                      onChange={(e) => { touched.current = true; setTyped(e.target.value) }}
                      data-testid="on-my-way-minutes"
                    />
                  </label>
                  <button type="button" style={S.stepBtn} aria-label={ON_MY_WAY_WORDS.more} disabled={busy} onClick={() => { touched.current = true; setTyped(String(stepMinutes(minutes, 1))) }}>
                    +
                  </button>
                </div>
                <p style={{ ...S.muted, margin: '0.35rem 0 0', fontSize: '0.8125rem' }} data-testid="on-my-way-guess">
                  {pointsPending ? ON_MY_WAY_WORDS.guessing : guess ? ON_MY_WAY_WORDS.guessed(guessMiles(guess)) : ON_MY_WAY_WORDS.noGuess}
                </p>
                {window ? <p style={S.warn} data-testid="on-my-way-window">{window}</p> : null}
                {bioBlock ? (
                  <>
                    <p style={bioFirstLine} data-testid="on-my-way-bio-first">
                      {ON_MY_WAY_WORDS.bioFirst(first)}
                    </p>
                    <p style={{ ...S.bubble, fontSize: '0.9375rem', borderStyle: 'dashed', marginTop: '0.4rem' }} data-testid="on-my-way-bio">
                      {bioWords ?? ON_MY_WAY_WORDS.bioNone}
                    </p>
                    <div style={bioRowStyle}>
                      <button type="button" style={S.quietMuted} disabled={busy} onClick={() => setBioHeld(true)} data-testid="on-my-way-bio-hold">
                        {ON_MY_WAY_WORDS.notThisTime}
                      </button>
                      <button type="button" style={editBioBtn} disabled={busy} onClick={() => setPickOpen(true)} data-testid="on-my-way-bio-edit">
                        {ON_MY_WAY_WORDS.editBio}
                      </button>
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {a ? (
          <>
            <p style={S.label}>{ON_MY_WAY_WORDS.happens}</p>
            {a.rows.map((r) => (
              <p key={r.words} style={r.hold ? { ...S.actRow, color: 'var(--text-amber-800)' } : S.actRow} data-testid={r.hold ? 'on-my-way-hold' : 'on-my-way-act'}>
                <span aria-hidden>{r.icon}</span>
                <span>{r.words}</span>
              </p>
            ))}
          </>
        ) : loading && dest ? (
          <p style={S.muted}>Reading the job…</p>
        ) : null}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          {a?.secondary && press === 'on_my_way' ? (
            <button type="button" style={S.quietLink} disabled={busy || !dest} onClick={() => void go('on-site', false)} data-testid="on-my-way-start-here">
              {ON_MY_WAY_WORDS.startHere}
            </button>
          ) : null}
          {canFinishDay ? (
            <button type="button" style={S.quietMuted} disabled={busy} onClick={onFinishDay} data-testid="on-my-way-done-for-day">
              {ON_MY_WAY_WORDS.done}
            </button>
          ) : null}
        </div>
      </div>
      {pickOpen ? (
        <BioPickWindow lines={bioLines} picked={pickedIds} techFirst={myFirst} customerFirst={first} lang={lang} onUse={(ids) => { setPicked(ids); setPickOpen(false) }} onClose={() => setPickOpen(false)} />
      ) : null}
    </ResponsiveModalShell>
  )
}
