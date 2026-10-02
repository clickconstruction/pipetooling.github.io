import { Fragment, useState, type Dispatch } from 'react'
import {
  bidIsStale,
  bidsIn,
  carriedAmount,
  compareBids,
  currentRev,
  daysUntil,
  leveledTotal,
  lowLeveled,
  money,
  packageCoverage,
  partnerBlockers,
  partnerById,
  planLabel,
  planRecipients,
  proposalTotals,
  shortDate,
  sowMoney,
  thousands,
  travelFor,
  travelWords,
  type GcAction,
  type GcProject,
  type GcState,
  type Includes,
  type Invite,
  type Partner,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
import { AskThread } from './GcAskThread'
import { GcNewPlansWindow } from './GcNewPlans'
import { Btn, Card, Chip, Stat, Why, input, num, td, th, type Tone } from './gcUi'

/** GC mode design spike: the office's side of one project. */

export interface GcPaneProps {
  state: GcState
  project: GcProject
  dispatch: Dispatch<GcAction>
  /** Show this trade partner's portal beside the office's side. */
  onSeePortal?: (partnerId: string) => void
  /** Open the map of companies for one trade, to line up quotes. */
  onMap?: (packageId: string) => void
  /** Open a trade's leveling sheet when the tab mounts (the map's "Level the quotes"). */
  openPackageId?: string | null
}

const INVITE_WORDS: Record<Invite['status'], { tone: Tone; word: string }> = {
  invited: { tone: 'grey', word: 'not opened' },
  opened: { tone: 'blue', word: 'looking' },
  bid: { tone: 'green', word: 'bid in' },
  declined: { tone: 'red', word: 'passed' },
}

const INCLUDES_WORDS: Record<Includes, { tone: Tone; word: string }> = {
  yes: { tone: 'green', word: 'included' },
  no: { tone: 'red', word: 'left out' },
  unclear: { tone: 'amber', word: 'not clear' },
}

export function PaperworkChips({ partner, today }: { partner: Partner; today: string }) {
  const coiOk = partner.coiExpires !== null && daysUntil(partner.coiExpires, today) >= 0
  return (
    <span style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap' }}>
      <Chip tone={partner.msa === 'signed' ? 'green' : partner.msa === 'sent' ? 'amber' : 'red'}>
        {partner.msa === 'signed' ? 'Master agreement signed' : partner.msa === 'sent' ? 'Master agreement sent' : 'No master agreement'}
      </Chip>
      <Chip tone={coiOk ? 'green' : 'red'}>
        {partner.coiExpires ? (coiOk ? `Insured to ${shortDate(partner.coiExpires)}` : `Insurance expired ${shortDate(partner.coiExpires)}`) : 'No insurance on file'}
      </Chip>
      <Chip tone={partner.w9 ? 'green' : 'red'}>{partner.w9 ? 'W-9' : 'No W-9'}</Chip>
    </span>
  )
}

// ---------------------------------------------------------------------------------------------
// Packages: who is covering each trade, and the leveling sheet
// ---------------------------------------------------------------------------------------------

export function GcPackagesTab({ state, project, dispatch, onSeePortal, onMap, openPackageId }: GcPaneProps) {
  const [openId, setOpenId] = useState<string | null>(openPackageId ?? null)
  const counts = { carried: 0, toLevel: 0, waiting: 0, empty: 0 }
  for (const p of project.packages) {
    const c = packageCoverage(p)
    if (carriedAmount(p) !== null) counts.carried += 1
    else if (c === 'bids') counts.toLevel += 1
    else if (c === 'waiting') counts.waiting += 1
    else counts.empty += 1
  }

  return (
    <div>
      <Why>
        One row for each trade on the job. Invite trade partners, watch their bids come in from their portals, then
        compare the bids and carry a number. Of {project.packages.length} trades, {counts.carried} carry a number,{' '}
        {counts.toLevel} have bids to compare, {counts.waiting} are waiting on bids and {counts.empty} have no one
        invited.
      </Why>
      <Card style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Trade</th>
              <th style={th}>Who we asked</th>
              <th style={{ ...th, textAlign: 'right' }}>Our budget</th>
              <th style={{ ...th, textAlign: 'right' }} title="The lowest bid once each bid covers the same work: the bid plus the cost of anything it leaves out.">
                Lowest, all in
              </th>
              <th style={th}>We are carrying</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {project.packages.map((pkg) => {
              const low = lowLeveled(pkg)
              const open = openId === pkg.id
              return (
                <Fragment key={pkg.id}>
                  <tr style={{ background: open ? 'var(--bg-blue-tint)' : undefined }}>
                    <td style={{ ...td, fontWeight: 600 }}>{pkg.trade}</td>
                    <td style={td}>
                      {pkg.selfPerform ? (
                        <Chip tone="violet">We do this ourselves</Chip>
                      ) : pkg.invites.length === 0 ? (
                        <Chip tone="red">No one invited</Chip>
                      ) : (
                        <span style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '0.5rem', rowGap: '0.3rem', alignItems: 'center' }}>
                          {pkg.invites.map((inv) => {
                            const words = INVITE_WORDS[inv.status]
                            const partner = partnerById(state, inv.partnerId)
                            const stale = bidIsStale(project, pkg, inv)
                            const leveled = leveledTotal(pkg, inv)
                            return (
                              <Fragment key={inv.id}>
                                <span
                                  title={
                                    inv.bid && leveled !== null && leveled !== inv.bid.amount
                                      ? `Their bid as sent: ${money(inv.bid.amount)}. With what it leaves out added, it is ${money(leveled)}.`
                                      : inv.bid
                                        ? `Their bid as sent: ${money(inv.bid.amount)}.`
                                        : undefined
                                  }
                                  style={{
                                    textAlign: 'right',
                                    fontVariantNumeric: 'tabular-nums',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    color: inv.bid ? 'var(--text-base)' : 'var(--text-faint-300)',
                                  }}
                                >
                                  {inv.bid ? (
                                    <>
                                      ${thousands(inv.bid.amount)}
                                      <span style={{ fontSize: '0.7em', fontWeight: 700, marginLeft: 1 }}>K</span>
                                    </>
                                  ) : (
                                    '—'
                                  )}
                                </span>
                                <span>
                                  <Chip tone={stale ? 'amber' : words.tone} title={stale ? 'Their bid is on an older set of plans.' : undefined}>
                                    {partner?.company} · {stale ? 'old plans' : words.word}
                                  </Chip>
                                </span>
                              </Fragment>
                            )
                          })}
                        </span>
                      )}
                    </td>
                    <td style={num}>{money(pkg.budget)}</td>
                    <td style={num}>
                      {low ? (
                        <span style={{ color: low.total > pkg.budget ? 'var(--text-red-700)' : 'var(--text-green-700)' }}>
                          {money(low.total)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>none yet</span>
                      )}
                    </td>
                    <td style={td}>
                      <CarriedWords state={state} pkg={pkg} />
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {pkg.selfPerform ? (
                        <Btn kind="quiet" onClick={() => setOpenId(open ? null : pkg.id)}>
                          {open ? 'Close' : `Open ${pkg.selfPerform.ref}`}
                        </Btn>
                      ) : (
                        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>
                          <Btn kind={open ? 'plain' : 'primary'} onClick={() => setOpenId(open ? null : pkg.id)}>
                            {open ? 'Close' : bidsIn(pkg).length > 0 ? 'Compare bids' : 'Invite'}
                          </Btn>
                          {onMap && <Btn kind="quiet" onClick={() => onMap(pkg.id)} title="See the companies in this trade on a map, closest first.">On a map</Btn>}
                        </span>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={6} style={{ padding: '0.9rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                        {pkg.selfPerform ? (
                          <SelfPerformPanel pkg={pkg} />
                        ) : (
                          <LevelPanel state={state} project={project} pkg={pkg} dispatch={dispatch} onSeePortal={onSeePortal} />
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function CarriedWords({ state, pkg }: { state: GcState; pkg: TradePackage }) {
  const amount = carriedAmount(pkg)
  if (pkg.selfPerform) return <span>{money(pkg.selfPerform.value)} · our own bid {pkg.selfPerform.ref}</span>
  if (amount === null) return <Chip tone="red">Nothing. A hole in our number.</Chip>
  if (pkg.carried === 'plug') return <span>{money(amount)} · <Chip tone="amber">our budget, no bid</Chip></span>
  const invite = pkg.invites.find((i) => i.id === (pkg.awardedInviteId ?? pkg.carried))
  const partner = invite ? partnerById(state, invite.partnerId) : undefined
  return (
    <span>
      {money(amount)} · {partner?.company} {pkg.awardedInviteId && <Chip tone="green">awarded</Chip>}
    </span>
  )
}

function SelfPerformPanel({ pkg }: { pkg: TradePackage }) {
  if (!pkg.selfPerform) return null
  return (
    <div>
      <strong>{pkg.trade} is ours.</strong> {pkg.selfPerform.note} Its number flows into this project from{' '}
      <strong>{pkg.selfPerform.ref}</strong>: counts, takeoff, labor and pricing all live where they do today.
      <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        In the real build this row would open that bid in Trades mode. It is the bridge between the two modes.
      </div>
    </div>
  )
}

function LevelPanel({ state, project, pkg, dispatch, onSeePortal }: GcPaneProps & { pkg: TradePackage }) {
  const [pick, setPick] = useState('')
  const bidders = bidsIn(pkg)
  const waiting = pkg.invites.filter((i) => i.bid === null)
  const invitedIds = new Set(pkg.invites.map((i) => i.partnerId))
  const candidates = state.partners.filter((p) => p.trades.includes(pkg.trade) && !invitedIds.has(p.id))
  const rev = currentRev(project)
  const low = lowLeveled(pkg)
  const comparison = compareBids(state, project, pkg)
  const ids = { projectId: project.id, packageId: pkg.id }

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>Invite a trade partner:</strong>
        <select value={pick} onChange={(e) => setPick(e.target.value)} style={input}>
          <option value="">{candidates.length > 0 ? 'Pick a company' : `No more ${pkg.trade.toLowerCase()} partners in the directory`}</option>
          {candidates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.company} · bid {p.bids} of {p.invited} asks
              {travelWords(travelFor(state, p, project), p) ? ` · ${travelWords(travelFor(state, p, project), p)}` : ''}
            </option>
          ))}
        </select>
        <Btn
          kind="primary"
          disabled={!pick}
          onClick={() => {
            dispatch({ type: 'invite', ...ids, partnerId: pick })
            setPick('')
          }}
        >
          Send invitation
        </Btn>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          They get a portal link with the plans, this scope and the due date.
        </span>
      </div>

      {waiting.length > 0 && (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {waiting.map((inv) => {
            const partner = partnerById(state, inv.partnerId)
            if (!partner) return null
            const words = INVITE_WORDS[inv.status]
            return (
              <div key={inv.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600 }}>{partner.company}</span>
                <Chip tone={words.tone}>{words.word}</Chip>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  asked {shortDate(inv.invitedOn)} · plans: {planLabel(project, inv.seenRev)}
                </span>
                {inv.status !== 'declined' && (
                  <Btn kind="quiet" onClick={() => dispatch({ type: 'nudge', ...ids, inviteId: inv.id, about: `your ${pkg.trade} number is due ${shortDate(project.bidDue)}.` })}>
                    Nudge
                  </Btn>
                )}
                {onSeePortal && <Btn kind="quiet" onClick={() => onSeePortal(partner.id)}>See their portal</Btn>}
                {inv.status !== 'declined' && (
                  <div style={{ flexBasis: '100%', paddingLeft: '0.75rem', borderLeft: '2px solid var(--border)' }}>
                    <AskThread state={state} project={project} pkg={pkg} invite={inv} partner={partner} dispatch={dispatch} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {bidders.length === 0 ? (
        <div style={{ color: 'var(--text-muted)' }}>
          No bids yet. Open the trade&rsquo;s portal and submit one as them to see the comparison fill in.
        </div>
      ) : (
        <>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', display: 'grid', gap: '0.35rem' }}>
          <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            What these bids really cost
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            A bid that leaves work out is not the low bid. Put a cost on the missing work and compare the totals.
          </div>
          {comparison.lines.map((line) => (
            <div key={line.inviteId} style={{ fontSize: '0.9rem' }}>
              {line.text}
            </div>
          ))}
          <div style={{ fontWeight: 700, color: comparison.complete ? 'var(--text-green-700)' : 'var(--text-amber-700)' }}>{comparison.conclusion}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
            <thead>
              <tr>
                <th style={th}>Side by side</th>
                {bidders.map((inv) => (
                  <th key={inv.id} style={{ ...th, textTransform: 'none', fontSize: '0.85rem', color: 'var(--text-strong)' }}>
                    {partnerById(state, inv.partnerId)?.company}
                    {onSeePortal && (
                      <div style={{ fontWeight: 400 }}>
                        <Btn kind="quiet" onClick={() => onSeePortal(inv.partnerId)}>See their portal</Btn>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={td}>Their bid, as sent</td>
                {bidders.map((inv) => (
                  <td key={inv.id} style={num}>{money(inv.bid?.amount ?? 0)}</td>
                ))}
              </tr>
              <tr>
                <td colSpan={bidders.length + 1} style={{ ...td, fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-subtle)' }}>
                  Is it in their price?
                </td>
              </tr>
              {pkg.scope.map((item) => (
                <tr key={item.id}>
                  <td style={td}>{item.label}</td>
                  {bidders.map((inv) => {
                    const state_ = inv.bid?.includes[item.id] ?? 'unclear'
                    const words = INCLUDES_WORDS[state_]
                    return (
                      <td key={inv.id} style={td}>
                        {state_ === 'yes' ? (
                          <span style={{ color: 'var(--text-green-700)' }}>✓ in their price</span>
                        ) : (
                          <Chip tone={words.tone}>{words.word}</Chip>
                        )}
                        {state_ !== 'yes' && (
                          <label style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            cost to cover it ${' '}
                            <input
                              type="number"
                              min={0}
                              step={500}
                              value={inv.bid?.plugs[item.id] ?? 0}
                              onChange={(e) =>
                                dispatch({ type: 'setPlug', ...ids, inviteId: inv.id, scopeId: item.id, amount: Number(e.target.value) || 0 })
                              }
                              style={{ ...input, width: '6rem' }}
                              aria-label={`Cost to cover ${item.label}`}
                            />
                          </label>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 700 }}>
                  All in
                  <div style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-muted)' }}>their bid plus the missing work</div>
                </td>
                {bidders.map((inv) => {
                  const total = leveledTotal(pkg, inv) ?? 0
                  const line = comparison.lines.find((l) => l.inviteId === inv.id)
                  return (
                    <td key={inv.id} style={{ ...num, fontWeight: 700 }}>
                      {money(total)}{' '}
                      {line && !line.complete ? (
                        <Chip tone="amber">needs a cost</Chip>
                      ) : (
                        comparison.complete && low?.invite.id === inv.id && <Chip tone="green">lowest</Chip>
                      )}
                    </td>
                  )
                })}
              </tr>
              <tr>
                <td style={td}>Against our budget of {money(pkg.budget)}</td>
                {bidders.map((inv) => {
                  const diff = (leveledTotal(pkg, inv) ?? 0) - pkg.budget
                  return (
                    <td key={inv.id} style={{ ...num, color: diff > 0 ? 'var(--text-red-700)' : 'var(--text-green-700)' }}>
                      {diff > 0 ? `${money(diff)} over` : `${money(-diff)} under`}
                    </td>
                  )
                })}
              </tr>
              <tr>
                <td style={td}>The drive to {project.town}</td>
                {bidders.map((inv) => {
                  const partner = partnerById(state, inv.partnerId)
                  if (!partner) return <td key={inv.id} style={td} />
                  const travel = travelFor(state, partner, project)
                  if (travel.miles === null) {
                    return <td key={inv.id} style={{ ...td, color: 'var(--text-muted)' }}>coverage not set</td>
                  }
                  return (
                    <td key={inv.id} style={td}>
                      <Chip tone={travel.inZone ? 'grey' : 'red'}>
                        {travel.inZone ? `${travel.miles} mi from ${partner.base}` : travelWords(travel, partner)}
                      </Chip>
                    </td>
                  )
                })}
              </tr>
              <tr>
                <td style={td}>Plans they priced</td>
                {bidders.map((inv) => {
                  const stale = bidIsStale(project, pkg, inv)
                  return (
                    <td key={inv.id} style={td}>
                      <Chip tone={stale ? 'amber' : 'green'}>{planLabel(project, inv.bid?.basedOnRev ?? null)}</Chip>
                      {stale && (
                        <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--text-amber-800)' }}>
                          {planLabel(project, rev)} changed this trade.{' '}
                          <Btn kind="quiet" onClick={() => dispatch({ type: 'nudge', ...ids, inviteId: inv.id, about: `please confirm your ${pkg.trade} number on ${planLabel(project, rev)}.` })}>
                            Ask them to confirm
                          </Btn>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
              <tr>
                <td style={td}>Their note</td>
                {bidders.map((inv) => (
                  <td key={inv.id} style={{ ...td, maxWidth: '16rem', color: 'var(--text-600)' }}>{inv.bid?.note || 'None.'}</td>
                ))}
              </tr>
              <tr>
                <td style={td}>Paperwork</td>
                {bidders.map((inv) => {
                  const partner = partnerById(state, inv.partnerId)
                  return (
                    <td key={inv.id} style={{ ...td, maxWidth: '16rem' }}>
                      {partner && <PaperworkChips partner={partner} today={state.today} />}
                    </td>
                  )
                })}
              </tr>
              <tr>
                <td style={{ ...td, borderBottom: 'none' }} />
                {bidders.map((inv) => {
                  const carried = pkg.carried === inv.id
                  const awarded = pkg.awardedInviteId === inv.id
                  return (
                    <td key={inv.id} style={{ ...td, borderBottom: 'none' }}>
                      {awarded ? (
                        <Chip tone="green">Awarded</Chip>
                      ) : project.stage === 'pursuing' ? (
                        <Btn kind={carried ? 'plain' : 'primary'} onClick={() => dispatch({ type: 'carry', ...ids, carried: carried ? null : inv.id })}>
                          {carried ? 'Carrying. Stop' : 'Carry this number'}
                        </Btn>
                      ) : (
                        <Btn kind="primary" disabled={pkg.awardedInviteId !== null} onClick={() => dispatch({ type: 'award', ...ids, inviteId: inv.id })}>
                          Award and draft the statement of work
                        </Btn>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
        </>
      )}

      {project.stage === 'pursuing' && (
        <div>
          <Btn onClick={() => dispatch({ type: 'carry', ...ids, carried: pkg.carried === 'plug' ? null : 'plug' })}>
            {pkg.carried === 'plug' ? 'Stop carrying our budget' : `Carry our budget of ${money(pkg.budget)} instead`}
          </Btn>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Plans: the sets, and who has the latest one
// ---------------------------------------------------------------------------------------------

export function GcPlansTab({ state, project, dispatch }: GcPaneProps) {
  const [adding, setAdding] = useState(false)
  const rev = currentRev(project)
  const sets = [...project.planSets].sort((a, b) => b.rev - a.rev)
  const newest = sets[0]
  const emailed = new Map((newest?.sentTo ?? []).map((x) => [x.partnerId, x]))
  const rows = planRecipients(state, project, newest?.touches ?? [])

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Why>
        When a new set comes in, write down what changed and the companies who need it are emailed. Every portal then
        shows the newest set. The table says who was told, who has opened it, and whose number still needs confirming.
      </Why>
      <div>
        <Btn kind="primary" onClick={() => setAdding(true)}>A new set of plans came in</Btn>
      </div>
      {adding && <GcNewPlansWindow state={state} project={project} dispatch={dispatch} onClose={() => setAdding(false)} />}

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))' }}>
        {sets.map((s) => (
          <Card key={s.rev}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
              <strong>{s.label}</strong>
              {s.rev === rev ? <Chip tone="green">current</Chip> : <Chip tone="grey">replaced</Chip>}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Issued {shortDate(s.issuedOn)}
              {s.sentTo && s.sentTo.length > 0
                ? ` · emailed to ${s.sentTo.length} ${s.sentTo.length === 1 ? 'company' : 'companies'}, ${s.sentTo.filter((x) => x.touched).length} told it changes their trade`
                : ''}
            </div>
            <p style={{ margin: '0.5rem 0 0', whiteSpace: 'pre-wrap' }}>{s.note}</p>
            {s.changedSheets.length > 0 && (
              <div style={{ marginTop: '0.4rem', fontSize: '0.85rem' }}>
                Sheets changed: {s.changedSheets.join(', ')}
                <br />
                Trades it changes:{' '}
                {s.touches.map((id) => project.packages.find((p) => p.id === id)?.trade ?? id).join(', ') || 'none named'}
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Trade</th>
              <th style={th}>Trade partner</th>
              <th style={th}>Told about {newest?.label}</th>
              <th style={th}>Opened it</th>
              <th style={th}>Their number</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td style={{ ...td, color: 'var(--text-muted)' }} colSpan={6}>No company is on this project yet.</td>
              </tr>
            )}
            {rows
              .sort((a, b) => project.packages.indexOf(a.pkg) - project.packages.indexOf(b.pkg))
              .map(({ partner, pkg, invite: inv, touched }) => {
                const sent = emailed.get(partner.id)
                const opened = inv.seenRev !== null && inv.seenRev >= rev
                const stale = bidIsStale(project, pkg, inv)
                const chase = !opened || stale
                return (
                  <tr key={inv.id} style={{ background: touched ? 'var(--bg-amber-tint)' : undefined }}>
                    <td style={td}>
                      {pkg.trade} {touched && <Chip tone="amber">changed</Chip>}
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>{partner.company}</td>
                    <td style={td}>
                      {rev === 0 ? (
                        <span style={{ color: 'var(--text-muted)' }}>with their invitation</span>
                      ) : sent ? (
                        <Chip tone="green">emailed {shortDate(sent.on)}</Chip>
                      ) : (
                        <Chip tone="red">not emailed</Chip>
                      )}
                    </td>
                    <td style={td}>
                      <Chip tone={opened ? 'green' : inv.seenRev === null ? 'red' : 'amber'}>
                        {opened ? 'opened' : inv.seenRev === null ? 'never opened the plans' : `still on ${planLabel(project, inv.seenRev)}`}
                      </Chip>
                    </td>
                    <td style={td}>
                      {!inv.bid ? (
                        <span style={{ color: 'var(--text-muted)' }}>no bid yet</span>
                      ) : stale ? (
                        <Chip tone="amber">{money(inv.bid.amount)} · priced on {planLabel(project, inv.bid.basedOnRev)} · needs confirming</Chip>
                      ) : (
                        <Chip tone="green">{money(inv.bid.amount)} · good on {planLabel(project, inv.bid.basedOnRev)}</Chip>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {chase &&
                        (inv.nudgedOn === state.today ? (
                          <Chip tone="blue">nudged today</Chip>
                        ) : (
                          <Btn
                            kind="quiet"
                            onClick={() =>
                              dispatch({
                                type: 'nudge',
                                projectId: project.id,
                                packageId: pkg.id,
                                inviteId: inv.id,
                                about: `${planLabel(project, rev)} is out. Please open it${stale ? ' and confirm your number' : ''}.`,
                              })
                            }
                          >
                            Nudge
                          </Btn>
                        ))}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Our number: what we carry for each trade, and the price to the owner
// ---------------------------------------------------------------------------------------------

export function GcNumberTab({ state, project, dispatch }: GcPaneProps) {
  const totals = proposalTotals(project)
  const field = (label: string, key: 'generalConditions' | 'contingencyPct' | 'feePct', suffix: string) => (
    <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
      {label}
      <span>
        <input
          type="number"
          min={0}
          step={key === 'generalConditions' ? 1000 : 0.5}
          value={project[key]}
          onChange={(e) => dispatch({ type: 'setMarkup', projectId: project.id, field: key, value: Number(e.target.value) || 0 })}
          style={{ ...input, width: '8rem' }}
        />{' '}
        {suffix}
      </span>
    </label>
  )

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Why>
        The trades we carry, plus our own costs and fee, make the price we give {project.owner}. A trade with no
        number is a hole. A trade on our own budget is a risk we are taking.
      </Why>
      <Card>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Stat label="Trades" value={money(totals.trades)} />
          <Stat label="General conditions" value={money(totals.generalConditions)} />
          <Stat label={`Contingency ${project.contingencyPct}%`} value={money(totals.contingency)} />
          <Stat label={`Fee ${project.feePct}%`} value={money(totals.fee)} />
          <Stat label={`Price to ${project.owner}`} value={money(totals.price)} tone={totals.holes.length > 0 ? 'red' : 'green'} />
        </div>
        {(totals.holes.length > 0 || totals.plugged.length > 0) && (
          <div style={{ marginTop: '0.7rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {totals.holes.map((p) => (
              <Chip key={p.id} tone="red">{p.trade}: no number</Chip>
            ))}
            {totals.plugged.map((p) => (
              <Chip key={p.id} tone="amber">{p.trade}: our budget, no bid</Chip>
            ))}
          </div>
        )}
        <div style={{ marginTop: '0.9rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {field('General conditions', 'generalConditions', 'dollars')}
          {field('Contingency', 'contingencyPct', '%')}
          {field('Fee', 'feePct', '%')}
          {project.stage === 'pursuing' && project.ourBidSentOn === null && (
            <Btn onClick={() => dispatch({ type: 'markBidSent', projectId: project.id })}>We sent our bid</Btn>
          )}
          {project.stage === 'pursuing' && project.ourBidSentOn !== null && (
            <Chip tone="green">our bid went in {shortDate(project.ourBidSentOn)}</Chip>
          )}
          {project.stage === 'pursuing' && (
            <Btn kind="primary" onClick={() => dispatch({ type: 'markWon', projectId: project.id })}>
              We won this. Start buyout
            </Btn>
          )}
        </div>
      </Card>
      <Card style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Trade</th>
              <th style={th}>Where the number comes from</th>
              <th style={{ ...th, textAlign: 'right' }}>Our budget</th>
              <th style={{ ...th, textAlign: 'right' }}>Carried</th>
            </tr>
          </thead>
          <tbody>
            {project.packages.map((pkg) => {
              const amount = carriedAmount(pkg)
              return (
                <tr key={pkg.id}>
                  <td style={{ ...td, fontWeight: 600 }}>{pkg.trade}</td>
                  <td style={td}><CarriedWords state={state} pkg={pkg} /></td>
                  <td style={num}>{money(pkg.budget)}</td>
                  <td style={{ ...num, fontWeight: 600 }}>{amount === null ? '—' : money(amount)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Contracts: one master agreement per company, one statement of work per trade per project
// ---------------------------------------------------------------------------------------------

export function GcContractsTab({ state, project, dispatch }: GcPaneProps) {
  const rows = project.packages.filter((p) => !p.selfPerform)
  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <Why>
        A trade partner signs our master agreement once. After that each job is a short statement of work under it:
        the scope, the price, the schedule of values and the plans it is based on. A statement of work cannot go out
        until the master agreement, insurance and W-9 are in.
      </Why>
      {project.stage === 'pursuing' && (
        <Card style={{ background: 'var(--bg-amber-tint)' }}>
          This project is not won yet. Contracts open at buyout. Go to <strong>Our number</strong> and press{' '}
          <em>We won this</em> to play the rest.
        </Card>
      )}
      {rows.map((pkg) => {
        const inviteId = pkg.awardedInviteId ?? (pkg.carried !== 'plug' ? pkg.carried : null)
        const inv = pkg.invites.find((i) => i.id === inviteId)
        const partner = inv ? partnerById(state, inv.partnerId) : undefined
        const ids = { projectId: project.id, packageId: pkg.id }
        if (!inv || !partner) {
          return (
            <Card key={pkg.id}>
              <strong>{pkg.trade}</strong> <Chip tone="red">no trade partner picked</Chip>
            </Card>
          )
        }
        const blockers = partnerBlockers(partner, state.today)
        const sow = pkg.sow
        return (
          <Card key={pkg.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <div>
                <strong>{pkg.trade}</strong> · {partner.company}{' '}
                {sow ? (
                  <Chip tone={sow.status === 'signed' ? 'green' : sow.status === 'sent' ? 'amber' : 'grey'}>
                    Statement of work {sow.status === 'signed' ? `signed ${shortDate(sow.signedOn)}` : sow.status === 'sent' ? 'waiting on their signature' : 'drafted'}
                  </Chip>
                ) : (
                  <Chip tone="grey">carried, not awarded</Chip>
                )}
              </div>
              <PaperworkChips partner={partner} today={state.today} />
            </div>

            {!sow && project.stage !== 'pursuing' && (
              <div style={{ marginTop: '0.6rem' }}>
                <Btn kind="primary" onClick={() => dispatch({ type: 'award', ...ids, inviteId: inv.id })}>
                  Award at {money(leveledTotal(pkg, inv) ?? 0)} and draft the statement of work
                </Btn>
              </div>
            )}

            {sow && (
              <div style={{ marginTop: '0.7rem', display: 'grid', gap: '0.6rem' }}>
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                  <Stat label="Price" value={money(sow.price)} />
                  <Stat label="Retainage" value={`${sow.retainagePct}%`} />
                  <Stat label="Based on" value={planLabel(project, sow.basedOnRev)} />
                </div>
                <div style={{ fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Schedule of values: </span>
                  {sow.sov.map((l) => `${l.label} ${money(l.amount)}`).join(' · ')}
                </div>
                {sow.status === 'draft' && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {partner.msa === 'none' && (
                      <Btn onClick={() => dispatch({ type: 'sendMsa', partnerId: partner.id })}>Send the master agreement</Btn>
                    )}
                    <Btn
                      kind="primary"
                      disabled={blockers.length > 0}
                      title={blockers.join(' ')}
                      onClick={() => dispatch({ type: 'sendSow', ...ids })}
                    >
                      Send to their portal to sign
                    </Btn>
                    {blockers.length > 0 && (
                      <span style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>Cannot send yet. {blockers.join(' ')}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Draws: what each trade reports, asks for, and has been paid
// ---------------------------------------------------------------------------------------------

export function GcDrawsTab({ state, project, dispatch }: GcPaneProps) {
  const signed = project.packages.filter((p) => p.sow?.status === 'signed')
  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <Why>
        A trade reports percent done on each line of their statement of work, then asks for a draw from their portal.
        Their conditional lien waiver comes with the ask. We approve, hold retainage and pay. The unconditional
        waiver follows the payment.
      </Why>
      {signed.length === 0 && <Card>No signed statement of work on this project yet.</Card>}
      {signed.map((pkg) => {
        const sow = pkg.sow
        const inv = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
        const partner = inv ? partnerById(state, inv.partnerId) : undefined
        if (!sow || !partner) return null
        const m = sowMoney(sow)
        const blockers = partnerBlockers(partner, state.today)
        const ids = { projectId: project.id, packageId: pkg.id }
        return (
          <Card key={pkg.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div><strong>{pkg.trade}</strong> · {partner.company}</div>
              <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap' }}>
                <Stat label="Contract" value={money(sow.price)} />
                <Stat label="Billed" value={money(m.billed)} />
                <Stat label="Paid" value={money(m.paid)} />
                <Stat label="Retainage held" value={money(m.retainageHeld)} />
                <Stat label="Left to bill" value={money(sow.price - m.billed)} />
              </div>
            </div>
            <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.7rem' }}>
              {sow.sov.map((l) => (
                <div key={l.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(8rem, 14rem) 1fr auto', gap: '0.6rem', alignItems: 'center', fontSize: '0.875rem' }}>
                  <span>{l.label} · {money(l.amount)}</span>
                  <span
                    title={`Billed ${l.pctBilled}%, reported ${l.pctReported}%`}
                    style={{ position: 'relative', height: 10, borderRadius: 5, background: 'var(--bg-muted)', overflow: 'hidden' }}
                  >
                    <span style={{ position: 'absolute', inset: 0, width: `${l.pctReported}%`, background: '#93c5fd' }} />
                    <span style={{ position: 'absolute', inset: 0, width: `${l.pctBilled}%`, background: '#16a34a' }} />
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    reported {l.pctReported}% · billed {l.pctBilled}%
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '0.7rem', display: 'grid', gap: '0.35rem' }}>
              {sow.draws.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No draw asked for yet.</span>}
              {sow.draws.map((d) => (
                <div key={d.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                  <strong>Draw {d.number}</strong>
                  <span>{shortDate(d.requestedOn)}</span>
                  <span>{money(d.gross)} less {money(d.retainage)} held = <strong>{money(d.net)}</strong></span>
                  <Chip tone={d.status === 'paid' ? 'green' : d.status === 'approved' ? 'blue' : 'amber'}>
                    {d.status === 'requested' ? 'waiting on us' : d.status}
                  </Chip>
                  <Chip tone={d.waiver === 'unconditional' ? 'green' : d.status === 'paid' ? 'amber' : 'grey'}>
                    {d.waiver === 'unconditional' ? 'unconditional waiver in' : d.status === 'paid' ? 'unconditional waiver owed' : 'conditional waiver in'}
                  </Chip>
                  {d.status === 'requested' && (
                    <>
                      <Btn kind="primary" disabled={blockers.length > 0} title={blockers.join(' ')} onClick={() => dispatch({ type: 'approveDraw', ...ids, drawId: d.id })}>
                        Approve
                      </Btn>
                      {blockers.length > 0 && <span style={{ color: 'var(--text-red-700)' }}>{blockers.join(' ')}</span>}
                    </>
                  )}
                  {d.status === 'approved' && (
                    <Btn kind="primary" onClick={() => dispatch({ type: 'payDraw', ...ids, drawId: d.id })}>Mark paid</Btn>
                  )}
                </div>
              ))}
              {m.ready > 0 && !sow.draws.some((d) => d.status === 'requested') && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {partner.company} has reported {money(m.ready)} of work they have not asked to be paid for.
                </span>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Trade partners: the directory
// ---------------------------------------------------------------------------------------------

export function GcPartnersTab({ state, dispatch }: { state: GcState; dispatch: Dispatch<GcAction> }) {
  return (
    <div>
      <Why>
        Every company we ask to bid. The paperwork is per company, not per job: one master agreement, one insurance
        certificate, one W-9. The record on the right says who actually answers when we ask.
      </Why>
      <Card style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Company</th>
              <th style={th}>Trade</th>
              <th style={th}>Contact</th>
              <th style={th}>Paperwork</th>
              <th style={{ ...th, textAlign: 'right' }}>Asked</th>
              <th style={{ ...th, textAlign: 'right' }}>Bid</th>
              <th style={{ ...th, textAlign: 'right' }}>Won</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {state.partners.map((p) => (
              <tr key={p.id}>
                <td style={{ ...td, fontWeight: 600 }}>{p.company}</td>
                <td style={td}>{p.trades.join(', ')}</td>
                <td style={td}>{p.contact}</td>
                <td style={td}><PaperworkChips partner={p} today={state.today} /></td>
                <td style={num}>{p.invited}</td>
                <td style={num}>{p.bids}</td>
                <td style={num}>{p.won}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {p.msa === 'none' && <Btn kind="quiet" onClick={() => dispatch({ type: 'sendMsa', partnerId: p.id })}>Send master agreement</Btn>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
