/**
 * People → Who's where (to-dos/whos-where, PR 2): the week as crews.
 *
 * The front door. Heads are clustered by who was on a job together this week —
 * Dispatch's linked blocks say who was meant to be, the clock says who was — with
 * days-together under each head, the jobs the crew touched, and the crew's lead read
 * off the schedule (the master or sub on the crew; a faint crown, never a button).
 * Where the plan and the clock disagree the head says so. Nothing is written.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { WW_RING_LEGEND, roleRing, wwInitials, type WwCrew, type WwCrewMember, type WwPerson, type WwWeek } from '../../lib/people/whosWhere'

type Props = {
  week: WwWeek
  loading: boolean
}

const HEAD = 40

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name
}

function Disc({ person, hollow, crown, size = HEAD }: { person: WwPerson; hollow: boolean; crown?: boolean; size?: number }) {
  const ring = roleRing(person.role)
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: size >= 36 ? '0.85rem' : '0.7rem',
          fontWeight: 700,
          color: hollow ? 'var(--text-faint)' : 'var(--text-700)',
          background: hollow ? 'transparent' : 'var(--bg-muted)',
          border: `3px ${hollow ? 'dotted' : 'solid'} ${ring.color}`,
          boxSizing: 'border-box',
        }}
      >
        {wwInitials(person.name)}
      </span>
      {crown && (
        <span aria-hidden title="The master or sub on the crew — read off the schedule, not set" style={{ position: 'absolute', top: -9, right: -7, fontSize: 12, opacity: 0.8 }}>
          👑
        </span>
      )}
    </span>
  )
}

function MemberHead({ member }: { member: WwCrewMember }) {
  const ring = roleRing(member.person.role)
  const hollow = member.daysClocked === 0
  const under = member.daysClocked > 0 ? `${member.daysClocked} day${member.daysClocked === 1 ? '' : 's'}` : `listed ${member.daysListed}`
  const title = [member.person.name, ring.label, `clocked ${member.daysClocked} · listed ${member.daysListed}`, member.note].filter(Boolean).join(' · ')
  return (
    <div title={title} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: HEAD + 22 }}>
      <Disc person={member.person} hollow={hollow} />
      <span style={{ fontSize: '0.7rem', marginTop: 3, whiteSpace: 'nowrap', maxWidth: HEAD + 22, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-700)' }}>{firstName(member.person.name)}</span>
      <span style={{ fontSize: '0.6rem', lineHeight: 1.15, textAlign: 'center', color: member.note ? 'var(--text-amber-700)' : 'var(--text-faint)', fontStyle: hollow ? 'italic' : 'normal', maxWidth: HEAD + 22 }} title={member.note ?? undefined}>
        {member.note ?? under}
      </span>
    </div>
  )
}

function LeadHead({ crew }: { crew: WwCrew }) {
  if (!crew.lead) return null
  const ring = roleRing(crew.lead.role)
  const hollow = crew.leadDaysClocked === 0
  const under = hollow ? `listed ${crew.leadDaysListed}` : `${crew.leadDaysClocked} day${crew.leadDaysClocked === 1 ? '' : 's'}`
  const title = `${crew.lead.name} · ${ring.label} · the lead this week — read off the schedule${hollow ? ' (listed, never clocks)' : ''}`
  return (
    <div title={title} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: HEAD + 22 }}>
      <Disc person={crew.lead} hollow={hollow} crown />
      <span style={{ fontSize: '0.7rem', marginTop: 3, whiteSpace: 'nowrap', maxWidth: HEAD + 22, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-700)', fontWeight: 600 }}>{firstName(crew.lead.name)}</span>
      <span style={{ fontSize: '0.62rem', color: 'var(--text-faint)', fontStyle: hollow ? 'italic' : 'normal', whiteSpace: 'nowrap' }}>{under}</span>
    </div>
  )
}

function crewTitle(crew: WwCrew): string {
  if (crew.lead) return `${firstName(crew.lead.name)}'s crew`
  return crew.members.map((m) => firstName(m.person.name)).join(' + ')
}

const railHeading: CSSProperties = { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }

export default function WhosWhereWeek({ week, loading }: Props) {
  const [notInOpen, setNotInOpen] = useState(false)
  const empty = week.crews.length === 0 && week.alone.length === 0 && week.office.length === 0

  return (
    <div style={{ display: 'grid', gap: '0.7rem', opacity: loading ? 0.6 : 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.7rem', alignItems: 'start' }}>
        {empty && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', gridColumn: '1 / -1', margin: 0 }}>
            No sessions or schedule blocks this week.
          </p>
        )}
        {week.crews.map((crew) => (
          <section
            key={crew.key}
            aria-label={crewTitle(crew)}
            style={{
              background: 'var(--surface)',
              border: `1px ${crew.lead ? 'solid var(--border-strong)' : 'dashed var(--border-strong)'}`,
              borderRadius: 20,
              padding: '0.6rem 0.75rem 0.7rem',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.25, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              {crewTitle(crew)}
              {crew.lead?.role === 'subcontractor' && <span style={{ fontWeight: 400, fontSize: '0.7rem', color: 'var(--text-muted)' }}>sub</span>}
              <span style={{ fontWeight: 400, fontSize: '0.7rem', color: 'var(--text-faint)' }}>
                {crew.days} day{crew.days === 1 ? '' : 's'}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.1rem', marginTop: 8 }}>
              <LeadHead crew={crew} />
              {crew.members.map((m) => (
                <MemberHead key={m.person.id} member={m} />
              ))}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8, borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
              {crew.jobs.map((j) => `${j.target.label} ×${j.days}`).join(' · ')}
              {!crew.lead && <span style={{ color: 'var(--text-red-600)' }}> · no lead listed — no master or sub on the block</span>}
            </div>
          </section>
        ))}
        {(week.office.length > 0 || week.alone.length > 0 || week.notIn.length > 0) && (
          <aside style={{ background: 'var(--bg-subtle)', border: '1px dashed var(--border)', borderRadius: 20, padding: '0.6rem 0.75rem 0.7rem', fontSize: '0.75rem' }}>
            {week.office.length > 0 && (
              <>
                <div style={railHeading}>Office</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.1rem', marginBottom: 8 }}>
                  {week.office.map((o) => (
                    <div key={o.person.id} title={`${o.person.name} · ${o.days} day${o.days === 1 ? '' : 's'} on the office job`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 52 }}>
                      <Disc person={o.person} hollow={false} size={34} />
                      <span style={{ fontSize: '0.66rem', marginTop: 2, whiteSpace: 'nowrap', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis' }}>{firstName(o.person.name)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {week.alone.length > 0 && (
              <>
                <div style={railHeading}>Alone this week</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.1rem', marginBottom: 8 }}>
                  {week.alone.map((a) => (
                    <div key={a.person.id} title={`${a.person.name} · ${a.days} day${a.days === 1 ? '' : 's'} on a job with nobody else`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 52 }}>
                      <Disc person={a.person} hollow={false} size={34} />
                      <span style={{ fontSize: '0.66rem', marginTop: 2, whiteSpace: 'nowrap', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis' }}>{firstName(a.person.name)}</span>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-faint)' }}>
                        {a.days} day{a.days === 1 ? '' : 's'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {week.notIn.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setNotInOpen((o) => !o)}
                  aria-expanded={notInOpen}
                  style={{ ...railHeading, font: 'inherit', fontSize: '0.65rem', fontWeight: 700, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', marginBottom: 0 }}
                >
                  Not in · {week.notIn.length} {notInOpen ? '▾' : '▸'}
                </button>
                {notInOpen && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.8rem', marginTop: 4, opacity: 0.75 }}>
                    {week.notIn.map((p) => (
                      <span key={p.id} title={`${p.name} · ${roleRing(p.role).label}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${roleRing(p.role).color}`, boxSizing: 'border-box' }} />
                        {p.name}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </aside>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem', fontSize: '0.7rem', color: 'var(--text-muted)', alignItems: 'center' }}>
        {WW_RING_LEGEND.map((r) => (
          <span key={r.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <i aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', border: `2.5px solid ${r.color}`, boxSizing: 'border-box' }} />
            {r.label}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <i aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', border: '2.5px dotted var(--text-faint)', boxSizing: 'border-box' }} />
          listed only (masters never clock)
        </span>
        <span>👑 the master or sub on the crew — read, not set</span>
        <span>
          {week.crews.length} crew{week.crews.length === 1 ? '' : 's'} · {week.alone.length} alone · {week.office.length} office · {week.notIn.length} not in
        </span>
      </div>
    </div>
  )
}
