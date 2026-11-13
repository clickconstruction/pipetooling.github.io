// @vitest-environment jsdom
/**
 * Settings → People & teams (punch list #188, PR 2, rows 8–13, 22, 86, 87): the tab is the office's, and each block
 * draws for its row's audience — the owner's switches and groups, the office's Additional People, a dev's pay approvals
 * and role map. Card and footer looks (punch list #313) is the owner's and a dev's since v2.7139.
 */
import { describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import type { UserRole } from '../../hooks/useAuth'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev', loading: false }) }))

import SettingsPeopleTab from './SettingsPeopleTab'

const noop = () => {}

function draw(myRole: UserRole) {
  return renderWithProviders(
    <SettingsPeopleTab
      additionalPeopleSectionOpen={false}
      allPeopleCount={0}
      deleteNonUserPerson={noop}
      deletingPersonId={null}
      dispatchGroupError={null}
      dispatchGroupSavingUserId={null}
      dispatchMemberIds={new Set()}
      editPersonEmail=""
      editPersonError={null}
      editPersonName=""
      editPersonNotes=""
      editPersonPhone=""
      editPersonSaving={false}
      editingNonUserPerson={null}
      error={null}
      estimatorGroupError={null}
      estimatorGroupSavingUserId={null}
      estimatorInboxSectionOpen={false}
      estimatorMemberIds={new Set()}
      myPeople={[]}
      nonUserPeople={[]}
      openFindDuplicatesModal={noop}
      mergeDuplicatesModalOpen={false}
      setMergeDuplicatesModalOpen={noop}
      mergeDuplicatesLoading={false}
      mergeDuplicates={[]}
      mergingPersonName={null}
      myRole={myRole}
      handleMergeDuplicate={noop}
      payApprovedError={null}
      payApprovedMasterIds={new Set()}
      payApprovedMasters={[]}
      payApprovedMastersSectionOpen={false}
      payApprovedSaving={false}
      roleVisibilityExpanded={false}
      saveNonUserPersonEdit={noop}
      setAdditionalPeopleSectionOpen={noop}
      setEditPersonEmail={noop}
      setEditPersonError={noop}
      setEditPersonName={noop}
      setEditPersonNotes={noop}
      setEditPersonPhone={noop}
      setEditingNonUserPerson={noop}
      setEstimatorInboxSectionOpen={noop}
      setPayApprovedMastersSectionOpen={noop}
      setRoleVisibilityExpanded={noop}
      setTaskDispatchSectionOpen={noop}
      taskDispatchSectionOpen={false}
      toggleDispatchGroupMember={noop}
      toggleEstimatorGroupMember={noop}
      togglePayApproved={noop}
      users={[]}
    />,
  )
}

const OWNER_LINES = ['Find duplicates…', 'Task Dispatch group', 'Estimator Inbox group']
const DEV_LINES = ['Role visibility (what each role can see)', 'Pay Approved Leaders']
/** Card and footer looks: the owner's card and a dev's, first on the tab. */
const LOOKS_CARD = '#settings-card-looks[data-card-looks]'

describe('SettingsPeopleTab — a gate per row', () => {
  it('a dev sees every block', () => {
    const { container } = draw('dev')
    // first paint
    const text = container.textContent ?? ''
    for (const line of [...OWNER_LINES, ...DEV_LINES, 'Additional People', 'Accounts']) expect(text, line).toContain(line)
    expect(container.querySelector(LOOKS_CARD)?.textContent).toContain('Card and footer looks')
    cleanup()
  })
  it('the owner sees the groups, the pointer and Additional People, not the pay approvals or the role map', () => {
    const { container } = draw('master_technician')
    // first paint
    const text = container.textContent ?? ''
    for (const line of [...OWNER_LINES, 'Additional People', 'Accounts']) expect(text, line).toContain(line)
    for (const line of DEV_LINES) expect(text, line).not.toContain(line)
    expect(container.querySelector(LOOKS_CARD)?.textContent).toContain('Card and footer looks')
    cleanup()
  })
  it('an assistant sees the Accounts pointer and Additional People alone', () => {
    const { container } = draw('assistant')
    // first paint
    const text = container.textContent ?? ''
    expect(text).toContain('Additional People')
    expect(text).toContain('Accounts')
    for (const line of [...OWNER_LINES, ...DEV_LINES]) expect(text, line).not.toContain(line)
    expect(container.querySelector(LOOKS_CARD)).toBeNull()
    cleanup()
  })
})
