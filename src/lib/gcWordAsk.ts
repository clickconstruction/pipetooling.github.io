/**
 * Client door to the ask-by-link rules (punch list #49, step 7). Same file the
 * `gc-word-ask` edge function runs — one rule, no mirror.
 */
export {
  WORD_ASK_LIFE_DAYS,
  WORD_ASK_MAX_GCS,
  WORD_ASK_NOTE_MAX,
  WORD_ASK_NOTE_MIN,
  WORD_ASK_TEMPERATURES,
  isNoChangeNote,
  noChangeNote,
  validateWordAskAnswers,
  wordAskEmail,
  wordAskLinkMessage,
  wordAskLinkProblem,
  wordAskPageGcs,
  wordAskTextMessage,
  wordAskUrl,
  type WordAskAnswer,
  type WordAskAnswerInput,
  type WordAskAnswerRow,
  type WordAskGc,
  type WordAskLink,
  type WordAskTemperature,
  type WordAskWeekItem,
} from '../../supabase/functions/_shared/gcWordAsk'
