#!/usr/bin/env node
/**
 * Maintain the GitHub Pages report site tree:
 *
 *   report-site/<report>/<slot>/                  (main)
 *   report-site/<branch>/<report>/<slot>/         (temp / feature branches)
 *
 * Slots are `latest` (overwritten) or a URL-safe unix timestamp.
 *
 * Commands:
 *   prepare  --site DIR [--prev DIR]...
 *   publish  --site DIR --report NAME --source DIR --slots SLOT[,SLOT...] [--base BRANCH]
 *   finalize --site DIR [--keep N] [--run-url URL] [--history-slot SLOT] [--base BRANCH]
 *   sanitize-branch NAME
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const RESERVED_TOP = new Set(["index.html", "allure", "playwright", "redoc", "latest"]);

function usage(exitCode = 1) {
  console.error(`Usage:
  pages-site.mjs prepare  --site DIR [--prev DIR]...
  pages-site.mjs publish  --site DIR --report NAME --source DIR --slots SLOT[,SLOT...] [--base BRANCH]
  pages-site.mjs finalize --site DIR [--keep 30] [--run-url URL] [--history-slot SLOT] [--base BRANCH]
  pages-site.mjs sanitize-branch NAME
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = { _: [] };
  const repeatable = new Set(["prev"]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        out[key] = true;
      } else if (repeatable.has(key)) {
        if (!Array.isArray(out[key])) out[key] = [];
        out[key].push(next);
        i++;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(arg);
    }
  }
  return out;
}

function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function hasIndex(path) {
  return existsSync(join(path, "index.html"));
}

/** URL-safe branch folder name. */
function sanitizeBranch(name) {
  let base = String(name || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
  if (!base) base = "branch";
  if (RESERVED_TOP.has(base) || /^\d+$/.test(base)) {
    base = `b-${base}`;
  }
  return base;
}

function rootOf(site, base) {
  const siteDir = resolve(site);
  if (!base) return siteDir;
  const safe = sanitizeBranch(base);
  return join(siteDir, safe);
}

function listReportNames(treeRoot) {
  if (!isDir(treeRoot)) return [];
  return readdirSync(treeRoot)
    .filter((name) => name !== "index.html")
    .filter((name) => looksLikeReport(join(treeRoot, name)))
    .sort();
}

function looksLikeReport(dir) {
  if (!isDir(dir)) return false;
  return hasIndex(join(dir, "latest")) || listHistorySlots(dir).length > 0;
}

/** History slots are decimal unix timestamps (URL-safe, sortable). */
function listHistorySlots(reportDir) {
  if (!isDir(reportDir)) return [];
  return readdirSync(reportDir)
    .filter((name) => /^\d+$/.test(name) && isDir(join(reportDir, name)))
    .sort((a, b) => Number(b) - Number(a));
}

function listBranchPreviews(siteDir) {
  if (!isDir(siteDir)) return [];
  return readdirSync(siteDir)
    .filter((name) => !RESERVED_TOP.has(name))
    .filter((name) => !/^\d+$/.test(name))
    .filter((name) => {
      const dir = join(siteDir, name);
      if (!isDir(dir) || looksLikeReport(dir)) return false;
      return hasIndex(dir) || listReportNames(dir).length > 0;
    })
    .sort();
}

/** Older publishes used /allure/index.html instead of /allure/latest/. */
function migrateLegacyReports(siteDir) {
  for (const report of ["allure", "playwright"]) {
    const reportDir = join(siteDir, report);
    const latestDir = join(reportDir, "latest");
    if (!hasIndex(reportDir) || hasIndex(latestDir)) continue;

    const staging = join(siteDir, `.migrate-${report}`);
    rmSync(staging, { recursive: true, force: true });
    cpSync(reportDir, staging, { recursive: true });
    rmSync(reportDir, { recursive: true, force: true });
    mkdirSync(latestDir, { recursive: true });
    cpSync(staging, latestDir, { recursive: true });
    rmSync(staging, { recursive: true, force: true });
    console.log(`Migrated legacy /${report}/ → /${report}/latest/`);
  }
}

function prepare(args) {
  const siteDir = resolve(args.site);
  rmSync(siteDir, { recursive: true, force: true });
  mkdirSync(siteDir, { recursive: true });

  // `--prev` may be repeated; later trees overlay earlier ones (branch on top of main).
  const prevs = []
    .concat(args.prev || [])
    .flat()
    .filter(Boolean);

  // parseArgs only keeps the last --prev; also accept comma-separated --prev a,b
  const expanded = [];
  for (const prev of prevs) {
    for (const part of String(prev).split(",")) {
      const trimmed = part.trim();
      if (trimmed) expanded.push(trimmed);
    }
  }

  for (const prev of expanded) {
    if (!isDir(prev)) continue;
    cpSync(resolve(prev), siteDir, { recursive: true });
    console.log(`Merged prev ${resolve(prev)}`);
  }

  migrateLegacyReports(siteDir);
  console.log(`Prepared ${siteDir}`);
}

function publish({ site, report, source, slots, base = "" }) {
  if (!site || !report || !source || !slots) usage();
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(report)) {
    throw new Error(`Invalid report name: ${report}`);
  }

  const treeRoot = rootOf(site, base);
  const sourceDir = resolve(source);
  const slotList = String(slots)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!slotList.length) {
    throw new Error("At least one --slots value is required");
  }
  for (const slot of slotList) {
    if (slot !== "latest" && !/^\d+$/.test(slot)) {
      throw new Error(
        `Invalid slot "${slot}" (use "latest" or a unix timestamp)`,
      );
    }
  }

  if (!hasIndex(sourceDir)) {
    console.log(`Skip ${report}: no index.html in ${sourceDir}`);
    return;
  }

  const prefix = base ? `${sanitizeBranch(base)}/` : "";
  mkdirSync(treeRoot, { recursive: true });
  for (const slot of slotList) {
    const dest = join(treeRoot, report, slot);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(join(treeRoot, report), { recursive: true });
    cpSync(sourceDir, dest, { recursive: true });
    console.log(`Published ${report} → ${prefix}${report}/${slot}/`);
  }
}

