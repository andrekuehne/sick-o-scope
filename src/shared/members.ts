import { z } from "zod";

/** Exactly one emoji (one grapheme that is a pictograph or flag), e.g. "🦊" or "👩‍👧". */
function isSingleEmoji(value: string): boolean {
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)];
  return graphemes.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(value);
}

/** What a User enters for a Member: name, emoji avatar and lane colour. */
export const MemberInput = z.object({
  name: z.string().trim().min(1).max(40),
  // One grapheme can still be long (combining marks), hence the cap.
  emoji: z.string().max(20).refine(isSingleEmoji, "exactly one emoji"),
  colour: z.string().regex(/^#[0-9a-f]{6}$/i, "a colour like #ff7a59"),
});
export type MemberInput = z.infer<typeof MemberInput>;

/** A Member as the API returns it. Lists come in display order: active ones first, by their order. */
export const Member = MemberInput.extend({
  id: z.string(),
  archived: z.boolean(),
});
export type Member = z.infer<typeof Member>;

/** Body of a reorder: every active Member's id, in the new order. */
export const MemberOrder = z.object({
  memberIds: z.array(z.string()).min(1).max(100),
});
export type MemberOrder = z.infer<typeof MemberOrder>;
