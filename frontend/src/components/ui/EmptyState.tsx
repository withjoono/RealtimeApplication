import { cn } from '../../lib/utils';
import { SearchX, Database, AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  type?: 'search' | 'data' | 'error';
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const icons = {
  search: SearchX,
  data: Database,
  error: AlertCircle,
};

export function EmptyState({
  type = 'data',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const Icon = icons[type];

  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 text-center max-w-md">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
