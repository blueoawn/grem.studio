#!/usr/bin/env node
// Interactive script for the server operator to create a new site-feed admin
// account. Must be run as the identity baked into SITE_FEED_OWNER_IDENTITY
// (your `spacetime login show` identity, unless you published with a
// different one) — the create_admin_account reducer rejects anyone else.

import { execFileSync } from "node:child_process";
import { input, password } from "@inquirer/prompts";

const DB_NAME = process.env.SITE_FEED_DB || "site-feed";

function validateUsername(value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 32) return "Username must be 1-32 characters";
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return "Username may only contain letters, digits, and underscores";
  }
  return true;
}

function validatePassword(value) {
  if (value.length < 12) return "Password must be at least 12 characters";
  if (value.length > 72) return "Password too long (max 72 characters)";
  return true;
}

async function main() {
  console.log(`Add a new site-feed admin account (database: ${DB_NAME})`);
  console.log(
    "This must be run as the operator identity baked into SITE_FEED_OWNER_IDENTITY.\n"
  );

  const username = (
    await input({ message: "Username:", validate: validateUsername })
  ).trim();

  const passwordValue = await password({
    message: "Password:",
    mask: true,
    validate: validatePassword,
  });

  const confirmPassword = await password({ message: "Confirm password:", mask: true });
  if (confirmPassword !== passwordValue) {
    console.error("\nError: Passwords do not match");
    process.exit(1);
  }

  try {
    const output = execFileSync(
      "spacetime",
      ["call", DB_NAME, "create_admin_account", JSON.stringify(username), JSON.stringify(passwordValue)],
      { encoding: "utf8" }
    );
    if (output.trim()) console.log(output.trim());
    console.log(`\nAdmin account '${username}' created successfully.`);
  } catch (err) {
    console.error("\nFailed to create admin account:");
    console.error((err.stderr || err.message || String(err)).toString().trim());
    process.exit(1);
  }
}

main();