function pruneHistory(reportDir, keep) {
  const slots = listHistorySlots(reportDir);
  for (const slot of slots.slice(keep)) {
    rmSync(join(reportDir, slot), { recursive: true, force: true });
  }
}

function formatSlot(slot) {
  const ms = Number(slot) * 1000;
  if (!Number.isFinite(ms)) return slot;
  return `${new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z")} (${slot})`;
}

const LABELS = {
  allure: "Integration (Allure)",
  playwright: "End-to-end (Playwright)",
  redoc: "API (Redoc)",
};

function writeTreeIndex(treeRoot, {
  keepN,
  runUrl,
  historySlot,
  title,
  pathPrefix,
  branchPreviews = [],
}) {
  const reports = listReportNames(treeRoot);
  for (const report of reports) {
    pruneHistory(join(treeRoot, report), keepN);
  }

  const latestItems = [];
  for (const report of reports) {
    if (hasIndex(join(treeRoot, report, "latest"))) {
      const label = LABELS[report] || report;
      latestItems.push(
        `<li><a href="./${report}/latest/">${label}</a> — <code>${pathPrefix}${report}/latest/</code></li>`,
      );
    }
  }
  if (!latestItems.length) {
    latestItems.push("<li>No HTML reports were produced for this run.</li>");
  }

  const slotSet = new Set();
  for (const report of reports) {
    for (const slot of listHistorySlots(join(treeRoot, report))) {
      slotSet.add(slot);
    }
  }
  const historySlots = [...slotSet].sort((a, b) => Number(b) - Number(a));

  const historyItems = historySlots.map((slot) => {
    const links = [];
    for (const report of reports) {
      if (hasIndex(join(treeRoot, report, slot))) {
        const label = LABELS[report] || report;
        links.push(`<a href="./${report}/${slot}/">${label}</a>`);
      }
    }
    const mark = slot === String(historySlot) ? " (this run)" : "";
    return `<li><code>${formatSlot(slot)}</code>${mark}${
      links.length ? ` — ${links.join(" · ")}` : ""
    }</li>`;
  });

  const branchSection = branchPreviews.length
    ? `
  <h2>Branch previews</h2>
  <ul>
    ${branchPreviews
      .map(
        (name) =>
          `<li><a href="./${name}/"><code>${name}</code></a></li>`,
      )
      .join("\n    ")}
  </ul>`
    : "";

  mkdirSync(treeRoot, { recursive: true });
  writeFileSync(
    join(treeRoot, "index.html"),
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font: 16px/1.5 system-ui, sans-serif; margin: 2rem; color: #111; max-width: 48rem; }
    a { color: #0969da; }
    li { margin: 0.5rem 0; }
    code { font-size: 0.95em; }
    h2 { margin-top: 2rem; font-size: 1.15rem; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Paths are <code>${pathPrefix}&lt;report&gt;/&lt;slot&gt;/</code> where <code>slot</code> is <code>latest</code> or a unix timestamp. History keeps the last ${keepN} timestamps per report.</p>
  ${runUrl ? `<p>This publish: <a href="${runUrl}">workflow run</a>.</p>` : ""}
  ${pathPrefix !== "/" ? `<p><a href="../">← All reports</a></p>` : ""}
  <h2>Latest</h2>
  <ul>
    ${latestItems.join("\n    ")}
  </ul>
  <h2>History</h2>
  <ul>
    ${historyItems.length ? historyItems.join("\n    ") : "<li>No previous runs yet.</li>"}
  </ul>${branchSection}
</body>
</html>
`,
  );

  return reports.length;
}

function finalize({
  site,
  keep = "30",
  "run-url": runUrl = "",
  "history-slot": historySlot = "",
  base = "",
}) {
  const siteDir = resolve(site);
  const keepN = Number(keep);
  if (!Number.isFinite(keepN) || keepN < 1) {
    throw new Error(`Invalid --keep value: ${keep}`);
  }

  const treeRoot = rootOf(site, base);
  const safeBase = base ? sanitizeBranch(base) : "";
  const pathPrefix = safeBase ? `/${safeBase}/` : "/";
  const title = safeBase
    ? `Todo App test reports — ${safeBase}`
    : "Todo App test reports";

  // Drop stale index under this tree before rewrite
  rmSync(join(treeRoot, "index.html"), { force: true });

  const count = writeTreeIndex(treeRoot, {
    keepN,
    runUrl: safeBase ? runUrl : runUrl,
    historySlot,
    title,
    pathPrefix,
    branchPreviews: [],
  });
  console.log(`Finalized ${pathPrefix} (${count} report(s))`);

  // Always refresh the site root index so branch previews are linked.
  const previews = listBranchPreviews(siteDir);
  writeTreeIndex(siteDir, {
    keepN,
    runUrl: safeBase ? "" : runUrl,
    historySlot: safeBase ? "" : historySlot,
    title: "Todo App test reports",
    pathPrefix: "/",
    branchPreviews: previews,
  });
  console.log(`Refreshed site root (${previews.length} branch preview(s))`);
}

const args = parseArgs(process.argv.slice(2));
const [command, maybeName] = args._;

try {
  switch (command) {
    case "prepare":
      if (!args.site) usage();
      prepare(args);
      break;
    case "publish":
      publish(args);
      break;
    case "finalize":
      if (!args.site) usage();
      finalize(args);
      break;
    case "sanitize-branch": {
      const name = maybeName || args.name;
      if (!name) usage();
      process.stdout.write(`${sanitizeBranch(name)}\n`);
      break;
    }
    case "help":
    case undefined:
      usage(command === "help" ? 0 : 1);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      usage();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
