"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Command {
  id: string;
  label: string;
  category: string;
  action: string;
  icon: string;
  keywords: string[];
}

const commands: Command[] = [
  // Navigation
  { id: "nav-dashboard", label: "Go to Dashboard", category: "Navigation", action: "/dashboard", icon: "📊", keywords: ["dashboard", "home", "overview"] },
  { id: "nav-scheduling", label: "Go to Scheduling", category: "Navigation", action: "/scheduling", icon: "📅", keywords: ["calendar", "appointments", "schedule"] },
  { id: "nav-patients", label: "Go to Patients", category: "Navigation", action: "/patients", icon: "👥", keywords: ["patients", "directory"] },
  { id: "nav-billing", label: "Go to Billing", category: "Navigation", action: "/billing", icon: "💰", keywords: ["billing", "claims", "payments"] },
  { id: "nav-claims", label: "Go to Claim Center", category: "Navigation", action: "/billing/claims", icon: "📄", keywords: ["claims", "submissions"] },
  { id: "nav-payments", label: "Go to Payment Posting", category: "Navigation", action: "/billing/unposted-payments", icon: "💳", keywords: ["payments", "posting", "era"] },
  
  // Quick Actions
  { id: "create-appointment", label: "Create Appointment", category: "Quick Actions", action: "create-appointment", icon: "➕", keywords: ["new", "appointment", "schedule"] },
  { id: "create-claim", label: "Create Claim", category: "Quick Actions", action: "create-claim", icon: "➕", keywords: ["new", "claim", "billing"] },
  { id: "create-payment", label: "Create Payment", category: "Quick Actions", action: "create-payment", icon: "➕", keywords: ["new", "payment", "post"] },
  { id: "create-note", label: "Create Progress Note", category: "Quick Actions", action: "create-note", icon: "➕", keywords: ["new", "note", "documentation"] },
  { id: "create-ticket", label: "Create Ticket", category: "Quick Actions", action: "create-ticket", icon: "➕", keywords: ["new", "ticket", "support"] },
  { id: "create-task", label: "Create Task", category: "Quick Actions", action: "create-task", icon: "➕", keywords: ["new", "task", "todo"] },
  
  // Search
  { id: "search-patients", label: "Search Patients", category: "Search", action: "search-patients", icon: "🔍", keywords: ["find", "patient", "search"] },
  { id: "search-claims", label: "Search Claims", category: "Search", action: "search-claims", icon: "🔍", keywords: ["find", "claim", "search"] },
  { id: "search-payments", label: "Search Payments", category: "Search", action: "search-payments", icon: "🔍", keywords: ["find", "payment", "search"] },
  { id: "search-notes", label: "Search Notes", category: "Search", action: "search-notes", icon: "🔍", keywords: ["find", "note", "documentation"] },
];

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = commands.filter((cmd) => {
    const searchLower = search.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(searchLower) ||
      cmd.category.toLowerCase().includes(searchLower) ||
      cmd.keywords.some((k) => k.includes(searchLower))
    );
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const command = filteredCommands[selectedIndex];
        if (command) {
          executeCommand(command);
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const executeCommand = (command: Command) => {
    if (command.action.startsWith("/")) {
      router.push(command.action);
    } else {
      // Handle custom actions
      console.log("Execute:", command.action);
    }
    onClose();
  };

  if (!isOpen) return null;

  // Group commands by category
  const groupedCommands: { [key: string]: Command[] } = {};
  filteredCommands.forEach((cmd) => {
    if (!groupedCommands[cmd.category]) {
      groupedCommands[cmd.category] = [];
    }
    groupedCommands[cmd.category].push(cmd);
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[100]"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[600px] bg-white rounded-lg shadow-2xl border border-gray-200 z-[101]">
        {/* Search Input */}
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command or search..."
            className="w-full px-4 py-3 text-base bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        {/* Results */}
        <div className="max-h-[500px] overflow-y-auto">
          {Object.keys(groupedCommands).length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No commands found
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, cmds]) => (
              <div key={category}>
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                  {category}
                </div>
                {cmds.map((cmd, idx) => {
                  const globalIndex = filteredCommands.indexOf(cmd);
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => executeCommand(cmd)}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 ${
                        globalIndex === selectedIndex
                          ? "bg-blue-50 text-blue-700"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-xl">{cmd.icon}</span>
                      <span className="text-sm font-medium">{cmd.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <kbd className="px-2 py-1 bg-white border border-gray-200 rounded">Ctrl K</kbd>
        </div>
      </div>
    </>
  );
}
