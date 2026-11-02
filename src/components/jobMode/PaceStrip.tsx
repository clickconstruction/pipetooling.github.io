import { useState, type CSSProperties } from 'react'
import type { SuperintendentLine } from '../../lib/jobs/superintendentLine'

/**
 * The pace strip (design spike, punch list #234): one picture instead of three
 * sentences. The track is the hours budget. The amber fill is the hours used,
 * drawn as the job's real days — one segment per work date, as wide as that
 * day's hours, each a press that opens the day — and the empty rest is sliced
 * by the job's own crew day: the days left at this pace. The thin red fill
 * under it is the money spent and the blue mark is the work done. The gap
 * between the mark and the fill IS ahead or behind; a chip at the mark says
 * the days, nothing more.
 */
const track: CSSProperties = { position: 'relative', height: 22, borderRadius: 6, background: 'var(--border)', overflow: 'visible' }

export type PaceStripStage = { name: string; /** This stage's share of the track, in hours. */ hours: number; /** The same share in labor dollars, when the lines carry one. */ laborUsd?: number; /** The crew's report on this stage, when it has one. */ pctDone: number | null }

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const dateWords = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/**
 * The card off the cursor at a stage's end bar: what the stage is, what the
 * budget set aside to reach this point, and where the crew stands against it.
 */
function StageEndCard({ x, y, name, index, count, stageHours, stageUsd, toHereHours, toHereUsd, days }: { x: number; y: number; name: string; index: number; count: number; stageHours: number; stageUsd: number | null; toHereHours: number; toHereUsd: number | null; days: ReadonlyArray<{ ymd: string; hours: number }> }) {
  const width = 280
  const left = Math.max(8, Math.min(x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - width - 8))
  const flip = typeof window !== 'undefined' && y > window.innerHeight * 0.6
  // Where the crew stands against this point: the day their hours crossed it, or how far short they are.
  let acc = 0
  let crossed: { ymd: string; at: number } | null = null
  for (const d of days) {
    acc += Math.max(0, d.hours)
    if (!crossed && acc >= toHereHours) crossed = { ymd: d.ymd, at: acc }
  }
  const crew = crossed ? `The crew passed here on ${dateWords(crossed.ymd)}, ${Math.round(crossed.at)} h in.` : acc > 0 ? `The crew is ${Math.round(toHereHours - acc)} h short of here, ${Math.round(acc)} h in.` : 'No hours on the job yet.'
  const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.82rem', padding: '0.18rem 0', borderTop: '1px solid var(--border)' }
  const num: CSSProperties = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: 700 }
  return (
    <div data-testid="stage-end-card" style={{ position: 'fixed', left, top: flip ? undefined : y + 16, bottom: flip ? window.innerHeight - y + 12 : undefined, width, zIndex: 1200, pointerEvents: 'none', background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.28)', padding: '0.55rem 0.7rem', display: 'grid', gap: 2 }}>
      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>End of {name}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>stage {index + 1} of {count}</div>
      <div style={row}><span>Budget to reach here</span><span style={num}>{Math.round(toHereHours)} h{toHereUsd != null ? ` · ${usd(toHereUsd)}` : ''}</span></div>
      <div style={row}><span>{name} alone</span><span style={num}>{Math.round(stageHours)} h{stageUsd != null ? ` · ${usd(stageUsd)}` : ''}</span></div>
      <div style={{ ...row, color: crossed ? undefined : 'var(--text-muted)' }}><span>{crew}</span></div>
    </div>
  )
}

