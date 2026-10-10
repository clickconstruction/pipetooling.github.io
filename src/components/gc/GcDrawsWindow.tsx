import { useEffect, useState } from 'react'
import { Btn, Card, Chip, Stat, Why, input, type Tone } from './gcUi'
import { BUILDING_CSS } from './gcBuildingCss'
import { GcDrawBackCharges } from './GcDrawBackCharges'
import { GcDrawCameInForm, GcDrawSendBackForm, GcDrawSentBackList, type LinkAccess } from './GcDrawForms'
import { GcDrawPayApp } from './GcDrawPayApp'
import { GcOwnCrewCard, type OwnCrewWrites } from './GcOwnCrew'
import { heldByOthers, type CrewJobHeld } from '../../lib/gc/crewJobRows'
import { partnerBlockers } from '../../lib/gc/bench'
import { sowMoney } from '../../lib/gc/bids'
import { retainageHeldNow, sentBackOpen, sowContractSum, timesSentBack, tradeChangesFor, type TradeChange } from '../../lib/gc/building'
import { drawPayDays, drawsToPay } from '../../lib/gc/buildingPay'
import type { SignedFile } from '../../lib/gc/closeoutRows'
import type { CrewJobRead } from '../../lib/gc/crewJobRows'
import { drawCameInDraft, type DrawCameIn, type DrawExtra } from '../../lib/gc/drawRows'
import { partnerById } from '../../lib/gc/lookups'
import { backChargesToAct, PAY_WITHIN_DAYS } from '../../lib/gc/portal'
import type { Draw, GcProject, GcState, Partner, TradePackage } from '../../lib/gc/types'
import { money, shortDate } from '../../lib/gc/words'

/**
 * GC mode, the real build, the Building lane's U6b: the trades' draws on real data, ported from the prototype's
 * `GcDrawsTab` (`GcOfficeTabs.tsx`, branch spike/gc-mode; the plan: to-dos/gc-mode/mockups/building-u6.md). A trade
 * reports how far each line of its statement of work is and asks to be paid with a pay application. We approve it,
 * approve it for less, or send it back. We hold retainage, pay it, and take its unconditional waiver. One that came by
 * email or on paper is recorded here. The database's own functions check every press and work the money out (the
 * Building lane's U6a). The trade's own pay application comes from its portal with the Portal lane's P5c.
 */

export interface DrawWrites {
  /** A pay application that came by email or on paper. */
  onCameIn: (d: DrawCameIn) => void
  onApprove: (packageId: string, drawId: string) => void
  onApproveLess: (packageId: string, drawId: string, weApprove: Record<string, number>, note: string) => void
  onSendBack: (packageId: string, drawId: string, weSee: Record<string, number>, note: string) => void
  onPay: (packageId: string, drawId: string) => void
  onWaiverIn: (packageId: string, drawId: string) => void
  onCharge: (packageId: string, charge: { amount: number; reason: string; photoUrl: string }) => void
  onSettleCharge: (packageId: string, chargeId: string, keep: boolean, note: string) => void
  onTakeCharge: (packageId: string, chargeId: string, drawId: string) => void
  /** A change order the customer signed goes to its trade, as a change to its statement of work. */
  onSendChange: (packageId: string, changeOrderId: string) => void
  /**
   * They signed a change we sent them, on paper or by email (the Building lane's U6d, `gc_trade_change_signed_in`): its
   * line on their statement of work, with the file it came as. Absent: no press shows.
   */
  onChangeSignedIn?: (packageId: string, changeOrderId: string, file: SignedFile) => void
}

