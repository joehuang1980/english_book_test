// Quiz runner for book.html — reads ?book=<id>[&set=<id>] and plays the
// matching quiz set from books/<id>.json.

import { el, text, loadJSON, paragraphs } from './util.js';
import { recordScore, setScore } from './storage.js';

const main = document.getElementById('main');
const header = document.getElementById('header');
const backLink = document.getElementById('back');
const params = new URLSearchParams(location.search);
const bookId = params.get('book');

const LETTERS = 'ABCDEFGH';

function fail(message) {
  main.replaceChildren(el('p', { class: 'notice' }, message));
}

/** Point the browser at a set without reloading the page. */
function goToSet(setId) {
  const url = new URL(location.href);
  if (setId) url.searchParams.set('set', setId);
  else url.searchParams.delete('set');
  history.pushState({ setId: setId ?? null }, '', url);
}

/* ------------------------------ rendering ------------------------------ */

function renderSetPicker(book) {
  backLink.textContent = '← All books';
  backLink.href = 'index.html';

  const items = book.sets.map((set) => {
    const best = setScore(book.id, set.id);
    const card = el('button', { class: 'set-card', type: 'button' });
    const label = el('span', {},
      el('strong', {}, set.title),
      el('span', { class: 'meta' },
        `${set.questions.length} question${set.questions.length === 1 ? '' : 's'}`)
    );
    card.append(label);
    card.append(el('span', { class: 'score-badge' },
      best ? `Best ${best.correct}/${best.total}` : 'Not tried'));
    card.addEventListener('click', () => {
      goToSet(set.id);
      renderQuiz(book, set);
    });
    return el('li', {}, card);
  });

  main.replaceChildren(el('ul', { class: 'set-list' }, ...items));
}

function renderQuiz(book, set) {
  const multipleSets = book.sets.length > 1;
  backLink.textContent = multipleSets ? '← All sections' : '← All books';
  backLink.href = multipleSets
    ? `book.html?book=${encodeURIComponent(book.id)}`
    : 'index.html';

  const form = el('form', { id: 'quiz', novalidate: true });

  if (set.passage) {
    const passage = el('section', { class: 'passage' },
      el('h2', {}, set.title || 'Passage'),
      ...paragraphs(set.passage).map((p) => el('p', {}, p))
    );
    form.append(passage);
  }

  set.questions.forEach((question, index) => {
    const fieldset = el('fieldset', {
      class: 'question',
      id: `q-${index}`,
      'data-index': index,
    });

    fieldset.append(el('legend', { class: 'visually-hidden' },
      `Question ${index + 1}`));
    fieldset.append(el('p', { class: 'prompt' },
      el('span', { class: 'num' }, `${index + 1}.`),
      text(question.prompt)
    ));

    question.choices.forEach((choice, choiceIndex) => {
      const input = el('input', {
        type: 'radio',
        name: `q${index}`,
        value: choiceIndex,
        id: `q${index}-c${choiceIndex}`,
      });
      fieldset.append(el('label', {
        class: 'choice',
        for: `q${index}-c${choiceIndex}`,
      }, input, text(`${LETTERS[choiceIndex] ?? choiceIndex + 1}. ${choice}`)));
    });

    form.append(fieldset);
  });

  const submit = el('button', { class: 'btn', type: 'submit' }, 'Check answers');
  const note = el('span', { class: 'progress-note' },
    `0 of ${set.questions.length} answered`);
  form.append(el('div', { class: 'actions' }, submit, note));

  form.addEventListener('change', () => {
    const answered = set.questions.filter(
      (_, i) => form.querySelector(`input[name="q${i}"]:checked`)
    ).length;
    note.textContent = `${answered} of ${set.questions.length} answered`;
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    grade(book, set, form);
  });

  main.replaceChildren(form);
  window.scrollTo({ top: 0 });
}

/* ------------------------------- grading ------------------------------- */

function grade(book, set, form) {
  let correct = 0;

  set.questions.forEach((question, index) => {
    const fieldset = form.querySelector(`#q-${index}`);
    const checked = form.querySelector(`input[name="q${index}"]:checked`);
    const picked = checked ? Number(checked.value) : null;
    const isCorrect = picked === question.answer;
    if (isCorrect) correct += 1;

    fieldset.classList.add('graded');
    fieldset.querySelectorAll('input').forEach((input) => {
      input.disabled = true;
      const choiceIndex = Number(input.value);
      const label = input.closest('.choice');
      if (choiceIndex === question.answer) label.classList.add('is-correct');
      else if (choiceIndex === picked) label.classList.add('is-wrong');
    });

    if (question.explanation) {
      fieldset.append(el('p', { class: 'explanation' },
        el('strong', {}, isCorrect ? 'Correct. ' : 'Answer: '),
        text(isCorrect
          ? question.explanation
          : `${LETTERS[question.answer] ?? question.answer + 1}. ${question.explanation}`)
      ));
    }
  });

  const total = set.questions.length;
  recordScore(book.id, set.id, correct, total);

  const percent = Math.round((correct / total) * 100);
  const result = el('section', { class: 'result', tabindex: '-1' },
    el('h2', {}, `${correct} / ${total}`),
    el('p', {}, `${percent}% correct — ${set.title}`)
  );

  const retry = el('button', { class: 'btn', type: 'button' }, 'Try again');
  retry.addEventListener('click', () => renderQuiz(book, set));

  const actions = el('div', { class: 'actions' }, retry);
  if (book.sets.length > 1) {
    const other = el('button', { class: 'btn secondary', type: 'button' },
      'Pick another section');
    other.addEventListener('click', () => {
      goToSet(null);
      renderSetPicker(book);
    });
    actions.append(other);
  }

  form.querySelector('.actions').replaceWith(actions);
  main.prepend(result);
  result.focus();
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* -------------------------------- boot --------------------------------- */

function show(book) {
  const setId = new URLSearchParams(location.search).get('set');
  const set = setId ? book.sets.find((s) => s.id === setId) : null;

  if (set) renderQuiz(book, set);
  else if (book.sets.length === 1) renderQuiz(book, book.sets[0]);
  else renderSetPicker(book);
}

if (!bookId) {
  fail('No book selected. Go back and pick one from the list.');
} else {
  try {
    const book = await loadJSON(`books/${encodeURIComponent(bookId)}.json`);

    if (!Array.isArray(book.sets) || book.sets.length === 0) {
      fail(`"${book.title || bookId}" has no quiz sets yet.`);
    } else {
      document.title = `${book.title} · English Book Test`;
      document.getElementById('book-title').textContent = book.title;
      const byline = document.getElementById('book-byline');
      byline.textContent = [book.author, book.level].filter(Boolean).join(' · ');
      header.hidden = false;

      show(book);
      window.addEventListener('popstate', () => show(book));
    }
  } catch (err) {
    fail(`Could not load this book: ${err.message}`);
  }
}
