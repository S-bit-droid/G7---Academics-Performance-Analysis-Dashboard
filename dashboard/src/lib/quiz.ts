export type QuizQuestion = { prompt: string; options: [string, string, string, string]; answer: number };

export function parseQuizQuestions(raw: string): QuizQuestion[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length || lines.length > 30) throw new Error("Add 1 to 30 questions.");
  return lines.map((line, index) => {
    const fields = line.split("|").map((field) => field.trim());
    if (fields.length !== 6 || fields.slice(0, 5).some((value) => !value || value.length > 300)) {
      throw new Error(`Question ${index + 1} needs a prompt, four options and the correct letter.`);
    }
    const answer = "ABCD".indexOf(fields[5].toUpperCase());
    if (answer < 0) throw new Error(`Question ${index + 1} needs answer A, B, C or D.`);
    return { prompt: fields[0], options: fields.slice(1, 5) as QuizQuestion["options"], answer };
  });
}

export function isQuizQuestions(value: unknown): value is QuizQuestion[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => item && typeof item.prompt === "string"
    && Array.isArray(item.options) && item.options.length === 4
    && item.options.every((option: unknown) => typeof option === "string")
    && Number.isInteger(item.answer) && item.answer >= 0 && item.answer < 4);
}

export function quizScore(questions: QuizQuestion[], answers: number[]) {
  return questions.reduce((score, question, index) => score + (answers[index] === question.answer ? 1 : 0), 0);
}
