import { useState, type CSSProperties } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { proposalTotals, proposalUncostedWords } from '../../lib/gc/bids'
import {
  BOARD_SECTION_ORDER,
  boardCustomerElementId,
  boardSectionCounts,
  boardSectionElementId,
  boardSectionOf,
  boardSectionWorthWords,
  customerGroups,
  customerWorthWords,
  type BoardGroupBy,
  type BoardSection,
} from '../../lib/gc/boardGroups'
import { currentRev, planLabel } from '../../lib/gc/lookups'
import { lostWords } from '../../lib/gc/lost'
import type { GcProject, GcStage, GcState } from '../../lib/gc/types'
import { daysUntil, money, shortDate, weekdayDate } from '../../lib/gc/words'
import { GcBoardStrip, GcCustomerHeading, GcStageHeading, GcStageSubheading, type BoardStripItem, type StageStripItem } from './GcBoardStages'
import { projectPeople, type ProjectPerson } from '../../lib/gc/projectPeople'
import { callSheetId } from '../../lib/gc/schedule/callList'
import { useCustomerOpener } from './gcCustomerOpener'
import { GcPeoplePill } from './GcPeoplePill'
import { GcProgressRing } from './GcProgressRing'
import { RING_COLORS, stageProgress } from '../../lib/gc/progress'
import type { RingRead } from './useRingLayers'
import { GcPriceCard, GcPriceLikely, GcPriceTrigger } from './GcPriceCard'
import { Chip, PlusUnknown, type Tone } from './gcUi'
import { GC_ICON_PATHS } from './gcIcons'
import { useJumpStrip } from './useJumpStrip'
import { usePriceCard } from './usePriceCard'
import { EmptyState, type EmptyStateWords } from '../EmptyState'
import { boardBarsSaySomething, boardPriceBar, boardSectionBarWords, type BoardPriceBarKind } from '../../lib/gc/boardPriceBar'
import { GcBoardPriceBar } from './GcBoardPriceBar'
import { ShapeSwitch, SideBySide, type ShapeView } from '../prototypes/SideBySide'

/**
 * GC mode, the real build (the Board's B3): the Project Board on real data, from the design spike's
 * board (`GcMode.tsx`). The three stages and Closed and Lost, each a section with its heading, and
 * the strip that jumps between them; each project a row with its days left (or its start), its
 * customer and architect, and its price with the card behind it. Read only: a row opens the
 * project. Since the Board's B2b-ii each row carries Who to call (`GcPeoplePill`): its job's share of the people we wait
 * on (`projectPeople`). Follow up's badge and Needs you keep one number (call E1): since v2.5289 the people waiting on us
 * (`follow_up_count`), while everyone we wait on (`allPeople`) heads the asks list under them. Since B2b-iii the strip's **By stage | By customer** switch (the owner, 2026-10-04; By
 * stage each time the board opens) shows the same rows under each customer we build for, a heading per stage they
 * have jobs in, their closed and lost jobs on one quiet line. A section and a customer are worth `priceToOwner`'s price
 * (gc 5's read). The ring comes with a later cut. Since B2b-viii-a (`onFollowUpJob`) the Who to call card's Follow up and
 * **Work the list** open the Follow up sheet on the job's people. Since v2.6159 (punch list #217, gc-messages-5, a
 * prototype) each bidding row can draw its price as a bar on its own line (`GcBoardPriceBar` over `boardPriceBar`), behind
 * the page's per-person switch (`priceBars`, off by default); with `?sbs=1` and a dev signed in, Bidding draws today's rows
 * and the rows with the bars one above the other.
 */

/**
 * A section's empty words (punch list #184, sweep C), in the shape `EmptyState` draws. Bidding's carries the page's New project
 * press, drawn only when the page gives its opener (`onNewProject`). Buying out and Building say what moves a job in; Closed
 * and Lost say none is there yet, their blurbs above saying how one gets there.
 */
type SectionEmpty = { main: string; newProject?: { tail: string } }

