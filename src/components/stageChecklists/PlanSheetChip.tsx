/**
 * The plan-sheet chip on a stage checklist row (punch list #237, PR 1b): *📐 P-201 detail 4 ↗*, the plan sheet a check
 * came from, as a door to the job's Plans folder. Drive has no address for one sheet in a set, so the door is the folder
 * and the chip's words say which sheet to open. A job with no Plans link draws the words alone. Never inside a row's own
 * button: a press on the chip opens the folder and not the row.
 */
import type { CSSProperties } from 'react'
import { plansDoorUrl } from '../../lib/jobs/stageChecklistItems'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'

const chip: CSSProperties = { display: 'inline-block', padding: '0.05rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'var(--bg-blue-200)', color: 'var(--text-blue-700)', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle' }
const door: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 32, maxWidth: '100%', textDecoration: 'none' }

export function PlanSheetChip({ sheet, plansUrl }: { sheet: string; plansUrl: string | null | undefined }) {
  const url = plansDoorUrl(plansUrl)
  if (!url) {
    return (
      <span style={chip} title="The plan sheet this check comes from" data-plan-sheet-chip>
        📐 {sheet}
      </span>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={door}
      title="Opens the job's Plans folder"
      aria-label={`Open the job's Plans folder for ${sheet}`}
      data-plan-sheet-chip
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        openInExternalBrowser(url)
      }}
    >
      <span style={chip}>📐 {sheet} ↗</span>
    </a>
  )
}

export default PlanSheetChip
