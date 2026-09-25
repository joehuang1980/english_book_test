// Tiny DOM + fetch helpers. No dependencies, no build step.

/**
 * Create an element. Children may be strings or nodes.
 * Attributes are set with setAttribute, so use `class`, not `className`.
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined && value !== false) {
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
}

/** A text node — use when appending user content next to elements. */
export function text(value) {
  return document.createTextNode(String(value));
}

/** Fetch JSON with a useful error message instead of a bare SyntaxError. */
export async function loadJSON(path) {
  let res;
  try {
    res = await fetch(path, { cache: 'no-cache' });
  } catch {
    throw new Error(
      `network request for ${path} failed (if you opened this file directly, ` +
      `serve the folder instead: python3 -m http.server)`
    );
  }
  if (!res.ok) throw new Error(`${path} returned HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new Error(`${path} is not valid JSON`);
  }
}

/**
 * Split a passage into paragraphs on blank lines, preserving single
 * newlines as spaces so wrapped source text still reads correctly.
 */
export function paragraphs(passage) {
  return String(passage)
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}
