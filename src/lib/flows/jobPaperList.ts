/**
 * Papers on this job's List tab (the prototype's v1.175, `jobPapersListHtml`): each company under its own title, one line
 * per paper it has reached, with the paper's state, the step it finishes and where the person is on that step, and the
 * cell's own press. Read from the grid's cells (`jobPapers.ts`), so the two tabs always agree.
 */
import { shortDate } from '../gc/words'
import { FLOW_PAPERS, type PaperId } from './facts'
import { jobPaperGrid, kindWord, type CellPress, type JobPapersInput } from './jobPapers'
import { flat } from './state'

export interface JobPaperListLine {
  paper: PaperId
  /** "Insurance certificate". */
  label: string
  /** "on file Sep 12", "went, waiting on them", "ran out Sep 30", "nothing on file". */
  state: string
  tone: 'ok' | 'bad' | 'warn' | ''
  /** The step it finishes: "Papers in". */
  step: string
  /** Where the person is on that step: "done", "lapsed", "Greg is on it", "next", "skipped". */
  where: string
  press: CellPress
}

export interface JobPaperListCompany {
  contactId: string
  /** "Hillside Excavation", with what they are to the job beside it. */
  name: string
  kindWord: string
  lines: JobPaperListLine[]
}

/** Each company on the job with the papers it has reached; a paper later in the flow is left off. */
export function jobPaperList(input: JobPapersInput): JobPaperListCompany[] {
  const grid = jobPaperGrid(input)
  return grid.sections.flatMap((section) => {
    const flow = input.flows[section.kind]
    const steps = flow ? flat(flow) : []
    return section.rows.flatMap((row): JobPaperListCompany[] => {
      const company = input.companies.find((c) => c.contactId === row.contactId)
      if (!company) return []
      const lines = row.cells.flatMap((cell): JobPaperListLine[] => {
        if (cell.mark === 'later') return []
        const read = company.reads[cell.paper]
        const ours = section.columns.find((c) => c.paper === cell.paper)?.ours ?? false
        const step = steps.find((s) => s.id === cell.stepId)
        const state =
          cell.mark === 'done'
            ? `on file${read?.on ? ` ${shortDate(read.on)}` : ''}`
            : cell.mark === 'lapsed'
              ? `ran out${read?.expires ? ` ${shortDate(read.expires)}` : ''}`
              : cell.mark === 'soon'
                ? cell.words
                : cell.mark === 'late'
                  ? cell.words
                  : cell.mark === 'waiting'
                    ? // A paper we sent went; one of theirs is simply owed, with its day when it has one.
                      ours && read?.mark === 'wait'
                      ? 'went, waiting on them'
                      : cell.words
                    : 'nothing on file'
        const tone = cell.mark === 'done' ? 'ok' : cell.mark === 'lapsed' || cell.mark === 'late' ? 'bad' : cell.mark === 'soon' ? 'warn' : ''
        const s = read?.stepState
        const where = s === 'done' ? 'done' : s === 'lapsed' ? 'lapsed' : s === 'now' ? `${company.firstName ?? company.name} is on it` : s === 'skipped' ? 'skipped' : 'next'
        return [{ paper: cell.paper, label: FLOW_PAPERS[cell.paper]?.label ?? cell.paper, state, tone, step: step?.name ?? '', where, press: cell.press }]
      })
      return lines.length ? [{ contactId: row.contactId, name: row.name, kindWord: kindWord(section.kind), lines }] : []
    })
  })
}
