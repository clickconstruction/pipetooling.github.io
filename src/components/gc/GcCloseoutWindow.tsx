import { useEffect, useState, type CSSProperties } from 'react'
import { Btn, Card, Chip, Stat, Why, input } from './gcUi'
import type { LinkAccess } from './GcDrawForms'
import { GcDrawPayApp } from './GcDrawPayApp'
import { GcPunchList, type PunchWrites } from './GcPunchList'
import { partnerBlockers } from '../../lib/gc/bench'
import { jobCloseout, ownCrewWork, ownerRetainagePaidOn, projectCloseout, TRADE_RETAINAGE_WAIT_DAYS, tradeRetainageOpensOn, type CloseoutRow } from '../../lib/gc/building'
import { punchCounts } from '../../lib/gc/buildingPunch'
import { finalCameInDraft, finalCameInMissing, type FinalCameIn } from '../../lib/gc/closeoutRows'
import type { DrawExtra } from '../../lib/gc/drawRows'
import { jobMargin } from '../../lib/gc/ownerBillingMargin'
import { generalConditionsWords, type OwnWorkCosts } from '../../lib/gc/ownWorkCost'
import type { Draw, GcProject, GcState } from '../../lib/gc/types'
import { money, shortDate } from '../../lib/gc/words'

/**
 * GC mode, the real build, the Building lane's U6d: closeout on real data, ported from the prototype's `GcCloseout.tsx`
 * (branch spike/gc-mode; the plan: to-dos/gc-mode/mockups/building-u6.md). Each trade's last steps, in order: every line
 * billed, we accept the work, their final pay application with a conditional final release of lien, the customer pays
 * us ours and 10 days pass, we approve and pay their retainage, then their unconditional final release. Our steps carry
 * the button. Theirs say who we wait on, and one that came by email or on paper is recorded here. Once every trade is
 * closed out, we close the job. The database's own functions check every press (the Building lane's U6c).
 */

export interface CloseoutWrites {
  /** Accept a trade's work: every line billed and its punch list done. */
  onAccept: (packageId: string) => void
  /** Their final pay application came by email or on paper. */
  onFinalCameIn: (d: FinalCameIn) => void
  /** Approve the retainage release, once the customer paid us ours and 10 days passed. */
  onApproveRelease: (packageId: string, drawId: string) => void
  /** Mark the approved release paid. */
  onPay: (packageId: string, drawId: string) => void
  /** Their unconditional final release came in, after we paid. */
  onWaiverIn: (packageId: string, drawId: string) => void
  /** Close the job once every trade is closed out. */
  onCloseJob: () => void
}

interface Props {
  /** The board with the trades' money, the customer's bills and the punch list laid over it. */
  state: GcState
  project: GcProject
  /** Each draw's file and who of ours recorded it (`drawExtras`). */
  extras?: Map<string, DrawExtra>
  /** Reads who can open a Drive link, for the warning under it. Absent: no check. */
  checkLink?: (url: string) => Promise<LinkAccess>
  /** The tick that emails the trade when we mark its release paid, the Draws window's own. Null: no tick shows. */
  emailTick?: { on: boolean; onChange: (on: boolean) => void } | null
  /** False while the customer's bills are being read, so their retainage on us is not known yet. */
  billsRead?: boolean
  writes: CloseoutWrites
  /** What a press works on: a trade's, a draw's or the job's id. */
  busy?: string | null
  problem?: string | null
  /** Opens Bill the customer, where the customer's payment of our retainage is recorded. Absent: no button. */
  onSeeBill?: () => void
  /** The punch list's presses (U3b-ii), shown under each trade's steps. Absent: no list. */
  punchWrites?: PunchWrites
  /** Our own work's Pipeline jobs as the page read them (O11b): general conditions' line. Absent: at their budget. */
  own?: OwnWorkCosts
  onClose: () => void
}

