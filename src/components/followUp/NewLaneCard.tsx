/**
 * Messages, residential R7 (PR 3): the sort card above a thread, for a person waiting in Follow up's New lane (the
 * customer Messages prototype v0.8, screen 7, mockup A's `sortCardHtml`). Its head says which sort (for *Who is this?*,
 * who it asks about: *Who is Dale Ferris, dale@ridgeway.example?*, `whoHead`, the owner's pattern), its first line why,
 * then its presses: *Who is this?*'s guesses in the box's order, since v2.5795 under **A customer we know** (each with
 * why) and **A new customer** (a field with the sender's name and one press that makes them), *Which job?*'s jobs with
 * the default picked, or *Who has it?*'s people with the rule's pick first. A guess that needs a record made first
 * waits, and says where to make it.
 * *One of our own team* (v2.5546) turns the card into *Which of ours?*: the roster, subs left out, a name filter and a
 * press per person that names the number as them. An email's card ends with **A notice, not a person** (punch list
 * #223 PR 1, v2.6202): the address's press, and the domain's when it is a company's own. This draws;
 * `useNewLaneThreadSlots.tsx` reads and writes.
 */
import { useState, type ReactNode } from 'react'
import type { ChannelKind } from '../../lib/contacts/kernel'
import { bidHead, companyFromDomain, NOTICE_BLOCK, senderFacts, START_BID_WORDS, teamGuess, whoHead, type BidCustomerChoice, type BidPick, type HasChoice, type JobChoice, type NewLaneRow, type RosterChoice, type WhoGuess } from '../../lib/followUp/newLane'
import { guessWait } from '../../lib/followUp/newLaneRows'
import { TRADE_TEMPLATES } from '../../lib/gc/plans'
import { Btn, input } from '../gc/gcUi'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'

/** The trades a new trade partner can do, as the GC plans name them. */
const TRADE_NAMES: readonly string[] = [...new Set(TRADE_TEMPLATES.map((t) => t.trade))].sort((a, b) => a.localeCompare(b))

export interface NewLaneCardProps {
  row: NewLaneRow
  /** The contact's channels: the address or the number behind a name, for *Who is this?*'s head. */
  channels?: ReadonlyArray<{ kind: ChannelKind; value: string }>
  /** *Who is this?*'s guesses; null while the records they may be are read. */
  guesses?: readonly WhoGuess[] | null
  /** The roster for *One of our own team*, as `rosterChoices` lists it. */
  roster?: readonly RosterChoice[]
  /** *Which job?*'s jobs, the default first picked. */
  jobs?: readonly JobChoice[]
  /** *Who has it?*'s people, the rule's pick first. */
  people?: ReadonlyArray<HasChoice & { userId: string }>
  /** A press is running: every press waits. */
  busy?: boolean
  /** *Bid it?*'s customers (v2.6222): the contact's own, or the ones the sender may be; null while they are read. */
  bidChoices?: readonly BidCustomerChoice[] | null
  /** The contact is a customer already: the card offers no new customer. */
  ownCustomer?: boolean
  onName: (guess: WhoGuess) => void
  onSomeoneElse: () => void
  onTie: (jobKey: string) => void
  onHand: (userId: string) => void
  onStartBid?: (pick: BidPick) => void
  onNotForUs?: (reason: string) => void
  onKeep?: () => void
}

const OPTION = {
  display: 'grid',
  gap: '0.1rem',
  textAlign: 'left',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface)',
  color: 'var(--text-base)',
  font: 'inherit',
  fontSize: '0.875rem',
  padding: '0.4rem 0.65rem',
} as const

