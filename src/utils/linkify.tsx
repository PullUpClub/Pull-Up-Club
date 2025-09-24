// jsx runtime is automatic; no React import needed

export function linkify(text: string): (string | JSX.Element)[] {
  const re = /(https?:\/\/[^\s)]+)|(^|[\s])www\.[^\s)]+/gi;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text))) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const raw = match[0];
    const trimmed = raw.trim();
    const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    parts.push(
      <a
        key={`${match.index}-${url}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#9b9b6f] hover:underline"
      >
        {raw}
      </a>
    );

    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}


