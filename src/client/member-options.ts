// What a Member can look like: placeholder emoji avatars (real artwork comes later)
// and lane colours that read well in light and dark mode.

export const MEMBER_EMOJIS = [
  "🦊", "🐻", "🐰", "🐸", "🐼", "🐨", "🦁", "🐯",
  "🐵", "🐧", "🦄", "🐢", "🐙", "🦉", "🐝", "🐞",
  "🐱", "🐶", "🐭", "🐹", "🐮", "🐷", "🦖", "🐳",
];

/** Their names, for screen readers, are in strings.ts (members.colourNames). */
export const MEMBER_COLOURS = ["#ff7a59", "#f5a524", "#2bb673", "#21a1c4", "#4a7cf7", "#9b5de5", "#e8508a", "#8d6e63"];

/** The first option nobody uses yet, so new Members look different by default. */
export function firstUnused(options: string[], used: string[]): string {
  return options.find((o) => !used.includes(o)) ?? options[0] ?? "";
}
