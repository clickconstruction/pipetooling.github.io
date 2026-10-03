import { useState } from 'react'
import { money, ownCrewWork, partnerBlockers, projectCloseout, type CloseoutRow, type Draw } from '../../lib/gcMode/gcModel'
import { GcBuildingPayAppWindow } from './GcBuildingPayApp'
import type { GcPaneProps } from './GcOfficeTabs'
import { Btn, Card, Chip, Stat, Why } from './gcUi'

/**
 * GC mode design spike: Closeout. Each trade's last steps, in order: every line billed, we accept
 * the work, their warranty letter, their final pay application with a conditional waiver on final
 * payment, we approve and pay the retainage, then their unconditional waiver on final payment.
 * Our steps carry the button; theirs say who we wait on and open their portal to do it as them.
 */
export function GcCloseoutTab({ state, project, dispatch, onSeePortal }: GcPaneProps) {
  const c = projectCloseout(state, project)
  const [looking, setLooking] = useState<{ row: CloseoutRow; draw: Draw } | null>(null)

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <Why>
        We hold back {c.rows[0]?.pkg.sow?.retainagePct ?? 10}% of every draw. That is retainage. A trade gets it back at the end, once
        every line is billed, we accept the work and its warranty letter is in. It asks with a final pay application and a
        conditional waiver on final payment. After we pay, it signs the unconditional waiver on final payment. Then the trade is
        closed out.
      </Why>

      <Card>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <Stat label="Held on the trades" value={money(c.held)} />
          <Stat label="Paid back" value={money(c.released)} tone={c.released > 0 ? 'green' : undefined} />
          <Stat
            label="Closed out"
            value={`${c.closed} of ${c.rows.length}`}
            tone={c.rows.length > 0 && c.closed === c.rows.length ? 'green' : undefined}
          />
        </div>
      </Card>

      {c.rows.length === 0 && <Card>No trade has a signed statement of work yet. Closeout starts once one does.</Card>}

      {c.rows.map((row) => (
        <TradeCloseoutCard
          key={row.pkg.id}
          row={row}
          today={state.today}
          onAccept={() => dispatch({ type: 'acceptWork', projectId: project.id, packageId: row.pkg.id })}
          onApprove={(drawId) => dispatch({ type: 'approveRetainage', projectId: project.id, packageId: row.pkg.id, drawId })}
          onPay={(drawId) => dispatch({ type: 'payDraw', projectId: project.id, packageId: row.pkg.id, drawId })}
          onLook={(draw) => setLooking({ row, draw })}
          onSeePortal={onSeePortal}
        />
      ))}

      {(c.notStarted.length > 0 || c.ours.length > 0) && (
        <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
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

      {looking && looking.row.partner && (
        <GcBuildingPayAppWindow
          project={project}
          pkg={looking.row.pkg}
          partner={looking.row.partner}
          draw={looking.draw}
          viewer="office"
          onClose={() => setLooking(null)}
        />
      )}
    </div>
  )
}

function TradeCloseoutCard({
  row,
  today,
  onAccept,
  onApprove,
  onPay,
  onLook,
  onSeePortal,
}: {
  row: CloseoutRow
  today: string
  onAccept: () => void
  onApprove: (drawId: string) => void
  onPay: (drawId: string) => void
  onLook: (draw: Draw) => void
  onSeePortal?: (partnerId: string) => void
}) {
  const { pkg, partner, closeout } = row
  const company = partner?.company ?? 'The company'
  const billed = closeout.steps[0]?.done ?? false
  const f = closeout.finalDraw
  const blockers = partner ? partnerBlockers(partner, today) : []
  const doneCount = closeout.steps.filter((s) => s.done).length

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div>
          <strong>{pkg.trade}</strong> · {company}
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
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {closeout.steps[0]?.detail} Closeout starts when every line is billed.
        </div>
      ) : (
        <ol style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0, display: 'grid', gap: '0.55rem' }}>
          {closeout.steps.map((step, i) => {
            const isNext = closeout.next?.key === step.key
            const state = step.done ? 'done' : isNext ? 'now' : 'wait'
            return (
              <li key={step.key} style={{ display: 'grid', gridTemplateColumns: '1.85rem minmax(0, 1fr)', gap: '0.65rem', alignItems: 'start' }}>
                <span className="lienStep-dot" data-state={state} aria-hidden>
                  {step.done ? '✓' : i + 1}
                </span>
                <div style={{ display: 'grid', gap: '0.25rem', paddingTop: '0.2rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.9rem', color: state === 'wait' ? 'var(--text-muted)' : 'var(--text-strong)' }}>{step.label}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{step.who === 'office' ? 'us' : company}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{step.detail}</div>
                  {isNext && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {step.key === 'accepted' && (
                        <Btn kind="primary" onClick={onAccept}>
                          Accept the work
                        </Btn>
                      )}
                      {step.key === 'released' && f?.status === 'requested' && (
                        <>
                          <Btn kind="primary" disabled={blockers.length > 0} title={blockers.join(' ')} onClick={() => onApprove(f.id)}>
                            Approve the release
                          </Btn>
                          {blockers.length > 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-red-700)' }}>{blockers.join(' ')}</span>}
                        </>
                      )}
                      {step.key === 'released' && f?.status === 'approved' && (
                        <Btn kind="primary" onClick={() => onPay(f.id)}>
                          Mark paid
                        </Btn>
                      )}
                      {step.who === 'trade' && partner && onSeePortal && (
                        <>
                          <span style={{ fontSize: '0.85rem' }}>Waiting on {company}.</span>
                          <Btn kind="quiet" onClick={() => onSeePortal(partner.id)}>
                            See what they see
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
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
