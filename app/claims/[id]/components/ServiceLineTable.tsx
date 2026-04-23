import { ServiceLine, DiagnosisCode } from "@/lib/types/claim";

interface ServiceLineTableProps {
  serviceLines: ServiceLine[];
  diagnosisCodes: DiagnosisCode[];
}

export default function ServiceLineTable({ serviceLines, diagnosisCodes }: ServiceLineTableProps) {
  const calculateTotal = () => {
    return serviceLines.reduce((sum, line) => sum + line.charge_amount, 0);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Service Lines</h2>
        <button className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200">
          Add Service Line
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">DOS From</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">DOS To</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">POS</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPT/HCPCS</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mod 1</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mod 2</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dx Ptr</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Charges</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">NPI</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {serviceLines.map((line, index) => (
              <tr key={line.id} className="hover:bg-gray-50">
                <td className="px-3 py-3 whitespace-nowrap text-gray-700 font-medium">
                  {index + 1}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <input
                    type="date"
                    value={line.dos_from}
                    readOnly
                    className="w-32 px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <input
                    type="date"
                    value={line.dos_to}
                    readOnly
                    className="w-32 px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <input
                    type="text"
                    value={line.place_of_service}
                    readOnly
                    maxLength={2}
                    className="w-12 px-2 py-1 text-xs border border-gray-300 rounded bg-white font-mono"
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <input
                    type="text"
                    value={line.cpt_code}
                    readOnly
                    className="w-20 px-2 py-1 text-xs border border-gray-300 rounded bg-white font-mono"
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <input
                    type="text"
                    value={line.modifier_1 || ""}
                    readOnly
                    maxLength={2}
                    className="w-12 px-2 py-1 text-xs border border-gray-300 rounded bg-white font-mono"
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <input
                    type="text"
                    value={line.modifier_2 || ""}
                    readOnly
                    maxLength={2}
                    className="w-12 px-2 py-1 text-xs border border-gray-300 rounded bg-white font-mono"
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <input
                    type="text"
                    value={line.diagnosis_pointers.join("")}
                    readOnly
                    className="w-16 px-2 py-1 text-xs border border-gray-300 rounded bg-white font-mono"
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <input
                    type="number"
                    value={line.units}
                    readOnly
                    className="w-16 px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <input
                    type="number"
                    value={line.charge_amount}
                    readOnly
                    step="0.01"
                    className="w-20 px-2 py-1 text-xs border border-gray-300 rounded bg-white font-mono"
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <input
                    type="text"
                    value={line.rendering_provider_npi || ""}
                    readOnly
                    className="w-24 px-2 py-1 text-xs border border-gray-300 rounded bg-white font-mono"
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                    {line.claim_line_status || "pending"}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                      Duplicate
                    </button>
                    <button className="text-red-600 hover:text-red-800 text-xs font-medium">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td colSpan={9} className="px-3 py-3 text-right font-semibold text-gray-900">
                Total Charges:
              </td>
              <td colSpan={4} className="px-3 py-3 font-semibold text-gray-900">
                ${calculateTotal().toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
