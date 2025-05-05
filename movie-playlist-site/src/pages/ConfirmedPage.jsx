import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';

export default function ConfirmedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handleConfirmedUser = async () => {
      try {
        const hashParams = new URLSearchParams(location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
  
        if (!accessToken || !refreshToken) {
          setErrorMsg('Missing access or refresh token in URL.');
          setLoading(false);
          return;
        }
  
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
  
        if (setSessionError) {
          setErrorMsg('Failed to establish session with tokens.');
          setLoading(false);
          return;
        }
  
        const { data: { user }, error: userError } = await supabase.auth.getUser();
  
        if (userError || !user) {
          setErrorMsg('Could not fetch user after session set.');
          setLoading(false);
          return;
        }
  
        // your profile check + insert logic...
  
        setLoading(false);
      } catch (err) {
        setErrorMsg(`An error occurred: ${err.message}`);
        setLoading(false);
      }
    };
  
    handleConfirmedUser();
  }, [navigate, location]);

  if (loading) return <p>Setting up your account...</p>;
  if (errorMsg) return <p>❌ mmm{errorMsg}</p>;
  return <p>✅ Your email has been confirmed! You can now log in.</p>;
}