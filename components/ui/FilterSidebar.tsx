"use client";

import { ReactNode } from "react";

interface FilterSidebarProps {
  children: ReactNode;
  onApply?: () => void;
  onReset?: () => void;
}

export default function FilterSidebar({ children, onApply, onReset }: FilterSidebarProps) {
  return (
    <div className="w-64 shrink-0">
      <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-24">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Filters</h3>
        
        <div className="space-y-4">
          {children}
        </div>
        
        <div className="space-y-2 mt-6 pt-4 border-t border-gray-200">
          {onApply && (
            <button
              onClick={onApply}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Apply Filters
            </button>
          )}
          {onReset && (
            <button
              onClick={onReset}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
