import { describe, expect, it } from 'vitest'
import { replyBoxFolded, type ReplyFoldFacts } from './replyFold'

const quiet: ReplyFoldFacts = { foldBox: true, inJob: false, woke: false, blank: true, files: 0, opensWithWords: false, textWaits: false, blocked: false }

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
