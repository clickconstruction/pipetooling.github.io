/**
 * The Document builder's send, as a list (punch list #404, step 5, and step 9 for a GC): one row a trade or a GC, with
 * where the send stands, a box that sends to one, and one press for everyone who is ready. The same list serves a
 * job's sheet to its trades and a builder to GCs.
 *
 * The one press acts on whoever has a page that is on, lists who it held with the reason, and keeps going past one
 * that fails. A send to one party alone makes a page for someone who never had one. A send never turns a page back
 * on: that is its own press. A revision nobody has read goes only once the box *Send it anyway* is ticked.
 *
 * Every rule is `lib/documentBuilder/send.ts`. This file draws, and hands each press to its caller.
 */
import { useState, type CSSProperties } from 'react'
import type { BatchNoun } from '../../lib/batchWords'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import type { BuilderChip, BuilderChipTone } from '../../lib/documentBuilder/builders'
import type { Landed } from '../../lib/documentBuilder/documentBuildersIo'
import { resendPress, sendBatch, sendBatchOutcome, sendBox, sendChips, unreadGateWords, type PartyContact, type ResendWhy, type SendParty } from '../../lib/documentBuilder/send'

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
  /** For a GC: the row says what the send is about. */
  showAbout?: boolean
  /** What to say with nobody on the list. */
  emptyWords: string
  onSend: (party: SendParty, to: PartyContact, note: string, why: 'first' | ResendWhy, anyway: boolean) => Promise<Landed<unknown>>
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

export function BuilderSendList({ title, lead, parties, revision, published, unpublishedWords, unread, noun, defaultNote, showAbout = false, emptyWords, onSend, onTakeOff, onTurnPageOn }: Props) {
  /** The party whose box is open, with who it goes to and the note. */
  const [box, setBox] = useState<{ partyId: string; email: string; note: string } | null>(null)
  const [anyway, setAnyway] = useState(false)
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<{ partyId: string | null; words: string } | null>(null)
  const [outcome, setOutcome] = useState<{ line: string; failed: Array<{ name: string; why: string }> } | null>(null)

  const gate = { published, unpublishedWords, unread, anyway }
  const batch = sendBatch(parties, noun, gate)

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
      const res = await onSend(party, to, defaultNote, 'first', anyway)
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
      <div>
        {parties.map((party, i) => {
          const open = box?.partyId === party.id && !party.send
          const to = open ? (party.contacts.find((c) => c.email === box?.email) ?? party.contacts[0] ?? null) : null
          const state = open ? sendBox(party, to, gate) : null
          const again = party.send ? resendPress(party.send, revision) : null
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
                      disabled={busy || !published || party.page.state === 'off' || party.contacts.length === 0 || (unread !== '' && !anyway)}
                      aria-label={`${again.label}, ${party.name}`}
                      style={SMALL_PRESS}
                      onClick={() => {
                        const person = party.contacts.find((c) => c.name === party.send?.contactName) ?? party.contacts[0]
                        if (person) void run(party.id, () => onSend(party, person, '', again.why, anyway))
                      }}
                    >
                      {again.label}
                    </button>
                    <button type="button" disabled={busy} aria-label={`Take it off the page of ${party.name}`} style={SMALL_PRESS} onClick={() => void run(party.id, () => onTakeOff(party))}>
                      Take it off their page
                    </button>
                  </>
                ) : !open ? (
                  <button type="button" disabled={busy} aria-label={`Send it to ${party.name}`} style={SMALL_PRESS} onClick={() => setBox({ partyId: party.id, email: party.contacts[0]?.email ?? '', note: defaultNote })}>
                    Send it to them
                  </button>
                ) : null}
              </div>

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
                          <button type="button" disabled={busy} style={SMALL_PRESS} onClick={() => void run(party.id, () => onTurnPageOn(party))}>
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
                        if (to) void run(party.id, () => onSend(party, to, box?.note ?? '', 'first', anyway), () => setBox(null))
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
          {batch.held.map((h) => (
            <p key={h.party.id} style={MUTED}>
              {h.why}
            </p>
          ))}
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
