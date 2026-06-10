import React from 'react';

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
