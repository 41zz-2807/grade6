#!/usr/bin/env node
// Reads a credential pair from the credential file and prints the value.
// Supports both "key : value" and "KEY=value" lines.
// Usage: node scripts/parse-credential.js <cred-file> <key>
const fs = require("node:fs");

const [, , file, key] = process.argv;
if (!file || !key) {
  console.error("usage: parse-credential.js <cred-file> <key>");
  process.exit(1);
}

const want = key.toLowerCase();
const text = fs.readFileSync(file, "utf8");

for (const line of text.split(/\r?\n/)) {
  const sep = line.search(/[:=]/);
  if (sep === -1) continue;
  if (line.slice(0, sep).trim().toLowerCase() !== want) continue;
  // Buang tanda kutip pembungkus supaya nilai dari .env (KEY="value")
  // tidak ter-quote dua kali kalau dipakai ulang.
  process.stdout.write(line.slice(sep + 1).trim().replace(/^(["'])(.*)\1$/, "$2"));
  process.exit(0);
}

process.exit(0);
