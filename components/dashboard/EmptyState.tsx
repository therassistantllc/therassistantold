// File: components/dashboard/EmptyState.tsx
interface EmptyStateProps {
  title: string;
  description: string;
}

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
      <div className="text-sm font-medium text-gray-900">{title}</div>
      <div className="mt-2 text-sm text-gray-600">{description}</div>
    </div>
  );
}
