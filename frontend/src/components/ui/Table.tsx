import { cn } from '../../lib/utils';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="min-w-full divide-y divide-gray-200">
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className }: TableProps) {
  return <thead className={cn('bg-gray-50', className)}>{children}</thead>;
}

export function TableBody({ children, className }: TableProps) {
  return (
    <tbody className={cn('divide-y divide-gray-200 bg-white', className)}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className }: TableProps) {
  return (
    <tr className={cn('hover:bg-gray-50 transition-colors', className)}>
      {children}
    </tr>
  );
}

interface TableCellProps extends TableProps {
  align?: 'left' | 'center' | 'right';
}

export function TableHead({ children, className, align = 'left' }: TableCellProps) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        className
      )}
    >
      {children}
    </th>
  );
}

export function TableCell({ children, className, align = 'left' }: TableCellProps) {
  return (
    <td
      className={cn(
        'px-4 py-3 text-sm text-gray-900 whitespace-nowrap',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        className
      )}
    >
      {children}
    </td>
  );
}