export function GcCloseoutWindow({ state, project, extras, checkLink, emailTick = null, billsRead = true, writes, busy = null, problem = null, onSeeBill, punchWrites, own, onClose }: Props) {
  // The final pay application open to read.
  const [looking, setLooking] = useState<{ row: CloseoutRow; draw: Draw } | null>(null)
  const c = projectCloseout(state, project)
  const job = jobCloseout(state, project)
  const punch = punchCounts(project)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      // Escape steps back from a pay application to closeout, then closes the window.
      if (looking) setLooking(null)
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, looking])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name}: Closeout`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(960px, 100%)', maxHeight: 'min(94vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name} · Closeout</div>
            <div data-closeout-lede style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              The last steps for each trade, then closing the job.
            </div>
          </div>
          <span style={{ flex: 1 }} />
          {emailTick && (
            <label data-closeout-email-tick style={{ fontSize: '0.85rem', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
              <input type="checkbox" checked={emailTick.on} onChange={(e) => emailTick.onChange(e.target.checked)} />
              Email the trade about what I press here
            </label>
          )}
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>

        <div style={{ padding: '0.8rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.9rem' }}>
          {problem && (
            <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
              {problem}
            </div>
          )}
          {looking && looking.row.partner && looking.row.pkg.sow ? (
            <GcDrawPayApp
              project={project}
              sow={looking.row.pkg.sow}
              partner={looking.row.partner}
              draw={looking.draw}
              extra={extras?.get(looking.draw.id)}
              onBack={() => setLooking(null)}
            />
          ) : (
            <>
              <Why>
                We hold back {c.rows[0]?.pkg.sow?.retainagePct ?? 10}% of every draw. That is retainage. A trade gets it back at the end, once every
                line is billed and we accept the work. It asks with a final pay application and a conditional final release of lien. We pay it{' '}
                {TRADE_RETAINAGE_WAIT_DAYS} days after the customer pays us ours. Then it signs the unconditional final release of lien and the
                trade is closed out. Once every trade is, we close the job.
              </Why>

              <OwnerRetainageCard project={project} today={state.today} billsRead={billsRead} onSeeBill={onSeeBill} />

              <Card>
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                  <Stat label="Held on the trades" value={money(c.held)} />
                  <Stat label="Paid back" value={money(c.released)} tone={c.released > 0 ? 'green' : undefined} />
                  <Stat label="Closed out" value={`${c.closed} of ${c.rows.length}`} tone={c.rows.length > 0 && c.closed === c.rows.length ? 'green' : undefined} />
                  {punch.total > 0 && (
                    <Stat label="Punch items open" value={`${punch.open + punch.fixed} of ${punch.total}`} tone={punch.open + punch.fixed === 0 ? 'green' : undefined} />
                  )}
                </div>
              </Card>

              <CloseJobCard job={job} busy={busy === project.id} onClose={writes.onCloseJob} />

              {c.rows.length === 0 && <Card>No trade has a signed statement of work yet. Closeout starts once one does.</Card>}

              {c.rows.map((row) => (
                <TradeCloseoutCard
                  key={row.pkg.id}
                  row={row}
                  project={project}
                  today={state.today}
                  checkLink={checkLink}
                  emailOn={emailTick?.on ?? false}
                  writes={writes}
                  busy={busy}
                  onSeeBill={onSeeBill}
                  punchWrites={punchWrites}
                  onLook={(draw) => setLooking({ row, draw })}
                />
              ))}

              {(c.notStarted.length > 0 || c.ours.length > 0) && (
                <div data-closeout-others style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {c.notStarted.map((pkg) => (
                    <div key={pkg.id}>
                      <strong style={{ color: 'var(--text-base)' }}>{pkg.trade}</strong>: the statement of work is not signed yet.
                    </div>
                  ))}
                  {c.ours.map((pkg) => (
                    <div key={pkg.id}>
                      <strong style={{ color: 'var(--text-base)' }}>{pkg.trade}</strong>: our own crew, {ownCrewWork(pkg)?.pct ?? 0}% done. Nothing is held. Its
                      closeout runs on the Pipeline.
                    </div>
                  ))}
                </div>
              )}
              {/* General conditions at what they cost (O11b), from the Pipeline job our number names for them. */}
              <div data-closeout-general-conditions style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {generalConditionsWords(jobMargin(state, project, own).generalConditionsCost)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * The customer's retainage on us, which each trade's waits on: we pay a trade 10 days after the customer pays our final
 * pay application (owner, 2026-10-02). Read from Bill the customer. Nothing to press here.
 */
function OwnerRetainageCard({ project, today, billsRead, onSeeBill }: { project: GcProject; today: string; billsRead: boolean; onSeeBill?: () => void }) {
  const paidOn = ownerRetainagePaidOn(project)
  const opensOn = tradeRetainageOpensOn(project)
  const owner = project.owner || 'The customer'
  return (
    <Card>
      <div data-closeout-owner style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.9rem' }}>
        <strong>The customer's retainage on us</strong>
        {!billsRead ? (
          <span style={{ color: 'var(--text-muted)' }}>Reading the customer's bills.</span>
        ) : paidOn ? (
          <span>
            {owner} paid it {shortDate(paidOn)}. We can pay the trades theirs {opensOn && opensOn > today ? `from ${shortDate(opensOn)}` : 'now'}.
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>
            {owner} still holds it. We pay the trades theirs {TRADE_RETAINAGE_WAIT_DAYS} days after the customer pays our final pay application.
          </span>
        )}
        {onSeeBill && !paidOn && (
          <Btn kind="quiet" onClick={onSeeBill}>
            Bill the customer
          </Btn>
        )}
      </div>
    </Card>
  )
}

/** Close the job once every trade is closed out (owner, 2026-10-02): it leaves Building for its own place on the board. */
function CloseJobCard({ job, busy, onClose }: { job: { ready: boolean; left: string[]; closedOn: string | null }; busy: boolean; onClose: () => void }) {
  if (job.closedOn) {
    return (
      <Card>
        <div data-closeout-job="closed">
          <Chip tone="green">job closed {shortDate(job.closedOn)}</Chip>
        </div>
      </Card>
    )
  }
  return (
    <Card>
      <div data-closeout-job={job.ready ? 'ready' : 'waits'} style={{ display: 'grid', gap: '0.4rem', fontSize: '0.875rem' }}>
        <div>
          <Btn kind="primary" disabled={!job.ready || busy} title={job.ready ? undefined : 'Every trade closes out first.'} onClick={onClose}>
            Close the job
          </Btn>
        </div>
        {job.ready ? (
          <span style={{ color: 'var(--text-muted)' }}>Every trade is closed out, our own crew is done and the customer paid our retainage.</span>
        ) : (
          <div style={{ color: 'var(--text-muted)', display: 'grid', gap: '0.15rem' }}>
            <span>Left before it can close:</span>
            <ul data-closeout-left style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.15rem' }}>
              {job.left.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  )
}

function TradeCloseoutCard({
  row,
  project,
  today,
  checkLink,
  emailOn,
  writes,
  busy,
  onSeeBill,
  punchWrites,
  onLook,
}: {
  row: CloseoutRow
  project: GcProject
  today: string
  checkLink?: (url: string) => Promise<LinkAccess>
  emailOn: boolean
  writes: CloseoutWrites
  busy: string | null
  onSeeBill?: () => void
  punchWrites?: PunchWrites
  onLook: (draw: Draw) => void
}) {
  const [cameIn, setCameIn] = useState(false)
  const { pkg, partner, closeout } = row
  const company = partner?.company ?? 'The company'
  const billed = closeout.steps[0]?.done ?? false
  const f = closeout.finalDraw
  const blockers = partner ? partnerBlockers(partner, today) : []
  const doneCount = closeout.steps.filter((s) => s.done).length
  // The work is accepted once every punch item on it is checked fixed (owner, 2026-10-03), as gc_accept_work holds.
  const left = punchCounts(project, pkg.id)
  const notChecked = left.open + left.fixed
  const acceptBlocked = notChecked > 0 ? `${notChecked} punch ${notChecked === 1 ? 'item is' : 'items are'} not checked fixed yet.` : null

  return (
    <Card>
      <div data-closeout-trade={pkg.id} style={{ display: 'grid', gap: '0.2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
          <div>
            <strong>{pkg.trade}</strong> <span style={{ color: 'var(--text-muted)' }}>{company}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
            {closeout.held > 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>We hold {money(closeout.held)}</span>}
            {closeout.closed ? (
              <Chip tone="green">closed out</Chip>
            ) : billed ? (
              <Chip tone="blue">
                {doneCount} of {closeout.steps.length} steps
              </Chip>
            ) : (
              <Chip tone="grey">still building</Chip>
            )}
          </div>
        </div>

        {!billed ? (
          <div data-closeout-not-billed style={{ marginTop: '0.3rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {closeout.steps[0]?.detail} Closeout starts when every line is billed.
          </div>
        ) : (
          <ol style={{ listStyle: 'none', margin: '0.55rem 0 0', padding: 0, display: 'grid', gap: '0.55rem' }}>
            {closeout.steps.map((step, i) => {
              const isNext = closeout.next?.key === step.key
              const state = step.done ? 'done' : isNext ? 'now' : 'wait'
              return (
                <li key={step.key} data-closeout-step={step.key} data-step-state={state} style={{ display: 'grid', gridTemplateColumns: '1.85rem minmax(0, 1fr)', gap: '0.65rem', alignItems: 'start' }}>
                  <span className="lienStep-dot" data-state={state} aria-hidden>
                    {step.done ? '✓' : i + 1}
                  </span>
                  <div style={{ display: 'grid', gap: '0.25rem', paddingTop: '0.2rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.9rem', color: state === 'wait' ? 'var(--text-muted)' : 'var(--text-strong)' }}>{step.label}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{step.who === 'office' ? 'us' : step.who === 'owner' ? 'the customer' : company}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{step.detail}</div>
                    {isNext && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                        {step.key === 'accepted' && (
                          <>
                            <Btn kind="primary" disabled={acceptBlocked !== null || busy === pkg.id} title={acceptBlocked ?? undefined} onClick={() => writes.onAccept(pkg.id)}>
                              Accept the work
                            </Btn>
                            {acceptBlocked && (
                              <span data-closeout-accept-held style={{ color: 'var(--text-amber-800)' }}>
                                {acceptBlocked}
                              </span>
                            )}
                            {emailOn && (
                              <span data-closeout-accept-email style={{ color: 'var(--text-muted)' }}>
                                {company} gets an email that we accepted its work.
                              </span>
                            )}
                          </>
                        )}
                        {step.key === 'finalApp' && (
                          <>
                            <span>Waiting on {company}.</span>
                            {closeout.canAskFinal && !cameIn && (
                              <Btn disabled={busy === pkg.id} onClick={() => setCameIn(true)}>
                                Their final pay application came by email
                              </Btn>
                            )}
                          </>
                        )}
                        {step.key === 'ownerReleased' && (
                          <>
                            <span>Waiting on the customer.</span>
                            {onSeeBill && (
                              <Btn kind="quiet" onClick={onSeeBill}>
                                Bill the customer
                              </Btn>
                            )}
                          </>
                        )}
                        {step.key === 'released' && f?.status === 'requested' && (
                          <>
                            <Btn kind="primary" disabled={blockers.length > 0 || busy === f.id} title={blockers.join(' ') || undefined} onClick={() => writes.onApproveRelease(pkg.id, f.id)}>
                              Approve the release
                            </Btn>
                            {blockers.length > 0 && (
                              <span data-closeout-blockers style={{ color: 'var(--text-red-700)' }}>
                                {blockers.join(' ')}
                              </span>
                            )}
                          </>
                        )}
                        {step.key === 'released' && f?.status === 'approved' && (
                          <>
                            <Btn kind="primary" disabled={busy === f.id} onClick={() => writes.onPay(pkg.id, f.id)}>
                              Mark paid
                            </Btn>
                            {emailOn && <span style={{ color: 'var(--text-muted)' }}>{company} gets an email that we paid it.</span>}
                          </>
                        )}
                        {step.key === 'finalWaiver' && f?.status === 'paid' && (
                          <>
                            <span>Waiting on {company}.</span>
                            <Btn disabled={busy === f.id} onClick={() => writes.onWaiverIn(pkg.id, f.id)}>
                              Their final release came in
                            </Btn>
                          </>
                        )}
                      </div>
                    )}
                    {step.key === 'finalApp' && f && (
                      <div>
                        <Btn kind="quiet" onClick={() => onLook(f)}>
                          Final pay application
                        </Btn>
                      </div>
                    )}
                    {step.key === 'finalApp' && cameIn && partner && pkg.sow && !f && (
                      <FinalCameInForm
                        company={company}
                        held={closeout.held}
                        start={finalCameInDraft(pkg.id, pkg.sow, partner)}
                        busy={busy === pkg.id}
                        checkLink={checkLink}
                        emailOn={emailOn}
                        onRecord={(d) => {
                          writes.onFinalCameIn(d)
                          setCameIn(false)
                        }}
                        onCancel={() => setCameIn(false)}
                      />
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        {punchWrites && <GcPunchList project={project} pkg={pkg} company={company} writes={punchWrites} busy={busy} />}
      </div>
    </Card>
  )
}

const field: CSSProperties = { ...input, width: '100%', minWidth: 0, boxSizing: 'border-box' }
const label: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' }

/** Their final pay application that came by email or on paper: the trade's words. It asks for the retainage we hold. */
function FinalCameInForm({
  company,
  held,
  start,
  busy,
  checkLink,
  emailOn = false,
  onRecord,
  onCancel,
}: {
  company: string
  held: number
  start: FinalCameIn
  busy: boolean
  checkLink?: (url: string) => Promise<LinkAccess>
  /** The email tick is on: the company gets an email that its final came in (the Portal's P5c-4). */
  emailOn?: boolean
  onRecord: (d: FinalCameIn) => void
  onCancel: () => void
}) {
  const [d, setD] = useState<FinalCameIn>(start)
  const [access, setAccess] = useState<LinkAccess>(null)
  const set = (patch: Partial<FinalCameIn>) => setD((x) => ({ ...x, ...patch }))
  const missing = finalCameInMissing(d)
  const check = (url: string) => {
    setAccess(null)
    if (!checkLink || !url.trim()) return
    void checkLink(url.trim())
      .then(setAccess)
      .catch(() => setAccess(null))
  }
  return (
    <div
      data-closeout-final-form
      style={{ marginTop: '0.3rem', padding: '0.7rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', display: 'grid', gap: '0.55rem', fontSize: '0.875rem' }}
    >
      <strong>A final pay application from {company} that came by email or on paper</strong>
      <div data-closeout-final-sum style={{ color: 'var(--text-muted)' }}>
        It asks for the <strong style={{ color: 'var(--text-base)' }}>{money(held)}</strong> we hold, with a conditional final release of lien.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '0.5rem' }}>
        <label style={{ display: 'grid', gap: '0.2rem' }}>
          <span style={label}>The day it runs to</span>
          <input type="date" value={d.periodTo} onChange={(e) => set({ periodTo: e.target.value })} style={field} />
        </label>
        <label style={{ display: 'grid', gap: '0.2rem' }}>
          <span style={label}>Their address</span>
          <input value={d.address} onChange={(e) => set({ address: e.target.value })} style={field} />
        </label>
        <label style={{ display: 'grid', gap: '0.2rem' }}>
          <span style={label}>Their license</span>
          <input value={d.license} onChange={(e) => set({ license: e.target.value })} style={field} />
        </label>
        <label style={{ display: 'grid', gap: '0.2rem' }}>
          <span style={label}>Signed by</span>
          <input value={d.signedBy} onChange={(e) => set({ signedBy: e.target.value })} style={field} />
        </label>
        <label style={{ display: 'grid', gap: '0.2rem' }}>
          <span style={label}>Their title</span>
          <input value={d.signedTitle} onChange={(e) => set({ signedTitle: e.target.value })} placeholder="Owner" style={field} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={d.fileName} onChange={(e) => set({ fileName: e.target.value })} placeholder="The file's name" aria-label="The file's name" style={{ ...input, flex: '1 1 12rem' }} />
        <input
          value={d.driveUrl}
          onChange={(e) => set({ driveUrl: e.target.value })}
          onBlur={(e) => check(e.target.value)}
          placeholder="Its Drive link"
          aria-label="Its Drive link"
          style={{ ...input, flex: '2 1 16rem' }}
        />
      </div>
      {access === 'restricted' && (
        <div data-closeout-link-hint style={{ fontSize: '0.8rem', color: 'var(--text-amber-800)' }}>
          Only people given access can open this link. Our office may not be one of them.
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={busy || missing !== null} title={missing ?? undefined} onClick={() => onRecord(d)}>
          Record it
        </Btn>
        <Btn kind="quiet" onClick={onCancel}>
          Cancel
        </Btn>
      </div>
      {emailOn && (
        <div data-closeout-final-email style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {company} gets an email that its final pay application came in.
        </div>
      )}
    </div>
  )
}
