import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import process from "node:process";

const root = new URL("../", import.meta.url);
const checkedRoots = ["src", "e2e", "lint"];
const checkedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".grit"]);
const forbidden = [
  [/@ts-ignore\b/, "@ts-ignore is forbidden; fix or encode the type invariant."],
  [/@ts-expect-error\b/, "@ts-expect-error is forbidden; model the boundary explicitly."],
  [/@ts-nocheck\b/, "@ts-nocheck is forbidden."],
  [/biome-ignore\b/, "Biome suppression comments are forbidden."],
  [/eslint-disable\b/, "ESLint suppression comments are forbidden."],
  [/prettier-ignore\b/, "Formatter suppression comments are forbidden."],
];

async function filesUnder(path) {
  const entries = await readdir(new URL(`${path}/`, root), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const child = join(path, entry.name);
      if (entry.isDirectory()) {
        return filesUnder(child);
      }
      if (checkedExtensions.has(extname(entry.name))) {
        return [child];
      }
      return [];
    }),
  );
  return nested.flat();
}

const files = (await Promise.all(checkedRoots.map(filesUnder))).flat();
const sources = await Promise.all(
  files.map(async (path) => [path, await readFile(new URL(path, root), "utf8")]),
);

const violations = [];
for (const [path, source] of sources) {
  for (const [index, line] of source.split("\n").entries()) {
    for (const [pattern, message] of forbidden) {
      if (pattern.test(line)) {
        violations.push(`${path}:${index + 1}: ${message}`);
      }
      pattern.lastIndex = 0;
    }
  }
}

const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
for (const group of ["dependencies", "devDependencies", "optionalDependencies"]) {
  for (const [name, version] of Object.entries(packageJson[group] ?? {})) {
    if (/^(?:\^|~|>|<|=|\*|latest$|next$)/.test(version)) {
      violations.push(
        `package.json: ${group}.${name} must use an exact reproducible version, got "${version}"`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("Vial Web anti-pattern policy violations:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log("Vial Web anti-pattern policy: clean");
}
