// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import LienDeskOwnerPane from './LienDeskOwnerPane'

const noOwner = { ownerMode: '', ownerName: '', ownerCompany: '', mailingAddress: '', source: 'none' as const }

describe('LienDeskOwnerPane — Find the owner ›', () => {
  it('opens Edit Job on the Property record row, as its hover promises (#87 E)', async () => {
    const onOpenEditJob = vi.fn()
    await renderSettled(
      <LienDeskOwnerPane job={undefined} jobId="job-1" gcName="Loberg Contracting" gcCustomerId={null} address={null} owner={noOwner} ownerName="" userId={null} onChanged={() => {}} onOpenEditJob={onOpenEditJob} />,
      { loaded: () => screen.findByText('No job address to look up.') },
    )
    const door = screen.getByRole('button', { name: 'Find the owner ›' })
    expect(door.getAttribute('title')).toContain('Edit Job → Property record')
    fireEvent.click(door)
    expect(onOpenEditJob).toHaveBeenCalledWith('job-1', 'property-record')
  })
})
