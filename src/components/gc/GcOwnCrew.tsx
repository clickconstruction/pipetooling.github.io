import { useEffect, useState } from 'react'
import { Btn, Card, Chip, Stat, input } from './gcUi'
import { ownCrewWork } from '../../lib/gc/building'
import { crewPercentOf, ownCrewWords, type CrewJobRead } from '../../lib/gc/crewJobRows'
import type { CrewJobHit } from '../../lib/gc/crewJobIo'
import type { TradePackage } from '../../lib/gc/types'
import { money, shortDate } from '../../lib/gc/words'

/**
 * GC mode, the real build, the Building lane's U8: a trade our own crew does, on Draws (the prototype's
 * `GcBuildingCrewCard`, branch spike/gc-mode). It has no statement of work, no draws, no retainage and no waivers:
 * we pay our own crew through payroll. Its stages read from its Pipeline job, each with the day it was reported,
 * and nothing here is typed. The picker names the job, a dev's while Building is built. The plan:
 * to-dos/gc-mode/mockups/building-u8.md.
 */

/** The picker's three calls. Absent: the card reads only. */
export interface OwnCrewWrites {
  /** Names the trade's job, or lets go (null). True once it is saved. */
  onLink: (packageId: string, jobId: string | null) => Promise<boolean>
  onSearch: (text: string) => Promise<CrewJobHit[]>
  /** The jobs on this GC job, or from our own bid for the trade. */
  onSuggest: (packageId: string) => Promise<CrewJobHit[]>
}

export function GcOwnCrewCard({
  pkg,
  linked,
  read,
  held = {},
  writes,
  busy = false,
}: {
  pkg: TradePackage
  linked: boolean
  read: CrewJobRead | null
  /** The Pipeline jobs another crew trade holds, by id, to where (one job per crew trade, call 11): shown, not picked. */
  held?: Record<string, string>
  writes?: OwnCrewWrites
  busy?: boolean
}) {
  const [picking, setPicking] = useState(false)
  const crew = ownCrewWork(pkg)
  if (!crew) return null
  const days = read ? crewPercentOf(pkg, read).reportedByLine : {}
  const bar = (pct: number) => (
    <span className="gcBar" title={`${pct}% done`} style={{ position: 'relative', height: 10, borderRadius: 5, background: 'var(--bg-muted)', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', inset: 0, width: `${Math.min(100, Math.max(0, pct))}%`, background: '#93c5fd' }} />
    </span>
  )
  return (
    <Card>
      <div data-own-crew={pkg.id} style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>
            <strong>{pkg.trade}</strong> · our own crew
          </span>
          {linked ? <Chip tone="violet">{read ? `Pipeline job ${read.label}` : 'Pipeline job'}</Chip> : <Chip tone="amber">No Pipeline job yet</Chip>}
          {writes && !picking && (
            <Btn kind="quiet" onClick={() => setPicking(true)} disabled={busy}>
              {linked ? 'Change' : 'Pick its Pipeline job'}
            </Btn>
          )}
        </div>
        <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap' }}>
          <Stat label="Our number" value={money(crew.worth)} />
          <Stat label="Done" value={money(crew.done)} />
          <Stat label="Left" value={money(crew.worth - crew.done)} />
        </div>
      </div>
      {writes && picking && <JobPicker pkg={pkg} linked={linked} held={held} writes={writes} busy={busy} onDone={() => setPicking(false)} />}
      <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.7rem' }}>
        {crew.byStage &&
          crew.stages.map((st) => (
            <div key={st.lineId} className="gcBar-row" data-own-crew-stage={st.lineId}>
              <span>
                {st.label} · {money((crew.worth * st.weight) / 100)}
              </span>
              {bar(st.pct)}
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(st.pct)}%{days[st.lineId] ? ` · ${shortDate(days[st.lineId] ?? null)}` : ''}
              </span>
            </div>
          ))}
        <div className="gcBar-row" style={{ fontWeight: 600 }}>
          <span>The whole trade</span>
          {bar(crew.pct)}
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{crew.pct}% done</span>
        </div>
      </div>
      <div style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'grid', gap: '0.2rem' }}>
        <span data-own-crew-words>{ownCrewWords(pkg, linked, read)}</span>
        <span>We pay our own crew through payroll. There are no draws, retainage or waivers here.</span>
      </div>
    </Card>
  )
}

/** The Pipeline jobs to pick from: the ones on this job first, then a search. */
function JobPicker({
  pkg,
  linked,
  held,
  writes,
  busy,
  onDone,
}: {
  pkg: TradePackage
  linked: boolean
  held: Record<string, string>
  writes: OwnCrewWrites
  busy: boolean
  onDone: () => void
}) {
  const [suggested, setSuggested] = useState<CrewJobHit[]>([])
  const [text, setText] = useState('')
  const [hits, setHits] = useState<CrewJobHit[] | null>(null)
  useEffect(() => {
    let live = true
    void writes
      .onSuggest(pkg.id)
      .then((list) => {
        if (live) setSuggested(list)
      })
      .catch(() => {
        if (live) setSuggested([])
      })
    return () => {
      live = false
    }
  }, [writes, pkg.id])
  useEffect(() => {
    if (!text.trim()) {
      setHits(null)
      return
    }
    let live = true
    const timer = setTimeout(() => {
      void writes
        .onSearch(text)
        .then((list) => {
          if (live) setHits(list)
        })
        .catch(() => {
          if (live) setHits([])
        })
    }, 250)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [writes, text])
  const use = (jobId: string | null) => {
    void writes.onLink(pkg.id, jobId).then((saved) => {
      if (saved) onDone()
    })
  }
  // A job another crew trade holds shows below the free ones, said and not picked (call 11, amendment 3).
  const freeFirst = (list: CrewJobHit[]) => [...list].sort((a, b) => Number(a.id in held) - Number(b.id in held))
  const row = (hit: CrewJobHit) => (
    <li key={hit.id} data-crew-job-hit={hit.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <span>
        <strong>{hit.label}</strong> · {hit.name}
        {hit.address && <span style={{ color: 'var(--text-muted)' }}> · {hit.address}</span>}
      </span>
      {hit.id in held ? (
        <span data-crew-job-held style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>On {held[hit.id]} already</span>
          <Btn onClick={() => undefined} disabled>
            Use this job
          </Btn>
        </span>
      ) : (
        <Btn onClick={() => use(hit.id)} disabled={busy}>
          Use this job
        </Btn>
      )}
    </li>
  )
  return (
    <div data-crew-job-picker style={{ marginTop: '0.6rem', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
      {suggested.length > 0 && (
        <div style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={{ fontWeight: 600 }}>Suggested</span>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.3rem' }}>{freeFirst(suggested).map(row)}</ul>
        </div>
      )}
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Job number, name or address" aria-label="Find the Pipeline job" style={{ ...input, width: '100%' }} />
      {hits && hits.length === 0 && <span style={{ color: 'var(--text-muted)' }}>No job matches. Try its number.</span>}
      {hits && hits.length > 0 && <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.3rem' }}>{freeFirst(hits.slice(0, 8)).map(row)}</ul>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {linked && (
          <Btn onClick={() => use(null)} disabled={busy}>
            Unlink it
          </Btn>
        )}
        <Btn kind="quiet" onClick={onDone}>
          Cancel
        </Btn>
      </div>
    </div>
  )
}
