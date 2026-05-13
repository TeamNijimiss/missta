import type { EmojiMap } from '@/lib/misskey/emoji';
import { Link } from 'react-router-dom';

const MFM_LINK_PATTERN = /\??\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/g;
const EMOJI_TOKEN_PATTERN = /:([a-zA-Z0-9_+\-.]+(?:@[a-zA-Z0-9.\-]+)?):/g;

export function EmojiText({
  text,
  emojiMap,
  replaceCustomEmoji = true,
  className
}: {
  text: string;
  emojiMap?: EmojiMap;
  replaceCustomEmoji?: boolean;
  className?: string;
}) {
  if (!text) {
    return null;
  }

  const nodes = parseRichText(text, emojiMap, replaceCustomEmoji);

  return <span className={className ? `emoji-text ${className}` : 'emoji-text'}>{nodes.length > 0 ? nodes : text}</span>;
}

function resolveEmojiUrl(map: EmojiMap | undefined, emojiKey: string): string | null {
  if (!map) {
    return null;
  }

  const exact = map[emojiKey];
  if (exact) {
    return exact;
  }

  if (emojiKey.includes('@')) {
    return null;
  }

  const [localName] = emojiKey.split('@');
  return map[localName] ?? null;
}

function parseRichText(text: string, emojiMap?: EmojiMap, replaceCustomEmoji = true): Array<string | JSX.Element> {
  const nodes: Array<string | JSX.Element> = [];
  let cursor = 0;
  let nodeIndex = 0;

  while (cursor < text.length) {
    const nextLink = findNextMatch(MFM_LINK_PATTERN, text, cursor);
    const nextUrl = findNextMatch(URL_PATTERN, text, cursor);
    const nextEmoji = findNextMatch(EMOJI_TOKEN_PATTERN, text, cursor);
    const nextHashtag = findNextHashtag(text, cursor);
    const nextMatch = getFirstMatch(nextLink, nextUrl, nextEmoji, nextHashtag);

    if (!nextMatch) {
      nodes.push(text.slice(cursor));
      break;
    }

    const start = nextMatch.index ?? cursor;
    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }

    if (nextMatch.pattern === 'link') {
      const label = nextMatch.match[1];
      const href = sanitizeUrl(nextMatch.match[2]);
      if (href) {
        nodes.push(
          <a key={`mfm-link-${nodeIndex}`} className="inline-rich-link" href={href} target="_blank" rel="noreferrer noopener">
            <InlineEmojiText text={label} emojiMap={emojiMap} replaceCustomEmoji={replaceCustomEmoji} />
          </a>
        );
      } else {
        nodes.push(nextMatch.match[0]);
      }
    } else if (nextMatch.pattern === 'url') {
      const [urlDisplay, trailing] = trimTrailingPunctuation(nextMatch.match[0]);
      const href = sanitizeUrl(urlDisplay);

      if (href) {
        nodes.push(
          <a key={`url-${nodeIndex}`} className="inline-rich-link" href={href} target="_blank" rel="noreferrer noopener">
            {urlDisplay}
          </a>
        );
        if (trailing) {
          nodes.push(trailing);
        }
      } else {
        nodes.push(nextMatch.match[0]);
      }
    } else {
      if (nextMatch.pattern === 'emoji') {
        const fullToken = nextMatch.match[0];
        const emojiKey = nextMatch.match[1];
        const emojiUrl = replaceCustomEmoji ? resolveEmojiUrl(emojiMap, emojiKey) : null;
        if (emojiUrl) {
          nodes.push(<img key={`emoji-${nodeIndex}`} className="custom-emoji" src={emojiUrl} alt={fullToken} loading="lazy" />);
        } else {
          nodes.push(fullToken);
        }
      } else {
        const tagText = nextMatch.match[1];
        nodes.push(
          <Link key={`tag-${nodeIndex}`} className="inline-tag-link" to={`/tags/${encodeURIComponent(tagText)}`}>
            #{tagText}
          </Link>
        );
      }
    }

    cursor = start + nextMatch.match[0].length;
    nodeIndex += 1;
  }

  return nodes;
}

