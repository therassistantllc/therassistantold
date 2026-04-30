"use client";

import { useEffect, type ReactNode } from "react";

interface RightWorkflowDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  secondaryActions?: Array<{
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }>;
}

export default function RightWorkflowDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  primaryAction,
  secondaryActions = [],
}: RightWorkflowDrawerProps) {
  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when drawer is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={[
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300",
          "lg:w-[420px]",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              {subtitle && (
                <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close drawer"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {/* Sticky Footer Actions */}
        {(primaryAction || secondaryActions.length > 0) && (
          <div className="sticky bottom-0 border-t border-gray-200 bg-white px-6 py-4">
            <div className="space-y-2">
              {primaryAction && (
                <button
                  type="button"
                  onClick={primaryAction.onClick}
                  disabled={primaryAction.disabled}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {primaryAction.label}
                </button>
              )}
              {secondaryActions.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {secondaryActions.map((action, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
