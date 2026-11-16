/**
 * The words behind **Change the link** on a saved set of plans (v2.7464): which press a row offers, what a pasted
 * link still needs, and the line under the box. The write is `planSetsIo.updateLink`; the screens' wiring is in the
 * two render tests.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LINK_PRESS, linkChangeNote, linkChangeProblem, linkPressWords } from './planSets'

const IO = readFileSync('src/lib/plans/planSetsIo.ts', 'utf8')
const PARTS_MIGRATION = readFileSync('supabase/migrations/20261101210000_plan_parts_and_sets.sql', 'utf8')
const AUTHOR_MIGRATION = readFileSync('supabase/migrations/20261106180000_plan_sets_author_stays_on_job.sql', 'utf8')

describe('Change the link on a saved set', () => {
  it('a set with a link offers Change the link, one with none Set the link, and the box saves with Save the link', () => {
    expect(linkPressWords({ link: 'https://drive.google.com/drive/folders/a' })).toBe('Change the link')
    expect(linkPressWords({ link: '' })).toBe('Set the link')
    expect(linkPressWords({ link: '  ' })).toBe('Set the link')
    expect(LINK_PRESS.save).toBe('Save the link')
  })

  it('a pasted link needs to be there, start with https://, fit the column and differ from the one the set has', () => {
    const has = 'https://drive.google.com/drive/folders/theirs'
    expect(linkChangeProblem(has, 'https://drive.google.com/drive/folders/ours')).toBeNull()
    expect(linkChangeProblem('', ' https://drive.google.com/file/d/abc/view ')).toBeNull()
    expect(linkChangeProblem(has, '   ')).toBe('Paste the set’s link, starting with https://.')
    expect(linkChangeProblem(has, 'drive.google.com/drive/folders/ours')).toBe('A link starts with https://. Copy it whole from Drive.')
    expect(linkChangeProblem(has, `https://drive.google.com/${'a'.repeat(2000)}`)).toBe('That link is too long to keep. Copy the folder’s or the file’s own link.')
    expect(linkChangeProblem(has, ` ${has} `)).toBe('That is the link the set already has.')
    // The column's own CHECK: empty, or https with at most 2000 characters.
    expect(PARTS_MIGRATION).toContain("CONSTRAINT plan_sets_link_shape CHECK (link = '' OR (link ~ '^https?://' AND length(link) <= 2000))")
  })

  it('the note says what the save moves: every job on the part for the set it builds from, only the Open press otherwise', () => {
    expect(linkChangeNote(true)).toBe('The part builds from this set. Open plans on every job that names the part opens the new link.')
    expect(linkChangeNote(false)).toBe('The set stays where it is on the part. Only where its Open ↗ leads changes.')
  })

  it('the write is one update on the row’s own id that asks the row back, and the database does the rest', () => {
    // The id never moves: no insert, no delete, only the link and the file facts read behind the old one.
    expect(IO).toContain(".update({ link: link.trim(), file_name: null, file_size: null, file_count: null, checked_at: null, check_note: null }).eq('id', setId).select('id')")
    expect(IO).toContain("if (!r.data?.length) throw new Error('This set is not yours to change.')")
    // The roles that add a set may update one (no migration owed), and the mirror fires on any link update.
    expect(AUTHOR_MIGRATION).toContain('CREATE POLICY plan_sets_update ON public.plan_sets\n  FOR UPDATE TO authenticated USING (\n    public.plan_part_can_write(part_id)')
    expect(PARTS_MIGRATION).toContain('AFTER UPDATE OF link ON public.plan_sets\n  FOR EACH ROW EXECUTE FUNCTION public.plan_sets_mirror_on_change();')
    expect(PARTS_MIGRATION).toContain('IF NEW.link IS DISTINCT FROM OLD.link THEN\n    PERFORM public.plan_part_mirror_job_links(NEW.part_id);')
  })
})
