import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Chatbot from '../components/Chatbot';


const MoodRecommend = () => {
  const { themeColors } = useTheme();
  
  const containerStyle = {
    padding: '2rem',
    backgroundColor: themeColors.surface,
    color: themeColors.text,
    borderRadius: '8px',
    boxShadow: themeColors.shadow,
  };
  
  const titleStyle = {
    color: themeColors.primary,
    marginBottom: '1rem',
  };
  
  const descriptionStyle = {
    color: themeColors.textSecondary,
  };

  return (
    <>
      <div className="page" style={containerStyle}>
        <h2 style={titleStyle}>AI Mood Recommendations</h2>
        <p style={descriptionStyle}>Tell us how you're feeling and get movie suggestions.</p>
      </div>
      {/* Floating Chatbot Window */}
      <div style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 1000,
        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
        borderRadius: 8,
        background: "#fff"
      }}>
        <Chatbot />
      </div>
    </>
  );
};

export default MoodRecommend;