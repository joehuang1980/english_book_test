// Per-viewer best scores, kept in localStorage.
//
// This is a convenience only: it lives in one browser, is never shared, and
// can be unavailable (private windows, blocked site data). Every access is
// guarded so the quiz still works when storage throws.

const KEY = 'english-book-test:scores:v1';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(scores) {
  try {
    localStorage.setItem(KEY, JSON.stringify(scores));
  } catch {
    /* storage unavailable or full — scores just won't persist */
  }
}

const slot = (bookId, setId) => `${bookId}::${setId}`;

/** Record a result, keeping only the best attempt for that set. */
export function recordScore(bookId, setId, correct, total) {
  const scores = readAll();
  const key = slot(bookId, setId);
  const prev = scores[key];
  if (!prev || correct > prev.correct) {
    scores[key] = { correct, total, at: new Date().toISOString() };
    writeAll(scores);
  }
}

/** Best attempt for one set, or null. */
export function setScore(bookId, setId) {
  return readAll()[slot(bookId, setId)] ?? null;
}

/** Best attempts for a whole book, summed across its sets, or null. */
export function bestScore(bookId) {
  const prefix = `${bookId}::`;
  const entries = Object.entries(readAll()).filter(([k]) => k.startsWith(prefix));
  if (entries.length === 0) return null;
  return entries.reduce(
    (acc, [, v]) => ({ correct: acc.correct + v.correct, total: acc.total + v.total }),
    { correct: 0, total: 0 }
  );
}
