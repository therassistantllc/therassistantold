/**
 * Minimal cover-letter PDF generator.
 *
 * Produces a valid single-page PDF (1.4) using the built-in Helvetica /
 * Helvetica-Bold fonts so we don't need any external dependencies. The output
 * is uploaded to Supabase storage as the cover letter that accompanies a
 * medical-review documentation submission.
 *
 * Layout: US-Letter (612 x 792 pt), 1" (72pt) margins, 11pt body, 14pt H1.
 * Long lines are wrapped on word boundaries using a conservative average-
 * character-width estimate (good enough for a single-page letter; we are not
 * aiming for typographic perfection).
 */

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 72;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 72;
const BODY_FONT_SIZE = 11;
const BODY_LINE_HEIGHT = 14;
const H1_FONT_SIZE = 18;
const H2_FONT_SIZE = 13;
const USABLE_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

// Helvetica ~ 0.5 * font-size avg character width; conservative for wrapping.
const AVG_CHAR_WIDTH_RATIO = 0.5;

export interface CoverLetterAttachment {
  title: string;
  description?: string | null;
}

export interface CoverLetterInput {
  organizationName: string;
  organizationAddress?: string | null;
  organizationPhone?: string | null;
  organizationEmail?: string | null;
  payerName: string;
  payerAttention?: string | null;
  clientName: string;
  clientDob?: string | null;
  memberId?: string | null;
  claimNumber: string;
  dateOfService?: string | null;
  providerName?: string | null;
  totalCharge?: number | null;
  requestReference?: string | null;
  attachments: CoverLetterAttachment[];
  notes?: string | null;
  generatedAt: Date;
}

