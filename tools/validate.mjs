#!/usr/bin/env node
// Validates books/index.json and every books/<id>.json against the quiz
// format. Run with `node tools/validate.mjs`. Exits non-zero on any error.

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const booksDir = join(root, 'books');

const errors = [];
const warnings = [];

const error = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Shortest quoted span worth checking. Below this it is usually a letter
// label or a stray apostrophe rather than a word being tested.
const MIN_QUOTED_LENGTH = 3;

/** Lowercase, straighten curly quotes, and collapse whitespace. */
function normalise(text) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/**
 * Quoted spans inside a question prompt — the word or line the question is
 * testing. Single quotes only count with a boundary on each side, so that
 * apostrophes in "Moonface's" or "don't" are not mistaken for quotes.
 */
function quotedSpans(prompt) {
  const text = prompt.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const spans = [
    ...text.matchAll(/"([^"]+)"/g),
    ...text.matchAll(/(?:^|[\s(])'([^']+)'(?=[\s.,!?;:)]|$)/g),
  ];
  return spans
    .map((m) => m[1].trim())
    .filter((s) => s.length >= MIN_QUOTED_LENGTH);
}

async function readJSON(path, label) {
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    error(label, 'file not found');
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    error(label, `invalid JSON — ${err.message}`);
    return null;
  }
}

function checkString(value, file, where, { required = true } = {}) {
  if (value === undefined || value === null) {
    if (required) error(file, `${where} is missing`);
    return false;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    error(file, `${where} must be a non-empty string`);
    return false;
  }
  return true;
}

/**
 * A vocabulary question quotes the word or line it is testing. When that text
 * is missing from the passage, the reader has nothing to work it out from and
 * the question is unanswerable however good the options are — a mistake the
 * shape checks above cannot see, since such a question is perfectly well
 * formed. Sets without a passage are skipped: there is nothing to check against.
 */
function checkQuotedAgainstPassage(question, passage, file, where) {
  if (typeof passage !== 'string' || passage.trim() === '') return;
  if (typeof question.prompt !== 'string') return;

  const haystack = normalise(passage);
  for (const quoted of quotedSpans(question.prompt)) {
    if (!haystack.includes(normalise(quoted))) {
      error(
        file,
        `${where}.prompt quotes "${quoted}", which does not appear in the passage, ` +
        `so the question cannot be answered by reading it`
      );
    }
  }
}

function checkQuestion(question, passage, file, where) {
  if (typeof question !== 'object' || question === null) {
    error(file, `${where} must be an object`);
    return;
  }

  checkString(question.prompt, file, `${where}.prompt`);
  checkQuotedAgainstPassage(question, passage, file, where);
  checkString(question.explanation, file, `${where}.explanation`, { required: false });

  if (!Array.isArray(question.choices)) {
    error(file, `${where}.choices must be an array`);
    return;
  }
  if (question.choices.length < 2) {
    error(file, `${where}.choices needs at least 2 options`);
  }
  question.choices.forEach((choice, i) => {
    checkString(choice, file, `${where}.choices[${i}]`);
  });

  const { answer } = question;
  if (!Number.isInteger(answer)) {
    error(file, `${where}.answer must be an integer index into choices (0 = first)`);
  } else if (answer < 0 || answer >= question.choices.length) {
    error(
      file,
      `${where}.answer is ${answer}, outside choices (0–${question.choices.length - 1})`
    );
  }
}

function checkBook(book, file, expectedId) {
  if (typeof book !== 'object' || book === null) {
    error(file, 'top level must be an object');
    return;
  }

  checkString(book.title, file, 'title');
  checkString(book.author, file, 'author', { required: false });
  checkString(book.level, file, 'level', { required: false });
  checkString(book.description, file, 'description', { required: false });

  if (book.id !== expectedId) {
    error(file, `id is "${book.id}" but the filename says "${expectedId}"`);
  }

  if (!Array.isArray(book.sets) || book.sets.length === 0) {
    error(file, 'sets must be a non-empty array');
    return;
  }

  const seen = new Set();
  book.sets.forEach((set, index) => {
    const where = `sets[${index}]`;
    if (typeof set !== 'object' || set === null) {
      error(file, `${where} must be an object`);
      return;
    }

    if (checkString(set.id, file, `${where}.id`)) {
      if (!ID_PATTERN.test(set.id)) {
        error(file, `${where}.id "${set.id}" must be lowercase letters, digits and hyphens`);
      }
      if (seen.has(set.id)) error(file, `duplicate set id "${set.id}"`);
      seen.add(set.id);
    }

    checkString(set.title, file, `${where}.title`);
    checkString(set.passage, file, `${where}.passage`, { required: false });

    if (!Array.isArray(set.questions) || set.questions.length === 0) {
      error(file, `${where}.questions must be a non-empty array`);
      return;
    }
    set.questions.forEach((question, qi) => {
      checkQuestion(question, set.passage, file, `${where}.questions[${qi}]`);
    });
  });
}

/* --------------------------------- run --------------------------------- */

const index = await readJSON(join(booksDir, 'index.json'), 'books/index.json');

if (index) {
  if (!Array.isArray(index.books)) {
    error('books/index.json', 'books must be an array');
  } else {
    const listed = new Set();

    for (const [i, entry] of index.books.entries()) {
      const where = `books[${i}]`;
      if (typeof entry !== 'object' || entry === null) {
        error('books/index.json', `${where} must be an object`);
        continue;
      }
      if (!checkString(entry.id, 'books/index.json', `${where}.id`)) continue;
      if (!ID_PATTERN.test(entry.id)) {
        error('books/index.json',
          `${where}.id "${entry.id}" must be lowercase letters, digits and hyphens`);
        continue;
      }
      if (listed.has(entry.id)) {
        error('books/index.json', `duplicate book id "${entry.id}"`);
        continue;
      }
      listed.add(entry.id);
      checkString(entry.title, 'books/index.json', `${where}.title`);

      const file = `books/${entry.id}.json`;
      const book = await readJSON(join(booksDir, `${entry.id}.json`), file);
      if (!book) continue;

      checkBook(book, file, entry.id);

      // The homepage renders index.json, the quiz page renders the book file.
      // Drift between them shows up as a book that is titled two different
      // ways depending on which page you are looking at.
      for (const field of ['title', 'author', 'level']) {
        if (entry[field] !== undefined && book[field] !== undefined
            && entry[field] !== book[field]) {
          warn(file,
            `${field} is "${book[field]}" here but "${entry[field]}" in books/index.json`);
        }
      }
    }

    const onDisk = (await readdir(booksDir))
      .filter((name) => name.endsWith('.json') && name !== 'index.json')
      .map((name) => name.replace(/\.json$/, ''));

    // Still check the contents of unlisted files: they are usually a book
    // mid-way through being added, and it helps to know it is well-formed
    // before it gets wired into the index.
    for (const id of onDisk) {
      if (listed.has(id)) continue;
      const file = `books/${id}.json`;
      warn(file, 'not listed in books/index.json, so it is unreachable');
      const book = await readJSON(join(booksDir, `${id}.json`), file);
      if (book) checkBook(book, file, id);
    }
  }
}

for (const message of warnings) console.warn(`warning  ${message}`);
for (const message of errors) console.error(`error    ${message}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s) found.`);
  process.exit(1);
}

console.log(
  warnings.length > 0
    ? `\nQuizzes are valid (${warnings.length} warning(s)).`
    : 'All quizzes are valid.'
);
