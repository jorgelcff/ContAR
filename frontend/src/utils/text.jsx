import React from 'react';

// \u{FE0F} (variation selector) and \u{200D} (zero-width joiner) are emoji
// *modifiers*, not standalone glyphs — they're included here so multi-codepoint
// emoji (flags, skin tones, ZWJ sequences) are stripped down to nothing rather
// than leaving orphaned joiner characters behind.
// eslint-disable-next-line no-misleading-character-class
const EMOJI_REGEX = /[\u{1F000}-\u{1FFFF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
const URL_PATTERN = /(https?:\/\/[^\s<>"]+)/g;

/** Removes emoji characters and collapses leftover extra whitespace. */
export function stripEmojis(text) {
  return String(text || '')
    .replace(EMOJI_REGEX, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Strips emojis and turns http(s) URLs into clickable links. Returns an array of strings/elements. */
export function linkifyText(text) {
  const clean = stripEmojis(text);
  if (!clean) return clean;
  return clean.split(URL_PATTERN).map((part, i) => (
    /^https?:\/\//.test(part)
      ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-cyan-400 text-cyan-300 hover:text-cyan-200 break-all"
        >
          {part}
        </a>
      )
      : part
  ));
}
