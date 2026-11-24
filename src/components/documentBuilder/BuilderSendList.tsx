/**
 * The Document builder's send, as a list (punch list #404, step 5, and step 9 for a GC): one row a trade or a GC, with
 * where the send stands, a box that sends to one, and one press for everyone who is ready. The same list serves a
 * job's sheet to its trades and a builder to GCs.
 *
 * The one press acts on whoever has a page that is on, lists who it held with the reason, and keeps going past one
 * that fails. A reason that holds many reads as one line with its count, and their names fold under it. A send to one party alone makes a page for someone who never had one. A send never turns a page back
 * on: that is its own press. A revision nobody has read goes only once the box *Send it anyway* is ticked.
 *
 * Every rule is `lib/documentBuilder/send.ts`. This file draws, and hands each press to its caller.
 */
import { useState, type CSSProperties } from 'react'
import type { BatchNoun } from '../../lib/batchWords'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import type { BuilderChip, BuilderChipTone } from '../../lib/documentBuilder/builders'
import type { Landed } from '../../lib/documentBuilder/documentBuildersIo'
import { ABOUT_ALL_JOBS, aboutChoices, aboutJobId, heldLines, resendPress, resendTo, sendBatch, sendBatchOutcome, sendBox, sendChips, shownParties, unreadGateWords, type PartyContact, type ResendWhy, type SendParty } from '../../lib/documentBuilder/send'
import { EmptyState } from '../EmptyState'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'

type Props = {
  title: string
  lead: string
  parties: SendParty[]
  /** The revision now published, which a send carries. */
  revision: number
  published: boolean
  /** What to do first while nothing is published. */
  unpublishedWords: string
  /** Why the revision is unread, or an empty string once someone marked it. */
  unread: string
  noun: BatchNoun
  /** The note a send starts on. */
  defaultNote: string
  /** For a GC: the row says what the send is about, and the box asks. */
  showAbout?: boolean
  /** What to say with nobody on the list. */
  emptyWords: string
  /** A long list's find box, by its label: *Find a GC*. With it the list shows who was sent to and the first few others until someone types. */
  findWords?: string
  /** Asked before the one press sends to everyone ready. A no sends nothing. */
  beforeBatch?: (ready: SendParty[]) => Promise<boolean>
  /** `about` is the job a first send to a GC is about, or null for all their jobs. A second send keeps what the first was about. */
  onSend: (party: SendParty, to: PartyContact, note: string, why: 'first' | ResendWhy, anyway: boolean, about: string | null) => Promise<Landed<unknown>>
  onTakeOff: (party: SendParty) => Promise<Landed<unknown>>
  onTurnPageOn: (party: SendParty) => Promise<Landed<unknown>>
}

