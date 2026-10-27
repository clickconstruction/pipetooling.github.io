import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { applyDraft, draftedLineWords, type RequestDraft, type VoiceDraftHost } from '../lib/reports/voiceDraft'
import { supabaseRequestDraft } from '../lib/reports/voiceDraftIo'
import { notesFieldLabel } from '../lib/reports/voiceNote'
import type { JobLineProgress } from './useJobLineProgress'

/** What a report form keeps of a drafted report: the fields still marked drafted, and what was said, for the fold. */
export interface ReportVoiceDraft {
  /** What the Talk it through button drafts through. */
  host: VoiceDraftHost
  /** The fields the draft filled and nobody has touched since. */
  draftMarks: ReadonlySet<string>
  /** A field was typed in: its mark goes. */
  dropDraftMark: (label: string) => void
  /** What was said and the lines it set, for the fold under the fields. Null before a draft. */
  heard: { text: string; language: string; lines: string[] } | null
  /** The form was reset or closed. */
  reset: () => void
}

const DEFAULT_REQUEST = supabaseRequestDraft()

/**
 * The drafted report on a report form (punch list #186, item 1, PR 2 of its plan, v2.5916), shared by the New report
 * and Additional report windows. When `report-draft` answers, Notes gets the draft's three lines under what it held,
 * the lines the tech named get their percents (the first one opened, so its number is in view), Notes is marked
 * drafted until typed in, and the words said wait under a fold with the lines the draft set. Nothing is written until
 * Save report. `request` is a smoke's seam.
 */
export function useReportVoiceDraft(p: {
  fields: ReadonlyArray<{ label: string; input_type?: string | null }>
  jobName: string
  lineProgress: Pick<JobLineProgress, 'lines' | 'picks' | 'setPick' | 'setOpenId'>
  setFieldValues: Dispatch<SetStateAction<Record<string, string>>>
  request?: RequestDraft
}): ReportVoiceDraft {
  const [draftMarks, setDraftMarks] = useState<ReadonlySet<string>>(() => new Set())
  const [heard, setHeard] = useState<ReportVoiceDraft['heard']>(null)
  const latest = useRef(p)
  latest.current = p

  const dropDraftMark = useCallback((label: string) => {
    setDraftMarks((prev) => {
      if (!prev.has(label)) return prev
      const next = new Set(prev)
      next.delete(label)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setDraftMarks(new Set())
    setHeard(null)
  }, [])

  const onDraft = useCallback<VoiceDraftHost['onDraft']>((draft, said) => {
    const { fields, lineProgress, setFieldValues } = latest.current
    const notesLabel = notesFieldLabel(fields)
    if (!notesLabel) return
    const lines = lineProgress.lines
    const out = applyDraft(draft, { notesLabel, notesValue: '', lines })
    if (out.draftedFields.length > 0) {
      setFieldValues((prev) => ({ ...prev, [notesLabel]: applyDraft(draft, { notesLabel, notesValue: prev[notesLabel] ?? '', lines }).notesValue }))
    }
    for (const pick of out.picks) lineProgress.setPick(pick.id, pick.pct)
    const first = out.picks[0]
    if (first) lineProgress.setOpenId(first.id)
    setDraftMarks(new Set(out.draftedFields))
    setHeard({ text: said.text, language: draft.language, lines: draftedLineWords(draft, lines) })
  }, [])

  return {
    host: { jobName: p.jobName, lines: p.lineProgress.lines, picks: p.lineProgress.picks, request: p.request ?? DEFAULT_REQUEST, onDraft },
    draftMarks,
    dropDraftMark,
    heard,
    reset,
  }
}
