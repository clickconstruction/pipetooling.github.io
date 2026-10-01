/**
 * Two ways a draft catches up (2026-10-01). **Refresh from the takeoff** lists each row the
 * takeoff now reads differently, what it reads now and what it will read, before anything is
 * written. **Make it a part of…** folds a row typed by hand for another row's fixture (BP375's
 * Josam carriers) into that row as a part. Both hand the choice back; the tab writes it.
 */
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { foldWrites, type RefreshPlanRow, type RefreshSkip } from '../../lib/submittals/refreshFromTakeoff'
import type { SubmittalPartRow } from '../../lib/submittals/itemParts'
import type { SubmittalItemRow } from '../../lib/submittals/submittalRevision'

const quiet: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const btn: CSSProperties = { padding: '0.45rem 0.85rem', minHeight: 36, background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 500 }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: 'white', fontWeight: 600 }
const select: CSSProperties = { padding: '0.4rem 0.5rem', minHeight: 36, border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)', width: '100%', minWidth: 0 }

function Shell({ label, busy, onClose, children, footer, maxWidth }: { label: string; busy: boolean; onClose: () => void; children: ReactNode; footer: ReactNode; maxWidth: number }) {
  return (
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 10060, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1rem 0.6rem', overflowY: 'auto' }}>
      <div role="dialog" aria-modal="true" aria-label={label} style={{ background: 'var(--surface)', borderRadius: 10, width: '100%', maxWidth, boxShadow: '0 10px 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 2rem)' }} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ padding: '1rem 1.1rem 0.6rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{label}</h3>
          <button type="button" aria-label="Close" disabled={busy} onClick={onClose} style={{ ...btn, minHeight: 32, padding: '0.2rem 0.6rem' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '0.75rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>{children}</div>
        <div style={{ padding: '0.7rem 1.1rem', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-end' }}>{footer}</div>
      </div>
    </div>
  )
}

const SKIP_WORDS: Record<RefreshSkip['why'], (n: number) => string> = {
  house_file: (n) => `${n === 1 ? 'keeps' : 'keep'} the parts read from the house’s file`,
  same: (n) => `${n === 1 ? 'reads' : 'read'} the same as the takeoff`,
  no_takeoff: (n) => `${n === 1 ? 'is' : 'are'} no longer on the takeoff`,
}

export function SubmittalTakeoffRefreshModal({ rows, skipped, busy = false, onConfirm, onClose }: { rows: ReadonlyArray<RefreshPlanRow>; skipped: ReadonlyArray<RefreshSkip>; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  const groups = (['house_file', 'same', 'no_takeoff'] as const).map((why) => ({ why, tags: skipped.filter((s) => s.why === why).map((s) => s.tag) })).filter((g) => g.tags.length > 0)
  return (
    <Shell
      label="Refresh from the takeoff"
      busy={busy}
      onClose={onClose}
      maxWidth={680}
      footer={
        <>
          <button type="button" disabled={busy} onClick={onClose} style={btn}>Cancel</button>
          <button type="button" disabled={busy || rows.length === 0} onClick={onConfirm} style={btnPrimary} data-testid="refresh-confirm">
            {busy ? 'Refreshing…' : `Refresh ${rows.length} row${rows.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-base)', lineHeight: 1.45 }}>
        The takeoff reads differently for {rows.length} row{rows.length === 1 ? '' : 's'}. Each takes the takeoff’s parts. A part the takeoff still has keeps its house, lead time, stage, pages and call.
      </p>
      {rows.map((r) => (
        <section key={r.itemId} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }} data-testid="refresh-row">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.1rem 0.6rem', alignItems: 'baseline' }}>
            <b style={{ color: 'var(--text-strong)', fontSize: '0.9rem', overflowWrap: 'anywhere' }}>{r.tag}</b>
            <span style={{ ...quiet, whiteSpace: 'nowrap' }}>{r.parts} part{r.parts === 1 ? '' : 's'}, {r.gc} for the GC</span>
          </div>
          <span style={{ ...quiet, overflowWrap: 'anywhere' }}>Now: {r.before}</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }} data-testid="refresh-after">
            Will read: <b style={{ fontWeight: 600 }}>{r.after}</b>
          </span>
        </section>
      ))}
      {groups.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: '1.1rem', ...quiet, lineHeight: 1.5 }} data-testid="refresh-skipped">
          {groups.map((g) => (
            <li key={g.why}>
              {g.tags.join(', ')} {SKIP_WORDS[g.why](g.tags.length)}.
            </li>
          ))}
        </ul>
      ) : null}
    </Shell>
  )
}

export function SubmittalFoldModal({ from, rows, partsByItem, suggestedIntoId, busy = false, onConfirm, onClose }: { from: SubmittalItemRow; rows: ReadonlyArray<SubmittalItemRow>; partsByItem: ReadonlyMap<string, ReadonlyArray<SubmittalPartRow>>; suggestedIntoId: string | null; busy?: boolean; onConfirm: (intoId: string) => void; onClose: () => void }) {
  const others = rows.filter((r) => r.id !== from.id)
  const [intoId, setIntoId] = useState<string>(suggestedIntoId && others.some((r) => r.id === suggestedIntoId) ? suggestedIntoId : '')
  const into = others.find((r) => r.id === intoId) ?? null
  const preview = useMemo(() => (into ? foldWrites(from, into, partsByItem.get(into.id) ?? [], into.submittal_id, () => 'preview') : null), [from, into, partsByItem])
  const fromTag = from.tag.trim() || 'This row'
  const intoTag = into?.tag.trim() || 'the row'
  return (
    <Shell
      label={`Make ${fromTag} a part of another row`}
      busy={busy}
      onClose={onClose}
      maxWidth={560}
      footer={
        <>
          <button type="button" disabled={busy} onClick={onClose} style={btn}>Cancel</button>
          <button type="button" disabled={busy || !into} onClick={() => into && onConfirm(into.id)} style={btnPrimary} data-testid="fold-confirm">
            {busy ? 'Moving…' : into ? `Make it a part of ${intoTag}` : 'Pick a row'}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-base)', lineHeight: 1.45 }}>
        {fromTag} lists {(from.submitted_label ?? '').trim() || 'its product'}. As a part of another row it goes to the GC with that fixture. It keeps its house, lead time, cut sheet pages and order dates.
      </p>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>
        Part of
        <select aria-label="The row it becomes a part of" value={intoId} disabled={busy} onChange={(e) => setIntoId(e.target.value)} style={select} data-testid="fold-into">
          <option value="">Pick a row…</option>
          {others.map((r) => (
            <option key={r.id} value={r.id}>
              {r.tag.trim() || '(no tag)'}{r.submitted_label ? ` · ${r.submitted_label}` : ''}{r.id === suggestedIntoId ? ' · its note names it' : ''}
            </option>
          ))}
        </select>
      </label>
      {preview ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-base)', lineHeight: 1.45, overflowWrap: 'anywhere' }} data-testid="fold-preview">
          {intoTag} will list for the GC: <b style={{ color: 'var(--text-strong)' }}>{preview.after}</b>.
          <span style={{ ...quiet, display: 'block', marginTop: '0.2rem' }}>The {fromTag} row leaves this draft.</span>
        </p>
      ) : null}
    </Shell>
  )
}
