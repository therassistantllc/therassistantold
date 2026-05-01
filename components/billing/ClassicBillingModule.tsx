import Link from "next/link";

type ReportPage =
  | "hub"
  | "submitClaims"
  | "insuranceAging"
  | "patientAging"
  | "revenue"
  | "noteCount"
  | "writeOffs"
  | "insurancePayment"
  | "transactions";

type BillingRow = {
  date: string;
  type: string;
  patient: string;
  payer: string;
  rate: string;
  client: string;
  insurance: string;
  status: string;
};

const transactions: BillingRow[] = [
  {
    date: "4/28/2026",
    type: "90837 Psychotherapy",
    patient: "Avery Morgan",
    payer: "Colorado Access",
    rate: "$165.00",
    client: "$0.00",
    insurance: "$165.00",
    status: "Ready to Submit",
  },
  {
    date: "4/27/2026",
    type: "90791 Intake",
    patient: "Sofia Martinez",
    payer: "Anthem Blue Cross",
    rate: "$185.00",
    client: "$25.00",
    insurance: "$160.00",
    status: "Pending Resubmit",
  },
  {
    date: "4/24/2026",
    type: "H0031 Medicaid Intake",
    patient: "Krystin Butler",
    payer: "Colorado Access",
    rate: "$260.00",
    client: "$0.00",
    insurance: "$260.00",
    status: "Submitted Claim",
  },
];

const agingRows = [
  ["Colorado Access", "$0.00", "$0.00", "$260.00", "$0.00", "$0.00", "$0.00", "$260.00"],
  ["Anthem Blue Cross", "$55.00", "$160.00", "$0.00", "$0.00", "$0.00", "$0.00", "$215.00"],
  ["Private Pay", "$25.00", "$0.00", "$260.00", "$0.00", "$0.00", "$0.00", "$285.00"],
];

const noteRows = [
  ["Krystin Butler", "Progress Note", "H0031", "Signed", "4/28/2026"],
  ["Avery Morgan", "Psychotherapy Progress Note", "90837", "Signed", "4/28/2026"],
  ["Sofia Martinez", "Intake Assessment", "90791", "Draft", "4/27/2026"],
];

const hubSections = [
  {
    title: "Patient Accounting",
    links: [
      ["Enter Patient Payment", "/patients/PAT-1000001/payment"],
      ["Enter Misc Charge", "/billing/misc-charge"],
      ["Enter Refund", "/billing/refund"],
      ["Enter Misc Credit", "/billing/misc-credit"],
      ["Create Statement", "/patients/PAT-1000001/statement"],
      ["Aging & Batch Statements", "/billing/patient-aging"],
    ],
  },
  {
    title: "Insurance Claims",
    links: [
      ["Eligibility History", "/billing/eligibility"],
      ["Submit Primary Claims", "/billing/submit-claims"],
      ["Submit Secondary Claims", "/billing/submit-claims?type=secondary"],
      ["Create CMS-1500", "/billing/cms-1500"],
      ["Create Superbill", "/billing/superbill"],
      ["Mark External Claims", "/billing/external-claims"],
    ],
  },
  {
    title: "Insurance Payments",
    links: [
      ["Enter Insurance Payment", "/billing/insurance-payment"],
      ["Electronic Claim History", "/billing/electronic-history"],
      ["ERA", "/billing/era"],
      ["Insurance Aging Report", "/billing/insurance-aging"],
    ],
  },
  {
    title: "More Reports",
    links: [
      ["Revenue Report", "/billing/revenue-report"],
      ["Write-Off Report", "/billing/write-offs"],
      ["Note Count Report", "/billing/note-count"],
      ["Prior Authorizations", "/billing/prior-authorizations"],
    ],
  },
];

function PageShell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <main className="min-h-screen bg-[#f4f4f4] text-[12px] text-black">
      <div className="border-b border-[#d8d8d8] bg-white px-8 py-4">
        <h1 className="text-[24px] font-light text-[#2c91c8]">Billing: <span className="text-[#4b5563]">{title}</span></h1>
      </div>
      <div className="mx-auto max-w-[1220px] px-5 py-5">{children}</div>
    </main>
  );
}

