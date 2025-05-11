import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { createUserAfterConfirmation } from '../services/signUp';

export default function ConfirmedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [dbStatus, setDbStatus] = useState({ processing: false, success: false, error: null });

  useEffect(() => {
    const handleConfirmedUser = async () => {
      try {
        console.log("URL Location:", location); // Debug
        console.log("window.location.hash:", window.location.hash);

        // First try to get the current session
        const { data: sessionData } = await supabase.auth.getSession();
        console.log("Session data:", sessionData); // Debug
        
        if (sessionData?.session) {
          // User already has a session
          setUser(sessionData.session.user);
          
          // Create user record in database
          setDbStatus({ processing: true, success: false, error: null });
          console.log("Creating user with ID:", sessionData.session.user.id);
          const result = await createUserAfterConfirmation(sessionData.session.user.id);
          
          console.log("User creation result:", result);
          
          if (result.error) {
            setDbStatus({ processing: false, success: false, error: result.error });
          } else {
            setDbStatus({ processing: false, success: true, error: null });
          }
          
          setLoading(false);
          return;
        }
        
        // If no session, check URL for tokens
        const hashParams = new URLSearchParams(location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        // Try to get type and access_token from query params (alternative format)
        const queryParams = new URLSearchParams(location.search);
        const type = queryParams.get('type');
        const queryAccessToken = queryParams.get('access_token');
        
        console.log("URL tokens:", { accessToken, refreshToken, type, queryAccessToken });
        
        if (type === 'recovery' || type === 'signup' || type === 'magiclink') {
          // Let Supabase handle this automatically
          const { data, error } = await supabase.auth.getUser();
          console.log("Auth user data:", data);
          
          if (!error && data.user) {
            setUser(data.user);
            
            // Create user record in database
            setDbStatus({ processing: true, success: false, error: null });
            const result = await createUserAfterConfirmation(data.user.id);
            
            if (result.error) {
              setDbStatus({ processing: false, success: false, error: result.error });
            } else {
              setDbStatus({ processing: false, success: true, error: null });
            }
            
            setLoading(false);
            return;
          }
        }
        
        if (accessToken && refreshToken) {
          // Try to set the session with tokens from hash
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (!setSessionError) {
            const { data } = await supabase.auth.getUser();
            setUser(data.user);
            
            // Create user record in database
            setDbStatus({ processing: true, success: false, error: null });
            const result = await createUserAfterConfirmation(data.user.id);
            
            if (result.error) {
              setDbStatus({ processing: false, success: false, error: result.error });
            } else {
              setDbStatus({ processing: false, success: true, error: null });
            }
          } else {
            setErrorMsg('Invalid or expired tokens. Please try logging in.');
          }
        } else {
          setErrorMsg('No authentication tokens found. Your email may already be confirmed or the link has expired.');
        }
      } catch (err) {
        console.error("Confirmation error:", err);
        setErrorMsg(`Authentication error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    handleConfirmedUser();
  }, [navigate, location]);

  // Styled loading indicator
  if (loading) {
    return (
      <div style={{ 
        maxWidth: '500px', 
        margin: '3rem auto', 
        padding: '2rem', 
        textAlign: 'center',
        border: '1px solid #eaeaea',
        borderRadius: '10px'
      }}>
        <h2>Setting up your account...</h2>
        <p>Just a moment while we confirm your email</p>
      </div>
    );
  }

  // Error state with helpful action buttons
  if (errorMsg) {
    return (
      <div style={{ 
        maxWidth: '500px', 
        margin: '3rem auto', 
        padding: '2rem', 
        textAlign: 'center',
        border: '1px solid #ffcccc',
        borderRadius: '10px',
        backgroundColor: '#fff8f8'
      }}>
        <h2>Authentication Issue</h2>
        <p style={{ color: '#d32f2f' }}>{errorMsg}</p>
        <div style={{ marginTop: '2rem' }}>
          <Link to="/login" style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#2196F3',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '5px',
            marginRight: '10px'
          }}>
            Go to Login
          </Link>
          <Link to="/" style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#f5f5f5',
            color: '#333',
            textDecoration: 'none',
            borderRadius: '5px',
            border: '1px solid #ddd'
          }}>
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  // Success state with database status
  return (
    <div style={{ 
      maxWidth: '500px', 
      margin: '3rem auto', 
      padding: '2rem', 
      textAlign: 'center',
      border: '1px solid #ccffcc',
      borderRadius: '10px',
      backgroundColor: '#f8fff8'
    }}>
      <h2>Email Confirmed Successfully!</h2>
      
      {dbStatus.processing ? (
        <p>Setting up your account...</p>
      ) : dbStatus.error ? (
        <>
          <p>Your email has been confirmed, but there was an issue creating your profile:</p>
          <p style={{ color: 'red', padding: '10px', backgroundColor: '#ffebee', borderRadius: '5px' }}>
            {dbStatus.error}
          </p>
        </>
      ) : dbStatus.success ? (
        <>
          <p>Your account has been successfully created!</p>
          {user && <p>Welcome, {user.email}!</p>}
        </>
      ) : (
        <p>Your email has been confirmed!</p>
      )}
      
      <div style={{ marginTop: '2rem' }}>
        <button 
          onClick={() => navigate('/login')} 
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Log In
        </button>
        <button 
          onClick={() => navigate('/')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#f5f5f5',
            color: '#333',
            border: '1px solid #ddd',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Return Home
        </button>
      </div>
    </div>
  );
}