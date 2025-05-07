import { supabase } from './supabaseClient';
import CryptoJS from 'crypto-js';

export async function signUpWithEmail({ email, password, fullName, username, gender, birthDate, phone }) {
  try {
    // 1. First generate a salt and hash the password for our custom user table
    const salt = CryptoJS.lib.WordArray.random(16).toString();
    const passwordHash = CryptoJS.SHA512(password + salt).toString();
    const saltedPasswordHash = `${salt}:${passwordHash}`;

    // 2. Sign up the user with Supabase Auth
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'http://localhost:3000/confirmed',
        data: {
          full_name: fullName,
          username,
          gender,
          date_of_birth: birthDate,
          phone,
          // Store this flag to identify unconfirmed users
          email_confirmed: false,
          // Store the password hash securely in metadata for later use
          temp_password_hash: saltedPasswordHash
        },
      },
    });

    if (signUpError) return { error: signUpError.message };

    const user = authData?.user;
    if (!user) return { error: 'Signup failed: No user object returned.' };

    // Store the salted hash in localStorage temporarily (will be cleared after confirmation)
    // Only do this in development or with proper security measures
    localStorage.setItem(`tempHash_${user.id}`, saltedPasswordHash);

    // 3. Return success message - we'll create the user record on confirmation
    return { 
      success: true, 
      message: "Please check your email to confirm your account. Your profile will be created after confirmation.",
      userId: user.id  // We'll need this for the confirmation page
    };
  } catch (error) {
    console.error("Sign up error:", error);
    return { error: error.message };
  }
}

// Ensure this function is correctly implementing the user creation
export async function createUserAfterConfirmation(userId) {
  try {
    // 1. Get the user's metadata from auth
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();
    
    if (getUserError || !user) {
      throw new Error(getUserError?.message || "User not found");
    }
    
    // 2. Check if this user has already been added to the user table
    const { data: existingUser, error: checkError } = await supabase
      .from('user')
      .select('id')
      .eq('id', userId)
      .single();
      
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Database check error: ${checkError.message}`);
    }
      
    if (existingUser) {
      console.log("User already exists in database:", existingUser);
      return { success: true, message: "User already exists in database" };
    }
    
    // 3. Get the stored password hash
    const tempHash = localStorage.getItem(`tempHash_${userId}`);
    // Clear the localStorage entry for security
    localStorage.removeItem(`tempHash_${userId}`);
    
    // 4. Extract user metadata from the auth user
    const metadata = user.user_metadata || {};
    console.log("User metadata for insertion:", metadata);
    
    // 5. Insert the confirmed user into your custom user table
    const { data: insertData, error: insertError } = await supabase.from('user').insert({
      id: userId,
      full_name: metadata.full_name,
      username: metadata.username,
      email: user.email,
      password_hash: tempHash || metadata.temp_password_hash || "NEEDS_RESET",
      date_of_birth: metadata.date_of_birth,
      gender: metadata.gender,
      phone: metadata.phone,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("Error inserting user:", insertError);
      throw new Error(`Failed to create user profile: ${insertError.message}`);
    }
    
    console.log("User successfully created:", insertData);
    
    // 6. Update the user's metadata to mark them as confirmed
    await supabase.auth.updateUser({
      data: { email_confirmed: true }
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error creating user after confirmation:", error);
    return { error: error.message };
  }
}