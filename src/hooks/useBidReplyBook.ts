/**
 * Bid Board → Reply book: the read and the three writes.
 *
 * The board calls this itself rather than the window, so the button can carry the book's
 * count and the window opens on replies already in hand. One read when the board mounts;
 * each write changes the list in hand instead of reading the book again.
 *
 * RLS refuses a change to someone else's reply by matching no rows — no error comes back —
 * so an update or a delete that returns no row is reported as refused, not as done.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatErrorMessage } from '../utils/errorHandling'
import { BID_REPLY_BOOK_READ_LIMIT, bidReplyDraftProblem, bidReplyDraftToSave, type BidReplyDraft, type BidReplyEntry } from '../lib/bids/bidReplyBook'

const ENTRY_COLUMNS = 'id, title, kind, body, sign_with_sender, created_by, created_by_name, created_at, updated_at'

export const BID_REPLY_REFUSED_MESSAGE = 'Only the person who posted a reply, or a dev, can change or delete it.'

/** `null` when the write landed; otherwise the words to show. */
export type BidReplyWriteResult = string | null

export type BidReplyBook = {
  entries: BidReplyEntry[]
  /** The first read has not come back. */
  loading: boolean
  /** Why the read failed; the list is empty with it. */
  loadError: string | null
  /** The read came back full: there may be older replies it did not reach. */
  atReadLimit: boolean
  /** A write is in flight. */
  saving: boolean
  reload: () => Promise<void>
  addReply: (draft: BidReplyDraft) => Promise<BidReplyWriteResult>
  updateReply: (id: string, draft: BidReplyDraft) => Promise<BidReplyWriteResult>
  deleteReply: (id: string) => Promise<BidReplyWriteResult>
}

/** Loads for a signed-in user; with none the book is empty and nothing is read. */
export function useBidReplyBook(userId: string | null | undefined): BidReplyBook {
  const [entries, setEntries] = useState<BidReplyEntry[]>([])
  const [loading, setLoading] = useState(!!userId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const readSeqRef = useRef(0)

  const reload = useCallback(async () => {
    if (!userId) {
      readSeqRef.current += 1
      setEntries([])
      setLoadError(null)
      setLoading(false)
      return
    }
    const seq = ++readSeqRef.current
    const { data, error } = await supabase
      .from('bid_reply_book_entries')
      .select(ENTRY_COLUMNS)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(0, BID_REPLY_BOOK_READ_LIMIT - 1)
    if (seq !== readSeqRef.current) return
    if (error) {
      console.error('Error loading the reply book:', error)
      setEntries([])
      setLoadError(formatErrorMessage(error, 'The reply book could not be read.'))
    } else {
      setEntries((data ?? []) as BidReplyEntry[])
      setLoadError(null)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload])

  const addReply = useCallback(
    async (draft: BidReplyDraft): Promise<BidReplyWriteResult> => {
      if (!userId) return 'Sign in to post a reply.'
      const problem = bidReplyDraftProblem(draft)
      if (problem) return problem
      setSaving(true)
      try {
        const { data, error } = await supabase
          .from('bid_reply_book_entries')
          .insert({ ...bidReplyDraftToSave(draft), created_by: userId })
          .select(ENTRY_COLUMNS)
          .single()
        if (error || !data) return formatErrorMessage(error, 'The reply was not posted.')
        const posted = data as BidReplyEntry
        setEntries((prev) => [posted, ...prev.filter((e) => e.id !== posted.id)])
        return null
      } finally {
        setSaving(false)
      }
    },
    [userId],
  )

  const updateReply = useCallback(async (id: string, draft: BidReplyDraft): Promise<BidReplyWriteResult> => {
    const problem = bidReplyDraftProblem(draft)
    if (problem) return problem
    setSaving(true)
    try {
      const { data, error } = await supabase.from('bid_reply_book_entries').update(bidReplyDraftToSave(draft)).eq('id', id).select(ENTRY_COLUMNS)
      if (error) return formatErrorMessage(error, 'The change was not saved.')
      const saved = ((data ?? []) as BidReplyEntry[])[0]
      if (!saved) return BID_REPLY_REFUSED_MESSAGE
      setEntries((prev) => prev.map((e) => (e.id === saved.id ? saved : e)))
      return null
    } finally {
      setSaving(false)
    }
  }, [])

  const deleteReply = useCallback(async (id: string): Promise<BidReplyWriteResult> => {
    setSaving(true)
    try {
      const { data, error } = await supabase.from('bid_reply_book_entries').delete().eq('id', id).select('id')
      if (error) return formatErrorMessage(error, 'The reply was not deleted.')
      if ((data ?? []).length === 0) return BID_REPLY_REFUSED_MESSAGE
      setEntries((prev) => prev.filter((e) => e.id !== id))
      return null
    } finally {
      setSaving(false)
    }
  }, [])

  return { entries, loading, loadError, atReadLimit: entries.length >= BID_REPLY_BOOK_READ_LIMIT, saving, reload, addReply, updateReply, deleteReply }
}
