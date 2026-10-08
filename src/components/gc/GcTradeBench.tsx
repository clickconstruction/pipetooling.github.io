import { useState, type Dispatch, type KeyboardEvent } from 'react'
import {
  BIDS_WANTED,
  townFromAddress,
  PARTNER_SCHEDULE_WHY,
  answerRecord,
  askPromise,
  assistantRules,
  itemsByTrade,
  tradeTodoCounts,
  declinedTitle,
  declinedWords,
  partnerAsks,
  partnerExclusionHabits,
  partnerScheduleRecord,
  partnerScheduleWords,
  toldAheadWords,
  promiseWords,
  shortDate,
  tradeBenches,
  travelFor,
  travelWords,
  type AnswerRecord,
  type AssistantDo,
  type AssistantRule,
  type GcAction,
  type GcState,
  type Invite,
  type Partner,
  type TradeBench,
  type TradeNeed,
} from '../../lib/gcMode/gcModel'
import { CompanyLanguagePick } from './GcPortalLanguagePick'
import { GcPartnersTab, PaperworkChips } from './GcOfficeTabs'
import { GcAskCompanies } from './GcAskCompanies.proto'
import { Btn, Card, Chip, input, td, th, type Tone } from './gcUi'
import { GcVetQueue, VettingChip } from './GcVetting'
import { GcBoardStrip, type BoardStripItem } from './GcBoardStages.proto'
import { useJumpStrip } from './useJumpStrip'
import { PartnerName } from './GcCompanyFile'
import { GcScopeBookButton } from './GcNewProjectScopeBookPage'

/**
 * GC mode design spike: trade partners grouped by trade. The question this answers is "if one
 * of them flakes, who else do I have?" Each trade shows its bench (who answers when asked), every
 * project still short of bids in that trade, and a button to ask the companies not yet asked.
 * Trades short of bids sort to the top.
 */

