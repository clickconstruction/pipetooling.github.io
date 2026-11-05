import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useToastContext } from '../../../contexts/ToastContext'
import { escapeHtml, printHtmlInNewWindow } from '../../../lib/bidDocuments/htmlDoc'
import {
  THEME_ITEMS_SHOW,
  itemKickerWords,
  markIsProposed,
  nearbyLines,
  proofCountsWords,
  proposedCountWords,
  provesByWords,
  sortThemes,
  themeCountsOnLines,
  themeItems,
  themeItemsHeadWords,
  themeListText,
  themeStands,
  type LegalTheme,
  type LegalThemeMark,
  type ThemeItem,
  type ThemeItemsOrder,
  type ThemeItemsShow,
} from '../../../lib/legal/legalThemes'
import type { PersonTimelineLine } from '../../../lib/people/personTimeline'
import { EmptyState } from '../../EmptyState'

/**
 * By theme (v2.6547, punch list #269 T3): the investigation. One theme at a time, its items oldest first or strongest
 * first, the counts a person tells counsel at the top, narrowed to the items with a file, by one grade or proposed.
 * A press on any item opens it in a window over the list — the whole entry or memo, its files, every theme on it
 * with why and how it proves it and who marked it, the lines around it on the record, Open on the Timeline, and
 * Previous and Next through the theme; Escape closes and the list is where it was. Print this theme draws the list
 * on paper; Copy as a list puts the same words on the clipboard for counsel. The pick sits in the address
 * (`?theme=<id>`) so a link opens the same view.
 */

const CHIP = (on: boolean): CSSProperties => ({
  padding: '0.25rem 0.65rem',
  fontSize: '0.75rem',
  fontWeight: 500,
  borderRadius: 999,
  border: `1px solid ${on ? 'var(--border-blue)' : 'var(--border-strong)'}`,
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: on ? 'var(--text-blue-700)' : 'var(--text-600)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  font: 'inherit',
})
const SMALL_CHIP = (on: boolean): CSSProperties => ({ ...CHIP(on), padding: '0.15rem 0.5rem', fontSize: '0.72rem' })
const GRADE: CSSProperties = { display: 'inline-block', padding: '0.1rem 0.5rem', borderRadius: 999, fontSize: '0.72rem', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-600)', whiteSpace: 'nowrap' }
const LABEL: CSSProperties = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }
const PRESS: CSSProperties = { font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.7rem', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer' }
const QUIET: CSSProperties = { font: 'inherit', fontSize: '0.76rem', fontWeight: 600, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0 }

