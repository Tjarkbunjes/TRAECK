'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Utensils, Dumbbell, Scale, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'home', icon: Home },
  { href: '/food', label: 'food', icon: Utensils },
  { href: '/workout', label: 'workout', icon: Dumbbell },
  { href: '/weight', label: 'weight', icon: Scale },
  { href: '/friends', label: 'friends', icon: Users },
];

export function BottomNav() {
  const pathname = usePathname();

  if (pathname?.startsWith('/auth')) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#292929] bg-[#0F0F0F]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0F0F0F]/60">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-xs transition-colors min-w-[56px] min-h-[44px]',
                isActive
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'stroke-[2.5px]')} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
