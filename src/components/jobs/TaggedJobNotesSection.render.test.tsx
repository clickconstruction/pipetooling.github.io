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
  postTaggedTaskNote: vi.fn(),
  markTagDone: vi.fn(),
  markAnswersSeen: vi.fn(),
  notifyNoteTag: vi.fn(),
  listeners: new Set<() => void>(),
}))
vi.mock('../../lib/jobs/noteTagsIo', () => ({
  loadMyTags: io.loadMyTags,
  loadMyTagsCount: vi.fn(async () => 0),
  postTaggedNote: io.postTaggedNote,
  postTaggedTaskNote: io.postTaggedTaskNote,
  markTagDone: io.markTagDone,
  markAnswersSeen: io.markAnswersSeen,
  notifyNoteTag: io.notifyNoteTag,
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
  io.postTaggedTaskNote.mockReset().mockResolvedValue('ev-9')
  io.markTagDone.mockReset().mockResolvedValue(true)
  io.markAnswersSeen.mockReset().mockResolvedValue(1)
  io.notifyNoteTag.mockReset()
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
    // The notice goes out for the note that was posted.
    await vi.waitFor(() => expect(io.notifyNoteTag).toHaveBeenCalledWith({ noteId: 'note-9' }))
    // The post told the section to read again.
    await vi.waitFor(() => expect(io.loadMyTags.mock.calls.length).toBeGreaterThan(1))
  })

  it('offers the person who asked before a letter is typed, and one tap tags them back (punch list #375)', async () => {
    io.tags = [WAITING[0]!]
    const { container } = renderWithProviders(<TaggedJobNotesSection variant="pipeline" />)
    await vi.waitFor(() => expect(container.querySelectorAll('[data-tagged-note]')).toHaveLength(1))
    const offer = container.querySelector('[data-note-tag-offer] [data-note-tag-press]') as HTMLElement
    expect(offer.textContent).toBe('@Marcus Haleasked you')
    fireEvent.pointerDown(offer)
    const box = screen.getByLabelText('Answer Marcus on Cedar Bluff Lofts') as HTMLInputElement
    await vi.waitFor(() => expect(box.value).toBe('@Marcus Hale '))
    // Once tagged, the offer is gone and the name is on the Will tag line.
    expect(container.querySelector('[data-note-tag-offer]')).toBeNull()
    expect(screen.getByLabelText('Take Marcus Hale off')).toBeTruthy()
    fireEvent.change(box, { target: { value: '@Marcus Hale it came Friday', selectionStart: 27 } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await vi.waitFor(() => expect(io.postTaggedNote).toHaveBeenCalledWith('job-1', '@Marcus Hale it came Friday', ['u-marcus']))
  })

  it('stands the answer box, Post and No reply needed a thumb tall on a phone (punch list #363)', async () => {
    io.tags = [WAITING[0]!]
    renderWithProviders(<TaggedJobNotesSection variant="pipeline" />)
    const floor = 'var(--phone-press-min, 0px)'
    const done = (await screen.findAllByRole('button', { name: 'No reply needed' }))[0] as HTMLButtonElement
    expect(done.style.minHeight).toContain(floor)
    const post = screen.getAllByRole('button', { name: 'Post' })[0] as HTMLButtonElement
    expect(post.style.minHeight).toContain(floor)
    const box = screen.getAllByRole('textbox')[0] as HTMLInputElement
    expect(box.style.minHeight).toContain(floor)
  })

  it('clears a tag with No reply needed, with no note', async () => {
    io.tags = [WAITING[0]!]
    renderWithProviders(<TaggedJobNotesSection variant="pipeline" />)
    fireEvent.click(await screen.findByRole('button', { name: 'No reply needed' }))
    await vi.waitFor(() => expect(io.markTagDone).toHaveBeenCalledWith('w-new', 'job'))
    await vi.waitFor(() => expect(io.notifyNoteTag).toHaveBeenCalledWith({ tagId: 'w-new' }))
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

  describe('task notes (punch list #375)', () => {
    const TASK_WAITING = tag({ tagId: 'tw', source: 'task', jobId: '', jobName: '', jobNumber: null, customerName: null, instanceId: 'inst-1', itemId: 'item-1', taskTitle: '{{1:1466 · Cedar Bluff Lofts}} — Sweep the shop bays', taskDate: '2026-11-14', noteBody: 'Which bay first? @Dana Whitlock', createdAt: '2026-11-14T10:00:00Z', noteCreatedAt: '2026-11-14T10:00:00Z' })
    const TASK_ASKED = tag({ tagId: 'ta', kind: 'asked', source: 'task', jobId: '', jobName: '', instanceId: 'inst-2', itemId: 'item-2', taskTitle: 'Lock the yard gate', taggerUserId: 'u-dana', taggerName: 'Dana Whitlock', taggedUserId: 'u-luis', taggedName: 'Luis Ortega', clearedAt: '2026-11-15T17:00:00Z', clearedHow: 'answered', answerBody: 'Yes, at six.' })
    const TASK_LEFT = tag({ tagId: 'tl', kind: 'asked', source: 'task', jobId: '', jobName: '', instanceId: 'inst-3', itemId: 'item-3', taskTitle: 'Sort the fittings wall', taggerUserId: 'u-dana', taggerName: 'Dana Whitlock', taggedUserId: 'u-gwen', taggedName: 'Gwen Park', taggedLeft: true })

    it('keeps the Pipeline to job notes and Today to task notes', async () => {
      io.tags = [WAITING[0]!, TASK_WAITING]
      const pipeline = renderWithProviders(<TaggedJobNotesSection variant="pipeline" />)
      await vi.waitFor(() => expect(pipeline.container.querySelectorAll('[data-tagged-note]')).toHaveLength(1))
      expect(pipeline.container.textContent).toContain('Tagged job notes')
      expect(pipeline.container.textContent).not.toContain('Sweep the shop bays')
      pipeline.unmount()
      const today = renderWithProviders(<TaggedJobNotesSection variant="today" />)
      await vi.waitFor(() => expect(today.container.querySelectorAll('[data-tagged-note]')).toHaveLength(1))
      expect(today.container.querySelector('[data-tagged-job-notes="today"]')?.getAttribute('aria-label')).toBe('Tagged task notes')
      // The title is plain words, with the job it was sent from, and the day row's date beside it.
      expect(today.container.textContent).toContain('1466 · Cedar Bluff Lofts — Sweep the shop bays')
      expect(today.container.textContent).toContain('task · Nov 14')
      expect(today.container.textContent).not.toContain('Did the check come?')
    })

    it('draws nothing on Today while no task note waits and none was asked', async () => {
      io.tags = [WAITING[0]!]
      const { container } = renderWithProviders(<TaggedJobNotesSection variant="today" />)
      await settle()
      expect(container.querySelector('[data-tagged-job-notes]')).toBeNull()
    })

    it('holds job tags too in Task Mode, and both in the window, the oldest first', async () => {
      io.tags = [WAITING[0]!, TASK_WAITING]
      const { container } = renderWithProviders(<TaggedJobNotesSection variant="today" kinds="both" />)
      await vi.waitFor(() => expect(container.querySelectorAll('[data-tagged-note]')).toHaveLength(2))
      const cards = [...container.querySelectorAll('[data-tagged-note]')]
      expect(cards[0]!.textContent).toContain('Sweep the shop bays')
      expect(cards[1]!.textContent).toContain('Cedar Bluff Lofts')
      expect(container.querySelector('[data-tagged-job-notes="today"]')?.getAttribute('aria-label')).toBe('Tagged notes')
    })

    it('answers a task tag on the task\'s own day row, and clears one with No reply needed', async () => {
      io.tags = [TASK_WAITING]
      renderWithProviders(<TaggedJobNotesSection variant="today" />)
      const box = await screen.findByLabelText('Answer Marcus on 1466 · Cedar Bluff Lofts — Sweep the shop bays')
      fireEvent.change(box, { target: { value: 'Bay 2 first.', selectionStart: 12 } })
      fireEvent.keyDown(box, { key: 'Enter' })
      await vi.waitFor(() => expect(io.postTaggedTaskNote).toHaveBeenCalledWith('inst-1', 'Bay 2 first.', []))
      expect(io.postTaggedNote).not.toHaveBeenCalled()
      // The notice for the asker goes out for the task note that was posted.
      await vi.waitFor(() => expect(io.notifyNoteTag).toHaveBeenCalledWith({ taskEventId: 'ev-9' }))
      // The post is over once the box is empty and the press is live again.
      await vi.waitFor(() => expect((screen.getByRole('button', { name: 'No reply needed' }) as HTMLButtonElement).disabled).toBe(false))
      fireEvent.click(screen.getByRole('button', { name: 'No reply needed' }))
      await vi.waitFor(() => expect(io.markTagDone).toHaveBeenCalledWith('tw', 'task'))
      await vi.waitFor(() => expect(io.notifyNoteTag).toHaveBeenCalledWith({ taskTagId: 'tw' }))
    })

    it('opens a task that is on the page from its title, and leaves one that is not as plain words', async () => {
      io.tags = [TASK_WAITING, TASK_ASKED]
      const onOpenTask = vi.fn()
      renderWithProviders(<TaggedJobNotesSection variant="today" onOpenTask={onOpenTask} taskOpens={(id) => id === 'inst-1'} />)
      fireEvent.click(await screen.findByRole('button', { name: '1466 · Cedar Bluff Lofts — Sweep the shop bays' }))
      expect(onOpenTask).toHaveBeenCalledWith('inst-1')
      expect(screen.queryByRole('button', { name: 'Lock the yard gate' })).toBeNull()
      expect(screen.getByText('Lock the yard gate')).toBeTruthy()
    })

    it('marks each kind seen by its own mark, and says has left for someone who is gone', async () => {
      io.tags = [ASKED[1]!, TASK_ASKED, TASK_LEFT]
      const { container } = renderWithProviders(<TaggedJobNotesSection variant="window" />)
      await vi.waitFor(() => expect(container.querySelectorAll('[data-asked-note]')).toHaveLength(3))
      await vi.waitFor(() => expect(io.markAnswersSeen.mock.calls.map((c) => c[0]).sort()).toEqual(['job', 'task']))
      const left = [...container.querySelectorAll('[data-asked-note]')].find((el) => el.textContent?.includes('Gwen Park'))
      expect(left?.textContent).toContain('has left')
      io.markAnswersSeen.mockClear()
      // Today marks task answers alone: the job answer still counts above Jobs until the Pipeline shows it.
      const today = renderWithProviders(<TaggedJobNotesSection variant="today" />)
      await vi.waitFor(() => expect(today.container.querySelectorAll('[data-asked-note]')).toHaveLength(2))
      await vi.waitFor(() => expect(io.markAnswersSeen.mock.calls.map((c) => c[0])).toEqual(['task']))
    })
  })

  it('shows three and holds the rest behind Show the rest', async () => {
    io.tags = [1, 2, 3, 4, 5].map((n) => tag({ tagId: `w${n}`, jobName: `Job ${n}`, createdAt: `2026-11-1${n}T10:00:00Z` }))
    const { container } = renderWithProviders(<TaggedJobNotesSection variant="pipeline" />)
    await vi.waitFor(() => expect(container.querySelectorAll('[data-tagged-note]')).toHaveLength(3))
    fireEvent.click(screen.getByRole('button', { name: 'Show the rest (2)' }))
    expect(container.querySelectorAll('[data-tagged-note]')).toHaveLength(5)
  })
})