function Panel({ children, title, action }: { children: React.ReactNode; title?: string; action?: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-[2px] border border-[#d9d9d9] bg-white shadow-sm">
      {title ? (
        <div className="flex items-center justify-between border-b border-[#dedede] px-4 py-3">
          <h2 className="text-[18px] font-normal text-black">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

function GreenButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="rounded-[3px] border border-[#69a900] bg-[#79bd00] px-3 py-1.5 text-[12px] font-bold text-white shadow-sm hover:bg-[#68a500]">
      {children}
    </button>
  );
}

function BlueButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="rounded-[3px] border border-[#1686be] bg-[#2198d3] px-3 py-1.5 text-[12px] font-bold text-white shadow-sm hover:bg-[#1479ac]">
      {children}
    </button>
  );
}

function GrayButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="rounded-[3px] border border-[#cfcfcf] bg-[#f6f6f6] px-3 py-1.5 text-[12px] font-bold text-[#333] shadow-sm hover:bg-[#ececec]">
      {children}
    </button>
  );
}

function TextInput({ placeholder = "", value = "" }: { placeholder?: string; value?: string }) {
  return <input defaultValue={value} placeholder={placeholder} className="h-[28px] rounded-[3px] border border-[#cfcfcf] bg-white px-2 text-[12px] outline-none focus:border-[#1c96d2]" />;
}

function SelectBox({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <select className={`${wide ? "w-[310px]" : "w-[180px]"} h-[28px] rounded-[3px] border border-[#cfcfcf] bg-white px-2 text-[12px] outline-none focus:border-[#1c96d2]`}>
      {children}
    </select>
  );
}

