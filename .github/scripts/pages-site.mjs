#!/usr/bin/env node
/**
 * Maintain the GitHub Pages report site tree:
 *
 *   report-site/<report>/<slot>/
 *
 * Slots are typically `latest` (overwritten) or a URL-safe unix timestamp.
 *
 * Commands:
 *   prepare  --site DIR [--prev DIR]
 *   publish  --site DIR --report NAME --source DIR --slots SLOT[,SLOT...]
 *   finalize --site DIR [--keep N] [--run-url URL] [--history-slot SLOT]
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

const RESERVED = new Set(["index.html"]);

function usage(exitCode = 1) {
  console.error(`Usage:
  pages-site.mjs prepare  --site DIR [--prev DIR]
  pages-site.mjs publish  --site DIR --report NAME --source DIR --slots SLOT[,SLOT...]
  pages-site.mjs finalize --site DIR [--keep 30] [--run-url URL] [--history-slot SLOT]
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        out[key] = true;
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

function listReportNames(site) {
  if (!isDir(site)) return [];
  return readdirSync(site)
    .filter((name) => !RESERVED.has(name))
    .filter((name) => isDir(join(site, name)))
    .sort();
}

/** History slots are decimal unix timestamps (URL-safe, sortable). */
function listHistorySlots(reportDir) {
  if (!isDir(reportDir)) return [];
  return readdirSync(reportDir)
    .filter((name) => /^\d+$/.test(name) && isDir(join(reportDir, name)))
    .sort((a, b) => Number(b) - Number(a));
}

function prepare({ site, prev }) {
  const siteDir = resolve(site);
  rmSync(siteDir, { recursive: true, force: true });
  mkdirSync(siteDir, { recursive: true });

  if (prev && isDir(prev)) {
    cpSync(resolve(prev), siteDir, { recursive: true });
    // Drop generated index; publish/finalize rebuild the tree for this run.
    rmSync(join(siteDir, "index.html"), { force: true });
  }

  console.log(`Prepared ${siteDir}`);
}

function publish({ site, report, source, slots }) {
  if (!site || !report || !source || !slots) usage();
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(report)) {
    throw new Error(`Invalid report name: ${report}`);
  }

  const siteDir = resolve(site);
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

  mkdirSync(siteDir, { recursive: true });
  for (const slot of slotList) {
    const dest = join(siteDir, report, slot);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(join(siteDir, report), { recursive: true });
    cpSync(sourceDir, dest, { recursive: true });
    console.log(`Published ${report} → ${report}/${slot}/`);
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

function finalize({ site, keep = "30", "run-url": runUrl = "", "history-slot": historySlot = "" }) {
  const siteDir = resolve(site);
  const keepN = Number(keep);
  if (!Number.isFinite(keepN) || keepN < 1) {
    throw new Error(`Invalid --keep value: ${keep}`);
  }

  mkdirSync(siteDir, { recursive: true });

  const reports = listReportNames(siteDir);
  for (const report of reports) {
    pruneHistory(join(siteDir, report), keepN);
  }

  const labels = {
    allure: "Integration (Allure)",
    playwright: "End-to-end (Playwright)",
  };

  const latestItems = [];
  for (const report of reports) {
    if (hasIndex(join(siteDir, report, "latest"))) {
      const label = labels[report] || report;
      latestItems.push(
        `<li><a href="./${report}/latest/">${label}</a> — <code>/${report}/latest/</code></li>`,
      );
    }
  }
  if (!latestItems.length) {
    latestItems.push("<li>No HTML reports were produced for this run.</li>");
  }

  // Union of history slots across reports, newest first
  const slotSet = new Set();
  for (const report of reports) {
    for (const slot of listHistorySlots(join(siteDir, report))) {
      slotSet.add(slot);
    }
  }
  const historySlots = [...slotSet].sort((a, b) => Number(b) - Number(a));

  const historyItems = historySlots.map((slot) => {
    const links = [];
    for (const report of reports) {
      if (hasIndex(join(siteDir, report, slot))) {
        const label = labels[report] || report;
        links.push(`<a href="./${report}/${slot}/">${label}</a>`);
      }
    }
    const mark = slot === String(historySlot) ? " (this run)" : "";
    return `<li><code>${formatSlot(slot)}</code>${mark}${
      links.length ? ` — ${links.join(" · ")}` : ""
    }</li>`;
  });

  writeFileSync(
    join(siteDir, "index.html"),
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Todo App test reports</title>
  <style>
    body { font: 16px/1.5 system-ui, sans-serif; margin: 2rem; color: #111; max-width: 48rem; }
    a { color: #0969da; }
    li { margin: 0.5rem 0; }
    code { font-size: 0.95em; }
    h2 { margin-top: 2rem; font-size: 1.15rem; }
  </style>
</head>
<body>
  <h1>Todo App test reports</h1>
  <p>Paths are <code>/&lt;report&gt;/&lt;slot&gt;/</code> where <code>slot</code> is <code>latest</code> or a unix timestamp. History keeps the last ${keepN} timestamps per report.</p>
  ${runUrl ? `<p>This publish: <a href="${runUrl}">workflow run</a>.</p>` : ""}
  <h2>Latest</h2>
  <ul>
    ${latestItems.join("\n    ")}
  </ul>
  <h2>History</h2>
  <ul>
    ${historyItems.length ? historyItems.join("\n    ") : "<li>No previous runs yet.</li>"}
  </ul>
</body>
</html>
`,
  );

  console.log(`Finalized index for ${reports.length} report(s)`);
}

const args = parseArgs(process.argv.slice(2));
const [command] = args._;

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
