import { NextResponse } from "next/server";
import { intakeEra835 } from "@/lib/payments/era835IntakeService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.organizationId || !body.rawContent) {
      return NextResponse.json(
        { success: false, error: "organizationId and rawContent are required" },
        { status: 400 },
      );
    }

    const result = await intakeEra835({
      organizationId: String(body.organizationId),
      rawContent: String(body.rawContent),
      fileName: body.fileName ?? null,
      source: body.source ?? "manual_upload",
    });

    return NextResponse.json({ success: result.ok, result }, { status: result.ok ? 200 : 422 });
  } catch (error) {
    console.error("ERA 835 intake API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "ERA 835 intake failed" },
      { status: 500 },
    );
  }
}
