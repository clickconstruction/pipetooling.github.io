import { useEffect, useState, type ReactNode } from 'react'
import { useFlowBoard } from '../../../hooks/useFlowBoard'
import { companyAtForStep, customerAtForStep } from '../../../lib/flows/boardOpen'
import { portalCellWords } from '../../../lib/flows/boardRead'
import { loadCustomerPageOpens } from '../../../lib/flows/flowsIo'
import { NO_FILTER, type BoardFilter, type BoardLine } from '../../../lib/flows/board'
import type { BoardBy } from '../../../lib/gc/links'
import { useCompanyOpener } from '../gcCompanyOpener'
import { useCustomerOpener } from '../gcCustomerOpener'
import { GcBoardByCompany } from './GcBoardByCompany'
import { BoardPickers, GcBoardByStep, type BoardPresses } from './GcBoardByStep'
import { GcBoardByTrade } from './GcBoardByTrade'

/**
 * Trade partners' and Customers' boards (Messages cut 4): the strip of views, the read (`useFlowBoard`), and where each
 * press goes. A chip, a dot or a company's row opens the person's own window on its Flow tab, the prototype's row
 * press. The row's nudge opens the first company's paper with its send, Open the compare goes to the project's card,
 * and Invite a company goes to the list, where a company is added.
 */

/** A chip's or a dot's press: their window on its Flow tab, which finds them by their record (`findFlowContactId`). */
const FLOW_TAB = { tab: 'flow' } as const

const VIEWS: Record<'trade' | 'customer', readonly [BoardBy, string][]> = {
  trade: [
    ['list', 'List'],
    ['step', 'By step'],
    ['company', 'By company'],
    ['trade', 'By trade'],
  ],
  customer: [
    ['step', 'By step'],
    ['company', 'By company'],
  ],
}

export function GcFlowBoard({
  kind,
  by,
  onBy,
  list,
  onFollowUp,
  onOpenProject,
  onBillDay,
}: {
  kind: 'trade' | 'customer'
  by: BoardBy
  onBy: (by: BoardBy) => void
  /** Trade partners' list as it was, the first view. */
  list?: ReactNode
  /** Needs a hand: Follow up. */
  onFollowUp: () => void
  /** Open the compare: the project's card, where Compare quotes is. */
  onOpenProject: (projectId: string) => void
  /** Bill day: Money, From the trades, for that job. */
  onBillDay: (projectId: string) => void
}) {
  const views = VIEWS[kind].filter(([v]) => v !== 'list' || list)
  const shown = views.some(([v]) => v === by) ? by : (views[0]?.[0] ?? 'step')
  const board = useFlowBoard(kind, { enabled: shown !== 'list' })
  // By step's two pickers (v2.5555): held here so they sit in the views row, at its right.
  const [filter, setFilter] = useState<BoardFilter>(NO_FILTER)
  // A customer's last open of their page, for By company's Portal column (helper 8's read). Null until read, or when it fails.
  const [pageOpens, setPageOpens] = useState<Record<string, string> | null>(null)
  const read = board.read
  useEffect(() => {
    if (kind !== 'customer' || shown !== 'company' || !read) return
    let alive = true
    const ids = [...new Set(Object.values(read.refs).flatMap((r) => (r.customerId ? [r.customerId] : [])))]
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
  }, [kind, shown, read])
  const portalWords = (contactId: string): string => {
    if (kind !== 'customer') return portalCellWords(board.flow, read?.readings[contactId], null)
    const customerId = read?.refs[contactId]?.customerId
    if (!pageOpens || !customerId) return '—'
    return portalCellWords(board.flow, read?.readings[contactId], pageOpens[customerId] ?? null)
  }
  const companyOpener = useCompanyOpener()
  const customerOpener = useCustomerOpener()

  // A chip, a dot, or a company's row on By company or By trade: their window on its Flow tab.
  const openFlow = (contactId: string) => {
    const ref = board.read?.refs[contactId]
    if (kind === 'trade' && ref?.companyId) companyOpener?.openPartner(ref.companyId, FLOW_TAB)
    else if (ref?.customerId) customerOpener?.openCustomer(ref.customerId, FLOW_TAB)
  }
  // The row's nudge: the step's paper with its send.
  const openPaper = (line: BoardLine) => {
    const ref = board.read?.refs[line.contactId]
    if (kind === 'trade' && ref?.companyId) companyOpener?.openPartner(ref.companyId, companyAtForStep(line.step, true))
    else if (ref?.customerId) customerOpener?.openCustomer(ref.customerId, customerAtForStep(line.step, line.jobId, true))
  }
  const presses: BoardPresses = {
    onCompany: (line) => openFlow(line.contactId),
    onRowPress: (_step, press, lines) => {
      const first = lines[0]
      if (press.kind === 'invite') onBy('list')
      else if (press.kind === 'bill-day' && first?.jobId) onBillDay(first.jobId)
      else if (press.kind === 'compare' && first?.jobId) onOpenProject(first.jobId)
      else if (press.kind === 'nudge') {
        const line = lines.find((l) => l.contactId === press.contactIds[0])
        if (line) openPaper(line)
      }
    },
    onNeedsAHand: onFollowUp,
  }

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
      {views.length > 1 && (
        <div role="group" aria-label="How to see them" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {views.map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={shown === v}
              onClick={() => onBy(v)}
              style={{
                padding: '0.2rem 0.7rem',
                borderRadius: 999,
                border: `1px solid ${shown === v ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                background: shown === v ? 'var(--bg-blue-tint)' : 'var(--surface)',
                color: shown === v ? 'var(--text-blue-500)' : 'var(--text-600)',
                fontWeight: shown === v ? 600 : 400,
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {shown === 'step' && board.ctx && board.read && <BoardPickers ctx={board.ctx} companies={board.read.companies} filter={filter} onFilter={setFilter} />}
      </div>
      {shown === 'list' ? (
        list
      ) : board.error ? (
        <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{board.error}</div>
      ) : !board.ctx || !board.read ? (
        <div style={{ fontSize: '0.875rem' }}>Reading where everyone stands…</div>
      ) : shown === 'company' ? (
        <GcBoardByCompany
          ctx={board.ctx}
          companies={board.read.companies}
          portal={portalWords}
          onOpen={(contactId) => openFlow(contactId)}
        />
      ) : shown === 'trade' ? (
        <GcBoardByTrade ctx={board.ctx} companies={board.read.companies} onOpen={(c) => openFlow(c.contactId)} />
      ) : (
        <GcBoardByStep ctx={board.ctx} companies={board.read.companies} presses={presses} filter={filter} />
      )}
    </div>
  )
}
