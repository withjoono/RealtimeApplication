import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export function Loading({ size = 'md', className, text }: LoadingProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-8', className)}>
      <Loader2 className={cn('animate-spin text-primary-600', sizes[size])} />
      {text && <p className="mt-2 text-sm text-gray-500">{text}</p>}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loading size="lg" text="로딩 중..." />
    </div>
  );
}