interface Props {
  state: GcState
  dispatch: Dispatch<GcAction>
  onOpenProject: (projectId: string) => void
  onFollowUp: () => void
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

export function GcPartnersBoard(props: Props) {
  const [view, setView] = useState<'trade' | 'all'>('trade')
  const pill = (key: 'trade' | 'all', label: string) => {
    const active = view === key
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => setView(key)}
        style={{
          padding: '0.3rem 0.8rem',
          borderRadius: 999,
          border: `1px solid ${active ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
          background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
          color: active ? 'var(--text-blue-500)' : 'var(--text-600)',
          fontWeight: active ? 600 : 400,
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        {label}
      </button>
    )
  }
  return (
    <div>
      {/* Companies new to us wait here for a decision before any award (question 3). */}
      <GcVetQueue state={props.state} dispatch={props.dispatch} />
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div role="group" aria-label="Group trade partners" style={{ display: 'flex', gap: '0.35rem' }}>
          {pill('trade', 'By trade')}
          {pill('all', 'All companies')}
        </div>
        {/* The scope book (the owner, 2026-10-04; New Project's window): the lines we keep for each trade. */}
        <span style={{ marginLeft: 'auto' }} data-tour="gc-scope-book">
          <GcScopeBookButton state={props.state} dispatch={props.dispatch} label="Scope book" />
        </span>
      </div>
      {view === 'trade' ? <GcTradeBenchView {...props} /> : <GcPartnersTab state={props.state} dispatch={props.dispatch} />}
    </div>
  )
}

/** Open the Ask window (the owner, 2026-10-05): a job's trade, with these companies ticked. Unset: everyone in range. */
type AskFor = (projectId: string, packageId: string, tick?: string[]) => void

function benchAnchor(trade: string): string {
  return `gc-bench-${trade.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function GcTradeBenchView({ state, dispatch, onOpenProject, onFollowUp }: Props) {
  const [addingTrade, setAddingTrade] = useState<string | null>(null)
  // Asking opens a window first (the owner, 2026-10-05): who, what they get, then one press.
  const [asking, setAsking] = useState<{ projectId: string; packageId: string; tick?: string[] } | null>(null)
  const askFor: AskFor = (projectId, packageId, tick) => setAsking({ projectId, packageId, ...(tick ? { tick } : {}) })
  const benches = tradeBenches(state)

  const run = (action: AssistantDo) => {
    if (action.kind === 'chase') {
      onFollowUp()
    } else if (action.kind === 'tab') {
      dispatch({ type: 'shareBidTab', projectId: action.projectId, packageId: action.packageId, showNames: false })
    } else if (action.kind === 'add') {
      setAddingTrade(action.trade)
      document.getElementById(benchAnchor(action.trade))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else if (action.kind === 'ask') {
      askFor(action.projectId, action.packageId, action.partnerIds)
    } else if (action.kind === 'nudge') {
      dispatch({ type: 'nudge', projectId: action.projectId, packageId: action.packageId, inviteId: action.inviteId, about: action.about })
    } else {
      dispatch({ type: 'sendMsa', partnerId: action.partnerId })
    }
  }

  const rules = assistantRules(state)
  // A pill per trade, like the Project Board's strip (the owner, 2026-10-04): its to-dos, red when it
  // is short on quotes; pressing one jumps to the trade's card.
  const todos = tradeTodoCounts(rules)
  const tradeItems: BoardStripItem[] = benches.map((b) => ({
    key: b.trade,
    label: b.trade,
    tone: b.short > 0 ? 'red' : (todos.get(b.trade) ?? 0) > 0 ? 'amber' : 'green',
    count: todos.get(b.trade) ?? 0,
    ...(b.short > 0 ? { dots: ['red' as const] } : {}),
    noun: ['to-do', 'to-dos'],
  }))
  const { active, jumpTo } = useJumpStrip(true, benches.map((b) => b.trade), benchAnchor)

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      {asking && (
        <GcAskCompanies
          key={`${asking.packageId}:${(asking.tick ?? []).join(',')}`}
          state={state}
          dispatch={dispatch}
          projectId={asking.projectId}
          packageId={asking.packageId}
          {...(asking.tick ? { tick: asking.tick } : {})}
          onClose={() => setAsking(null)}
        />
      )}
      <GcBoardStrip items={tradeItems} active={active} onJump={jumpTo} label="Jump to a trade" />
      <AssistantActions rules={rules} onRun={run} />
      {benches.map((bench) => (
        <BenchCard
          key={bench.trade}
          state={state}
          bench={bench}
          dispatch={dispatch}
          onOpenProject={onOpenProject}
          onFollowUp={onFollowUp}
          onAsk={askFor}
          adding={addingTrade === bench.trade}
          onAdding={(on) => setAddingTrade(on ? bench.trade : null)}
        />
      ))}
    </div>
  )
}

/**
 * The assistant's section: each standard the office holds itself to, said as the ideal and where
 * we are today, with the gaps under it and one press for each.
 */
function AssistantActions({ rules, onRun }: { rules: AssistantRule[]; onRun: (action: AssistantDo) => void }) {
  const [folded, setFolded] = useState(false)
  const [open, setOpen] = useState<AssistantRule['key'] | null>('bench')
  const todo = rules.reduce((n, r) => n + r.items.length, 0)
  return (
    <Card style={{ padding: 0, overflow: 'hidden', borderColor: 'var(--border-indigo)' }}>
      <div style={{ padding: '0.65rem 1rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg-indigo-100)' }}>
        <strong style={{ color: 'var(--text-indigo-800)' }}>Actions for assistants</strong>
        <span style={{ color: 'var(--text-indigo-800)', fontSize: '0.875rem' }}>
          What good looks like, where we are today, and what closes the gap. {todo === 0 ? 'Nothing to do.' : `${todo} to do.`}
        </span>
        <span style={{ flex: 1 }} />
        <Btn kind="quiet" onClick={() => setFolded(!folded)}>{folded ? 'Show' : 'Hide'}</Btn>
      </div>
      {!folded &&
        rules.map((rule) => {
          const isOpen = open === rule.key
          return (
            <div key={rule.key} style={{ borderTop: '1px solid var(--border)' }}>
              <div style={{ padding: '0.6rem 1rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.75rem', alignItems: 'start' }}>
                <div style={{ fontSize: '0.9rem', display: 'grid', gap: '0.2rem' }}>
                  <strong>{rule.title}</strong>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>The ideal:</span> {rule.ideal}
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Where we are:</span>{' '}
                    <Chip tone={rule.ok ? 'green' : 'amber'}>{rule.now}</Chip>
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
                <div style={{ padding: '0 1rem 0.7rem', display: 'grid', gap: '0.3rem' }}>
                  {/* Under one heading per trade (the owner, 2026-10-04: "headers … showing each of the trades"). */}
                  {itemsByTrade(rule.items).map((group) => (
                    <div key={group.trade ?? '-'} style={{ display: 'grid', gap: '0.3rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-indigo-800)', marginTop: '0.25rem' }}>
                        {group.trade ?? 'Other'} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>({group.items.length})</span>
                      </div>
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.9rem', padding: '0.3rem 0.6rem', background: 'var(--bg-subtle)', borderRadius: 6 }}
                        >
                          <span style={{ flex: '1 1 20rem' }}>{item.text}</span>
                          {item.doneNote && <Chip tone="blue">{item.doneNote}</Chip>}
                          {item.action && !item.doneNote && (
                            <Btn kind="quiet" onClick={() => item.action && onRun(item.action)}>{item.actionLabel}</Btn>
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
  dispatch,
  onOpenProject,
  adding,
  onAdding,
  onAsk,
}: Props & { bench: TradeBench; adding: boolean; onAdding: (on: boolean) => void; onAsk: AskFor }) {
  const [company, setCompany] = useState('')
  const [contact, setContact] = useState('')
  const [base, setBase] = useState('')
  const [maxMiles, setMaxMiles] = useState('')
  // A company we add is new to us unless we say we know them (question 3): it quotes, then waits for approval.
  const [knownToUs, setKnownToUs] = useState(false)
  const setAdding = onAdding

  return (
    <Card style={{ padding: 0, overflow: 'hidden', borderColor: bench.short > 0 ? 'var(--border-red)' : 'var(--border)' }}>
      <span id={benchAnchor(bench.trade)} style={{ display: 'block', scrollMarginTop: '3.5rem' }} />
      {/* The trade's name sits on a band of its own color (the owner, 2026-10-05), so each group reads as a group. */}
      <div style={{ padding: '0.7rem 1rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg-blue-200)', borderLeft: '5px solid var(--text-blue-500)', borderBottom: '1px solid var(--border)' }}>
        <strong style={{ fontSize: '1.1rem', color: 'var(--text-blue-800)' }}>{bench.trade}</strong>
        <span style={{ color: 'var(--text-700)', fontSize: '0.875rem' }}>
          {bench.partners.length} {bench.partners.length === 1 ? 'company' : 'companies'}
        </span>
        {bench.short > 0 ? (
          <Chip tone="red">short {bench.short} {bench.short === 1 ? 'quote' : 'quotes'}</Chip>
        ) : bench.needs.length > 0 ? (
          <Chip tone="green">quotes are in</Chip>
        ) : (
          <Chip tone="grey">nothing out for quotes</Chip>
        )}
        <span style={{ flex: 1 }} />
        <Btn kind="quiet" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : 'Add a company'}</Btn>
      </div>

      {adding && (
        <div style={{ padding: '0.6rem 1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
          <input autoFocus style={{ ...input, flex: '1 1 14rem' }} placeholder="Company name" value={company} onChange={(e) => setCompany(e.target.value)} />
          <input style={{ ...input, flex: '1 1 12rem' }} placeholder="Who to call" value={contact} onChange={(e) => setContact(e.target.value)} />
          <CoverageFields base={base} maxMiles={maxMiles} onBase={setBase} onMaxMiles={setMaxMiles} />
          <label style={{ fontSize: '0.85rem', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }} title="Leave it off for a company new to us. They can quote, and nothing is awarded to them until we approve them.">
            <input type="checkbox" checked={knownToUs} onChange={(e) => setKnownToUs(e.target.checked)} />
            We have worked with them
          </label>
          <Btn
            kind="primary"
            disabled={company.trim() === ''}
            onClick={() => {
              dispatch({
                type: 'addPartner',
                company: company.trim(),
                contact: contact.trim(),
                trade: bench.trade,
                base: townFromAddress(base),
                maxMiles: Number(maxMiles) > 0 ? Number(maxMiles) : null,
                known: knownToUs,
                ...(base.trim() ? { address: base.trim() } : {}),
              })
              setKnownToUs(false)
              setCompany('')
              setContact('')
              setBase('')
              setMaxMiles('')
              setAdding(false)
            }}
          >
            Add to {bench.trade}
          </Btn>
        </div>
      )}

      {bench.needs.length > 0 && (
        <div style={{ padding: '0.6rem 1rem', display: 'grid', gap: '0.45rem', borderBottom: '1px solid var(--border)', background: bench.short > 0 ? 'var(--bg-red-tint)' : undefined }}>
          {bench.needs.map((need) => (
            <NeedLine key={need.pkg.id} state={state} need={need} bench={bench} onAsk={onAsk} onOpenProject={onOpenProject} />
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
              <th style={th}>Paperwork</th>
            </tr>
          </thead>
          <tbody>
            {bench.partners.map((partner) => (
              <PartnerLine key={partner.id} state={state} partner={partner} bench={bench} dispatch={dispatch} onAsk={onAsk} />
            ))}
            {bench.partners.length === 0 && (
              <tr>
                <td style={{ ...td, color: 'var(--text-red-700)' }} colSpan={4}>
                  No company in the directory does this trade. Add one to ask them.
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
  /** Enter in either box saves; Escape cancels (the owner's pick, 2026-10-05: one line across the row). */
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
      {/* Their address, and the app works out the drive (the owner, 2026-10-05). The prototype reads the town in it; the real build maps the address. */}
      <input
        autoFocus={autoFocus}
        value={base}
        onChange={(e) => onBase(e.target.value)}
        onKeyDown={keys}
        placeholder="Their address: street, town"
        aria-label="Their address"
        style={{ ...input, flex: '1 1 10rem', minWidth: 0 }}
      />
      {/* What the app made of it, as one chip; the whole sentence is on its hover. */}
      {base.trim() !== '' &&
        (placed ? (
          <Chip tone="green" title={`We read this as ${placed}. The drive to each job is worked out from there.`}>
            in {placed}
          </Chip>
        ) : (
          <Chip tone="amber" title="We cannot place this address yet, so no drive shows. Check the town.">
            cannot place this
          </Chip>
        ))}
      <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-600)', whiteSpace: 'nowrap' }}>
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

function NeedLine({
  state,
  need,
  bench,
  onAsk,
  onOpenProject,
}: {
  state: GcState
  need: TradeNeed
  bench: TradeBench
  onAsk: AskFor
  onOpenProject: (projectId: string) => void
}) {
  const asked = new Set(need.pkg.invites.map((i) => i.partnerId))
  const unasked = bench.partners.filter((p) => !asked.has(p.id))
  const notAsked = unasked.filter((p) => travelFor(state, p, need.project).inZone)
  const tooFar = unasked.length - notAsked.length
  const parts: string[] = []
  if (need.looking > 0) parts.push(`${need.looking} looking`)
  if (need.silent > 0) parts.push(`${need.silent} ${need.silent === 1 ? 'has' : 'have'} not opened it`)
  if (need.passed > 0) parts.push(`${need.passed} passed`)
  if (need.pkg.invites.length === 0) parts.push('no one asked yet')
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.9rem' }}>
      <button
        type="button"
        onClick={() => onOpenProject(need.project.id)}
        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--text-link)', cursor: 'pointer' }}
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
        <Btn
          kind="primary"
          onClick={() => onAsk(need.project.id, need.pkg.id)}
        >
          Ask the {notAsked.length} we have not asked
        </Btn>
      )}
      {need.short > 0 && tooFar > 0 && (
        <span style={{ color: 'var(--text-600)' }}>
          {tooFar} more {tooFar === 1 ? 'is' : 'are'} too far from {need.project.town}
        </span>
      )}
      {need.short > 0 && notAsked.length === 0 && (
        <span style={{ color: 'var(--text-red-700)', fontWeight: 600 }}>Everyone in range is asked. Add a company.</span>
      )}
    </div>
  )
}

/** An ask not sent yet: the outline of the chip it becomes once it is. */
const askPill = {
  padding: '0.1rem 0.55rem',
  borderRadius: 999,
  border: '1px dashed var(--text-blue-500)',
  background: 'transparent',
  color: 'var(--text-link)',
  fontSize: '0.75rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
} as const

function PartnerLine({ state, partner, bench, dispatch, onAsk }: { state: GcState; partner: Partner; bench: TradeBench; dispatch: Dispatch<GcAction>; onAsk: AskFor }) {
  const [editing, setEditing] = useState(false)
  // The address typed for the drive; a company with only a town on file starts from the town.
  const [base, setBase] = useState(partner.address || partner.base || '')
  const [maxMiles, setMaxMiles] = useState(partner.maxMiles === null ? '' : String(partner.maxMiles))
  const record = RECORD_WORDS[answerRecord(partner)]
  // The schedule plan (owner, 2026-10-02): how they keep our dates, beside how they answer.
  const schedule = partnerScheduleRecord(state, partner)
  const habits = partnerExclusionHabits(state, partner)
  const asks = partnerAsks(state, partner.id, bench.trade)
  const askedOn = new Set(asks.map((a) => a.pkg.id))
  const open = bench.needs.filter((n) => n.short > 0 && !askedOn.has(n.pkg.id))
  const coverage = partner.base || partner.address
    ? `${partner.address || `from ${partner.base}`}${partner.maxMiles === null ? '' : ` · goes up to ${partner.maxMiles} mi`}`
    : 'address not set'
  const save = () => {
    dispatch({ type: 'setCoverage', partnerId: partner.id, base: townFromAddress(base), maxMiles: Number(maxMiles) > 0 ? Number(maxMiles) : null, address: base.trim() })
    setEditing(false)
  }
  const cancel = () => {
    setBase(partner.address || partner.base || '')
    setMaxMiles(partner.maxMiles === null ? '' : String(partner.maxMiles))
    setEditing(false)
  }
  return (
    <>
    <tr>
      <td style={{ ...td, minWidth: '14rem' }}>
        <PartnerName partnerId={partner.id} company={partner.company} /> <VettingChip partner={partner} />
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{partner.contact || 'no contact yet'}</div>
        {/* Portal lane: the company's language, for its portal and messages. */}
        <div>
          <CompanyLanguagePick partner={partner} dispatch={dispatch} />
        </div>
        {editing ? null : (
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
              whiteSpace: 'nowrap',
              color: partner.base ? 'var(--text-600)' : 'var(--text-amber-700)',
              textDecoration: 'underline dotted',
              textUnderlineOffset: 3,
            }}
          >
            {coverage}
          </button>
        )}
      </td>
      <td style={{ ...td, whiteSpace: 'nowrap' }}>
        <Chip tone={record.tone}>{record.word}</Chip>{' '}
        <span style={{ color: 'var(--text-600)', fontSize: '0.85rem' }}>
          {partner.invited === 0 ? 'never asked' : `quoted ${partner.bids} of ${partner.invited} asks`}
        </span>
        {schedule && (
          <div style={{ color: 'var(--text-600)', fontSize: '0.8rem', marginTop: '0.2rem' }} title={PARTNER_SCHEDULE_WHY}>
            On our jobs: {partnerScheduleWords(schedule)}
          </div>
        )}
        {/* G-116's credit (the counts): a company that tells us early, from its portal, before the day passes. */}
        {(bench.toldAhead[partner.id] ?? 0) > 0 && (
          <div data-gc-told-ahead={partner.id} style={{ color: 'var(--text-green-800)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
            {toldAheadWords(bench.toldAhead[partner.id] ?? 0)}
          </div>
        )}
        {/* What this company usually leaves out of its quotes (the owner, 2026-10-04: exclusions per company). */}
        {habits.length > 0 && (
          <div style={{ color: 'var(--text-600)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
            Usually excludes: {habits.slice(0, 3).map((h) => `${h.name.toLowerCase()} (${h.excluded} of ${h.of})`).join(', ')}
            {habits.length > 3 ? ` and ${habits.length - 3} more` : ''}
          </div>
        )}
      </td>
      <td style={td}>
        <span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {asks.length === 0 && open.length === 0 && <span style={{ color: 'var(--text-muted)' }}>not asked on anything live</span>}
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
                {/* The reason they are out stays with the company too (the owner, 2026-10-04). */}
                {a.project.name} · {promise ? promiseWords(promise) : a.invite.status === 'declined' ? declinedWords(a.invite) : words.word}
                {quiet ? (a.waited === 0 ? ' · asked today' : ` · asked ${a.waited} ${a.waited === 1 ? 'day' : 'days'} ago`) : ''}
                {far ? ` · ${far}` : ''}
              </Chip>
            )
          })}
          {open.map((n) => {
            const travel = travelFor(state, partner, n.project)
            const far = travelWords(travel, partner)
            const ask = () => onAsk(n.project.id, n.pkg.id, [partner.id])
            return travel.inZone ? (
              <button key={n.pkg.id} type="button" onClick={ask} style={askPill} title={`Ask ${partner.company} to quote ${bench.trade.toLowerCase()} on ${n.project.name}.`}>
                + Ask on {n.project.name}
                {far ? ` · ${far}` : ''}
              </button>
            ) : (
              <span key={n.pkg.id} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {n.project.name} is {far}.{' '}
                <button type="button" onClick={ask} style={{ ...askPill, border: 'none', padding: 0, textDecoration: 'underline' }}>
                  Ask anyway
                </button>
              </span>
            )
          })}
        </span>
      </td>
      <td style={td}><PaperworkChips partner={partner} today={state.today} /></td>
    </tr>
    {/* The address editor runs across the whole row on one line, not stacked in the company cell (the owner's pick, 2026-10-05; `company-address-editor-mockup.html`). */}
    {editing && (
      <tr>
        <td colSpan={4} style={{ ...td, background: 'var(--bg-subtle)' }}>
          {/* The table can be wider than its card and scroll sideways: the editor stays in sight, no wider than the screen. */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', position: 'sticky', left: '0.6rem', maxWidth: 'min(100%, 42rem, calc(100vw - 4rem))' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Address</span>
            <CoverageFields base={base} maxMiles={maxMiles} onBase={setBase} onMaxMiles={setMaxMiles} onEnter={save} onEscape={cancel} autoFocus />
            <Btn kind="primary" onClick={save}>Save</Btn>
            <Btn kind="quiet" onClick={cancel}>Cancel</Btn>
          </div>
        </td>
      </tr>
    )}
    </>
  )
}