interface Props {
  /** The board with the trades' money laid over it (`withDraws`), and the change orders with their trade side. */
  state: GcState
  project: GcProject
  /** Each draw's file and who of ours recorded it (`drawExtras`). */
  extras?: Map<string, DrawExtra>
  /** The back-charge a link opened the window at (`&charge=<id>`): outlined and scrolled to. */
  chargeId?: string | null
  /** Reads who can open a Drive link, for the warning under it. Absent: no check. */
  checkLink?: (url: string) => Promise<LinkAccess>
  /**
   * The tick that emails the trade about a press here (Mark paid, Approve less, a change sent, a back-charge). It starts
   * off, as every send does. Null: this person sends no email to a trade (`canSendGcTradeEmail`), and no tick shows.
   */
  emailTick?: { on: boolean; onChange: (on: boolean) => void } | null
  writes: DrawWrites
  /**
   * Our own crew's trades (Building's U8): what each linked trade's Pipeline job read, which trades name one, and the
   * picker's calls for a dev. Absent: no Our own crew card.
   */
  ownCrew?: { reads: CrewJobRead[]; linked: string[]; held?: CrewJobHeld[]; writes?: OwnCrewWrites }
  /** What a press works on: a draw's, a charge's or a change order's id, or a trade's while a pay application or a charge is added. */
  busy?: string | null
  problem?: string | null
  onClose: () => void
}

