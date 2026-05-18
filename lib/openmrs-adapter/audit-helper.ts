#!/usr/bin/env node

/**
 * OpenMRS Module Audit Helper
 * 
 * Usage:
 *   npx tsx lib/openmrs-adapter/audit-helper.ts --module esm-home-app
 *   npx tsx lib/openmrs-adapter/audit-helper.ts --list-all
 *   npx tsx lib/openmrs-adapter/audit-helper.ts --fetch-npm @openmrs/esm-home-app
 */

import { HIGH_PRIORITY_MODULES } from "./audit-types";

interface NPMPackageInfo {
  name: string;
  version: string;
  description?: string;
  repository?: { type: string; url: string };
  keywords?: string[];
  size?: number;
  downloads?: number;
  time?: Record<string, string>;
}

interface GitHubRepoInfo {
  owner: string;
  repo: string;
  description?: string;
  stars?: number;
  lastPush?: string;
  size?: number;
}

/**
 * Fetch npm package info
 */
async function fetchNPMInfo(packageName: string): Promise<NPMPackageInfo | null> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      name: string;
      "dist-tags": { latest: string };
      versions: Record<
        string,
        {
          dist: { tarball: string; unpackedSize?: number };
          description?: string;
          repository?: { type: string; url: string };
          keywords?: string[];
        }
      >;
    };

    const latestVersion = data["dist-tags"].latest;
    const latestVersionData = data.versions[latestVersion];

    return {
      name: data.name,
      version: latestVersion,
      description: latestVersionData?.description,
      repository: latestVersionData?.repository,
      keywords: latestVersionData?.keywords,
      size: latestVersionData?.dist?.unpackedSize,
    };
  } catch (error) {
    console.error(`Failed to fetch npm info for ${packageName}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Check if package is available and its distribution format
 */
async function checkPackageAvailability(packageName: string): Promise<{
  available: boolean;
  hasESM: boolean;
  hasUMD: boolean;
  types: boolean;
}> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    if (!response.ok) {
      return { available: false, hasESM: false, hasUMD: false, types: false };
    }

    const data = (await response.json()) as {
      "dist-tags": { latest: string };
      versions: Record<
        string,
        {
          exports?: Record<string, string>;
          main?: string;
          module?: string;
          types?: string;
        }
      >;
    };

    const latestVersion = data["dist-tags"].latest;
    const latestVersionData = data.versions[latestVersion];

    const hasESM = !!(latestVersionData?.module || latestVersionData?.exports?.["."]);
    const hasUMD = !!(latestVersionData?.main && latestVersionData.main.includes("umd"));
    const types = !!latestVersionData?.types;

    return {
      available: true,
      hasESM,
      hasUMD,
      types,
    };
  } catch {
    return { available: false, hasESM: false, hasUMD: false, types: false };
  }
}

/**
 * Format package info for display
 */
function formatPackageInfo(info: NPMPackageInfo | null): string {
  if (!info) {
    return "NOT FOUND";
  }

  const sizeKB = info.size ? (info.size / 1024).toFixed(1) : "unknown";
  return `
    Name:        ${info.name}
    Version:     ${info.version}
    Size:        ${sizeKB} KB
    Repository:  ${info.repository?.url || "N/A"}
    Keywords:    ${(info.keywords || []).join(", ") || "N/A"}
  `.trim();
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--list-all") || args.includes("-l")) {
    console.log("High Priority OpenMRS Modules:\n");
    HIGH_PRIORITY_MODULES.forEach((mod) => {
      console.log(`${mod.priority === 0 ? "[CRITICAL]" : "[HIGH]"} ${mod.name}`);
      console.log(`  GitHub:  ${mod.githubRepo}`);
      console.log(`  NPM:     ${mod.npmPackage}`);
      console.log(`  Context: ${mod.therassistantContext}`);
      console.log("");
    });
  } else if (args.includes("--fetch-npm")) {
    const moduleIdx = args.indexOf("--fetch-npm");
    const packageName = args[moduleIdx + 1];

    if (!packageName) {
      console.error("Usage: --fetch-npm <package-name>");
      process.exit(1);
    }

    console.log(`Fetching npm info for ${packageName}...\n`);
    const info = await fetchNPMInfo(packageName);
    console.log(formatPackageInfo(info));

    console.log("\nChecking distribution formats...\n");
    const availability = await checkPackageAvailability(packageName);
    console.log(
      `  ESM Build:        ${availability.hasESM ? "✓" : "✗"}`,
    );
    console.log(`  UMD Build:        ${availability.hasUMD ? "✓" : "✗"}`);
    console.log(`  TypeScript Types: ${availability.types ? "✓" : "✗"}`);
  } else if (args.includes("--help") || args.includes("-h")) {
    console.log(`
OpenMRS Module Audit Helper

Usage:
  npx tsx lib/openmrs-adapter/audit-helper.ts [command] [options]

Commands:
  --list-all                 List all priority modules
  --fetch-npm <package>      Fetch npm registry info
  --check <module-name>      Quick compatibility check
  --help                     Show this help

Examples:
  npx tsx lib/openmrs-adapter/audit-helper.ts --list-all
  npx tsx lib/openmrs-adapter/audit-helper.ts --fetch-npm @openmrs/esm-home-app
    `);
  } else {
    console.log("OpenMRS Module Audit Helper");
    console.log("Run with --help for usage information");
  }
}

main().catch((error) => {
  console.error("Error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
