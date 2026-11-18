/**
 * Before we start, the spike (punch list #382). A working playground, not a shipped page: one made-up site, three
 * seats over one store. The office decides, the GC answers on their page, the crew looks on arrival, and a press in
 * one seat shows in the others. The one idea under every screen: it is a checklist, the same checklist in every
 * seat, and each stage says where it stands in one sentence with one press.
 */
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  KNOW_WORDS,
  bulletLine,
  lastAsk,
  addDays,
  askText,
  bulletIsYes,
  countWords,
  daySpan,
  daysBetween,
  goNoGoDay,
  holdText,
  inDaysWords,
  lastCheckDay,
  monthDay,
  movedDays,
  openBullets,
  readiness,
  openOnThem,
  sharedBullets,
  siteMovedDays,
  stageStanding,
  stagesAhead,
  stagesToAsk,
  theirDay,
  waitsOnPhoto,
  sentenceParts,
  val,
  weekDay,
  CHANGEABLE_VALUES,
  type Bullet,
  type Know,
  type Light,
  type Stage,
  type ValueKind,
} from '../../lib/startChecks/startChecks'
import { useSpikeStore, type SpikeStore } from './spikeStore'

const LIGHT: Record<Light, string> = { green: '#16a34a', amber: '#f59e0b', red: '#dc2626', grey: '#9ca3af' }

