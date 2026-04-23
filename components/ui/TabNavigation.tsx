"use client";

import Link from "next/link";

interface Tab {
  id: string;
  label: string;
  href: string;
  count?: number;
  badge?: string;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
}

export default function TabNavigation({ tabs, activeTab }: TabNavigationProps) {
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="flex gap-1 px-6">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      isActive
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                    {tab.badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
