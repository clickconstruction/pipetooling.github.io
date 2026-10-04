import { useEffect, useState, type Dispatch } from 'react'
import {
  architectSummary,
  currentRev,
  customerSummary,
  ownerAccount,
  ownerInterest,
  ownerMoney,
  daysUntil,
  lostWords,
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
import { GcOwnerBillingPortal } from './GcOwnerBillingPortal'
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
  // What they owe, split by where it stands with the architect: our sent pay applications only.
  const owedSplit = owner.live.reduce(
    (sum, p) => {
      const account = ownerAccount(p)
      return account ? { certified: sum.certified + account.certifiedUnpaid, architect: sum.architect + account.waitingOnArchitect } : sum
    },
    { certified: 0, architect: 0 },
  )
  // Interest on late bills (Owner Billing, 2026-10-04): its own line, apart from the contract's numbers.
  const interest = owner.live.reduce(
    (sum, p) => {
      const i = ownerInterest(state, p)
      return { billed: sum.billed + i.billed, paid: sum.paid + i.paid, toBill: sum.toBill + i.toBill }
    },
    { billed: 0, paid: 0, toBill: 0 },
  )
  // A live bid we lost (owner, 2026-10-03) counts as decided, like a lost one in their history.
  const decided = owner.won + customer.past.filter((p) => p.outcome === 'lost').length + owner.live.filter((p) => p.lostOn).length
  const oldest = architect.waiting[0]?.days ?? 0
  // The owner's portal shows a job that is ours: won and buying out, or building. A job still
  // bidding has nothing to bill on. 'pick' asks which first when there is more than one.
  const portalProjects = state.projects.filter((p) => p.customerId === customer.id && (p.stage === 'buyout' || p.stage === 'building'))
  const [portal, setPortal] = useState<string | null>(null)
  const portalProject = state.projects.find((p) => p.id === portal) ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Escape closes the window on top: the portal first, then this one.
      if (portal) setPortal(null)
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, portal])

  return (
    <>
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
          {owner.live.length > 0 && <Chip tone="amber">Customer on {projects(owner.live.length)}</Chip>}
          {isArchitect && <Chip tone="violet">Architect on {projects(architect.live.length)}</Chip>}
          {isOwner && (
            <Chip tone={customer.portalOn ? 'green' : 'grey'}>
              {customer.portalOn
                ? `Customer's portal on${customer.portalLastOpened ? ` · opened ${shortDate(customer.portalLastOpened)}` : ''}`
                : "Customer's portal off"}
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
              {both && <Heading>As the customer</Heading>}
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <Stat label="Live projects" value={owner.live.length} />
                <Stat label="Priced, waiting on them" value={money(owner.inFront)} />
                <Stat label="Under contract" value={money(owner.underContract)} />
                <div style={{ display: 'grid', gap: '0.15rem' }}>
                  <Stat label="They owe us now" value={money(owner.owed)} tone={owner.owed > 0 ? 'red' : undefined} />
                  {/* Of what they owe, where it stands with the architect (the big list, Board item 2). */}
                  {(owedSplit.certified > 0 || owedSplit.architect > 0) && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {[
                        owedSplit.certified > 0 ? `${money(owedSplit.certified)} certified, not paid` : null,
                        owedSplit.architect > 0 ? `${money(owedSplit.architect)} waiting on the architect` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </div>
                <Stat label="They are holding" value={money(owner.retainageHeld)} />
                {(interest.billed > 0 || interest.toBill > 0) && (
                  <div style={{ display: 'grid', gap: '0.15rem' }}>
                    <Stat label="Interest on late bills" value={money(interest.billed)} />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {[
                        interest.billed > 0 ? `${money(interest.paid)} paid` : null,
                        interest.billed - interest.paid > 0 ? `${money(interest.billed - interest.paid)} owed` : null,
                        interest.toBill > 0 ? `${money(interest.toBill)} built up, not billed yet` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                )}
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
                          <span style={{ color: 'var(--text-muted)' }}>
                            · {pkg?.trade} · asked by {partner?.company} on {shortDate(question.askedOn)}
                            {question.sentToArchitectOn ? ` · sent to them ${shortDate(question.sentToArchitectOn)}` : ''}
                          </span>
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
              {architect.notSent.length > 0 && (
                <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Not sent to them yet. These wait on us, so they do not count against {customer.name}.
                  </span>
                  {architect.notSent.map(({ project, question, days: waited }) => (
                    <div key={question.id}>
                      <Chip tone="amber">ours · {days(waited)}</Chip> {project.name}: {question.text}
                    </div>
                  ))}
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
                      <th style={th}>Customer</th>
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
            <Btn
              disabled={portalProjects.length === 0}
              onClick={() => setPortal(portalProjects.length === 1 ? (portalProjects[0]?.id ?? null) : 'pick')}
              title={
                portalProjects.length === 0
                  ? 'Nothing to show yet. Their portal opens once we win a job for them.'
                  : 'Their portal, as they see it: the contract, each bill with its lines and a Pay button, the work, and the papers.'
              }
            >
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
    {portal && (
      <OwnerPortalWindow
        state={state}
        customer={customer}
        projects={portalProjects}
        project={portalProject}
        dispatch={dispatch}
        onPick={setPortal}
        onClose={() => setPortal(null)}
      />
    )}
    </>
  )
}

/**
 * "See what they see": the owner's portal (the Owner Billing lane's panel) in a window over the
 * company window. One job opens straight to it; more than one asks which first. In the real
 * build this is the customer portal they already use for our bills.
 */
function OwnerPortalWindow({
  state,
  customer,
  projects,
  project,
  dispatch,
  onPick,
  onClose,
}: {
  state: GcState
  customer: GcCustomer
  projects: GcProject[]
  project: GcProject | null
  dispatch: Dispatch<GcAction>
  onPick: (id: string | null) => void
  onClose: () => void
}) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`What ${customer.name} sees`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: 10,
          width: 'min(26rem, 100%)',
          maxHeight: '92vh',
          overflowY: 'auto',
          border: '1px solid var(--border-strong)',
          padding: '0.6rem',
          display: 'grid',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontWeight: 700, flex: '1 1 auto' }}>{project ? `What ${customer.name} sees` : 'Which job?'}</span>
          {project && projects.length > 1 && (
            <Btn kind="quiet" onClick={() => onPick('pick')}>
              ← Their jobs
            </Btn>
          )}
          <Btn kind="quiet" onClick={onClose}>
            Close
          </Btn>
        </div>
        {project ? (
          <GcOwnerBillingPortal state={state} project={project} dispatch={dispatch} />
        ) : (
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {customer.name} has {projects.length} jobs with us. Their portal shows one at a time.
            </span>
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p.id)}
                style={{
                  textAlign: 'left',
                  padding: '0.55rem 0.7rem',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--surface)',
                  color: 'var(--text-base)',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {STAGE_WORDS[p.stage].word} · {p.address}
                </span>
              </button>
            ))}
          </div>
        )}
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
  // Our sent pay applications once any went, the made-up record before (the same choice as customerSummary).
  const billing = ownerMoney(project)
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
        {project.lostOn ? (
          <Chip tone="grey" title={lostWords(project)}>lost {shortDate(project.lostOn)}</Chip>
        ) : (
          <Chip tone={stage.tone}>{stage.word}</Chip>
        )}{' '}
        {due !== null && project.stage === 'pursuing' && !project.lostOn && <Chip tone={due <= 7 ? 'red' : 'amber'}>due {shortDate(project.bidDue)}</Chip>}{' '}
        {totals.holes.length > 0 && <Chip tone="red">{totals.holes.length} trades with no number</Chip>}
      </td>
      <td style={num}>{money(totals.price)}</td>
      <td style={num}>{billing ? money(billing.billed) : '—'}</td>
      <td style={num}>{billing ? money(billing.paid) : '—'}</td>
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