const SECTIONS: Record<BoardSection, { label: string; tone: Tone; number?: number; blurb: string; empty: SectionEmpty; order: (a: GcProject, b: GcProject) => number }> = {
  pursuing: {
    label: 'Bidding to the customer',
    tone: 'amber',
    number: 1,
    blurb: 'Collect a number for every trade, then give the customer a price.',
    empty: { main: 'Nothing is being bid right now.', newProject: { tail: 'starts one when plans come in.' } },
    order: (a, b) => (a.bidDue ?? '9999').localeCompare(b.bidDue ?? '9999'),
  },
  buyout: {
    label: 'Buying out',
    tone: 'blue',
    number: 2,
    blurb: 'We won. Award each trade, get everything signed, then start.',
    empty: { main: 'No job is in buyout right now. A bid comes here once we win it.' },
    order: (a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999'),
  },
  building: {
    label: 'Building',
    tone: 'green',
    number: 3,
    blurb: 'Trades report their work and ask for draws.',
    empty: { main: 'Nothing is being built right now. A won job comes here once work starts.' },
    order: (a, b) => (a.startedOn ?? '9999').localeCompare(b.startedOn ?? '9999'),
  },
  closed: {
    label: 'Closed',
    tone: 'grey',
    blurb: 'Every trade closed out and the customer paid our last bill. Kept here for the record.',
    empty: { main: 'No job is closed yet.' },
    order: (a, b) => (b.closedOn ?? '').localeCompare(a.closedOn ?? ''),
  },
  lost: {
    label: 'Lost',
    tone: 'grey',
    blurb: 'Bids the customer gave to another builder. Kept so we learn why.',
    empty: { main: 'No bid is lost yet.' },
    order: (a, b) => (b.lostOn ?? '').localeCompare(a.lostOn ?? ''),
  },
}

/** A section's empty state: its words, with New project as the press where the section has one and the page gives the opener. */
function sectionEmptyWords(key: BoardSection, onNewProject?: () => void): EmptyStateWords {
  const { main, newProject } = SECTIONS[key].empty
  return newProject && onNewProject ? { main, next: { label: 'New project', onPress: onNewProject }, tail: newProject.tail } : { main }
}

/** The three stages a job moves through, in order: the small headings under a customer on By customer. */
const STAGES: GcStage[] = ['pursuing', 'buyout', 'building']

/** By stage | By customer before the strip's pills (the design spike's switch). By stage is the board's own order. */
function GroupSwitch({ value, onChange }: { value: BoardGroupBy; onChange: (v: BoardGroupBy) => void }) {
  const options: { key: BoardGroupBy; label: string }[] = [
    { key: 'stage', label: 'By stage' },
    { key: 'customer', label: 'By customer' },
  ]
  return (
    <span role="group" aria-label="Group the board" data-tour="gc-group-switch" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 999, overflow: 'hidden' }}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          style={{
            border: 'none',
            padding: '0.25rem 0.8rem',
            fontSize: '0.8rem',
            fontWeight: value === o.key ? 600 : 400,
            cursor: 'pointer',
            background: value === o.key ? 'var(--bg-blue-tint)' : 'transparent',
            color: value === o.key ? 'var(--text-blue-800)' : 'var(--text-muted)',
          }}
        >
          {o.label}
        </button>
      ))}
    </span>
  )
}

const alsoLink: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'var(--text-link)',
  cursor: 'pointer',
  textDecoration: 'underline',
  textDecorationColor: 'var(--border-blue)',
  textUnderlineOffset: 3,
}

