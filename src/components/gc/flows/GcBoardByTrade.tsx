import { byTrade, type BoardCompany, type BoardContext, type LineTone, type TradeChip } from '../../../lib/flows/board'
import { shortDate } from '../../../lib/gc/words'

/**
 * By trade (Messages cut 4, the prototype's v1.172): one row per trade, A to Z, with the companies as chips. Each chip
 * reads the step the company is on, its job in the per-job lane, and how long or how late. A late one is tinted and comes
 * first, off the flow last. A company with two trades on its record sits under each, and one with none under No trade
 * yet. The words are `flows/board.ts`'s `byTrade`.
 */

const WORDS_COLOR: Record<LineTone, string> = {
  late: 'var(--text-red-700)',
  lapsed: 'var(--text-orange-700)',
  over: 'var(--text-orange-700)',
  wait: 'var(--text-blue-700)',
  '': 'var(--text-muted)',
}

function headWords(r: { companies: number; onAJob: number; late: number; lapsed: number; off: number }): string {
  const parts = [`${r.companies} ${r.companies === 1 ? 'company' : 'companies'}`]
  if (r.onAJob) parts.push(`${r.onAJob} on a job`)
  if (r.late) parts.push(`${r.late} late`)
  if (r.lapsed) parts.push(`${r.lapsed} lapsed`)
  if (r.off) parts.push(`${r.off} off the flow`)
  return parts.join(' · ')
}

export function GcBoardByTrade({ ctx, companies, onOpen }: { ctx: BoardContext; companies: readonly BoardCompany[]; onOpen: (chip: TradeChip) => void }) {
  const rows = byTrade(ctx, companies)
  if (!rows.length) return <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No trade partner yet.</p>
  return (
    <div>
      {rows.map((r) => (
        <div key={r.trade} data-board-trade={r.trade} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', padding: '0.5rem 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ flex: '0 0 180px', minWidth: 140, fontWeight: 600, fontSize: '0.9rem' }}>
            {r.trade}
            <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{headWords(r)}</span>
          </div>
          <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
            {r.chips.map((c) => {
              const late = c.tone === 'late'
              const job = c.jobId ? ctx.jobs[c.jobId]?.name : null
              return (
                <button
                  key={c.contactId}
                  type="button"
                  onClick={() => onOpen(c)}
                  title={c.off ? `Off the flow since ${shortDate(c.off.since)}: ${c.off.why}` : c.step ? `${c.name} is on ${c.step.name}${job ? ` for ${job}` : ''}.` : `${c.name} is set up and on no step.`}
                  style={{
                    border: `1px solid ${late ? 'var(--border-red)' : 'var(--border-strong)'}`,
                    background: late ? 'var(--bg-red-tint)' : 'var(--surface)',
                    color: c.off ? 'var(--text-muted)' : 'inherit',
                    borderRadius: 999,
                    padding: '0.15rem 0.6rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  {c.name}
                  {!c.off && <span style={{ color: 'var(--text-600)' }}> · {c.step ? `${c.step.name}${job ? ` · ${job}` : ''}` : 'set up'}</span>}
                  {c.words && <span style={{ marginLeft: 6, color: c.off ? 'var(--text-muted)' : WORDS_COLOR[c.tone], fontWeight: late ? 600 : 400 }}>{c.words}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
