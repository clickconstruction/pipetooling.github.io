/**
 * Settings → System → Dev doors → **Only devs and the controller see these** (v2.5882, punch list #188): one list
 * of every door only a dev, only a dev and the controller, or only the owner or a dev may open today, each a link
 * that lands on it, with who may open it beside it and one line of what it is. The list is the kernel
 * `lib/settings/devDoors.ts`, whose test holds every link to a route `App.tsx` serves and every row to a gate that
 * still exists. Read-only: the card opens doors and changes no gate. The audit behind it is `to-dos/dev-gates/`.
 */
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { DEV_DOORS, DEV_DOOR_WHO_LABEL, devDoorCounts, devDoorsByArea, devDoorsHeadLine } from '../../lib/settings/devDoors'

const CARD: CSSProperties = { marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', background: 'var(--surface)' }
const TITLE: CSSProperties = { margin: '0 0 0.35rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)' }
const MUTED: CSSProperties = { margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }
const AREA: CSSProperties = { margin: '1rem 0 0.35rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-700)', textTransform: 'uppercase', letterSpacing: '0.02em' }
const LIST: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }
const ROW: CSSProperties = { display: 'grid', gap: '0.15rem', padding: '0.45rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6 }
const ROW_HEAD: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }
const LINK: CSSProperties = { fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none' }
const CHIP: CSSProperties = { fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 999, color: 'var(--text-700)', background: 'var(--bg-subtle)', whiteSpace: 'nowrap' }
const WHAT: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)' }

export default function DevDoorsCard() {
  const groups = devDoorsByArea(DEV_DOORS)
  const counts = devDoorCounts(DEV_DOORS)
  return (
    <section style={CARD} aria-labelledby="settings-dev-doors-title" data-testid="dev-doors-card">
      <h3 id="settings-dev-doors-title" style={TITLE}>Only devs and the controller see these</h3>
      <p style={MUTED}>{devDoorsHeadLine(counts)}</p>
      <p style={MUTED}>Each row is a link that opens the door. The chip says who may open it today. This card changes no gate.</p>
      {groups.map((g) => (
        <div key={g.area} data-dev-doors-area={g.area}>
          <h4 style={AREA}>{g.area}</h4>
          <ul style={LIST}>
            {g.doors.map((d) => (
              <li key={d.id} style={ROW} data-dev-door={d.id}>
                <div style={ROW_HEAD}>
                  <Link to={d.to} style={LINK}>
                    {d.label}
                  </Link>
                  <span style={CHIP} title={`Gate: ${d.gate.file} — ${d.gate.text}`}>
                    {DEV_DOOR_WHO_LABEL[d.who]}
                  </span>
                </div>
                <div style={WHAT}>{d.what}</div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
