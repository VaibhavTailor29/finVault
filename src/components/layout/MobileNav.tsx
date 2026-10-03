import React from 'react';
import { LayoutDashboard, ArrowLeftRight, CreditCard, Users, Landmark, Settings } from 'lucide-react';

interface MobileNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentPath, onNavigate }) => {
  const items = [
    { label: 'Home', path: '/', icon: LayoutDashboard },
    { label: 'Txns', path: '/transactions', icon: ArrowLeftRight },
    { label: 'Cards', path: '/cards', icon: CreditCard },
    { label: 'People', path: '/people', icon: Users },
    { label: 'Invest', path: '/investments', icon: Landmark },
    { label: 'More', path: '/settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-neutral-200 bg-white/95 backdrop-blur-xs px-2 lg:hidden dark:border-neutral-800 dark:bg-neutral-900/95">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentPath === item.path;
        return (
          <button
            key={item.path}
            onClick={() => onNavigate(item.path)}
            className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors ${
              isActive
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
