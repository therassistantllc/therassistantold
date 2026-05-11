import { NextResponse } from "next/server";
import { postEra835Batch } from "@/lib/payments/era835PostingService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.organizationId || !body.eraImportBatchId) {
      return NextResponse.json(
        { success: false, error: "organizationId and eraImportBatchId are required" },
        { status: 400 },
      );
    }

    const result = await postEra835Batch({
      organizationId: String(body.organizationId),
      eraImportBatchId: String(body.eraImportBatchId),
    });

    return NextResponse.json({ success: result.ok, result }, { status: result.ok ? 200 : 422 });
  } catch (error) {
    console.error("ERA 835 posting API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "ERA 835 posting failed" },
      { status: 500 },
    );
  }
}
