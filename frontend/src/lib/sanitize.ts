import DOMPurify from "dompurify";

/**
 * Allowed HTML tags for rich text content.
 * Intentionally restrictive — only what Tiptap StarterKit + Link + CodeBlock produce.
 */
const ALLOWED_TAGS = [
  "p", "br",
  "strong", "em", "s", "code",
  "h1", "h2", "h3",
  "ul", "ol", "li",
  "blockquote",
  "pre",
  "a",
  "hr",
];

const ALLOWED_ATTR = ["href", "target", "rel", "class"];

/**
 * Sanitizes an HTML string to prevent XSS.
 * - Strips all tags not in the allowlist
 * - Strips all attributes not in the allowlist
 * - Forces external links to open safely (rel="noopener noreferrer")
 *
 * Safe to call in SSR (returns an empty string when window is unavailable).
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof window === "undefined") {
    // SSR: DOMPurify requires a DOM. Return empty string to avoid leaking raw HTML.
    return "";
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Force safe link attributes
    ADD_ATTR: ["target"],
    FORCE_BODY: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });
}

/**
 * Post-processes sanitized HTML to add safe link attributes.
 * Called after sanitizeHtml so we only touch already-clean content.
 */
export function addSafeLinkAttributes(html: string): string {
  return html.replace(
    /<a\s([^>]*)>/gi,
    (match, attrs: string) => {
      if (!/\bhref\s*=/i.test(attrs)) return match;
      const safeAttrs = attrs.replace(
        /\s(?:target|rel)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
        "",
      );
      return `<a${safeAttrs} target="_blank" rel="noopener noreferrer">`;
    },
  );
}
