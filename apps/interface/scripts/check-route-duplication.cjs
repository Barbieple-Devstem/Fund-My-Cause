/**
 * Route duplication guard
 *
 * apps/interface/src/app is meant to have a single source of truth for each
 * route, living under the `[locale]` segment (see docs/i18n.md). This script
 * fails if a page.tsx exists at the same relative path under both
 * src/app/[locale]/... and src/app/... (excluding [locale] and api),
 * which is exactly the duplication pattern fixed in GitHub issue #830.
 *
 * Exit code 1 if any duplicate route is found.
 */

const fs = require("fs");
const path = require("path");

const APP_DIR = path.resolve(__dirname, "..", "src", "app");
const LOCALE_DIR = path.join(APP_DIR, "[locale]");
const EXCLUDED_TOP_LEVEL = new Set(["[locale]", "api"]);

function findPageRoutes(rootDir) {
  const routes = new Set();

  function walk(dir, relative) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), path.join(relative, entry.name));
      } else if (entry.name === "page.tsx" || entry.name === "page.ts") {
        routes.add(relative || ".");
      }
    }
  }

  if (fs.existsSync(rootDir)) {
    walk(rootDir, "");
  }

  return routes;
}

const legacyRoutes = new Set();
for (const entry of fs.readdirSync(APP_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory() || EXCLUDED_TOP_LEVEL.has(entry.name)) continue;
  for (const route of findPageRoutes(path.join(APP_DIR, entry.name))) {
    legacyRoutes.add(path.join(entry.name, route));
  }
}

const localeRoutes = findPageRoutes(LOCALE_DIR);

const duplicates = [...legacyRoutes].filter((route) => localeRoutes.has(route));

if (duplicates.length > 0) {
  console.error("Duplicate route trees detected under apps/interface/src/app:\n");
  for (const route of duplicates) {
    console.error(`  - ${route} exists both in src/app/ and src/app/[locale]/`);
  }
  console.error(
    "\nRoutes must live only under src/app/[locale]/ (see docs/i18n.md). " +
      "If this is a new route, remove the non-locale copy instead of duplicating it."
  );
  process.exit(1);
} else {
  console.log("No duplicate route trees found.");
}
