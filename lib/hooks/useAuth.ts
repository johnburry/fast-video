import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export function useAuth(redirectTo: string = '/login') {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (!session) {
        router.push(redirectTo);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (!session) {
        router.push(redirectTo);
      }
    });

    return () => subscription.unsubscribe();
  }, [router, redirectTo]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return { user, loading, signOut };
}
