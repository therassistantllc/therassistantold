#!/usr/bin/env tsx

import { spawnSync } from "node:child_process";

const commands = [
  ["npm", ["run", "check:migrations"]],
  ["npm", ["run", "test:client-import"]],
  ["npm", ["run", "test:eligibility"]],
  ["npm", ["run", "test:claim-readiness"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "lint"]],
] as const;

function runCommand(command: string, args: readonly string[]): void {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, [...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

try {
  for (const [command, args] of commands) {
    runCommand(command, args);
  }

  console.log("\nAll backend smoke checks passed.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nSmoke checks failed: ${message}`);
  process.exit(1);
}
