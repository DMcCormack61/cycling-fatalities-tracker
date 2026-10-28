import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("Neon startup does not import the crash loader script", () => {
  const source = readFileSync(join(root, "src/lib/db.ts"), "utf8");
  const start = source.indexOf("function createNeonSql");
  const end = source.indexOf("async function createPgliteSql");
  assert.ok(start > 0 && end > start);
  const neon = source.slice(start, end);
  assert.equal(neon.includes("loadCrashImportFile"), false);
  assert.match(source, /function loadCrashImportFile/);
  assert.match(source.slice(end), /loadCrashImportFile/);
});