const card: CSSProperties = { background: 'var(--surface)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 12, padding: '12px 14px' }
const btn: CSSProperties = { borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong, #aab2bd)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 8, padding: '7px 12px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }
const btnBlue: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
const btnGreen: CSSProperties = { ...btn, background: '#15803d', borderColor: '#15803d', color: '#fff' }
const linkBtn: CSSProperties = { border: 'none', background: 'none', color: 'var(--text-link)', padding: 0, fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const muted: CSSProperties = { color: 'var(--text-muted)' }
const cap: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const input: CSSProperties = { border: '1px solid var(--border-strong, #aab2bd)', borderRadius: 8, padding: '6px 8px', background: 'var(--surface)', color: 'var(--text-base, #1a1a1a)', fontSize: 14 }
const chip = (on: boolean): CSSProperties => ({ borderWidth: 1, borderStyle: 'solid', borderColor: on ? 'var(--text-blue-700)' : 'var(--border)', background: on ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)', color: on ? 'var(--text-blue-700)' : 'var(--text-muted)', borderRadius: 999, padding: '2px 10px', fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: 'pointer' })

// ---------- A value inside a sentence ----------

/**
 * A value you can change where it stands: underlined, tinted, and a press turns it into its own field. A value that
 * is worked out is bold and nothing else, so a reader can tell the two apart at a glance.
 */
const changeable: CSSProperties = { font: 'inherit', fontWeight: 700, color: 'var(--text-strong)', background: 'var(--bg-blue-tint)', borderRadius: 4, padding: '0 3px', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '2px dotted var(--text-link)', cursor: 'pointer' }
const workedOut: CSSProperties = { fontWeight: 700, color: 'var(--text-strong)' }

function Change({ text, type, value, onKeep, hint, min }: { text: string; type: 'date' | 'text' | 'number'; value: string; onKeep: (v: string) => void; hint?: string; min?: string }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  if (!open) {
    return (
      <button
        type="button"
        title={hint ?? 'Press to change'}
        style={changeable}
        onClick={(e) => {
          e.stopPropagation()
          setDraft(value)
          setOpen(true)
        }}
      >
        {text}
      </button>
    )
  }
  const keep = () => {
    if (draft && draft !== value) onKeep(draft)
    setOpen(false)
  }
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', verticalAlign: 'middle' }}>
      <input
        autoFocus
        type={type}
        value={draft}
        min={min}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') keep()
          if (e.key === 'Escape') setOpen(false)
        }}
        style={{ ...input, padding: '2px 6px', fontSize: 14, width: type === 'number' ? 64 : type === 'text' ? 130 : undefined }}
      />
      <button type="button" style={{ ...btnBlue, padding: '2px 8px', fontSize: 13 }} onClick={keep}>
        Keep
      </button>
      <button type="button" style={{ ...linkBtn, fontSize: 13 }} onClick={() => setOpen(false)}>
        Cancel
      </button>
      {hint ? <span style={{ fontSize: 12, ...muted }}>{hint}</span> : null}
    </span>
  )
}

/** A sentence from the rules, its values drawn apart: the changeable ones as fields, the rest bold. */
function Sentence({ text, stage, store }: { text: string; stage: Stage | null; store: SpikeStore }) {
  const { site } = store.state
  const field = (kind: ValueKind, t: string, i: number) => {
    if (!stage || !CHANGEABLE_VALUES.has(kind)) return <b key={i} style={workedOut}>{t}</b>
    if (kind === 'start') return <Change key={i} text={t} type="date" value={stage.window[0]} onKeep={(v) => store.moveWindow(stage.id, v)} hint="our first day" />
    if (kind === 'their') return <Change key={i} text={t} type="date" value={theirDay(stage)?.day ?? ''} onKeep={(v) => store.theyGaveADay(stage.id, v, site.contact, 'told us')} hint="a new day from them, kept beside the old one" />
    if (kind === 'notice') return <Change key={i} text={t} type="number" value={String(site.noticeDays)} onKeep={(v) => store.setNotice(Number(v))} hint="days of notice, for this site" />
    return <Change key={i} text={t} type="text" value={site.contact} onKeep={(v) => store.setContact(v)} hint="who we ask" />
  }
  return <>{sentenceParts(text).map((p, i) => (typeof p === 'string' ? <span key={i}>{p}</span> : field(p.kind, p.text, i)))}</>
}

// ---------- The ready bar ----------

/**
 * Small check boxes with a line under them, so the row reads as a bar: green under what is ready, amber under what
 * is open, red under an open one once the stage is urgent or the crew said No. Every bullet is one equal step.
 */
type ReadyMark = 'yes' | 'open' | 'no'
function ReadyBar({ marks, urgent, light }: { marks: ReadyMark[]; urgent: boolean; light?: boolean }) {
  const size = 12
  return (
    <span aria-hidden style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
      {marks.map((m, i) => {
        const line = m === 'yes' ? '#16a34a' : m === 'no' || urgent ? '#dc2626' : '#f59e0b'
        return (
          <span key={i} style={{ display: 'inline-grid', justifyItems: 'center', padding: '0 2px', boxSizing: 'content-box' }}>
            <span style={{ width: size, height: size, borderRadius: 3, display: 'inline-grid', placeItems: 'center', fontSize: 9, fontWeight: 800, lineHeight: 1, color: '#fff', background: m === 'yes' ? '#16a34a' : m === 'no' ? '#dc2626' : light ? '#fff' : 'var(--surface)', borderWidth: 1.5, borderStyle: 'solid', borderColor: m === 'yes' ? '#16a34a' : m === 'no' ? '#dc2626' : light ? '#6b7280' : 'var(--text-muted)' }}>
              {m === 'yes' ? '✓' : m === 'no' ? '✕' : ''}
            </span>
            <span style={{ display: 'block', height: 4, marginTop: 3, background: line, justifySelf: 'stretch', margin: '3px -2px 0', borderRadius: i === 0 ? '2px 0 0 2px' : i === marks.length - 1 ? '0 2px 2px 0' : 0 }} />
          </span>
        )
      })}
    </span>
  )
}

// ---------- The marks beside a stage ----------

/**
 * One small box per bullet beside the stage's name: open ones first, then the ones with a yes. Empty is open, a green
 * check is a yes, a red cross is a No the crew gave on site. Resting the cursor on the row (or pressing it on a
 * phone) lists what it takes to start, open bullets first.
 */
function Marks({ stage, urgent }: { stage: Stage; urgent: boolean }) {
  const [show, setShow] = useState(false)
  if (!stage.bullets.length) return null
  const saidNo = (b: Bullet) => !bulletIsYes(b) && !!stage.arrival?.notAsTold.includes(b.id)
  const open = stage.bullets.filter((b) => !bulletIsYes(b))
  const met = stage.bullets.filter((b) => bulletIsYes(b))
  const ready = readiness(stage.bullets)
  const box = (b: Bullet, size: number) => {
    const yes = bulletIsYes(b)
    const no = saidNo(b)
    return (
      <span key={b.id} aria-hidden style={{ width: size, height: size, borderRadius: 4, flex: '0 0 auto', display: 'inline-grid', placeItems: 'center', fontSize: size * 0.72, fontWeight: 800, lineHeight: 1, color: '#fff', background: yes ? '#16a34a' : no ? '#dc2626' : 'var(--surface)', borderWidth: 2, borderStyle: 'solid', borderColor: yes ? '#16a34a' : no ? '#dc2626' : 'var(--text-muted)' }}>
        {yes ? '✓' : no ? '✕' : ''}
      </span>
    )
  }
  const line = (b: Bullet) => (saidNo(b) ? `${stage.arrival?.by} said No on site, ${monthDay(stage.arrival?.day ?? '')}` : b.on === 'us' ? `Ours. ${b.fact}` : bulletLine(b))
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`${ready.pct}% ready, ${met.length} of ${stage.bullets.length}. Press to see what it takes to start.`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      onClick={(e) => {
        e.stopPropagation()
        setShow((v) => !v)
      }}
      style={{ position: 'relative', display: 'inline-flex', gap: 3, alignItems: 'center', marginLeft: 10, verticalAlign: 'middle', cursor: 'help', fontWeight: 400 }}
    >
      <ReadyBar urgent={urgent} marks={[...met.map((): ReadyMark => 'yes'), ...open.filter(saidNo).map((): ReadyMark => 'no'), ...open.filter((b) => !saidNo(b)).map((): ReadyMark => 'open')]} />
      <span style={{ fontSize: 13, marginLeft: 5, color: ready.pct === 100 ? 'var(--text-green-700)' : 'var(--text-strong)', fontWeight: 700 }}>{ready.pct}%</span>
      <span style={{ fontSize: 12.5, ...muted }}>ready</span>
      {show ? (
        <span style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20, width: 'min(420px, 80vw)', background: 'var(--surface)', color: 'var(--text-base, #1a1a1a)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong, #aab2bd)', borderRadius: 10, padding: '10px 12px', boxShadow: '0 10px 30px rgba(0,0,0,0.18)', fontSize: 13.5, lineHeight: 1.4, cursor: 'default', display: 'block' }}>
          <b style={{ color: 'var(--text-strong)', fontSize: 14 }}>{open.length ? `What it takes to start ${stage.name}` : `${stage.name} has every yes`}</b>
          <span style={{ display: 'block', fontSize: 12.5, ...muted }}>
            {ready.yes} of {ready.total} ready, which is {ready.pct}%. Every bullet counts the same.
          </span>
          {open.length ? <span style={{ ...cap, display: 'block', marginTop: 8, color: 'var(--text-strong)' }}>Still open · {open.length}</span> : null}
          {open.map((b) => (
            <span key={b.id} style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'flex-start' }}>
              {box(b, 16)}
              <span>
                <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{b.words}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: saidNo(b) ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{line(b)}</span>
              </span>
            </span>
          ))}
          {met.length ? <span style={{ ...cap, display: 'block', marginTop: 10 }}>Has a yes · {met.length}</span> : null}
          {met.map((b) => (
            <span key={b.id} style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'flex-start', opacity: 0.65 }}>
              {box(b, 14)}
              <span>{b.words}</span>
            </span>
          ))}
        </span>
      ) : null}
    </span>
  )
}

function Dot({ light }: { light: Light }) {
  return <span aria-hidden style={{ width: 14, height: 14, borderRadius: '50%', background: LIGHT[light], display: 'inline-block', flex: '0 0 auto', marginTop: 4 }} />
}