function dayWords(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function isoDayWords(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export type PersonThemesViewProps = {
  personName: string
  themes: ReadonlyArray<LegalTheme>
  marks: ReadonlyArray<LegalThemeMark>
  /** The whole Timeline, every line, in the record's order. */
  lines: ReadonlyArray<PersonTimelineLine>
  themeId: string | null
  /** A press on a theme chip: the panel keeps the pick and the page writes it into the address. */
  onPickTheme: (id: string) => void
  canWrite: boolean
  namesById: Record<string, string>
  /** The line's file chips, drawn by the panel so a press opens the file the same way everywhere. */
  renderFiles: (line: PersonTimelineLine) => ReactNode
  onOpenOnTimeline: (lineKey: string) => void
  onKeepMark: (markId: string) => Promise<void>
  onRemoveMark: (markId: string, why: string) => Promise<boolean>
}

export function PersonThemesView({ personName, themes, marks, lines, themeId, onPickTheme, canWrite, namesById, renderFiles, onOpenOnTimeline, onKeepMark, onRemoveMark }: PersonThemesViewProps) {
  const { showToast } = useToastContext()
  const [order, setOrder] = useState<ThemeItemsOrder>('oldest')
  const [show, setShow] = useState<ThemeItemsShow>('every')
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeWhy, setRemoveWhy] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const standing = useMemo(() => sortThemes(themes).filter(themeStands), [themes])
  const counts = useMemo(() => themeCountsOnLines(lines, marks), [lines, marks])
  const themeById = useMemo(() => new Map(themes.map((t) => [t.id, t])), [themes])
  const chronological = useMemo(() => [...lines].sort((a, b) => a.ymd.localeCompare(b.ymd) || (a.loggedAt ?? '').localeCompare(b.loggedAt ?? '')), [lines])

  // The pick: the address's theme, else the theme with the most on this person, else the first standing.
  const picked = useMemo(() => {
    if (themeId && themeById.has(themeId)) return themeById.get(themeId)!
    let best: LegalTheme | null = null
    for (const t of standing) if (!best || (counts.get(t.id) ?? 0) > (counts.get(best.id) ?? 0)) best = t
    return best
  }, [themeId, themeById, standing, counts])

  const items = useMemo(() => (picked ? themeItems(lines, marks, picked.id, { order, show }) : []), [lines, marks, picked, order, show])
  const open = openIndex !== null ? items[openIndex] ?? null : null

  useEffect(() => {
    setOpenIndex(null)
  }, [picked?.id, order, show])

  useEffect(() => {
    if (openIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIndex(null)
      else if (e.key === 'ArrowLeft') setOpenIndex((i) => (i !== null && i > 0 ? i - 1 : i))
      else if (e.key === 'ArrowRight') setOpenIndex((i) => (i !== null && i < items.length - 1 ? i + 1 : i))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openIndex, items.length])

  const nameOf = (userId: string | null, fallback: string | null) => (userId ? namesById[userId] : null) ?? fallback ?? 'the agent'

  const copyList = async () => {
    if (!picked) return
    const text = themeListText(picked, personName, items, dayWords, nameOf)
    try {
      await navigator.clipboard.writeText(text)
      showToast(`${picked.name}: ${items.length === 1 ? '1 item' : `${items.length} items`} copied as a list.`, 'success')
    } catch {
      showToast('The clipboard did not take the list. Print this theme instead.', 'error')
    }
  }

  const printTheme = () => {
    if (!picked) return
    const rows = items
      .map((i, n) => {
        const proof = [i.mark.proves_by ? provesByWords(i.mark.proves_by) : 'not graded', i.mark.why ? escapeHtml(i.mark.why) : '', `${escapeHtml(nameOf(i.mark.marked_by, i.mark.author_label))}${markIsProposed(i.mark) ? ' · proposed' : ''}`].filter(Boolean).join('<br>')
        return `<tr><td>${n + 1}</td><td>${escapeHtml(dayWords(i.line.ymd))}</td><td><div class="k">${escapeHtml(i.line.kindWords)}</div>${escapeHtml(i.line.what)}${i.line.notes ? `<div class="n">${escapeHtml(i.line.notes)}</div>` : ''}${i.line.attachmentIds.length > 0 ? `<div class="n">${i.line.attachmentIds.length === 1 ? '1 file' : `${i.line.attachmentIds.length} files`}</div>` : ''}</td><td>${proof}</td></tr>`
      })
      .join('')
    const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>${escapeHtml(picked.name)} — ${escapeHtml(personName)}</title><style>
      body{font:12px/1.45 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;margin:32px}
      h1{font-size:18px;margin:0 0 4px}p{margin:0 0 6px}.m{color:#555}
      table{border-collapse:collapse;width:100%;margin-top:14px}th,td{border-top:1px solid #ccc;padding:6px 8px;vertical-align:top;text-align:left}th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#555}
      .k{font-size:11px;color:#555}.n{font-size:11px;color:#555;margin-top:2px}
    </style></head><body>
      <h1>${escapeHtml(picked.name)} — ${escapeHtml(personName)}</h1>
      ${picked.what_counts ? `<p>What counts: ${escapeHtml(picked.what_counts)}</p>` : ''}
      ${picked.counsel_words ? `<p>Counsel’s words: ${escapeHtml(picked.counsel_words)}</p>` : ''}
      <p class="m">${escapeHtml(themeItemsHeadWords(items, dayWords))} · ${escapeHtml(proofCountsWords(items.map((i) => i.mark)))}${order === 'strongest' ? ' · strongest first' : ' · oldest first'}</p>
      <table><thead><tr><th>#</th><th>Day</th><th>What</th><th>Proves it by · why · marked by</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`
    printHtmlInNewWindow(html)
  }

  const takeOff = async (id: string) => {
    if (removeWhy.trim() === '' || busyId) return
    setBusyId(id)
    const ok = await onRemoveMark(id, removeWhy)
    setBusyId(null)
    if (ok) {
      setRemovingId(null)
      setRemoveWhy('')
    }
  }

  const keep = async (id: string) => {
    setBusyId(id)
    await onKeepMark(id)
    setBusyId(null)
  }

  if (standing.length === 0) {
    return <EmptyState compact main="No theme to read by yet." next={{ label: 'Themes on the record', to: '/settings?tab=settings-people' }} tail="names the first." />
  }

  const themeRow = (
    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }} role="group" aria-label="Pick a theme" data-testid="by-theme-row">
      {standing.map((t) => (
        <button key={t.id} type="button" aria-pressed={picked?.id === t.id} onClick={() => onPickTheme(t.id)} title={t.what_counts || undefined} style={CHIP(picked?.id === t.id)} data-testid={`by-theme-pick-${t.id}`}>
          {t.name} · {counts.get(t.id) ?? 0}
        </button>
      ))}
      <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>one theme at a time</span>
    </div>
  )

  if (!picked) return themeRow

  const proposed = proposedCountWords(items.map((i) => i.mark))

  const itemWindow = open ? (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 760, padding: 'calc(var(--app-top-chrome, 0px) + 1.25rem) 0.75rem 1.5rem', overflowY: 'auto' }}
      onClick={() => setOpenIndex(null)}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="by-theme-item-title" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 720, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', border: '1px solid var(--border)' }} data-testid="by-theme-item-window">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 14rem', minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} data-testid="by-theme-item-kicker">
              {itemKickerWords(picked.name, openIndex!, items.length)}
            </div>
            <h3 id="by-theme-item-title" style={{ margin: '0.1rem 0 0', fontSize: '0.98rem', overflowWrap: 'anywhere' }}>
              {open.line.what.split('\n')[0]}
            </h3>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button type="button" style={PRESS} disabled={openIndex === 0} onClick={() => setOpenIndex((i) => (i !== null && i > 0 ? i - 1 : i))} data-testid="by-theme-prev">
              ← Previous
            </button>
            <button type="button" style={PRESS} disabled={openIndex === items.length - 1} onClick={() => setOpenIndex((i) => (i !== null && i < items.length - 1 ? i + 1 : i))} data-testid="by-theme-next">
              Next →
            </button>
            <button type="button" style={PRESS} onClick={() => setOpenIndex(null)} aria-label="Close" title="Close · esc">
              ✕
            </button>
          </div>
        </div>
        <div style={{ padding: '0.9rem 1rem', display: 'grid', gap: '0.8rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            <span>{dayWords(open.line.ymd)}</span>
            <span>·</span>
            <span>{open.line.kindWords}</span>
            {open.line.byName || open.line.loggedAt ? (
              <>
                <span>·</span>
                <span>
                  {open.line.loggedAt ? `written ${isoDayWords(open.line.loggedAt)}` : ''}
                  {open.line.byName ? `${open.line.loggedAt ? ' by ' : ''}${open.line.byName}` : ''}
                </span>
              </>
            ) : null}
          </div>
          <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.5 }} data-testid="by-theme-item-body">
            {open.line.what}
            {open.line.notes ? <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{open.line.notes}</div> : null}
          </div>
          {open.line.attachmentIds.length > 0 ? (
            <div>
              <div style={{ ...LABEL, marginBottom: '0.25rem' }}>Files</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>{renderFiles(open.line)}</div>
            </div>
          ) : null}
          <div>
            <div style={{ ...LABEL, marginBottom: '0.25rem' }}>Themes on this item</div>
            <div style={{ display: 'grid', gap: '0.35rem' }} data-testid="by-theme-item-themes">
              {open.marks.map((m) => {
                const t = themeById.get(m.theme_id)
                const isProposed = markIsProposed(m)
                return (
                  <div key={m.id} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                    <span style={{ ...SMALL_CHIP(true), cursor: 'default', borderStyle: isProposed ? 'dashed' : 'solid' }}>{t?.name ?? 'a theme'}</span>
                    {m.proves_by ? <span style={GRADE}>{provesByWords(m.proves_by)}</span> : <span style={GRADE}>not graded</span>}
                    <span style={{ color: 'var(--text-muted)' }}>
                      {m.why ? `why: ${m.why} · ` : ''}
                      {nameOf(m.marked_by, m.author_label)}, {isoDayWords(m.marked_at)}
                      {isProposed ? ' · proposed, not yet kept' : ''}
                    </span>
                    {canWrite ? (
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                        {isProposed ? (
                          <button type="button" style={QUIET} disabled={busyId === m.id} onClick={() => void keep(m.id)}>
                            Keep
                          </button>
                        ) : null}
                        <button
                          type="button"
                          style={{ ...QUIET, color: 'var(--text-muted)' }}
                          onClick={() => {
                            setRemovingId(removingId === m.id ? null : m.id)
                            setRemoveWhy('')
                          }}
                        >
                          Take it off…
                        </button>
                      </span>
                    ) : null}
                    {removingId === m.id ? (
                      <span style={{ flexBasis: '100%', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <input type="text" value={removeWhy} autoFocus maxLength={200} onChange={(e) => setRemoveWhy(e.target.value)} placeholder="Why is the theme coming off?" style={{ flex: '1 1 220px', font: 'inherit', fontSize: '0.78rem', padding: '0.28rem 0.5rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }} />
                        <button type="button" style={{ ...PRESS, color: 'var(--text-red-600)' }} disabled={removeWhy.trim() === '' || !!busyId} onClick={() => void takeOff(m.id)}>
                          {busyId === m.id ? 'Taking it off…' : 'Take it off'}
                        </button>
                        <button type="button" style={PRESS} onClick={() => setRemovingId(null)}>
                          Keep it
                        </button>
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
          {(() => {
            const near = nearbyLines(chronological, open.line.key, 2)
            const all = [...near.before, ...near.after]
            if (all.length === 0) return null
            return (
              <div>
                <div style={{ ...LABEL, marginBottom: '0.25rem' }}>Nearby on the record</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {all.map((l) => {
                    const at = items.findIndex((i) => i.line.key === l.key)
                    const words = `${dayWords(l.ymd)} · ${(l.what.split('\n')[0] ?? '').slice(0, 70)}${l.what.length > 70 ? '…' : ''}`
                    return at >= 0 ? (
                      <button key={l.key} type="button" style={SMALL_CHIP(false)} onClick={() => setOpenIndex(at)} title="Also on this theme: opens it here">
                        {words}
                      </button>
                    ) : (
                      <span key={l.key} style={{ ...SMALL_CHIP(false), cursor: 'default', color: 'var(--text-muted)' }}>
                        {words}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })()}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', flexWrap: 'wrap' }}>
            <button type="button" style={QUIET} onClick={() => onOpenOnTimeline(open.line.key)} data-testid="by-theme-open-timeline">
              Open on the Timeline ›
            </button>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>esc closes · ← → move through the theme</span>
          </div>
        </div>
      </div>
    </div>
  ) : null

  return (
    <div style={{ maxWidth: '88ch' }} data-testid="by-theme-view">
      {themeRow}
      <div style={{ marginBottom: '0.6rem' }}>
        {picked.what_counts ? <div style={{ fontSize: '0.84rem', color: 'var(--text-base)' }}>{picked.what_counts}</div> : null}
        {picked.counsel_words ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Counsel’s words: <span style={{ fontStyle: 'italic' }}>{picked.counsel_words}</span>
          </div>
        ) : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <div style={{ padding: '0.5rem 0.7rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }} data-testid="by-theme-head">
            {themeItemsHeadWords(items, dayWords)}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{show === 'every' ? 'every item of the theme' : `the items ${THEME_ITEMS_SHOW.find((s) => s.key === show)?.label ?? ''}`}</div>
        </div>
        <div style={{ padding: '0.5rem 0.7rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }} data-testid="by-theme-proof">
            {proofCountsWords(items.map((i) => i.mark))}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{proposed || 'every mark kept'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.6rem' }}>
        <span style={LABEL}>Show</span>
        {THEME_ITEMS_SHOW.map((s) => (
          <button key={s.key} type="button" aria-pressed={show === s.key} onClick={() => setShow(s.key)} style={SMALL_CHIP(show === s.key)} data-testid={`by-theme-show-${s.key}`}>
            {s.label}
          </button>
        ))}
        <span style={{ color: 'var(--text-faint)' }}>·</span>
        <span style={LABEL}>Order</span>
        <button type="button" aria-pressed={order === 'oldest'} onClick={() => setOrder('oldest')} style={SMALL_CHIP(order === 'oldest')} data-testid="by-theme-order-oldest">
          oldest first
        </button>
        <button type="button" aria-pressed={order === 'strongest'} onClick={() => setOrder('strongest')} style={SMALL_CHIP(order === 'strongest')} data-testid="by-theme-order-strongest">
          strongest first
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyState compact main={show === 'every' ? `Nothing on the record carries ${picked.name} yet.` : `No item of ${picked.name} is ${THEME_ITEMS_SHOW.find((s) => s.key === show)?.label ?? ''}.`} {...(show === 'every' ? {} : { next: { label: 'every item', onPress: () => setShow('every') }, tail: 'shows the whole theme.' })} />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} data-testid="by-theme-items">
          {items.map((it: ThemeItem<PersonTimelineLine>, n) => (
            <li key={it.line.key} style={{ borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setOpenIndex(n)}
                data-testid={`by-theme-item-${it.line.key}`}
                style={{ display: 'grid', gridTemplateColumns: '6.2rem 1fr auto', gap: '0.3rem 0.7rem', alignItems: 'start', width: '100%', textAlign: 'left', font: 'inherit', background: 'none', border: 'none', padding: '0.55rem 0.2rem', cursor: 'pointer', color: 'inherit' }}
              >
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', paddingTop: 2 }}>{dayWords(it.line.ymd)}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '0.87rem', overflowWrap: 'anywhere' }}>{it.line.what.split('\n')[0]}</span>
                  <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.15rem' }}>
                    {it.line.kindWords}
                    {it.line.attachmentIds.length > 0 ? ` · ${it.line.attachmentIds.length === 1 ? '1 file' : `${it.line.attachmentIds.length} files`}` : ''}
                    {it.mark.why ? ` · why: ${it.mark.why}` : ''}
                    {` · ${nameOf(it.mark.marked_by, it.mark.author_label)}, ${isoDayWords(it.mark.marked_at)}`}
                    {markIsProposed(it.mark) ? ' · proposed' : ''}
                  </span>
                </span>
                <span style={{ ...GRADE, borderStyle: markIsProposed(it.mark) ? 'dashed' : 'solid' }}>{it.mark.proves_by ? provesByWords(it.mark.proves_by) : 'not graded'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.8rem', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
        <button type="button" style={PRESS} disabled={items.length === 0} onClick={printTheme} data-testid="by-theme-print">
          Print this theme
        </button>
        <button type="button" style={PRESS} disabled={items.length === 0} onClick={() => void copyList()} data-testid="by-theme-copy">
          Copy as a list for counsel
        </button>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>Press an item to open it here.</span>
      </div>
      {itemWindow}
    </div>
  )
}
