/**
 * What makes up what we owe one person (punch list #346, PR 1): the block under a sub's row on People → Subs, and
 * the sheet a phone's card opens. Jobs, the sheets on each, and under a sheet its lines, payments and back-charges.
 * The strip and the foot are the kernel's sums (`subOwedBreakdown`), and the tick draws only when they agree.
 *
 * It records nothing. Pay…, Back-charge… and the papers are presses the page hands in, and each opens the window
 * that already owns that act.
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import { owedCheck, owedMoney, owedSettledWords, owedSheetMoneyWords, owedView, type OwedPerson, type OwedSheet } from '../../lib/people/subOwedBreakdown'
import { rodeAlongWords } from '../../lib/subWorkOrders/teamSheetRule'
import type { SheetPayWhen } from '../../lib/subWorkOrders/subLaborPayRun'
import { MoneyText } from '../Money'

export type SubOwedBlockProps = {
  person: OwedPerson | null
  name: string
  /** The figure in the roster's column, to hold the block's sum against; null where there is no column. */
  balanceDue: number | null
  narrow?: boolean
  onOpenJob?: (jobId: string) => void
  onOpenSheet?: (sheetId: string) => void
  onOpenPayRun?: () => void
  /** The ledger of card #347 for this person. */
  onByDate?: () => void
  /** PR 3: the Pay view's own windows, opened on one sheet. */
  onPay?: (sheetId: string) => void
  onBackcharge?: (sheetId: string) => void
  /** Card #350's papers. */
  onStatement?: () => void
  onWorkStatement?: (sheetId: string) => void
  onClose?: () => void
}

