import React from 'react';

export function linkify(text: string): (string | JSX.Element)[] {
  const urlRegex = /(https?:\/\/[^\s)]+)|(^|[\s])www\.[^\s)]+/gi;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Process the URL
    const url = match[0].trim();
    const href = url.startsWith('http') ? url : `https://${url}`;
    
    parts.push(
      React.createElement('a', {
        key: `${match.index}-${url}`,
        href,
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'text-[#9b9b6f] hover:underline'
      }, url)
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