function BlueTable({ children, headers }: { children: React.ReactNode; headers: string[] }) {
  return (
    <table className="w-full border-collapse bg-white text-[12px]">
      <thead>
        <tr className="bg-[#2399d1] text-left text-white">
          {headers.map((header) => (
            <th key={header} className="border-r border-[#49aee0] px-3 py-2 font-bold last:border-r-0">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ children, muted = false, right = false, strong = false }: { children: React.ReactNode; muted?: boolean; right?: boolean; strong?: boolean }) {
  return (
    <td className={`${right ? "text-right" : "text-left"} ${muted ? "text-[#7c8792]" : "text-black"} ${strong ? "font-bold" : "font-normal"} border border-[#dcdcdc] px-3 py-2`}>
      {children}
    </td>
  );
}

function ReportFilters({ includeStatus = false }: { includeStatus?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="grid grid-cols-[105px_1fr] items-center gap-2">
        <label>Clinician:</label>
        <SelectBox wide>
          <option>Any Clinician</option>
          <option>Lena Ortiz, LPC</option>
          <option>Krystin Butler</option>
        </SelectBox>

        <label>Insurance:</label>
        <SelectBox wide>
          <option>Any Insurance</option>
          <option>Colorado Access</option>
          <option>Anthem Blue Cross</option>
          <option>Direct / Private Pay</option>
        </SelectBox>

        {includeStatus ? (
          <>
            <label>Status:</label>
            <SelectBox wide>
              <option>All Statuses</option>
              <option>Ready to Submit</option>
              <option>Submitted Claim</option>
              <option>Pending Resubmit</option>
            </SelectBox>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-[115px_1fr] items-center gap-2">
        <label>Date:</label>
        <div className="flex flex-wrap items-center gap-2">
          <SelectBox>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Current month</option>
            <option>Custom</option>
          </SelectBox>
          <TextInput value="4/21/2026" />
          <span>to</span>
          <TextInput value="4/28/2026" />
        </div>

        <label>Report Format:</label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-1"><input type="radio" defaultChecked /> By Patient</label>
          <label className="flex items-center gap-1"><input type="radio" /> By Payer</label>
          <label className="flex items-center gap-1"><input type="radio" /> By Clinician</label>
        </div>
      </div>
    </div>
  );
}

function BillingHub() {
  return (
    <PageShell title="Billing">
      <Panel>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {hubSections.map((section) => (
            <div key={section.title}>
              <h2 className="mb-3 text-[14px] font-bold text-[#555]">{section.title}</h2>
              <div className="space-y-2">
                {section.links.map(([label, href]) => (
                  <Link key={label} href={href} className="block text-[#006eb6] hover:underline">
                    {label} {label.includes("History") || label.includes("Claims") ? <span className="rounded-full bg-[#cfd3d7] px-1.5 py-0.5 text-[10px] font-bold text-white">0</span> : null}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Search Billing Transactions">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="grid grid-cols-[80px_1fr] items-center gap-2">
            <label>Clinician:</label><SelectBox wide><option>Any Clinician</option></SelectBox>
            <label>Type:</label><SelectBox wide><option>Any Type</option></SelectBox>
            <label>Location:</label><SelectBox wide><option>Any Location</option></SelectBox>
          </div>
          <div className="grid grid-cols-[80px_1fr] items-center gap-2">
            <label>Payer:</label><SelectBox wide><option>Any Payer or Direct From Patient</option></SelectBox>
            <label>Method:</label><SelectBox wide><option>Any Submission Method</option></SelectBox>
            <label>Items:</label><SelectBox wide><option>Charges and Payments</option></SelectBox>
          </div>
          <div className="grid grid-cols-[80px_1fr] items-center gap-2">
            <label>Date:</label>
            <div className="flex gap-2">
              <TextInput value="4/21/2026" />
              <TextInput value="4/28/2026" />
            </div>
            <label>Status:</label><SelectBox wide><option>Any Status</option></SelectBox>
            <span />
            <BlueButton>Search Billing Transactions</BlueButton>
          </div>
        </div>
      </Panel>

      <TransactionTable />
    </PageShell>
  );
}

function TransactionTable() {
  return (
    <Panel title="Billing Transactions" action={<div className="flex gap-3 text-[#006eb6]"><button>Export Spreadsheet</button><button>Select Columns</button></div>}>
      <BlueTable headers={["Date", "Type", "Patient", "Payer", "Rate", "Pt Amt", "Ins Amt", "Ins Status"]}>
        {transactions.map((row) => (
          <tr key={`${row.date}-${row.patient}-${row.type}`} className="odd:bg-white even:bg-[#f6f6f6]">
            <Td>{row.date}</Td>
            <Td><Link className="text-[#006eb6] hover:underline" href="/claims/CLM-1001">{row.type}</Link></Td>
            <Td><Link className="text-[#006eb6] hover:underline" href="/patients/PAT-1000001">{row.patient}</Link></Td>
            <Td>{row.payer}</Td>
            <Td right>{row.rate}</Td>
            <Td right>{row.client}</Td>
            <Td right>{row.insurance}</Td>
            <Td strong>{row.status}</Td>
          </tr>
        ))}
      </BlueTable>
    </Panel>
  );
}

function SubmitClaims() {
  return (
    <PageShell title="Submit Electronic Claims">
      <Panel title="Search Claims to Submit">
        <div className="grid grid-cols-[95px_1fr] items-center gap-2">
          <label>Status:</label>
          <SelectBox wide>
            <option>All Open Items</option>
            <option>Ready to Submit</option>
            <option>Needs Review</option>
          </SelectBox>
          <label>Payer:</label>
          <SelectBox wide>
            <option>Pending Initial Submission or Resubmission</option>
            <option>Colorado Access</option>
            <option>Anthem Blue Cross</option>
          </SelectBox>
          <label>Clinician:</label>
          <SelectBox wide>
            <option>Any Clinician</option>
          </SelectBox>
          <span />
          <BlueButton>Search</BlueButton>
        </div>
      </Panel>

      <Panel title="Practice Information Needed Before Submitting Claims">
        <p className="mb-3 text-[#7a1c1c]">
          There are missing appointment fields or billing settings that should be reviewed before claims are submitted.
        </p>
        <BlueTable headers={["Select", "Date", "Patient", "Service", "Payer", "Amount", "Readiness"]}>
          {transactions.slice(0, 2).map((row) => (
            <tr key={row.patient} className="odd:bg-white even:bg-[#f6f6f6]">
              <Td><input type="checkbox" /></Td>
              <Td>{row.date}</Td>
              <Td>{row.patient}</Td>
              <Td>{row.type}</Td>
              <Td>{row.payer}</Td>
              <Td right>{row.rate}</Td>
              <Td>{row.status}</Td>
            </tr>
          ))}
        </BlueTable>
        <div className="mt-4 flex gap-2">
          <GreenButton>Submit Selected Claims</GreenButton>
          <GrayButton>Create CMS-1500</GrayButton>
        </div>
      </Panel>
    </PageShell>
  );
}

function InsuranceAging() {
  return (
    <PageShell title="Insurance Aging Report">
      <Panel title="Create Aging Report">
        <ReportFilters />
        <div className="mt-4"><GreenButton>Create Report</GreenButton></div>
      </Panel>
      <Panel title="Insurance Aging Report by Date of Service" action={<div className="flex gap-3 text-[#006eb6]"><button>Export Spreadsheet</button><button>Save or Print as PDF</button></div>}>
        <BlueTable headers={["Payer", "0–15 Days", "16–30 Days", "31–60 Days", "61–90 Days", "91–120 Days", "121+ Days", "Balance"]}>
          {agingRows.map((row) => (
            <tr key={row[0]} className="odd:bg-white even:bg-[#eff8fc]">
              {row.map((cell, index) => <Td key={cell + index} right={index > 0}>{cell}</Td>)}
            </tr>
          ))}
        </BlueTable>
      </Panel>
    </PageShell>
  );
}

function PatientAging() {
  return (
    <PageShell title="Patient Aging Report & Batch Statements">
      <Panel title="Create Aging Report and Batch Statements">
        <ReportFilters />
        <div className="mt-4"><GreenButton>Create Report</GreenButton></div>
      </Panel>
      <Panel title="Patient Aging Report" action={<div className="flex gap-3 text-[#006eb6]"><button>Export Spreadsheet</button><button>Save or Print as PDF</button></div>}>
        <BlueTable headers={["Patient", "0–15 Days", "16–30 Days", "31–60 Days", "61–90 Days", "91–120 Days", "121+ Days", "Credit", "Unassigned", "Balance"]}>
          <tr className="bg-[#eff8fc]">
            <Td><Link href="/patients/PAT-1000001" className="text-[#006eb6]">Krystin Butler</Link></Td>
            <Td right>$0.00</Td><Td right>$0.00</Td><Td right>$0.00</Td><Td right>$0.00</Td><Td right>$0.00</Td><Td right>$260.00</Td><Td right>$0.00</Td><Td right>$0.00</Td><Td right>$260.00</Td>
          </tr>
        </BlueTable>
        <div className="mt-4"><GreenButton>Generate Patient Balance Statements</GreenButton></div>
      </Panel>
    </PageShell>
  );
}

function RevenueReport() {
  return (
    <PageShell title="Revenue Report">
      <Panel title="Create Report">
        <ReportFilters includeStatus />
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <h3 className="mb-2 font-bold">Report Format</h3>
            {["Broken Down Totals", "No Selection", "By Clinician", "By Service Type", "By Patient", "By Payer", "By Location"].map((label, index) => (
              <label key={label} className="mb-1 block"><input type="radio" name="format" defaultChecked={index === 1} /> {label}</label>
            ))}
          </div>
          <div>
            <h3 className="mb-2 font-bold">Time Increments</h3>
            {["Total Only", "Group By Day", "Group By Week", "Group By Month", "Group By Year"].map((label, index) => (
              <label key={label} className="mb-1 block"><input type="radio" name="time" defaultChecked={index === 1} /> {label}</label>
            ))}
          </div>
          <div>
            <h3 className="mb-2 font-bold">Chart Options</h3>
            {["Dates Down Left Side", "Dates Across Top"].map((label) => (
              <label key={label} className="mb-1 block"><input type="checkbox" defaultChecked /> {label}</label>
            ))}
          </div>
        </div>
        <div className="mt-4"><GreenButton>Create Report</GreenButton></div>
      </Panel>
    </PageShell>
  );
}

function NoteCountReport() {
  return (
    <PageShell title="Note Count Report">
      <Panel title="Create Report">
        <ReportFilters />
        <div className="mt-4"><GreenButton>Create Report</GreenButton></div>
      </Panel>
      <Panel title="Note Count Results">
        <BlueTable headers={["Clinician", "Note Type", "Service", "Status", "Date"]}>
          {noteRows.map((row) => (
            <tr key={row.join("-")} className="odd:bg-white even:bg-[#f6f6f6]">
              {row.map((cell) => <Td key={cell}>{cell}</Td>)}
            </tr>
          ))}
        </BlueTable>
      </Panel>
    </PageShell>
  );
}

function WriteOffs() {
  return (
    <PageShell title="Write-Off and Adjustments Report">
      <Panel title="Create Report">
        <ReportFilters includeStatus />
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <h3 className="mb-2 font-bold">Report Format</h3>
            {["Broken Down Totals", "No Selection", "By Clinician", "By Payer", "By Patient", "By Location"].map((label, index) => (
              <label key={label} className="mb-1 block"><input type="radio" name="writeoff-format" defaultChecked={index === 1} /> {label}</label>
            ))}
          </div>
          <div>
            <h3 className="mb-2 font-bold">Time Increments</h3>
            {["Total Only", "Group By Day", "Group By Week", "Group By Month", "Group By Year"].map((label, index) => (
              <label key={label} className="mb-1 block"><input type="radio" name="writeoff-time" defaultChecked={index === 0} /> {label}</label>
            ))}
          </div>
          <div>
            <h3 className="mb-2 font-bold">Chart Options</h3>
            <label className="mb-1 block"><input type="checkbox" defaultChecked /> Dates Down Left Side</label>
            <label className="mb-1 block"><input type="checkbox" /> Dates Across Top</label>
          </div>
        </div>
        <div className="mt-4"><GreenButton>Create Report</GreenButton></div>
      </Panel>
    </PageShell>
  );
}

function InsurancePayment() {
  return (
    <PageShell title="Enter Insurance Payment">
      <Panel title="Insurance Payment">
        <div className="mb-4 border-b border-[#1f98d1] pb-3">
          <span className="mr-8">Payment Type:</span>
          <label className="mr-4"><input type="radio" defaultChecked /> In-Network Payment</label>
          <label><input type="radio" /> Out-of-Network Payment</label>
        </div>
        <div className="grid max-w-[620px] grid-cols-[130px_1fr] items-center gap-2">
          <label>Payer:</label><SelectBox wide><option>Select a payer</option><option>Colorado Access</option><option>Anthem Blue Cross</option></SelectBox>
          <label>Payment Method:</label><SelectBox wide><option>Check</option><option>ACH/EFT</option><option>Virtual Card</option></SelectBox>
          <label>Payment Date:</label><TextInput value="4/28/2026" />
          <label>Payment Amount:</label><TextInput placeholder="$" />
          <label>Check Number:</label><TextInput placeholder="optional" />
          <label>Comments:</label><textarea className="h-[52px] rounded-[3px] border border-[#cfcfcf] px-2 py-1 text-[12px]" placeholder="Internal memo only" />
        </div>
        <div className="mt-4 flex gap-2">
          <GreenButton>Save New Payment</GreenButton>
          <Link href="/billing" className="px-2 py-1.5 text-[#006eb6]">Cancel</Link>
        </div>
      </Panel>
    </PageShell>
  );
}

function TransactionsPage() {
  return (
    <PageShell title="Search Billing Transactions">
      <Panel title="Search Billing Transactions">
        <ReportFilters includeStatus />
        <div className="mt-4"><BlueButton>Search Billing Transactions</BlueButton></div>
      </Panel>
      <TransactionTable />
    </PageShell>
  );
}

export function ClassicBillingModule({ page }: { page: ReportPage }) {
  if (page === "submitClaims") return <SubmitClaims />;
  if (page === "insuranceAging") return <InsuranceAging />;
  if (page === "patientAging") return <PatientAging />;
  if (page === "revenue") return <RevenueReport />;
  if (page === "noteCount") return <NoteCountReport />;
  if (page === "writeOffs") return <WriteOffs />;
  if (page === "insurancePayment") return <InsurancePayment />;
  if (page === "transactions") return <TransactionsPage />;
  return <BillingHub />;
}