function Box({ on, auto, onPress, label }: { on: boolean; auto?: boolean; onPress?: () => void; label: string }) {
  return (
    <button type="button" aria-label={label} aria-pressed={on} disabled={!onPress} onClick={onPress} style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${on ? '#15803d' : 'var(--border-strong, #aab2bd)'}`, background: on ? '#15803d' : 'var(--surface)', color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1, cursor: onPress ? 'pointer' : 'default', opacity: auto ? 0.75 : 1, flex: '0 0 auto' }}>
      {on ? '✓' : ''}
    </button>
  )
}

// ---------- The office ----------

function OfficeBullet({ stage, b, store }: { stage: Stage; b: Bullet; store: SpikeStore }) {
  const { site, me } = store.state
  const [more, setMore] = useState(false)
  const yes = bulletIsYes(b)
  if (b.on === 'us') {
    return (
      <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)', alignItems: 'flex-start' }}>
        <Box on={yes} auto label={b.words} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--text-strong)' }}>{b.words}</div>
          <div style={{ fontSize: 13, ...muted }}>
            {b.fact} ·{' '}
            <button type="button" style={linkBtn} onClick={() => store.pretendOurs(stage.id, b.id)}>
              {b.door}
            </button>
          </div>
        </div>
        <span style={{ fontSize: 12, ...muted, whiteSpace: 'nowrap' }}>ours · read from the app</span>
      </div>
    )
  }
  const set = (know: Know) => store.sayYes(stage.id, b.id, know, know === 'saw' ? me : site.contact, know === 'saw' ? 'on site' : know === 'photo' ? 'sent a photo' : 'told us')
  const needsPhoto = waitsOnPhoto(b)
  const saidNo = !b.yes && !!stage.arrival?.notAsTold.includes(b.id)
  return (
    <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Box on={yes} label={b.words} onPress={() => (b.yes ? store.takeBack(stage.id, b.id) : set('word'))} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--text-strong)' }}>{b.words}</div>
          {saidNo ? (
            <div style={{ fontSize: 13, color: 'var(--text-red-700)', fontWeight: 600 }}>
              {stage.arrival?.by} said No on site, {stage.arrival ? monthDay(stage.arrival.day) : ''}. It was not as told.
            </div>
          ) : (
            <div style={{ fontSize: 13, color: needsPhoto ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
              {b.yes ? (
                <>
                  <Change text={b.yes.who} type="text" value={b.yes.who} onKeep={(v) => store.editYes(stage.id, b.id, { who: v })} hint="who said it" />,{' '}
                  <Change text={b.yes.how} type="text" value={b.yes.how} onKeep={(v) => store.editYes(stage.id, b.id, { how: v })} hint="how" />,{' '}
                  <Change text={monthDay(b.yes.day)} type="date" value={b.yes.day} onKeep={(v) => store.editYes(stage.id, b.id, { day: v })} hint="the day" />
                  {needsPhoto ? '. Still needs a photo' : ''}
                </>
              ) : (
                <>
                  {lastAsk(b) ? (
                    <>
                      Asked <b style={workedOut}>{monthDay(lastAsk(b)?.day ?? '')}</b> by {lastAsk(b)?.how}, no answer yet
                    </>
                  ) : (
                    'Not asked yet'
                  )}
                  {' · '}they say by <Change text={b.byDay ? monthDay(b.byDay) : 'no day'} type="date" value={b.byDay ?? ''} onKeep={(v) => store.setByDay(stage.id, b.id, v)} hint="the day they say it will be true" />
                  {b.wantsPhoto ? ' · a photo is asked for' : ''}
                </>
              )}
            </div>
          )}
          {needsPhoto ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
              <button type="button" style={chip(false)} onClick={() => set('photo')}>
                They sent a photo
              </button>
              <button type="button" style={chip(false)} onClick={() => set('saw')}>
                We saw it
              </button>
            </div>
          ) : null}
        </div>
        <span style={{ fontSize: 12, ...muted, whiteSpace: 'nowrap' }}>from {site.contact}</span>
        <button type="button" aria-label={`More on: ${b.words}`} aria-expanded={more} onClick={() => setMore(!more)} style={{ ...linkBtn, fontSize: 18, lineHeight: 1, padding: '0 4px', color: 'var(--text-muted)' }}>
          ⋯
        </button>
      </div>
      {more ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0 0 34px', alignItems: 'center' }}>
          {b.yes ? (
            <>
              <span style={{ fontSize: 12.5, ...muted }}>How do we know?</span>
              {(['word', 'photo', 'saw'] as Know[]).map((k) => (
                <button key={k} type="button" style={chip(b.yes?.know === k)} onClick={() => set(k)}>
                  {KNOW_WORDS[k]}
                </button>
              ))}
              <span style={{ width: 8 }} />
            </>
          ) : null}
          <button type="button" style={chip(b.wantsPhoto)} onClick={() => store.togglePhoto(stage.id, b.id)}>
            {b.wantsPhoto ? '✓ Asks for a photo' : 'Ask for a photo'}
          </button>
          <button type="button" style={chip(b.eye)} onClick={() => store.toggleEye(stage.id, b.id)}>
            {b.eye ? '✓ Shows on the GC’s page' : 'Hidden from the GC’s page'}
          </button>
          <button type="button" style={chip(false)} onClick={() => store.removeBullet(stage.id, b.id)}>
            Take off the list
          </button>
        </div>
      ) : null}
    </div>
  )
}

function AskPanel({ stages, store, onClose }: { stages: Stage[]; store: SpikeStore; onClose: () => void }) {
  const { site } = store.state
  const [text, setText] = useState(() => askText(site, stages))
  const ids = stages.map((s) => s.id)
  const n = stages.reduce((sum, s) => sum + openOnThem(s).length, 0)
  const done = (how: string) => {
    store.markAsked(ids, how)
    onClose()
  }
  return (
    <div style={{ ...card, borderColor: '#2563eb', marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <b style={{ color: 'var(--text-strong)' }}>
          Ask {site.contact} about {countWords(n, 'thing', 'things')}
        </b>
        <button type="button" style={linkBtn} onClick={onClose}>
          Close
        </button>
      </div>
      <p style={{ margin: '4px 0 8px', fontSize: 13, ...muted }}>One message for {countWords(stages.length, 'stage', 'stages')}. Change any word. Nothing is sent from here: send it your way, then say how.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(16, text.split('\n').length + 1)} style={{ ...input, width: '100%', fontFamily: 'inherit', lineHeight: 1.45 }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
        <button type="button" style={btn} onClick={() => void navigator.clipboard?.writeText(text)}>
          Copy
        </button>
        <span style={muted}>Then:</span>
        <button type="button" style={btnBlue} onClick={() => done('text')}>
          I texted it
        </button>
        <button type="button" style={btn} onClick={() => done('email')}>
          I emailed it
        </button>
        <button type="button" style={btn} onClick={() => done('phone')}>
          I called
        </button>
      </div>
    </div>
  )
}

function DecidePanel({ stage, store, onClose }: { stage: Stage; store: SpikeStore; onClose: () => void }) {
  const { site, today } = store.state
  const open = openBullets(stage)
  const [newStart, setNewStart] = useState(() => addDays(stage.window[0], 7))
  const [told, setTold] = useState(false)
  return (
    <div style={{ ...card, marginTop: 10, borderColor: 'var(--text-strong)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <b style={{ color: 'var(--text-strong)', fontSize: 16 }}>Go or hold?</b>
        <button type="button" style={linkBtn} onClick={onClose}>
          Close
        </button>
      </div>
      <p style={{ margin: '4px 0 10px' }}>
        {open.length ? (
          <>
            {countWords(open.length, 'thing is', 'things are')} still open: <b style={{ color: 'var(--text-strong)' }}>{open.map((b) => b.words).join(' ')}</b>
          </>
        ) : (
          'Everything on the list has a yes.'
        )}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <div style={{ ...card, borderColor: '#15803d', borderWidth: 2 }}>
          <b style={{ color: 'var(--text-strong)' }}>Go</b>
          <p style={{ margin: '4px 0 8px' }}>
            Send the crew for {weekDay(stage.window[0])}.{' '}
            {open.length ? `This is a go on a promise. It comes back to you ${weekDay(lastCheckDay(stage))}, the day before the crew leaves.` : 'Their page will read crew confirmed.'}
          </p>
          <button
            type="button"
            style={btnGreen}
            onClick={() => {
              store.decide(stage.id, 'go')
              onClose()
            }}
          >
            {open.length ? 'Go, on their promise' : 'Go'}
          </button>
        </div>
        <div style={{ ...card, borderColor: '#b45309', borderWidth: 2 }}>
          <b style={{ color: 'var(--text-strong)' }}>Hold</b>
          <p style={{ margin: '4px 0 6px' }}>Keep the crew home, and move our start to:</p>
          <input type="date" value={newStart} min={today} onChange={(e) => setNewStart(e.target.value || newStart)} style={input} />
          <p style={{ margin: '8px 0 4px', fontSize: 13, ...muted }}>The note for {site.contact}, to send your way:</p>
          <div style={{ ...input, fontSize: 13.5, lineHeight: 1.45 }}>{holdText(site, stage, newStart)}</div>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '8px 0', fontSize: 13 }}>
            <input type="checkbox" checked={told} onChange={(e) => setTold(e.target.checked)} /> I sent {site.contact} this note
          </label>
          <button
            type="button"
            style={btn}
            onClick={() => {
              store.decide(stage.id, 'hold', newStart)
              if (told) store.markAsked([stage.id], 'the hold note')
              onClose()
            }}
          >
            Hold until {monthDay(newStart)}
          </button>
        </div>
      </div>
    </div>
  )
}

function StagePanel({ stage, store }: { stage: Stage; store: SpikeStore }) {
  const { site, today, me } = store.state
  const [mode, setMode] = useState<'ask' | 'decide' | null>(null)
  const [words, setWords] = useState('')
  const [on, setOn] = useState<'them' | 'us'>('them')
  const t = theirDay(stage)
  const moved = movedDays(stage)
  const openList = stage.bullets.filter((b) => !bulletIsYes(b))
  const metList = stage.bullets.filter((b) => bulletIsYes(b))
  if (!stage.bullets.length) {
    return (
      <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <p style={{ margin: 0 }}>No list yet for {stage.name}. Start from four common bullets, then change them.</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" style={btnBlue} onClick={() => store.useStarter(stage.id)}>
            Use the four
          </button>
          <button type="button" style={btn} onClick={() => store.addBullet(stage.id, 'The site is ready for us.', 'them')}>
            Write my own
          </button>
        </div>
      </div>
    )
  }
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', gap: '8px 16px', alignItems: 'baseline', lineHeight: 1.6 }}>
        <span style={muted}>We start</span>
        <span>
          <Change text={weekDay(stage.window[0])} type="date" value={stage.window[0]} onKeep={(v) => store.moveWindow(stage.id, v)} hint="our first day" />
          <span style={muted}> to </span>
          <Change text={weekDay(stage.window[1])} type="date" value={stage.window[1]} min={stage.window[0]} onKeep={(v) => store.setWindowEnd(stage.id, v)} hint="our last day" />
        </span>

        <span style={muted}>{t ? t.who : site.contact} says ready</span>
        <span>
          <Change text={t ? weekDay(t.day) : 'no day yet'} type="date" value={t?.day ?? ''} onKeep={(v) => store.theyGaveADay(stage.id, v, site.contact, 'told us')} hint="a new day from them, kept beside the old one" />
          {t && t.day > stage.window[0] ? (
            <span style={{ color: 'var(--text-red-700)', fontWeight: 600 }}>
              {' '}
              · <b>{countWords(daysBetween(stage.window[0], t.day), 'day', 'days')}</b> after our start
            </span>
          ) : null}
          {moved ? (
            <span style={muted}>
              {' '}
              · first said <b style={workedOut}>{monthDay(stage.theirDays[0].day)}</b>, so it has moved <b style={{ ...workedOut, color: 'var(--text-red-700)' }}>{countWords(moved, 'day', 'days')}</b>
            </span>
          ) : null}
        </span>

        <span style={muted}>Notice we need</span>
        <span>
          <Change text={countWords(site.noticeDays, 'day', 'days')} type="number" value={String(site.noticeDays)} onKeep={(v) => store.setNotice(Number(v))} hint="days of notice, for this site" />
        </span>

        <span style={muted}>We decide by</span>
        <span>
          <b style={workedOut}>{weekDay(goNoGoDay(stage, site))}</b>
          <span style={muted}> · {inDaysWords(today, goNoGoDay(stage, site))}</span>
        </span>
      </div>
      <p style={{ margin: '2px 0 0', fontSize: 12.5, ...muted }}>
        <span style={{ ...changeable, cursor: 'default', fontSize: 12.5 }}>Underlined</span> values change where they sit: press one. <b style={workedOut}>Bold</b> values are worked out.
      </p>
      {t && t.day > stage.window[0] ? (
        <div style={{ marginTop: 6 }}>
          <button type="button" style={btnBlue} onClick={() => store.moveWindow(stage.id, addDays(t.day, 3))}>
            Move our start to {weekDay(addDays(t.day, 3))}, three days after theirs
          </button>
        </div>
      ) : null}
      {stage.theirDays.length > 2 ? (
        <p style={{ margin: '6px 0 0', fontSize: 13, ...muted }}>
          Their days, each kept: {stage.theirDays.map((d) => `${monthDay(d.day)} (${d.who}, ${d.how}, said ${monthDay(d.said)})`).join(' → ')}
        </p>
      ) : null}

      <div style={{ ...cap, marginTop: 14, color: openList.length ? 'var(--text-strong)' : 'var(--text-green-700)' }}>{openList.length ? `Still open · ${openList.length}` : 'Nothing is open'}</div>
      {openList.map((b) => (
        <OfficeBullet key={b.id} stage={stage} b={b} store={store} />
      ))}
      {metList.length ? (
        <div style={{ marginTop: 14, paddingTop: 2, opacity: 0.62 }}>
          <div style={cap}>Has a yes · {metList.length}</div>
          {metList.map((b) => (
            <OfficeBullet key={b.id} stage={stage} b={b} store={store} />
          ))}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
        <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="Add a bullet, in plain words" style={{ ...input, flex: '1 1 260px' }} />
        <button type="button" style={chip(on === 'them')} onClick={() => setOn('them')}>
          from them
        </button>
        <button type="button" style={chip(on === 'us')} onClick={() => setOn('us')}>
          ours
        </button>
        <button
          type="button"
          style={btn}
          disabled={!words.trim()}
          onClick={() => {
            store.addBullet(stage.id, words.trim(), on)
            setWords('')
          }}
        >
          Add
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
        {openOnThem(stage).length ? (
          <button type="button" style={btnBlue} onClick={() => setMode(mode === 'ask' ? null : 'ask')}>
            Ask {site.contact} about {openOnThem(stage).length}
          </button>
        ) : null}
        {stage.decision?.kind === 'go' ? (
          <>
            <span style={{ color: 'var(--text-green-700)', fontWeight: 700 }}>
              Go · {stage.decision.by}, {monthDay(stage.decision.day)}
            </span>
            <button type="button" style={linkBtn} onClick={() => store.undoDecision(stage.id)}>
              Take the Go back
            </button>
          </>
        ) : (
          <button type="button" style={openBullets(stage).length ? btn : btnGreen} onClick={() => setMode(mode === 'decide' ? null : 'decide')}>
            Go or hold
          </button>
        )}
        <span style={{ fontSize: 12.5, ...muted }}>You are {me}. Your name goes on the decision.</span>
      </div>
      {mode === 'ask' ? <AskPanel stages={[stage]} store={store} onClose={() => setMode(null)} /> : null}
      {mode === 'decide' ? <DecidePanel stage={stage} store={store} onClose={() => setMode(null)} /> : null}
    </div>
  )
}

function Chart({ store }: { store: SpikeStore }) {
  const { stages, site, today } = store.state
  const ahead = stagesAhead(stages)
  const a0 = addDays(today, -17)
  const len = 120
  const x = (ymd: string) => (Math.max(0, Math.min(len, daysBetween(a0, ymd))) / len) * 100
  const row: CSSProperties = { position: 'relative', height: 30, borderTop: '1px dashed var(--border)' }
  return (
    <div style={{ ...card, marginTop: 12, paddingLeft: 190, position: 'relative', paddingTop: 22 }}>
      {ahead.map((s) => {
        const st = stageStanding(s, site, today)
        return (
          <div key={s.id} style={row}>
            <span style={{ position: 'absolute', left: -176, top: 6, width: 170, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <b style={{ color: 'var(--text-strong)' }}>{s.part}</b> · {s.name}
            </span>
            <span style={{ position: 'absolute', top: 7, height: 16, borderRadius: 5, background: LIGHT[st.light], left: `${x(s.window[0])}%`, width: `${Math.max(0.8, x(addDays(s.window[1], 1)) - x(s.window[0]))}%` }} />
            {s.bullets.length ? <span title="Go or no-go" style={{ position: 'absolute', top: 3, height: 24, borderLeft: '2px dotted var(--text-muted)', left: `${x(goNoGoDay(s, site))}%` }} /> : null}
            {s.theirDays.map((d, i) => (
              <span key={d.day + i} title={`They said ready ${monthDay(d.day)}`} style={{ position: 'absolute', top: 9, width: 11, height: 11, transform: 'translateX(-5px) rotate(45deg)', left: `${x(d.day)}%`, background: i === s.theirDays.length - 1 ? 'var(--text-strong)' : 'transparent', border: `2px solid ${i === s.theirDays.length - 1 ? 'var(--surface)' : 'var(--text-muted)'}` }} />
            ))}
            {movedDays(s) ? <span style={{ position: 'absolute', top: 7, left: `calc(${x(addDays(s.window[1], 1))}% + 8px)`, fontSize: 11, fontWeight: 700, color: 'var(--text-red-700)', whiteSpace: 'nowrap' }}>moved {countWords(movedDays(s), 'day', 'days')}</span> : null}
          </div>
        )
      })}
      <span style={{ position: 'absolute', top: 6, bottom: 8, left: `calc(190px + (100% - 204px) * ${x(today) / 100})`, borderLeft: '2px solid var(--text-red-700)' }}>
        <span style={{ position: 'absolute', top: -4, left: 4, fontSize: 10, fontWeight: 700, color: 'var(--text-red-700)' }}>today</span>
      </span>
      <p style={{ margin: '8px 0 0 -176px', fontSize: 12.5, ...muted }}>A bar is our window, in the stage's own colour. ◆ is the day they say ready, ◇ a day they gave before, the dotted line is the day we decide.</p>
    </div>
  )
}

function OfficeSeat({ store }: { store: SpikeStore }) {
  const { site, stages, today, log } = store.state
  const [openId, setOpenId] = useState<string | null>('s2')
  const [asking, setAsking] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const ahead = stagesAhead(stages)
  const toAsk = stagesToAsk(stages, site, today)
  const nAsk = toAsk.reduce((n, s) => n + openOnThem(s).length, 0)
  const moved = siteMovedDays(stages)
  const order: Record<Light, number> = { red: 0, amber: 1, green: 2, grey: 3 }
  const sorted = useMemo(() => [...ahead].sort((a, b) => order[stageStanding(a, site, today).light] - order[stageStanding(b, site, today).light] || a.window[0].localeCompare(b.window[0])), [ahead, site, today]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'baseline' }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-strong)' }}>{site.name}</span>
        <span style={muted}>
          {site.customer} · {site.where} · {countWords(ahead.length, 'stage', 'stages')} ahead
        </span>
      </div>
      <div style={{ ...card, marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', borderColor: nAsk ? '#2563eb' : 'var(--border)' }}>
        <div>
          <b style={{ color: 'var(--text-strong)', fontSize: 16 }}>{nAsk ? `${site.contact} owes us ${countWords(nAsk, 'answer', 'answers')} on ${countWords(toAsk.length, 'stage', 'stages')}.` : `Nothing to ask ${site.contact} right now.`}</b>
          <div style={{ fontSize: 13, ...muted }}>
            {site.contact}, {site.contactRole}
            {moved ? ` · they have moved ${countWords(moved, 'day', 'days')} on this site so far` : ''}
          </div>
        </div>
        {nAsk ? (
          <button type="button" style={btnBlue} onClick={() => setAsking(!asking)}>
            Ask {site.contact} about all {nAsk}
          </button>
        ) : null}
      </div>
      {asking ? <AskPanel stages={toAsk} store={store} onClose={() => setAsking(false)} /> : null}

      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        {sorted.map((s) => {
          const st = stageStanding(s, site, today)
          const open = openId === s.id
          return (
            <div key={s.id} style={{ ...card, boxShadow: `inset 5px 0 0 ${LIGHT[st.light]}`, paddingLeft: 18 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Dot light={st.light} />
                <div role="button" tabIndex={0} onClick={() => setOpenId(open ? null : s.id)} onKeyDown={(e) => (e.key === 'Enter' ? setOpenId(open ? null : s.id) : undefined)} style={{ flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 16 }}>
                    {s.part} · {s.name} <span style={{ fontWeight: 500, fontSize: 13, ...muted }}>· {daySpan(s.window[0], s.window[1])}</span>
                    <Marks stage={s} urgent={st.light === 'red'} />
                  </div>
                  <div style={{ marginTop: 2, lineHeight: 1.7 }}>
                    <Sentence text={st.sentence} stage={s} store={store} />
                  </div>
                </div>
                <button type="button" style={open ? btn : st.next === 'none' ? btn : st.light === 'green' ? btnGreen : btnBlue} onClick={() => setOpenId(open ? null : s.id)}>
                  {open ? 'Close' : (st.nextLabel ?? 'Open')}
                </button>
              </div>
              {open ? <StagePanel stage={s} store={store} /> : null}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <button type="button" style={linkBtn} onClick={() => setShowChart(!showChart)}>
          {showChart ? 'Hide the line of time' : 'Show it on a line of time'}
        </button>
        {showChart ? <Chart store={store} /> : null}
      </div>
      {log.length ? (
        <div style={{ marginTop: 14, fontSize: 12.5, ...muted }}>
          <div style={cap}>What just happened</div>
          {log.slice(0, 6).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ---------- The GC's page and the crew's phone ----------

function Phone({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ width: 'min(100%, 390px)', border: '2px solid var(--text-muted)', borderRadius: 28, padding: '12px 10px 14px', background: 'var(--bg-subtle)' }}>
      <div style={{ ...cap, textAlign: 'center', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function GcStage({ stage, store }: { stage: Stage; store: SpikeStore }) {
  const { site, today } = store.state
  const shared = sharedBullets(stage).filter((b) => b.on === 'them')
  const open = shared.filter((b) => !bulletIsYes(b))
  const settled = shared.filter((b) => bulletIsYes(b))
  const [picked, setPicked] = useState<string[] | null>(null)
  const [photo, setPhoto] = useState(false)
  const [notYet, setNotYet] = useState('')
  const sel = picked ?? []
  const goConfirmed = stage.decision?.kind === 'go' && openBullets(stage).length === 0
  const needsPhoto = open.some((b) => sel.includes(b.id) && b.on === 'them' && b.wantsPhoto)
  const toggle = (id: string) => setPicked(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])
  return (
    <div data-theme="light" style={{ background: '#fff', color: '#1f2937', border: '1px solid #d1d5db', borderRadius: 14, padding: 12, marginTop: 10, colorScheme: 'light' }}>
      <b>{stage.name}</b> <span style={{ color: '#6b7280' }}>· {stage.part}</span>
      <div style={{ color: '#6b7280', fontSize: 13 }}>We plan {daySpan(stage.window[0], stage.window[1])}</div>
      {goConfirmed ? (
        <div style={{ marginTop: 8, border: '1px solid #86efac', background: '#f0fdf4', color: '#166534', borderRadius: 10, padding: 10 }}>
          <b>Crew confirmed for {weekDay(stage.window[0])}</b>
          <div style={{ fontSize: 13 }}>Everything we asked for has a yes.</div>
        </div>
      ) : shared.length ? (
        <div style={{ marginTop: 8, border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 10, padding: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <b>Before we can start</b>
            <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
              <ReadyBar light urgent={daysBetween(today, goNoGoDay(stage, site)) < 0} marks={[...settled.map((): ReadyMark => 'yes'), ...open.map((): ReadyMark => 'open')]} />
              <b>{readiness(shared).pct}%</b>
              <span style={{ fontSize: 12.5, color: '#6b7280' }}>ready</span>
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: '#374151' }}>
            We need <b>{site.noticeDays} days</b> to get a crew there. Answer by <b>{weekDay(goNoGoDay(stage, site))}</b> and we lock in <b>{monthDay(stage.window[0])}</b>.
          </div>
          {open.length ? (
            <div style={{ marginTop: 12, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1e3a8a' }}>
              Still needed from you · {open.length}
            </div>
          ) : null}
          {open.map((b) => {
            const on = sel.includes(b.id)
            return (
              <label key={b.id} style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'flex-start', cursor: 'pointer', background: '#fff', border: `2px solid ${on ? '#15803d' : '#93c5fd'}`, borderRadius: 10, padding: '10px 10px' }}>
                <input type="checkbox" checked={on} onChange={() => toggle(b.id)} style={{ width: 22, height: 22, marginTop: 1, flex: '0 0 auto' }} />
                <span>
                  <b style={{ fontSize: 15 }}>{b.words}</b>
                  {b.on === 'them' && b.wantsPhoto ? <span style={{ display: 'block', fontSize: 12.5, color: '#92400e', marginTop: 2 }}>We need a photo of this one{b.yes ? '. You told us yes already.' : '.'}</span> : null}
                </span>
              </label>
            )
          })}
          {open.length ? (
            <>
              {open.length > 1 && sel.length < open.length ? (
                <button type="button" onClick={() => setPicked(open.map((b) => b.id))} style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer', padding: 0, marginTop: 10, fontSize: 13 }}>
                  All of these are ready
                </button>
              ) : null}
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, fontSize: 13 }}>
                <input type="checkbox" checked={photo} onChange={(e) => setPhoto(e.target.checked)} /> I am adding a photo
              </label>
              <button
                type="button"
                disabled={!sel.length}
                onClick={() => {
                  store.gcAnswers(stage.id, sel, photo)
                  setPicked(null)
                  setPhoto(false)
                }}
                style={{ display: 'block', width: '100%', marginTop: 8, border: 'none', borderRadius: 10, padding: '11px 8px', fontWeight: 700, fontSize: 15, background: sel.length ? '#15803d' : '#9ca3af', color: '#fff', cursor: sel.length ? 'pointer' : 'default' }}
              >
                {!sel.length ? 'Tap what is ready' : sel.length === open.length ? (open.length === 1 ? 'Yes, this is ready' : `Yes, all ${open.length} are ready`) : `Yes, ${countWords(sel.length, 'is', 'are')} ready`}
              </button>
              {needsPhoto && !photo ? <div style={{ fontSize: 12.5, color: '#92400e', marginTop: 4 }}>One of these needs a photo. Without it we will still ask.</div> : null}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, fontSize: 13 }}>
                <span>Not ready yet? It will be ready</span>
                <input type="date" value={notYet} min={today} onChange={(e) => setNotYet(e.target.value)} style={{ border: '1px solid #9ca3af', borderRadius: 6, padding: '3px 6px' }} />
                <button
                  type="button"
                  disabled={!notYet}
                  onClick={() => {
                    store.theyGaveADay(stage.id, notYet, site.contact, 'on his page')
                    setNotYet('')
                  }}
                  style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer' }}
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <div style={{ marginTop: 8, fontSize: 13, color: '#374151' }}>Thank you. We have every answer. We will confirm the crew here.</div>
          )}
          {settled.length ? (
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280' }}>Already settled · {settled.length}</div>
              {settled.map((b) => (
                <div key={b.id} style={{ display: 'flex', gap: 6, marginTop: 5, fontSize: 13, color: '#6b7280' }}>
                  <span style={{ color: '#15803d', fontWeight: 700 }}>✓</span>
                  <span>
                    {b.words}{' '}
                    <span style={{ whiteSpace: 'nowrap' }}>{b.on === 'them' && b.yes ? (b.yes.know === 'saw' ? '· we saw it on site' : b.yes.know === 'photo' ? `· your photo, ${monthDay(b.yes.day)}` : `· you told us ${monthDay(b.yes.day)}`) : ''}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function GcSeat({ store }: { store: SpikeStore }) {
  const { site, stages } = store.state
  const [switchOn, setSwitchOn] = useState(true)
  const ahead = stagesAhead(stages).filter((s) => s.bullets.length)
  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <Phone title={`${site.contact}'s page · what the GC sees`}>
        <div style={{ ...cap, letterSpacing: '0.2em' }}>Where the job is</div>
        {switchOn ? ahead.slice(0, 3).map((s) => <GcStage key={s.id} stage={s} store={store} />) : ahead.slice(0, 3).map((s) => (
          <div key={s.id} style={{ background: '#fff', color: '#1f2937', border: '1px solid #d1d5db', borderRadius: 14, padding: 12, marginTop: 10 }}>
            <b>{s.name}</b> <span style={{ color: '#6b7280' }}>· {s.part}</span>
            <div style={{ color: '#6b7280', fontSize: 13 }}>We plan {daySpan(s.window[0], s.window[1])}</div>
          </div>
        ))}
      </Phone>
      <div style={{ ...card, flex: '1 1 280px', maxWidth: 460 }}>
        <b style={{ color: 'var(--text-strong)' }}>The office's switch for this page</b>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input type="checkbox" checked={switchOn} onChange={(e) => setSwitchOn(e.target.checked)} /> Show what we need before each stage
        </label>
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Off, the page is what it is today: the stages and our dates.</li>
          <li>On, each stage shows only the bullets with the eye on. Turn an eye off in the office seat and it leaves this page.</li>
          <li>Their press is a yes on their word, by name, with the time. With a photo it is a yes with their photo.</li>
          <li>Never here: our own bullets, what we saw, the days they gave before, a name, a trip, a cost.</li>
        </ul>
        <p style={{ margin: '10px 0 0', fontSize: 13, ...muted }}>Try it: answer here, then switch to the office seat and read the stage's sentence.</p>
      </div>
    </div>
  )
}

