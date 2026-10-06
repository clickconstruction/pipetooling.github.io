/**
 * GC mode, the real build, PR 1b: the kinds of plan sets, moved word for word from the GC mode
 * prototype (branch spike/gc-mode, `gcPlans.ts` and `gcNewProject.ts`). What a later set can be
 * called and the next one's name; and the owner's words for a bid, pricing and permit set (the
 * owner, 2026-10-04: "I think it's important that we explain to a user what these different kinds
 * of plans are"). A project here is only what the kernels read of one: its stage and its sets' labels.
 */

/** What a later set can be called. An addendum comes while we bid; a bulletin once the job is ours. */
export const SET_KINDS: { kind: string; numbered: boolean }[] = [
  { kind: 'Addendum', numbered: true },
  { kind: 'Bulletin', numbered: true },
  { kind: 'Revised set', numbered: false },
  { kind: 'Permit set', numbered: false },
  { kind: 'Construction set', numbered: false },
]

/** The kind a new set starts as: an addendum while we bid, a bulletin once the job is ours. */
export function defaultSetKind(project: { stage: string }): string {
  return project.stage === 'pursuing' ? 'Addendum' : 'Bulletin'
}

/** The next set's name for a kind. Each numbered kind counts on its own: Addendum 2, then Bulletin 1. */
export function nextSetLabel(project: { planSets: { label: string }[] }, kind: string): string {
  const numbered = SET_KINDS.find((k) => k.kind === kind)?.numbered ?? false
  const labels = project.planSets.map((s) => s.label)
  if (numbered) {
    const n = labels.filter((l) => new RegExp(`^${kind} \\d+$`).test(l)).length
    return `${kind} ${n + 1}`
  }
  if (!labels.includes(kind)) return kind
  let n = 2
  while (labels.includes(`${kind} ${n}`)) n += 1
  return `${kind} ${n}`
}

/** One kind of set a new project starts from: when it comes, who gets it, what is in it, what it is for. */
export interface SetKindHelp {
  kind: string
  alsoCalled?: string
  when: string
  who: string
  inIt: string
  forWhat: string
}

/** The three kinds on New project's step 2, in the chips' order. */
export const SET_KIND_HELP: SetKindHelp[] = [
  {
    kind: 'Bid set',
    when: 'Usually at 100% construction documents. It is complete enough for a contractor to commit to a firm price.',
    who: 'General contractors for competitive bidding, and through them the subcontractors.',
    inIt: 'The full project manual. That is the technical specifications, bidding instructions, bid forms, and general and supplementary conditions.',
    forWhat:
      'A firm price. Questions and changes during bidding come as formal addenda. Once a contractor is picked, the bid set and its addenda are the basis of the contract.',
  },
  {
    kind: 'Pricing set',
    alsoCalled: 'Also called a budget set or an estimating set.',
    when: 'Partway through design. Often around design development, or at 50 to 75% construction documents.',
    who: 'A contractor or construction manager, usually on a negotiated or design-assist job.',
    inIt: 'Less than a full set. The specifications may be an outline, and many details are missing. The contractor fills the gaps with allowances, assumptions and qualifications.',
    forWhat:
      'A budget check. The owner can check the budget, explore value engineering, and catch cost problems before the design is locked in. It is not meant to set a binding contract price.',
  },
  {
    kind: 'Permit set',
    when: 'When the drawings go in for plan review. They are revised until they are approved.',
    who: 'The building department, or another authority having jurisdiction.',
    inIt: 'What code asks for, more than buildability or cost. It shows life safety and egress, fire separations, structural design, accessibility, energy code, and MEP systems as code sees them. It usually has a code analysis sheet, structural calculations and energy compliance forms. It carries the seals and signatures of the licensed architects and engineers. It can be light on what the reviewer does not need, like finishes, casework detail or the owner\'s own preferences.',
    forWhat: 'Code approval. Plan reviewers send comments, and the drawings get revised until approved. The approved, stamped set has to be kept on the job site.',
  },
]
