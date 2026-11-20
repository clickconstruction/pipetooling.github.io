/**
 * Before we start (punch list #382, PR 4): one stage, open. Four short lines, one fact each, with the values in a
 * column: we start, they say ready, the notice we need, we decide by. Then two lists by standing: Still open on top
 * at full strength, Has a yes below, dulled. A bullet on them is a box to tick, and one tap records their word,
 * today. Its line then says who, how and the day, each changed where it sits. A bullet that asks for a photo is not
 * a yes on their word alone. A bullet of ours is ticked by nobody: it shows what the app read and the press that
 * fixes it. A stage with no list is offered a starter once. Nothing here sends anything, and nothing blocks a stage.
 *
 * The rules are `startChecks.ts`, the rows `startCheckRows.ts`, and every value is drawn in place (`ValuesInPlace`).
 */
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { shrinkPhoto } from '../../lib/materials/photoShrink'
import {
  DECIDE_WORDS,
  KNOW_WORDS,
  addDays,
  bulletIsYes,
  countWords,
  daysBetween,
  decisionWords,
  goNoGoDay,
  inDaysWords,
  lastAsk,
  metBullets,
  monthDay,
  movedDays,
  openBullets,
  openOnThem,
  saidNo,
  startClash,
  theirDay,
  waitsOnPhoto,
  weekDay,
  type Bullet,
  type Know,
  type Site,
  type Stage,
  type ThemBullet,
  type UsBullet,
  type UsReads,
} from '../../lib/startChecks/startChecks'
import {
  MOVE_AFTER_THEIRS_DAYS,
  NOTICE_DAYS_MAX,
  START_CHECK_WORDS as W,
  liveMarkOf,
  nextBulletOrder,
  standingDecisionOf,
  starterFor,
  starterWords,
  whoseTag,
  type Notice,
  type StageLine,
  type StartCheckRows,
  type StartStageKind,
  type StartTemplateRow,
} from '../../lib/startChecks/startCheckRows'
import type { StartChecksIo, StartWho } from '../../lib/startChecks/startChecksIo'
import { READS_CHOICES, readsLabel } from '../../lib/startChecks/startCheckReaders'
import { ChangeableValue, ValueLine, ValueLines, ValueSentence, ValuesLegend, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { StartCheckAskPanel, type AskMessagesDoor } from './StartCheckAskPanel'
import { StartCheckDecidePanel } from './StartCheckDecidePanel'

const muted: CSSProperties = { color: 'var(--text-muted)' }
const cap: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const rowLine: CSSProperties = { fontSize: '0.8125rem', lineHeight: 1.6 }
const bluePress: CSSProperties = { border: '1px solid #2563eb', background: '#2563eb', color: '#fff', borderRadius: 8, padding: '7px 12px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }
const plainPress: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 8, padding: '7px 12px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }

export interface StartCheckStageProps {
  stage: Stage
  line: StageLine
  rows: StartCheckRows
  site: Site
  notice: Notice
  /** Where the days of notice are kept: the site's row, or the job's own when it is on no site. */
  noticeKey: { developmentId: string } | { jobId: string }
  today: string
  me: StartWho
  /** The stage's kind, read from its name, when the company keeps a list for it. */
  kind: StartStageKind | null
  templates: readonly StartTemplateRow[]
  can: {
    /** May write our window: the office and an estimator. */
    window: boolean
    /** May change the days of notice where they are kept. */
    notice: boolean
    /** May write the company's lists: the office. */
    company: boolean
    /** May press Go or Hold: the office and the job's superintendent. */
    decide?: boolean
  }
  /** Run a write, then read again. A failure is thrown. */
  press: (write: (io: StartChecksIo) => Promise<void>) => Promise<void>
  io: StartChecksIo
  /** Where an ask goes out from Messages: the job it is tied to and the customer's thread. Absent, the stage offers no ask. */
  ask?: AskMessagesDoor
  /** Open on the ask or on Go or hold, when the press that opened the stage named one. */
  startOn?: 'ask' | 'decide' | null
}

export function StartCheckStage({ stage, line, rows, site, notice, noticeKey, today, me, kind, templates, can, press, io, ask, startOn = null }: StartCheckStageProps) {
  const { showToast } = useToastContext()
  const [words, setWords] = useState('')
  const [on, setOn] = useState<'them' | 'us'>('them')
  const [writing, setWriting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(startOn === 'ask')
  const [deciding, setDeciding] = useState(startOn === 'decide')
  // The note of a hold that just landed, to send from Messages or another way.
  const [holdNote, setHoldNote] = useState<string | null>(null)

  /** A press on a row: the row waits, and a failure says why in a toast. */
  const act = async (what: string, write: (io: StartChecksIo) => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try {
      await press(write)
    } catch (e) {
      showToast(`${what} ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const add = () => {
    const text = words.trim()
    if (!text) return
    void act('The bullet was not added.', (w) => w.addBullets([{ fixtureId: line.fixtureId, jobId: line.jobId, order: nextBulletOrder(rows, line.fixtureId), words: text, on, wantsPhoto: false, reads: on === 'us' ? 'hand' : null, templateId: null }], me)).then(() => setWords(''))
  }
  const addRow = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
      <input
        className="scAdd"
        aria-label={W.addPlaceholder}
        placeholder={W.addPlaceholder}
        autoFocus={writing}
        value={words}
        onChange={(e) => setWords(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
      />
      <button type="button" className="scChip" aria-pressed={on === 'them'} onClick={() => setOn('them')}>
        {W.fromThem}
      </button>
      <button type="button" className="scChip" aria-pressed={on === 'us'} onClick={() => setOn('us')}>
        {W.ours}
      </button>
      <button type="button" className="scPress" style={{ ...plainPress, opacity: words.trim() && !busy ? 1 : 0.55, cursor: words.trim() && !busy ? 'pointer' : 'default' }} disabled={!words.trim() || busy} onClick={add}>
        {W.add}
      </button>
    </div>
  )

  if (!stage.bullets.length) {
    const starter = starterFor(templates, kind)
    const say = starterWords(stage.name, starter, kind)
    const use = () =>
      void act('The list was not added.', (w) =>
        w.addBullets(
          starter.bullets.map((b, i) => ({ fixtureId: line.fixtureId, jobId: line.jobId, order: nextBulletOrder(rows, line.fixtureId) + i, words: b.words, on: b.on, wantsPhoto: b.wantsPhoto, reads: b.reads, templateId: b.templateId })),
          me,
        ),
      )
    return (
      <div data-start-check-stage={line.fixtureId} data-start-check-starter>
        <p style={{ margin: 0 }}>{say.lead}</p>
        <ol style={{ margin: '6px 0 0', paddingLeft: '1.2rem', ...rowLine, ...muted }}>
          {starter.bullets.map((b, i) => (
            <li key={b.templateId ?? i}>
              {b.words} <span style={{ whiteSpace: 'nowrap' }}>{b.on === 'them' ? (b.wantsPhoto ? 'From them, with a photo.' : 'From them.') : 'Ours.'}</span>{' '}
              {starter.fromCompany && can.company && b.templateId ? (
                <button type="button" className="scWord" disabled={busy} onClick={() => void act('It was not taken off the company’s list.', (w) => w.retireTemplate(b.templateId as string, me))}>
                  Take off the company’s list
                </button>
              ) : null}
            </li>
          ))}
        </ol>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button type="button" className="scPress" style={bluePress} disabled={busy} onClick={use}>
            {say.use}
          </button>
          <button type="button" className="scPress" style={plainPress} onClick={() => setWriting(true)}>
            {say.own}
          </button>
        </div>
        {writing ? addRow : null}
      </div>
    )
  }

  const t = theirDay(stage)
  const moved = movedDays(stage)
  const decideBy = goNoGoDay(stage, site)
  const openList = openBullets(stage)
  const metList = metBullets(stage)
  const first = stage.theirDays[0]
  const window = stage.window
  const len = window ? Math.max(0, daysBetween(window[0], window[1])) : 0
  const setWindow = (start: string, end: string) => press((w) => w.setWindow({ jobId: line.jobId, fixtureId: line.fixtureId }, start, end, me))
  const noticeHome = notice.home
  const standing = standingDecisionOf(rows, line.fixtureId)
  const keepNotice = (days: number | null) => press((w) => w.setNotice(noticeKey, days, me))
  const locked = can.window ? undefined : W.officeOnly

  return (
    <div data-start-check-stage={line.fixtureId}>
      <ValueLines>
        <ValueLine label="We start">
          <ChangeableValue
            text={window ? weekDay(window[0]) : W.noDay}
            label="our first day"
            type="date"
            value={window?.[0] ?? ''}
            hint="our first day"
            locked={locked}
            onKeep={(v) => setWindow(v, addDays(v, len))}
          />
          {window ? (
            <>
              <span style={muted}> to </span>
              <ChangeableValue text={weekDay(window[1])} label="our last day" type="date" value={window[1]} min={window[0]} hint="our last day" locked={locked} onKeep={(v) => setWindow(window[0], v)} />
            </>
          ) : null}
        </ValueLine>

        <ValueLine label={`${t ? t.who : site.contact} says ready`}>
          <ChangeableValue
            text={t ? weekDay(t.day) : W.noDay}
            label="the day they say ready"
            type="date"
            value={t?.day ?? ''}
            hint="a new day from them, kept beside the old one"
            onKeep={(v) => press((w) => w.giveTheirDay({ jobId: line.jobId, fixtureId: line.fixtureId, readyDay: v, saidOn: today, who: site.contact, how: 'told us' }, me))}
          />
          {t && window && startClash(stage) ? (
            <span style={{ color: 'var(--text-red-700)', fontWeight: 600 }}>
              {' '}
              · <WorkedOutValue tone="red">{countWords(daysBetween(window[0], t.day), 'day', 'days')}</WorkedOutValue> after our start
            </span>
          ) : null}
          {moved && first ? (
            <span style={muted}>
              {' '}
              · first said <WorkedOutValue>{monthDay(first.day)}</WorkedOutValue>, so it has moved <WorkedOutValue tone="red">{countWords(moved, 'day', 'days')}</WorkedOutValue>
            </span>
          ) : null}
        </ValueLine>

        <ValueLine label="Notice we need">
          <ChangeableValue
            text={countWords(notice.days, 'day', 'days')}
            label="days of notice"
            type="number"
            whole
            min="0"
            max={String(NOTICE_DAYS_MAX)}
            value={String(notice.days)}
            hint={`days of notice, for this ${noticeHome}`}
            fromDefault={notice.own ? undefined : 'default'}
            setOwnLabel={`Set this ${noticeHome}’s own`}
            backToDefault={notice.own ? { label: `Back to the default, ${countWords(notice.defaultDays, 'day', 'days')}`, onPress: () => keepNotice(null) } : undefined}
            locked={can.notice ? undefined : { tag: W.officeOnly.tag, why: 'Only the office can change the days of notice for a site.' }}
            onKeep={(v) => keepNotice(Number(v))}
          />
        </ValueLine>

        <ValueLine label="We decide by">
          {decideBy ? (
            <>
              <WorkedOutValue>{weekDay(decideBy)}</WorkedOutValue>
              <span style={muted}> · {inDaysWords(today, decideBy)}</span>
            </>
          ) : (
            <span style={muted}>after we plan our days</span>
          )}
        </ValueLine>
      </ValueLines>
      <ValuesLegend />

      {t && window && startClash(stage) && can.window ? (
        <div style={{ marginTop: 8 }}>
          <button type="button" className="scPress" style={bluePress} disabled={busy} onClick={() => void act('Our start did not move.', (w) => w.setWindow({ jobId: line.jobId, fixtureId: line.fixtureId }, addDays(t.day, MOVE_AFTER_THEIRS_DAYS), addDays(t.day, MOVE_AFTER_THEIRS_DAYS + len), me))}>
            Move our start to {weekDay(addDays(t.day, MOVE_AFTER_THEIRS_DAYS))}, three days after theirs
          </button>
        </div>
      ) : null}
      {stage.theirDays.length > 2 ? (
        <p style={{ margin: '6px 0 0', ...rowLine, ...muted }} data-their-days>
          Their days, each kept: {stage.theirDays.map((d) => `${monthDay(d.day)}, said ${monthDay(d.said)}`).join(' → ')}
        </p>
      ) : null}

      <div style={{ ...cap, marginTop: 14, color: openList.length ? 'var(--text-strong)' : 'var(--text-green-700)' }} data-start-check-open={openList.length}>
        {openList.length ? W.stillOpen(openList.length) : W.nothingOpen}
      </div>
      {openList.map((b) => (
        <BulletRow key={b.id} b={b} stage={stage} line={line} rows={rows} site={site} today={today} me={me} kind={kind} canCompany={can.company} busy={busy} act={act} press={press} io={io} templates={templates} />
      ))}
      {metList.length ? (
        <div style={{ marginTop: 14, opacity: 0.62 }} data-start-check-met={metList.length}>
          <div style={cap}>{W.hasAYes(metList.length)}</div>
          {metList.map((b) => (
            <BulletRow key={b.id} b={b} stage={stage} line={line} rows={rows} site={site} today={today} me={me} kind={kind} canCompany={can.company} busy={busy} act={act} press={press} io={io} templates={templates} />
          ))}
        </div>
      ) : null}
      {addRow}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }} data-start-check-foot>
        {ask && openOnThem(stage).length ? (
          <button type="button" className="scPress" style={bluePress} aria-expanded={asking} onClick={() => (setAsking(!asking), setDeciding(false))}>
            Ask {site.contact} about {openOnThem(stage).length}
          </button>
        ) : null}
        {standing ? (
          <>
            <span style={{ color: standing.kind === 'go' ? 'var(--text-green-700)' : 'var(--text-amber-800)', fontWeight: 600 }} data-start-check-decision={standing.kind}>
              <ValueSentence text={decisionWords({ kind: standing.kind, by: standing.by_name, day: standing.decided_on, openThen: standing.open_then })} />
            </span>
            {can.decide ? (
              <button type="button" className="scWord" disabled={busy} onClick={() => void act('It was not taken back.', (w) => w.takeBackDecision(standing.id))}>
                {standing.kind === 'go' ? DECIDE_WORDS.takeBack : DECIDE_WORDS.takeHoldBack}
              </button>
            ) : null}
          </>
        ) : null}
        {can.decide && standing?.kind !== 'go' ? (
          <button type="button" className="scPress" style={plainPress} aria-expanded={deciding} onClick={() => (setDeciding(!deciding), setAsking(false))}>
            Go or hold
          </button>
        ) : null}
        {can.decide ? <span style={{ fontSize: '0.78125rem', ...muted }}>Your name goes on the decision.</span> : null}
      </div>
      {ask && asking ? <StartCheckAskPanel stages={[{ stage, line }]} site={site} today={today} me={me} door={ask} press={press} onClose={() => setAsking(false)} /> : null}
      {deciding ? (
        <StartCheckDecidePanel
          stage={stage}
          site={site}
          today={today}
          press={press}
          onClose={() => setDeciding(false)}
          onHeld={(note) => {
            setDeciding(false)
            setHoldNote(note)
          }}
        />
      ) : null}
      {holdNote && ask ? <StartCheckAskPanel stages={[{ stage, line }]} site={site} today={today} me={me} door={ask} press={press} onClose={() => setHoldNote(null)} hold={{ text: holdNote }} /> : null}
    </div>
  )
}

type RowProps = {
  b: Bullet
  /** The company's lists, so a No already on its kind's list is not offered to it again. */
  templates?: readonly StartTemplateRow[]
  stage: Stage
  line: StageLine
  rows: StartCheckRows
  site: Site
  today: string
  me: StartWho
  kind: StartStageKind | null
  canCompany: boolean
  busy: boolean
  act: (what: string, write: (io: StartChecksIo) => Promise<void>) => Promise<void>
  press: (write: (io: StartChecksIo) => Promise<void>) => Promise<void>
  io: StartChecksIo
}

function BulletRow(props: RowProps) {
  return props.b.on === 'us' ? <OursRow {...props} b={props.b} /> : <TheirsRow {...props} b={props.b} />
}

function rowShell(children: ReactNode, more: ReactNode, testId: string, standing: string) {
  return (
    <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }} data-start-check-bullet={testId} data-standing={standing}>
      {children}
      {more}
    </div>
  )
}

function OursRow({ b, line, rows, me, kind, canCompany, busy, act, press }: RowProps & { b: UsBullet }) {
  const [more, setMore] = useState(false)
  const yes = bulletIsYes(b)
  return rowShell(
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <button type="button" className="scBox" aria-label={b.words} aria-pressed={yes} disabled>
        {yes ? '✓' : ''}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--text-strong)' }}>{b.words}</div>
        <div style={{ ...rowLine, ...muted }}>
          {b.fact}{' '}
          {b.reads === 'hand' && b.door ? (
            <button type="button" className="scWord" disabled={busy} onClick={() => void act('It was not marked.', (w) => w.tickByHand(b.id, !yes, me))}>
              {b.door}
            </button>
          ) : b.href && b.door ? (
            // A bullet read from the app is fixed on the screen that holds the fact: its press is a door there.
            <Link className="scWord" to={b.href}>
              {b.door}
            </Link>
          ) : null}
        </div>
      </div>
      {/* Whose it is, and where it is read from: a value a person can change, in place. */}
      <span style={{ fontSize: '0.75rem', ...muted, whiteSpace: 'nowrap' }}>
        ours, <ChangeableValue text={readsLabel(b.reads)} label="where this is read from" type="choice" value={b.reads} choices={READS_CHOICES} hint="where this is read from" onKeep={(v) => press((w) => w.changeBullet(b.id, { reads: v as UsReads }))} />
      </span>
      <button type="button" className="scMore" aria-label={`More on: ${b.words}`} aria-expanded={more} onClick={() => setMore(!more)}>
        ⋯
      </button>
    </div>,
    more ? (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0 0 34px', alignItems: 'center' }}>
        <button type="button" className="scChip" disabled={busy} onClick={() => void act('The bullet was not taken off.', (w) => w.removeBullet(b.id, me))}>
          {W.takeOff}
        </button>
        {canCompany && kind ? (
          <button type="button" className="scChip" disabled={busy} onClick={() => void act('It was not added to the company’s list.', (w) => w.addTemplate({ kind, order: nextBulletOrder(rows, line.fixtureId), words: b.words, on: 'us', wantsPhoto: false, reads: b.reads }, me))}>
            {W.toCompany(kind)}
          </button>
        ) : null}
      </div>
    ) : null,
    b.id,
    yes ? 'yes' : 'open',
  )
}

function TheirsRow({ b, stage, line, rows, site, today, me, kind, canCompany, busy, act, press, io, templates }: RowProps & { b: ThemBullet }) {
  const { showToast } = useToastContext()
  const [more, setMore] = useState(false)
  const file = useRef<HTMLInputElement | null>(null)
  const yes = bulletIsYes(b)
  const mark = liveMarkOf(rows, b.id)
  const needsPhoto = waitsOnPhoto(b)
  const no = saidNo(stage, b)
  const asked = lastAsk(b)
  const onCompanyList = (templates ?? []).some((t) => !t.retired_at && t.stage_kind === kind && t.words.trim().toLowerCase() === b.words.trim().toLowerCase())

  const say = (know: Know, photo: Parameters<StartChecksIo['sayYes']>[0]['photo'] = null, id?: string) =>
    act('The yes was not kept.', (w) =>
      w.sayYes({ id, bulletId: b.id, jobId: line.jobId, know, who: know === 'saw' ? me.name || 'One of ours' : site.contact, how: know === 'saw' ? 'on site' : know === 'photo' ? 'sent a photo' : 'told us', day: today, photo }, mark?.id ?? null, me),
    )
  /** Their photo is a real one: it is picked, shrunk and kept before the yes says photo. */
  const pickPhoto = async (picked: File | null | undefined) => {
    if (!picked) return
    try {
      const id = crypto.randomUUID()
      const takenAt = new Date().toISOString()
      const shot = await shrinkPhoto(picked)
      const photo = await io.uploadPhoto(line.jobId, id, shot.blob, picked.name || 'photo.jpg', takenAt)
      await say('photo', photo, id)
    } catch (e) {
      showToast(`The photo was not kept. ${formatErrorMessage(e)}`, 'error')
    } finally {
      if (file.current) file.current.value = ''
    }
  }
  const seePhoto = async () => {
    const url = mark?.photo_storage_path ? await io.photoUrl(mark.photo_storage_path) : null
    if (url) window.open(url, '_blank', 'noopener')
    else showToast('The photo could not be opened.', 'error')
  }

  return rowShell(
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <button
        type="button"
        className="scBox"
        aria-label={b.words}
        aria-pressed={yes}
        disabled={busy}
        onClick={() => (mark ? void act('The yes was not taken back.', (w) => w.takeBackYes(mark.id, me)) : void say('word'))}
      >
        {yes ? '✓' : ''}
      </button>
      <div style={{ flex: '1 1 14rem', minWidth: 0 }}>
        <div style={{ color: 'var(--text-strong)' }}>{b.words}</div>
        {no ? (
          <div style={{ ...rowLine, color: 'var(--text-red-700)', fontWeight: 600 }}>
            {stage.arrival?.by} said No on site, {stage.arrival ? monthDay(stage.arrival.day) : ''}. It was not as told.
            {/* A thing that was not as told on one site is worth asking on every job of this kind: the office is offered it here (PR 10). */}
            {canCompany && kind && !onCompanyList ? (
              <>
                {' '}
                <button type="button" className="scWord" disabled={busy} onClick={() => void act('It was not added to the company’s list.', (w) => w.addTemplate({ kind, order: nextBulletOrder(rows, line.fixtureId), words: b.words, on: 'them', wantsPhoto: b.wantsPhoto, reads: null }, me))}>
                  {W.toCompany(kind)}
                </button>
              </>
            ) : null}
          </div>
        ) : (
          <div style={{ ...rowLine, color: needsPhoto ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
            {b.yes && mark ? (
              <>
                <ChangeableValue text={b.yes.who} label="who said it" type="text" value={b.yes.who} hint="who said it" onKeep={(v) => press((w) => w.changeYes(mark.id, { who: v }))} />,{' '}
                <ChangeableValue text={b.yes.how || 'told us'} label="how it reached us" type="text" value={b.yes.how} hint="how it reached us" canClear onKeep={(v) => press((w) => w.changeYes(mark.id, { how: v }))} />,{' '}
                <ChangeableValue text={monthDay(b.yes.day)} label="the day" type="date" value={b.yes.day} max={today} hint="the day they said it" onKeep={(v) => press((w) => w.changeYes(mark.id, { day: v }))} />
                {'.'}
                {needsPhoto ? ' Still needs a photo.' : ''}
              </>
            ) : (
              <>
                {asked ? (
                  <>
                    Asked <WorkedOutValue>{monthDay(asked.day)}</WorkedOutValue> by {asked.how}. No answer yet.
                  </>
                ) : (
                  'Not asked yet.'
                )}{' '}
                They say by{' '}
                <ChangeableValue
                  text={b.byDay ? monthDay(b.byDay) : 'no day'}
                  label="the day they say it will be true"
                  type="date"
                  value={b.byDay ?? ''}
                  canClear
                  hint="the day they say it will be true"
                  onKeep={(v) => press((w) => w.changeBullet(b.id, { byDay: v || null }))}
                />
                {'.'}
                {b.wantsPhoto ? ' A photo is asked for.' : ''}
              </>
            )}
          </div>
        )}
        {needsPhoto ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
            <button type="button" className="scChip" disabled={busy} onClick={() => file.current?.click()}>
              {W.theySentAPhoto}
            </button>
            <button type="button" className="scChip" disabled={busy} onClick={() => void say('saw')}>
              {W.weSawIt}
            </button>
          </div>
        ) : null}
        {mark?.photo_storage_path ? (
          <div style={{ marginTop: 3 }}>
            <button type="button" className="scWord" onClick={() => void seePhoto()}>
              {W.seeThePhoto}
            </button>
          </div>
        ) : null}
      </div>
      <span style={{ fontSize: '0.75rem', ...muted, whiteSpace: 'nowrap' }}>{whoseTag(b, site.contact)}</span>
      <button type="button" className="scMore" aria-label={`More on: ${b.words}`} aria-expanded={more} onClick={() => setMore(!more)}>
        ⋯
      </button>
      <input ref={file} type="file" accept="image/*" hidden aria-label={`Their photo for: ${b.words}`} onChange={(e) => void pickPhoto(e.target.files?.[0])} />
    </div>,
    more ? (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0 0 34px', alignItems: 'center' }}>
        {b.yes ? (
          <>
            <span style={{ fontSize: '0.78125rem', ...muted }}>{W.howDoWeKnow}</span>
            {(['word', 'photo', 'saw'] as Know[]).map((k) => (
              <button key={k} type="button" className="scChip" aria-pressed={b.yes?.know === k} disabled={busy} onClick={() => (k === 'photo' ? file.current?.click() : void say(k))}>
                {KNOW_WORDS[k]}
              </button>
            ))}
          </>
        ) : null}
        <button type="button" className="scChip" aria-pressed={b.wantsPhoto} disabled={busy} onClick={() => void act('The bullet was not changed.', (w) => w.changeBullet(b.id, { wantsPhoto: !b.wantsPhoto }))}>
          {b.wantsPhoto ? W.asksForPhoto : W.askForPhoto}
        </button>
        {/* The eye: whether the GC's page may show this bullet. It shows nothing until the job's own switch is on. */}
        <button type="button" className="scChip" aria-pressed={b.eye} disabled={busy} onClick={() => void act('The bullet was not changed.', (w) => w.changeBullet(b.id, { shownToGc: !b.eye }))}>
          {b.eye ? W.shownToGc : W.hiddenFromGc}
        </button>
        <button type="button" className="scChip" disabled={busy} onClick={() => void act('The bullet was not taken off.', (w) => w.removeBullet(b.id, me))}>
          {W.takeOff}
        </button>
        {canCompany && kind ? (
          <button type="button" className="scChip" disabled={busy} onClick={() => void act('It was not added to the company’s list.', (w) => w.addTemplate({ kind, order: nextBulletOrder(rows, line.fixtureId), words: b.words, on: 'them', wantsPhoto: b.wantsPhoto, reads: null }, me))}>
            {W.toCompany(kind)}
          </button>
        ) : null}
      </div>
    ) : null,
    b.id,
    no ? 'no' : yes ? 'yes' : 'open',
  )
}
