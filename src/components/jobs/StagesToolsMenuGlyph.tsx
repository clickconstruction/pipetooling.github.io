/**
 * The ☰ Section tools menu's icons (v2.4524, the owner's picks): one line icon per tool, all in
 * one quiet color, with the Lien desk's gavel in its orange — the same gavel as the stage bar's
 * shortcut and the row's Lien window button. The kernel names the icon
 * (`StagesToolGlyph` in `lib/jobs/stagesSectionToolsMenu`); this draws it.
 */
import { Banknote, Bell, Building2, CalendarRange, ChartColumn, History, Landmark, Route, Share2, type LucideIcon } from 'lucide-react'
import type { StagesToolGlyph } from '../../lib/jobs/stagesSectionToolsMenu'
import { StagesGavelGlyph } from './StagesRowActionButtons'

const LINE: Record<Exclude<StagesToolGlyph, 'gavel' | 'file-dollar'>, LucideIcon> = {
  history: History,
  route: Route,
  cash: Banknote,
  bell: Bell,
  building: Building2,
  bank: Landmark,
  share: Share2,
  'chart-bar': ChartColumn,
  'calendar-bars': CalendarRange,
}

const SIZE = 16
const STROKE = 2

/** A page with a dollar sign: the library has none, so it is drawn here to the library's grid and weight. */
function FileDollarGlyph() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M12 10.5v8" />
      <path d="M14.2 12.6c-.3-.7-1.1-1.1-2.2-1.1-1.3 0-2.2.6-2.2 1.5 0 2.2 4.4.9 4.4 3.1 0 .9-.9 1.5-2.2 1.5-1.1 0-1.9-.4-2.2-1.1" />
    </svg>
  )
}

export function StagesToolsMenuGlyph({ name }: { name: StagesToolGlyph }) {
  if (name === 'gavel') {
    return (
      <span data-tools-glyph="gavel" style={{ display: 'inline-flex', color: '#ff6600' }}>
        <StagesGavelGlyph size={15} />
      </span>
    )
  }
  const Line = name === 'file-dollar' ? null : LINE[name]
  return (
    <span data-tools-glyph={name} style={{ display: 'inline-flex', color: 'var(--text-muted)' }}>
      {Line ? <Line size={SIZE} strokeWidth={STROKE} aria-hidden="true" /> : <FileDollarGlyph />}
    </span>
  )
}
