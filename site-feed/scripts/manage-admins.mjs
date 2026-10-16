#!/usr/bin/env node
// Interactive script for the server operator to view and prune site-feed
// admin accounts. Deleting an account must be run as the identity baked
// into SITE_FEED_OWNER_IDENTITY — the delete_admin_account reducer rejects
// anyone else.

import { execFileSync } from "node:child_process";
import { select, input } from "@inquirer/prompts";

const DB_NAME = process.env.SITE_FEED_DB || "site-feed";

function runSpacetime(args) {
  return execFileSync("spacetime", args, { encoding: "utf8" });
}

// Parses the ASCII-table output of `spacetime sql`, e.g.:
//   username    | created_at
//  -------------+-------------------
//   "testadmin" | 1788822235214586
function parseSqlTable(output) {
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("WARNING"));

  if (lines.length === 0) return { columns: [], rows: [] };

  const columns = lines[0].split("|").map((c) => c.trim());
  const dataLines = lines.slice(1).filter((line) => !/^[-+\s]+$/.test(line));

  const rows = dataLines.map((line) => {
    const cells = line.split("|").map((c) => {
      const trimmed = c.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
        return trimmed.slice(1, -1);
      }
      return trimmed;
    });
    const row = {};
    columns.forEach((col, i) => {
      row[col] = cells[i];
    });
    return row;
  });

  return { columns, rows };
}

function formatTimestamp(microsString) {
  try {
    const micros = BigInt(microsString);
    return new Date(Number(micros / 1000n)).toLocaleString();
  } catch {
    return microsString;
  }
}

function listAdmins() {
  const output = runSpacetime([
    "sql",
    DB_NAME,
    "SELECT username, created_at FROM accounts WHERE is_admin = true",
    "-y",
  ]);
  return parseSqlTable(output).rows;
}

async function main() {
  console.log(`Site Feed admin accounts (database: ${DB_NAME})\n`);

  let admins;
  try {
    admins = listAdmins();
  } catch (err) {
    console.error("Failed to query admin accounts:");
    console.error((err.stderr || err.message || String(err)).toString().trim());
    process.exit(1);
  }

  if (admins.length === 0) {
    console.log("No admin accounts exist yet. Use add-admin.mjs to create one.");
    return;
  }

  const target = await select({
    message: "Select an admin to delete (Ctrl+C to exit without changes):",
    choices: admins.map((admin) => ({
      name: `${admin.username}  (created ${formatTimestamp(admin.created_at)})`,
      value: admin,
    })),
  });

  const confirmation = await input({
    message: `Type '${target.username}' to confirm deleting this admin account:`,
  });

  if (confirmation.trim() !== target.username) {
    console.log("Confirmation did not match. No changes made.");
    return;
  }

  try {
    runSpacetime(["call", DB_NAME, "delete_admin_account", JSON.stringify(target.username)]);
    console.log(`\nDeleted admin account '${target.username}'.`);
  } catch (err) {
    console.error("\nFailed to delete admin account:");
    console.error((err.stderr || err.message || String(err)).toString().trim());
    process.exit(1);
  }
}

main();
