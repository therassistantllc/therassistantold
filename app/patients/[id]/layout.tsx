import type { ReactNode } from "react";

type PatientLayoutProps = {
  children: ReactNode;
};

export default function PatientLayout({ children }: PatientLayoutProps) {
  return <div className="min-h-screen bg-[#f5f5f5] p-[8px] text-[12px]">{children}</div>;
}
