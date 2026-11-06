import { useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../../contexts/ToastContext'
import { matterThemeLines, type LegalTheme, type LegalThemeMark, type ThemeLine } from '../../../lib/legal/legalThemes'
import { authUserIdNow, keepMark, removeMark } from '../../../lib/legal/legalThemesIo'
import type { LegalEntryRow } from '../../../lib/legal/legalMatters'
import type { LegalMatterDocumentRow } from '../../../lib/legal/legalMatterDocumentsIo'
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'
import { PersonThemesView } from '../../people/personFile/PersonThemesView'

/**
 * A matter's By theme view (v2.6588, punch list #269, T2b's and T4's remainder): the HR file's investigation
 * (`PersonThemesView`, v2.6547) over the matter's own record — its documents and its Timeline's entries as the lines,
 * the matter's marks (v2.6548) on them. One theme at a time, its items oldest or strongest first, each opened in a
 * window over the list with its document a press away, Keep and Take it off… on the marks, Open on the Timeline to the
 * matter's own tab, Print this theme and Copy as a list for counsel. Drawn on the Legal desk and on the HR file's
 * Matter view for the hand that may mark (a dev), once the catalog has a theme.
 */

const FILE_CHIP: CSSProperties = { font: 'inherit', fontSize: '0.74rem', padding: '0.15rem 0.55rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }

export type MatterThemesViewProps = {
  /** The matter's name as the desk prints it: the payer's, or the person's. */
  matterName: string
  themes: ReadonlyArray<LegalTheme>
  marks: ReadonlyArray<LegalThemeMark>
  entries: ReadonlyArray<LegalEntryRow>
  documents: ReadonlyArray<LegalMatterDocumentRow>
  canWrite: boolean
  namesById: Record<string, string>
  /** A press on a document chip in the window: the paper itself, the way the Evidence row opens it. */
  onOpenDocument: (documentId: string) => void
  /** Open on the Timeline: the matter's Timeline tab for an entry, its Evidence row for a document. */
  onOpenOnTimeline: (line: ThemeLine) => void
  onMarksChanged: () => void
}

export function MatterThemesView({ matterName, themes, marks, entries, documents, canWrite, namesById, onOpenDocument, onOpenOnTimeline, onMarksChanged }: MatterThemesViewProps) {
  const { showToast } = useToastContext()
  const [themeId, setThemeId] = useState<string | null>(null)
  const lines = useMemo(() => matterThemeLines(entries, documents, calendarYmdInAppTzFromIso), [entries, documents])
  const docById = useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents])

  const renderFiles = (line: ThemeLine) =>
    line.attachmentIds.map((id) => {
      const d = docById.get(id)
      return (
        <button key={id} type="button" onClick={() => onOpenDocument(id)} style={FILE_CHIP} title={d?.shows || 'Opens the paper'} data-testid={`matter-theme-file-${id}`}>
          📄 {d?.title ?? 'a document no longer on Evidence'}
        </button>
      )
    })

  const keep = async (markId: string) => {
    const r = await keepMark(markId, await authUserIdNow())
    if (!r.ok) {
      showToast(`Keep: ${r.why}`, 'error')
      return
    }
    showToast('Kept: the mark stands as the office’s own.', 'success')
    onMarksChanged()
  }

  const remove = async (markId: string, why: string) => {
    const r = await removeMark(markId, why, await authUserIdNow())
    if (!r.ok) {
      showToast(`Take it off: ${r.why}`, 'error')
      return false
    }
    showToast('The theme is off the item; the reason is kept with it.', 'success')
    onMarksChanged()
    return true
  }

  return (
    <div data-testid="matter-themes-view">
      <PersonThemesView
        personName={matterName}
        themes={themes}
        marks={marks}
        lines={lines}
        themeId={themeId}
        onPickTheme={setThemeId}
        canWrite={canWrite}
        namesById={namesById}
        renderFiles={renderFiles}
        onOpenOnTimeline={(key) => {
          const line = lines.find((l) => l.key === key)
          if (line) onOpenOnTimeline(line)
        }}
        onKeepMark={keep}
        onRemoveMark={remove}
        openLabel="Open on the matter ›"
      />
    </div>
  )
}

export default MatterThemesView
