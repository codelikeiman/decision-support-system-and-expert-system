'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LogoutButton({ callbackUrl = '/login', label = 'Keluar', variant = 'ghost' }: { callbackUrl?: string; label?: string; variant?: 'ghost' | 'outline' }) {
  return (
    <Button variant={variant} size="sm" onClick={() => signOut({ callbackUrl })}>
      <LogOut />
      {label}
    </Button>
  );
}
