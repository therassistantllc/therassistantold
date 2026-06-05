#!/usr/bin/env tsx

type RouteExpectation = {
  label: string;
  path: string;
  expectedExports: string[];
};

const routes: RouteExpectation[] = [
  {
    label: "Professional claim readiness API",
    path: "../app/api/claims/readiness/route",
    expectedExports: ["POST"],
  },
  {
    label: "837P batch API",
    path: "../app/api/claims/837p/batch/route",
    expectedExports: ["POST"],
  },
  {
    label: "837P submission API",
    path: "../app/api/claims/837p/submit/route",
    expectedExports: ["POST"],
  },
  {
    label: "999 acknowledgement API",
    path: "../app/api/claims/acknowledgements/999/route",
    expectedExports: ["POST"],
  },
  {
    label: "277CA acknowledgement API",
    path: "../app/api/claims/acknowledgements/277ca/route",
    expectedExports: ["POST"],
  },
  {
    label: "Claim aging workqueue API",
    path: "../app/api/workqueue/claim-aging/route",
    expectedExports: ["POST"],
  },
  {
    label: "Billing workflow dashboard API",
    path: "../app/api/billing/workflow-dashboard/route",
    expectedExports: ["GET"],
  },
  {
    label: "Billing payment claim search API",
    path: "../app/api/billing/payments/claim-search/route",
    expectedExports: ["GET"],
  },
  {
    label: "Billing ERA payment batch detail API",
    path: "../app/api/billing/payments/era-batches/route",
    expectedExports: ["GET"],
  },
  {
    label: "Billing ERA payment manual match API",
    path: "../app/api/billing/payments/era-match/route",
    expectedExports: ["POST"],
  },
  {
    label: "Billing posted payments API",
    path: "../app/api/billing/payments/posted/route",
    expectedExports: ["GET"],
  },
];

async function main() {
  const failures: string[] = [];

  for (const route of routes) {
    try {
      const routeModule = await import(route.path);
      for (const exportName of route.expectedExports) {
        if (typeof routeModule[exportName] !== "function") {
          failures.push(`${route.label} is missing function export ${exportName}`);
        }
      }
    } catch (error) {
      failures.push(`${route.label} failed to import: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failures.length > 0) {
    console.error("Billing API route export smoke test failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("Billing API route export smoke test completed.");
  console.log(JSON.stringify({ routesChecked: routes.length, routes }, null, 2));
  console.log("Assertions passed.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
