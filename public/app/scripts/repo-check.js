const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = process.cwd();
const IGNORED_DIRS = new Set([".git", ".tmp", "node_modules"]);
const TEXT_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".json",
  ".css",
  ".md",
  ".txt",
]);
const LINKED_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".css",
  ".json",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
]);
const BANNED_PATTERNS = [
  { label: "replacement character", regex: /\uFFFD/ },
  { label: "mojibake sequence", regex: /ï¿½/gi },
  { label: "mojibake em dash", regex: /â€”/gi },
  { label: "mojibake ellipsis", regex: /â€¦/gi },
  { label: "mojibake apostrophe", regex: /â€™/gi },
  { label: "mojibake open quote", regex: /â€œ/gi },
  { label: "mojibake close quote", regex: /â€\u009d|â€/gi },
  { label: "placeholder copy", regex: /coming soon/gi },
  { label: "placeholder copy", regex: /route no longer 404s/gi },
  { label: "placeholder test script", regex: /error:\s*no test specified/gi },
];

const issues = [];
const SELF_FILE = path.resolve(ROOT, "scripts", "repo-check.js");

function walk(dir, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, acc);
      continue;
    }
    acc.push(fullPath);
  }
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function getLineNumber(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function addIssue(filePath, line, message) {
  issues.push({
    file: relative(filePath),
    line,
    message,
  });
}

function scanText(filePath, content) {
  if (path.resolve(filePath) === SELF_FILE) return;
  for (const pattern of BANNED_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match = pattern.regex.exec(content);
    while (match) {
      addIssue(filePath, getLineNumber(content, match.index), `${pattern.label}: ${match[0]}`);
      match = pattern.regex.exec(content);
    }
  }
}

function parseJavaScript(filePath, content, label, isModule = false) {
  try {
    const sourceLabel = label || relative(filePath);
    if (isModule) {
      if (typeof vm.SourceTextModule === "function") {
        new vm.SourceTextModule(content, { identifier: sourceLabel });
      }
      return;
    } else {
      new vm.Script(content, { filename: sourceLabel });
    }
  } catch (error) {
    const line = error && Number.isInteger(error.lineNumber) ? error.lineNumber : 1;
    addIssue(filePath, line, `syntax error in ${label || "script"}: ${error.message}`);
  }
}

function scanInlineScripts(filePath, content) {
  const sanitized = content.replace(/<!--[\s\S]*?-->/g, (block) => block.replace(/[^\n]/g, " "));
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match = scriptRegex.exec(sanitized);
  let index = 0;
  while (match) {
    const attrs = match[1] || "";
    if (!/\bsrc\s*=/.test(attrs)) {
      index += 1;
      parseJavaScript(
        filePath,
        match[2],
        `${relative(filePath)}#inline-script-${index}`,
        /\btype\s*=\s*["']module["']/i.test(attrs)
      );
    }
    match = scriptRegex.exec(sanitized);
  }
}

function resolveReference(filePath, rawReference) {
  const cleanReference = rawReference.split("#")[0].split("?")[0];
  if (!cleanReference) return null;
  if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(cleanReference)) return null;

  const ext = path.extname(cleanReference).toLowerCase();
  if (!LINKED_EXTENSIONS.has(ext)) return null;

  if (cleanReference.startsWith("/")) {
    return path.join(ROOT, cleanReference.replace(/^\/+/, ""));
  }
  return path.resolve(path.dirname(filePath), cleanReference);
}

function scanLocalReferences(filePath, content) {
  const attrRegex = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  let match = attrRegex.exec(content);
  while (match) {
    const rawReference = match[1];
    const resolved = resolveReference(filePath, rawReference);
    if (resolved && !fs.existsSync(resolved)) {
      addIssue(
        filePath,
        getLineNumber(content, match.index),
        `missing local reference: ${rawReference}`
      );
    }
    match = attrRegex.exec(content);
  }
}

function main() {
  const files = [];
  walk(ROOT, files);

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext) && ext !== ".html") continue;

    const content = fs.readFileSync(filePath, "utf8");
    scanText(filePath, content);

    if (ext === ".js") {
      parseJavaScript(filePath, content, undefined, /(^|\n)\s*(?:import|export)\s/m.test(content));
      continue;
    }

    if (ext === ".html") {
      scanInlineScripts(filePath, content);
      scanLocalReferences(filePath, content);
    }
  }

  if (!issues.length) {
    console.log("Repo check passed.");
    return;
  }

  console.error(`Repo check found ${issues.length} issue(s):`);
  for (const issue of issues) {
    console.error(`${issue.file}:${issue.line} ${issue.message}`);
  }
  process.exitCode = 1;
}

main();
