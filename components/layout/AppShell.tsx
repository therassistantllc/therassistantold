"use client";

import { useState, useEffect } from "react";
import TopBar from "./TopBar";
import SidebarNav from "./SidebarNav";
import CommandPalette from "./CommandPalette";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <TopBar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />

      {/* Sidebar Navigation */}
      <SidebarNav />

      {/* Main Content */}
      <main className="ml-64 mt-16 min-h-[calc(100vh-4rem)]">
        {children}
      </main>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}
