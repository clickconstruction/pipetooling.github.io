import { useEffect, useRef, type ReactNode } from 'react'
import type { CompanyDoc, CompanyDocGroup, DocStatus } from '../../lib/gc/companyFile'
import type { CompanyTab } from './gcCompanyOpener'

/**
 * GC mode, the real build, the Board's B6-b-ii: the company window's tabs and its Documents list, from the design
 * spike's `GcCompanyFile.tsx` (`CompanyTabStrip`, `CompanyDocuments`). Documents leads with what is missing; a paper's
 * next step opens beside the list. The spike's made-up paper beside the list is left there: the real build shows the
 * send, or the certificate form, in its place.
 */

export type { CompanyTab } from './gcCompanyOpener'

export function CompanyTabStrip({ tab, onTab, toGet, portal }: { tab: CompanyTab; onTab: (t: CompanyTab) => void; toGet: number; portal: boolean }) {
  const tabs: { key: CompanyTab; label: string }[] = [
    { key: 'about', label: 'About' },
    { key: 'documents', label: toGet > 0 ? `Documents · ${toGet} to get` : 'Documents' },
    ...(portal ? [{ key: 'portal' as const, label: 'Their portal' }] : []),
  ]
  const stripRef = useRef<HTMLDivElement | null>(null)
  // The picked tab stays in sight when the row scrolls on a phone.
  useEffect(() => {
    const strip = stripRef.current
    const on = strip?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!strip || !on) return
    const box = strip.getBoundingClientRect()
    const r = on.getBoundingClientRect()
    if (r.right > box.right) strip.scrollLeft += r.right - box.right
    else if (r.left < box.left) strip.scrollLeft -= box.left - r.left
  }, [tab])
  return (
    // One row that scrolls sideways on a phone, rather than rows of tabs.
    <div ref={stripRef} role="tablist" aria-label="Company" style={{ display: 'flex', gap: '0.25rem', padding: '0 1rem', borderBottom: '1px solid var(--border)', overflowX: 'auto', flex: 'none' }}>
      {tabs.map((t) => {
        const on = tab === t.key
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            data-gc-company-tab={t.key}
            onClick={() => onTab(t.key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${on ? 'var(--text-blue-500)' : 'transparent'}`,
              padding: '0.55rem 0.7rem',
              whiteSpace: 'nowrap',
              font: 'inherit',
              fontSize: '0.9rem',
              fontWeight: on ? 700 : 500,
              color: on ? 'var(--text-base)' : t.key === 'documents' && toGet > 0 ? 'var(--text-amber-800)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

const STATUS_STYLE: Record<DocStatus, { dot: string; fg: string }> = {
  ok: { dot: 'var(--text-green-700)', fg: 'var(--text-green-700)' },
  soon: { dot: 'var(--text-amber-700)', fg: 'var(--text-amber-800)' },
  missing: { dot: 'var(--text-red-700)', fg: 'var(--text-red-700)' },
  info: { dot: 'var(--text-muted)', fg: 'var(--text-muted)' },
}

/**
 * The papers, status first. `ask` draws a row's next step (a button, or why there is none yet); `aside` is what shows
 * beside the list: a send in progress or the certificate form. `selected` is the row it belongs to.
 */
export function CompanyDocuments({
  groups,
  selected,
  ask,
  aside,
}: {
  groups: CompanyDocGroup[]
  selected: string | null
  ask?: (doc: CompanyDoc) => ReactNode
  aside?: ReactNode
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1rem', alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: '0.9rem', minWidth: 0 }}>
        {groups.map((g) => (
          <section key={g.title} aria-label={g.title}>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{g.title}</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {g.docs.map((d, i) => {
                const on = d.key === selected
                const st = STATUS_STYLE[d.status]
                return (
                  <div
                    key={d.key}
                    data-gc-doc={d.key}
                    style={{ padding: '0.5rem 0.65rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', display: 'grid', gap: '0.15rem' }}
                  >
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: st.dot, flex: 'none' }} />
                      <strong style={{ fontWeight: 600 }}>{d.title}</strong>
                      <span style={{ color: st.fg, fontSize: '0.82rem', fontWeight: 600 }}>{d.statusWords}</span>
                      <span style={{ flex: 1 }} />
                      {ask?.(d)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1.1rem' }}>{d.meta}</div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <div style={{ minWidth: 0, position: 'sticky', top: 0 }}>
        {aside ?? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem', border: '1px dashed var(--border-strong)', borderRadius: 8 }}>
            A paper that is missing has its next step on its row.
          </div>
        )}
      </div>
    </div>
  )
}
