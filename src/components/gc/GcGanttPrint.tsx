/**
 * GC mode, the real build, the schedule's PR 7a: the chart's Print or PDF (G-21). Moved word for
 * word from the GC mode prototype (branch spike/gc-mode, `GcGanttPrint.tsx`); the plan is
 * to-dos/gc-mode/mockups/schedule-pr7.md on that branch.
 */
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ganttPrint, ganttPrintHtml, type GanttPrintFor, type GanttPrintInput } from '../../lib/gc/schedule/ganttPrint'
import { printHtmlInNewWindow } from '../../lib/bidDocuments/htmlDoc'
import { Btn } from './gcUi'

/** How wide the document lays out on a screen: an 11 in sheet and the page's margin, in CSS pixels. */
const DOC_W = 1088

export function GcGanttPrint({ input, onClose }: { input: Omit<GanttPrintInput, 'for'>; onClose: () => void }) {
  const [forWhom, setForWhom] = useState<GanttPrintFor>('team')
  const print = useMemo(() => ganttPrint({ ...input, for: forWhom }), [input, forWhom])
  const html = useMemo(() => ganttPrintHtml(print), [print])
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches
  // The pages, small: the frame lays the document out at full size and shows it scaled to the window.
  const frameW = phone ? Math.max(260, Math.min(420, (typeof window !== 'undefined' ? window.innerWidth : 400) - 34)) : 640
  const frameH = phone ? 230 : 330
  const scale = frameW / DOC_W
  const pill = (key: GanttPrintFor, label: string) => (
    <button
      type="button"
      aria-pressed={forWhom === key}
      onClick={() => setForWhom(key)}
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
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 0 : '1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Print the chart"
        data-theme="light"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : frameW + 34, maxWidth: '100%', boxSizing: 'border-box', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.7rem', fontSize: '0.9rem' }}
      >
        <div style={{ display: 'grid', gap: '0.15rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Print the chart</h3>
          {print.shows.map((s) => (
            <div key={s} style={{ color: 'var(--text-600)' }}>
              {s}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <div role="group" aria-label="Who it is for" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '0.85rem', marginRight: '0.2rem' }}>Who it is for</strong>
            {pill('team', 'Our team')}
            {pill('customer', 'The customer')}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{print.forWords}</div>
        </div>
        <div style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>As it will print</span>
          <div style={{ width: frameW, maxWidth: '100%', height: frameH, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-muted)' }}>
            <iframe
              title="The pages as they will print"
              srcDoc={html}
              style={{ display: 'block', width: frameW / scale, height: frameH / scale, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Btn kind="quiet" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            kind="primary"
            title="Opens the pages in the print dialog. Save as PDF is one of the printers there."
            onClick={() => {
              printHtmlInNewWindow(html)
              onClose()
            }}
          >
            Print or PDF
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}