export function GcDrawsWindow({ state, project, extras, chargeId = null, checkLink, emailTick = null, writes, ownCrew, busy = null, problem = null, onClose }: Props) {
  // The pay application open to read: a draw that stands, or one we sent back.
  const [looking, setLooking] = useState<{ packageId: string; draw: Draw } | null>(null)
  const trades = project.packages.flatMap((pkg) => {
    const partnerId = pkg.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId
    const partner = partnerId ? partnerById(state, partnerId) : undefined
    return pkg.sow?.status === 'signed' && !pkg.selfPerform && partner ? [{ pkg, partner }] : []
  })
  const look = looking ? trades.find((t) => t.pkg.id === looking.packageId) : undefined

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      // Escape steps back from a pay application to the draws, then closes the window.
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
        aria-label={`${project.name}: Draws`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(960px, 100%)', maxHeight: 'min(94vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name} · Draws</div>
            <div data-draw-lede style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              What each trade asks to be paid, and what we pay.
            </div>
          </div>
          <span style={{ flex: 1 }} />
          {emailTick && (
            <label data-draw-email-tick style={{ fontSize: '0.85rem', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
              <input type="checkbox" checked={emailTick.on} onChange={(e) => emailTick.onChange(e.target.checked)} />
              Email the trade about what I press here
            </label>
          )}
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>

        <div style={{ padding: '0.8rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.9rem' }}>
          <style>{BUILDING_CSS}</style>
          {problem && (
            <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
              {problem}
            </div>
          )}
          {look && looking ? (
            <GcDrawPayApp project={project} sow={look.pkg.sow!} partner={look.partner} draw={looking.draw} extra={extras?.get(looking.draw.id)} onBack={() => setLooking(null)} />
          ) : (
            <>
              <Why>
                A trade reports how far each line of its statement of work is. Then it asks to be paid with a pay application and a conditional
                waiver. We approve it and hold retainage, or send it back to be fixed. Their unconditional waiver follows our payment.
              </Why>
              {trades.length === 0 && <Card>No trade we hire has a signed statement of work on this job yet.</Card>}
              <ToPay state={state} project={project} />
              {trades.map(({ pkg, partner }) => (
                <TradeCard
                  key={pkg.id}
                  state={state}
                  project={project}
                  pkg={pkg}
                  partner={partner}
                  chargeId={chargeId}
                  checkLink={checkLink}
                  emailOn={emailTick?.on ?? false}
                  writes={writes}
                  busy={busy}
                  onLook={(draw) => setLooking({ packageId: pkg.id, draw })}
                />
              ))}
              {ownCrew &&
                project.packages
                  .filter((pkg) => pkg.selfPerform)
                  .map((pkg) => (
                    <GcOwnCrewCard
                      key={pkg.id}
                      pkg={pkg}
                      linked={ownCrew.linked.includes(pkg.id)}
                      read={ownCrew.reads.find((r) => r.packageId === pkg.id) ?? null}
                      held={heldByOthers(ownCrew.held ?? [], pkg.id)}
                      {...(ownCrew.writes ? { writes: ownCrew.writes } : {})}
                      busy={busy === pkg.id}
                    />
                  ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const late = (days: number) => `${days} ${days === 1 ? 'day' : 'days'} late`

/** Approved draws not paid yet on the job, late first, then soonest: what to pay and by when. */
function ToPay({ state, project }: { state: GcState; project: GcProject }) {
  const list = drawsToPay(state, project)
  if (list.length === 0) return null
  const total = list.reduce((s, d) => s + d.draw.net, 0)
  const lateCount = list.filter((d) => d.daysLate > 0).length
  return (
    <Card>
      <div data-draws-to-pay style={{ display: 'grid', gap: '0.25rem', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
          <strong>To pay</strong>
          <span style={{ color: 'var(--text-muted)' }}>
            {list.length} approved {list.length === 1 ? 'draw' : 'draws'}, {money(total)}
          </span>
          {lateCount > 0 && <Chip tone="red">{lateCount} late</Chip>}
        </div>
        {list.map(({ pkg, company, draw, payBy, daysLate }) => (
          <div key={draw.id}>
            {company}, {pkg.trade} {draw.final ? 'retainage release' : `draw ${draw.number}`}: <strong>{money(draw.net)}</strong>
            {payBy && (
              <span style={{ color: daysLate > 0 ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
                {', '}pay by {shortDate(payBy)}
                {daysLate > 0 ? `, ${late(daysLate)}` : payBy === state.today ? ', today' : ''}
              </span>
            )}
          </div>
        ))}
        <div data-draws-to-pay-rule style={{ marginTop: '0.2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          We pay an approved draw within {PAY_WITHIN_DAYS} days. A retainage release is paid on the day it opens.
        </div>
      </div>
    </Card>
  )
}

/** A draw's days on its row: approved and pay by, or approved and paid, and how late. */
function DrawDays({ project, pkg, draw, today }: { project: GcProject; pkg: TradePackage; draw: Draw; today: string }) {
  const days = drawPayDays(project, pkg, draw, today)
  if (!days.approvedOn) return null
  return (
    <span style={{ color: 'var(--text-muted)' }}>
      approved {shortDate(days.approvedOn)}
      {days.paidOn ? (
        <>
          , paid {shortDate(days.paidOn)}
          {days.daysLate > 0 && <span style={{ color: 'var(--text-amber-800)' }}>, {late(days.daysLate)}</span>}
        </>
      ) : days.payBy ? (
        <>
          ,{' '}
          <strong style={{ color: days.daysLate > 0 ? 'var(--text-red-700)' : 'var(--text-base)' }}>
            pay by {shortDate(days.payBy)}
            {days.daysLate > 0 ? `, ${late(days.daysLate)}` : days.payBy === today ? ', today' : ''}
          </strong>
        </>
      ) : null}
    </span>
  )
}

const WAIVER_WORDS = (d: Draw): { tone: Tone; word: string } => {
  const paper = d.final ? 'final release' : 'waiver'
  if (d.waiver === 'unconditional') return { tone: 'green', word: `unconditional ${paper} in` }
  if (d.status === 'paid') return { tone: 'amber', word: `unconditional ${paper} owed` }
  return { tone: 'grey', word: `conditional ${paper} in` }
}

function TradeCard({
  state,
  project,
  pkg,
  partner,
  chargeId,
  checkLink,
  emailOn,
  writes,
  busy,
  onLook,
}: {
  state: GcState
  project: GcProject
  pkg: TradePackage
  partner: Partner
  chargeId: string | null
  checkLink?: (url: string) => Promise<LinkAccess>
  emailOn: boolean
  writes: DrawWrites
  busy: string | null
  onLook: (draw: Draw) => void
}) {
  // The form open under a waiting draw: send it back, or approve it for less.
  const [formFor, setFormFor] = useState<{ drawId: string; mode: 'back' | 'less' } | null>(null)
  const [cameIn, setCameIn] = useState(false)
  const sow = pkg.sow!
  const m = sowMoney(sow)
  const blockers = partnerBlockers(partner, state.today)
  const toAct = backChargesToAct(sow, state.today).length
  const waiting = sow.draws.find((d) => d.status === 'requested')
  const changes = tradeChangesFor(project, pkg)
  return (
    <Card>
      <div data-draw-trade={pkg.id} style={{ display: 'grid', gap: '0.7rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <strong>{pkg.trade}</strong> <span style={{ color: 'var(--text-muted)' }}>{partner.company}</span>
            {toAct > 0 && (
              <>
                {' '}
                <Chip tone="amber">
                  {toAct} {toAct === 1 ? 'back-charge' : 'back-charges'} to act on
                </Chip>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap' }}>
            <Stat label="Contract" value={money(sowContractSum(sow))} />
            <Stat label="Billed" value={money(m.billed)} />
            <Stat label="Paid" value={money(m.paid)} />
            <Stat label="Retainage held" value={money(retainageHeldNow(sow))} />
            <Stat label="Left to bill" value={money(sowContractSum(sow) - m.billed)} />
          </div>
        </div>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {sow.sov.map((l) => (
            <div key={l.id} className="gcBar-row" data-draw-line={l.id}>
              <span>
                {l.label} {money(l.amount)}
              </span>
              <span className="gcBar" title={`Billed ${l.pctBilled}%, reported ${l.pctReported}%`} style={{ position: 'relative', height: 10, borderRadius: 5, background: 'var(--bg-muted)', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', inset: 0, width: `${l.pctReported}%`, background: '#93c5fd' }} />
                <span style={{ position: 'absolute', inset: 0, width: `${l.pctBilled}%`, background: '#16a34a' }} />
              </span>
              <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                reported {l.pctReported}%, billed {l.pctBilled}%
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {sow.draws.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No pay application yet.</span>}
          {sow.draws.map((d) => (
            <DrawRow
              key={d.id}
              project={project}
              pkg={pkg}
              company={partner.company}
              draw={d}
              today={state.today}
              blockers={blockers}
              formFor={formFor?.drawId === d.id ? formFor.mode : null}
              onForm={(mode) => setFormFor(mode ? { drawId: d.id, mode } : null)}
              emailOn={emailOn}
              writes={writes}
              busy={busy === d.id}
              onLook={() => onLook(d)}
            />
          ))}
          <GcDrawSentBackList sow={sow} onLook={onLook} />
          {!cameIn && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              {waiting ? (
                <span data-draw-came-in-waits style={{ color: 'var(--text-muted)' }}>
                  Pay application {waiting.number} is waiting on us. Approve it or send it back before the next one.
                </span>
              ) : (
                <Btn onClick={() => setCameIn(true)} disabled={busy === pkg.id}>
                  A pay application came by email
                </Btn>
              )}
            </div>
          )}
          {cameIn && !waiting && (
            <GcDrawCameInForm
              sow={sow}
              company={partner.company}
              start={drawCameInDraft(pkg.id, sow, partner)}
              busy={busy === pkg.id}
              checkLink={checkLink}
              onRecord={(d) => {
                writes.onCameIn(d)
                setCameIn(false)
              }}
              onCancel={() => setCameIn(false)}
            />
          )}
          <TradeChanges
            changes={changes}
            company={partner.company}
            busy={busy}
            checkLink={checkLink}
            onSend={(id) => writes.onSendChange(pkg.id, id)}
            onSignedIn={writes.onChangeSignedIn ? (id, file) => writes.onChangeSignedIn?.(pkg.id, id, file) : undefined}
          />
          <GcDrawBackCharges
            sow={sow}
            company={partner.company}
            today={state.today}
            litChargeId={chargeId}
            busy={busy === pkg.id ? 'new' : busy}
            emailOn={emailOn}
            writes={{
              onCharge: (c) => writes.onCharge(pkg.id, c),
              onSettle: (id, keep, note) => writes.onSettleCharge(pkg.id, id, keep, note),
              onTake: (id, drawId) => writes.onTakeCharge(pkg.id, id, drawId),
            }}
          />
          {m.ready > 0 && !waiting && !sentBackOpen(sow) && (
            <span data-draw-ready style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {partner.company} has reported {money(m.ready)} of work they have not asked to be paid for.
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

function DrawRow({
  project,
  pkg,
  company,
  draw: d,
  today,
  blockers,
  formFor,
  onForm,
  emailOn,
  writes,
  busy,
  onLook,
}: {
  project: GcProject
  pkg: TradePackage
  company: string
  draw: Draw
  today: string
  blockers: string[]
  formFor: 'back' | 'less' | null
  onForm: (mode: 'back' | 'less' | null) => void
  emailOn: boolean
  writes: DrawWrites
  busy: boolean
  onLook: () => void
}) {
  const sow = pkg.sow!
  const charges = (d.backCharges ?? []).reduce((t, b) => t + b.amount, 0)
  const waiver = WAIVER_WORDS(d)
  const held = blockers.length > 0
  return (
    <div data-draw={d.id} data-draw-status={d.status} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
      <strong>
        {d.final ? `Draw ${d.number}, retainage release` : `Draw ${d.number}`}
        {timesSentBack(sow, d.number) > 0 ? ', revised' : ''}
      </strong>
      <span>asked {shortDate(d.requestedOn)}</span>
      {d.final ? (
        <span>
          pays back what we held: <strong>{money(d.net)}</strong>
        </span>
      ) : (
        <span>
          {money(d.gross)} less {money(d.retainage)} held
          {charges > 0 && <span style={{ color: 'var(--text-amber-800)' }}>, less {money(charges)} in back-charges</span>} = <strong>{money(d.net)}</strong>
          {d.asked && <span style={{ color: 'var(--text-amber-800)' }}>, approved for less, they asked {money(d.asked.net)}</span>}
        </span>
      )}
      <Chip tone={d.status === 'paid' ? 'green' : d.status === 'approved' ? 'blue' : 'amber'}>{d.status === 'requested' ? 'waiting on us' : d.status}</Chip>
      <DrawDays project={project} pkg={pkg} draw={d} today={today} />
      <Chip tone={waiver.tone}>{waiver.word}</Chip>
      {d.status === 'requested' && !formFor && (
        <>
          {d.final ? (
            <span data-draw-release-at-closeout style={{ color: 'var(--text-muted)' }}>
              Closeout approves the retainage release.
            </span>
          ) : (
            <>
              <Btn kind="primary" disabled={busy || held} title={blockers.join(' ') || undefined} onClick={() => writes.onApprove(pkg.id, d.id)}>
                Approve
              </Btn>
              <Btn disabled={busy || held} title={blockers.join(' ') || undefined} onClick={() => onForm('less')}>
                Approve less
              </Btn>
            </>
          )}
          <Btn disabled={busy} onClick={() => onForm('back')}>
            Send back
          </Btn>
          {held && !d.final && (
            <span data-draw-blockers style={{ color: 'var(--text-red-700)' }}>
              {blockers.join(' ')}
            </span>
          )}
        </>
      )}
      {d.status === 'approved' && (
        <Btn kind="primary" disabled={busy} onClick={() => writes.onPay(pkg.id, d.id)}>
          Mark paid
        </Btn>
      )}
      {d.status === 'paid' && d.waiver === 'conditional' && (
        <Btn disabled={busy} onClick={() => writes.onWaiverIn(pkg.id, d.id)}>
          {d.final ? 'Their final release came in' : 'Their unconditional waiver came in'}
        </Btn>
      )}
      <Btn kind="quiet" onClick={onLook}>
        {d.final ? 'Final pay application' : 'Pay application'}
      </Btn>
      {formFor && d.status === 'requested' && (
        <div style={{ flexBasis: '100%' }}>
          <GcDrawSendBackForm
            mode={formFor}
            sow={sow}
            draw={d}
            company={company}
            blocked={blockers}
            busy={busy}
            emailOn={emailOn}
            onCancel={() => onForm(null)}
            onSend={(note, percents) => {
              if (formFor === 'less') writes.onApproveLess(pkg.id, d.id, percents, note)
              else writes.onSendBack(pkg.id, d.id, percents, note)
              onForm(null)
            }}
          />
        </div>
      )}
    </div>
  )
}

const CHANGE_WORDS: Record<TradeChange['state'], { tone: Tone; word: string }> = {
  owner: { tone: 'grey', word: 'waiting on the customer' },
  toSend: { tone: 'amber', word: 'signed by the customer' },
  sent: { tone: 'blue', word: 'waiting on their signature' },
  signed: { tone: 'green', word: 'on their statement of work' },
}

/**
 * Each change order on the trade: with the customer, ours to send to the trade, waiting on its signature, or signed in.
 * One they signed on paper or by email is recorded here with **They signed it** (U6d).
 */
function TradeChanges({
  changes,
  company,
  busy,
  checkLink,
  onSend,
  onSignedIn,
}: {
  changes: TradeChange[]
  company: string
  busy: string | null
  checkLink?: (url: string) => Promise<LinkAccess>
  onSend: (changeOrderId: string) => void
  onSignedIn?: (changeOrderId: string, file: SignedFile) => void
}) {
  // The change whose signature is being recorded, with the file it came as.
  const [signing, setSigning] = useState<string | null>(null)
  if (changes.length === 0) return null
  return (
    <div data-draw-changes style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border)' }}>
      {changes.map(({ co, state }) => (
        <div key={co.id} data-draw-change={co.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>Change order {co.number}</strong>
          <span>{co.description}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{co.cost < 0 ? `a credit of ${money(-co.cost)}` : money(co.cost)}</span>
          <Chip tone={CHANGE_WORDS[state].tone}>{CHANGE_WORDS[state].word}</Chip>
          {state === 'toSend' && (
            <Btn kind="primary" disabled={busy === co.id} onClick={() => onSend(co.id)}>
              Send the change to {company}
            </Btn>
          )}
          {state === 'sent' && co.tradeChange && <span style={{ color: 'var(--text-muted)' }}>sent {shortDate(co.tradeChange.sentOn)}</span>}
          {state === 'sent' && onSignedIn && signing !== co.id && (
            <Btn disabled={busy === co.id} onClick={() => setSigning(co.id)}>
              They signed it
            </Btn>
          )}
          {state === 'signed' && co.tradeChange?.signedOn && <span style={{ color: 'var(--text-muted)' }}>signed {shortDate(co.tradeChange.signedOn)}</span>}
          {state === 'sent' && onSignedIn && signing === co.id && (
            <SignedInForm
              company={company}
              busy={busy === co.id}
              checkLink={checkLink}
              onRecord={(file) => {
                onSignedIn(co.id, file)
                setSigning(null)
              }}
              onCancel={() => setSigning(null)}
            />
          )}
        </div>
      ))}
      {changes.some((c) => c.state === 'toSend' || c.state === 'sent') && (
        <span data-draw-change-hint style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {onSignedIn
            ? 'They sign it in their portal. If they sign on paper or by email instead, press They signed it.'
            : 'They sign it in their portal.'}
        </span>
      )}
    </div>
  )
}

/** A change they signed on paper or by email: the file it came as and its Drive link, both optional. */
function SignedInForm({
  company,
  busy,
  checkLink,
  onRecord,
  onCancel,
}: {
  company: string
  busy: boolean
  checkLink?: (url: string) => Promise<LinkAccess>
  onRecord: (file: SignedFile) => void
  onCancel: () => void
}) {
  const [file, setFile] = useState<SignedFile>({ fileName: '', driveUrl: '' })
  const [access, setAccess] = useState<LinkAccess>(null)
  const check = (url: string) => {
    setAccess(null)
    if (!checkLink || !url.trim()) return
    void checkLink(url.trim())
      .then(setAccess)
      .catch(() => setAccess(null))
  }
  return (
    <div data-draw-change-signed-form style={{ flexBasis: '100%', display: 'grid', gap: '0.4rem', padding: '0.55rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
      <span>
        {company} signed it on paper or by email. It becomes a line of their statement of work. Add the file if you have it.
      </span>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={file.fileName} onChange={(e) => setFile({ ...file, fileName: e.target.value })} placeholder="The file's name" aria-label="The signed file's name" style={{ ...input, flex: '1 1 12rem' }} />
        <input
          value={file.driveUrl}
          onChange={(e) => setFile({ ...file, driveUrl: e.target.value })}
          onBlur={(e) => check(e.target.value)}
          placeholder="Its Drive link"
          aria-label="The signed file's Drive link"
          style={{ ...input, flex: '2 1 16rem' }}
        />
      </div>
      {access === 'restricted' && (
        <div data-draw-change-link-hint style={{ fontSize: '0.8rem', color: 'var(--text-amber-800)' }}>
          Only people given access can open this link. Our office may not be one of them.
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={busy} onClick={() => onRecord(file)}>
          Record their signature
        </Btn>
        <Btn kind="quiet" onClick={onCancel}>
          Cancel
        </Btn>
      </div>
    </div>
  )
}