export function PaceStrip({ line, hoursBudget, targetHours, days = [], stages = [], stageWords = false, onDay, onDayHover, height = 22, compact = false }: { line: SuperintendentLine; /** The track's length in hours: the labor budget. */ hoursBudget?: number; /** The expected hours, drawn as a mark inside the budget when they differ from it. */ targetHours?: number; /** The job's stages in order, each as its share of the budget; the track is divided where each one ends. */ stages?: ReadonlyArray<PaceStripStage>; /** Draw each stage's name under its piece of the track (the large view); the card keeps names to the hover. */ stageWords?: boolean; /** The job's work dates with their hours, for the real segments. */ days?: ReadonlyArray<{ ymd: string; hours: number }>; /** A tap on a day (the phone's door). */ onDay?: (ymd: string) => void; /** The pointer over a day, with where it is; null when it leaves. */ onDayHover?: (ymd: string | null, x: number, y: number) => void; height?: number; compact?: boolean }) {
  const hours = Math.min(100, line.hoursPct)
  const done = line.donePct
  const moneyPct = line.money ? Math.round(line.money.spentPct) : null
  const moneyFill = moneyPct != null ? Math.min(100, Math.max(0, moneyPct)) : null
  const behind = line.tone === 'behind'
  const fill = behind ? '#ef4444' : '#f59e0b'
  const chip = line.tone === 'early' ? null : line.money?.wrong ? 'budget?' : line.money?.leads && line.days <= 0 ? 'money ahead' : line.tone === 'even' ? 'on pace' : `${line.days > 0 ? '+' : ''}${line.days} d`
  const chipColor = behind ? 'var(--text-red-700)' : line.tone === 'ahead' ? 'var(--text-green-700)' : 'var(--text-700)'
  const budget = hoursBudget && hoursBudget > 0 ? hoursBudget : 0
  // The real days, laid end to end from the left; each one as wide as its hours.
  const segments: Array<{ ymd: string; hours: number; left: number; width: number }> = []
  let acc = 0
  if (budget > 0) {
    for (const d of days) {
      if (d.hours <= 0) continue
      const left = Math.min(100, (acc / budget) * 100)
      const width = Math.max(0, Math.min(100 - left, (d.hours / budget) * 100))
      segments.push({ ymd: d.ymd, hours: d.hours, left, width })
      acc += d.hours
    }
  }
  const drawn = segments.length > 0
  const usedPct = drawn ? Math.min(100, (acc / budget) * 100) : hours
  // The days left: slices by the crew day from the end of the real days, only when a slice reads.
  const dayPct = budget > 0 && line.hoursPerDay > 0 ? (line.hoursPerDay / budget) * 100 : 0
  const ticks: number[] = []
  if (dayPct >= 2) for (let p = usedPct + dayPct; p < 100; p += dayPct) ticks.push(p)
  const daysLeftWords = line.daysLeft != null && line.tone !== 'early' ? `${line.daysLeft < 1 ? '<1' : Math.round(line.daysLeft)} d left` : null
  // The target inside the budget: a dashed mark where the expected hours end, when the leader set them short of the budget.
  const targetPct = budget > 0 && targetHours != null && targetHours > 0 && Math.round(targetHours) < Math.round(budget) ? Math.min(100, (targetHours / budget) * 100) : null
  // The stages, each as a piece of the track from where the one before ended.
  const pieces: Array<{ name: string; left: number; width: number; hours: number; laborUsd: number | null; toHereHours: number; toHereUsd: number | null; pctDone: number | null; last: boolean }> = []
  if (budget > 0 && stages.length >= 2) {
    let at = 0
    let usdAt = 0
    const priced = stages.every((s) => s.laborUsd != null)
    stages.forEach((s, i) => {
      const left = Math.min(100, (at / budget) * 100)
      const width = Math.max(0, Math.min(100 - left, (s.hours / budget) * 100))
      at += s.hours
      usdAt += s.laborUsd ?? 0
      pieces.push({ name: s.name, left, width, hours: s.hours, laborUsd: priced ? (s.laborUsd ?? 0) : null, toHereHours: at, toHereUsd: priced ? usdAt : null, pctDone: s.pctDone, last: i === stages.length - 1 })
    })
  }
  const [stageHover, setStageHover] = useState<{ index: number; x: number; y: number } | null>(null)
  // A line's name can be a paragraph; the strip shows its first words.
  const shortName = (name: string) => (name.length > 36 ? `${name.slice(0, 34).trimEnd()}…` : name)
  const pieceTitle = (p: { name: string; hours: number; pctDone: number | null }) => `${shortName(p.name)} · ${Math.round(p.hours)} h of the budget${p.pctDone != null ? ` · ${Math.round(p.pctDone)}% done` : ''}`
  const dayTitle = (s: { ymd: string; hours: number }) => `${new Date(`${s.ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} · ${Math.round(s.hours * 10) / 10} h · tap for the day`
  return (
    <div style={{ display: 'grid', gap: 4 }} data-testid="pace-strip">
      <div style={{ ...track, height }} aria-label={line.headline} title={`${line.headline} ${line.hoursWords} · ${Math.round(line.hoursPerDay)} h a day${line.hoursPerDayRead ? '' : ' (assumed)'}`}>
        {/* The stages under everything: a named piece of the track each, so the empty track says which stage it is. */}
        {pieces.map((p) => (
          <div key={`piece-${p.name}-${p.left}`} data-testid="pace-stage" title={pieceTitle(p)} aria-label={pieceTitle(p)} style={{ position: 'absolute', top: 0, bottom: 0, left: `${p.left}%`, width: `${p.width}%` }}>
            {p.pctDone != null && p.pctDone > 0 ? <div style={{ position: 'absolute', top: 0, left: 0, height: 3, width: `${Math.min(100, p.pctDone)}%`, background: '#2563eb', opacity: 0.9, pointerEvents: 'none' }} /> : null}
          </div>
        ))}
        {drawn ? (
          segments.map((s, i) => (
            <button
              key={s.ymd}
              type="button"
              data-testid="pace-day"
              aria-label={dayTitle(s)}
              title={dayTitle(s)}
              onClick={onDay ? () => onDay(s.ymd) : undefined}
              onMouseEnter={onDayHover ? (e) => onDayHover(s.ymd, e.clientX, e.clientY) : undefined}
              onMouseMove={onDayHover ? (e) => onDayHover(s.ymd, e.clientX, e.clientY) : undefined}
              onMouseLeave={onDayHover ? () => onDayHover(null, 0, 0) : undefined}
              style={{ position: 'absolute', top: 0, bottom: 0, left: `${s.left}%`, width: `calc(${s.width}% - 1px)`, background: fill, opacity: 0.85, border: 'none', padding: 0, margin: 0, cursor: onDay ? 'pointer' : 'default', borderRadius: i === 0 ? '6px 0 0 6px' : 0 }}
            />
          ))
        ) : (
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${hours}%`, background: fill, opacity: 0.85, borderRadius: 6 }} />
        )}
        {ticks.map((p) => (
          <div key={p} style={{ position: 'absolute', top: 0, bottom: 0, left: `${p}%`, width: 1, background: 'rgba(127,127,127,0.35)' }} />
        ))}
        {/* The dividers over the fills, so a stage's end reads through the days; each a wide hover target with the stage's card. */}
        {pieces.map((p, i) => (!p.last && p.width > 0 ? (
          <div
            key={`div-${p.name}-${p.left}`}
            data-testid="pace-stage-end"
            aria-label={`End of ${shortName(p.name)}: ${Math.round(p.toHereHours)} h of the budget to here`}
            onMouseEnter={(e) => setStageHover({ index: i, x: e.clientX, y: e.clientY })}
            onMouseMove={(e) => setStageHover({ index: i, x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setStageHover(null)}
            style={{ position: 'absolute', top: -4, bottom: -4, left: `calc(${p.left + p.width}% - 6px)`, width: 12, cursor: 'help', zIndex: 2 }}
          >
            <div style={{ position: 'absolute', top: 2, bottom: 2, left: 5, width: 2, background: 'var(--surface)', boxShadow: '0 0 0 1px var(--text-muted)' }} />
          </div>
        ) : null))}
        {moneyFill != null ? <div style={{ position: 'absolute', left: 0, bottom: 2, height: 3, width: `${moneyFill}%`, background: line.money?.leads ? '#b91c1c' : 'var(--text-muted)', borderRadius: 2, pointerEvents: 'none' }} /> : null}
        {targetPct != null ? <div title={`expected ${Math.round(targetHours!)} h`} style={{ position: 'absolute', top: -4, bottom: -4, left: `calc(${targetPct}% - 1px)`, width: 0, borderLeft: '2px dashed var(--text-strong)', pointerEvents: 'none' }} /> : null}
        {targetPct != null ? <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${targetPct}%`, right: 0, background: 'repeating-linear-gradient(135deg, transparent 0 4px, rgba(127,127,127,0.18) 4px 6px)', pointerEvents: 'none', borderRadius: '0 6px 6px 0' }} /> : null}
        {line.tone !== 'early' ? <div style={{ position: 'absolute', top: -3, bottom: -3, left: `calc(${done}% - 2px)`, width: 4, background: '#2563eb', borderRadius: 2, pointerEvents: 'none' }} /> : null}
        {chip ? (
          <span style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: done > 80 ? 'auto' : `calc(${done}% + 8px)`, right: done > 80 ? `calc(${100 - done}% + 8px)` : 'auto', fontSize: compact ? '0.7rem' : '0.74rem', fontWeight: 800, color: chipColor, background: 'var(--surface)', borderRadius: 999, padding: '0 6px', whiteSpace: 'nowrap', lineHeight: '16px', pointerEvents: 'none' }}>{chip}</span>
        ) : null}
        {daysLeftWords && usedPct < 85 && done < 60 ? <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{daysLeftWords}</span> : null}
      </div>
      {stageHover && pieces[stageHover.index] ? (
        <StageEndCard x={stageHover.x} y={stageHover.y} name={shortName(pieces[stageHover.index]!.name)} index={stageHover.index} count={pieces.length} stageHours={pieces[stageHover.index]!.hours} stageUsd={pieces[stageHover.index]!.laborUsd} toHereHours={pieces[stageHover.index]!.toHereHours} toHereUsd={pieces[stageHover.index]!.toHereUsd} days={days} />
      ) : null}
      {stageWords && pieces.length ? (
        <div style={{ position: 'relative', height: 14, fontSize: '0.66rem', color: 'var(--text-muted)' }} data-testid="pace-stage-words">
          {pieces.map((p) => (
            <span key={`word-${p.name}-${p.left}`} title={pieceTitle(p)} style={{ position: 'absolute', left: `${p.left}%`, width: `${p.width}%`, paddingLeft: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', boxSizing: 'border-box', borderLeft: '1px solid var(--border)' }}>
              {shortName(p.name)}{p.pctDone != null ? <span style={{ color: '#2563eb', fontWeight: 700 }}> {Math.round(p.pctDone)}%</span> : null}
            </span>
          ))}
        </div>
      ) : null}
      {!compact ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', gap: 6, flexWrap: 'wrap' }}>
          <span><i style={{ display: 'inline-block', width: 8, height: 8, background: '#2563eb', borderRadius: 2, marginRight: 4 }} />done {Math.round(done)}%</span>
          <span><i style={{ display: 'inline-block', width: 8, height: 8, background: '#f59e0b', borderRadius: 2, marginRight: 4 }} />hours {Math.round(line.hoursPct)}%{drawn ? ` · ${segments.length} days, tap one` : line.daysUsed != null ? ` · ${Math.round(line.daysUsed)} d at ${Math.round(line.hoursPerDay)} h?` : ''}</span>
          {pieces.length && !stageWords ? <span><i style={{ display: 'inline-block', width: 8, height: 8, border: '1px solid var(--text-muted)', borderRadius: 2, marginRight: 4, boxSizing: 'border-box' }} />{pieces.length} stages, hover one</span> : null}
          {moneyPct != null ? <span style={{ color: line.money?.leads ? 'var(--text-red-700)' : undefined }}><i style={{ display: 'inline-block', width: 8, height: 3, background: line.money?.leads ? '#b91c1c' : 'var(--text-muted)', marginRight: 4, verticalAlign: 'middle' }} />money {moneyPct}%</span> : null}
        </div>
      ) : null}
    </div>
  )
}
