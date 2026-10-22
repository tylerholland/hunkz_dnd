// Small markdown subset shared by the World Guide and the Talent Codex:
// **bold**, *italic*, `code`, [links](…). `onInternalLink(href)` handles
// links to other .md pages (World Guide); without it they're plain links.
export function renderInlineMarkdown(text, onInternalLink) {
  // Split on bold, italic, links, inline code
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[0].startsWith("**")) {
      parts.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[0].startsWith("*")) {
      parts.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[0].startsWith("`")) {
      parts.push(<code key={match.index}>{match[4]}</code>);
    } else if (match[0].startsWith("[")) {
      const linkText = match[5];
      const href = match[6];
      const isInternal = href && !href.startsWith("http") && href.endsWith(".md");
      if (isInternal) {
        parts.push(
          <a
            key={match.index}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (onInternalLink) onInternalLink(href);
            }}
          >
            {linkText}
          </a>
        );
      } else {
        parts.push(
          <a key={match.index} href={href} target="_blank" rel="noreferrer">
            {linkText}
          </a>
        );
      }
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts;
}
