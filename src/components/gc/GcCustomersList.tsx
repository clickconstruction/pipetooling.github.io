import { useEffect, useState, type CSSProperties } from 'react'
import { useFlowBoard } from '../../hooks/useFlowBoard'
import { customerAtForStep } from '../../lib/flows/boardOpen'
import { loadCustomerPageOpens } from '../../lib/flows/flowsIo'
import type { LineTone } from '../../lib/flows/board'
import { NO_CUSTOMERS, OPEN_THE_CARD, READING, SECTION_TONE, customerCards, headChip, listSummary, type CustomerCard, type CustomerCardJob } from '../../lib/gc/customersList'
import type { GcCustomer, GcProject } from '../../lib/gc/types'
import { useCustomerOpener } from './gcCustomerOpener'
import { Btn, Card, Chip, td, th } from './gcUi'

/**
 * Customers' first view (v2.5557): a card per customer on a GC project, Trade partners' card shape. The band names the
 * customer, counts their jobs, says how they stand in one chip and opens their window; the facts line is the person to
 * call, the address, the master agreement and the portal; then one row per job with its stage on the Project Board,
 * the step it is on with its day, and the step's own press. The words are `gc/customersList.ts`'s over the page's
 * customers and projects and the customer flow's read; this only draws them.
 */

const SMALL_COLOR: Record<LineTone, string> = {
  late: 'var(--text-red-700)',
  lapsed: 'var(--text-orange-700)',
  over: 'var(--text-orange-700)',
  wait: 'var(--text-blue-700)',
  '': 'var(--text-muted)',
}

const AGREEMENT_COLOR = { done: 'var(--text-green-700)', now: 'var(--text-orange-700)', lapsed: 'var(--text-orange-700)', '': 'var(--text-muted)' } as const

