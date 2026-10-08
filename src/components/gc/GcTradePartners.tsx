import { useState, type KeyboardEvent } from 'react'
import { BIDS_WANTED } from '../../lib/gc/bids'
import type { NewCompanyDraft } from '../../lib/gc/gcIo'
import { assistantRules, itemsByTrade, partnerAsks, toldAheadWords, tradeBenches, tradeTodoCounts, type AssistantRule, type TradeBench, type TradeNeed } from '../../lib/gc/bench'
import { declinedTitle, declinedWords } from '../../lib/gc/decline'
import { askPromise, promiseWords } from '../../lib/gc/followUp'
import { townFromAddress, travelFor, travelWords } from '../../lib/gc/map'
import { answerRecord, type AnswerRecord } from '../../lib/gc/reliability'
import type { GcState, Invite, Partner } from '../../lib/gc/types'
import { partnersToVet, vettingOf, vettingWords } from '../../lib/gc/vetting'
import { shortDate } from '../../lib/gc/words'
import { GcBoardStrip, type BoardStripItem } from './GcBoardStages'
import { Btn, Card, Chip, input, td, th, type Tone } from './gcUi'
import { useJumpStrip } from './useJumpStrip'

/**
 * GC mode, the real build (the Board's B3-b): Trade partners on real data, from the design spike's
 * `GcTradeBench.tsx` and `GcVetting.tsx`. Companies new to us wait at the top for a decision; then
 * each trade's bench (who answers when asked), every project still short of quotes in that trade,
 * and the companies with their address and how far they go. A dev adds a company, decides on one
 * new to us, and sets where a company drives from here. Asking a company is the Board's B4, papers
 * are B6, and the company window (its About, its language) comes after, so this screen does not ask
 * or send.
 */

/** What Trade partners writes, through the company record's functions (B1). */
export interface TradePartnerWrites {
  addCompany: (draft: NewCompanyDraft) => Promise<void>
  vetCompany: (companyId: string, status: 'approved' | 'declined', limit: number | null, note: string) => Promise<void>
  setCoverage: (companyId: string, address: string, maxMiles: number | null) => Promise<void>
}

const RECORD_WORDS: Record<AnswerRecord, { tone: Tone; word: string }> = {
  new: { tone: 'grey', word: 'new to us' },
  reliable: { tone: 'green', word: 'answers' },
  mixed: { tone: 'amber', word: 'hit or miss' },
  silent: { tone: 'red', word: 'often silent' },
}

const ASK_WORDS: Record<Invite['status'], { tone: Tone; word: string }> = {
  invited: { tone: 'red', word: 'has not opened it' },
  opened: { tone: 'blue', word: 'looking' },
  bid: { tone: 'green', word: 'quote in' },
  declined: { tone: 'grey', word: 'passed' },
}