function CrewSeat({ store }: { store: SpikeStore }) {
  const { stages, site } = store.state
  const ahead = stagesAhead(stages).filter((s) => s.bullets.length)
  const [id, setId] = useState(ahead[0]?.id ?? '')
  const [nos, setNos] = useState<string[]>([])
  const stage = ahead.find((s) => s.id === id) ?? ahead[0]
  if (!stage) return <p>No stage has a list yet.</p>
  const toLook = stage.bullets.filter((b) => b.on === 'them' && !(b.yes && b.yes.know === 'saw'))
  const toggle = (bid: string) => setNos(nos.includes(bid) ? nos.filter((x) => x !== bid) : [...nos, bid])
  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <Phone title="Luis's phone · first clock-in on the stage">
        <div style={{ ...card }}>
          <select value={stage.id} onChange={(e) => { setId(e.target.value); setNos([]) }} style={{ ...input, width: '100%', fontWeight: 700 }}>
            {ahead.map((s) => (
              <option key={s.id} value={s.id}>
                {s.part} · {s.name}
              </option>
            ))}
          </select>
          <div style={{ ...muted, marginTop: 2 }}>{site.name}</div>
          {stage.arrival ? (
            <div style={{ marginTop: 10, borderRadius: 10, padding: 10, border: `1px solid ${stage.arrival.notAsTold.length ? 'var(--text-amber-800)' : 'var(--text-green-700)'}`, color: stage.arrival.notAsTold.length ? 'var(--text-amber-800)' : 'var(--text-green-700)', fontWeight: 700 }}>
              {stage.arrival.notAsTold.length ? `Dispatch has it: ${countWords(stage.arrival.notAsTold.length, 'thing', 'things')} not as told.` : 'Saved: all as told.'}
              <div style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 13 }}>You are clocked in either way.</div>
            </div>
          ) : (
            <>
              <p style={{ margin: '10px 0 0' }}>
                <b style={{ color: 'var(--text-strong)' }}>Is it as told?</b> Look before you unload.
              </p>
              {toLook.length ? (
                toLook.map((b) => (
                  <div key={b.id} style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: 9 }}>
                    <span>{b.words}</span>
                    <button type="button" style={{ ...chip(false), ...(nos.includes(b.id) ? { borderColor: 'var(--text-amber-800)', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint, #fffbeb)', fontWeight: 700 } : {}) }} onClick={() => toggle(b.id)}>
                      No
                    </button>
                  </div>
                ))
              ) : (
                <p style={muted}>One of ours has already seen every bullet.</p>
              )}
              <button type="button" style={{ ...(nos.length ? btn : btnGreen), width: '100%', marginTop: 12, padding: '11px 12px', fontSize: 15 }} onClick={() => { store.crewArrives(stage.id, 'Luis', nos); setNos([]) }}>
                {nos.length ? `Tell Dispatch: ${countWords(nos.length, 'thing', 'things')} not as told` : 'Yes, all as told'}
              </button>
            </>
          )}
        </div>
      </Phone>
      <div style={{ ...card, flex: '1 1 280px', maxWidth: 460 }}>
        <b style={{ color: 'var(--text-strong)' }}>What this does</b>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Yes turns every bullet into a yes we saw. That is the strongest kind.</li>
          <li>A No opens the bullet again and turns the stage red in the office seat, with who told us it was ready.</li>
          <li>The crew is never stopped. It is clocked in either way.</li>
        </ul>
        <p style={{ margin: '10px 0 0', fontSize: 13, ...muted }}>Try it: press No on one, then read the office seat.</p>
      </div>
    </div>
  )
}

