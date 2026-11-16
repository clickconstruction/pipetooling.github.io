// @vitest-environment jsdom
/**
 * The Tagged job notes section (punch list #363): what waits on the reader with an answer box and
 * No reply needed, the oldest on top, three shown, then You asked, where an answer the reader has
 * not seen is marked new and then marked seen with nothing pressed. The rules live in
 * src/lib/jobs/noteTags.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import type { MyTag } from '../../lib/jobs/noteTags'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const io = vi.hoisted(() => ({
  tags: [] as unknown[],
  loadMyTags: vi.fn(),
  postTaggedNote: vi.fn(),
  markTagDone: vi.fn(),
  markAnswersSeen: vi.fn(),
  listeners: new Set<() => void>(),
}))
vi.mock('../../lib/jobs/noteTagsIo', () => ({
  loadMyTags: io.loadMyTags,
  loadMyTagsCount: vi.fn(async () => 0),
  postTaggedNote: io.postTaggedNote,
  markTagDone: io.markTagDone,
  markAnswersSeen: io.markAnswersSeen,
  onNoteTagsChanged: (fn: () => void) => {
    io.listeners.add(fn)
    return () => io.listeners.delete(fn)
  },
  noteTagsChanged: () => io.listeners.forEach((fn) => fn()),
}))
vi.mock('../../hooks/useAuth', async (orig) => ({
  ...(await orig<typeof import('../../hooks/useAuth')>()),
  useOptionalAuth: () => ({ role: 'assistant', user: { id: 'u-dana' } }),
}))

import { TaggedJobNotesSection } from './TaggedJobNotesSection'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

const tag = (over: Partial<MyTag>): MyTag => ({
  tagId: 't',
  kind: 'waiting',
  noteId: 'n',
  jobId: 'job-1',
  jobName: 'Cedar Bluff Lofts',
  jobNumber: 'J1482',
  jobKind: null,
  customerName: 'Ridgeway Builders',
  noteBody: 'Did the check come? @Dana Whitlock',
  noteCreatedAt: '2026-11-15T16:04:00Z',
  taggerUserId: 'u-marcus',
  taggerName: 'Marcus Hale',
  taggedUserId: 'u-dana',
  taggedName: 'Dana Whitlock',
  createdAt: '2026-11-15T16:04:00Z',
  clearedAt: null,
  clearedHow: null,
  answerBody: null,
  askerSeenAt: null,
  ...over,
})

const WAITING = [
  tag({ tagId: 'w-new' }),
  tag({ tagId: 'w-old', jobId: 'job-2', jobName: 'Tanner residence', taggerName: 'Luis Ortega', taggerUserId: 'u-luis', noteBody: '@Dana Whitlock can we split the bill?', createdAt: '2026-11-11T21:40:00Z', noteCreatedAt: '2026-11-11T21:40:00Z' }),
]
const ASKED = [
  tag({ tagId: 'a-open', kind: 'asked', jobName: 'Oak Hollow Clinic', taggerUserId: 'u-dana', taggerName: 'Dana Whitlock', taggedUserId: 'u-luis', taggedName: 'Luis Ortega' }),
  tag({ tagId: 'a-new', kind: 'asked', taggerUserId: 'u-dana', taggerName: 'Dana Whitlock', taggedUserId: 'u-bell', taggedName: 'Chris Bell', clearedAt: '2026-11-15T17:00:00Z', clearedHow: 'answered', answerBody: 'Permit is posted on the door.' }),
]

beforeEach(() => {
  io.loadMyTags.mockReset().mockImplementation(async () => io.tags)
  io.postTaggedNote.mockReset().mockResolvedValue('note-9')
  io.markTagDone.mockReset().mockResolvedValue(true)
  io.markAnswersSeen.mockReset().mockResolvedValue(1)
  io.listeners.clear()
  window.localStorage.clear()
})

describe('TaggedJobNotesSection', () => {
  it('draws nothing on the Pipeline while nothing waits and nothing was asked', async () => {
    io.tags = []
    const { container } = renderWithProviders(<TaggedJobNotesSection variant="pipeline" />)
    await settle()
    expect(container.querySelector('[data-tagged-job-notes]')).toBeNull()
  })

  it('says so in the window when nothing waits', async () => {
    io.tags = []
    renderWithProviders(<TaggedJobNotesSection variant="window" />)
    expect(await screen.findByText(/Nothing waiting on you/)).toBeTruthy()
  })

  it('lists what waits with the oldest on top, and answers one on its job', async () => {
    io.tags = [...WAITING, ...ASKED]
    const { container } = renderWithProviders(<TaggedJobNotesSection variant="pipeline" onOpenJob={vi.fn()} />)
    await vi.waitFor(() => expect(container.querySelectorAll('[data-tagged-note]')).toHaveLength(2))
    const cards = [...container.querySelectorAll('[data-tagged-note]')]
    expect(cards[0]!.textContent).toContain('Tanner residence')
    expect(cards[1]!.textContent).toContain('Cedar Bluff Lofts')
    const box = screen.getByLabelText('Answer Luis on Tanner residence')
    fireEvent.change(box, { target: { value: 'Yes, two bills.', selectionStart: 15 } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await vi.waitFor(() => expect(io.postTaggedNote).toHaveBeenCalledWith('job-2', 'Yes, two bills.', []))
    // The post told the section to read again.
    await vi.waitFor(() => expect(io.loadMyTags.mock.calls.length).toBeGreaterThan(1))
  })

  it('clears a tag with No reply needed, with no note', async () => {
    io.tags = [WAITING[0]!]
    renderWithProviders(<TaggedJobNotesSection variant="pipeline" />)
    fireEvent.click(await screen.findByRole('button', { name: 'No reply needed' }))
    await vi.waitFor(() => expect(io.markTagDone).toHaveBeenCalledWith('w-new'))
    expect(io.postTaggedNote).not.toHaveBeenCalled()
  })

  it('opens the job from its name', async () => {
    io.tags = [WAITING[0]!]
    const onOpenJob = vi.fn()
    renderWithProviders(<TaggedJobNotesSection variant="pipeline" onOpenJob={onOpenJob} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cedar Bluff Lofts' }))
    expect(onOpenJob).toHaveBeenCalledWith('job-1')
  })

  it('marks a new answer under You asked and marks it seen with nothing pressed', async () => {
    io.tags = ASKED
    const { container } = renderWithProviders(<TaggedJobNotesSection variant="pipeline" />)
    await vi.waitFor(() => expect(container.querySelectorAll('[data-asked-note]')).toHaveLength(2))
    const lines = [...container.querySelectorAll('[data-asked-note]')]
    // The answer not yet seen is first, with its words and the new mark.
    expect(lines[0]!.textContent).toContain('Chris Bell')
    expect(lines[0]!.textContent).toContain('answered: Permit is posted on the door.')
    expect(lines[0]!.querySelector('[data-asked-new]')).toBeTruthy()
    expect(lines[1]!.textContent).toContain('no answer yet')
    await vi.waitFor(() => expect(io.markAnswersSeen).toHaveBeenCalledTimes(1))
  })

  it('folds to its one line and keeps the answers unseen while folded', async () => {
    window.localStorage.setItem('pt.taggedJobNotes.folded', '1')
    io.tags = [...WAITING, ...ASKED]
    const { container } = renderWithProviders(<TaggedJobNotesSection variant="pipeline" />)
    await screen.findByRole('button', { name: 'Open ▾' })
    expect(container.querySelector('[data-tagged-note]')).toBeNull()
    expect(io.markAnswersSeen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Open ▾' }))
    await vi.waitFor(() => expect(container.querySelectorAll('[data-tagged-note]')).toHaveLength(2))
    await vi.waitFor(() => expect(io.markAnswersSeen).toHaveBeenCalledTimes(1))
  })

  it('shows three and holds the rest behind Show the rest', async () => {
    io.tags = [1, 2, 3, 4, 5].map((n) => tag({ tagId: `w${n}`, jobName: `Job ${n}`, createdAt: `2026-11-1${n}T10:00:00Z` }))
    const { container } = renderWithProviders(<TaggedJobNotesSection variant="pipeline" />)
    await vi.waitFor(() => expect(container.querySelectorAll('[data-tagged-note]')).toHaveLength(3))
    fireEvent.click(screen.getByRole('button', { name: 'Show the rest (2)' }))
    expect(container.querySelectorAll('[data-tagged-note]')).toHaveLength(5)
  })
})
