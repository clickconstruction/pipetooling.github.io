/**
 * GC mode, the real build, the schedule's PR 7a: the chart's Export: the spreadsheet and the
 * project file (G-136). Moved word for word from the GC mode prototype (branch spike/gc-mode,
 * `GcScheduleExport.tsx`); the plan is to-dos/gc-mode/mockups/schedule-pr7.md on that branch.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { scheduleCsv, scheduleExport, scheduleMspdi, type GanttExportInput } from '../../lib/gc/schedule/export'
import type { GanttPrintFor } from '../../lib/gc/schedule/ganttPrint'
import { downloadTextFile } from '../../lib/gc/downloadFile'
import { Btn } from './gcUi'

export function GcScheduleExport({ input, onClose }: { input: Omit<GanttExportInput, 'for'>; onClose: () => void }) {
  const [forWhom, setForWhom] = useState<GanttPrintFor>('team')
  const [saved, setSaved] = useState<string | null>(null)
  const x = useMemo(() => scheduleExport({ ...input, for: forWhom }), [input, forWhom])
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches
  const save = (ext: 'csv' | 'xml') => {
    const name = x.files[ext]
    downloadTextFile(ext === 'csv' ? scheduleCsv(x) : scheduleMspdi(x), name, ext === 'csv' ? 'text/csv;charset=utf-8' : 'application/xml;charset=utf-8')
    setSaved(name)
  }
  const pill = (key: GanttPrintFor, label: string) => (
    <button
      type="button"
      aria-pressed={forWhom === key}
      onClick={() => {
        setForWhom(key)
        // The line under the buttons speaks of the copy on show: another copy's save is not this one's.
        setSaved(null)
      }}
      style={{
        border: `1px solid ${forWhom === key ? 'transparent' : 'var(--border)'}`,
        borderRadius: 999,
        padding: '0.25rem 0.75rem',
        fontSize: '0.82rem',
        cursor: 'pointer',
        fontWeight: forWhom === key ? 600 : 400,
        background: forWhom === key ? 'var(--bg-blue-200)' : 'var(--surface)',
        color: forWhom === key ? 'var(--text-blue-800)' : 'var(--text-base)',
      }}
    >
      {label}
    </button>
  )
  const file = (button: ReactNode, lines: string[]) => (
    <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : '8.5rem minmax(0, 1fr)', gap: '0.3rem 0.75rem', alignItems: 'start' }}>
      <div>{button}</div>
      <div style={{ display: 'grid', gap: '0.15rem', paddingTop: phone ? 0 : '0.3rem' }}>
        {lines.map((l, i) => (
          <div key={l} style={{ color: i === 0 ? 'var(--text-600)' : 'var(--text-muted)', fontSize: i === 0 ? '0.88rem' : '0.8rem' }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  )
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 'var(--app-top-chrome, 0px) 0 0' : 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export the schedule"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 560, maxWidth: '100%', boxSizing: 'border-box', maxHeight: 'min(92vh, 100%)', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.8rem', fontSize: '0.9rem' }}
      >
        <div style={{ display: 'grid', gap: '0.15rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Export the schedule</h3>
          <div style={{ color: 'var(--text-600)' }}>{x.count}</div>
          <div style={{ color: 'var(--text-600)' }}>The filters and folds do not change a file.</div>
        </div>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <div role="group" aria-label="Who it is for" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '0.85rem', marginRight: '0.2rem' }}>Who it is for</strong>
            {pill('team', 'Our team')}
            {pill('customer', 'The customer')}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{x.forWords}</div>
        </div>
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {file(
            <Btn kind="plain" title={`Saves ${x.files.csv}`} onClick={() => save('csv')}>
              Spreadsheet
            </Btn>,
            ['A file Excel and Google Sheets open, with one row for each line.'],
          )}
          {file(
            <Btn kind="plain" title={`Saves ${x.files.xml}`} onClick={() => save('xml')}>
              Project file
            </Btn>,
            [
              x.copy === 'team' ? 'A file Microsoft Project and Primavera P6 open, with the waits between the work.' : 'A file Microsoft Project and Primavera P6 open.',
              // The prototype could open neither program: the owner checks the first real import (the lead, 2026-10-06).
              "Nobody has opened this file in Project or Primavera yet. The owner checks the first import with a scheduler's copy of each program.",
            ],
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <span role="status" style={{ flex: 1, minWidth: 0, color: 'var(--text-muted)', fontSize: '0.8rem', overflowWrap: 'anywhere' }}>
            {saved ? `Saved ${saved}.` : ''}
          </span>
          <Btn kind="quiet" onClick={onClose}>
            Close
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}