export function GcBoard({
  state,
  onOpen,
  onPlans,
  onCompare,
  moneyShown = true,
  folderUrls = {},
  onChase,
  onFollowUpJob,
  ring,
  onNewProject,
  priceBars,
}: {
  state: GcState
  /** Opens a project: its card on the GC projects page. */
  onOpen: (projectId: string) => void
  onPlans: (projectId: string) => void
  /** Opens Compare quotes on one trade, from the price card's trade line (B5-b). */
  onCompare?: (projectId: string, packageId: string) => void
  /** The reader is on the money team (B5-c). False: each price is the trades alone, and says so. */
  moneyShown?: boolean
  /** Each project's Drive folder, by project id. */
  folderUrls?: Record<string, string>
  /** Opens Follow up, from a row's Who to call card (B2b-ii). Unset: rows draw no Who to call. */
  onChase?: () => void
  /**
   * The Follow up sheet on one job's people, at a person (a company's id, or `customer:<id>`), on "What did they say?" after a
   * Call (B2b-viii-a). Unset: the Who to call card's Call only dials, and it has no Work the list.
   */
  onFollowUpJob?: (projectId: string, partnerId: string, calling: boolean) => void
  /** The rings' read (B2b-vi-c, `useRingLayers`): each row's ring, from the board with what it counts laid over it. Unset: no ring column. */
  ring?: RingRead | null
  /** Opens the page's New project window, from an empty Bidding section (punch list #184). Unset: the section's words alone. */
  onNewProject?: () => void
  /** The price bars' switch (punch list #217, gc-messages-5): on, each bidding row draws its bar; side by side, both shapes. Unset: today's rows. */
  priceBars?: ShapeView
}) {
  const bySection = new Map<BoardSection, GcProject[]>()
  for (const key of BOARD_SECTION_ORDER) bySection.set(key, [])
  for (const p of state.projects) bySection.get(boardSectionOf(p))?.push(p)
  for (const [key, list] of bySection) list.sort(SECTIONS[key].order)
  const items: StageStripItem[] = BOARD_SECTION_ORDER.map((key) => ({
    key,
    label: SECTIONS[key].label,
    tone: SECTIONS[key].tone,
    count: bySection.get(key)?.length ?? 0,
    ...(SECTIONS[key].number ? { number: SECTIONS[key].number } : {}),
  }))
  // A section is worth what its customers pay: the price they signed once they sign, ours until then (`priceToOwner`).
  const counts = boardSectionCounts(state)
  // By customer (the owner, 2026-10-04): the same rows under each customer we build for. By stage each time it opens.
  const [group, setGroup] = useState<BoardGroupBy>('stage')
  const groups = customerGroups(state)
  const customers = useCustomerOpener()
  const customerItems: BoardStripItem[] = groups.map((g) => ({
    key: g.customer.id,
    label: g.customer.name,
    tone: 'blue',
    count: g.open.length,
    dots: STAGES.filter((stage) => g.open.some((p) => p.stage === stage)).map((stage) => SECTIONS[stage].tone),
  }))
  const byCustomer = group === 'customer'
  // The bars (gc-messages-5): on for this person, or both shapes for a dev who asked for them. On, they draw only while
  // some bidding row's bar says something its figure does not (`boardBarsSaySomething`); a board of plain quoted rows
  // keeps its numbers. Side by side draws them regardless and says when they would stay off.
  const sideBySide = priceBars?.sideBySide === true
  const biddingBars = priceBars?.on || sideBySide ? (bySection.get('pursuing') ?? []).map((p) => boardPriceBar(state, p, { moneyShown })) : []
  const barsSay = boardBarsSaySomething(biddingBars)
  const barsOn = priceBars?.on === true && !sideBySide && barsSay
  const jump = useJumpStrip(
    true,
    byCustomer ? groups.map((g) => g.customer.id) : BOARD_SECTION_ORDER,
    (k) => (byCustomer ? boardCustomerElementId(k) : boardSectionElementId(k as BoardSection)),
    group,
  )
  const row = (p: GcProject, bar: boolean = barsOn) => (
    <ProjectRow
      key={p.id}
      project={p}
      state={state}
      bar={bar}
      onOpen={() => onOpen(p.id)}
      onPlans={() => onPlans(p.id)}
      onCompare={onCompare && ((packageId) => onCompare(p.id, packageId))}
      moneyShown={moneyShown}
      folderUrl={folderUrls[p.id] ?? ''}
      byCustomer={byCustomer}
      {...(onChase ? { onChase } : {})}
      {...(onFollowUpJob ? { onFollowUp: (partnerId: string, calling: boolean) => onFollowUpJob(p.id, partnerId, calling) } : {})}
      {...(ring ? { ring } : {})}
    />
  )
  return (
    <section aria-label="Project Board" style={{ display: 'grid', gap: '1rem' }}>
      <GcBoardStrip
        items={byCustomer ? customerItems : items}
        active={jump.active}
        onJump={jump.jumpTo}
        label={byCustomer ? 'Jump to a customer' : 'Jump to a stage'}
        lead={
          <span style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <GroupSwitch value={group} onChange={setGroup} />
            {priceBars ? <ShapeSwitch view={priceBars} words={{ on: 'Show today’s look', off: 'Show the price bars' }} /> : null}
          </span>
        }
      />
      {byCustomer &&
        groups.map((g) => {
          // Closed and lost jobs fold into one quiet line under the customer (the spike's rule).
          const folded = [...g.closed.map((p) => ({ p, word: `closed ${shortDate(p.closedOn ?? '')}` })), ...g.lost.map((p) => ({ p, word: 'lost' }))]
          return (
            <div key={g.customer.id} data-gc-board-customer={g.customer.id} style={{ display: 'grid', gap: '0.5rem' }}>
              <GcCustomerHeading
                id={boardCustomerElementId(g.customer.id)}
                name={g.customer.name}
                title={`Open ${g.customer.name}`}
                onName={() => customers?.openCustomer(g.customer.id)}
                count={g.open.length}
                sub={g.customer.contact}
                money={customerWorthWords(g.open)}
              />
              {g.open.length === 0 ? (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', padding: '0 0.25rem' }}>Nothing open with them right now.</span>
              ) : (
                STAGES.filter((stage) => g.open.some((p) => p.stage === stage)).map((stage) => {
                  const jobs = g.open.filter((p) => p.stage === stage)
                  const item = items.find((i) => i.key === stage)!
                  return (
                    <div key={stage} style={{ display: 'grid', gap: '0.5rem' }}>
                      <GcStageSubheading item={{ ...item, count: jobs.length }} />
                      {jobs.map((p) => row(p))}
                    </div>
                  )
                })
              )}
              {folded.length > 0 && (
                <div data-gc-board-also={g.customer.id} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Also:{' '}
                  {folded.map(({ p, word }, i) => (
                    <span key={p.id}>
                      {i > 0 && ' · '}
                      <button type="button" onClick={() => onOpen(p.id)} style={alsoLink}>
                        {p.name}
                      </button>
                      , {word}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      {!byCustomer && BOARD_SECTION_ORDER.map((key) => {
        const list = bySection.get(key) ?? []
        const item = items.find((i) => i.key === key)!
        const todayWorth = boardSectionWorthWords(counts.find((c) => c.key === key) ?? { key, count: 0, worth: 0 })
        // With the bars (gc-messages-5), Bidding's heading says the section's two sums in words, not a fourth bar.
        const bidding = key === 'pursuing' && list.length > 0
        const barWorth = bidding ? boardSectionBarWords(biddingBars) : todayWorth
        if (bidding && sideBySide) {
          return (
            <div key={key} style={{ display: 'grid', gap: '0.5rem' }}>
              <GcStageHeading item={item} worth={todayWorth} blurb={SECTIONS[key].blurb} />
              <SideBySide
                label="With the bars"
                testId="gc-board-side-by-side"
                today={<div style={{ display: 'grid', gap: '0.5rem' }}>{list.map((p) => row(p, false))}</div>}
                shape={
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <span data-gc-board-bar-worth style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-amber-800)', fontVariantNumeric: 'tabular-nums' }}>{barWorth}</span>
                    {!barsSay && (
                      <span data-gc-board-bars-held style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        With the switch on, this board would keep its numbers: every bidding row is one quoted part, so a bar says nothing the figure does not.
                      </span>
                    )}
                    {list.map((p) => row(p, true))}
                  </div>
                }
              />
            </div>
          )
        }
        return (
          <div key={key} style={{ display: 'grid', gap: '0.5rem' }}>
            <GcStageHeading item={item} worth={barsOn && bidding ? barWorth : todayWorth} blurb={SECTIONS[key].blurb} />
            {list.length === 0 ? <EmptyState compact {...sectionEmptyWords(key, onNewProject)} /> : list.map((p) => row(p))}
          </div>
        )
      })}
    </section>
  )
}

const blockBox: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  padding: '0.35rem 0.25rem',
  borderRadius: 8,
  lineHeight: 1.15,
  fontVariantNumeric: 'tabular-nums',
}
const quietBlock: CSSProperties = { ...blockBox, color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }

/** Inside a week red, inside two amber, else plain: the days-left block's colors. */
function dayTone(days: number): { bg: string; fg: string } {
  return days <= 7 ? { bg: 'var(--bg-red-100)', fg: 'var(--text-red-800)' } : days <= 14 ? { bg: 'var(--bg-amber-100)', fg: 'var(--text-amber-800)' } : { bg: 'var(--bg-muted)', fg: 'var(--text-700)' }
}

/** The block at the head of a row: the days before our bid is due, or what is next for a job past bidding. */
export function DueBlock({ project, today }: { project: GcProject; today: string }) {
  if (project.lostOn) {
    return (
      <span style={quietBlock} title={`Lost ${weekdayDate(project.lostOn)}. ${lostWords(project)}.`}>
        <span>lost</span>
        <span style={{ fontWeight: 600 }}>{shortDate(project.lostOn)}</span>
      </span>
    )
  }
  if (project.closedOn) {
    return (
      <span style={quietBlock} title={`Closed ${weekdayDate(project.closedOn)}.`}>
        <span>closed</span>
        <span style={{ fontWeight: 600 }}>{shortDate(project.closedOn)}</span>
      </span>
    )
  }
  // A won job's row shows what is next, not when our bid went in (the owner, 2026-10-03).
  if (project.stage === 'buyout') return <StartBlock project={project} today={today} />
  if (project.stage === 'building' && project.startedOn) {
    return (
      <span style={quietBlock} title={`Work started ${weekdayDate(project.startedOn)}.`}>
        <span>started</span>
        <span style={{ fontWeight: 600 }}>{shortDate(project.startedOn)}</span>
      </span>
    )
  }
  if (project.stage !== 'pursuing' || !project.bidDue) {
    return (
      <span style={quietBlock}>
        {project.ourBidSentOn ? (
          <>
            <span>our bid went in</span>
            <span style={{ fontWeight: 600 }}>{shortDate(project.ourBidSentOn)}</span>
          </>
        ) : (
          <span>no due date</span>
        )}
      </span>
    )
  }
  const days = daysUntil(project.bidDue, today)
  const sent = project.ourBidSentOn !== null
  const tone = sent ? { bg: 'var(--bg-green-100)', fg: 'var(--text-green-800)' } : dayTone(days)
  const words = sent ? 'bid is in' : days < 0 ? (days === -1 ? 'day late' : 'days late') : days === 0 ? 'due today' : days === 1 ? 'day left' : 'days left'
  return (
    <span
      style={{ ...blockBox, background: tone.bg, color: tone.fg }}
      title={sent ? `Our bid went in ${shortDate(project.ourBidSentOn)}. It was due ${weekdayDate(project.bidDue)}.` : `Our bid is due ${weekdayDate(project.bidDue)}.`}
    >
      {sent ? <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>✓</span> : days !== 0 && <span style={{ fontSize: '1.6rem', fontWeight: 700 }}>{Math.abs(days)}</span>}
      <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{words}</span>
      <span style={{ fontSize: '0.75rem' }}>{weekdayDate(project.bidDue)}</span>
    </span>
  )
}

/** Buying out: the days until the planned start, colored like the days-left block. A passed day reads late because Start is still shut. */
function StartBlock({ project, today }: { project: GcProject; today: string }) {
  if (!project.startDate) {
    return (
      <span style={quietBlock} title="No start date yet. Set it on Get started.">
        <span>no start date</span>
      </span>
    )
  }
  const days = daysUntil(project.startDate, today)
  const tone = dayTone(days)
  const words = days < 0 ? (days === -1 ? 'day late' : 'days late') : days === 0 ? 'starts today' : days === 1 ? 'day to start' : 'days to start'
  return (
    <span
      style={{ ...blockBox, background: tone.bg, color: tone.fg }}
      title={days < 0 ? `Work was planned to start ${weekdayDate(project.startDate)}. Start is still shut.` : `Work is planned to start ${weekdayDate(project.startDate)}.`}
    >
      {days !== 0 && <span style={{ fontSize: '1.6rem', fontWeight: 700 }}>{Math.abs(days)}</span>}
      <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{words}</span>
      <span style={{ fontSize: '0.75rem' }}>{weekdayDate(project.startDate)}</span>
    </span>
  )
}

/** The Bid Board's folder and plans glyphs, in its blue, so the two boards' links read the same. */
function GcIcon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={size} height={size} fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  )
}

const linkIcon: CSSProperties = {
  color: 'var(--text-blue-500)',
  background: 'transparent',
  border: 'none',
  padding: '0.25rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
}

/**
 * A row's ring (B2b-vi-c): how far the job is through its stage, from the rings' read. A stage the reader may not see keeps
 * an empty cell, so the rows line up; one still reading what it counts is an empty track that says so.
 */
function RingCell({ project, ring }: { project: GcProject; ring: RingRead }) {
  const laid = ring.state.projects.find((p) => p.id === project.id)
  const label = SECTIONS[boardSectionOf(project)].label
  if (!ring.shown.has(project.stage) || !laid) return <span aria-hidden />
  if (!ring.ready.has(project.stage)) {
    const words = ring.failed ? 'The ring could not read what it counts. Reload the page to try again.' : 'Reading what the ring counts.'
    return (
      <span data-gc-board-ring={project.id} style={{ display: 'flex', justifyContent: 'center' }}>
        <span role="img" aria-label={words} title={words} style={{ width: 56, height: 56, boxSizing: 'border-box', borderRadius: '50%', border: '7px solid var(--border)' }} />
      </span>
    )
  }
  return (
    <span data-gc-board-ring={project.id} style={{ display: 'flex', justifyContent: 'center' }}>
      <GcProgressRing progress={stageProgress(ring.state, laid)} color={RING_COLORS[project.stage]} stageLabel={label} />
    </span>
  )
}

function ProjectRow({
  project,
  state,
  onOpen,
  onPlans,
  onCompare,
  moneyShown,
  folderUrl,
  byCustomer = false,
  onChase,
  onFollowUp,
  ring,
  bar = false,
}: {
  project: GcProject
  state: GcState
  onOpen: () => void
  onPlans: () => void
  onCompare?: ((packageId: string) => void) | undefined
  moneyShown: boolean
  folderUrl: string
  /** Draw the price as a bar under the row (punch list #217, gc-messages-5): a bidding row only. */
  bar?: boolean
  /** On By customer the heading names the customer, so the row leaves their name out (B2b-iii). */
  byCustomer?: boolean
  onChase?: () => void
  /** The Follow up sheet on this job's people, at a person (`callSheetId`). */
  onFollowUp?: (partnerId: string, calling: boolean) => void
  ring?: RingRead
}) {
  // Outside the money team the price is the trades alone (B5-c), so its words say so.
  const soFar = moneyShown ? 'so far' : 'trades so far'
  const totals = proposalTotals(project)
  // Who to call on this job, and Work the list from the first of them (B2b-viii-a): the sheet walks the job's people.
  const people = onChase && !project.lostOn ? projectPeople(state, project) : null
  const firstPerson = people?.people[0]
  const workList = onFollowUp && firstPerson ? () => onFollowUp(callSheetId(firstPerson), false) : null
  const card = usePriceCard()
  // The bar under a bidding row, and the segment that last opened the card, so the card lights that group of trades.
  const priceBar = bar && boardSectionOf(project) === 'pursuing' ? boardPriceBar(state, project, { moneyShown }) : null
  const [barFocus, setBarFocus] = useState<BoardPriceBarKind | null>(null)
  // The customer's name opens their window (the Board's B6-d-ii) where the page gives one; plain words otherwise.
  const customers = useCustomerOpener()
  const newest = planLabel(project, currentRev(project))
  // A phone or a narrow pane: the days and the name on top, the rest on the lines under.
  const narrow = useMatchMedia('(max-width: 760px)')
  return (
    <div
      onClick={onOpen}
      data-gc-board-row={project.id}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.75rem 1rem',
        cursor: 'pointer',
        color: 'var(--text-base)',
        display: 'grid',
        // The ring's column comes first when the page reads the rings (B2b-vi-c), on every row so they line up. On a phone
        // the ring stands over the days block in its column, so the name keeps the width it has.
        gridTemplateColumns: narrow ? '6.5rem minmax(0, 1fr)' : ring ? '3.5rem 7rem minmax(0, 1fr) auto auto' : '7rem minmax(0, 1fr) auto auto',
        gap: narrow ? '0.6rem 0.75rem' : '1rem',
        alignItems: 'center',
      }}
    >
      {ring && !narrow && <RingCell project={project} ring={ring} />}
      <div style={ring && narrow ? { display: 'grid', justifyItems: 'center', gap: '0.4rem' } : { display: 'flex' }}>
        {ring && narrow && <RingCell project={project} ring={ring} />}
        <DueBlock project={project} today={state.today} />
      </div>
      <span style={{ minWidth: 0 }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '1rem', fontWeight: 700, color: 'var(--text-base)', cursor: 'pointer', textAlign: 'left' }}
        >
          {project.name}
        </button>
        <br />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {/* The dot rides with the customer's name, so it never starts a line on a phone. */}
          {byCustomer ? null : customers && project.customerId ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                customers.openCustomer(project.customerId)
              }}
              title={`Open ${project.owner}`}
              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }}
            >
              {project.owner}
            </button>
          ) : (
            project.owner
          )}
          {project.architect && (
            <>
              {byCustomer ? null : <>{'\u00a0·'} </>}
              <span style={{ display: 'inline-block' }}>drawn by {project.architect}</span>
            </>
          )}
        </span>
        {project.lostOn && (
          <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
            <Chip tone="grey">{lostWords(project)}</Chip>
          </span>
        )}
        {/* Everyone we are waiting on for this job, in one count (the owner, 2026-10-04). */}
        {onChase && people && (
          <span data-gc-board-people={project.id} style={{ display: 'block', marginTop: '0.35rem' }}>
            <GcPeoplePill summary={people} projectName={project.name} onWorkList={workList} onOpenFollowUp={onChase} {...(onFollowUp ? { onFollowUp: (person: ProjectPerson, calling: boolean) => onFollowUp(callSheetId(person), calling) } : {})} />
          </span>
        )}
      </span>
      <span style={{ display: 'inline-flex', gap: '0.2rem', alignItems: 'center', ...(narrow ? { gridColumn: '1 / 2' } : null) }} aria-label="Links">
        {folderUrl && (
          <a href={folderUrl} target="_blank" rel="noreferrer" style={linkIcon} title="Project folder in Google Drive" aria-label={`Project folder, ${project.name}`} onClick={(e) => e.stopPropagation()}>
            <GcIcon d={GC_ICON_PATHS.folder} />
          </a>
        )}
        <button
          type="button"
          style={linkIcon}
          title={`Plans · ${newest}`}
          aria-label={`Plans, ${project.name}`}
          onClick={(e) => {
            e.stopPropagation()
            onPlans()
          }}
        >
          <GcIcon d={GC_ICON_PATHS.plans} />
        </button>
      </span>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '1.05rem', textAlign: 'right', ...(narrow ? { gridColumn: '2 / -1' } : null) }}>
        {money(totals.price)}
        <PlusUnknown words={proposalUncostedWords(project)} />
        {priceBar ? (
          // With the bar (gc-messages-5): two short lines, what the figure is and what it comes to; the bar carries the rest.
          <>
            <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: priceBar.holes > 0 ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
              <GcPriceTrigger card={card} label={`${priceBar.lines.first}. Show each trade.`} onArm={() => setBarFocus(null)}>
                {priceBar.lines.first}
              </GcPriceTrigger>
            </span>
            {priceBar.lines.second ? (
              <span data-gc-board-bar-likely style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-base)' }}>
                {priceBar.lines.second.replace(/ with every trade in$/, '')} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>with every trade in</span>
              </span>
            ) : null}
          </>
        ) : totals.holes.length > 0 ? (
          <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-red-700)' }}>
            <GcPriceTrigger card={card} label={`${soFar}, with ${totals.holes.length} ${totals.holes.length === 1 ? 'hole' : 'holes'}. Show each trade.`}>
              {soFar}, with {totals.holes.length} {totals.holes.length === 1 ? 'hole' : 'holes'}
            </GcPriceTrigger>
          </span>
        ) : (
          totals.plugged.length > 0 && (
            <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>
              <GcPriceTrigger card={card} label="with our guesses in it. Show each trade.">
                with our guesses in it
              </GcPriceTrigger>
            </span>
          )
        )}
        {!priceBar && !moneyShown && totals.holes.length === 0 && totals.plugged.length === 0 && (
          <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}>the trades alone</span>
        )}
        {!priceBar && <GcPriceLikely state={state} project={project} />}
      </span>
      <GcPriceCard card={card} state={state} project={project} onOpen={onOpen} moneyShown={moneyShown} focus={priceBar ? barFocus : null} {...(onCompare ? { onCompare } : {})} />
      {priceBar ? <GcBoardPriceBar bar={priceBar} card={card} onArm={setBarFocus} /> : null}
    </div>
  )
}
