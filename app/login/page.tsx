'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState('dworeckiedward@gmail.com');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 p-6">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-white/60 mt-1">Email + password (dev).</p>

        <input
          className="mt-4 w-full rounded-md bg-black/50 border border-white/10 px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@clinic.com"
        />

        <input
          className="mt-3 w-full rounded-md bg-black/50 border border-white/10 px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
        />

        <button
          className="mt-3 w-full rounded-md bg-white text-black py-2 font-medium"
          onClick={async () => {
            setErr(null);
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) return setErr(error.message);
            window.location.href = '/dashboard?tenant=luxe';
          }}
        >
          Sign in
        </button>

        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
      </div>
    </main>
  );
}
