import { supabase } from './supabaseClient';

export async function signUpWithEmail({ email, password, fullName, username, gender, birthDate, phone }) {
  // 1. Sign up the user
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'http://localhost:3000/confirmed', // ✅ Add this line
      data: {
        full_name: fullName,
        username,
        gender,
        date_of_birth: birthDate,
        phone,
      },
    },
  });

  if (signUpError) return { error: signUpError.message };

  const user = authData?.user;
  if (!user) return { error: 'Signup failed: No user object returned.' };

  // 2. Poll every 5 seconds for email confirmation
  let confirmed = false;
  let tries = 0;
  const maxTries = 12; // 1 minute

  while (!confirmed && tries < maxTries) {
    await new Promise((res) => setTimeout(res, 5000));
    const { data: refreshedUser, error } = await supabase.auth.getUser();

    if (error) return { error: "Failed to fetch user confirmation status." };

    confirmed = !!refreshedUser?.user?.email_confirmed_at;
    tries++;
  }

  if (!confirmed) {
    return { error: "Email not confirmed in time. Please confirm and try again." };
  }

  // 3. Insert into `user` table
  const { error: insertError } = await supabase.from('user').insert({
    id: user.id,
    full_name: fullName,
    username,
    email,
    date_of_birth: birthDate,
    gender,
    phone,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (insertError) return { error: insertError.message };

  return { success: true };
}