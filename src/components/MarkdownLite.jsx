import { renderInlineMarkdown } from "../lib/markdownLite";

/**
 * Short formatted text (Talent Codex descriptions): paragraphs separated by a
 * blank line, "- " lines as a bullet list, inline bold/italic.
 * `inline` renders everything as spans, for use inside a button (info boxes).
 */
export default function MarkdownLite({ text, className, inline = false }) {
  const blocks = String(text || "").trim().split(/\n\s*\n/).filter(Boolean);
  const Block = inline ? "span" : "p";
  return (
    <span className={className} style={{ display: "block" }}>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
          if (inline) {
            return (
              <span key={i} className="md-list" style={{ display: "block" }}>
                {lines.map((line, j) => (
                  <span key={j} className="md-li" style={{ display: "block", paddingLeft: "1em", textIndent: "-0.7em" }}>
                    • {renderInlineMarkdown(line.replace(/^\s*[-*]\s+/, ""))}
                  </span>
                ))}
              </span>
            );
          }
          return (
            <ul key={i}>
              {lines.map((line, j) => <li key={j}>{renderInlineMarkdown(line.replace(/^\s*[-*]\s+/, ""))}</li>)}
            </ul>
          );
        }
        return (
          <Block key={i} className="md-p" style={inline ? { display: "block" } : undefined}>
            {lines.map((line, j) => <span key={j}>{j > 0 ? <br /> : null}{renderInlineMarkdown(line)}</span>)}
          </Block>
        );
      })}
    </span>
  );
}
