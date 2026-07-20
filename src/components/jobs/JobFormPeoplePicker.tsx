import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'

type PickerUser = { id: string; name: string }

type JobFormPeoplePickerProps = {
  users: PickerUser[]
  teamMemberIds: string[]
  setTeamMemberIds: Dispatch<SetStateAction<string[]>>
  contractorsSearch: string
  setContractorsSearch: (v: string) => void
  contractorsDropdownOpen: boolean
  setContractorsDropdownOpen: (v: boolean) => void
}

/**
 * The "Add People..." assignment picker in the Edit/New Job modal: a search
 * input with a filtered dropdown (Enter adds the first match, mousedown adds a
 * clicked one, blur/Escape/click-outside close) plus the removable chips for
 * the currently assigned team. Extracted verbatim from JobFormModal — owns its ref
 * and click-outside listener; the roster, the teamMemberIds state (a
 * save-engine input), and the search/dropdown state (reset by the shell's
 * applyEditJob/reset paths) come in as props.
 */
export function JobFormPeoplePicker({
  users,
  teamMemberIds,
  setTeamMemberIds,
  contractorsSearch,
  setContractorsSearch,
  contractorsDropdownOpen,
  setContractorsDropdownOpen,
}: JobFormPeoplePickerProps) {
  const contractorsDropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!contractorsDropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (contractorsDropdownRef.current && !contractorsDropdownRef.current.contains(e.target as Node)) {
        setContractorsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [contractorsDropdownOpen, setContractorsDropdownOpen])

  return (
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
                marginBottom: teamMemberIds.length > 0 ? '0.5rem' : 0,
              }}
            >
              <div ref={contractorsDropdownRef} style={{ position: 'relative', flex: '1 1 12rem', minWidth: 0 }}>
                <input
                  type="text"
                  value={contractorsSearch}
                  onChange={(e) => setContractorsSearch(e.target.value)}
                  onFocus={() => setContractorsDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setContractorsDropdownOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setContractorsDropdownOpen(false)
                    if (e.key === 'Enter') {
                      const filtered = users.filter((u) => !teamMemberIds.includes(u.id) && u.name.toLowerCase().includes(contractorsSearch.toLowerCase().trim()))
                      const first = filtered[0]
                      if (first) {
                        e.preventDefault()
                        setTeamMemberIds((prev) => [...prev, first.id])
                        setContractorsSearch('')
                      }
                    }
                  }}
                  placeholder="Add People..."
                  style={{ width: '100%', padding: '0.375rem 0.625rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem' }}
                />
                {contractorsDropdownOpen && (() => {
                  const filtered = users.filter((u) => !teamMemberIds.includes(u.id) && u.name.toLowerCase().includes(contractorsSearch.toLowerCase().trim()))
                  if (filtered.length === 0 && !contractorsSearch.trim()) return null
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        marginTop: 2,
                        maxHeight: 200,
                        overflowY: 'auto',
                        zIndex: 9999,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      }}
                    >
                      {filtered.length > 0 ? (
                        filtered.map((u, idx) => (
                          <button
                            key={u.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              setTeamMemberIds((prev) => [...prev, u.id])
                              setContractorsSearch('')
                            }}
                            style={{
                              width: '100%',
                              padding: '0.5rem 0.75rem',
                              textAlign: 'left',
                              background: 'var(--surface)',
                              border: 'none',
                              borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                              cursor: 'pointer',
                              color: 'var(--text-strong)',
                              fontSize: '0.875rem',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
                          >
                            {u.name}
                          </button>
                        ))
                      ) : (
                        <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                          No matches
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
            {teamMemberIds.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
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
            )}
          </div>
  )
}
