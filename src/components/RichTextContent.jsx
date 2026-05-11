import { Fragment } from 'react';
import { openExternalUrl } from '../utils/yowl';

const COLOR_MAP = {
  rood: '#ff4d5a',
  goud: '#e4bf59',
  geel: '#ffd84d',
  groen: '#52d273',
  blauw: '#57b7ff',
  paars: '#b881ff',
  roze: '#ff7fd1',
  wit: '#ffffff',
  zwart: '#111111',
  oranje: '#ff9b42'
};

function resolveNamedColor(name) {
  return COLOR_MAP[String(name || '').trim().toLowerCase()] || '';
}

function resolveExplicitColor(tag) {
  const match = String(tag || '').match(/^kleur=(#[0-9a-f]{3,8}|[a-z]+)$/i);
  if (!match) {
    return '';
  }

  const value = match[1];
  if (value.startsWith('#')) {
    return value;
  }

  return resolveNamedColor(value);
}

function renderStyledToken(token, key) {
  if (token.startsWith('**') && token.endsWith('**')) {
    return <strong key={key}>{renderInline(token.slice(2, -2), `${key}-strong`)}</strong>;
  }

  if (token.startsWith('__') && token.endsWith('__')) {
    return <u key={key}>{renderInline(token.slice(2, -2), `${key}-underline`)}</u>;
  }

  if (token.startsWith('*') && token.endsWith('*')) {
    return <em key={key}>{renderInline(token.slice(1, -1), `${key}-italic`)}</em>;
  }

  return null;
}

function findColorToken(text) {
  const tagRegex = /\[(rood|goud|geel|groen|blauw|paars|roze|wit|zwart|oranje|kleur=(#[0-9a-f]{3,8}|[a-z]+))\]/i;
  const match = tagRegex.exec(text);
  if (!match) {
    return null;
  }

  const openTag = match[1];
  const openToken = match[0];
  const start = match.index;
  const closeToken = openTag.toLowerCase().startsWith('kleur=')
    ? '[/kleur]'
    : `[/${String(openTag).toLowerCase()}]`;
  const closeIndex = text.toLowerCase().indexOf(closeToken.toLowerCase(), start + openToken.length);

  if (closeIndex === -1) {
    return null;
  }

  return {
    start,
    end: closeIndex + closeToken.length,
    openTag,
    openToken,
    closeToken,
    inner: text.slice(start + openToken.length, closeIndex)
  };
}

function normalizeUrl(url) {
  const value = String(url || '').trim();
  if (!value) {
    return '';
  }

  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function renderPlainWithLinks(text, keyPrefix) {
  const parts = [];
  const pattern = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const [rawUrl] = match;
    const start = match.index;

    if (start > lastIndex) {
      parts.push(<Fragment key={`${keyPrefix}-text-${lastIndex}`}>{text.slice(lastIndex, start)}</Fragment>);
    }

    const safeHref = normalizeUrl(rawUrl);
    const trimmedLabel = rawUrl.replace(/[),.;!?]+$/g, '');
    const trailing = rawUrl.slice(trimmedLabel.length);

    parts.push(
      <a
        key={`${keyPrefix}-link-${start}`}
        href={normalizeUrl(trimmedLabel)}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => {
          event.preventDefault();
          void openExternalUrl(safeHref.replace(/[),.;!?]+$/g, ''));
        }}
      >
        {trimmedLabel}
      </a>
    );

    if (trailing) {
      parts.push(<Fragment key={`${keyPrefix}-trail-${start}`}>{trailing}</Fragment>);
    }

    lastIndex = start + rawUrl.length;
  }

  if (lastIndex < text.length) {
    parts.push(<Fragment key={`${keyPrefix}-text-end`}>{text.slice(lastIndex)}</Fragment>);
  }

  return parts.length ? parts : [<Fragment key={`${keyPrefix}-plain`}>{text}</Fragment>];
}

function renderInline(text, keyPrefix = 'inline') {
  const colorToken = findColorToken(text);
  if (colorToken) {
    const before = text.slice(0, colorToken.start);
    const after = text.slice(colorToken.end);
    const color = colorToken.openTag.toLowerCase().startsWith('kleur=')
      ? resolveExplicitColor(colorToken.openTag)
      : resolveNamedColor(colorToken.openTag);

    return [
      ...renderInline(before, `${keyPrefix}-before`),
      <span key={`${keyPrefix}-color-${colorToken.start}`} style={color ? { color } : undefined}>
        {renderInline(colorToken.inner, `${keyPrefix}-inner`)}
      </span>,
      ...renderInline(after, `${keyPrefix}-after`)
    ];
  }

  const tokens = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    tokens.push(match[0]);
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens.map((token, index) => {
    const styled = renderStyledToken(token, `${keyPrefix}-${index}`);
    if (styled) {
      return styled;
    }

    return <Fragment key={`${keyPrefix}-${index}`}>{renderPlainWithLinks(token, `${keyPrefix}-${index}`)}</Fragment>;
  });
}

export default function RichTextContent({ text = '', className = '' }) {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  const paragraphs = normalized.split(/\n{2,}/);

  return (
    <div className={`rich-text-content ${className}`.trim()}>
      {paragraphs.map((paragraph, paragraphIndex) => {
        const lines = paragraph.split('\n');
        return (
          <p key={paragraphIndex}>
            {lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {renderInline(line, `paragraph-${paragraphIndex}-line-${lineIndex}`)}
                {lineIndex < lines.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
