import { useEffect, useState, type Dispatch } from 'react'
import {
  architectSummary,
  currentRev,
  customerSummary,
  daysUntil,
  money,
  partnerById,
  planLabel,
  plansReach,
  proposalTotals,
  shortDate,
  type GcAction,
  type GcCustomer,
  type GcProject,
  type GcStage,
  type GcState,
} from '../../lib/gcMode/gcModel'
import { Btn, Chip, Stat, input, num, td, th, type Tone } from './gcUi'

/**
 * GC mode design spike: one company, one window, whatever they are to us. The record is the
 * app's own customer record, so an owner and an architect open the same window, with the same
 * call log. What it shows follows what the company is on our projects: an owner gets the money
 * and the projects we build for them, an architect gets the sets they issued and the questions
 * they owe us, and a company that is both gets both.
 */

interface Props {
  state: GcState
  customer: GcCustomer
  dispatch: Dispatch<GcAction>
  onClose: () => void
  onOpenProject: (projectId: string) => void
  onPlans: (projectId: string) => void
  /** Open another company's window in place of this one. */
  onCustomer: (customerId: string) => void
}

const STAGE_WORDS: Record<GcStage, { tone: Tone; word: string }> = {
  pursuing: { tone: 'amber', word: 'bidding to them' },
  buyout: { tone: 'blue', word: 'buying out' },
  building: { tone: 'green', word: 'building' },
}

const linkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'var(--text-link)',
  cursor: 'pointer',
  textDecoration: 'underline',
  textDecorationColor: 'var(--border-blue)',
  textUnderlineOffset: 3,
} as const

