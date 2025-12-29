import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Building2,
  TrendingUp,
  History
} from 'lucide-react';
import { cn } from '../../lib/utils';

const navigation = [
  { name: '대시보드', href: '/', icon: LayoutDashboard },
  { name: '경쟁률 검색', href: '/search', icon: Search },
  { name: '대학별 조회', href: '/universities', icon: Building2 },
  { name: '경쟁률 순위', href: '/ranking', icon: TrendingUp },
  { name: '크롤링 현황', href: '/crawl', icon: History },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)]">
      <nav className="p-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
