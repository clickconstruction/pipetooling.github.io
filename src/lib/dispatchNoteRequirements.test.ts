import { describe, expect, it } from 'vitest'
import {
  DISPATCH_NOTE_REQUIREMENT_CONFIG_VERSION,
  defaultDispatchNoteRequirementsConfig,
  editNoteIconColorForBlock,
  effectiveNoteRequirement,
  noteRequirementForBlock,
  noteRequirementForUserId,
  normalizeDispatchNoteRequirementsConfig,
  surroundingIconColorForRequirement,
} from './dispatchNoteRequirements'

describe('defaultDispatchNoteRequirementsConfig', () => {
  it('returns version 1 with empty lists', () => {
    expect(defaultDispatchNoteRequirementsConfig()).toEqual({
      v: 1,
      require_note_user_ids: [],
      skip_note_user_ids: [],
      skip_note_job_ids: [],
    })
  })
})

describe('normalizeDispatchNoteRequirementsConfig', () => {
  it('returns null for non-object', () => {
    expect(normalizeDispatchNoteRequirementsConfig(null)).toBeNull()
    expect(normalizeDispatchNoteRequirementsConfig(undefined)).toBeNull()
    expect(normalizeDispatchNoteRequirementsConfig('foo')).toBeNull()
    expect(normalizeDispatchNoteRequirementsConfig(42)).toBeNull()
  })

  it('returns null when version mismatches', () => {
    expect(
      normalizeDispatchNoteRequirementsConfig({
        v: 2,
        require_note_user_ids: [],
        skip_note_user_ids: [],
      }),
    ).toBeNull()
  })

  it('returns null when an array contains a non-string entry', () => {
    expect(
      normalizeDispatchNoteRequirementsConfig({
        v: 1,
        require_note_user_ids: ['a', 42],
        skip_note_user_ids: [],
      }),
    ).toBeNull()
  })

  it('treats missing list fields as empty arrays', () => {
    const n = normalizeDispatchNoteRequirementsConfig({
      v: 1,
    })
    expect(n).toEqual({
      v: 1,
      require_note_user_ids: [],
      skip_note_user_ids: [],
      skip_note_job_ids: [],
    })
  })

  it('trims, drops blanks, and dedupes each list', () => {
    const n = normalizeDispatchNoteRequirementsConfig({
      v: DISPATCH_NOTE_REQUIREMENT_CONFIG_VERSION,
      require_note_user_ids: ['  a  ', 'b', 'a', '', '   '],
      skip_note_user_ids: ['c', ' c ', 'd'],
      skip_note_job_ids: [' j1 ', 'j2', 'j1', '', '   '],
    })
    expect(n).toEqual({
      v: 1,
      require_note_user_ids: ['a', 'b'],
      skip_note_user_ids: ['c', 'd'],
      skip_note_job_ids: ['j1', 'j2'],
    })
  })

  it('drops users from skip that also appear in require (require wins)', () => {
    const n = normalizeDispatchNoteRequirementsConfig({
      v: 1,
      require_note_user_ids: ['a', 'b'],
      skip_note_user_ids: ['b', 'c'],
    })
    expect(n).toEqual({
      v: 1,
      require_note_user_ids: ['a', 'b'],
      skip_note_user_ids: ['c'],
      skip_note_job_ids: [],
    })
  })

  it('back-compat: stored v1 config without skip_note_job_ids resolves to empty job list', () => {
    const n = normalizeDispatchNoteRequirementsConfig({
      v: 1,
      require_note_user_ids: ['a'],
      skip_note_user_ids: ['b'],
    })
    expect(n).toEqual({
      v: 1,
      require_note_user_ids: ['a'],
      skip_note_user_ids: ['b'],
      skip_note_job_ids: [],
    })
  })

  it('returns null when skip_note_job_ids has a non-string entry', () => {
    expect(
      normalizeDispatchNoteRequirementsConfig({
        v: 1,
        require_note_user_ids: [],
        skip_note_user_ids: [],
        skip_note_job_ids: ['j1', 99],
      }),
    ).toBeNull()
  })

  it('returns null when skip_note_job_ids is not an array', () => {
    expect(
      normalizeDispatchNoteRequirementsConfig({
        v: 1,
        require_note_user_ids: [],
        skip_note_user_ids: [],
        skip_note_job_ids: 'j1',
      }),
    ).toBeNull()
  })
})

describe('noteRequirementForUserId', () => {
  const cfg = {
    v: 1 as const,
    require_note_user_ids: ['a', 'b'],
    skip_note_user_ids: ['c'],
    skip_note_job_ids: [],
  }

  it('returns "default" for empty / null / undefined userId', () => {
    expect(noteRequirementForUserId(cfg, '')).toBe('default')
    expect(noteRequirementForUserId(cfg, null)).toBe('default')
    expect(noteRequirementForUserId(cfg, undefined)).toBe('default')
  })

  it('returns "required" when the user is in require list', () => {
    expect(noteRequirementForUserId(cfg, 'a')).toBe('required')
    expect(noteRequirementForUserId(cfg, 'b')).toBe('required')
  })

  it('returns "skip" when the user is only in skip list', () => {
    expect(noteRequirementForUserId(cfg, 'c')).toBe('skip')
  })

  it('returns "default" for unknown user', () => {
    expect(noteRequirementForUserId(cfg, 'z')).toBe('default')
  })
})

