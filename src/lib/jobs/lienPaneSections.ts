/**
 * The notice pane's stacked section heads (v2.4733, Taunya's ask: "as I scroll through this
 * section I get lost in where I am"). The Notices list pins its pile titles — the ones passed
 * stack at the top, the ones to come at the bottom, the one you are in is lit — and the pane
 * gets the same device for its five sections. Each head is the section's title row, carrying
 * the fact a glance wants: the next step, how many gates are clear, the houses and their money,
 * the months and the claim, the pages in the envelope. Pure: facts in, heads and offsets out.
 */

/** The height of one head, the Notices list's `PILE_HEAD_H`. */
export const LIEN_PANE_HEAD_H = 30

export type LienPaneSectionKey = 'path' | 'gates' | 'houses' | 'months' | 'envelope'

export type LienPaneSection = {
  key: LienPaneSectionKey
  /** The uppercase label at the left. */
  label: string
  /** The bold fact at the right. */
  fact: string
  /** A muted tail after the fact, cut short first when the row is narrow; '' for none. */
  tail: string
}

export type LienPaneSectionsInput = {
  /** The timeline's next step, "Draft the Jul + Aug notice — 9 days."; null with no timeline. */
  nextWords: string | null
  gates: { ready: boolean; headline: string; summary: string } | null
  /** The job's houses; null when it bought nothing (the section is not drawn). */
  houses: { count: number; housesOwed: number; owed: number; paid: number; asOf: string } | null
  /** 'YYYY-MM', the months on this notice. */
  months: readonly string[]
  /** "$27,199" — the claim as the strip says it. */
  claimWords: string
  /** The pages of the owner's copy the pane shows. */
  pages: number
  /** The GC gets a courtesy PDF too. */
  gcEmail: boolean
  monthShort: (key: string) => string
  money: (n: number) => string
}

function houses(n: number): string {
  return n === 1 ? 'house' : 'houses'
}

/** The heads in pane order. The supply houses head is drawn only when the job has houses. */
export function lienPaneSections(i: LienPaneSectionsInput): LienPaneSection[] {
  const out: LienPaneSection[] = []
  out.push({ key: 'path', label: 'Where this notice is', fact: (i.nextWords ?? '').replace(/\.$/, '') || 'nothing due', tail: '' })
  out.push({
    key: 'gates',
    label: 'The four gates',
    fact: i.gates ? `${i.gates.ready ? '✓' : '✗'} ${i.gates.headline}` : '—',
    tail: i.gates?.summary ?? '',
  })
  if (i.houses) {
    const h = i.houses
    out.push({
      key: 'houses',
      label: 'Supply houses',
      fact: h.housesOwed > 0 ? `${h.housesOwed} ${houses(h.housesOwed)} owed · ${i.money(h.owed)}` : `${h.count} ${houses(h.count)}, all paid · ${i.money(h.paid)}`,
      tail: h.asOf ? `from our books · ${h.asOf}` : '',
    })
  }
  out.push({ key: 'months', label: 'Months on this job', fact: `${i.months.length ? i.months.map(i.monthShort).join(' + ') : 'no months'} · ${i.claimWords}`, tail: '' })
  out.push({ key: 'envelope', label: 'In the envelope', fact: `${i.pages} ${i.pages === 1 ? 'page' : 'pages'} · owner + GC`, tail: i.gcEmail ? 'courtesy PDF to the GC' : '' })
  return out
}

/** Where a head sticks: under the strip and the heads passed, above the heads to come — the list's `top: i·30`, `bottom: (n−1−i)·30`. */
export function lienPaneHeadOffsets(index: number, count: number, stripHeight: number): { top: number; bottom: number } {
  return { top: Math.max(0, stripHeight) + index * LIEN_PANE_HEAD_H, bottom: Math.max(0, count - 1 - index) * LIEN_PANE_HEAD_H }
}

/** The scroll position that lands a section under its own head — the list's rule, with the strip's height on top. */
export function lienPaneSectionScrollTop(bodyOffsetTop: number, index: number, stripHeight: number): number {
  return Math.max(0, bodyOffsetTop - Math.max(0, stripHeight) - (index + 1) * LIEN_PANE_HEAD_H)
}

/**
 * Which head is lit: the last section whose body has reached its stuck head — the list's
 * `rows.offsetTop <= scrollTop + (i + 2) · H`, with the strip's height on top. The first head is
 * lit at the top of the pane; null only with no sections.
 */
export function litLienPaneSection<K extends string>(bodies: ReadonlyArray<{ key: K; offsetTop: number }>, scrollTop: number, stripHeight: number): K | null {
  let on: K | null = bodies[0]?.key ?? null
  bodies.forEach((b, i) => {
    if (b.offsetTop <= scrollTop + Math.max(0, stripHeight) + (i + 2) * LIEN_PANE_HEAD_H) on = b.key
  })
  return on
}
