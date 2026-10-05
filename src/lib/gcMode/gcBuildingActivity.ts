/**
 * GC mode — design spike: what a trade did on the job, for its company's Activity (the owner,
 * 2026-10-04: "add their submittals, punch items and inspections to Activity"). The Board's
 * `partnerActivity` (gcCompanyFile.ts) reads it for the trade we awarded, under *On the job*.
 *
 * Import from `./gcModel`.
 */
import type { GcProject, TradePackage } from './gcTypes'
import { inspectedTrades } from './gcBuildingSchedule'
import { shortDate } from './gcWords'

export interface BuildingEvent {
  on: string
  text: string
}

/** "Seal the joints" → "Seal the joints." A note that already ends a sentence stays as it is. */
function sentence(text: string): string {
  const t = text.trim()
  return /[.!?]$/.test(t) ? t : `${t}.`
}

/** A trade's submittals, punch items and inspections on one job, in no order: the timeline sorts them. */
export function buildingActivity(project: GcProject, pkg: TradePackage): BuildingEvent[] {
  const out: BuildingEvent[] = []

  for (const s of (project.submittals ?? []).filter((x) => x.packageId === pkg.id)) {
    const name = `submittal ${s.number}, ${s.title}`
    out.push({ on: s.askedOn, text: `Asked them for ${name}.` })
    s.rounds.forEach((r, i) => {
      out.push({ on: r.sentOn, text: `Sent ${name}${i > 0 ? `, round ${i + 1}` : ''}.` })
      if (!r.answer || !r.answeredOn) return
      const note = r.answerNote.trim()
      out.push({
        on: r.answeredOn,
        text:
          r.answer === 'revise'
            ? `Submittal ${s.number} came back to revise${note ? `: ${sentence(note)}` : '.'}`
            : `Submittal ${s.number} approved${r.answer === 'approved as noted' ? ' as noted' : ''}${note ? `: ${sentence(note)}` : '.'}`,
      })
    })
  }

  for (const item of (project.punch ?? []).filter((x) => x.packageId === pkg.id)) {
    const what = `${item.text}${item.where ? `, ${item.where}` : ''}`
    out.push({ on: item.addedOn, text: `Punch item: ${sentence(what)}` })
    if (item.sentBack) {
      out.push({ on: item.sentBack.on, text: `A punch item was not fixed${item.sentBack.times > 1 ? `, ${item.sentBack.times} times` : ''}: ${sentence(item.sentBack.note || item.text)}` })
    }
    if (item.fixedOn) out.push({ on: item.fixedOn, text: `Said a punch item is fixed: ${sentence(item.text)}` })
    if (item.checkedOn) out.push({ on: item.checkedOn, text: `Punch item checked fixed: ${sentence(item.text)}` })
  }

  for (const activity of project.schedule?.activities ?? []) {
    const insp = activity.inspection
    if (!insp) continue
    const failed = (insp.failed ?? []).filter((f) => f.packageIds.includes(pkg.id))
    for (const f of failed) {
      out.push({ on: f.on, text: `${insp.label} failed on their work: ${sentence(f.note)} Re-inspection ${shortDate(f.reinspectOn)}.` })
    }
    const theirs = failed.length > 0 || inspectedTrades(project, activity).some((k) => k.id === pkg.id)
    if (insp.passedOn && theirs) out.push({ on: insp.passedOn, text: `${insp.label} passed.` })
  }

  return out
}
