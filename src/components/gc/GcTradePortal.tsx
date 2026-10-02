import { useState, type Dispatch, type ReactNode } from 'react'
import {
  askPromise,
  bidTabResult,
  bidTabRows,
  currentRev,
  daysUntil,
  money,
  partnerById,
  planLabel,
  shortDate,
  sowMoney,
  type GcAction,
  type GcProject,
  type GcState,
  type Includes,
  type Invite,
  type Partner,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
import { BidTabTable } from './GcBidTabs'
import { Btn, Chip, input } from './gcUi'

/**
 * GC mode design spike: what one trade partner sees. No sign-in: the link is the key, like the
 * sub portal and the customer portal. Everything pressed here lands on the office's side at once.
 */

interface Props {
  state: GcState
  project: GcProject
  partnerId: string
  onPickPartner: (id: string) => void
  dispatch: Dispatch<GcAction>
}

const INK = '#16283c'
const PAPER = '#f6f3ec'
const COPPER = '#b0662f'

export function GcTradePortal({ state, project, partnerId, onPickPartner, dispatch }: Props) {
  const onProject = state.partners.filter((p) => project.packages.some((k) => k.invites.some((i) => i.partnerId === p.id)))
  const partner = partnerById(state, partnerId) ?? onProject[0]
  const mine = partner
    ? project.packages.flatMap((pkg) => pkg.invites.filter((i) => i.partnerId === partner.id).map((invite) => ({ pkg, invite })))
    : []

  return (
    <div data-theme="light" style={{ background: PAPER, color: INK, border: `1px solid ${INK}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ background: INK, color: PAPER, padding: '0.7rem 0.9rem' }}>
        <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8 }}>
          What the trade sees · their portal
        </div>
        <select
          value={partner?.id ?? ''}
          onChange={(e) => onPickPartner(e.target.value)}
          aria-label="See the portal as"
          style={{ marginTop: '0.3rem', width: '100%', padding: '0.35rem', borderRadius: 4, border: 'none', fontSize: '1rem', fontWeight: 600 }}
        >
          {onProject.map((p) => (
            <option key={p.id} value={p.id}>{p.company}</option>
          ))}
        </select>
      </div>

      {!partner ? (
        <div style={{ padding: '1rem' }}>No trade partner is on this project yet. Invite one from Packages.</div>
      ) : (
        <div style={{ padding: '0.9rem', display: 'grid', gap: '0.9rem' }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{project.name}</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
              {project.address} · {project.sizeNote}
              <br />
              General contractor: Click Construction · Hello, {partner.contact}.
            </div>
          </div>

          <Paperwork partner={partner} today={state.today} dispatch={dispatch} />

          {mine.length === 0 && <div>You have no open invitation on this project.</div>}
          {mine.map(({ pkg, invite }) => (
            <PackageBlock key={invite.id} state={state} project={project} pkg={pkg} invite={invite} partner={partner} dispatch={dispatch} />
          ))}
        </div>
      )}
    </div>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid #d9d2c3', borderRadius: 8, padding: '0.75rem 0.85rem' }}>
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: COPPER, fontWeight: 700, marginBottom: '0.4rem' }}>
        {title}
      </div>
      {children}
    </section>
  )
}

function Paperwork({ partner, today, dispatch }: { partner: Partner; today: string; dispatch: Dispatch<GcAction> }) {
  const coiOk = partner.coiExpires !== null && daysUntil(partner.coiExpires, today) >= 0
  return (
    <Block title="Your paperwork with Click">
      <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.9rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Master agreement</span>
          {partner.msa === 'signed' && <Chip tone="green">signed {shortDate(partner.msaSignedOn)}</Chip>}
          {partner.msa === 'sent' && (
            <Btn kind="primary" onClick={() => dispatch({ type: 'tradeSignMsa', partnerId: partner.id })}>Read and sign</Btn>
          )}
          {partner.msa === 'none' && <Chip tone="grey">not sent to you yet</Chip>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Insurance certificate</span>
          <Chip tone={coiOk ? 'green' : 'red'}>
            {partner.coiExpires ? (coiOk ? `good to ${shortDate(partner.coiExpires)}` : `expired ${shortDate(partner.coiExpires)}. Upload a new one`) : 'upload one'}
          </Chip>
          <span>W-9</span>
          <Chip tone={partner.w9 ? 'green' : 'red'}>{partner.w9 ? 'on file' : 'fill it in'}</Chip>
        </div>
        <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
          You sign the master agreement once. Each job after that is a short statement of work.
        </div>
      </div>
    </Block>
  )
}

function PackageBlock({
  state,
  project,
  pkg,
  invite,
  partner,
  dispatch,
}: {
  state: GcState
  project: GcProject
  pkg: TradePackage
  invite: Invite
  partner: Partner
  dispatch: Dispatch<GcAction>
}) {
  const rev = currentRev(project)
  const latest = project.planSets.find((s) => s.rev === rev)
  const behind = invite.seenRev === null || invite.seenRev < rev
  const ids = { projectId: project.id, packageId: pkg.id }
  const awardedToMe = pkg.awardedInviteId === invite.id
  const awardedElsewhere = pkg.awardedInviteId !== null && !awardedToMe

  return (
    <>
      <Block title={`${pkg.trade} · plans`}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.9rem' }}>
          <strong>{latest?.label}</strong>
          <span style={{ opacity: 0.75 }}>issued {shortDate(latest?.issuedOn ?? null)}</span>
          {behind ? (
            <Btn kind="primary" onClick={() => dispatch({ type: 'tradeOpenPlans', ...ids, inviteId: invite.id })}>Open the plans</Btn>
          ) : (
            <Chip tone="green">you have the latest set</Chip>
          )}
        </div>
        {behind && invite.seenRev !== null && latest && (
          <div style={{ marginTop: '0.4rem', padding: '0.45rem 0.6rem', background: 'var(--bg-amber-100)', borderRadius: 6, fontSize: '0.85rem' }}>
            New since you last looked: {latest.note}
            {latest.changedSheets.length > 0 && <> Sheets: {latest.changedSheets.join(', ')}.</>}
          </div>
        )}
      </Block>

      {pkg.bidTab && invite.bid && (
        <Block title={`${pkg.trade} · bid tab`}>
          {pkg.bidTab.seenBy.includes(partner.id) ? (
            <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.9rem' }}>
              <div>{bidTabResult(project, pkg, partner.id)}</div>
              <BidTabTable rows={bidTabRows(state, pkg)} viewerId={partner.id} showNames={pkg.bidTab.showNames} />
              <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>Thank you for your number. This is how the quotes came in.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.9rem' }}>
              <span>Click shared how the quotes came in on {shortDate(pkg.bidTab.sharedOn)}.</span>
              <Btn kind="primary" onClick={() => dispatch({ type: 'tradeSeeBidTab', ...ids, partnerId: partner.id })}>See the bid tab</Btn>
            </div>
          )}
        </Block>
      )}

      {awardedElsewhere ? (
        <Block title={`${pkg.trade} · result`}>This one went to another company. Thank you for your number.</Block>
      ) : awardedToMe && pkg.sow ? (
        <SowBlock project={project} pkg={pkg} partner={partner} dispatch={dispatch} />
      ) : invite.status === 'declined' ? (
        <Block title={`${pkg.trade} · invitation`}>You passed on this one.</Block>
      ) : (
        <BidBlock project={project} pkg={pkg} invite={invite} today={state.today} dispatch={dispatch} />
      )}
    </>
  )
}

function BidBlock({
  project,
  pkg,
  invite,
  today,
  dispatch,
}: {
  project: GcProject
  pkg: TradePackage
  invite: Invite
  today: string
  dispatch: Dispatch<GcAction>
}) {
  const [promiseDay, setPromiseDay] = useState('')
  const promise = askPromise(invite, today)
  const [editing, setEditing] = useState(invite.bid === null)
  const [amount, setAmount] = useState(invite.bid ? String(invite.bid.amount) : '')
  const [note, setNote] = useState(invite.bid?.note ?? '')
  const [includes, setIncludes] = useState<Record<string, Includes>>(() => {
    const start: Record<string, Includes> = {}
    for (const item of pkg.scope) start[item.id] = invite.bid?.includes[item.id] ?? 'yes'
    return start
  })
  const ids = { projectId: project.id, packageId: pkg.id, inviteId: invite.id }
  const due = project.bidDue
  const days = due ? daysUntil(due, today) : null
  const stale = invite.bid !== null && project.planSets.some((s) => s.rev > (invite.bid?.basedOnRev ?? 0) && s.touches.includes(pkg.id))

  return (
    <Block title={`${pkg.trade} · invitation to bid`}>
      {due && (
        <div style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>
          Your number is due <strong>{shortDate(due)}</strong>
          {days !== null && <> ({days >= 0 ? `${days} days` : 'past due'})</>}.
        </div>
      )}
      {invite.bid && !editing ? (
        <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.9rem' }}>
          <div>
            Your bid: <strong>{money(invite.bid.amount)}</strong> on {planLabel(project, invite.bid.basedOnRev)}, sent{' '}
            {shortDate(invite.bid.submittedOn)}.
          </div>
          {stale && (
            <div style={{ padding: '0.45rem 0.6rem', background: 'var(--bg-amber-100)', borderRadius: 6 }}>
              The plans changed for your trade after you bid. Open the new set, then confirm or change your number.
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {stale && (
              <Btn kind="primary" onClick={() => dispatch({ type: 'tradeConfirmBid', ...ids })}>
                My number stands on the new plans
              </Btn>
            )}
            <Btn onClick={() => setEditing(true)}>Change my bid</Btn>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Tick what your number covers. Untick what it leaves out.</div>
          {pkg.scope.map((item) => (
            <label key={item.id} style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={includes[item.id] === 'yes'}
                onChange={(e) => setIncludes({ ...includes, [item.id]: e.target.checked ? 'yes' : 'no' })}
              />
              {item.label}
            </label>
          ))}
          <label style={{ fontSize: '0.9rem' }}>
            Your number{' '}
            <input type="number" min={0} step={100} value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...input, width: '9rem' }} />
          </label>
          <input style={input} placeholder="Anything we should know" value={note} onChange={(e) => setNote(e.target.value)} />
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn
              kind="primary"
              disabled={invite.seenRev === null || !(Number(amount) > 0)}
              title={invite.seenRev === null ? 'Open the plans first.' : undefined}
              onClick={() => {
                dispatch({ type: 'tradeSubmitBid', ...ids, amount: Number(amount), includes, note: note.trim() })
                setEditing(false)
              }}
            >
              {invite.bid ? 'Send my new number' : 'Send my bid'}
            </Btn>
            {!invite.bid && <Btn kind="quiet" onClick={() => dispatch({ type: 'tradeDecline', ...ids })}>Pass on this one</Btn>}
            {invite.seenRev === null && <span style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>Open the plans first.</span>}
          </div>
          {!invite.bid && (
            <div style={{ borderTop: '1px solid #d9d2c3', paddingTop: '0.5rem', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              {promise ? (
                <span>
                  You told Click your number will come by <strong>{shortDate(promise.by)}</strong>.
                </span>
              ) : (
                <span>Not ready yet? Tell Click when your number will come.</span>
              )}
              <input type="date" min={today} value={promiseDay} onChange={(e) => setPromiseDay(e.target.value)} style={input} aria-label="The day your number will come" />
              <Btn
                disabled={promiseDay === ''}
                onClick={() => {
                  dispatch({ type: 'tradePromise', ...ids, promisedBy: promiseDay })
                  setPromiseDay('')
                }}
              >
                {promise ? 'Change the day' : 'Tell Click'}
              </Btn>
            </div>
          )}
        </div>
      )}
    </Block>
  )
}

function SowBlock({
  project,
  pkg,
  partner,
  dispatch,
}: {
  project: GcProject
  pkg: TradePackage
  partner: Partner
  dispatch: Dispatch<GcAction>
}) {
  const [waiver, setWaiver] = useState(false)
  const sow = pkg.sow
  if (!sow) return null
  const ids = { projectId: project.id, packageId: pkg.id }
  const m = sowMoney(sow)
  const open = sow.draws.some((d) => d.status === 'requested')

  if (sow.status === 'draft') {
    return <Block title={`${pkg.trade} · you got the job`}>Click picked your number. Your statement of work is being written.</Block>
  }

  return (
    <>
      <Block title={`${pkg.trade} · statement of work`}>
        <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.9rem' }}>
          <div>
            <strong>{money(sow.price)}</strong> · {sow.retainagePct}% held until the end · based on {planLabel(project, sow.basedOnRev)}
          </div>
          <div style={{ opacity: 0.8 }}>{sow.sov.map((l) => `${l.label} ${money(l.amount)}`).join(' · ')}</div>
          {sow.status === 'sent' ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Btn kind="primary" disabled={partner.msa !== 'signed'} onClick={() => dispatch({ type: 'tradeSignSow', ...ids })}>
                Sign the statement of work
              </Btn>
              {partner.msa !== 'signed' && <span style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>Sign the master agreement first.</span>}
            </div>
          ) : (
            <Chip tone="green">signed {shortDate(sow.signedOn)}</Chip>
          )}
        </div>
      </Block>

      {sow.status === 'signed' && (
        <Block title={`${pkg.trade} · report your work and get paid`}>
          <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.9rem' }}>
            {sow.sov.map((l) => (
              <label key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                <span>
                  {l.label} <span style={{ opacity: 0.7 }}>· {money(l.amount)} · paid through {l.pctBilled}%</span>
                </span>
                <select
                  value={l.pctReported}
                  onChange={(e) => dispatch({ type: 'tradeReport', ...ids, sovId: l.id, pct: Number(e.target.value) })}
                  style={input}
                  aria-label={`Percent done, ${l.label}`}
                >
                  {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
                    .filter((p) => p >= l.pctBilled)
                    .map((p) => (
                      <option key={p} value={p}>{p}% done</option>
                    ))}
                </select>
              </label>
            ))}
            {m.ready > 0 && !open && (
              <div style={{ padding: '0.55rem 0.65rem', background: PAPER, borderRadius: 6, display: 'grid', gap: '0.4rem' }}>
                <div>
                  You can ask for <strong>{money(m.ready)}</strong>. Click holds {sow.retainagePct}%, so{' '}
                  <strong>{money(m.ready * (1 - sow.retainagePct / 100))}</strong> comes to you now.
                </div>
                <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                  <input type="checkbox" checked={waiver} onChange={(e) => setWaiver(e.target.checked)} />
                  I sign the conditional lien waiver for this amount.
                </label>
                <div>
                  <Btn
                    kind="primary"
                    disabled={!waiver}
                    onClick={() => {
                      dispatch({ type: 'tradeRequestDraw', ...ids })
                      setWaiver(false)
                    }}
                  >
                    Ask for this draw
                  </Btn>
                </div>
              </div>
            )}
            {sow.draws.map((d) => (
              <div key={d.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>Draw {d.number}</strong>
                <span>{money(d.net)}</span>
                <Chip tone={d.status === 'paid' ? 'green' : d.status === 'approved' ? 'blue' : 'amber'}>
                  {d.status === 'requested' ? 'Click is reviewing it' : d.status === 'approved' ? 'approved, payment coming' : `paid`}
                </Chip>
                {d.status === 'paid' && d.waiver === 'conditional' && (
                  <Btn kind="primary" onClick={() => dispatch({ type: 'tradeSignUnconditional', ...ids, drawId: d.id })}>
                    Sign the unconditional waiver
                  </Btn>
                )}
              </div>
            ))}
            <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
              Paid so far {money(m.paid)} · held {money(m.retainageHeld)} · left to bill {money(sow.price - m.billed)}
            </div>
          </div>
        </Block>
      )}
    </>
  )
}