describe('noteRequirementForBlock', () => {
  const cfg = {
    v: 1 as const,
    require_note_user_ids: ['uReq'],
    skip_note_user_ids: ['uSkip'],
    skip_note_job_ids: ['jSkip'],
  }

  it('returns "default" when both userId and jobId are null', () => {
    expect(noteRequirementForBlock(cfg, { userId: null, jobId: null })).toBe('default')
    expect(noteRequirementForBlock(cfg, { userId: undefined, jobId: undefined })).toBe('default')
    expect(noteRequirementForBlock(cfg, { userId: '', jobId: '' })).toBe('default')
  })

  it('returns "required" when assignee is in require list, regardless of job', () => {
    expect(noteRequirementForBlock(cfg, { userId: 'uReq', jobId: null })).toBe('required')
    expect(noteRequirementForBlock(cfg, { userId: 'uReq', jobId: 'jSkip' })).toBe('required')
    expect(noteRequirementForBlock(cfg, { userId: 'uReq', jobId: 'jOther' })).toBe('required')
  })

  it('returns "skip" when job is in skip list and assignee is not in require list', () => {
    expect(noteRequirementForBlock(cfg, { userId: null, jobId: 'jSkip' })).toBe('skip')
    expect(noteRequirementForBlock(cfg, { userId: 'uOther', jobId: 'jSkip' })).toBe('skip')
    expect(noteRequirementForBlock(cfg, { userId: 'uSkip', jobId: 'jSkip' })).toBe('skip')
  })

  it('returns "skip" when assignee is in skip list and job is not in skip list', () => {
    expect(noteRequirementForBlock(cfg, { userId: 'uSkip', jobId: null })).toBe('skip')
    expect(noteRequirementForBlock(cfg, { userId: 'uSkip', jobId: 'jOther' })).toBe('skip')
  })

  it('returns "default" when neither list matches', () => {
    expect(noteRequirementForBlock(cfg, { userId: 'uOther', jobId: 'jOther' })).toBe('default')
    expect(noteRequirementForBlock(cfg, { userId: 'uOther', jobId: null })).toBe('default')
    expect(noteRequirementForBlock(cfg, { userId: null, jobId: 'jOther' })).toBe('default')
  })

  it('user-require beats job-skip (precedence 1 > 2)', () => {
    expect(noteRequirementForBlock(cfg, { userId: 'uReq', jobId: 'jSkip' })).toBe('required')
  })

  it('job-skip beats user-skip (precedence 2 > 3)', () => {
    expect(noteRequirementForBlock(cfg, { userId: 'uSkip', jobId: 'jSkip' })).toBe('skip')
  })
})

describe('editNoteIconColorForBlock', () => {
  it('skip → grey regardless of note presence', () => {
    expect(editNoteIconColorForBlock({ requirement: 'skip', hasNote: false })).toBe('#9ca3af')
    expect(editNoteIconColorForBlock({ requirement: 'skip', hasNote: true })).toBe('#9ca3af')
  })

  it('required + no note → red', () => {
    expect(editNoteIconColorForBlock({ requirement: 'required', hasNote: false })).toBe('#dc2626')
  })

  it('required + has note → grey', () => {
    expect(editNoteIconColorForBlock({ requirement: 'required', hasNote: true })).toBe('#9ca3af')
  })

  it('default + no note → blue (existing behavior)', () => {
    expect(editNoteIconColorForBlock({ requirement: 'default', hasNote: false })).toBe('#1d4ed8')
  })

  it('default + has note → grey (existing behavior)', () => {
    expect(editNoteIconColorForBlock({ requirement: 'default', hasNote: true })).toBe('#9ca3af')
  })
})

describe('surroundingIconColorForRequirement', () => {
  it('skip → grey regardless of provided default', () => {
    expect(surroundingIconColorForRequirement('skip', '#b91c1c')).toBe('#9ca3af')
    expect(surroundingIconColorForRequirement('skip', '#1d4ed8')).toBe('#9ca3af')
  })

  it('required → passes default through', () => {
    expect(surroundingIconColorForRequirement('required', '#b91c1c')).toBe('#b91c1c')
    expect(surroundingIconColorForRequirement('required', '#1d4ed8')).toBe('#1d4ed8')
  })

  it('default → passes default through', () => {
    expect(surroundingIconColorForRequirement('default', '#b91c1c')).toBe('#b91c1c')
    expect(surroundingIconColorForRequirement('default', '#1d4ed8')).toBe('#1d4ed8')
  })
})

describe('effectiveNoteRequirement', () => {
  it('past day collapses every requirement to "default"', () => {
    expect(effectiveNoteRequirement('required', true)).toBe('default')
    expect(effectiveNoteRequirement('skip', true)).toBe('default')
    expect(effectiveNoteRequirement('default', true)).toBe('default')
  })

  it('non-past day passes each requirement through unchanged', () => {
    expect(effectiveNoteRequirement('required', false)).toBe('required')
    expect(effectiveNoteRequirement('skip', false)).toBe('skip')
    expect(effectiveNoteRequirement('default', false)).toBe('default')
  })
})
