import { useState, type Dispatch, type SetStateAction } from 'react'
import { SearchableMultiSelect } from '../SearchableMultiSelect'

type PickerUser = { id: string; name: string }

type JobFormPeoplePickerProps = {
  users: PickerUser[]
  teamMemberIds: string[]
  setTeamMemberIds: Dispatch<SetStateAction<string[]>>
}

/** Above the Edit-Job overlay (JOB_FORM_OVERLAY_Z_INDEX 1010) so the picker stacks correctly. */
const PEOPLE_PICKER_OVERLAY_Z_INDEX = 1011

/**
 * The people assignment row in the Edit/New Job modal: a "+" chip at the start
 * of the assigned-people chip list (same card format) that opens a picker modal
 * — the full roster with a search field (SearchableMultiSelect, selections
 * pinned to top). Selections mutate the form's teamMemberIds only; nothing is
 * written until the job is saved. Each chip's × removes that person.
 */
export function JobFormPeoplePicker({ users, teamMemberIds, setTeamMemberIds }: JobFormPeoplePickerProps) {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' }}>
        {/* Same header style as the form's field labels (e.g. "Last manual bill date"). */}
        <span style={{ fontWeight: 500, fontSize: '0.875rem', marginRight: '0.15rem' }}>Team:</span>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          title="Add people to this job"
          aria-label="Add people to this job"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.25rem 0.5rem',
            background: 'var(--bg-blue-tint)',
            border: 'none',
            borderRadius: 6,
            fontSize: '0.875rem',
            fontWeight: 700,
            color: 'var(--text-blue-700)',
            cursor: 'pointer',
            lineHeight: '1.35',
          }}
        >
          +
        </button>
        {teamMemberIds.map((id) => {
          const u = users.find((x) => x.id === id)
          return (
            <span
              key={id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.25rem 0.5rem',
                background: 'var(--bg-blue-tint)',
                borderRadius: 6,
                fontSize: '0.875rem',
              }}
            >
              {u?.name ?? id}
              <button
                type="button"
                onClick={() => setTeamMemberIds((prev) => prev.filter((x) => x !== id))}
                title="Remove"
                style={{
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.875rem',
                }}
              >
                ×
              </button>
            </span>
          )
        })}
      </div>
      {addOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: PEOPLE_PICKER_OVERLAY_Z_INDEX,
            padding: '1rem',
          }}
          onClick={() => setAddOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add people to this job"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 10,
              padding: '1.25rem',
              width: 'min(460px, 100%)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Add people</h2>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                aria-label="Close"
                style={{ border: 'none', background: 'none', fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Selections apply to the form now and save with the job.
            </p>
            <SearchableMultiSelect
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              value={teamMemberIds}
              onChange={(next) => setTeamMemberIds(next)}
              listAriaLabel="People to add"
              searchPlaceholder="Search people…"
              pinSelectedToTop
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem', fontWeight: 600, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
