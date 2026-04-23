import { Patient } from "@/lib/types/claim";

interface PatientInfoCardProps {
  patient: Patient;
}

export default function PatientInfoCard({ patient }: PatientInfoCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Patient Information</h2>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Column 1 */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                First Name
              </label>
              <input
                type="text"
                value={patient.first_name}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={patient.last_name}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                value={patient.dob}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Sex
              </label>
              <select
                value={patient.sex}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="U">Unknown</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={patient.phone || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Email
              </label>
              <input
                type="email"
                value={patient.email || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
          </div>
          
          {/* Column 2 */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Address
              </label>
              <input
                type="text"
                value={patient.address.street}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                City
              </label>
              <input
                type="text"
                value={patient.address.city}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={patient.address.state}
                  readOnly
                  maxLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  ZIP
                </label>
                <input
                  type="text"
                  value={patient.address.zip}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Relationship to Subscriber
              </label>
              <select
                value={patient.relationship_to_subscriber}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="self">Self</option>
                <option value="spouse">Spouse</option>
                <option value="child">Child</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Marital Status
              </label>
              <select
                value={patient.marital_status || ""}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="">Select</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>
          </div>
          
          {/* Column 3 */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Employment Status
              </label>
              <select
                value={patient.employment_status || ""}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="">Select</option>
                <option value="employed">Employed</option>
                <option value="unemployed">Unemployed</option>
                <option value="retired">Retired</option>
                <option value="student">Student</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Student Status
              </label>
              <select
                value={patient.student_status || "none"}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="none">Not a Student</option>
                <option value="full_time">Full-Time Student</option>
                <option value="part_time">Part-Time Student</option>
              </select>
            </div>
            
            <div className="pt-4 space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="accident-related"
                  disabled
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="accident-related" className="ml-2 text-sm font-medium text-gray-700">
                  Accident Related
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="auto-accident"
                  disabled
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="auto-accident" className="ml-2 text-sm font-medium text-gray-700">
                  Auto Accident
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="work-comp"
                  disabled
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="work-comp" className="ml-2 text-sm font-medium text-gray-700">
                  Workers Compensation
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
