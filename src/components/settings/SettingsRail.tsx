import type { ReactNode } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { SETTINGS_ZONE_LABELS, SETTINGS_ZONE_ORDER, type SettingsGroupDef } from '../../lib/settingsGroups'

/**
 * The Settings rail (v2.3539): the page's groups as one vertical list beside the setting —
 * search on top, the last tabs opened as chips, the four zones as short headings, and a plain
 * note when the role hides tabs. On a phone the same list is a select. The items keep
 * `role="tab"` and their labels, so the smoke suite finds them unchanged.
 */

export const SETTINGS_RAIL_MEDIA = '(min-width: 900px)'

export function SettingsRail(props: {
  groups: readonly SettingsGroupDef[]
  activeId: string
  onSelect: (id: string) => void
  /** The search bar, rendered by the page (it owns the jump logic). */
  search: ReactNode
  recent: readonly SettingsGroupDef[]
  hiddenNote: string | null
  /** Sign out · Change password, rendered by the page. */
  footer: ReactNode
}) {
  const wide = useMatchMedia(SETTINGS_RAIL_MEDIA)
  const { groups, activeId } = props
  if (groups.length === 0) return null

  const recent = props.recent.length ? (
    <div className="settingsRailRecent" aria-label="Recent">
      <span className="settingsRailRecentWord">Recent</span>
      {props.recent.map((g) => (
        <button key={g.id} type="button" className="settingsRailChip" onClick={() => props.onSelect(g.id)}>
          {g.label}
        </button>
      ))}
    </div>
  ) : null

  if (!wide) {
    return (
      <nav aria-label="Settings sections" className="settingsRail settingsRail--narrow">
        <div className="settingsRailHead">
          <h1 className="settingsRailTitle">Settings</h1>
        </div>
        {props.search}
        {recent}
        <label className="settingsRailSelectWrap">
          <span className="settingsRailSelectLabel">Section</span>
          <select className="settingsRailSelect" value={activeId} onChange={(e) => props.onSelect(e.target.value)} aria-label="Settings section">
            {SETTINGS_ZONE_ORDER.map((zone) => {
              const zoneGroups = groups.filter((g) => g.zone === zone)
              if (zoneGroups.length === 0) return null
              return (
                <optgroup key={zone} label={SETTINGS_ZONE_LABELS[zone]}>
                  {zoneGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </label>
        {props.hiddenNote ? <p className="settingsRailNote">{props.hiddenNote}</p> : null}
        <div className="settingsRailFooter">{props.footer}</div>
      </nav>
    )
  }

  return (
    <nav aria-label="Settings sections" className="settingsRail">
      <div className="settingsRailHead">
        <h1 className="settingsRailTitle">Settings</h1>
      </div>
      {props.search}
      {recent}
      {SETTINGS_ZONE_ORDER.map((zone) => {
        const zoneGroups = groups.filter((g) => g.zone === zone)
        if (zoneGroups.length === 0) return null
        return (
          <div key={zone} className="settingsRailZone">
            <div className="settingsRailZoneLabel">{SETTINGS_ZONE_LABELS[zone]}</div>
            <div role="tablist" aria-label={SETTINGS_ZONE_LABELS[zone]} aria-orientation="vertical" className="settingsRailList">
              {zoneGroups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="tab"
                  aria-selected={activeId === g.id}
                  className={`settingsRailItem${activeId === g.id ? ' settingsRailItem--on' : ''}`}
                  onClick={() => props.onSelect(g.id)}
                  title={g.pagesHint}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {props.hiddenNote ? <p className="settingsRailNote">{props.hiddenNote}</p> : null}
      <div className="settingsRailFooter">{props.footer}</div>
    </nav>
  )
}
