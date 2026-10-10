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
import { projectPeople } from '../../lib/gc/projectPeople'
import { useCustomerOpener } from './gcCustomerOpener'
import { GcPeoplePill } from './GcPeoplePill'
import { GcPriceCard, GcPriceLikely, GcPriceTrigger } from './GcPriceCard'
import { Chip, PlusUnknown, type Tone } from './gcUi'
import { GC_ICON_PATHS } from './gcIcons'
import { useJumpStrip } from './useJumpStrip'
import { usePriceCard } from './usePriceCard'

/**
 * GC mode, the real build (the Board's B3): the Project Board on real data, from the design spike's
 * board (`GcMode.tsx`). The three stages and Closed and Lost, each a section with its heading, and
 * the strip that jumps between them; each project a row with its days left (or its start), its
 * customer and architect, and its price with the card behind it. Read only: a row opens the
 * project. Since the Board's B2b-ii each row carries Who to call (`GcPeoplePill`): its job's share of the people we wait
 * on (`projectPeople`). Follow up's badge and Needs you move to the count once a person (`allPeople`, call E1) together,
 * so the two keep one number. Since B2b-iii the strip's **By stage | By customer** switch (the owner, 2026-10-04; By
 * stage each time the board opens) shows the same rows under each customer we build for, a heading per stage they
 * have jobs in, their closed and lost jobs on one quiet line. A section and a customer are worth `priceToOwner`'s price
 * (gc 5's read). The ring comes with a later cut.
 */

const SECTIONS: Record<BoardSection, { label: string; tone: Tone; number?: number; blurb: string; empty: string; order: (a: GcProject, b: GcProject) => number }> = {
  pursuing: {
    label: 'Bidding to the customer',
    tone: 'amber',
    number: 1,
    blurb: 'Collect a number for every trade, then give the customer a price.',
    empty: 'None right now.',
    order: (a, b) => (a.bidDue ?? '9999').localeCompare(b.bidDue ?? '9999'),
  },
  buyout: {
    label: 'Buying out',
    tone: 'blue',
    number: 2,
    blurb: 'We won. Award each trade, get everything signed, then start.',
    empty: 'None right now.',
    order: (a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999'),
  },
  building: {
    label: 'Building',
    tone: 'green',
    number: 3,
    blurb: 'Trades report their work and ask for draws.',
    empty: 'None right now.',
    order: (a, b) => (a.startedOn ?? '9999').localeCompare(b.startedOn ?? '9999'),
  },
  closed: {
    label: 'Closed',
    tone: 'grey',
    blurb: 'Every trade closed out and the customer paid our last bill. Kept here for the record.',
    empty: 'None yet.',
    order: (a, b) => (b.closedOn ?? '').localeCompare(a.closedOn ?? ''),
  },
  lost: {
    label: 'Lost',
    tone: 'grey',
    blurb: 'Bids the customer gave to another builder. Kept so we learn why.',
    empty: 'None yet.',
    order: (a, b) => (b.lostOn ?? '').localeCompare(a.lostOn ?? ''),
  },
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
  const jump = useJumpStrip(
    true,
    byCustomer ? groups.map((g) => g.customer.id) : BOARD_SECTION_ORDER,
    (k) => (byCustomer ? boardCustomerElementId(k) : boardSectionElementId(k as BoardSection)),
    group,
  )
  const row = (p: GcProject) => (
    <ProjectRow
      key={p.id}
      project={p}
      state={state}
      onOpen={() => onOpen(p.id)}
      onPlans={() => onPlans(p.id)}
      onCompare={onCompare && ((packageId) => onCompare(p.id, packageId))}
      moneyShown={moneyShown}
      folderUrl={folderUrls[p.id] ?? ''}
      byCustomer={byCustomer}
      {...(onChase ? { onChase } : {})}
    />
  )
  return (
    <section aria-label="Project Board" style={{ display: 'grid', gap: '1rem' }}>
      <GcBoardStrip
        items={byCustomer ? customerItems : items}
        active={jump.active}
        onJump={jump.jumpTo}
        label={byCustomer ? 'Jump to a customer' : 'Jump to a stage'}
        lead={<GroupSwitch value={group} onChange={setGroup} />}
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
                      {jobs.map(row)}
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
        return (
          <div key={key} style={{ display: 'grid', gap: '0.5rem' }}>
            <GcStageHeading item={item} worth={boardSectionWorthWords(counts.find((c) => c.key === key) ?? { key, count: 0, worth: 0 })} blurb={SECTIONS[key].blurb} />
            {list.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', padding: '0 0.25rem' }}>{SECTIONS[key].empty}</span>
            ) : (
              list.map(row)
            )}
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
}: {
  project: GcProject
  state: GcState
  onOpen: () => void
  onPlans: () => void
  onCompare?: ((packageId: string) => void) | undefined
  moneyShown: boolean
  folderUrl: string
  /** On By customer the heading names the customer, so the row leaves their name out (B2b-iii). */
  byCustomer?: boolean
  onChase?: () => void
}) {
  // Outside the money team the price is the trades alone (B5-c), so its words say so.
  const soFar = moneyShown ? 'so far' : 'trades so far'
  const totals = proposalTotals(project)
  const card = usePriceCard()
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
        gridTemplateColumns: narrow ? '6.5rem minmax(0, 1fr)' : '7rem minmax(0, 1fr) auto auto',
        gap: narrow ? '0.6rem 0.75rem' : '1rem',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex' }}>
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
        {onChase && !project.lostOn && (
          <span data-gc-board-people={project.id} style={{ display: 'block', marginTop: '0.35rem' }}>
            <GcPeoplePill summary={projectPeople(state, project)} projectName={project.name} onWorkList={null} onOpenFollowUp={onChase} />
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
        {totals.holes.length > 0 ? (
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
        {!moneyShown && totals.holes.length === 0 && totals.plugged.length === 0 && (
          <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}>the trades alone</span>
        )}
        <GcPriceLikely state={state} project={project} />
      </span>
      <GcPriceCard card={card} state={state} project={project} onOpen={onOpen} moneyShown={moneyShown} {...(onCompare ? { onCompare } : {})} />
    </div>
  )
}