function findNextMatch(pattern: RegExp, text: string, cursor: number): RegExpMatchArray | null {
  pattern.lastIndex = cursor;
  return pattern.exec(text);
}

function getFirstMatch(
  linkMatch: RegExpMatchArray | null,
  urlMatch: RegExpMatchArray | null,
  emojiMatch: RegExpMatchArray | null,
  hashtagMatch: RegExpMatchArray | null
):
  | {
      pattern: 'link' | 'url' | 'emoji' | 'hashtag';
      match: RegExpMatchArray;
      index: number;
    }
  | null {
  const candidates = [
    linkMatch ? { pattern: 'link' as const, match: linkMatch, index: linkMatch.index ?? Number.MAX_SAFE_INTEGER } : null,
    urlMatch ? { pattern: 'url' as const, match: urlMatch, index: urlMatch.index ?? Number.MAX_SAFE_INTEGER } : null,
    emojiMatch ? { pattern: 'emoji' as const, match: emojiMatch, index: emojiMatch.index ?? Number.MAX_SAFE_INTEGER } : null,
    hashtagMatch ? { pattern: 'hashtag' as const, match: hashtagMatch, index: hashtagMatch.index ?? Number.MAX_SAFE_INTEGER } : null
  ].filter((item): item is { pattern: 'link' | 'url' | 'emoji' | 'hashtag'; match: RegExpMatchArray; index: number } => Boolean(item));

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => a.index - b.index);
  return candidates[0];
}

function sanitizeUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function findNextHashtag(text: string, cursor: number): RegExpMatchArray | null {
  for (let i = cursor; i < text.length; i += 1) {
    if (text[i] !== '#') {
      continue;
    }

    if (i > 0) {
      const prev = text[i - 1];
      if (isHashtagWordChar(prev) || prev === '/' || prev === ':') {
        continue;
      }
    }

    let end = i + 1;
    while (end < text.length) {
      const char = text[end];
      if (!isHashtagWordChar(char)) {
        break;
      }
      end += 1;
    }

    if (end === i + 1) {
      continue;
    }

    const fullToken = text.slice(i, end);
    const tag = fullToken.slice(1);
    const match = [fullToken, tag] as unknown as RegExpMatchArray;
    match.index = i;
    match.input = text;
    return match;
  }

  return null;
}

function isHashtagWordChar(char: string): boolean {
  return /[\p{L}\p{N}_]/u.test(char);
}

function trimTrailingPunctuation(url: string): [string, string] {
  const matched = url.match(/^(.*?)([),.!?:;]+)?$/);
  if (!matched) {
    return [url, ''];
  }

  return [matched[1], matched[2] ?? ''];
}

function InlineEmojiText({ text, emojiMap, replaceCustomEmoji = true }: { text: string; emojiMap?: EmojiMap; replaceCustomEmoji?: boolean }) {
  const nodes = parseRichTextWithoutLink(text, emojiMap, replaceCustomEmoji);
  return <>{nodes.length > 0 ? nodes : text}</>;
}

function parseRichTextWithoutLink(text: string, emojiMap?: EmojiMap, replaceCustomEmoji = true): Array<string | JSX.Element> {
  const nodes: Array<string | JSX.Element> = [];
  let lastIndex = 0;
  let index = 0;
  const emojiPattern = /:([a-zA-Z0-9_+\-.]+(?:@[a-zA-Z0-9.\-]+)?):/g;

  for (const match of text.matchAll(emojiPattern)) {
    const fullToken = match[0];
    const emojiKey = match[1];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    const emojiUrl = replaceCustomEmoji ? resolveEmojiUrl(emojiMap, emojiKey) : null;
    if (emojiUrl) {
      nodes.push(<img key={`inline-emoji-${index}`} className="custom-emoji" src={emojiUrl} alt={fullToken} loading="lazy" />);
    } else {
      nodes.push(fullToken);
    }

    lastIndex = start + fullToken.length;
    index += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