const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 10, minWidth: 0 }
const CARD_TITLE: CSSProperties = { margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }
const MUTED: CSSProperties = { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }
const FINE: CSSProperties = { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }
const REFUSAL: CSSProperties = { margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-red-700)' }
const CHIP: CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600 }
const CHIP_TONES: Record<BuilderChipTone, CSSProperties> = {
  ok: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  wait: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
  warn: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
}
const SMALL_PRESS: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', borderRadius: 8, padding: '3px 10px', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600, minHeight: 32, cursor: 'pointer' }
/** A small press, drawn dead while it cannot be pressed: a dead press that looked live read as one that did nothing. */
function smallPress(dead: boolean): CSSProperties {
  return dead ? { ...SMALL_PRESS, border: '1px solid var(--border)', background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'not-allowed' } : SMALL_PRESS
}
const SECOND_PRESS: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 9, padding: '7px 12px', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, minHeight: 38, cursor: 'pointer' }
const INPUT: CSSProperties = { width: '100%', color: 'var(--text-base)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '7px 9px', fontFamily: 'inherit', fontSize: '1rem', minWidth: 0, boxSizing: 'border-box' }
const LABEL: CSSProperties = { display: 'grid', gap: 4, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-700)' }
const WARN: CSSProperties = { border: '1px solid var(--text-amber-700)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '7px 10px', fontSize: '0.78rem' }
const BTNS: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }

function mainPress(dead: boolean): CSSProperties {
  return { border: 0, background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : 'white', borderRadius: 9, padding: '9px 14px', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 700, minHeight: 40, cursor: dead ? 'not-allowed' : 'pointer' }
}

function Chips({ chips }: { chips: BuilderChip[] }) {
  if (chips.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 6px' }}>
      {chips.map((c) => (
        <span key={c.words} style={{ ...CHIP, ...CHIP_TONES[c.tone], whiteSpace: 'normal' }}>
          {c.words}
        </span>
      ))}
    </div>
  )
}

export function BuilderSendList({ title, lead, parties, revision, published, unpublishedWords, unread, noun, defaultNote, showAbout = false, emptyWords, findWords, beforeBatch, onSend, onTakeOff, onTurnPageOn }: Props) {
  /** The party whose box is open, with who it goes to and the note. */
  const [box, setBox] = useState<{ partyId: string; email: string; note: string; about: string } | null>(null)
  const [anyway, setAnyway] = useState(false)
  const [find, setFind] = useState('')
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<{ partyId: string | null; words: string } | null>(null)
  const [outcome, setOutcome] = useState<{ line: string; failed: Array<{ name: string; why: string }> } | null>(null)

  const gate = { published, unpublishedWords, unread, anyway }
  const batch = sendBatch(parties, noun, gate)
  const shown = shownParties(parties, findWords ? find : null)

  const run = async (partyId: string | null, act: () => Promise<Landed<unknown>>, after?: () => void) => {
    if (busy) return
    setBusy(true)
    setRefusal(null)
    setOutcome(null)
    const res = await act()
    setBusy(false)
    if (!res.ok) {
      setRefusal({ partyId, words: res.error })
      return
    }
    after?.()
  }

  const sendToEveryoneReady = async () => {
    if (busy || batch.press.dead) return
    if (beforeBatch && !(await beforeBatch(batch.ready))) return
    setBusy(true)
    setRefusal(null)
    setOutcome(null)
    setBox(null)
    // Each ready party in turn. One that fails is named with its reason, and the rest still go.
    const failed: Array<{ name: string; why: string }> = []
    let done = 0
    for (const party of batch.ready) {
      const to = party.contacts[0]
      if (!to) continue
      const res = await onSend(party, to, defaultNote, 'first', anyway, null)
      if (res.ok) done += 1
      else failed.push({ name: party.name, why: res.error })
    }
    setBusy(false)
    setOutcome({ line: sendBatchOutcome(done, batch.held.length, failed.length, noun), failed })
  }

  const unreadGate = (id: string) =>
    unread && published ? (
      <label style={{ ...WARN, display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="checkbox" id={id} checked={anyway} onChange={(e) => setAnyway(e.target.checked)} style={{ width: 18, height: 18, margin: '1px 0 0', accentColor: '#2563eb', flex: '0 0 auto' }} />
        <span>{unreadGateWords(unread)}</span>
      </label>
    ) : null

  return (
    <div style={CARD}>
      <h3 style={CARD_TITLE}>{title}</h3>
      <p style={MUTED}>{lead}</p>
      {parties.length === 0 ? <p style={MUTED}>{emptyWords}</p> : null}
      {findWords && parties.length > 0 ? <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder={findWords} aria-label={findWords} style={INPUT} /> : null}
      {parties.length > 0 && shown.rows.length === 0 ? <EmptyState compact main={`Nobody matches \u2018${find.trim()}\u2019.`} next={{ label: 'Clear the search', onPress: () => setFind('') }} /> : null}
      <div>
        {shown.rows.map((party, i) => {
          const open = box?.partyId === party.id && !party.send
          const to = open ? (party.contacts.find((c) => c.email === box?.email) ?? party.contacts[0] ?? null) : null
          const state = open ? sendBox(party, to, gate) : null
          const again = party.send ? resendPress(party.send, revision) : null
          /** Who the second press goes to: the person the send went to, by the address on the send's own row. */
          const goesTo = resendTo(party)
          /** The second press on a sent row cannot go: nothing published, their page off, the person it went to gone from the record, or an unread revision not waved through. */
          const againDead = !published || party.page.state === 'off' || !goesTo?.to || (unread !== '' && !anyway)
          return (
            <div key={party.id} data-send-party={party.id} style={{ display: 'grid', gap: 6, padding: i === 0 ? '0 0 10px' : '10px 0', borderTop: i === 0 ? 0 : '1px solid var(--border)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', alignItems: 'baseline', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                <b style={{ color: 'var(--text-strong)' }}>{party.name}</b>
                {party.sub ? <span style={MUTED}>{party.sub}</span> : null}
              </div>
              <Chips chips={sendChips(party, revision, { showAbout })} />
              <div style={BTNS}>
                {party.send && again ? (
                  <>
                    <button
                      type="button"
                      disabled={busy || againDead}
                      aria-label={`${again.label}, ${party.name}`}
                      aria-describedby={goesTo ? `goes-to-${party.id}` : undefined}
                      style={smallPress(busy || againDead)}
                      onClick={() => {
                        const person = goesTo?.to
                        if (person) void run(party.id, () => onSend(party, person, '', again.why, anyway, null))
                      }}
                    >
                      {again.label}
                    </button>
                    <button type="button" disabled={busy} aria-label={`Take it off the page of ${party.name}`} style={smallPress(busy)} onClick={() => void run(party.id, () => onTakeOff(party))}>
                      Take it off their page
                    </button>
                  </>
                ) : !open ? (
                  <button type="button" disabled={busy} aria-label={`Send it to ${party.name}`} style={smallPress(busy)} onClick={() => setBox({ partyId: party.id, email: party.contacts[0]?.email ?? '', note: defaultNote, about: ABOUT_ALL_JOBS })}>
                    Send it to them
                  </button>
                ) : null}
              </div>
              {party.send && goesTo ? (
                <p id={`goes-to-${party.id}`} data-goes-to={goesTo.to ? 'someone' : 'nobody'} style={goesTo.to ? FINE : { ...WARN, margin: 0 }}>
                  <ValueSentence text={goesTo.words} />
                </p>
              ) : null}

              {open && state ? (
                <div style={{ border: '1px dashed var(--border-strong)', background: 'var(--bg-subtle)', borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 10 }}>
                  {party.contacts.length > 0 ? (
                    <label style={LABEL}>
                      <span>To</span>
                      <select value={to?.email ?? ''} onChange={(e) => setBox((b) => (b ? { ...b, email: e.target.value } : b))} style={INPUT}>
                        {party.contacts.map((c) => (
                          <option key={c.email} value={c.email}>
                            {c.role ? `${c.name}, ${c.role}` : c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {showAbout ? (
                    <label style={LABEL}>
                      <span>What it is about</span>
                      <select value={box?.about ?? ABOUT_ALL_JOBS} onChange={(e) => setBox((b) => (b ? { ...b, about: e.target.value } : b))} style={INPUT}>
                        {aboutChoices(party).map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label style={LABEL}>
                    <span>A note to them</span>
                    <textarea value={box?.note ?? ''} onChange={(e) => setBox((b) => (b ? { ...b, note: e.target.value } : b))} style={{ ...INPUT, minHeight: 58, resize: 'vertical' }} />
                  </label>
                  {state.note ? (
                    <div style={state.note.tone === 'warn' ? WARN : MUTED}>
                      {state.note.words}
                      {state.note.turnOn ? (
                        <>
                          {' '}
                          <button type="button" disabled={busy} style={smallPress(busy)} onClick={() => void run(party.id, () => onTurnPageOn(party))}>
                            Turn their page on
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  {unreadGate(`anyway-${party.id}`)}
                  <div style={BTNS}>
                    <button
                      type="button"
                      disabled={state.press.dead || busy}
                      style={mainPress(state.press.dead || busy)}
                      onClick={() => {
                        if (to) void run(party.id, () => onSend(party, to, box?.note ?? '', 'first', anyway, showAbout ? aboutJobId(party, box?.about ?? ABOUT_ALL_JOBS) : null), () => setBox(null))
                      }}
                    >
                      {state.press.label}
                    </button>
                    <button type="button" style={SECOND_PRESS} onClick={() => setBox(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              {refusal?.partyId === party.id ? (
                <p role="alert" style={REFUSAL}>
                  {refusal.words}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
      {shown.more > 0 && findWords ? <p style={MUTED}>{`${shown.more} more. ${findWords} to see the rest.`}</p> : null}

      {parties.length > 0 ? (
        <div style={{ display: 'grid', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10, justifyItems: 'start' }}>
          {box == null ? unreadGate('anyway-everyone') : null}
          <button type="button" disabled={batch.press.dead || busy} style={mainPress(batch.press.dead || busy)} onClick={() => void sendToEveryoneReady()}>
            {batch.press.label}
          </button>
          {outcome ? (
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ ...CHIP, ...CHIP_TONES[outcome.failed.length > 0 ? 'warn' : 'ok'], justifySelf: 'start' }}>{outcome.line}</span>
              {outcome.failed.map((f) => (
                <p key={f.name} style={REFUSAL}>{`${f.name}: ${f.why}`}</p>
              ))}
            </div>
          ) : null}
          {!published ? <p style={MUTED}>{unpublishedWords}</p> : null}
          {heldLines(batch.held, noun).map((line) =>
            line.names.length === 0 ? (
              <p key={line.key} style={MUTED}>
                {line.words}
              </p>
            ) : (
              // One reason that holds many: the line counts them, and a press on it opens their names.
              <details key={line.key} data-held={line.key} style={MUTED}>
                <summary style={{ cursor: 'pointer' }}>{line.words}</summary>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {line.names.map((name, i) => (
                    <li key={`${name}-${i}`}>{name}</li>
                  ))}
                </ul>
              </details>
            ),
          )}
          {refusal?.partyId == null && refusal ? (
            <p role="alert" style={REFUSAL}>
              {refusal.words}
            </p>
          ) : null}
          <p style={FINE}>Each send is kept under Sent copies on Documents.</p>
        </div>
      ) : null}
    </div>
  )
}
