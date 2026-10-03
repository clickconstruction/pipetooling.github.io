import { useEffect, useMemo, useRef, useState } from 'react'
import {
  currentRev,
  planLabel,
  sheetDiscipline,
  sheetsAtRev,
  shortDate,
  type GcProject,
  type SheetInSet,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
import { Btn, Chip } from './gcUi'
import { PortalNote, PortalWindow } from './GcPortalUi'

/**
 * GC mode design spike: the plans as a trade reads them in its portal. The newest set first, the
 * sheets by discipline with what each set changed marked, and whether a set changes this trade.
 * Nothing about who else opened it: that is the office's to know. The drawings are stand-ins.
 */

export function GcPortalPlans({
  project,
  pkg,
  onClose,
  startSheet,
}: {
  project: GcProject
  pkg: TradePackage
  onClose: () => void
  /** Open on this sheet, when the company tapped a sheet number beside a line of its bid. */
  startSheet?: string
}) {
  const newest = currentRev(project)
  const [rev, setRev] = useState(newest)
  const sheets = useMemo(() => sheetsAtRev(project, rev), [project, rev])
  const [sheetId, setSheetId] = useState(
    () => sheets.find((s) => s.id === startSheet)?.id ?? sheets.find((s) => s.changedInRev === rev && rev > 0)?.id ?? sheets[0]?.id ?? '',
  )
  const index = Math.max(0, sheets.findIndex((s) => s.id === sheetId))
  const sheet = sheets[index]
  const set = project.planSets.find((s) => s.rev === rev)
  const sets = [...project.planSets].sort((a, b) => b.rev - a.rev)
  const activeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [sheetId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
      if (step === 0) return
      e.preventDefault()
      const next = sheets[Math.min(sheets.length - 1, Math.max(0, index + step))]
      if (next) setSheetId(next.id)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sheets, index])

  const groups: { discipline: string; rows: SheetInSet[] }[] = []
  for (const s of sheets) {
    const discipline = sheetDiscipline(s.id)
    const group = groups.find((g) => g.discipline === discipline)
    if (group) group.rows.push(s)
    else groups.push({ discipline, rows: [s] })
  }

  return (
    <PortalWindow
      title={`${project.name} · plans`}
      sub={`${project.address} · drawn by ${project.architect}`}
      onClose={onClose}
      width={1000}
    >
      <div style={{ padding: '0.75rem 0.9rem', display: 'grid', gap: '0.6rem' }}>
        <div role="group" aria-label="Plan set" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {sets.map((s) => {
            const active = s.rev === rev
            return (
              <button
                key={s.rev}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setRev(s.rev)
                  const at = sheetsAtRev(project, s.rev)
                  if (!at.some((x) => x.id === sheetId)) setSheetId(at[0]?.id ?? '')
                }}
                style={{
                  padding: '0.3rem 0.7rem',
                  borderRadius: 999,
                  border: `1px solid ${active ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                  background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: active ? 'var(--text-blue-500)' : 'var(--text-600)',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                {s.label} · {shortDate(s.issuedOn)}
                {s.rev === newest ? ' · newest' : ''}
              </button>
            )
          })}
        </div>

        {set && (
          <PortalNote tone={set.touches.includes(pkg.id) ? 'amber' : 'paper'}>
            <div>
              {rev < newest && <strong>An older set. {planLabel(project, newest)} replaced it. </strong>}
              {set.note}
            </div>
            {rev > 0 && (
              <div>
                {set.touches.includes(pkg.id) ? <strong>This set changes {pkg.trade}.</strong> : <>This set does not change {pkg.trade}.</>}
              </div>
            )}
          </PortalNote>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 13rem', maxHeight: '55vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 8, padding: '0.4rem' }}>
            {groups.map((g) => (
              <div key={g.discipline} style={{ marginBottom: '0.4rem' }}>
                <div style={{ fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
                  {g.discipline}
                </div>
                {g.rows.map((s) => {
                  const active = s.id === sheet?.id
                  return (
                    <button
                      key={s.id}
                      ref={active ? activeRef : undefined}
                      type="button"
                      onClick={() => setSheetId(s.id)}
                      aria-current={active}
                      style={{
                        display: 'flex',
                        gap: '0.4rem',
                        alignItems: 'baseline',
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.3rem 0.4rem',
                        border: 'none',
                        borderRadius: 5,
                        background: active ? 'var(--bg-blue-tint)' : 'transparent',
                        color: 'var(--text-base)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{s.id}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>{s.title}</span>
                      {s.changedInRev === rev && rev > 0 && <Chip tone="amber">{s.added ? 'new' : 'changed'}</Chip>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          <div style={{ flex: '3 1 20rem', minWidth: 0, display: 'grid', gap: '0.5rem' }}>
            {sheet && <StandIn project={project} sheet={sheet} setLabel={planLabel(project, rev)} />}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexWrap: 'wrap' }}>
              <Btn disabled={index === 0} onClick={() => setSheetId(sheets[index - 1]?.id ?? sheetId)}>← Back</Btn>
              <span style={{ opacity: 0.75 }}>
                Sheet {index + 1} of {sheets.length}
              </span>
              <Btn disabled={index >= sheets.length - 1} onClick={() => setSheetId(sheets[index + 1]?.id ?? sheetId)}>Next →</Btn>
            </div>
          </div>
        </div>
      </div>
    </PortalWindow>
  )
}

/** A stand-in drawing: a sheet border, a few lines, the title block. The real build shows the page. */
function StandIn({ project, sheet, setLabel }: { project: GcProject; sheet: SheetInSet; setLabel: string }) {
  return (
    <div
      style={{
        aspectRatio: '4 / 3',
        background: 'var(--surface)',
        border: '2px solid var(--text-base)',
        borderRadius: 2,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: '8% 30% 22% 6%', border: '1px solid var(--border-strong)' }} />
      <div style={{ position: 'absolute', left: '14%', top: '20%', width: '40%', height: 1, background: 'var(--border-strong)' }} />
      <div style={{ position: 'absolute', left: '14%', top: '42%', width: '28%', height: 1, background: 'var(--border-strong)' }} />
      <div style={{ position: 'absolute', left: '36%', top: '14%', width: 1, height: '50%', background: 'var(--border-strong)' }} />
      {sheet.changedInRev !== null && (
        <div style={{ position: 'absolute', left: '40%', top: '30%' }}>
          <Chip tone="amber">
            {sheet.added ? 'added' : 'changed'} in {planLabel(project, sheet.changedInRev)}
          </Chip>
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '30%',
          borderLeft: '1px solid var(--text-base)',
          borderTop: '1px solid var(--text-base)',
          padding: '0.4rem 0.5rem',
          fontSize: '0.72rem',
          lineHeight: 1.3,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{sheet.id}</div>
        <div>{sheet.title}</div>
        <div style={{ opacity: 0.7 }}>{project.name}</div>
        <div style={{ opacity: 0.7 }}>{setLabel}</div>
      </div>
    </div>
  )
}
