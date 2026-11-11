import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import type { CallLink, CallOutcome, MoveDone } from '../../lib/bridge/calls'
import { WEEK_CALL_MOVES, WEEK_CALL_MOVES_PHONE, WEEK_HOW, movesShown, movesToRecord, type WeekCallModel, type WeekMove, type WeekTile, type WeekTone } from '../../lib/bridge/weekCall'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { chipName, type CallPerson, type RecordedMove } from '../../lib/bridge/callPeople'

/**
 * The Bridge's first screen (punch list #303, PR 1): three tiles and the week's call with its
 * moves. The words are `buildWeekCall`'s; this draws them and holds what the owner changes
 * before the press: a move taken off, a person renamed. The doors to everything behind it are
 * `BridgeDoors`, drawn by the page under this since PR 2.
 *
 * Before a call: the page proposes and one press records. Once a call stands: the same card
 * shows each move against today. From Friday: it asks whether the step moved.
 */

const label: CSSProperties = { fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', lineHeight: 1.25 }
const fine: CSSProperties = { fontSize: '0.76rem', color: 'var(--text-muted)' }

const toneText = (t: WeekTone): string => (t === 'red' ? 'var(--text-red-700)' : t === 'green' ? 'var(--text-green-700)' : t === 'amber' ? 'var(--text-amber-800)' : 'var(--text)')
const doneColor = (d: MoveDone | null): string => (d === 'yes' ? 'var(--text-green-700)' : d === 'part' ? 'var(--text-amber-800)' : d === 'no' ? 'var(--text-red-700)' : 'var(--text-muted)')

/** The pick that switches the chip to a typed name. */
const TYPE_A_NAME = '__type_a_name__'

const pressBase: CSSProperties = { font: 'inherit', fontSize: '0.95rem', fontWeight: 700, minHeight: 48, borderRadius: 10, border: 'none', padding: '0.5rem 0.9rem', cursor: 'pointer', width: '100%' }
const smallPress: CSSProperties = { font: 'inherit', fontSize: '0.8rem', fontWeight: 700, minHeight: 36, borderRadius: 8, padding: '0.25rem 0.8rem', cursor: 'pointer' }

function Tile({ tile, narrow, onNote }: { tile: WeekTile; narrow: boolean; onNote: () => void }) {
  const red = tile.tone === 'red'
  return (
    <div
      data-testid={`bridge-week-tile-${tile.id}`}
      style={{
        gridColumn: tile.wide ? '1 / -1' : undefined,
        background: red ? 'var(--bg-red-tint)' : 'var(--surface)',
        border: `1px solid ${red ? 'var(--border-red)' : 'var(--border)'}`,
        borderRadius: 10,
        padding: narrow ? '0.5rem 0.55rem' : '0.7rem 0.9rem',
        minWidth: 0,
      }}
    >
      <div style={label}>{tile.label}</div>
      <div style={{ fontSize: tile.wide ? (narrow ? '1.3rem' : '1.7rem') : narrow ? '1.35rem' : '1.9rem', fontWeight: 800, lineHeight: 1.15, color: toneText(tile.tone), fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{tile.value}</div>
      {tile.bars && tile.bars.length > 0 && (
        <div aria-hidden style={{ display: 'flex', alignItems: 'flex-end', gap: narrow ? 2 : 4, height: narrow ? 22 : 30, margin: '4px 0 2px', maxWidth: 280 }}>
          {tile.bars.map((b) => (
            <i
              key={b.label}
              title={b.label}
              style={{
                flex: 1,
                height: `${Math.max(6, Math.round(b.share * 100))}%`,
                borderRadius: 1,
                background: b.waiting ? 'repeating-linear-gradient(135deg, #2563eb 0 3px, transparent 3px 6px)' : '#2563eb',
                opacity: b.current ? 1 : 0.55,
              }}
            />
          ))}
        </div>
      )}
      <div style={{ fontSize: narrow ? '0.72rem' : '0.82rem', color: 'var(--text-muted)', lineHeight: 1.3, marginTop: 2 }}>{tile.sub}</div>
      {/* The accounts left out of cash on hand (v2.6838): the list and its switches sit behind Money. */}
      {tile.note && (
        <button type="button" onClick={onNote} data-testid="bridge-week-tile-note" style={{ display: 'block', font: 'inherit', textAlign: 'left', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: narrow ? '0.72rem' : '0.8rem', color: 'var(--text-amber-800)', lineHeight: 1.3, marginTop: 2, textDecoration: 'underline' }}>
          {tile.note}
        </button>
      )}
    </div>
  )
}

export function BridgeWeek({
  model,
  recording,
  answering,
  onRecord,
  onAnswer,
  onPickStep,
  onCashNote,
  strip,
  people = [],
}: {
  model: WeekCallModel
  recording: boolean
  answering: boolean
  /** `note` is the line typed under Add a note, or null. A move carries its person's account when one was picked (PR 4). */
  onRecord: (link: CallLink, moves: RecordedMove[], note: string | null) => void
  onAnswer: (outcome: CallOutcome) => void
  /** Opens The flow, where a press on a step makes it the proposal. */
  onPickStep: () => void
  /** Opens Money at the bank's accounts, from the sentence that names what is left out. */
  onCashNote: () => void
  /** The strip of pipe (PR 3): under the tiles in a usual week, under the card in a week cash leads. */
  strip?: ReactNode
  /** The accounts a move can go to (PR 4). With none, the chip takes a typed name, which reaches nobody. */
  people?: ReadonlyArray<CallPerson>
}) {
  const narrow = useIsNarrowScreen()
  const proposing = model.state === 'propose'
  const cap = narrow ? WEEK_CALL_MOVES_PHONE : WEEK_CALL_MOVES
  const movesKey = `${model.link ?? ''}|${model.card.moves.map((m) => m.title).join('|')}`
  const [off, setOff] = useState<Set<number>>(new Set())
  const [who, setWho] = useState<Map<number, string>>(new Map())
  // The account picked with a changed name (PR 4); a typed name has none.
  const [whoIds, setWhoIds] = useState<Map<number, string | null>>(new Map())
  // The chip being changed, and whether it is taking a typed name in place of a pick.
  const [editing, setEditing] = useState<number | null>(null)
  const [typing, setTyping] = useState(false)
  // A note on the call (v2.6840): one line, typed before the press, read again under the call on Friday.
  const [note, setNote] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  useEffect(() => {
    setOff(new Set())
    setWho(new Map())
    setWhoIds(new Map())
    setEditing(null)
    setTyping(false)
    setNote('')
    setNoteOpen(false)
  }, [movesKey])
  // While it proposes, the card shows `cap` moves still on the call: one taken off stays, greyed, and the next comes on.
  const shown = useMemo(() => (proposing ? movesShown(model.card.moves, off, cap) : model.card.moves.slice(0, cap)), [proposing, model.card.moves, off, cap])

  const toRecord = proposing ? movesToRecord(shown, off, who, whoIds) : []
  const canRecord = proposing && model.link != null && toRecord.length > 0 && !recording
  const border = model.card.tone === 'lit' ? '#dc2626' : model.card.tone === 'ask' ? '#2563eb' : 'var(--border-strong)'

  const moveRow = (m: WeekMove, i: number) => {
    const isOff = off.has(i)
    const name = who.get(i) ?? m.who
    // The account on the move as it stands: the pick, none for a typed name, or the one it was proposed with.
    const id = whoIds.has(i) ? (whoIds.get(i) ?? null) : who.has(i) ? null : (m.whoId ?? null)
    const pick = (value: string) => {
      if (value === TYPE_A_NAME) {
        setTyping(true)
        return
      }
      const person = people.find((p) => p.id === value) ?? null
      setWho((w) => new Map(w).set(i, person ? chipName(person, people) : ''))
      setWhoIds((w) => new Map(w).set(i, person ? person.id : null))
      setEditing(null)
    }
    return (
      <li key={m.title} data-testid="bridge-week-move" style={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr) auto', gap: '2px 8px', alignItems: 'start', padding: '6px 0', borderTop: '1px solid var(--border)', minHeight: 48, opacity: isOff ? 0.5 : 1 }}>
        <span aria-hidden style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-muted)', color: 'var(--text)', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
          {i + 1}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.3, textDecoration: isOff ? 'line-through' : undefined }}>
            {m.kind === 'cash' && (
              <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: 4, padding: '1px 5px', marginRight: 5, verticalAlign: 1, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', border: '1px solid var(--border-red)' }}>cash</span>
            )}
            {m.door && !isOff ? (
              <Link to={m.door.to} title={m.door.label} style={{ color: 'inherit', textDecoration: 'none' }}>
                {m.title} <span style={{ color: 'var(--text-link)' }}>›</span>
              </Link>
            ) : (
              m.title
            )}
          </span>
          {m.why && <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>{m.why}</span>}
        </span>
        {proposing ? (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            {editing === i && people.length > 0 && !typing ? (
              // A pick from the accounts: the move then reaches that person's Needs you.
              <select
                autoFocus
                aria-label={`Who does: ${m.title}`}
                value={id ?? ''}
                onChange={(e) => pick(e.target.value)}
                onBlur={() => setEditing(null)}
                data-testid="bridge-week-who-pick"
                style={{ font: 'inherit', fontSize: '0.8rem', maxWidth: 150, minHeight: 32, padding: '0.1rem 0.3rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)' }}
              >
                <option value="">Nobody</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value={TYPE_A_NAME}>Type a name…</option>
              </select>
            ) : editing === i ? (
              <input
                autoFocus
                aria-label={`Who does: ${m.title}`}
                placeholder="who"
                defaultValue={id ? '' : name}
                onBlur={(e) => {
                  const v = e.target.value
                  setWho((w) => new Map(w).set(i, v))
                  setWhoIds((w) => {
                    const next = new Map(w)
                    next.delete(i)
                    return next
                  })
                  setEditing(null)
                  setTyping(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                style={{ font: 'inherit', fontSize: '0.8rem', width: 96, minHeight: 32, padding: '0.1rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)' }}
              />
            ) : (
              <button
                type="button"
                disabled={isOff}
                onClick={() => {
                  setTyping(false)
                  setEditing(i)
                }}
                title={name && !id && people.length > 0 ? 'No account, so this move reaches nobody’s Needs you.' : undefined}
                aria-label={name ? `${name} does: ${m.title} Press to change.` : `Name who does: ${m.title}`}
                data-testid="bridge-week-who"
                style={{ font: 'inherit', fontSize: '0.74rem', fontWeight: 600, minHeight: 32, padding: '0 0.6rem', borderRadius: 999, border: `1px ${name && (id || people.length === 0) ? 'solid' : 'dashed'} var(--border-strong)`, background: 'transparent', color: name ? 'var(--text)' : 'var(--text-muted)', cursor: isOff ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
              >
                {name || 'who?'}
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                setOff((s) => {
                  const next = new Set(s)
                  if (next.has(i)) next.delete(i)
                  else next.add(i)
                  return next
                })
              }
              aria-label={isOff ? `Put back on the call: ${m.title}` : `Take off the call: ${m.title}`}
              style={{ font: 'inherit', fontSize: '0.7rem', minHeight: 24, padding: '0 2px', border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer' }}
            >
              {isOff ? 'put back' : 'take off'}
            </button>
          </span>
        ) : (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, paddingTop: 2 }}>
            <b style={{ fontSize: '0.74rem', color: doneColor(m.done), whiteSpace: 'nowrap' }}>{m.doneText}</b>
            {m.who && <span style={{ ...fine, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{m.who}</span>}
          </span>
        )}
      </li>
    )
  }

  const answerPresses = (small: boolean) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: small ? 6 : 8 }}>
      <button type="button" disabled={answering} onClick={() => onAnswer('moved')} style={{ ...(small ? smallPress : pressBase), border: 'none', background: answering ? DEAD_PRESS_FILL : '#15803d', color: answering ? DEAD_PRESS_TEXT : '#ffffff' }}>
        It moved
      </button>
      <button type="button" disabled={answering} onClick={() => onAnswer('did_not_move')} style={{ ...(small ? smallPress : pressBase), border: '1.5px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)' }}>
        It did not
      </button>
    </div>
  )

  const last = model.last
  // At a desk, until a first call exists, the side panel says how the week runs.
  const how = !narrow && !last && proposing && model.link != null
  return (
    <section id="bridge-week" aria-label="This week on the Bridge" data-testid="bridge-week" style={{ scrollMarginTop: 'calc(var(--app-top-chrome, 0px) + 3rem)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: narrow ? 8 : 12 }}>
        {model.tiles.map((t) => (
          <Tile key={t.id} tile={t} narrow={narrow} onNote={onCashNote} />
        ))}
      </div>
      {!model.cashLeads && strip}

      <div style={{ display: 'grid', gridTemplateColumns: (!narrow && last) || how ? 'minmax(0, 1.55fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: narrow ? 8 : 12, marginTop: narrow ? 8 : 12, alignItems: 'start' }}>
        <div style={{ background: 'var(--surface)', border: `2px solid ${border}`, borderRadius: 12, padding: narrow ? '0.55rem 0.75rem 0.65rem' : '0.75rem 0.95rem 0.85rem' }} data-testid="bridge-week-card">
          <div style={label}>{model.card.label}</div>
          <div style={{ fontSize: '1.12rem', fontWeight: 800, lineHeight: 1.25, margin: '2px 0' }} data-testid="bridge-week-lead">
            {model.card.lead}
          </div>
          {model.card.line && <div style={{ fontSize: '0.86rem', color: 'var(--text-700)' }}>{model.card.line}</div>}
          {model.card.note && (
            <div style={{ fontSize: '0.84rem', color: 'var(--text-700)', marginTop: 4 }} data-testid="bridge-week-note">
              <b>Note.</b> {model.card.note}
            </div>
          )}
          {shown.length > 0 && <ol style={{ listStyle: 'none', margin: '7px 0 0', padding: 0 }}>{shown.map(moveRow)}</ol>}
          {proposing && noteOpen && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="A note on the call"
              placeholder="A note for Friday, if any"
              maxLength={240}
              autoFocus
              data-testid="bridge-week-note-input"
              style={{ font: 'inherit', fontSize: '0.86rem', width: '100%', minHeight: 40, marginTop: 8, padding: '0.3rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)' }}
            />
          )}
          {model.card.press && (
            <button
              type="button"
              disabled={!canRecord}
              title={!recording && toRecord.length === 0 ? 'Put a move on the call first.' : undefined}
              onClick={() => model.link && onRecord(model.link, toRecord, note.trim() || null)}
              data-testid="bridge-week-record"
              style={{ ...pressBase, maxWidth: narrow ? undefined : 360, marginTop: 8, display: 'block', background: canRecord ? '#2563eb' : DEAD_PRESS_FILL, color: canRecord ? '#ffffff' : DEAD_PRESS_TEXT, cursor: canRecord ? 'pointer' : 'default' }}
            >
              {recording ? 'Recording…' : model.card.press}
            </button>
          )}
          {model.state === 'friday' && answerPresses(false)}
          {(model.card.foot || proposing) && (
            <div style={{ ...fine, marginTop: 7 }}>
              {model.card.foot}
              {proposing && model.link != null && (
                <>
                  {' '}
                  <button type="button" onClick={onPickStep} data-testid="bridge-week-pick" style={{ font: 'inherit', padding: 0, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Pick another step ›
                  </button>
                  {!noteOpen && (
                    <>
                      {' '}
                      <button type="button" onClick={() => setNoteOpen(true)} data-testid="bridge-week-add-note" style={{ font: 'inherit', padding: 0, marginLeft: 6, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Add a note ›
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {last && (
          <div style={{ background: 'var(--surface)', border: `1px solid ${last.asks ? 'var(--border-amber)' : 'var(--border)'}`, borderRadius: 12, padding: narrow ? '0.5rem 0.75rem 0.6rem' : '0.75rem 0.95rem' }} data-testid="bridge-week-last">
            <div style={label}>The last call</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: toneText(last.tone), marginTop: 2 }}>{last.text}</div>
            {!narrow && last.moves.length > 0 && (
              <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, fontSize: '0.8rem' }}>
                {last.moves.map((m) => (
                  <li key={m.title} style={{ display: 'flex', gap: 8, padding: '5px 0', borderTop: '1px solid var(--border)' }}>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      {m.title}
                      {m.who && <span style={{ color: 'var(--text-muted)' }}> {m.who}.</span>}
                    </span>
                    <b style={{ color: doneColor(m.done), whiteSpace: 'nowrap' }}>{m.doneText}</b>
                  </li>
                ))}
              </ul>
            )}
            {last.asks ? answerPresses(true) : !narrow && <div style={{ ...fine, marginTop: 6 }}>{last.consequence}</div>}
          </div>
        )}
        {how && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.75rem 0.95rem' }} data-testid="bridge-week-how">
            <div style={label}>How the week runs</div>
            <ol style={{ margin: '6px 0 0', paddingLeft: '1.2rem', fontSize: '0.86rem', color: 'var(--text-700)', display: 'grid', gap: 4 }}>
              {WEEK_HOW.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {model.cashLeads && strip}
    </section>
  )
}
