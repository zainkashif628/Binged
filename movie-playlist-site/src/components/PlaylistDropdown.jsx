import React, { useState, useEffect } from "react";
import { useUser } from "../contexts/UserContext";
import { useTheme } from "../contexts/ThemeContext";
import { playlistsService } from "../services/databaseSupabase";
import "./PlaylistDropdown.css";

const PlaylistDropdown = ({ movie, onPlaylistSelected, onClose }) => {
  const { currentUser } = useUser();
  const { themeColors } = useTheme();
  const [selected, setSelected] = useState("");
  const [playlists, setPlaylists] = useState([]);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPlaylists = async () => {
      if (currentUser) {
        setLoading(true);
        try {
          let userPlaylists = await playlistsService.getUserPlaylists(currentUser.id);
          // Filter out 'Liked' and 'Watched' playlists
          userPlaylists = userPlaylists.filter(p => p.name !== 'Liked' && p.name !== 'Watched');
          setPlaylists(userPlaylists);
        } catch (err) {
          setMessage({ type: 'error', text: 'Failed to load playlists' });
        } finally {
          setLoading(false);
        }
      }
    };
    fetchPlaylists();
  }, [currentUser]);

  const handleAdd = async () => {
    if (!selected) {
      setMessage({ type: 'error', text: 'Please select a playlist' });
      return;
    }
    setLoading(true);
    try {
      const playlist = playlists.find(p => p.id === selected || p.name === selected);
      if (!playlist) {
        setMessage({ type: 'error', text: 'Playlist not found' });
        setLoading(false);
        return;
      }
      if (playlist.movies.some(m => (m.movie_id || m.id) === (movie.movie_id || movie.id))) {
        setMessage({ type: 'info', text: `"${movie.title}" is already in "${playlist.name}"` });
        setLoading(false);
        return;
      }
      await playlistsService.addMovieToPlaylist(playlist.id, movie.movie_id || movie.id);
      setMessage({ type: 'success', text: `Added "${movie.title}" to "${playlist.name}"!` });
      if (onPlaylistSelected) onPlaylistSelected(selected);
      setSelected("");
      // Refresh playlists
      const userPlaylists = await playlistsService.getUserPlaylists(currentUser.id);
      setPlaylists(userPlaylists);
      setTimeout(() => { if (onClose) onClose(); }, 1500);
    } catch (err) {
      setMessage({ type: 'error', text: 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a playlist name' });
      return;
    }
    setLoading(true);
    try {
      const newPlaylist = await playlistsService.createPlaylist({
        name: newPlaylistName.trim(),
        user_id: currentUser.id,
        status: 'private'
      });
      await playlistsService.addMovieToPlaylist(newPlaylist.playlist_id, movie.movie_id || movie.id);
      setMessage({ type: 'success', text: `Created "${newPlaylistName}" and added "${movie.title}"!` });
      setNewPlaylistName("");
      setShowCreateNew(false);
      // Refresh playlists
      const userPlaylists = await playlistsService.getUserPlaylists(currentUser.id);
      setPlaylists(userPlaylists);
      setTimeout(() => { if (onClose) onClose(); }, 1500);
    } catch (err) {
      setMessage({ type: 'error', text: 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  // Apply theme-based styling
  const dropdownStyle = {
    backgroundColor: themeColors.surface,
    color: themeColors.text,
    borderColor: themeColors.border,
    boxShadow: themeColors.shadow
  };

  const headerStyle = {
    borderBottomColor: themeColors.border
  };

  const inputStyle = {
    backgroundColor: `${themeColors.background}30`,
    color: themeColors.text,
    borderColor: themeColors.border
  };

  const primaryBtnStyle = {
    backgroundColor: themeColors.primary,
    color: themeColors.surface
  };

  const secondaryBtnStyle = {
    backgroundColor: 'transparent',
    color: themeColors.textSecondary,
    borderColor: themeColors.border
  };

  const getMessageStyle = (type) => {
    switch (type) {
      case 'error':
        return { backgroundColor: 'rgba(255, 0, 0, 0.1)', color: '#ff3b3b' };
      case 'success':
        return { backgroundColor: 'rgba(39, 174, 96, 0.1)', color: '#2ecc71' };
      case 'info':
        return { backgroundColor: 'rgba(52, 152, 219, 0.1)', color: '#3498db' };
      default:
        return {};
    }
  };

  return (
    <div className="playlist-dropdown" style={dropdownStyle}>
      <div className="dropdown-header" style={headerStyle}>
        <h4 style={{ color: themeColors.primary }}>Add to Playlist</h4>
        <button 
          className="close-btn" 
          onClick={onClose}
          style={{ color: themeColors.textSecondary }}
        >
          ✕
        </button>
      </div>
      
      {message && (
        <div className={`message ${message.type}`} style={getMessageStyle(message.type)}>
          {message.text}
        </div>
      )}
      
      {showCreateNew ? (
        <div className="create-new-form">
          <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="New playlist name"
            className="new-playlist-input"
            style={inputStyle}
            autoFocus
          />
          <div className="dropdown-actions">
            <button 
              className="cancel-btn"
              onClick={() => setShowCreateNew(false)}
              style={secondaryBtnStyle}
            >
              Cancel
            </button>
            <button 
              className="create-btn"
              onClick={handleCreatePlaylist}
              style={primaryBtnStyle}
            >
              Create & Add
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="select-container">
            <select 
              value={selected} 
              onChange={(e) => setSelected(e.target.value)}
              className="playlist-select"
              style={inputStyle}
            >
              <option value="">Select a playlist...</option>
              {playlists.map((playlist) => (
                <option 
                  key={playlist.id || playlist.name} 
                  value={playlist.id || playlist.name}
                >
                  {playlist.name} ({playlist.movies?.length || 0})
                </option>
              ))}
            </select>
          </div>
          
          <div className="dropdown-actions">
            <button 
              className="new-btn"
              onClick={() => setShowCreateNew(true)}
              style={secondaryBtnStyle}
            >
              New Playlist
            </button>
            <button 
              className="add-btn confirm-btn"
              onClick={handleAdd}
              disabled={!selected}
              style={selected ? primaryBtnStyle : { ...primaryBtnStyle, opacity: 0.5 }}
              title="Add to Playlist"
            >
              <span className="arrow-icon">›</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PlaylistDropdown;