// ---------- The page ----------

type Seat = 'office' | 'gc' | 'crew'

export default function BeforeWeStartSpike() {
  const store = useSpikeStore()
  const [seat, setSeat] = useState<Seat>('office')
  const { today } = store.state
  const tab = (s: Seat, label: string) => (
    <button type="button" onClick={() => setSeat(s)} style={{ ...btn, borderRadius: 999, padding: '6px 14px', ...(seat === s ? { background: 'var(--text-strong)', color: 'var(--surface)', borderColor: 'var(--text-strong)' } : {}) }}>
      {label}
    </button>
  )
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page, #f0f2f5)', color: 'var(--text-base, #1a1a1a)', padding: '16px 16px 60px' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={cap}>Spike · punch list #382 · made-up site · nothing is saved to the app</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-strong)' }}>Before we start</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {tab('office', 'The office')}
            {tab('gc', 'The GC’s page')}
            {tab('crew', 'The crew’s phone')}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={muted}>Today is</span>
            <button type="button" style={{ ...btn, padding: '4px 10px' }} onClick={() => store.shiftToday(-1)} aria-label="A day back">
              −
            </button>
            <b style={{ color: 'var(--text-strong)', minWidth: 92, textAlign: 'center' }}>{weekDay(today)}</b>
            <button type="button" style={{ ...btn, padding: '4px 10px' }} onClick={() => store.shiftToday(1)} aria-label="A day on">
              +
            </button>
            <button type="button" style={linkBtn} onClick={store.reset}>
              Start over
            </button>
          </div>
        </div>
        {seat === 'office' ? <OfficeSeat store={store} /> : seat === 'gc' ? <GcSeat store={store} /> : <CrewSeat store={store} />}
      </div>
    </div>
  )
}
