import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

test('files marked "use server" export only async functions', () => {
  const violations: string[] = [];
  for (const relative of readdirSync("src/app", { recursive: true })) {
    if (typeof relative !== "string" || !/\.tsx?$/.test(relative)) continue;
    const path = join("src/app", relative);
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    const directive = source.statements[0];
    if (!directive || !ts.isExpressionStatement(directive) || !ts.isStringLiteral(directive.expression) || directive.expression.text !== "use server") continue;
    for (const statement of source.statements) {
      if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) violations.push(`${relative}: runtime re-export`);
      if (ts.isExportAssignment(statement)) violations.push(`${relative}: exported value`);
      const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
      if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
      if (ts.isFunctionDeclaration(statement)) {
        if (!modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)) violations.push(`${relative}: non-async function`);
      } else if (!ts.isInterfaceDeclaration(statement) && !ts.isTypeAliasDeclaration(statement)) {
        violations.push(`${relative}: runtime value`);
      }
    }
  }
  assert.deepEqual(violations, []);
});