const link: CSSProperties = { border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.85rem', padding: 0, textAlign: 'left' }

export function GcCustomersList({
  customers,
  projects,
  onOpenProject,
  onBillDay,
}: {
  customers: readonly GcCustomer[]
  projects: readonly GcProject[]
  /** A job's name, Open the card, and Open the compare: the project's card on the Project Board. */
  onOpenProject: (projectId: string) => void
  /** Bill day: Money, From the trades, for that job. */
  onBillDay: (projectId: string) => void
}) {
  const board = useFlowBoard('customer')
  // Each customer's last open of their page, for the facts line. Null until read, or when it fails.
  const [pageOpens, setPageOpens] = useState<Record<string, string> | null>(null)
  const idsKey = customers
    .filter((c) => projects.some((p) => p.customerId === c.id))
    .map((c) => c.id)
    .join(',')
  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : []
    if (!ids.length) return
    let alive = true
    loadCustomerPageOpens(ids)
      .then((o) => {
        if (alive) setPageOpens(o)
      })
      .catch(() => {
        if (alive) setPageOpens(null)
      })
    return () => {
      alive = false
    }
  }, [idsKey])
  const opener = useCustomerOpener()
  const flow = board.ctx && board.read ? { ctx: board.ctx, companies: board.read.companies, readings: board.read.readings, refs: board.read.refs } : null
  const cards = customerCards({ customers, projects, flow, pageOpens })
  if (!cards.length) return <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{NO_CUSTOMERS}</p>

  const open = (card: CustomerCard) => opener?.openCustomer(card.customerId, { tab: 'flow' })
  const press = (card: CustomerCard, j: CustomerCardJob) => {
    const p = j.press
    if (p?.kind === 'bill-day') return onBillDay(j.projectId)
    if (p?.kind === 'nudge' && j.line) return opener?.openCustomer(card.customerId, customerAtForStep(j.line.step, j.line.jobId, true))
    return onOpenProject(j.projectId)
  }

  return (
    <section aria-label="Customers list" style={{ display: 'grid', gap: '0.9rem' }}>
      <div data-customers-summary style={{ fontSize: '0.85rem', color: board.error ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{board.error ?? (flow ? listSummary(cards) : READING)}</div>
      {cards.map((card) => {
        const chip = headChip(card)
        return (
          <Card key={card.customerId} style={{ padding: 0, overflow: 'hidden', borderColor: card.late ? 'var(--border-red)' : 'var(--border)', ...(card.off ? { color: 'var(--text-muted)' } : {}) }}>
            <div data-customer-card={card.customerId} style={{ padding: '0.7rem 1rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', background: card.off ? 'var(--surface)' : 'var(--bg-blue-200)', borderLeft: `5px solid ${card.off ? 'var(--border-strong)' : 'var(--text-blue-500)'}`, borderBottom: card.off ? 'none' : '1px solid var(--border)' }}>
              <strong style={{ fontSize: '1.1rem', color: card.off ? 'inherit' : 'var(--text-blue-800)' }}>{card.name}</strong>
              <span style={{ color: card.off ? 'inherit' : 'var(--text-700)', fontSize: '0.875rem' }}>
                {card.jobs.length} {card.jobs.length === 1 ? 'job' : 'jobs'}
              </span>
              <Chip tone={chip.tone}>{chip.words}</Chip>
              {card.off && <span style={{ fontSize: '0.85rem' }}>{card.off.why}</span>}
              <span style={{ flex: 1 }} />
              <Btn kind="quiet" onClick={() => open(card)} title="The customer's window, on its Flow tab">
                Open
              </Btn>
            </div>
            {!card.off && (
              <>
                <div style={{ padding: '0.6rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem 1.1rem', alignItems: 'baseline', fontSize: '0.85rem', color: 'var(--text-700)' }}>
                  <span>{[card.person, card.phone, card.email].filter(Boolean).join(' · ') || 'Nobody to call yet'}</span>
                  {card.address && <span style={{ color: 'var(--text-muted)' }}>{card.address}</span>}
                  <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
                    Master agreement{' '}
                    <span style={{ color: AGREEMENT_COLOR[card.agreement.tone], fontWeight: 600 }}>{card.agreement.words || '…'}</span>
                    {card.agreement.small ? ` · ${card.agreement.small}` : ''}
                    {' · Portal '}
                    <span style={{ color: card.portal === 'never' || card.portal === '—' ? 'var(--text-muted)' : 'var(--text-700)' }}>{card.portal}</span>
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: '36%' }}>Job</th>
                      <th style={th}>Stage</th>
                      <th style={th}>Where it stands</th>
                      <th style={{ ...th, textAlign: 'right' }}>Next</th>
                    </tr>
                  </thead>
                  <tbody>
                    {card.jobs.map((j) => (
                      <tr key={j.projectId} data-customer-job={j.projectId}>
                        <td style={td}>
                          <button type="button" onClick={() => onOpenProject(j.projectId)} style={link}>
                            {j.name}
                          </button>
                        </td>
                        <td style={td}>
                          <Chip tone={SECTION_TONE[j.section]} small>
                            {j.stageWords}
                          </Chip>
                        </td>
                        <td style={td}>
                          {j.standing || (flow ? '' : '…')}
                          {j.small && <span style={{ marginLeft: 6, color: SMALL_COLOR[j.tone], fontWeight: j.tone === 'late' ? 600 : 400 }}>· {j.small}</span>}
                        </td>
                        <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {j.press ? (
                            <Btn kind={j.press.kind === 'nudge' && j.press.late ? 'primary' : 'plain'} onClick={() => press(card, j)} title={j.press.kind === 'nudge' ? "The step's line to them, with its send. Nothing sends until you press Send." : j.press.label}>
                              {j.press.label}
                            </Btn>
                          ) : (
                            <Btn kind="plain" onClick={() => onOpenProject(j.projectId)}>
                              {OPEN_THE_CARD}
                            </Btn>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Card>
        )
      })}
    </section>
  )
}
