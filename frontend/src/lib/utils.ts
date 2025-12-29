import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

// Tailwind class merge utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format date
export function formatDate(date: string | Date, pattern = 'yyyy.MM.dd HH:mm') {
  return format(new Date(date), pattern, { locale: ko });
}

// Format relative time
export function formatRelativeTime(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ko });
}

// Format competition rate
export function formatRate(rate: number) {
  if (rate === 0) return '-';
  return `${rate.toFixed(2)} : 1`;
}

// Get rate color class
export function getRateColorClass(rate: number): string {
  if (rate === 0) return 'text-gray-400';
  if (rate < 3) return 'text-green-600';
  if (rate < 5) return 'text-yellow-600';
  if (rate < 10) return 'text-orange-600';
  return 'text-red-600';
}

// Get rate badge class
export function getRateBadgeClass(rate: number): string {
  if (rate === 0) return 'bg-gray-100 text-gray-600';
  if (rate < 3) return 'bg-green-50 text-green-700';
  if (rate < 5) return 'bg-yellow-50 text-yellow-700';
  if (rate < 10) return 'bg-orange-50 text-orange-700';
  return 'bg-red-50 text-red-700';
}

// Format number with comma
export function formatNumber(num: number) {
  return num.toLocaleString('ko-KR');
}
