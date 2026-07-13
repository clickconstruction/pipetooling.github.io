import type { CSSProperties } from 'react'
import { insertLabel, setPersonLabels, setUserLabels, slugifyLabelName } from '../../lib/labels'
import type { Person } from '../../hooks/usePeopleRoster'
import type { UsersTabTagAnchor, UsersTabTagsApi } from '../../hooks/useUsersTabTags'

interface PeopleUserTagsPanelProps {
  anchor: UsersTabTagAnchor
  people: Person[]
  tags: UsersTabTagsApi
  showToast: (message: string, type: 'success' | 'error') => void
}

/** Dev-only per-row tag panel rendered inside each users-tab roster list item. */
export function PeopleUserTagsPanel({ anchor, people, tags, showToast }: PeopleUserTagsPanelProps) {
  const {
    showUsersTabTags,
    showUsersTabTagOrgSignals,
    usersTabTagsLoading,
    usersTabMasterByUserId,
    usersTabTagSignalsByUserId,
    usersTabTagOrgSavedMasterId,
    tagOrgMasterSelectOptions,
    usersTabTagOrgSavingUserId,
    usersTabLabels,
    usersTabLabelsByPersonId,
    usersTabLabelsByUserId,
    usersTabLabelById,
    usersTabSavingTagKey,
    usersTabTagDraftByKey,
    setUsersTabLabels,
    setUsersTabLabelsByPersonId,
    setUsersTabLabelsByUserId,
    setUsersTabSavingTagKey,
    setUsersTabTagDraftByKey,
    tagOrgMasterLabel,
    applyUserTagOrgChange,
  } = tags

  if (!showUsersTabTags) return null
  if (usersTabTagsLoading) {
    return <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Loading tags…</div>
  }

  const usersTabTagsPanelStyle: CSSProperties = {
    width: '100%',
    marginTop: '0.25rem',
    padding: '0.35rem 0 0',
    borderTop: '1px solid var(--border)',
    boxSizing: 'border-box',
  }

  const masterUserId =
    anchor.kind === 'person'
      ? people.find((p) => p.id === anchor.personId)?.master_user_id
      : usersTabMasterByUserId[anchor.userId] ?? null

  const tagUserId = anchor.kind === 'user' ? anchor.userId : null
  const signals = tagUserId ? usersTabTagSignalsByUserId[tagUserId] : undefined
  const savedTagOrg = tagUserId ? usersTabTagOrgSavedMasterId[tagUserId] : null
  const signalMasterUnion: string[] =
    tagUserId && signals
      ? [
          ...signals.assistantMasters,
          ...signals.superintendentMasters,
          ...signals.primaryMasters,
          ...signals.jobMasters.map((j) => j.masterId),
          ...(signals.peopleEmailMaster ? [signals.peopleEmailMaster] : []),
        ].filter((id, i, a) => a.indexOf(id) === i)
      : []
  const tagOrgConflict =
    !!savedTagOrg && signalMasterUnion.length > 0 && !signalMasterUnion.includes(savedTagOrg)

  const tagOrgControls =
    tagUserId != null ? (
      <div style={{ width: '100%', marginBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--text-700)' }}>
        <div
          style={{
            fontSize: '0.65rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            letterSpacing: '0.02em',
            marginBottom: '0.25rem',
            textAlign: 'left',
          }}
        >
          Tag org (saved)
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
            justifyContent: 'flex-start',
            marginBottom: '0.35rem',
          }}
        >
          <select
            value={savedTagOrg ?? ''}
            disabled={usersTabTagOrgSavingUserId === tagUserId}
            onChange={(ev) => void applyUserTagOrgChange(tagUserId, ev.target.value)}
            style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem', borderRadius: 4, border: '1px solid var(--border-strong)', minWidth: 200 }}
          >
            <option value="">Heuristic (no override)</option>
            {tagOrgMasterSelectOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name?.trim() || m.email?.trim() || m.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={usersTabTagOrgSavingUserId === tagUserId || savedTagOrg == null}
            onClick={() => void applyUserTagOrgChange(tagUserId, '')}
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem' }}
          >
            Clear override
          </button>
        </div>
        {signals && (
          <div
            style={{
              width: '100%',
              textAlign: 'left',
              color: 'var(--text-muted)',
              lineHeight: 1.45,
              marginBottom: tagOrgConflict ? '0.25rem' : 0,
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-faint)' }}>Signals </span>
            {signals.assistantMasters.length > 0 && (
              <span>Assistant: {signals.assistantMasters.map(tagOrgMasterLabel).join(', ')}. </span>
            )}
            {signals.superintendentMasters.length > 0 && (
              <span>Superintendent: {signals.superintendentMasters.map(tagOrgMasterLabel).join(', ')}. </span>
            )}
            {signals.primaryMasters.length > 0 && (
              <span>Primary: {signals.primaryMasters.map(tagOrgMasterLabel).join(', ')}. </span>
            )}
            {signals.jobMasters.length > 0 && (
              <span>
                Jobs:{' '}
                {signals.jobMasters.map((j) => `${tagOrgMasterLabel(j.masterId)} (${j.jobCount})`).join(', ')}.{' '}
              </span>
            )}
            {signals.peopleEmailMaster != null && (
              <span>People email: {tagOrgMasterLabel(signals.peopleEmailMaster)}.</span>
            )}
            {signalMasterUnion.length === 0 && (
              <span>No adoption or job team links detected for this user.</span>
            )}
          </div>
        )}
        {tagOrgConflict && (
          <div
            style={{
              width: '100%',
              textAlign: 'left',
              fontSize: '0.75rem',
              color: 'var(--text-amber-700)',
              marginTop: '0.2rem',
            }}
          >
            Saved org does not match any detected signal — review adoption or roster email.
          </div>
        )}
      </div>
    ) : null

  if (!masterUserId) {
    return (
      <div style={usersTabTagsPanelStyle}>
        {showUsersTabTagOrgSignals ? tagOrgControls : null}
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-faint)', textAlign: 'left' }}>
          {anchor.kind === 'person'
            ? 'No roster row'
            : showUsersTabTagOrgSignals
              ? 'Cannot determine org for tags — set Tag org above or fix roster/adoption.'
              : 'Cannot determine org for tags — turn on “Tag org, signals & new tag” below to set override, or fix roster/adoption.'}
        </div>
      </div>
    )
  }
  const catalog = usersTabLabels
    .filter((l) => l.master_user_id === masterUserId)
    .sort((a, b) => a.name.localeCompare(b.name))
  const selectedIds =
    anchor.kind === 'person'
      ? usersTabLabelsByPersonId[anchor.personId] ?? []
      : usersTabLabelsByUserId[anchor.userId] ?? []
  const catalogUnselected = catalog.filter((l) => !selectedIds.includes(l.id))
  const draftKey = anchor.kind === 'person' ? `p:${anchor.personId}` : `u:${anchor.userId}`
  const busy = usersTabSavingTagKey === draftKey
  const draft = usersTabTagDraftByKey[draftKey] ?? ''

  const applyIds = async (next: string[]) => {
    setUsersTabSavingTagKey(draftKey)
    try {
      if (anchor.kind === 'person') {
        await setPersonLabels(anchor.personId, next)
        setUsersTabLabelsByPersonId((prev) => ({ ...prev, [anchor.personId]: next }))
      } else {
        await setUserLabels(anchor.userId, next)
        setUsersTabLabelsByUserId((prev) => ({ ...prev, [anchor.userId]: next }))
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update tags', 'error')
    } finally {
      setUsersTabSavingTagKey(null)
    }
  }

  const toggleLabel = (labelId: string, checked: boolean) => {
    const next = checked ? [...selectedIds, labelId] : selectedIds.filter((id) => id !== labelId)
    void applyIds(next)
  }

  const addNewTag = async () => {
    const name = draft.trim()
    if (!name) return
    const slug = slugifyLabelName(name)
    try {
      const row = await insertLabel({ master_user_id: masterUserId, name, slug })
      setUsersTabLabels((prev) => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)))
      await applyIds([...selectedIds, row.id])
      setUsersTabTagDraftByKey((prev) => ({ ...prev, [draftKey]: '' }))
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e)
      const dup =
        /duplicate|unique/i.test(raw) ||
        raw.toLowerCase().includes('labels_slug') ||
        raw.toLowerCase().includes('labels_master')
      showToast(dup ? 'A tag with that name or slug already exists for this master.' : raw, 'error')
    }
  }

  return (
    <div style={usersTabTagsPanelStyle}>
      {showUsersTabTagOrgSignals ? tagOrgControls : null}
      <div
        style={{
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: 'var(--text-muted)',
          marginBottom: '0.2rem',
          textAlign: 'left',
        }}
      >
        Tags
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.35rem',
          alignItems: 'center',
          justifyContent: 'flex-start',
          marginBottom: '0.35rem',
        }}
      >
        {selectedIds.map((id) => {
          const label = usersTabLabelById.get(id)
          if (!label) return null
          return (
            <span
              key={id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                padding: '0.06rem 0.4rem',
                background: '#e0e7ff',
                color: '#3730a3',
                borderRadius: 999,
                fontSize: '0.75rem',
              }}
            >
              {label.name}
              <button
                type="button"
                aria-label={`Remove ${label.name}`}
                onClick={() => void applyIds(selectedIds.filter((x) => x !== id))}
                disabled={busy}
                style={{
                  padding: 0,
                  margin: 0,
                  border: 'none',
                  background: 'none',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem',
                  lineHeight: 1,
                  color: '#4f46e5',
                }}
              >
                ×
              </button>
            </span>
          )
        })}
      </div>
      {catalog.length > 0 && catalogUnselected.length === 0 ? (
        <p
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-faint)',
            margin: '0 0 0.35rem 0',
          }}
        >
          All catalog tags applied.
        </p>
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
            justifyContent: 'flex-start',
            marginBottom: '0.35rem',
          }}
        >
          {catalogUnselected.map((l) => (
            <label
              key={l.id}
              style={{
                fontSize: '0.8125rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={false}
                disabled={busy}
                onChange={(ev) => toggleLabel(l.id, ev.target.checked)}
              />
              {l.name}
            </label>
          ))}
        </div>
      )}
      {showUsersTabTagOrgSignals ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', justifyContent: 'flex-start' }}>
          <input
            type="text"
            value={draft}
            onChange={(ev) => setUsersTabTagDraftByKey((prev) => ({ ...prev, [draftKey]: ev.target.value }))}
            placeholder="New tag name"
            disabled={busy}
            style={{ fontSize: '0.8125rem', padding: '0.2rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: 120 }}
          />
          <button
            type="button"
            onClick={() => void addNewTag()}
            disabled={busy || !draft.trim()}
            style={{ fontSize: '0.8125rem', padding: '0.2rem 0.5rem' }}
          >
            Add tag
          </button>
        </div>
      ) : null}
    </div>
  )
}
