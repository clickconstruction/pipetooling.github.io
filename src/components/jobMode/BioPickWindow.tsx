/**
 * Job Mode's **Edit bio** (v2.5590, punch list #114): the window on top of the On my way sheet where the tech ticks
 * which of the office's lines go in their bio for this customer. It opens with the tech's usual picks from Settings
 * already ticked; a change here is for this customer only. The preview and the count follow the ticks; **Use these**
 * hands the pick back to the sheet, **Back** leaves it as it was. A Spanish reader's window shows the Spanish words,
 * and a line with none cannot be ticked. The rules are `lib/bio/bio.ts`; the words are `lib/jobMode/onMyWay.ts`.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import type { PortalLang } from '../../lib/gc/portalI18n'
import { bioText, leftWords, liveLines, type BioLine } from '../../lib/bio/bio'
import { ON_MY_WAY_WORDS } from '../../lib/jobMode/onMyWay'
import * as S from './sheetStyles'

const previewLabel: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 0.3rem' }
const tick: CSSProperties = { display: 'grid', gridTemplateColumns: '1.5rem 1fr', gap: '0.6rem', alignItems: 'start', padding: '0.55rem 0', borderTop: '1px solid var(--border)', fontSize: '0.9375rem', cursor: 'pointer' }
const box: CSSProperties = { width: 22, height: 22, marginTop: 1, accentColor: '#16a34a' }

export interface BioPickWindowProps {
  lines: readonly BioLine[]
  /** The pick as it stands, by id. */
  picked: readonly string[]
  /** The tech's own first name, for the opener. */
  techFirst: string | null
  /** The customer's first name, for the title. */
  customerFirst: string | null
  lang: PortalLang
  onUse: (ids: string[]) => void
  onClose: () => void
}

export function BioPickWindow({ lines, picked, techFirst, customerFirst, lang, onUse, onClose }: BioPickWindowProps) {
  useModalStackEntry(true)
  const [ticks, setTicks] = useState<Set<string>>(() => new Set(picked))
  const live = useMemo(() => liveLines(lines), [lines])
  const words = useMemo(() => bioText({ lines, picked: [...ticks], first: techFirst, lang }), [lines, ticks, techFirst, lang])
  const canSay = (line: BioLine) => (lang === 'es' ? Boolean(line.textEs) : true)

  const toggle = (id: string) =>
    setTicks((t) => {
      const next = new Set(t)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const footer = (
    <div style={S.footerRow}>
      <button type="button" style={S.secondaryBtn} onClick={onClose} data-testid="bio-pick-back">
        {ON_MY_WAY_WORDS.back}
      </button>
      <button type="button" style={S.hereBtn} onClick={() => onUse(live.filter((l) => ticks.has(l.id)).map((l) => l.id))} data-testid="bio-pick-use">
        {ON_MY_WAY_WORDS.useThese}
      </button>
    </div>
  )

  return (
    <ResponsiveModalShell title={ON_MY_WAY_WORDS.bioWindowTitle(customerFirst)} onRequestClose={onClose} footer={footer} zIndex={1200}>
      <div data-testid="bio-pick-window">
        <p style={{ ...S.muted, margin: '0 0 0.6rem' }}>{ON_MY_WAY_WORDS.bioWindowHint}</p>
        <div style={previewLabel}>
          <span>{ON_MY_WAY_WORDS.bioPreview(customerFirst)}</span>
          <span data-testid="bio-pick-count">{leftWords(words?.length ?? 0)}</span>
        </div>
        <p style={{ ...S.bubble, fontSize: '0.9375rem', borderStyle: 'dashed' }} data-testid="bio-pick-preview">
          {words ?? ON_MY_WAY_WORDS.bioNone}
        </p>
        <div style={{ marginTop: '0.6rem' }}>
          {live.map((line) => {
            const can = canSay(line)
            const on = can && ticks.has(line.id)
            return (
              <label key={line.id} style={{ ...tick, color: can ? 'var(--text-strong)' : 'var(--text-muted)', cursor: can ? 'pointer' : 'not-allowed' }} data-testid="bio-pick-line">
                <input type="checkbox" style={box} checked={on} disabled={!can} aria-label={line.text} onChange={() => toggle(line.id)} />
                <span>
                  {lang === 'es' && line.textEs ? line.textEs : line.text}
                  {!can ? <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>{ON_MY_WAY_WORDS.bioNoSpanish}</span> : null}
                </span>
              </label>
            )
          })}
        </div>
        <p style={{ ...S.muted, margin: '0.6rem 0 0', fontSize: '0.8125rem' }}>{ON_MY_WAY_WORDS.bioUsual}</p>
      </div>
    </ResponsiveModalShell>
  )
}