const TONE: Record<SheetPayWhen['tone'], { background: string; color: string }> = {
  green: { background: 'var(--bg-green-tint)', color: 'var(--text-green-600)' },
  blue: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
  amber: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  red: { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' },
  violet: { background: 'var(--bg-violet-100)', color: 'var(--text-violet-700)' },
  gray: { background: 'var(--bg-neutral-100)', color: 'var(--text-muted)' },
}

const chip = (tone: SheetPayWhen['tone']): CSSProperties => ({ ...TONE[tone], fontSize: '0.7rem', fontWeight: 650, borderRadius: 999, padding: '0.08rem 0.5rem', whiteSpace: 'nowrap' })
const door: CSSProperties = { padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-link)', fontFamily: 'inherit', whiteSpace: 'nowrap' }
const quiet: CSSProperties = { font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap' }
const press: CSSProperties = { font: 'inherit', fontSize: '0.75rem', fontWeight: 650, padding: '0.2rem 0.65rem', borderRadius: 6, border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }
const num: CSSProperties = { fontVariantNumeric: 'tabular-nums', textAlign: 'right' }
const pill = (on: boolean): CSSProperties => ({ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.65rem', borderRadius: 999, border: `1px solid ${on ? 'var(--border-blue)' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-700)' : 'var(--text-700)', cursor: 'pointer' })

function Eq({ label, value, total }: { label: string; value: number; total?: boolean }) {
  return (
    <span style={{ display: 'grid', gap: 1 }}>
      <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)' }}>{label}</span>
      <b style={{ fontVariantNumeric: 'tabular-nums', fontSize: total ? '1.02rem' : '0.92rem', color: 'var(--text-strong)' }}><MoneyText text={owedMoney(value)} /></b>
    </span>
  )
}

const sign = (s: string): ReactNode => <i style={{ fontStyle: 'normal', color: 'var(--text-faint)', alignSelf: 'end', paddingBottom: 2 }}>{s}</i>

export function SubOwedBlock({ person, name, balanceDue, narrow = false, onOpenJob, onOpenSheet, onOpenPayRun, onByDate, onPay, onBackcharge, onStatement, onWorkStatement, onClose }: SubOwedBlockProps) {
  const [show, setShow] = useState<'open' | 'paid'>('open')
  const [openSheets, setOpenSheets] = useState<Set<string>>(new Set())
  const open = owedView(person, 'open')
  const paid = owedView(person, 'paid')
  const view = show === 'open' ? open : paid
  const check = owedCheck(open, balanceDue)
  const allGood = check.stripAddsUp && check.jobsAddUp && check.matchesColumn !== false
  const toggle = (id: string) =>
    setOpenSheets((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const sheetDetail = (s: OwedSheet) => (
    <div style={{ margin: '0.3rem 0 0.2rem', padding: '0.35rem 0.6rem', borderLeft: '2px solid var(--border)', display: 'grid', gap: 2, fontSize: '0.8rem' }}>
      {s.lines.map((l, i) => (
        <div key={`l${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{l.label}</span>
          <span style={num}><MoneyText text={owedMoney(l.amount)} /></span>
        </div>
      ))}
      {s.reconstructed ? <div style={{ color: 'var(--text-muted)' }}>No priced lines. The total is read back from the money moved.</div> : null}
      {s.money.map((m) => (
        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: m.kind === 'backcharge' ? 'var(--text-red-700)' : 'var(--text-green-700)' }}>
          <span>{m.words}</span>
          <span style={num}>−<MoneyText text={owedMoney(m.amount)} /></span>
        </div>
      ))}
      {s.withNames.length > 0 ? <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{rodeAlongWords(s.withNames, name)}</div> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {onBackcharge ? (
          <button type="button" style={quiet} onClick={() => onBackcharge(s.id)}>
            Back-charge…
          </button>
        ) : null}
        {onWorkStatement ? (
          <button type="button" style={quiet} onClick={() => onWorkStatement(s.id)}>
            Work statement…
          </button>
        ) : null}
      </div>
    </div>
  )

  const standing = (s: OwedSheet) =>
    s.settled ? (
      <span style={chip('green')}><MoneyText text={owedSettledWords(s)} /></span>
    ) : s.payWhen ? (
      <span style={chip(s.payWhen.tone)} title={s.payWhen.detail}>
        {s.payWhen.label}
      </span>
    ) : null

  return (
    <div data-testid="sub-owed-block" style={{ margin: narrow ? 0 : '0.75rem 0', border: narrow ? 'none' : '1px solid var(--border)', borderRadius: 8, padding: narrow ? 0 : '0.7rem 0.9rem', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.75rem' }}>
        <b style={{ fontSize: narrow ? '1rem' : '0.875rem' }}>{narrow ? name : <MoneyText text={`What makes up ${owedMoney(open.open)}`} />}</b>
        {!narrow ? (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {name}
            {open.sheetCount > 0 ? ` · ${open.sheetCount} open ${open.sheetCount === 1 ? 'sheet' : 'sheets'} on ${open.jobCount} ${open.jobCount === 1 ? 'job' : 'jobs'}` : ' · nothing open'}
          </span>
        ) : null}
        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <button type="button" aria-pressed={show === 'open'} style={pill(show === 'open')} onClick={() => setShow('open')}>
            Open · {open.sheetCount}
          </button>
          <button type="button" aria-pressed={show === 'paid'} style={pill(show === 'paid')} onClick={() => setShow('paid')}>
            Paid · {paid.sheetCount}
          </button>
          {onByDate ? (
            <button type="button" style={quiet} onClick={onByDate}>
              By date ›
            </button>
          ) : null}
          {onStatement ? (
            <button type="button" style={quiet} onClick={onStatement}>
              Statement of account…
            </button>
          ) : null}
          {onClose ? (
            <button type="button" style={quiet} onClick={onClose}>
              Close
            </button>
          ) : null}
        </span>
      </div>

      <div data-testid="sub-owed-strip" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: '0.4rem 0.9rem', margin: '0.6rem 0', padding: '0.5rem 0.7rem', background: 'var(--bg-page)', borderRadius: 6 }}>
        <Eq label="Agreed" value={view.agreed} />
        {sign('−')}
        <Eq label="Paid" value={view.paid} />
        {sign('−')}
        <Eq label={narrow ? 'Back-ch.' : 'Back-charged'} value={view.backcharged} />
        {sign('=')}
        <Eq label={show === 'open' ? 'Still open' : 'Open'} value={view.open} total />
        {show === 'open' ? (
          <span data-testid="sub-owed-check" style={{ marginLeft: 'auto', fontSize: '0.78rem', fontWeight: 650, color: allGood ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>
            {allGood ? (balanceDue == null ? '✓ adds up' : '✓ the figure in the column') : check.problem}
          </span>
        ) : (
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>the history · nothing here is owed</span>
        )}
      </div>

      {view.jobs.length === 0 ? (
        <p style={{ margin: '0.4rem 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {show === 'open' ? `Nothing waiting on ${name}. Every sheet is paid.` : `${name} has no paid sheets yet. A sheet lands here once its balance is zero.`}
        </p>
      ) : null}

      {!narrow && view.jobs.length > 0 ? (
        <div aria-hidden style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) repeat(4, 6.2rem)', gap: 8, fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', marginTop: 4 }}>
          <span />
          <span style={num}>Agreed</span>
          <span style={num}>Paid</span>
          <span style={num}>Back-ch.</span>
          <span style={num}>Open</span>
        </div>
      ) : null}

      {view.jobs.map((j) => (
        <div key={j.key} style={{ marginTop: '0.55rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.3rem 0.6rem', fontSize: '0.8125rem', fontWeight: 650, borderBottom: '1px solid var(--border)', paddingBottom: 3 }}>
            {j.number ? <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', fontWeight: 700, background: 'var(--bg-neutral-100)', color: 'var(--text-700)', borderRadius: 5, padding: '0.05rem 0.35rem' }}>#{j.number}</span> : null}
            <span>{j.name || j.address || 'A sheet on no job'}</span>
            {j.name && j.address && !narrow ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{j.address}</span> : null}
            {j.jobId && onOpenJob ? (
              <button type="button" style={door} onClick={() => onOpenJob(j.jobId!)}>
                Open the job ›
              </button>
            ) : null}
            <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{show === 'open' ? <MoneyText text={`${owedMoney(j.open)} open`} /> : <MoneyText text={`${owedMoney(j.agreed)} agreed`} />}</span>
          </div>
          {j.sheets.map((s) => {
            const isOpen = openSheets.has(s.id)
            return narrow ? (
              <div key={s.id} style={{ margin: '0.4rem 0', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.65rem' }}>
                <button type="button" aria-expanded={isOpen} onClick={() => toggle(s.id)} style={{ all: 'unset', display: 'flex', justifyContent: 'space-between', width: '100%', cursor: 'pointer', fontWeight: 650, fontSize: '0.875rem' }}>
                  <span>
                    {isOpen ? '▾' : '▸'} {s.title}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}><MoneyText text={owedMoney(show === 'open' ? s.open : s.agreed)} /></span>
                </button>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}><MoneyText text={owedSheetMoneyWords(s)} /></div>
                {s.withNames.length > 0 ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>with {s.withNames.join(', ')}</div> : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 5 }}>
                  {standing(s)}
                  {!s.settled && s.payWhen?.kind === 'ready' && onPay ? (
                    <button type="button" style={press} onClick={() => onPay(s.id)}>
                      Pay <MoneyText text={owedMoney(s.open)} />…
                    </button>
                  ) : null}
                  {onOpenSheet ? (
                    <button type="button" style={door} onClick={() => onOpenSheet(s.id)}>
                      Open the sheet ›
                    </button>
                  ) : null}
                </div>
                {isOpen ? sheetDetail(s) : null}
              </div>
            ) : (
              <div key={s.id} style={{ padding: '0.3rem 0', borderBottom: '1px dashed var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) repeat(4, 6.2rem)', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
                  <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem 0.55rem', minWidth: 0 }}>
                    <button type="button" aria-expanded={isOpen} onClick={() => toggle(s.id)} style={{ all: 'unset', cursor: 'pointer', fontWeight: 650 }}>
                      {isOpen ? '▾' : '▸'} {s.title}
                    </button>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{s.withNames.length > 0 ? `with ${s.withNames.join(', ')}` : `${s.lines.length} ${s.lines.length === 1 ? 'line' : 'lines'}`}</span>
                    {standing(s)}
                    {onOpenSheet ? (
                      <button type="button" style={door} onClick={() => onOpenSheet(s.id)}>
                        Open the sheet ›
                      </button>
                    ) : null}
                    {!s.settled && s.payWhen?.kind === 'ready' && onPay ? (
                      <button type="button" style={press} onClick={() => onPay(s.id)}>
                        Pay <MoneyText text={owedMoney(s.open)} />…
                      </button>
                    ) : null}
                  </span>
                  <span style={num}><MoneyText text={owedMoney(s.agreed)} /></span>
                  <span style={num}>{s.paid > 0 ? <MoneyText text={owedMoney(s.paid)} /> : '—'}</span>
                  <span style={num}>{s.backcharged > 0 ? <MoneyText text={owedMoney(s.backcharged)} /> : '—'}</span>
                  <b style={num}><MoneyText text={owedMoney(s.open)} /></b>
                </div>
                {isOpen ? sheetDetail(s) : null}
              </div>
            )
          })}
        </div>
      ))}

      {show === 'open' && view.jobs.length > 0 ? (
        <div data-testid="sub-owed-foot" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem 0.8rem', marginTop: '0.6rem', paddingTop: '0.45rem', borderTop: '1px solid var(--border)', fontSize: '0.8125rem' }}>
          <span>{check.sumWords}</span>
          {allGood ? <span style={{ color: 'var(--text-green-700)', fontWeight: 650 }}>{balanceDue == null ? '✓ adds up' : '✓ adds up to Balance due'}</span> : null}
          {onOpenPayRun ? (
            <button type="button" style={{ ...door, marginLeft: 'auto' }} onClick={onOpenPayRun}>
              Open {name} in the pay run ›
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default SubOwedBlock
