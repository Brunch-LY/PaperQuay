import { FileSearch } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
}

function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center px-6 py-8">
      <div className="pq-card max-w-md px-8 py-10 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--pq-radius-md)] bg-[var(--pq-accent-soft)] text-[var(--pq-accent)]">
          <FileSearch className="h-5 w-5" strokeWidth={1.9} />
        </div>
        <h3 className="text-lg font-semibold text-[var(--pq-text)]">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-[var(--pq-text-muted)]">{description}</p>
      </div>
    </div>
  );
}

export default EmptyState;
