'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, isPA, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        // Redirect based on role
        if (isAdmin) {
          router.push('/admin/dashboard');
        } else if (isPA) {
          router.push('/dashboard');
        }
      } else {
        router.push('/login');
      }
    }
  }, [isAuthenticated, isAdmin, isPA, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">PA Scheduling System</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
