import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useUser } from '../contexts/UserContext';
import CryptoJS from 'crypto-js';

export default function LoginForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setCurrentUser } = useUser();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('Logging in...');
    try {
      // 1. First check if user exists in your custom user table
      const { data: userData, error: userError } = await supabase
        .from('user')
        .select('id, username, full_name, password_hash, email')
        .eq('email', formData.email)
        .single();
      if (userError) {
        if (userError.code === 'PGRST116') { // Not found
          throw new Error('No account found with this email address');
        } else {
          throw new Error(`Database error: ${userError.message}`);
        }
      }
      if (!userData) {
        throw new Error('Account not found');
      }
      // 2. If user has a password_hash, verify it
      if (userData.password_hash && userData.password_hash !== "NEEDS_RESET") {
        // Split the stored hash into salt and hash components
        const [salt, storedHash] = userData.password_hash.split(':');
        // Calculate hash of provided password with the same salt
        const calculatedHash = CryptoJS.SHA512(formData.password + salt).toString();
        // Compare the calculated hash with the stored hash
        if (calculatedHash !== storedHash) {
          throw new Error('Invalid password');
        }
        // If we get here, password is correct
      }
      // 3. Sign in with Supabase Auth to get session
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });
      if (signInError || !authData.session) {
        throw new Error('Invalid email or password');
      }
      // 4. Set user in context only
      setCurrentUser({
        id: userData.id,
        username: userData.username,
        fullName: userData.full_name,
        email: userData.email
      });
      setMessage('✅ Login successful! Redirecting...');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (error) {
      setMessage(`❌ ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      maxWidth: '400px', 
      margin: '2rem auto', 
      padding: '2rem', 
      border: '1px solid #ddd', 
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Log In</h2>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Email
          </label>
          <input 
            id="email"
            name="email" 
            type="email" 
            value={formData.email}
            onChange={handleChange} 
            required 
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              border: '1px solid #ddd', 
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Password
          </label>
          <input 
            id="password"
            name="password" 
            type="password" 
            value={formData.password}
            onChange={handleChange} 
            required 
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              border: '1px solid #ddd', 
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '0.75rem', 
            backgroundColor: '#2196F3', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            fontSize: '1rem',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>
      
      {message && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '0.75rem', 
          borderRadius: '4px',
          backgroundColor: message.includes('❌') ? '#ffebee' : '#e8f5e9',
          color: message.includes('❌') ? '#d32f2f' : '#388e3c',
          textAlign: 'center'
        }}>
          {message}
        </div>
      )}
      
      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <p>Don't have an account? <Link to="/signup" style={{ color: '#2196F3' }}>Sign up</Link></p>
        <p style={{ marginTop: '0.5rem' }}>
          <Link to="/forgot-password" style={{ color: '#757575', fontSize: '0.9rem' }}>
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  );
}