function Option({ label, words, onPress, disabled }: { label: string; words: string; onPress: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onPress} disabled={disabled} style={{ ...OPTION, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      <strong style={{ fontWeight: 600 }}>{label}</strong>
      <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{words}</small>
    </button>
  )
}

/** The roster whose names hold the words typed; everyone while nothing is typed. */
function rosterMatching(roster: readonly RosterChoice[], words: string): RosterChoice[] {
  const q = words.trim().toLowerCase()
  return q ? roster.filter((p) => p.name.toLowerCase().includes(q)) : [...roster]
}

function BlockHead({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{children}</div>
}

/**
 * *Who is this?*'s guesses in the kernel's order, with its blocks (v2.5795): **A customer we know** over the customers
 * matched with why, **A new customer** as a field that starts with the sender's name and the press that makes them,
 * then **Or** over the rest. A guess that needs a record made first waits with where to make it.
 */
function WhoBody({ guesses, busy, onName, onSomeoneElse, onTeam }: { guesses: readonly WhoGuess[]; busy: boolean; onName: (g: WhoGuess) => void; onSomeoneElse: () => void; onTeam: () => void }) {
  const makes = guesses.find((g) => g.makes)
  // The field's words once typed; the sender's name until then.
  const [typed, setTyped] = useState<string | null>(null)
  const customerName = typed ?? makes?.makes?.customerName ?? ''
  // A new trade partner, a supply house or a candidate (spike): the row pressed opens its field in place, one at a time.
  const [making, setMaking] = useState<number | null>(null)
  const [recordTyped, setRecordTyped] = useState<string | null>(null)
  const [recordTrade, setRecordTrade] = useState('')
  const firstKnown = guesses.findIndex((g) => g.kind === 'customer' && g.record)
  const firstNotice = guesses.findIndex((g) => g.notice)
  const nodes: ReactNode[] = []
  guesses.forEach((g, i) => {
    if (i === firstKnown) nodes.push(<BlockHead key="known">A customer we know</BlockHead>)
    // A notice, not a person (v2.6202): the fourth block, under the people, the address's press then the domain's.
    if (i === firstNotice) nodes.push(<BlockHead key="notice">{NOTICE_BLOCK}</BlockHead>)
    if (g.notice) {
      nodes.push(
        <div key={i} data-notice={g.notice.scope}>
          <Option label={g.label} words={g.words} onPress={() => onName(g)} disabled={busy} />
        </div>,
      )
      return
    }
    if (g.makesRecord) {
      const make = g.makesRecord
      if (making !== i) {
        nodes.push(
          <Option
            key={i}
            label={g.label}
            words={g.words}
            onPress={() => {
              setMaking(i)
              setRecordTyped(null)
              setRecordTrade('')
            }}
            disabled={busy}
          />,
        )
        return
      }
      const recordName = recordTyped ?? make.name
      // Trade partners' own door refuses a company with no trade, so the block asks for it before the press goes.
      const asksTrade = make.table === 'gc_companies'
      nodes.push(
        <div key={i} data-make-record={make.table} style={{ ...OPTION, gap: '0.35rem' }}>
          <strong style={{ fontWeight: 600 }}>{g.label}</strong>
          <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
            <span>{make.field}</span>
            <input value={recordName} onChange={(e) => setRecordTyped(e.target.value)} placeholder={make.field} style={input} disabled={busy} autoFocus />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{make.hint}</small>
          </label>
          {asksTrade && (
            <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
              <span>Trade</span>
              <select value={recordTrade} onChange={(e) => setRecordTrade(e.target.value)} style={input} disabled={busy}>
                <option value="">Pick the trade they do</option>
                {TRADE_NAMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Option
            label={make.press}
            words={g.words}
            onPress={() => onName({ ...g, makesRecord: { ...make, name: recordName.trim(), ...(asksTrade ? { trade: recordTrade } : {}) } })}
            disabled={busy || recordName.trim() === '' || (asksTrade && recordTrade === '')}
          />
          <div>
            <Btn kind="quiet" onClick={() => setMaking(null)} disabled={busy}>
              Back
            </Btn>
          </div>
        </div>,
      )
      return
    }
    if (g.makes) {
      nodes.push(
        <div key="new" data-new-customer style={{ display: 'grid', gap: '0.35rem' }}>
          <BlockHead>A new customer</BlockHead>
          <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
            <span>Customer</span>
            <input value={customerName} onChange={(e) => setTyped(e.target.value)} placeholder="Their name, or the company" style={input} disabled={busy} />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{g.makes.hint}</small>
          </label>
          <Option label="Make the customer" words={g.words} onPress={() => onName({ ...g, makes: { ...g.makes!, customerName: customerName.trim() } })} disabled={busy || customerName.trim() === ''} />
        </div>,
      )
      if (i < guesses.length - 1) nodes.push(<BlockHead key="or">Or</BlockHead>)
      return
    }
    if (g.kind === 'someone_else') nodes.push(<Option key={i} label={g.label} words={g.words} onPress={onSomeoneElse} disabled={busy} />)
    else if (g.kind === 'team' && !g.record) nodes.push(<Option key={i} label={g.label} words={g.words} onPress={onTeam} disabled={busy} />)
    else {
      const wait = guessWait(g)
      nodes.push(<Option key={i} label={g.label} words={wait ?? g.words} onPress={() => onName(g)} disabled={busy || wait !== null} />)
    }
  })
  return <div style={{ display: 'grid', gap: '0.35rem' }}>{nodes}</div>
}

const FIELD = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem' } as const

/**
 * *Bid it?* (punch list #223 PR 3, v2.6222): the bid's name in a field that starts with what the reader read, then the
 * presses. **A customer we know** over each customer the sender may be, or the contact's own, *Start a bid on Ridgeway
 * Builders*; **A new customer** as a field and one press that makes them and starts the bid; then **Or**: *Not for us*
 * with its reason in a field, and *Keep it*, which leaves the bid for later.
 */
function BidBody({
  row,
  channels,
  choices,
  own,
  busy,
  onStartBid,
  onNotForUs,
  onKeep,
}: {
  row: NewLaneRow
  channels?: ReadonlyArray<{ kind: ChannelKind; value: string }>
  choices: readonly BidCustomerChoice[] | null
  own: boolean
  busy: boolean
  onStartBid: (pick: BidPick) => void
  onNotForUs: (reason: string) => void
  onKeep: () => void
}) {
  const sender = senderFacts({ who: row.who, body: row.body, channels })
  const [project, setProject] = useState(row.invitation?.project ?? '')
  const [typed, setTyped] = useState<string | null>(null)
  const newName = typed ?? (companyFromDomain(sender.domain) || sender.name || '')
  const [reason, setReason] = useState('')
  const keepWith = sender.name?.trim().split(/\s+/)[0] || 'them'
  const canStart = project.trim() !== ''
  return (
    <div style={{ display: 'grid', gap: '0.35rem' }}>
      <label style={FIELD}>
        <span>Bid</span>
        <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="The project's name" style={input} disabled={busy} />
        <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>The bid's name. It starts with what the email said.</small>
      </label>
      {choices === null ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Reading who it may be…</div>
      ) : (
        choices.length > 0 && (
          <>
            <BlockHead>{own ? 'The customer' : 'A customer we know'}</BlockHead>
            {choices.map((c) => (
              <div key={c.customerId} data-start-bid={c.customerId}>
                <Option label={c.label} words={c.words} onPress={() => onStartBid({ projectName: project.trim(), choice: c })} disabled={busy || !canStart} />
              </div>
            ))}
          </>
        )
      )}
      {!own && (
        <div data-new-customer style={{ display: 'grid', gap: '0.35rem' }}>
          <BlockHead>A new customer</BlockHead>
          <label style={FIELD}>
            <span>Customer</span>
            <input value={newName} onChange={(e) => setTyped(e.target.value)} placeholder="The company, or their name" style={input} disabled={busy} />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>A company? Type its name. {keepWith === 'them' ? 'The sender stays' : `${keepWith} stays`} the person on the thread.</small>
          </label>
          <Option label="Make the customer and start the bid" words={START_BID_WORDS} onPress={() => onStartBid({ projectName: project.trim(), makes: { customerName: newName.trim() } })} disabled={busy || !canStart || newName.trim() === ''} />
        </div>
      )}
      <BlockHead>Or</BlockHead>
      <label style={FIELD} data-not-for-us>
        <span>Not for us, because</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="too far, out of our range, no plans yet" style={input} disabled={busy} />
      </label>
      <Option label="Not for us" words="Writes the reason in the thread and closes the row. Their next invitation still shows." onPress={() => onNotForUs(reason.trim())} disabled={busy || reason.trim() === ''} />
      <Option label={`Keep it with ${keepWith}`} words="No bid yet. The row then asks who they are, or who has it." onPress={onKeep} disabled={busy} />
    </div>
  )
}

export function NewLaneCard({ row, channels, guesses, roster = [], jobs = [], people = [], busy = false, bidChoices = null, ownCustomer = false, onName, onSomeoneElse, onTie, onHand, onStartBid, onNotForUs, onKeep }: NewLaneCardProps) {
  // The default starts picked. The caller keys the card by its line, so a new line starts from its own default.
  const [picked, setPicked] = useState<string | null>(() => jobs.find((j) => j.isDefault)?.id ?? jobs[0]?.id ?? null)
  const pickedJob = jobs.find((j) => j.id === picked) ?? null
  // *One of our own team* pressed: the card shows the roster until a pick or Back.
  const [teamOpen, setTeamOpen] = useState(false)
  const [teamWords, setTeamWords] = useState('')

  // The region keeps the sort's head (*Sort: Who is this?*); the title asks about the sender by name and address or number.
  let head = row.head
  let title = row.sort === 'who' ? whoHead({ who: row.who, body: row.body, channel: row.channel, channels }).words : row.sort === 'bid' ? bidHead({ who: row.who, company: row.company, body: row.body, invitation: row.invitation, channels }) : row.head
  let why: ReactNode = row.why
  let body: ReactNode = null
  if (row.sort === 'bid') {
    body = <BidBody row={row} channels={channels} choices={bidChoices} own={ownCustomer} busy={busy} onStartBid={(p) => onStartBid?.(p)} onNotForUs={(r) => onNotForUs?.(r)} onKeep={() => onKeep?.()} />
  } else if (row.sort === 'who' && teamOpen) {
    head = 'Which of ours?'
    title = head
    why = 'The number goes on their People record. Next time the app knows them without asking.'
    const shown = rosterMatching(roster, teamWords)
    body = (
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
          <span>Find a name</span>
          <input value={teamWords} onChange={(e) => setTeamWords(e.target.value)} placeholder="Type a name" style={input} disabled={busy} autoFocus />
        </label>
        {roster.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nobody on the roster yet. Add them on People first.</div>
        ) : shown.length === 0 ? (
          <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'names on the roster', query: teamWords }), { onPress: () => setTeamWords('') })} />
        ) : (
          <div role="group" aria-label="Our team" style={{ display: 'grid', gap: '0.35rem' }}>
            {shown.map((p) => (
              <Option key={p.id} label={p.name} words={p.words} onPress={() => onName(teamGuess(p))} disabled={busy} />
            ))}
          </div>
        )}
        <div>
          <Btn kind="quiet" onClick={() => setTeamOpen(false)} disabled={busy}>
            Back
          </Btn>
        </div>
      </div>
    )
  } else if (row.sort === 'who') {
    body = !guesses ? (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Reading who it may be…</div>
    ) : (
      <WhoBody guesses={guesses} busy={busy} onName={onName} onSomeoneElse={onSomeoneElse} onTeam={() => setTeamOpen(true)} />
    )
  } else if (row.sort === 'job') {
    body = (
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.25rem' }}>
          <legend style={{ fontSize: '0.85rem', marginBottom: '0.2rem' }}>Which job is this line about?</legend>
          {jobs.map((j) => (
            <label key={j.id} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.875rem' }}>
              <input type="radio" name={`lane-job-${row.messageId}`} checked={picked === j.id} onChange={() => setPicked(j.id)} disabled={busy} />
              <span>
                <strong>{j.number}</strong> {j.name}
                {j.isDefault && <span style={{ color: 'var(--text-muted)' }}> · the default</span>}
              </span>
            </label>
          ))}
        </fieldset>
        {pickedJob && (
          <div>
            <Btn kind="primary" onClick={() => onTie(pickedJob.id)} disabled={busy}>
              {pickedJob.isDefault ? `Keep it on ${pickedJob.number}` : `Move it to ${pickedJob.number}`}
            </Btn>
          </div>
        )}
      </div>
    )
  } else {
    body =
      people.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nobody on the office team to give it to.</div>
      ) : (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {people.map((p) => (
            <Option key={p.userId} label={p.name} words={p.words} onPress={() => onHand(p.userId)} disabled={busy} />
          ))}
        </div>
      )
  }

  return (
    <section
      aria-label={`Sort: ${head}`}
      data-new-lane-card={row.sort}
      data-new-lane-team={row.sort === 'who' && teamOpen ? 'open' : undefined}
      style={{ margin: '0.5rem 0.9rem 0', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-blue-tint)', padding: '0.6rem 0.75rem', display: 'grid', gap: '0.45rem' }}
    >
      {/* `overflowWrap: anywhere`: at phone width a long address goes to its own line, and breaks inside only when it still does not fit.
          The header's blue *Who is this?* sits at the card's top right while the card asks who (spike): it opens the search for anyone. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', overflowWrap: 'anywhere', flex: 1, minWidth: 0 }}>{title}</h3>
        {row.sort === 'who' && !teamOpen && (
          <button
            type="button"
            onClick={onSomeoneElse}
            disabled={busy}
            style={{ background: 'var(--text-blue-700)', color: 'white', border: 'none', borderRadius: 6, padding: '0.35rem 0.75rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap', flex: 'none' }}
          >
            Who is this?
          </button>
        )}
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-600)' }}>{why}</div>
      {body}
    </section>
  )
}