// PDF text strings allow only printable ASCII with `\`, `(`, `)` escaped.
function escapePdfText(input: string): string {
  return input
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapWords(text: string, fontSize: number, maxWidth: number): string[] {
  const charsPerLine = Math.max(20, Math.floor(maxWidth / (fontSize * AVG_CHAR_WIDTH_RATIO)));
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (para.trim() === "") {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let current = "";
    for (const w of words) {
      const trial = current ? current + " " + w : w;
      if (trial.length > charsPerLine && current) {
        lines.push(current);
        current = w;
      } else {
        current = trial;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

interface Cursor {
  y: number;
  ops: string[];
}

function setFont(c: Cursor, font: "F1" | "F2", size: number) {
  c.ops.push(`/${font} ${size} Tf`);
}

function drawLine(c: Cursor, text: string, size: number) {
  c.ops.push("BT");
  c.ops.push(`1 0 0 1 ${MARGIN_X} ${c.y} Tm`);
  c.ops.push(`(${escapePdfText(text)}) Tj`);
  c.ops.push("ET");
  c.y -= size + 2;
}

function blank(c: Cursor, amount = BODY_LINE_HEIGHT) {
  c.y -= amount;
}

function writeParagraph(c: Cursor, text: string, opts?: { bold?: boolean; size?: number }) {
  const size = opts?.size ?? BODY_FONT_SIZE;
  setFont(c, opts?.bold ? "F2" : "F1", size);
  const lines = wrapWords(text, size, USABLE_WIDTH);
  for (const line of lines) {
    if (c.y < MARGIN_BOTTOM) break;
    if (line === "") {
      blank(c, size);
    } else {
      drawLine(c, line, size);
    }
  }
}

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function buildContentStream(input: CoverLetterInput): string {
  const c: Cursor = { y: PAGE_HEIGHT - MARGIN_TOP, ops: [] };

  // Letterhead
  setFont(c, "F2", H1_FONT_SIZE);
  drawLine(c, input.organizationName, H1_FONT_SIZE);
  if (input.organizationAddress) {
    setFont(c, "F1", BODY_FONT_SIZE);
    for (const line of input.organizationAddress.split(/\r?\n/)) {
      drawLine(c, line, BODY_FONT_SIZE);
    }
  }
  const contactLine = [input.organizationPhone, input.organizationEmail]
    .filter((v): v is string => Boolean(v && v.trim()))
    .join("  |  ");
  if (contactLine) {
    setFont(c, "F1", BODY_FONT_SIZE);
    drawLine(c, contactLine, BODY_FONT_SIZE);
  }
  blank(c);

  // Date
  setFont(c, "F1", BODY_FONT_SIZE);
  drawLine(c, input.generatedAt.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  }), BODY_FONT_SIZE);
  blank(c);

  // Recipient
  setFont(c, "F2", BODY_FONT_SIZE);
  drawLine(c, input.payerName, BODY_FONT_SIZE);
  setFont(c, "F1", BODY_FONT_SIZE);
  drawLine(c, input.payerAttention || "Attn: Claims / Medical Review", BODY_FONT_SIZE);
  blank(c);

  // Subject line
  setFont(c, "F2", H2_FONT_SIZE);
  drawLine(c, `RE: Documentation submission for claim ${input.claimNumber}`, H2_FONT_SIZE);
  blank(c, 6);

  // Claim summary table (label / value pairs rendered as plain text)
  const rows: Array<[string, string]> = [];
  rows.push(["Member", input.clientName]);
  if (input.memberId) rows.push(["Member ID", input.memberId]);
  if (input.clientDob) rows.push(["Date of birth", formatDate(input.clientDob) ?? input.clientDob]);
  rows.push(["Claim number", input.claimNumber]);
  if (input.dateOfService) {
    rows.push(["Date of service", formatDate(input.dateOfService) ?? input.dateOfService]);
  }
  if (input.providerName) rows.push(["Rendering provider", input.providerName]);
  if (typeof input.totalCharge === "number" && input.totalCharge > 0) {
    rows.push(["Billed amount", formatCurrency(input.totalCharge)]);
  }
  if (input.requestReference) rows.push(["Payer request", input.requestReference]);

  setFont(c, "F1", BODY_FONT_SIZE);
  for (const [label, value] of rows) {
    if (c.y < MARGIN_BOTTOM) break;
    // Label in bold, then value on the same baseline.
    c.ops.push("BT");
    c.ops.push(`1 0 0 1 ${MARGIN_X} ${c.y} Tm`);
    c.ops.push(`/F2 ${BODY_FONT_SIZE} Tf`);
    c.ops.push(`(${escapePdfText(label + ":")}) Tj`);
    c.ops.push(`/F1 ${BODY_FONT_SIZE} Tf`);
    // Tab to a fixed offset (140 pt) and write the value.
    c.ops.push(`1 0 0 1 ${MARGIN_X + 140} ${c.y} Tm`);
    c.ops.push(`(${escapePdfText(value)}) Tj`);
    c.ops.push("ET");
    c.y -= BODY_LINE_HEIGHT;
  }
  blank(c);

  // Body paragraph
  const intro =
    `Please find enclosed the supporting documentation requested for the claim ` +
    `referenced above. The materials listed below substantiate the medical ` +
    `necessity, dates of service, and clinical findings for ${input.clientName}.`;
  writeParagraph(c, intro);
  blank(c);

  // Attachments
  setFont(c, "F2", H2_FONT_SIZE);
  drawLine(c, "Enclosed documents", H2_FONT_SIZE);
  setFont(c, "F1", BODY_FONT_SIZE);
  if (input.attachments.length === 0) {
    drawLine(c, "  - (No supporting documents are attached.)", BODY_FONT_SIZE);
  } else {
    let idx = 1;
    for (const att of input.attachments) {
      if (c.y < MARGIN_BOTTOM) break;
      const label = `  ${idx}. ${att.title}`;
      drawLine(c, label, BODY_FONT_SIZE);
      if (att.description) {
        for (const line of wrapWords(att.description, BODY_FONT_SIZE, USABLE_WIDTH - 24)) {
          if (c.y < MARGIN_BOTTOM) break;
          drawLine(c, `       ${line}`, BODY_FONT_SIZE);
        }
      }
      idx += 1;
    }
  }
  blank(c);

  if (input.notes && input.notes.trim()) {
    setFont(c, "F2", H2_FONT_SIZE);
    drawLine(c, "Notes", H2_FONT_SIZE);
    writeParagraph(c, input.notes.trim());
    blank(c);
  }

  // Closing
  writeParagraph(c,
    "If anything further is required to adjudicate this claim, please contact " +
    "our billing office using the information at the top of this letter.");
  blank(c);
  setFont(c, "F1", BODY_FONT_SIZE);
  drawLine(c, "Sincerely,", BODY_FONT_SIZE);
  blank(c, 28);
  drawLine(c, input.organizationName + " Billing", BODY_FONT_SIZE);

  return c.ops.join("\n");
}

/**
 * Build a single-page PDF. Returns a Uint8Array containing a valid PDF/1.4
 * document with cross-reference table and trailer.
 */
export function generateCoverLetterPdf(input: CoverLetterInput): Uint8Array {
  const content = buildContentStream(input);

  // PDF objects (1-indexed). Object 0 is the free head and is implied.
  const contentStream =
    `<< /Length ${Buffer.byteLength(content, "binary")} >>\n` +
    `stream\n${content}\nendstream`;

  const objects: string[] = [
    // 1: Catalog
    "<< /Type /Catalog /Pages 2 0 R >>",
    // 2: Pages
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    // 3: Page
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    // 4: Page content stream
    contentStream,
    // 5: Helvetica
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    // 6: Helvetica-Bold
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];

  // Serialize with byte offsets for the xref table.
  const header = "%PDF-1.4\n%\xC4\xE5\xF2\xE5\xEB\xA7\xF3\xA0\xD0\xC4\xC6\n";
  const chunks: Buffer[] = [Buffer.from(header, "binary")];
  const offsets: number[] = [];
  let position = chunks[0].length;

  objects.forEach((body, idx) => {
    const objNum = idx + 1;
    const objStr = `${objNum} 0 obj\n${body}\nendobj\n`;
    const buf = Buffer.from(objStr, "binary");
    offsets.push(position);
    chunks.push(buf);
    position += buf.length;
  });

  const xrefStart = position;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (const off of offsets) {
    xref += off.toString().padStart(10, "0") + " 00000 n \n";
  }
  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(Buffer.from(xref + trailer, "binary"));

  return new Uint8Array(Buffer.concat(chunks));
}
