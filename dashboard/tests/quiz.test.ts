import assert from "node:assert/strict";
import test from "node:test";
import { parseQuizQuestions, quizScore } from "../src/lib/quiz";

test("quiz questions parse and score one answer per MCQ", () => {
  const questions = parseQuizQuestions("2 + 2? | 2 | 3 | 4 | 5 | C\nCapital of India? | Mumbai | Delhi | Pune | Jaipur | B");
  assert.equal(questions.length, 2);
  assert.equal(quizScore(questions, [2, 1]), 2);
  assert.equal(quizScore(questions, [2, -1]), 1);
});

test("quiz setup rejects an invalid correct answer", () => {
  assert.throws(() => parseQuizQuestions("2 + 2? | 2 | 3 | 4 | 5 | E"));
});