function benchAnchor(trade: string): string {
  return `gc-bench-${trade.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

export function GcTradePartners({
  state,
  writes,
  onOpenProject,
  trades = [],
}: {
  state: GcState
  writes: TradePartnerWrites
  onOpenProject: (projectId: string) => void
  /** Trades on our projects that no company does yet, so each still gets a card to add one to. */
  trades?: string[]
}) {
  const [addingTrade, setAddingTrade] = useState<string | null>(null)
  const known = tradeBenches(state)
  // A trade on a project with no company yet still needs a card, so the first company can be added.
  const benches: TradeBench[] = [
    ...known,
    ...trades
      .filter((t) => !known.some((b) => b.trade === t))
      .map(
        (trade): TradeBench => ({
          trade,
          partners: [],
          needs: [],
          short: 0,
          urgency: 0,
          dependable: 0,
          toldAhead: {},
        }),
      ),
  ]
  const rules = assistantRules(state)
  const todos = tradeTodoCounts(rules)
  const tradeItems: BoardStripItem[] = benches.map((b) => ({
    key: b.trade,
    label: b.trade,
    tone: b.short > 0 ? 'red' : (todos.get(b.trade) ?? 0) > 0 ? 'amber' : 'green',
    count: todos.get(b.trade) ?? 0,
    ...(b.short > 0 ? { dots: ['red' as const] } : {}),
    noun: ['to-do', 'to-dos'],
  }))
  const { active, jumpTo } = useJumpStrip(
    true,
    benches.map((b) => b.trade),
    benchAnchor,
  )
  return (
    <section aria-label="Trade partners" style={{ display: 'grid', gap: '0.9rem' }}>
      <VetQueue state={state} writes={writes} />
      {benches.length > 0 ? (
        <GcBoardStrip items={tradeItems} active={active} onJump={jumpTo} label="Jump to a trade" />
      ) : (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No trade yet. A trade shows here once a project has it.</span>
      )}
      {rules.length > 0 && benches.length > 0 && (
        <AssistantActions
          rules={rules}
          onAdd={(trade) => {
            setAddingTrade(trade)
            document.getElementById(benchAnchor(trade))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }}
        />
      )}
      {benches.map((bench) => (
        <BenchCard
          key={bench.trade}
          state={state}
          bench={bench}
          writes={writes}
          onOpenProject={onOpenProject}
          adding={addingTrade === bench.trade}
          onAdding={(on) => setAddingTrade(on ? bench.trade : null)}
        />
      ))}
    </section>
  )
}

/** "not vetted yet", "approved up to $150,000", "declined". Nothing for a company we know. */
export function VettingChip({ partner }: { partner: Partner }) {
  const words = vettingWords(partner)
  if (!words) return null
  const v = vettingOf(partner)
  const tone = v.status === 'new' ? 'amber' : v.status === 'declined' ? 'red' : 'blue'
  const title =
    v.status === 'new'
      ? 'They can quote. Nothing is awarded to them until we approve them on Trade partners.'
      : v.decidedBy
        ? `${v.decidedBy} decided ${v.decidedOn ? shortDate(v.decidedOn) : ''}${v.note ? `: ${v.note}` : ''}`
        : undefined
  return (
    <Chip tone={tone} title={title}>
      {words}
    </Chip>
  )
}

/** The companies waiting on our decision, at the top of Trade partners. Nothing when none wait. */
function VetQueue({ state, writes }: { state: GcState; writes: TradePartnerWrites }) {
  const waiting = partnersToVet(state)
  if (waiting.length === 0) return null
  return (
    <Card style={{ borderColor: 'var(--border-amber)' }} dataTour="gc-vet-queue">
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          marginBottom: '0.5rem',
        }}
      >
        <strong>New to us: approve before any award ({waiting.length})</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>They can quote now. Approve them, approve them up to an amount, or decline them.</span>
      </div>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        {waiting.map((p) => (
          <VetRow key={p.id} partner={p} writes={writes} />
        ))}
      </div>
    </Card>
  )
}

function VetRow({ partner, writes }: { partner: Partner; writes: TradePartnerWrites }) {
  const [limit, setLimit] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const form = partner.vetting?.form
  const amount = Number(limit.replace(/[^0-9.]/g, ''))
  const decide = (status: 'approved' | 'declined', withLimit: boolean) => {
    setBusy(true)
    setProblem(null)
    writes
      .vetCompany(partner.id, status, withLimit && amount > 0 ? Math.round(amount) : null, note.trim())
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'That did not save.'))
      .finally(() => setBusy(false))
  }
  const row = (label: string, value: string | number) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '9rem minmax(0, 1fr)',
        gap: '0.5rem',
        fontSize: '0.875rem',
      }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '0.6rem 0.75rem',
        display: 'grid',
        gap: '0.45rem',
      }}
      data-gc-vet={partner.id}
    >
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'baseline',
          flexWrap: 'wrap',
        }}
      >
        <strong>{partner.company}</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {partner.trades.join(', ')} · {partner.contact || 'no contact yet'}
        </span>
        <VettingChip partner={partner} />
      </div>
      {form ? (
        <div style={{ display: 'grid', gap: '0.2rem' }}>
          {row('Form came in', shortDate(form.sentOn))}
          {row('License', form.license)}
          {row('Insurance', form.insurance)}
          {row('Years in business', form.yearsInBusiness)}
          {row('References', form.references)}
          {row('Jobs like ours', form.pastJobs)}
        </div>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Their form has not come in. You can still decide if you know enough.</div>
      )}
      <input style={{ ...input, maxWidth: '28rem' }} placeholder="A note, or why we decline" aria-label={`A note on ${partner.company}`} value={note} onChange={(e) => setNote(e.target.value)} />
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <Btn kind="primary" disabled={busy} onClick={() => decide('approved', false)}>
          Approve
        </Btn>
        <span
          style={{
            display: 'inline-flex',
            gap: '0.3rem',
            alignItems: 'center',
          }}
        >
          <input style={{ ...input, width: '7.5rem' }} inputMode="numeric" placeholder="$ amount" aria-label="Approve up to this amount" value={limit} onChange={(e) => setLimit(e.target.value)} />
          <Btn disabled={busy || !(amount > 0)} onClick={() => decide('approved', true)}>
            Approve up to this
          </Btn>
        </span>
        <Btn kind="quiet" disabled={busy} onClick={() => decide('declined', false)}>
          Decline
        </Btn>
        {problem && <span style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{problem}</span>}
      </div>
    </div>
  )
}

/** Each standard the office holds itself to: the ideal, where we are, and what closes the gap. Read only here but for adding a company. */
function AssistantActions({ rules, onAdd }: { rules: AssistantRule[]; onAdd: (trade: string) => void }) {
  const [folded, setFolded] = useState(false)
  const [open, setOpen] = useState<AssistantRule['key'] | null>('bench')
  const todo = rules.reduce((n, r) => n + r.items.length, 0)
  return (
    <Card
      style={{
        padding: 0,
        overflow: 'hidden',
        borderColor: 'var(--border-indigo)',
      }}
    >
      <div
        style={{
          padding: '0.65rem 1rem',
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'var(--bg-indigo-100)',
        }}
      >
        <strong style={{ color: 'var(--text-indigo-800)' }}>Actions for assistants</strong>
        <span style={{ color: 'var(--text-indigo-800)', fontSize: '0.875rem' }}>
          What good looks like, where we are today, and what closes the gap. {todo === 0 ? 'Nothing to do.' : `${todo} to do.`}
        </span>
        <span style={{ flex: 1 }} />
        <Btn kind="quiet" onClick={() => setFolded(!folded)}>
          {folded ? 'Show' : 'Hide'}
        </Btn>
      </div>
      {!folded &&
        rules.map((rule) => {
          const isOpen = open === rule.key
          return (
            <div key={rule.key} style={{ borderTop: '1px solid var(--border)' }}>
              <div
                style={{
                  padding: '0.6rem 1rem',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: '0.75rem',
                  alignItems: 'start',
                }}
              >
                <div style={{ fontSize: '0.9rem', display: 'grid', gap: '0.2rem' }}>
                  <strong>{rule.title}</strong>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>The ideal:</span> {rule.ideal}
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Where we are:</span> <Chip tone={rule.ok ? 'green' : 'amber'}>{rule.now}</Chip>
                  </div>
                </div>
                {rule.items.length > 0 ? (
                  <Btn kind={isOpen ? 'plain' : 'primary'} onClick={() => setOpen(isOpen ? null : rule.key)}>
                    {isOpen ? 'Hide' : `Show the ${rule.items.length} to do`}
                  </Btn>
                ) : (
                  <Chip tone="green">at the ideal</Chip>
                )}
              </div>
              {isOpen && rule.items.length > 0 && (
                <div
                  style={{
                    padding: '0 1rem 0.7rem',
                    display: 'grid',
                    gap: '0.3rem',
                  }}
                >
                  {itemsByTrade(rule.items).map((group) => (
                    <div key={group.trade ?? '-'} style={{ display: 'grid', gap: '0.3rem' }}>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          letterSpacing: '0.03em',
                          textTransform: 'uppercase',
                          color: 'var(--text-indigo-800)',
                          marginTop: '0.25rem',
                        }}
                      >
                        {group.trade ?? 'Other'}{' '}
                        <span
                          style={{
                            color: 'var(--text-muted)',
                            fontWeight: 600,
                          }}
                        >
                          ({group.items.length})
                        </span>
                      </div>
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            gap: '0.6rem',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            fontSize: '0.9rem',
                            padding: '0.3rem 0.6rem',
                            background: 'var(--bg-subtle)',
                            borderRadius: 6,
                          }}
                        >
                          <span style={{ flex: '1 1 20rem' }}>{item.text}</span>
                          {item.doneNote && <Chip tone="blue">{item.doneNote}</Chip>}
                          {item.action?.kind === 'add' && !item.doneNote && (
                            <Btn kind="quiet" onClick={() => item.action?.kind === 'add' && onAdd(item.action.trade)}>
                              {item.actionLabel}
                            </Btn>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
    </Card>
  )
}

function BenchCard({
  state,
  bench,
  writes,
  onOpenProject,
  adding,
  onAdding,
}: {
  state: GcState
  bench: TradeBench
  writes: TradePartnerWrites
  onOpenProject: (projectId: string) => void
  adding: boolean
  onAdding: (on: boolean) => void
}) {
  const [company, setCompany] = useState('')
  const [contact, setContact] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [base, setBase] = useState('')
  const [maxMiles, setMaxMiles] = useState('')
  // A company we add is new to us unless we say we know them (question 3): it quotes, then waits for approval.
  const [knownToUs, setKnownToUs] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const clear = () => {
    setCompany('')
    setContact('')
    setPhone('')
    setEmail('')
    setBase('')
    setMaxMiles('')
    setKnownToUs(false)
    setProblem(null)
  }
  const add = () => {
    setBusy(true)
    setProblem(null)
    writes
      .addCompany({
        name: company.trim(),
        trades: [bench.trade],
        contactName: contact.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: base.trim(),
        maxMiles: Number(maxMiles) > 0 ? Number(maxMiles) : null,
        known: knownToUs,
      })
      .then(() => {
        clear()
        onAdding(false)
      })
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'That did not save.'))
      .finally(() => setBusy(false))
  }
  return (
    <Card
      style={{
        padding: 0,
        overflow: 'hidden',
        borderColor: bench.short > 0 ? 'var(--border-red)' : 'var(--border)',
      }}
    >
      <span id={benchAnchor(bench.trade)} style={{ display: 'block', scrollMarginTop: '3.5rem' }} />
      <div
        style={{
          padding: '0.7rem 1rem',
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'var(--bg-blue-200)',
          borderLeft: '5px solid var(--text-blue-500)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <strong style={{ fontSize: '1.1rem', color: 'var(--text-blue-800)' }}>{bench.trade}</strong>
        <span style={{ color: 'var(--text-700)', fontSize: '0.875rem' }}>
          {bench.partners.length} {bench.partners.length === 1 ? 'company' : 'companies'}
        </span>
        {bench.short > 0 ? (
          <Chip tone="red">
            short {bench.short} {bench.short === 1 ? 'quote' : 'quotes'}
          </Chip>
        ) : bench.needs.length > 0 ? (
          <Chip tone="green">quotes are in</Chip>
        ) : (
          <Chip tone="grey">nothing out for quotes</Chip>
        )}
        <span style={{ flex: 1 }} />
        <Btn
          kind="quiet"
          onClick={() => {
            if (adding) clear()
            onAdding(!adding)
          }}
        >
          {adding ? 'Cancel' : 'Add a company'}
        </Btn>
      </div>

      {adding && (
        <div
          style={{
            padding: '0.6rem 1rem',
            display: 'grid',
            gap: '0.5rem',
            background: 'var(--bg-subtle)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <input autoFocus style={{ ...input, flex: '1 1 14rem' }} placeholder="Company name" aria-label="Company name" value={company} onChange={(e) => setCompany(e.target.value)} />
            <input style={{ ...input, flex: '1 1 12rem' }} placeholder="Who to call" aria-label="Who to call" value={contact} onChange={(e) => setContact(e.target.value)} />
            <input style={{ ...input, flex: '1 1 9rem' }} placeholder="Phone" aria-label="Their phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input style={{ ...input, flex: '1 1 12rem' }} placeholder="Email" aria-label="Their email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <CoverageFields base={base} maxMiles={maxMiles} onBase={setBase} onMaxMiles={setMaxMiles} />
          </div>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <label
              style={{
                fontSize: '0.85rem',
                display: 'inline-flex',
                gap: '0.3rem',
                alignItems: 'center',
              }}
              title="Leave it off for a company new to us. They can quote, and nothing is awarded to them until we approve them."
            >
              <input type="checkbox" checked={knownToUs} onChange={(e) => setKnownToUs(e.target.checked)} />
              We have worked with them
            </label>
            <Btn kind="primary" disabled={busy || company.trim() === ''} onClick={add}>
              Add to {bench.trade}
            </Btn>
            {problem && <span style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{problem}</span>}
          </div>
        </div>
      )}

      {bench.needs.length > 0 && (
        <div
          style={{
            padding: '0.6rem 1rem',
            display: 'grid',
            gap: '0.45rem',
            borderBottom: '1px solid var(--border)',
            background: bench.short > 0 ? 'var(--bg-red-tint)' : undefined,
          }}
        >
          {bench.needs.map((need) => (
            <NeedLine key={need.pkg.id} state={state} need={need} bench={bench} onOpenProject={onOpenProject} />
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Company</th>
              <th style={th}>When we ask</th>
              <th style={th}>Asked right now</th>
            </tr>
          </thead>
          <tbody>
            {bench.partners.map((partner) => (
              <PartnerLine key={partner.id} state={state} partner={partner} bench={bench} writes={writes} />
            ))}
            {bench.partners.length === 0 && (
              <tr>
                <td style={{ ...td, color: 'var(--text-red-700)' }} colSpan={3}>
                  No company does this trade yet. Press Add a company.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function CoverageFields({
  base,
  maxMiles,
  onBase,
  onMaxMiles,
  onEnter,
  onEscape,
  autoFocus = false,
}: {
  base: string
  maxMiles: string
  onBase: (v: string) => void
  onMaxMiles: (v: string) => void
  onEnter?: () => void
  onEscape?: () => void
  autoFocus?: boolean
}) {
  const placed = townFromAddress(base)
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnter) onEnter()
    if (e.key === 'Escape' && onEscape) onEscape()
  }
  return (
    <>
      <input
        autoFocus={autoFocus}
        value={base}
        onChange={(e) => onBase(e.target.value)}
        onKeyDown={keys}
        placeholder="Their address: street, town"
        aria-label="Their address"
        style={{ ...input, flex: '1 1 14rem', minWidth: 0 }}
      />
      {base.trim() !== '' &&
        (placed ? (
          <Chip tone="green" title={`We read this as ${placed}. The drive to each job is worked out from there.`}>
            in {placed}
          </Chip>
        ) : (
          <Chip tone="amber" title="We cannot place this town yet, so no drive shows. The address is kept as you typed it.">
            no drive yet
          </Chip>
        ))}
      <span
        style={{
          display: 'inline-flex',
          gap: '0.35rem',
          alignItems: 'center',
          fontSize: '0.85rem',
          color: 'var(--text-600)',
          whiteSpace: 'nowrap',
        }}
      >
        goes up to
        <input
          type="number"
          min={0}
          step={5}
          value={maxMiles}
          onChange={(e) => onMaxMiles(e.target.value)}
          onKeyDown={keys}
          placeholder="no limit"
          aria-label="How far they will go, in miles. Leave it empty for no limit."
          style={{ ...input, width: '5.5rem' }}
        />
        mi
      </span>
    </>
  )
}

function NeedLine({ state, need, bench, onOpenProject }: { state: GcState; need: TradeNeed; bench: TradeBench; onOpenProject: (projectId: string) => void }) {
  const asked = new Set(need.pkg.invites.map((i) => i.partnerId))
  const unasked = bench.partners.filter((p) => !asked.has(p.id))
  const notAsked = unasked.filter((p) => travelFor(state, p, need.project).inZone)
  const parts: string[] = []
  if (need.looking > 0) parts.push(`${need.looking} looking`)
  if (need.silent > 0) parts.push(`${need.silent} ${need.silent === 1 ? 'has' : 'have'} not opened it`)
  if (need.passed > 0) parts.push(`${need.passed} passed`)
  if (need.pkg.invites.length === 0) parts.push('no one asked yet')
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        flexWrap: 'wrap',
        fontSize: '0.9rem',
      }}
    >
      <button
        type="button"
        onClick={() => onOpenProject(need.project.id)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          fontWeight: 700,
          color: 'var(--text-link)',
          cursor: 'pointer',
        }}
      >
        {need.project.name}
      </button>
      <Chip tone={need.short === 0 ? 'green' : need.bids === 0 ? 'red' : 'amber'}>
        {need.bids} of {BIDS_WANTED} quotes
      </Chip>
      {parts.length > 0 && <span style={{ color: 'var(--text-600)' }}>{parts.join(' · ')}</span>}
      {need.daysLeft !== null && (
        <Chip tone={need.short > 0 && need.daysLeft <= 7 ? 'red' : 'grey'}>
          due {shortDate(need.project.bidDue)} · {need.daysLeft} days
        </Chip>
      )}
      {need.short > 0 && notAsked.length > 0 && (
        <span style={{ color: 'var(--text-600)' }}>
          {notAsked.length} in range {notAsked.length === 1 ? 'is' : 'are'} not asked yet
        </span>
      )}
      {/* With no company on the trade, the table under it says so: nobody to have asked. */}
      {need.short > 0 && notAsked.length === 0 && bench.partners.length > 0 && <span style={{ color: 'var(--text-red-700)', fontWeight: 600 }}>Everyone in range is asked. Add a company.</span>}
    </div>
  )
}

function PartnerLine({ state, partner, bench, writes }: { state: GcState; partner: Partner; bench: TradeBench; writes: TradePartnerWrites }) {
  const [editing, setEditing] = useState(false)
  const [base, setBase] = useState(partner.address || partner.base || '')
  const [maxMiles, setMaxMiles] = useState(partner.maxMiles === null ? '' : String(partner.maxMiles))
  const [problem, setProblem] = useState<string | null>(null)
  const record = RECORD_WORDS[answerRecord(partner)]
  const asks = partnerAsks(state, partner.id, bench.trade)
  const coverage = partner.address || partner.base ? `${partner.address || `from ${partner.base}`}${partner.maxMiles === null ? '' : ` · goes up to ${partner.maxMiles} mi`}` : 'address not set'
  const save = () => {
    setProblem(null)
    writes
      .setCoverage(partner.id, base.trim(), Number(maxMiles) > 0 ? Number(maxMiles) : null)
      .then(() => setEditing(false))
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'That did not save.'))
  }
  const cancel = () => {
    setBase(partner.address || partner.base || '')
    setMaxMiles(partner.maxMiles === null ? '' : String(partner.maxMiles))
    setProblem(null)
    setEditing(false)
  }
  return (
    <>
      <tr data-gc-partner={partner.id}>
        <td style={{ ...td, minWidth: '14rem' }}>
          <strong>{partner.company}</strong> <VettingChip partner={partner} />
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {partner.contact || 'no contact yet'}
            {partner.phone ? ` · ${partner.phone}` : ''}
            {partner.email ? ` · ${partner.email}` : ''}
          </div>
          {editing ? null : (
            <div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                title="Their address and how far they will go. The drive to each job is worked out from the address. Press to change."
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  font: 'inherit',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: partner.base ? 'var(--text-600)' : 'var(--text-amber-700)',
                  textDecoration: 'underline dotted',
                  textUnderlineOffset: 3,
                }}
              >
                {coverage}
              </button>
            </div>
          )}
          {problem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.8rem' }}>{problem}</div>}
        </td>
        <td style={{ ...td, whiteSpace: 'nowrap' }}>
          <Chip tone={record.tone}>{record.word}</Chip>{' '}
          <span style={{ color: 'var(--text-600)', fontSize: '0.85rem' }}>{partner.invited === 0 ? 'never asked' : `quoted ${partner.bids} of ${partner.invited} asks`}</span>
          {(bench.toldAhead[partner.id] ?? 0) > 0 && (
            <div
              style={{
                color: 'var(--text-green-800)',
                fontSize: '0.8rem',
                marginTop: '0.2rem',
              }}
            >
              {toldAheadWords(bench.toldAhead[partner.id] ?? 0)}
            </div>
          )}
        </td>
        <td style={td}>
          <span
            style={{
              display: 'flex',
              gap: '0.3rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {asks.length === 0 && <span style={{ color: 'var(--text-muted)' }}>not asked on anything live</span>}
            {asks.map((a) => {
              const words = ASK_WORDS[a.invite.status]
              const quiet = a.invite.status === 'invited' || a.invite.status === 'opened'
              const travel = travelFor(state, partner, a.project)
              const far = travelWords(travel, partner)
              const promise = quiet ? askPromise(a.invite, state.today) : null
              return (
                <Chip
                  key={a.invite.id}
                  tone={promise?.state === 'passed' ? 'red' : travel.inZone ? words.tone : 'amber'}
                  title={a.invite.status === 'declined' ? declinedTitle(a.invite) : travel.inZone ? undefined : 'This project is farther than they said they go.'}
                >
                  {a.project.name} · {promise ? promiseWords(promise) : a.invite.status === 'declined' ? declinedWords(a.invite) : words.word}
                  {quiet ? (a.waited === 0 ? ' · asked today' : ` · asked ${a.waited} ${a.waited === 1 ? 'day' : 'days'} ago`) : ''}
                  {far ? ` · ${far}` : ''}
                </Chip>
              )
            })}
          </span>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={3} style={{ ...td, background: 'var(--bg-subtle)' }}>
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                flexWrap: 'wrap',
                position: 'sticky',
                left: '0.6rem',
                maxWidth: 'min(100%, 42rem, calc(100vw - 4rem))',
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Address</span>
              <CoverageFields base={base} maxMiles={maxMiles} onBase={setBase} onMaxMiles={setMaxMiles} onEnter={save} onEscape={cancel} autoFocus />
              <Btn kind="primary" onClick={save}>
                Save
              </Btn>
              <Btn kind="quiet" onClick={cancel}>
                Cancel
              </Btn>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
