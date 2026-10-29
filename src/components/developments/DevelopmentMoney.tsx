/**
 * The Money look (punch list #208, design spike; the owner's pick A1 with S1): the site's band on
 * top (the percent done weighted by value, the bar of paid · billed · done-not-billed · left, the
 * legend, the jobs by stage), then the live jobs in stage sections, each row the Pipeline's cell laid
 * across (progress · money · dates · next). A section head carries its sums and folds to that line;
 * the band folds to one line; the column heads sort the rows inside every section and the chip in
 * the card's head says so; on a phone the sections are heads over cards and an Order row sets the
 * sort. The words and sums come from `siteMoney.ts`; the device memory from `devicePrefs.ts`.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { MONEY_SORT_COLUMN, MONEY_SORT_LABELS, MONEY_SORT_MODES, sortMoneyRows, type MoneyRow, type MoneySection, type MoneySortMode, type SiteMoneyModel } from '../../lib/developments/siteMoney'
import { capStyle, LinkButton, money, shortDay } from './developmentPageBits'

// The Pipeline's own money colors (saturated status colors stay literal by the theme rule).
const PAID = '#16a34a'
const BILLED = '#2563eb'
const UNBILLED = '#f59e0b'

export type DevelopmentMoneyProps = {
  model: SiteMoneyModel
  phone: boolean
  sort: MoneySortMode
  onSort: (mode: MoneySortMode) => void
  isFolded: (key: string, defaultFolded: boolean) => boolean
  onToggleFold: (key: string, defaultFolded: boolean) => void
  openJob: (jobId: string) => void
  onAskForDate: (jobId: string) => void
  onLienDesk: () => void
}

const pluralJobs = (n: number) => `${n} ${n === 1 ? 'job' : 'jobs'}`

function Bar({ value, paid, billed, doneNotBilled, pct, height }: { value: number; paid: number; billed: number; doneNotBilled: number; pct: number | null; height: number }) {
  const w = (n: number) => (value > 0 ? `${Math.min(100, (n / value) * 100)}%` : '0%')
  return (
    <div className="developmentMoneyBar" style={{ height }} aria-hidden>
      <span style={{ width: w(paid), background: PAID }} />
      <span style={{ width: w(billed), background: BILLED }} />
      <span style={{ width: w(doneNotBilled), background: UNBILLED }} />
      {pct != null ? <i className="tick" style={{ left: `${pct}%` }} /> : null}
    </div>
  )
}

function Chevron({ open, label, onClick, testId }: { open: boolean; label: string; onClick: () => void; testId?: string }) {
  return (
    <button type="button" className="developmentChevron" aria-expanded={open} aria-label={label} title={label} onClick={onClick} data-testid={testId}>
      <span aria-hidden>{open ? '▾' : '▸'}</span>
    </button>
  )
}

function Swatch({ color }: { color: string }) {
  return <span aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: color, marginRight: 6, verticalAlign: -1 }} />
}

function sectionSumWords(s: MoneySection): ReactNode {
  if (s.key === 'paid') return `${pluralJobs(s.sums.count)} · ${money(s.sums.paid)} all in`
  const parts: ReactNode[] = [pluralJobs(s.sums.count), `${money(s.sums.left)} left`]
  if (s.sums.doneNotBilled > 0) parts.push(`${money(s.sums.doneNotBilled)} done, not billed`)
  return (
    <>
      {parts.join(' · ')}
      {s.sums.pastDue > 0 ? (
        <>
          {' · '}
          <span style={{ color: 'var(--text-red-700)', fontWeight: 700 }}>
            {s.sums.pastDue} past due
          </span>
        </>
      ) : null}
    </>
  )
}

function lienTone(days: number | null): CSSProperties {
  if (days == null) return {}
  if (days <= 7) return { color: 'var(--text-red-700)' }
  if (days <= 21) return { color: 'var(--text-amber-800)' }
  return {}
}

function Dates({ row, stacked }: { row: MoneyRow; stacked: boolean }) {
  const d = row.dates
  if (!d) return <span style={{ color: 'var(--text-faint)' }}>{row.stageKey === 'paid' ? 'paid' : 'no bill yet'}</span>
  const line: CSSProperties = stacked ? { display: 'contents' } : { display: 'flex', gap: 6, alignItems: 'baseline', whiteSpace: 'nowrap' }
  const dot = (color: string, hollow?: boolean) => <span aria-hidden style={{ width: 7, height: 7, borderRadius: 9999, display: 'inline-block', flex: 'none', background: hollow ? 'transparent' : color, border: hollow ? `1.5px solid ${color}` : 'none', marginRight: stacked ? 4 : 0 }} />
  const exp = d.expected
  return (
    <div style={stacked ? { display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 10px' } : { display: 'grid', gap: 2 }}>
      <div style={line}>
        <span style={{ color: 'var(--text-muted)' }}>
          {dot('var(--text-faint)')} Billed {d.billedYmd ? shortDay(d.billedYmd) : '—'}
        </span>
        <strong style={{ color: 'var(--text-strong)', textAlign: stacked ? 'right' : undefined }}>{d.billedAgoDays != null ? `${d.billedAgoDays}d ago` : ''}</strong>
      </div>
      {exp ? (
        <div style={line}>
          <span style={{ color: exp.state === 'late' ? 'var(--text-red-700)' : 'var(--text-muted)' }} title={exp.title}>
            {dot(exp.state === 'late' ? '#dc2626' : 'var(--text-faint)')} Expected {shortDay(exp.expectedYmd)}
          </span>
          <strong style={{ color: exp.state === 'late' ? 'var(--text-red-700)' : 'var(--text-strong)', textAlign: stacked ? 'right' : undefined }}>{exp.state === 'late' ? `${exp.daysLate}d past` : `in ${Math.max(0, -exp.daysLate) || daysUntil(exp.expectedYmd, d.billedYmd)}d`}</strong>
        </div>
      ) : (
        <div style={line}>
          <span style={{ color: 'var(--text-faint)' }}>{dot('var(--text-faint)')} Expected · no pace on record</span>
          <span />
        </div>
      )}
      {exp ? <div style={{ gridColumn: stacked ? '1 / -1' : undefined, color: 'var(--text-muted)', fontSize: '0.7rem', paddingLeft: 13 }}>{exp.source === 'customer' ? `pays in ~${exp.medianDays}d` : exp.source === 'company' ? `company pace, ~${exp.medianDays}d` : 'promised'}</div> : null}
      {d.lien ? (
        <div style={line}>
          <span style={{ color: 'var(--text-muted)' }} title={d.lien.kindAssumed ? 'The property kind is not set, so the earlier (residential) date is shown.' : undefined}>
            {dot('var(--border-strong)', true)} Lien by {shortDay(d.lien.ymd)}
            {d.lien.kindAssumed ? ' ·' : ''}
            {d.lien.kindAssumed ? <span style={{ color: 'var(--text-faint)' }}> kind assumed</span> : null}
          </span>
          <strong style={{ color: 'var(--text-strong)', textAlign: stacked ? 'right' : undefined, ...lienTone(d.lien.daysLeft) }}>{d.lien.daysLeft != null ? (d.lien.daysLeft < 0 ? 'window closed' : `${d.lien.daysLeft}d`) : ''}</strong>
        </div>
      ) : null}
    </div>
  )
}

function daysUntil(ymd: string, fromYmd: string | null): number {
  if (!fromYmd) return 0
  const a = Date.parse(`${fromYmd}T12:00:00Z`)
  const b = Date.parse(`${ymd}T12:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.round((b - a) / 86_400_000)) : 0
}

function Next({ row, onAskForDate, onLienDesk }: { row: MoneyRow; onAskForDate: (jobId: string) => void; onLienDesk: () => void }) {
  return (
    <div style={{ display: 'grid', gap: 2, fontSize: '0.74rem' }}>
      {row.next.askForDate ? (
        <button type="button" className="developmentAskForDate" onClick={() => onAskForDate(row.jobId)} title="The Pipeline's press; here it opens the job (PR 2 wires the ask)">
          Ask for a date
        </button>
      ) : null}
      {row.next.notice ? (
        <LinkButton onClick={onLienDesk} title="The notice's state is the Lien desk's read (PR 2); the desk shows it">
          the notice · Lien desk ›
        </LinkButton>
      ) : null}
      {row.next.words ? <span style={{ color: 'var(--text-muted)' }}>{row.next.words}</span> : null}
    </div>
  )
}

function Progress({ row, width }: { row: MoneyRow; width: number | string }) {
  const under = row.billed > 0 ? `paid ${money(row.paid)} · billed ${money(row.billed)}` : row.doneNotBilled > 0 ? `done, not billed ${money(row.doneNotBilled)}` : row.paid > 0 ? `paid ${money(row.paid)}` : row.value === 0 ? 'no price yet' : 'nothing paid yet'
  return (
    <div style={{ width, maxWidth: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: '0.76rem', color: 'var(--text-strong)' }}>
        <strong>{row.pct != null ? `${row.pct}%` : '—'}</strong>
        <span>{money(row.value)}</span>
      </div>
      <Bar value={row.value} paid={row.paid} billed={row.billed} doneNotBilled={row.doneNotBilled} pct={row.pct} height={10} />
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{under}</div>
    </div>
  )
}

function Band({ model, folded, onToggle, onShowNoPct }: { model: SiteMoneyModel; folded: boolean; onToggle: () => void; onShowNoPct: () => void }) {
  const b = model.band
  const pctWords = b.pct != null ? `${b.pct}% done` : `no percent yet · ${b.pctMissing} ${b.pctMissing === 1 ? 'job has' : 'jobs have'} none on record`
  if (folded) {
    return (
      <div className="developmentMoneyBand isFolded" data-testid="money-band-folded">
        <Chevron open={false} label="Open the site's bar" onClick={onToggle} testId="money-band-toggle" />
        <strong style={{ color: 'var(--text-strong)' }}>{pctWords}</strong>
        <span style={{ color: 'var(--text-muted)' }}>
          {money(b.value)} on {pluralJobs(b.jobs)}
        </span>
        <strong style={{ color: 'var(--text-strong)' }}>{money(b.left)} left</strong>
        {b.pastDue > 0 ? <span style={{ color: 'var(--text-red-700)', fontWeight: 700 }}>{b.pastDue} past due</span> : null}
      </div>
    )
  }
  const pctOf = (n: number) => (b.value > 0 ? `${Math.round((n / b.value) * 100)}%` : '0%')
  return (
    <div className="developmentMoneyBand" data-testid="money-band">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Chevron open label="Fold the site's bar to one line" onClick={onToggle} testId="money-band-toggle" />
          <strong style={{ fontSize: '1.25rem', color: 'var(--text-strong)' }} title="A site has no percent of its own: each job's percent weighted by its value, the paid ones at 100.">
            {b.pct != null ? `${b.pct}%` : '—'}
          </strong>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            done · weighted by value
            {b.pct == null && b.pctMissing > 0 ? (
              <>
                {' · '}
                <button type="button" className="developmentNoPctPress" onClick={onShowNoPct} title="Sorts every section by percent complete and lights the jobs with none on record" data-testid="money-no-pct-press">
                  {b.pctMissing} {b.pctMissing === 1 ? 'job has' : 'jobs have'} no percent on record ›
                </button>
              </>
            ) : null}
          </span>
        </span>
        <strong style={{ color: 'var(--text-strong)', fontSize: '0.84rem' }}>
          {money(b.value)} on {pluralJobs(b.jobs)}
        </strong>
      </div>
      <Bar value={b.value} paid={b.paid} billed={b.billed} doneNotBilled={b.doneNotBilled} pct={b.pct} height={14} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '2px 16px', fontSize: '0.78rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>
            <Swatch color={PAID} />
            {pctOf(b.paid)} Paid
          </span>
          <span>{money(b.paid)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>
            <Swatch color={BILLED} />
            {pctOf(b.billed)} Billed
          </span>
          <span>{money(b.billed)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>
            <Swatch color={UNBILLED} />
            {pctOf(b.doneNotBilled)} Done, not billed
          </span>
          <span>{money(b.doneNotBilled)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-strong)' }}>
        <span>Left on the site</span>
        <span>{money(b.left)}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
        {b.stages.map((s) => (
          <span key={s.key} style={{ padding: '1px 8px', borderRadius: 9999, border: '1px solid var(--border)' }}>
            <strong style={{ color: 'var(--text-strong)' }}>{s.count}</strong> {s.label.toLowerCase()}
          </span>
        ))}
        {b.bidUndecidedCount > 0 ? (
          <span style={{ padding: '1px 8px', borderRadius: 9999, border: '1px solid var(--bg-amber-200)' }} title="Bids not yet won or lost: money the site may have, not on the bar">
            <strong style={{ color: 'var(--text-strong)' }}>{money(b.bidUndecidedUsd)}</strong> bid, undecided
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function DevelopmentMoney({ model, phone, sort, onSort, isFolded, onToggleFold, openJob, onAskForDate, onLienDesk }: DevelopmentMoneyProps) {
  const bandFolded = isFolded('band', false)
  // The band's *N jobs have no percent on record* is a press: it sorts by percent complete and lights those rows until the order changes again (the owner, 2026-10-28: *do all 8*, item 6).
  const [litNoPct, setLitNoPct] = useState(false)
  const sortFromHead = (mode: MoneySortMode) => {
    setLitNoPct(false)
    onSort(mode)
  }
  const showNoPct = () => {
    setLitNoPct(true)
    onSort('progress')
  }
  // The light goes out with the order, however it changes (the card's Sorted chip clears it too).
  useEffect(() => {
    if (sort !== 'progress') setLitNoPct(false)
  }, [sort])
  const lit = (r: MoneyRow) => litNoPct && r.pct == null && r.value > 0
  if (model.band.jobs === 0) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }} data-testid="money-empty">
        <span className="developmentCountChip">0 jobs</span>
        {model.band.bidUndecidedCount > 0 ? <span className="developmentCountChip">{money(model.band.bidUndecidedUsd)} bid, undecided</span> : null}
        <span>the site's money starts with its first job</span>
      </div>
    )
  }
  const th = (col: 'job' | 'progress' | 'money' | 'dates' | 'next', label: string) => {
    const mode = MONEY_SORT_MODES.find((m) => MONEY_SORT_COLUMN[m] === col)
    const on = mode != null && sort === mode
    return (
      <th style={{ ...capStyle, textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }} aria-sort={on ? 'ascending' : undefined}>
        {mode ? (
          <button type="button" className={`developmentMoneyHead${on ? ' isOn' : ''}`} onClick={() => sortFromHead(mode)} title={`Sort every section by ${MONEY_SORT_LABELS[mode]}`}>
            {label}
            {on ? <span aria-hidden> ▲</span> : null}
          </button>
        ) : (
          label
        )}
      </th>
    )
  }
  const sections = model.sections.map((s) => ({ section: s, rows: sortMoneyRows(s.rows, sort, s.key), folded: isFolded(s.key, s.defaultFolded) }))

  if (phone) {
    return (
      <div style={{ display: 'grid', gap: 8 }} data-testid="development-money">
        <Band model={model} folded={bandFolded} onToggle={() => onToggleFold('band', false)} onShowNoPct={showNoPct} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.74rem', color: 'var(--text-muted)' }} role="radiogroup" aria-label="Order inside each section">
          <span>Order:</span>
          {MONEY_SORT_MODES.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={sort === m} className={`developmentOrderChip${sort === m ? ' isOn' : ''}`} onClick={() => sortFromHead(m)}>
              {MONEY_SORT_LABELS[m]}
            </button>
          ))}
        </div>
        {sections.map(({ section, rows, folded }) => (
          <div key={section.key}>
            <button type="button" className="developmentMoneySec" aria-expanded={!folded} onClick={() => onToggleFold(section.key, section.defaultFolded)} data-testid={`money-section-${section.key}`}>
              <span aria-hidden>{folded ? '▸' : '▾'}</span>
              <strong>{section.label}</strong>
              <span className="sums">{sectionSumWords(section)}</span>
            </button>
            {folded
              ? null
              : rows.map((r) => (
                  <div key={r.key} className={`developmentMoneyCard${lit(r) ? ' isLit' : ''}`} data-testid="money-row">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <LinkButton onClick={() => openJob(r.jobId)} strong nowrap>
                        {r.number}
                      </LinkButton>
                      <span style={{ flex: '1 1 auto', fontWeight: 600, color: 'var(--text-strong)' }}>{r.name || '—'}</span>
                      <strong style={{ whiteSpace: 'nowrap' }}>{money(r.left)} left</strong>
                    </div>
                    <Progress row={r} width="100%" />
                    {r.crew || r.lastWorkYmd ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{[r.crew, r.lastWorkYmd ? `last work ${shortDay(r.lastWorkYmd)}` : null].filter(Boolean).join(' · ')}</div> : null}
                    {r.dates ? (
                      <div style={{ marginTop: 6, fontSize: '0.76rem' }}>
                        <Dates row={r} stacked />
                      </div>
                    ) : null}
                    {r.next.askForDate || r.next.notice || r.next.words ? (
                      <div style={{ marginTop: 4 }}>
                        <Next row={r} onAskForDate={onAskForDate} onLienDesk={onLienDesk} />
                      </div>
                    ) : null}
                  </div>
                ))}
          </div>
        ))}
      </div>
    )
  }

  const td: CSSProperties = { padding: '7px 8px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.78rem' }
  return (
    <div data-testid="development-money">
      <Band model={model} folded={bandFolded} onToggle={() => onToggleFold('band', false)} onShowNoPct={showNoPct} />
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
        <thead>
          <tr>
            {th('job', 'Job')}
            {th('progress', 'Progress')}
            {th('money', 'Money')}
            {th('dates', 'Dates')}
            {th('next', 'Next')}
          </tr>
        </thead>
        <tbody>
          {sections.map(({ section, rows, folded }) => (
            <SectionRows key={section.key} section={section} rows={rows} folded={folded} td={td} onToggle={() => onToggleFold(section.key, section.defaultFolded)} openJob={openJob} onAskForDate={onAskForDate} onLienDesk={onLienDesk} sortWords={sort !== 'tightest' ? `sorted by ${MONEY_SORT_LABELS[sort]}` : null} lit={lit} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionRows({ section, rows, folded, td, onToggle, openJob, onAskForDate, onLienDesk, sortWords, lit }: { section: MoneySection; rows: MoneyRow[]; folded: boolean; td: CSSProperties; onToggle: () => void; openJob: (id: string) => void; onAskForDate: (id: string) => void; onLienDesk: () => void; sortWords: string | null; lit: (r: MoneyRow) => boolean }) {
  return (
    <>
      <tr>
        <td colSpan={5} style={{ padding: 0, borderBottom: '1px solid var(--border)' }}>
          <button type="button" className="developmentMoneySec" aria-expanded={!folded} onClick={onToggle} data-testid={`money-section-${section.key}`}>
            <span aria-hidden>{folded ? '▸' : '▾'}</span>
            <strong>{section.label}</strong>
            <span className="sums">{sectionSumWords(section)}</span>
            <span className="tail">{folded ? 'folded' : sortWords}</span>
          </button>
        </td>
      </tr>
      {folded
        ? null
        : rows.map((r) => (
            <tr key={r.key} className={`developmentMoneyRow${lit(r) ? ' isLit' : ''}`} data-testid="money-row">
              <td style={td}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <LinkButton onClick={() => openJob(r.jobId)} strong nowrap>
                    {r.number}
                  </LinkButton>
                  <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{r.name || '—'}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{[r.crew, r.lastWorkYmd ? `last work ${shortDay(r.lastWorkYmd)}` : null].filter(Boolean).join(' · ') || (r.stageKey === 'waiting' ? 'not scheduled' : '')}</div>
              </td>
              <td style={td}>
                <Progress row={r} width={190} />
              </td>
              <td style={{ ...td, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                <strong style={{ color: 'var(--text-strong)', display: 'block' }}>{money(r.left)} left</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{r.billed > 0 && r.paid === 0 ? 'all of it billed' : r.paid > 0 ? `${money(r.paid)} paid` : r.value === 0 ? 'no price yet' : 'nothing billed yet'}</span>
              </td>
              <td style={td}>
                <Dates row={r} stacked={false} />
              </td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                <Next row={r} onAskForDate={onAskForDate} onLienDesk={onLienDesk} />
              </td>
            </tr>
          ))}
    </>
  )
}
