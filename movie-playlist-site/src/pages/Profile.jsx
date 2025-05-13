import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../contexts/ThemeContext';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import './Profile.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const Profile = () => {
  const { currentUser, updateProfile, logout, calculateUserTasteProfile } = useUser();
  const { themeColors } = useTheme();
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    bio: ''
  });
  
  const [mode, setMode] = useState('view'); // 'view' or 'edit'
  const [message, setMessage] = useState(null);
  const [stats, setStats] = useState({
    totalMovies: 0,
    totalPlaylists: 0,
    totalFriends: 0
  });
  const [tasteProfile, setTasteProfile] = useState({});
  
  // Distinct color for each genre (colorblind-friendly palette)
  const genreColors = {
    Action: '#e6194b',
    Adventure: '#3cb44b',
    Animation: '#ffe119',
    Comedy: '#4363d8',
    Crime: '#f58231',
    Documentary: '#911eb4',
    Drama: '#46f0f0',
    Family: '#f032e6',
    Fantasy: '#bcf60c',
    History: '#fabebe',
    Horror: '#008080',
    Music: '#e6beff',
    Mystery: '#9a6324',
    Romance: '#fffac8',
    'Science Fiction': '#800000',
    Thriller: '#808000',
    War: '#ffd8b1',
    Western: '#000075'
  };
  
  useEffect(() => {
    if (currentUser) {
      setFormData({
        username: currentUser.username || '',
        email: currentUser.email || '',
        password: '',
        confirmPassword: '',
        bio: currentUser.bio || ''
      });
      // Get liked movies from the Liked playlist
      const likedPlaylist = (currentUser.playlists || []).find(p => p.name === 'Liked');
      const likedMovies = likedPlaylist ? likedPlaylist.movies : [];
      // Calculate stats
      const totalMovies = (currentUser.watchedMovies || []).length + likedMovies.length;
      const totalPlaylists = (currentUser.playlists || []).length;
      const totalFriends = 0; // We would calculate friends count from context
      setStats({ totalMovies, totalPlaylists, totalFriends });
      // Calculate taste profile from watched and liked movies
      const profile = calculateUserTasteProfile();
      setTasteProfile(profile);
    }
  }, [currentUser, calculateUserTasteProfile]);
  
  // Theme-based styles
  const pageStyle = {
    backgroundColor: themeColors.background, 
    color: themeColors.text
  };
  
  const sectionStyle = {
    backgroundColor: `${themeColors.surface}CC`,
    borderRadius: themeColors.radius,
    boxShadow: themeColors.shadow
  };

  const avatarStyle = {
    backgroundColor: themeColors.primary,
    color: themeColors.surface,
    boxShadow: `0 4px 10px ${themeColors.shadow}`
  };

  const genreTagStyle = {
    backgroundColor: `${themeColors.primary}20`,
    color: themeColors.primary
  };

  const genreOptionStyle = {
    backgroundColor: `${themeColors.background}30`,
    border: `1px solid ${themeColors.border}`,
    color: themeColors.text
  };

  const genreOptionSelectedStyle = {
    ...genreOptionStyle,
    backgroundColor: themeColors.primary,
    color: themeColors.surface,
    borderColor: themeColors.primary
  };

  const getMessageStyle = (type) => {
    switch (type) {
      case 'success':
        return { backgroundColor: 'rgba(39, 174, 96, 0.2)', color: '#2ecc71' };
      case 'error':
        return { backgroundColor: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c' };
      default:
        return {};
    }
  };

  const inputStyle = {
    backgroundColor: `${themeColors.background}30`,
    color: themeColors.text,
    borderColor: themeColors.border
  };

  const buttonStyle = {
    backgroundColor: themeColors.primary,
    color: themeColors.surface
  };

  const secondaryButtonStyle = {
    backgroundColor: 'transparent',
    color: themeColors.primary,
    borderColor: themeColors.primary
  };
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    
    if (formData.password && formData.password !== formData.confirmPassword) {
      setMessage({
        type: 'error',
        text: 'Passwords do not match'
      });
      return;
    }
    
    const updates = {
      username: formData.username,
      bio: formData.bio
    };
    
    // Only include password in updates if it was changed
    if (formData.password) {
      updates.password = formData.password;
    }
    
    try {
      const result = await updateProfile(updates);
      console.log("result", result);
      if (result.success) {
        setMessage({
          type: 'success',
          text: 'Profile updated successfully'
        });
        setMode('view');
      } else {
        setMessage({
          type: 'error',
          text: result.message || 'Failed to update profile'
        });
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setMessage({
        type: 'error',
        text: 'An error occurred. Please try again.'
      });
    }
  };
  
  const handleLogout = () => {
    logout();
  };
  
  return (
    <div className="page profile-page" style={pageStyle}>
      <div className="profile-header">
        <div className="profile-avatar" style={avatarStyle}>
          {currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'U'}
        </div>
        <div className="profile-info">
          <h2 style={{color: themeColors.primary}}>{currentUser.username}</h2>
          <p className="profile-email" style={{color: themeColors.textSecondary}}>{currentUser.email}</p>
          <div className="profile-stats">
            <div className="stat">
              <span className="stat-value" style={{color: themeColors.primary}}>{stats.totalPlaylists}</span>
              <span className="stat-label" style={{color: themeColors.textSecondary}}>Playlists</span>
            </div>
            <div className="stat">
              <span className="stat-value" style={{color: themeColors.primary}}>{stats.totalMovies}</span>
              <span className="stat-label" style={{color: themeColors.textSecondary}}>Movies</span>
            </div>
            <div className="stat">
              <span className="stat-value" style={{color: themeColors.primary}}>{stats.totalFriends}</span>
              <span className="stat-label" style={{color: themeColors.textSecondary}}>Friends</span>
            </div>
          </div>
        </div>
      </div>
      
      {message && (
        <div className={`message ${message.type}`} style={getMessageStyle(message.type)}>
          {message.text}
        </div>
      )}
      
      {mode === 'view' ? (
        <div className="profile-view">
          <div className="profile-section" style={sectionStyle}>
            <h3 style={{color: themeColors.primary}}>About</h3>
            <p>{currentUser.bio || 'No bio added yet.'}</p>
          </div>
          
          {/* Taste Profile Section */}
          <div className="profile-section taste-profile-section" style={sectionStyle}>
            <h3 style={{color: themeColors.primary}}>Taste Profile</h3>
            <p className="section-description">Based on your watched and liked movies</p>
            
            {Object.keys(tasteProfile).length > 0 ? (
              <div className="taste-profile-chart taste-profile-flex" style={{overflowX: 'auto'}}>
                <div className="taste-profile-pie-wrapper">
                  <Pie
                    data={{
                      labels: Object.keys(tasteProfile),
                      datasets: [
                        {
                          data: Object.values(tasteProfile),
                          backgroundColor: Object.keys(tasteProfile).map(
                            genre => genreColors[genre] || '#cccccc'
                          ),
                          borderWidth: 2,
                          borderColor: themeColors.surface,
                          hoverBorderColor: themeColors.primary,
                          hoverBorderWidth: 6,
                        },
                      ],
                    }}
                    width={370}
                    height={370}
                    options={{
                      responsive: false,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'right',
                          labels: {
                            color: themeColors.text,
                            padding: 10,
                            usePointStyle: true,
                            font: {
                              size: 14
                            },
                            boxWidth: 22,
                            boxHeight: 16,
                            maxWidth: 400,
                            maxHeight: 380,
                          },
                          title: {
                            position: 'left',
                            display: true,
                            text: 'Movie Genres',
                            color: themeColors.textSecondary,
                            font: {
                              size: 16,
                              weight: 'normal'
                            }
                          }
                        },
                        tooltip: {
                          backgroundColor: `${themeColors.surface}E6`,
                          titleColor: themeColors.primary,
                          bodyColor: themeColors.text,
                          borderColor: themeColors.primary,
                          borderWidth: 1,
                          padding: 12,
                          displayColors: true,
                          callbacks: {
                            title: (tooltipItems) => {
                              return tooltipItems[0].label;
                            },
                            label: (context) => {
                              return `${context.formattedValue}% of your movies`;
                            }
                          }
                        }
                      },
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="empty-profile-message">
                Your taste profile will appear here after you've watched or liked some movies.
              </p>
            )}
          </div>
          
          <div className="profile-actions">
            <button 
              className="button"
              onClick={() => setMode('edit')}
              style={buttonStyle}
            >
              Edit Profile
            </button>
            <button 
              className="button button-secondary"
              onClick={handleLogout}
              style={secondaryButtonStyle}
            >
              Log Out
            </button>
          </div>
        </div>
      ) : (
        <div className="profile-edit">
          <form onSubmit={handleSubmit}>
            <div className="form-control">
              <label htmlFor="username" style={{color: themeColors.textSecondary}}>Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                style={inputStyle}
              />
            </div>
            
            <div className="form-control">
              <label htmlFor="email" style={{color: themeColors.textSecondary}}>Email (cannot be changed)</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                disabled
                style={{...inputStyle, opacity: 0.7}}
              />
            </div>
            
            <div className="form-control">
              <label htmlFor="password" style={{color: themeColors.textSecondary}}>Password (leave blank to keep current)</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                style={inputStyle}
              />
            </div>
            
            <div className="form-control">
              <label htmlFor="confirmPassword" style={{color: themeColors.textSecondary}}>Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="••••••••"
                style={inputStyle}
              />
            </div>
            
            <div className="form-control">
              <label htmlFor="bio" style={{color: themeColors.textSecondary}}>Bio</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows="4"
                placeholder="Tell us about yourself and your movie tastes..."
                style={inputStyle}
              />
            </div>
            
            <div className="profile-actions">
              <button 
                type="submit"
                className="button"
                style={buttonStyle}
              >
                Save Changes
              </button>
              <button 
                type="button"
                className="button button-secondary"
                onClick={() => setMode('view')}
                style={secondaryButtonStyle}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Profile;