function days(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

function projects(n: number): string {
  return `${n} ${n === 1 ? 'project' : 'projects'}`
}

export function GcCustomerWindow({ state, customer, dispatch, onClose, onOpenProject, onPlans, onCustomer }: Props) {
  const [note, setNote] = useState('')
  const owner = customerSummary(state, customer)
  const architect = architectSummary(state, customer)
  const isOwner = owner.live.length > 0 || customer.past.length > 0
  const isArchitect = architect.live.length > 0
  const both = isOwner && isArchitect
  const decided = owner.won + customer.past.filter((p) => p.outcome === 'lost').length
  const oldest = architect.waiting[0]?.days ?? 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={customer.name}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: 10,
          width: 'min(980px, 100%)',
          maxHeight: '92vh',
          overflowY: 'auto',
          border: '1px solid var(--border-strong)',
        }}
      >
        <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: '1.15rem' }}>{customer.name}</div>
          <Chip tone="grey">{customer.kind}</Chip>
          {owner.live.length > 0 && <Chip tone="amber">Owner on {projects(owner.live.length)}</Chip>}
          {isArchitect && <Chip tone="violet">Architect on {projects(architect.live.length)}</Chip>}
          {isOwner && (
            <Chip tone={customer.portalOn ? 'green' : 'grey'}>
              {customer.portalOn
                ? `Owner's portal on${customer.portalLastOpened ? ` · opened ${shortDate(customer.portalLastOpened)}` : ''}`
                : "Owner's portal off"}
            </Chip>
          )}
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '0.9rem 1rem', display: 'grid', gap: '1rem' }}>
          {isOwner && (
            <div>
              {both && <Heading>As the owner</Heading>}
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <Stat label="Live projects" value={owner.live.length} />
                <Stat label="Priced, waiting on them" value={money(owner.inFront)} />
                <Stat label="Under contract" value={money(owner.underContract)} />
                <Stat label="They owe us now" value={money(owner.owed)} tone={owner.owed > 0 ? 'red' : undefined} />
                <Stat label="They are holding" value={money(owner.retainageHeld)} />
                <Stat label="They picked us" value={decided > 0 ? `${owner.won} of ${decided}` : 'first job'} />
              </div>
            </div>
          )}
          {isArchitect && (
            <div>
              {both && <Heading>As the architect</Heading>}
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <Stat label="Projects they drew" value={architect.live.length} />
                <Stat label="Addenda issued" value={architect.addenda} />
                <Stat label="Questions waiting on them" value={architect.waiting.length} tone={architect.waiting.length > 0 ? 'red' : 'green'} />
                <Stat label="Oldest question" value={architect.waiting.length > 0 ? days(oldest) : 'none'} tone={oldest >= 3 ? 'red' : undefined} />
                <Stat label="They answer in about" value={customer.answerDays === null ? 'no answer yet' : days(customer.answerDays)} />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(17rem, 1fr))' }}>
            <section>
              <Heading>Who to call</Heading>
              <div style={{ fontSize: '0.9rem', display: 'grid', gap: '0.15rem' }}>
                <div><strong>{customer.contact}</strong> · {customer.contactRole}</div>
                <div>{customer.phone}</div>
                <div>{customer.email}</div>
                <div style={{ color: 'var(--text-muted)' }}>{customer.address}</div>
              </div>
            </section>
            {isOwner && customer.howTheyBuy && (
              <section>
                <Heading>How they buy and pay</Heading>
                <div style={{ fontSize: '0.9rem', display: 'grid', gap: '0.15rem' }}>
                  <div>{customer.howTheyBuy}</div>
                  <div>
                    {customer.payDays === null ? 'They have not paid a bill yet.' : `They pay in about ${customer.payDays} days.`}
                    {customer.retainagePct !== null && ` They hold ${customer.retainagePct}% until the end.`}
                  </div>
                </div>
              </section>
            )}
            {isArchitect && (
              <section>
                <Heading>What they do for us</Heading>
                <div style={{ fontSize: '0.9rem' }}>
                  They issue the plans and every addendum. They answer the trades&rsquo; questions. Later they approve submittals.
                </div>
              </section>
            )}
          </div>
          {customer.tradesNote && (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-violet-700)' }}>In Trades mode: {customer.tradesNote}</div>
          )}

          {isArchitect && (
            <section>
              <Heading>Questions waiting on them</Heading>
              {architect.waiting.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nothing is waiting on them.</div>
              ) : (
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {architect.waiting.map(({ project, question, days: waited }) => {
                    const pkg = project.packages.find((p) => p.id === question.packageId)
                    const partner = partnerById(state, question.partnerId)
                    return (
                      <div key={question.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.7rem', fontSize: '0.9rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.2rem' }}>
                          <Chip tone={waited >= 3 ? 'red' : 'amber'}>{days(waited)}</Chip>
                          <strong>{project.name}</strong>
                          <span style={{ color: 'var(--text-muted)' }}>· {pkg?.trade} · asked by {partner?.company} on {shortDate(question.askedOn)}</span>
                        </div>
                        <div>{question.text}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                          The answer goes to every company bidding {pkg?.trade.toLowerCase()}.
                          {project.bidDue ? ` Our bid is due ${shortDate(project.bidDue)}.` : ''}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {architect.answered.length > 0 && (
                <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-600)' }}>
                  {architect.answered.map(({ project, question }) => (
                    <div key={question.id}>
                      <Chip tone="green">answered {shortDate(question.answeredOn)}</Chip> {project.name}: {question.text}{' '}
                      <em>{question.answer}</em>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {isOwner && (
            <section>
              <Heading>{both ? 'Projects we build for them' : 'Projects with them'}</Heading>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Project</th>
                      <th style={th}>Where it stands</th>
                      <th style={{ ...th, textAlign: 'right' }}>Our price</th>
                      <th style={{ ...th, textAlign: 'right' }}>Billed</th>
                      <th style={{ ...th, textAlign: 'right' }}>Paid</th>
                      <th style={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {owner.live.map((p) => (
                      <OwnerRow
                        key={p.id}
                        project={p}
                        today={state.today}
                        onOpen={() => onOpenProject(p.id)}
                        onPlans={() => onPlans(p.id)}
                        onArchitect={p.architectId === customer.id ? null : () => onCustomer(p.architectId)}
                      />
                    ))}
                    {customer.past.map((p) => (
                      <tr key={p.name}>
                        <td style={td}>
                          {p.name}
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{p.year}{p.note ? ` · ${p.note}` : ''}</div>
                        </td>
                        <td style={td}><Chip tone={p.outcome === 'built' ? 'green' : 'red'}>{p.outcome === 'built' ? 'built' : 'lost'}</Chip></td>
                        <td style={num}>{money(p.value)}</td>
                        <td style={num}>{p.outcome === 'built' ? money(p.value) : '—'}</td>
                        <td style={num}>{p.outcome === 'built' ? money(p.value) : '—'}</td>
                        <td style={td} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {isArchitect && (
            <section>
              <Heading>Projects they drew</Heading>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Project</th>
                      <th style={th}>Owner</th>
                      <th style={th}>Newest set</th>
                      <th style={th}>Who has it</th>
                      <th style={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {architect.live.map((p) => (
                      <DrawnRow
                        key={p.id}
                        project={p}
                        onOpen={() => onOpenProject(p.id)}
                        onPlans={() => onPlans(p.id)}
                        onOwner={p.customerId === customer.id ? null : () => onCustomer(p.customerId)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section>
            <Heading>Last contacts</Heading>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <input
                style={{ ...input, flex: '1 1 18rem' }}
                placeholder="What was said, in a sentence"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Btn
                kind="primary"
                disabled={note.trim() === ''}
                onClick={() => {
                  dispatch({ type: 'logCustomerContact', customerId: customer.id, note: note.trim() })
                  setNote('')
                }}
              >
                Log a call
              </Btn>
            </div>
            <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
              {customer.contacts.length === 0 && <span style={{ color: 'var(--text-muted)' }}>No contact logged yet.</span>}
              {customer.contacts.map((c, i) => (
                <div key={`${c.on}-${i}`}>
                  <span style={{ color: 'var(--text-muted)' }}>{shortDate(c.on)} · {c.by}:</span> {c.note}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div style={{ padding: '0.6rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {isOwner && (
            <Btn onClick={() => undefined} title="In the real build this opens what the owner sees: their projects, progress and bills.">
              See what they see ↗
            </Btn>
          )}
          <Btn
            onClick={() => undefined}
            title="The same customer record the rest of the app uses. In the real build this opens their page in Customers, with jobs, bids and contacts."
          >
            Open the customer&rsquo;s page ↗
          </Btn>
        </div>
      </div>
    </div>
  )
}

function Heading({ children }: { children: string }) {
  return (
    <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
      {children}
    </div>
  )
}

function OwnerRow({
  project,
  today,
  onOpen,
  onPlans,
  onArchitect,
}: {
  project: GcProject
  today: string
  onOpen: () => void
  onPlans: () => void
  onArchitect: (() => void) | null
}) {
  const totals = proposalTotals(project)
  const stage = STAGE_WORDS[project.stage]
  const due = project.bidDue ? daysUntil(project.bidDue, today) : null
  return (
    <tr>
      <td style={td}>
        <strong>{project.name}</strong>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {project.sizeNote} · drawn by{' '}
          {onArchitect ? <button type="button" style={linkStyle} onClick={onArchitect}>{project.architect}</button> : 'them'}
        </div>
      </td>
      <td style={td}>
        <Chip tone={stage.tone}>{stage.word}</Chip>{' '}
        {due !== null && project.stage === 'pursuing' && <Chip tone={due <= 7 ? 'red' : 'amber'}>due {shortDate(project.bidDue)}</Chip>}{' '}
        {totals.holes.length > 0 && <Chip tone="red">{totals.holes.length} trades with no number</Chip>}
      </td>
      <td style={num}>{money(totals.price)}</td>
      <td style={num}>{project.ownerBilling ? money(project.ownerBilling.billed) : '—'}</td>
      <td style={num}>{project.ownerBilling ? money(project.ownerBilling.paid) : '—'}</td>
      <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
        <Btn kind="quiet" onClick={onPlans} title={`Plans · ${planLabel(project, currentRev(project))}`}>Plans</Btn>
        <Btn kind="quiet" onClick={onOpen}>Open</Btn>
      </td>
    </tr>
  )
}

function DrawnRow({
  project,
  onOpen,
  onPlans,
  onOwner,
}: {
  project: GcProject
  onOpen: () => void
  onPlans: () => void
  onOwner: (() => void) | null
}) {
  const rev = currentRev(project)
  const set = project.planSets.find((s) => s.rev === rev)
  const reach = plansReach(project)
  return (
    <tr>
      <td style={td}>
        <strong>{project.name}</strong>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{project.sizeNote}</div>
      </td>
      <td style={td}>{onOwner ? <button type="button" style={linkStyle} onClick={onOwner}>{project.owner}</button> : 'Them'}</td>
      <td style={td}>
        {planLabel(project, rev)}
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>issued {shortDate(set?.issuedOn ?? null)}</div>
      </td>
      <td style={td}>
        {reach.of === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>no one invited yet</span>
        ) : (
          <Chip tone={reach.have === reach.of ? 'green' : 'amber'}>{reach.have} of {reach.of} opened it</Chip>
        )}
      </td>
      <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
        <Btn kind="quiet" onClick={onPlans}>Plans</Btn>
        <Btn kind="quiet" onClick={onOpen}>Open</Btn>
      </td>
    </tr>
  )
}
