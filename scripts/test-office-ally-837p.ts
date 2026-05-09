import { sample837pInput } from "@/lib/edi/officeAlly837p/__fixtures__/sample837pInput";
import { generateOfficeAlly837PBatch } from "@/lib/edi/officeAlly837p/generate837p";
import { validateOfficeAlly837PClaim } from "@/lib/edi/officeAlly837p/validate837p";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const validation = validateOfficeAlly837PClaim(sample837pInput);
  assert(validation.isValid, `Fixture should validate cleanly: ${JSON.stringify(validation.errors)}`);

  const batch = generateOfficeAlly837PBatch(sample837pInput);

  assert(batch.fileName.includes("OATEST"), "Test-mode file name must include OATEST");
  assert(batch.fileContent.includes("OFFICEALLY"), "Generated file must include OFFICEALLY");
  assert(batch.fileContent.includes("330897513"), "Generated file must include receiver id 330897513");
  assert(batch.fileContent.includes("005010X222A1"), "Generated file must include 005010X222A1");

  const poBoxInput = {
    ...sample837pInput,
    parties: {
      ...sample837pInput.parties,
      billing_provider_address1: "P.O. Box 400",
    },
  };

  const poBoxValidation = validateOfficeAlly837PClaim(poBoxInput);
  assert(!poBoxValidation.isValid, "PO Box billing address must fail validation");
  assert(
    poBoxValidation.errors.some((error) => error.field === "parties.billing_provider_address1"),
    "PO Box failure must target billing_provider_address1",
  );

  console.log("Office Ally 837P foundation smoke test passed.");
  console.log(`Generated file: ${batch.fileName}`);
}

run();
