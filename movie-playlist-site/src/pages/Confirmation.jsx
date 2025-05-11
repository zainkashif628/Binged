import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import './Confirmation.css';

const Confirmation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { themeColors } = useTheme();
  const [status, setStatus] = useState('verifying');
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        let token = searchParams.get('token');
        let type = searchParams.get('type');
       // If not found, try to get from hash fragment
        if (!token || !type) {
          const hash = window.location.hash.substring(1); // remove the '#'
          const params = new URLSearchParams(hash);
          token = params.get('token') || params.get('access_token');
          type = params.get('type');
        }
    
        console.log("Token:", token);
        console.log("Type:", type);

        if (!token || !type) {
            setStatus('error');
            setError('Invalid confirmation link');
            return;
        }

        if (type === 'signup') {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup'
          });

          if (error) throw error;

          setStatus('success');
          // Redirect to login after 3 seconds
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        } else if (type === 'recovery') {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'recovery'
          });

          if (error) throw error;

          setStatus('success');
          // Redirect to password reset page after 3 seconds
          setTimeout(() => {
            navigate('/reset-password');
          }, 3000);
        }
      } catch (error) {
        console.error('Error confirming email:', error);
        setStatus('error');
        setError(error.message);
      }
    };

    handleEmailConfirmation();
  }, [searchParams, navigate]);

  const getStatusMessage = () => {
    switch (status) {
      case 'verifying':
        return 'Verifying your email...';
      case 'success':
        return 'Email verified successfully! Redirecting...';
      case 'error':
        return `Error: ${error}`;
      default:
        return 'Something went wrong';
    }
  };

  return (
    <div className="confirmation-page" style={{ backgroundColor: themeColors.background }}>
      <div className="confirmation-container" style={{ backgroundColor: themeColors.surface }}>
        <div className="confirmation-content">
          <h1 style={{ color: themeColors.text }}>Email Confirmation</h1>
          <div className={`status-message ${status}`} style={{ color: themeColors.text }}>
            {getStatusMessage()}
          </div>
          {status === 'error' && (
            <button 
              className="retry-button"
              onClick={() => navigate('/login')}
              style={{ 
                backgroundColor: themeColors.primary,
                color: '#fff'
              }}
            >
              Return to Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Confirmation; 