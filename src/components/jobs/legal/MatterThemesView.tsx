import { useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../../contexts/ToastContext'
import { supabase } from '../../../lib/supabase'
import { openLegalMatterDocument, type LegalMatterDocumentRow } from '../../../lib/legal/legalMatterDocumentsIo'
import type { LegalTimeline } from '../../../lib/legal/legalTimeline'
import type { LegalTheme, LegalThemeMark } from '../../../lib/legal/legalThemes'
import { authUserIdNow, keepMark, removeMark } from '../../../lib/legal/legalThemesIo'
import { matterThemeLineLanding, matterThemeLines, type MatterThemeLine } from '../../../lib/legal/matterThemeLines'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { PersonThemesView } from '../../people/personFile/PersonThemesView'

/**
 * The matter's By theme view (v2.6599, punch list #269 T2b's remainder): the HR file's investigation (`PersonThemesView`,
 * v2.6547) over a matter's documents and the entries on its timeline, so a dev reads a matter one theme at a time —
 * the counts counsel is told, oldest or strongest first, Show by grade, the item window with Previous and Next, Print
 * this theme and Copy as a list. A document's chip opens the paper; *Open on the Timeline* lands a paper on Evidence
 * and an entry on the Timeline. Drawn on the Legal desk and on the HR file's Matter view, for the hand that may mark.
 */

const FILE_CHIP: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.1rem 0.5rem',
  borderRadius: 999,
  fontSize: '0.74rem',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-link)',
  cursor: 'pointer',
  font: 'inherit',
  maxWidth: '100%',
}

export type MatterThemesViewProps = {
  /** The matter's name as the list reads it: *The matter on Jordan Vale*, or the payer's name. */
  matterName: string
  themes: ReadonlyArray<LegalTheme>
  marks: ReadonlyArray<LegalThemeMark>
  timeline: Pick<LegalTimeline, 'past' | 'today' | 'upcoming'>
  documents: ReadonlyArray<LegalMatterDocumentRow>
  canWrite: boolean
  namesById?: Record<string, string>
  /** A press on *Open on the Timeline*: the surface shows the tab the line lives on, lit on its row when it can. */
  onOpenOnTimeline: (line: MatterThemeLine, landing: 'evidence' | 'timeline') => void
  /** A mark kept or taken off: the surface reads the marks again. */
  onMarksChanged: () => void | Promise<void>
}

export function MatterThemesView({ matterName, themes, marks, timeline, documents, canWrite, namesById = {}, onOpenOnTimeline, onMarksChanged }: MatterThemesViewProps) {
  const { showToast } = useToastContext()
  const [themeId, setThemeId] = useState<string | null>(null)
  const lines = useMemo(() => matterThemeLines(timeline), [timeline])
  const docById = useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents])

  const openDocument = async (id: string) => {
    const row = docById.get(id)
    if (!row) {
      showToast('That paper is no longer on the matter.', 'error')
      return
    }
    try {
      await openLegalMatterDocument(supabase, row)
    } catch (e) {
      showToast(`The paper did not open: ${formatErrorMessage(e)}`, 'error')
    }
  }

  const renderFiles = (line: MatterThemeLine) =>
    line.attachmentIds.map((id) => {
      const row = docById.get(id)
      return (
        <button key={id} type="button" style={FILE_CHIP} onClick={() => void openDocument(id)} title={row?.shows || undefined} data-testid={`matter-theme-file-${id}`}>
          📄 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row?.title ?? 'a paper no longer on the matter'}</span>
        </button>
      )
    })

  const keep = async (id: string) => {
    const r = await keepMark(id, await authUserIdNow())
    if (!r.ok) {
      showToast(`The mark was not kept: ${r.why}`, 'error')
      return
    }
    showToast('Kept.', 'success')
    await onMarksChanged()
  }

  const remove = async (id: string, why: string) => {
    const r = await removeMark(id, why, await authUserIdNow())
    if (!r.ok) {
      showToast(`The mark was not taken off: ${r.why}`, 'error')
      return false
    }
    showToast('Taken off. The row stays, stamped with your reason.', 'success')
    await onMarksChanged()
    return true
  }

  return (
    <div data-testid="matter-themes-view">
      <PersonThemesView<MatterThemeLine>
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
          if (line) onOpenOnTimeline(line, matterThemeLineLanding(line))
        }}
        onKeepMark={keep}
        onRemoveMark={remove}
      />
    </div>
  )
}

export default MatterThemesView
