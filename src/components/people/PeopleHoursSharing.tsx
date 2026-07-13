import { useState } from 'react'
import {
  HOURS_TAB_SECTION_CHEVRON,
  HOURS_TAB_SECTION_SHELL,
  HOURS_TAB_SECTION_TOGGLE_BTN,
  hoursTabSectionHeaderGap,
  textColorForBackground,
} from './peopleHoursTabShared'

export interface PeopleHoursSharingProps {
  isDev: boolean
  canAccessPay: boolean
  open: boolean
  onToggle: () => void
  costMatrixShareCandidates: Array<{ id: string; name: string; email: string | null; role: string }>
  costMatrixSharedUserIds: Set<string>
  costMatrixShareSaving: boolean
  costMatrixShareError: string | null
  toggleCostMatrixShare: (userId: string, isShared: boolean) => void
  costMatrixTags: Record<string, string>
  costMatrixTagColors: Record<string, string>
  saveTagColor: (tag: string, color: string) => void
}

export function PeopleHoursSharing({
  isDev,
  canAccessPay,
  open,
  onToggle,
  costMatrixShareCandidates,
  costMatrixSharedUserIds,
  costMatrixShareSaving,
  costMatrixShareError,
  toggleCostMatrixShare,
  costMatrixTags,
  costMatrixTagColors,
  saveTagColor,
}: PeopleHoursSharingProps) {
  const [costMatrixShareSectionOpen, setCostMatrixShareSectionOpen] = useState(false)
  const [costMatrixTagColorsSectionOpen, setCostMatrixTagColorsSectionOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#e5e7eb')

  return (
    <section id="people-hours-sharing" style={HOURS_TAB_SECTION_SHELL}>
      <div style={hoursTabSectionHeaderGap(open)}>
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          style={HOURS_TAB_SECTION_TOGGLE_BTN}
        >
          <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{open ? '▼' : '▶'}</span>
          Sharing & tag colors
        </button>
      </div>
      {open ? (
        <>
          {isDev && (
            <div style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => setCostMatrixShareSectionOpen((prev) => !prev)}
                style={{
                  ...HOURS_TAB_SECTION_TOGGLE_BTN,
                  marginBottom: costMatrixShareSectionOpen ? '0.75rem' : 0,
                }}
              >
                <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{costMatrixShareSectionOpen ? '▼' : '▶'}</span>
                Share Cost Matrix and Teams
              </button>
              {costMatrixShareSectionOpen && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    Select Masters or assistants to grant view-only access to Cost matrix and Teams.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                    {costMatrixShareCandidates.map((u) => (
                      <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={costMatrixSharedUserIds.has(u.id)}
                          onChange={(e) => toggleCostMatrixShare(u.id, e.target.checked)}
                          disabled={costMatrixShareSaving}
                        />
                        {u.name || u.email || 'Unknown'} ({u.role === 'master_technician' ? 'Master' : 'Assistant'})
                      </label>
                    ))}
                  </div>
                  {costMatrixShareError && <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginTop: '0.5rem' }}>{costMatrixShareError}</p>}
                </div>
              )}
            </div>
          )}
          {canAccessPay && (
            <div>
              <button
                type="button"
                onClick={() => setCostMatrixTagColorsSectionOpen((prev) => !prev)}
                style={{
                  ...HOURS_TAB_SECTION_TOGGLE_BTN,
                  marginBottom: costMatrixTagColorsSectionOpen ? '0.75rem' : 0,
                }}
              >
                <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{costMatrixTagColorsSectionOpen ? '▼' : '▶'}</span>
                Tag colors
              </button>
              {costMatrixTagColorsSectionOpen && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    Click a tag to change its color.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                    {(() => {
                      const tagsInUse = new Set<string>()
                      for (const tags of Object.values(costMatrixTags)) {
                        for (const t of (tags ?? '').split(',').map((x) => x.trim()).filter(Boolean)) {
                          tagsInUse.add(t)
                        }
                      }
                      const tagsWithColors = new Set(Object.keys(costMatrixTagColors))
                      const allTags = [...new Set([...tagsInUse, ...tagsWithColors])].sort()
                      return (
                        <>
                          {allTags.map((tag) => {
                            const bg = costMatrixTagColors[tag] ?? '#e5e7eb'
                            return (
                              <label
                                key={tag}
                                style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}
                                title="Click to change color"
                              >
                                <input
                                  type="color"
                                  value={bg}
                                  onChange={(e) => saveTagColor(tag, e.target.value)}
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    opacity: 0,
                                    cursor: 'pointer',
                                    width: '100%',
                                    height: '100%',
                                  }}
                                />
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '0.1rem 0.35rem',
                                    background: bg,
                                    borderRadius: 4,
                                    fontSize: '0.7rem',
                                    color: textColorForBackground(bg),
                                  }}
                                >
                                  {tag}
                                </span>
                              </label>
                            )
                          })}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.25rem' }}>
                            <input
                              type="text"
                              placeholder="Add tag"
                              value={newTagName}
                              onChange={(e) => setNewTagName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const t = newTagName.trim()
                                  if (t) {
                                    saveTagColor(t, newTagColor)
                                    setNewTagName('')
                                    setNewTagColor('#e5e7eb')
                                  }
                                }
                              }}
                              style={{ width: 80, padding: '0.1rem 0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.7rem' }}
                            />
                            <label style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }} title="Color for new tag">
                              <input
                                type="color"
                                value={newTagColor}
                                onChange={(e) => setNewTagColor(e.target.value)}
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  opacity: 0,
                                  cursor: 'pointer',
                                  width: '100%',
                                  height: '100%',
                                }}
                              />
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.1rem 0.35rem',
                                  background: newTagColor,
                                  borderRadius: 4,
                                  fontSize: '0.7rem',
                                  color: textColorForBackground(newTagColor),
                                }}
                              >
                                +
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const t = newTagName.trim()
                                if (t) {
                                  saveTagColor(t, newTagColor)
                                  setNewTagName('')
                                  setNewTagColor('#e5e7eb')
                                }
                              }}
                              style={{ padding: '0.1rem 0.35rem', fontSize: '0.7rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
                            >
                              Add
                            </button>
                          </span>
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}
