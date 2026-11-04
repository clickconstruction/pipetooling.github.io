import { describe, expect, it } from 'vitest'
import { replyBoxFolded, type ReplyFoldFacts } from './replyFold'

const quiet: ReplyFoldFacts = { foldBox: true, foldedByPress: false, inJob: false, woke: false, blank: true, files: 0, opensWithWords: false, textWaits: false, blocked: false }

describe('the reply box folds to one row on a short window (v2.6477)', () => {
  it('folds while the window is short and nothing waits in the box', () => {
    expect(replyBoxFolded(quiet)).toBe(true)
  })

  it('stays whole on a tall window and in a job’s card', () => {
    expect(replyBoxFolded({ ...quiet, foldBox: false })).toBe(false)
    expect(replyBoxFolded({ ...quiet, inJob: true })).toBe(false)
  })

  it('opens once pressed, and stays open while words or files wait to go', () => {
    expect(replyBoxFolded({ ...quiet, woke: true })).toBe(false)
    expect(replyBoxFolded({ ...quiet, blank: false })).toBe(false)
    expect(replyBoxFolded({ ...quiet, files: 1 })).toBe(false)
    expect(replyBoxFolded({ ...quiet, opensWithWords: true })).toBe(false)
  })

  it('leaves the texts-off wait line as it is', () => {
    expect(replyBoxFolded({ ...quiet, textWaits: true })).toBe(false)
  })

  it('stays whole for a number that sent STOP, so the reason shows under the disabled field (v2.6487)', () => {
    expect(replyBoxFolded({ ...quiet, blocked: true })).toBe(false)
  })
})

describe('a press outside the box folds it on any window (v2.6504)', () => {
  const tall: ReplyFoldFacts = { ...quiet, foldBox: false }

  it('a tall window and a press outside: folded', () => {
    expect(replyBoxFolded({ ...tall, foldedByPress: true })).toBe(true)
  })

  it('keeps the words typed: the box folds with them, so nothing is lost', () => {
    expect(replyBoxFolded({ ...tall, foldedByPress: true, blank: false })).toBe(true)
    expect(replyBoxFolded({ ...quiet, foldedByPress: true, blank: false })).toBe(true)
  })

  it('a press into the box or on a kind wakes it whole again', () => {
    expect(replyBoxFolded({ ...tall, foldedByPress: true, woke: true })).toBe(false)
  })

  it('a send puts the box back to how the window opened it: whole on a tall window, folded on a short one', () => {
    expect(replyBoxFolded({ ...tall, foldedByPress: false, woke: false })).toBe(false)
    expect(replyBoxFolded({ ...quiet, foldedByPress: false, woke: false })).toBe(true)
  })

  it('files waiting, a Send texts hold, words the box opened with, a job’s box and a STOP block keep it whole', () => {
    expect(replyBoxFolded({ ...tall, foldedByPress: true, files: 1 })).toBe(false)
    expect(replyBoxFolded({ ...tall, foldedByPress: true, textWaits: true })).toBe(false)
    expect(replyBoxFolded({ ...tall, foldedByPress: true, opensWithWords: true })).toBe(false)
    expect(replyBoxFolded({ ...tall, foldedByPress: true, inJob: true })).toBe(false)
    expect(replyBoxFolded({ ...tall, foldedByPress: true, blocked: true })).toBe(false)
  })
})
