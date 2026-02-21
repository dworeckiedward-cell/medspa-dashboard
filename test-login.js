const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kkjjqnktfnxxkavbcyye.supabase.co',
  'WKLEJ_TUTAJ_SB_PUBLISHABLE_KEY'
);

(async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'dworeckiedward@gmail.com',
    password: 'servifylabs',
  });

  console.log({
    error: error?.message ?? null,
    user: data?.user?.email ?? null,
    hasSession: !!data?.session,
  });
})();
