import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib"];
const ROUTE_PATTERN = /(?:href|router\.push|router\.replace)\s*(?:=|\()\s*[{]?[`"']([^`"'{}]+)[`"']/g;
const STATIC_ROUTE_PATTERN = /[`"'](\/[A-Za-z0-9_?&=/#.:-][^`"'\s)]*)[`"']/g;
const CANONICAL_REPLACEMENTS: Record<string, string> = {
  "/payments": "/billing/payment-postings",
  "/payment-postings": "/billing/payment-postings",
  "/payment-imports": "/billing/payment-imports",
  "/workqueue": "/billing/workqueue",
};

type RouteHit = {
  route: string;
  file: string;
  line: number;
  source: string;
};

function walk(dir: string, files: string[] = []) {
  const absolute = join(ROOT, dir);

  for (const entry of readdirSync(absolute)) {
    if (entry.startsWith(".") || entry === "node_modules" || entry === ".next") continue;

    const path = join(absolute, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      walk(relative(ROOT, path), files);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      files.push(path);
    }
  }

  return files;
}

function lineNumber(content: string, index: number) {
  return content.slice(0, index).split("\n").length;
}

function normalize(route: string) {
  return route.split("?")[0].replace(/\/$/, "") || "/";
}

function scanFile(path: string): RouteHit[] {
  const content = readFileSync(path, "utf8");
  const file = relative(ROOT, path);
  const hits: RouteHit[] = [];

  for (const pattern of [ROUTE_PATTERN, STATIC_ROUTE_PATTERN]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content))) {
      const route = match[1];
      if (!route.startsWith("/")) continue;
      if (route.startsWith("//")) continue;
      if (route.includes("${")) continue;

      hits.push({
        route,
        file,
        line: lineNumber(content, match.index),
        source: match[0],
      });
    }
  }

  return hits;
}

const files = SCAN_DIRS.flatMap((dir) => {
  try {
    return walk(dir);
  } catch {
    return [];
  }
});

const hits = files.flatMap(scanFile);
const byNormalizedRoute = new Map<string, RouteHit[]>();

for (const hit of hits) {
  const key = normalize(hit.route);
  const existing = byNormalizedRoute.get(key) ?? [];
  existing.push(hit);
  byNormalizedRoute.set(key, existing);
}

const duplicateRoutes = Array.from(byNormalizedRoute.entries())
  .filter(([, routeHits]) => routeHits.length > 1)
  .sort(([a], [b]) => a.localeCompare(b));

const nonCanonicalHits = hits.filter((hit) => CANONICAL_REPLACEMENTS[normalize(hit.route)]);

console.log("\nRoute inventory complete\n");
console.log(`Files scanned: ${files.length}`);
console.log(`Route references found: ${hits.length}`);

console.log("\nDuplicate route references:\n");
for (const [route, routeHits] of duplicateRoutes) {
  console.log(`${route} (${routeHits.length})`);
  for (const hit of routeHits) {
    console.log(`  - ${hit.file}:${hit.line} ${hit.source}`);
  }
}

console.log("\nNon-canonical route references:\n");
if (nonCanonicalHits.length === 0) {
  console.log("  None");
} else {
  for (const hit of nonCanonicalHits) {
    const canonical = CANONICAL_REPLACEMENTS[normalize(hit.route)];
    console.log(`  - ${hit.file}:${hit.line} ${hit.route} -> ${canonical}`);
  }
}
