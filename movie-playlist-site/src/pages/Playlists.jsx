import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../contexts/ThemeContext';
import { playlistsService, watchedMoviesService } from '../services/databaseSupabase';
import PlaylistCreator from '../components/PlaylistCreator';
import PlaylistsList from '../components/PlaylistsList';
import PlaylistDetail from '../components/PlaylistDetail';
import Chatbot from '../components/Chatbot';
import AuthPrompt from '../components/AuthPrompt';
import './Playlists.css';

// Use React.memo to prevent unnecessary re-renders of the entire component
const Playlists = React.memo(() => {
  const { currentUser, users, getActiveFriends } = useUser();
  const { themeColors } = useTheme();
  const navigate = useNavigate();
  
  // State for playlists management
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [watchedMovies, setWatchedMovies] = useState([]);
  
  // State for send-to-friend modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [playlistToSend, setPlaylistToSend] = useState(null);
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sendSuccess, setSendSuccess] = useState(null);
  
  // Stabilize component render cycles with a render counter
  const renderCount = React.useRef(0);
  
  // Calculate themed styles using themeColors
  const themedStyles = useMemo(() => ({
    emptyState: {
      backgroundColor: `${themeColors.surface}CC`,
      borderLeft: `4px solid ${themeColors.primary}`
    },
    errorMessage: {
      backgroundColor: `${themeColors.error}33`,
      borderLeft: `4px solid ${themeColors.error}`
    },
    loadingSpinner: {
      borderColor: `${themeColors.primary}33`,
      borderLeftColor: themeColors.primary
    },
    emptyPlaylistSelection: {
      backgroundColor: `${themeColors.surface}99`,
      border: `1px solid ${themeColors.primary}33`
    }
  }), [themeColors]);
  
  // Load playlists and watched movies on mount
  useEffect(() => {
    if (currentUser) {
      loadPlaylists();
      loadWatchedMovies();
    }
  }, [currentUser]);
  
  // Memoize the savePlaylist function to prevent unnecessary rerenders
  const savePlaylistsToStorage = useCallback((playlistsToSave) => {
    // Debounce the save operation to prevent rapid successive updates
    const handler = setTimeout(() => {
      try {
        // If user is logged in, update their profile with the playlists
        if (currentUser) {
          // Assuming updateProfile is called elsewhere in the code

        }
      } catch (err) {
        console.error("Error saving playlists:", err);
        setError("Failed to save your playlists. Please try again.");
      }
    }, 300); // Debounce delay
    
    return () => clearTimeout(handler);
  }, [currentUser]);
  
  // Save playlists when they change
  useEffect(() => {
    // Don't save during initial loading or when no real change has happened
    if (!isLoading && renderCount.current > 1) {
      const cleanup = savePlaylistsToStorage(playlists);
      return () => cleanup();
    }
    renderCount.current += 1;
  }, [playlists, isLoading, savePlaylistsToStorage]);
  
  // Load playlists from Supabase
  const loadPlaylists = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedPlaylists = await playlistsService.getUserPlaylists(currentUser.id);
      setPlaylists(loadedPlaylists);
    } catch (err) {
      console.error("Error loading playlists:", err);
      setError("Failed to load your playlists. Please refresh the page.");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);
  
  const loadWatchedMovies = useCallback(async () => {
    try {
      const movies = await watchedMoviesService.getWatchedPlaylist(currentUser.id);
      setWatchedMovies(movies);
    } catch (err) {
      setError("Failed to load your watched movies.");
    }
  }, [currentUser]);
  
  // Create a new playlist
  const handleCreatePlaylist = useCallback(async (playlistName) => {
    try {
      if (!playlistName || playlistName.trim() === '') {
        setError("Playlist name cannot be empty.");
        return;
      }
      
      const newPlaylist = await playlistsService.createPlaylist({
        name: playlistName.trim(),
        // user_id: currentUser.id,
        user_id: currentUser.id, // UUID format
        status: 'private'
      });
      
      // Transform the response to match the expected structure
      const transformedPlaylist = {
        id: newPlaylist.playlist_id,
        name: newPlaylist.name,
        status: newPlaylist.status,
        user_id: newPlaylist.user_id,
        movies: []
      };
      
      setPlaylists(currentPlaylists => [...currentPlaylists, transformedPlaylist]);
      
      // Auto-select the newly created playlist
      setSelectedPlaylistId(transformedPlaylist.id);
      
    } catch (err) {
      console.error("Error creating playlist:", err);
      setError("Failed to create playlist. Please try again.");
    }
  }, [currentUser]);
  
  // Delete a playlist
  const handleDeletePlaylist = useCallback(async (playlistId) => {
    try {
      await playlistsService.deletePlaylist(playlistId);
      
      setPlaylists(currentPlaylists => {
        if (selectedPlaylistId === playlistId) {
          setSelectedPlaylistId(null);
        }
        return currentPlaylists.filter(playlist => playlist.id !== playlistId);
      });
    } catch (err) {
      console.error("Error deleting playlist:", err);
      setError("Failed to delete playlist. Please try again.");
    }
  }, [selectedPlaylistId]);
  
  // Update a playlist
  const handleUpdatePlaylist = useCallback(async (updatedPlaylist) => {
    try {
      // Update playlist details (skip for 'watched')
      if (updatedPlaylist.id !== 'watched') {
        await playlistsService.updatePlaylist(updatedPlaylist.id, {
          name: updatedPlaylist.name,
          status: updatedPlaylist.status
        });
      }

      // Update movies in playlist
      const currentPlaylist = playlists.find(p => p.id === updatedPlaylist.id);
      if (currentPlaylist) {
        // Find movies to add
        const moviesToAdd = updatedPlaylist.movies.filter(
          newMovie => !currentPlaylist.movies.some(m => (m.movie_id || m.id) === (newMovie.movie_id || newMovie.id)) && (newMovie.movie_id || newMovie.id)
        );
        // Find movies to remove
        const moviesToRemove = currentPlaylist.movies.filter(
          oldMovie => !updatedPlaylist.movies.some(m => (m.movie_id || m.id) === (oldMovie.movie_id || oldMovie.id)) && (oldMovie.movie_id || oldMovie.id)
        );
        // Add new movies
        for (const movie of moviesToAdd) {
          const movieId = movie.movie_id || movie.id;
          if (movieId) {
            if (updatedPlaylist.id === 'watched') {
              await watchedMoviesService.addWatchedMovie(currentUser.id, movieId);
            } else {
              await playlistsService.addMovieToPlaylist(updatedPlaylist.id, movieId);
            }
          }
        }
        // Remove old movies
        console.log("idher aya 1");
        for (const movie of moviesToRemove) {
          console.log("idher aya 2");
          const movieId = movie.movie_id || movie.id;
          if (movieId) {
            console.log("idher aya 3");
            if (updatedPlaylist.id === 'watched') {
              console.log("idher aya 4");
              await watchedMoviesService.removeWatchedMovie(currentUser.id, movieId);
            } else {
              console.log("idher aya 5");
              await playlistsService.removeMovieFromPlaylist(updatedPlaylist.id, movieId);
            }
          }
        }
      }
      // Update local state
      setPlaylists(currentPlaylists => 
        currentPlaylists.map(playlist => 
          playlist.id === updatedPlaylist.id ? updatedPlaylist : playlist
        )
      );
    } catch (err) {
      console.error("Error updating playlist:", err);
      setError("Failed to update playlist. Please try again.");
    }
  }, [playlists, currentUser]);
  
  // Select a playlist to view/edit
  const handleSelectPlaylist = useCallback((playlistId) => {
    setSelectedPlaylistId(playlistId);
  }, []);
  
  // Combine watched playlist with real playlists
  const allPlaylists = useMemo(() => {
    if (!currentUser) return playlists;
    const watchedPlaylist = {
      id: 'watched',
      name: 'Watched',
      status: 'special',
      user_id: currentUser.id,
      movies: watchedMovies
    };
    return [watchedPlaylist, ...playlists];
  }, [watchedMovies, playlists, currentUser]);
  
  // Get the selected playlist
  const selectedPlaylist = useMemo(() => {
    return allPlaylists.find(playlist => playlist.id === selectedPlaylistId);
  }, [allPlaylists, selectedPlaylistId]);

  // Clear any error messages
  const dismissError = () => {
    setError(null);
  };
  
  // Send playlist to friend
  const handleSendPlaylist = useCallback((playlist) => {
    setPlaylistToSend(playlist);
    setShowSendModal(true);
    setSelectedFriendId("");
    setSendError(null);
    setSendSuccess(null);
  }, []);

  const handleConfirmSend = useCallback(async () => {
    if (!selectedFriendId || !playlistToSend) return;
    setSending(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      // Find the friend user object
      const friend = users.find(u => u.id === selectedFriendId);
      if (!friend) throw new Error("Friend not found");
      // Prepare playlist data
      // If playlist name already has a (from ...) suffix, replace it; otherwise, add it
      const suffixRegex = /\s*\(from [^)]+\)$/;
      let newPlaylistName;
      if (suffixRegex.test(playlistToSend.name)) {
        newPlaylistName = playlistToSend.name.replace(suffixRegex, ` (from ${currentUser.username})`);
      } else {
        newPlaylistName = `${playlistToSend.name} (from ${currentUser.username})`;
      }
      const newPlaylist = await playlistsService.createPlaylist({
        name: newPlaylistName,
        user_id: friend.id,
        status: 'private'
      });
      // Add all movies to the new playlist
      for (const movie of playlistToSend.movies) {
        await playlistsService.addMovieToPlaylist(newPlaylist.playlist_id, movie.movie_id || movie.id);
      }
      setSendSuccess(`Playlist sent to ${friend.username}!`);
      setTimeout(() => {
        setShowSendModal(false);
        setPlaylistToSend(null);
        setSelectedFriendId("");
        setSendSuccess(null);
      }, 1500);
    } catch (err) {
      setSendError("Failed to send playlist. Please try again.");
    } finally {
      setSending(false);
    }
  }, [selectedFriendId, playlistToSend, users, currentUser]);
  
  // In the send to friend modal, only show friends
  const friendsList = getActiveFriends ? getActiveFriends() : [];
  
  // If user is not logged in, show auth prompt
  if (!currentUser) {
    return <AuthPrompt onLogin={() => navigate('/login')} />;
  }
  
  return (
    <div className="page playlists-page" style={{ backgroundColor: themeColors.background }}>
      <h1 className="section-heading" style={{ color: themeColors.text }}>
        Your Movie Playlists
      </h1>
      
      {/* Error message display with themed styles */}
      {error && (
        <div className="error-message" onClick={dismissError} style={themedStyles.errorMessage}>
          {error} <span className="dismiss-error">(Click to dismiss)</span>
        </div>
      )}
      
      {/* Loading state with themed spinner */}
      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner" style={themedStyles.loadingSpinner}></div>
          <p style={{ color: themeColors.text }}>Loading your playlists...</p>
        </div>
      ) : (
        <>
          {/* Create new playlist section */}
          <PlaylistCreator onCreatePlaylist={handleCreatePlaylist} />
          
          {/* Empty state when no playlists exist */}
          {allPlaylists.length === 0 ? (
            <div className="empty-state" style={themedStyles.emptyState}>
              <h3 style={{ color: themeColors.text }}>You don't have any playlists yet</h3>
              <p style={{ color: themeColors.textSecondary }}>Create your first playlist above to get started!</p>
            </div>
          ) : (
            /* Main content area with playlist list and details */
            <div className="playlists-container">
              {/* Sidebar with playlists list */}
              <div className="playlists-sidebar">
                <PlaylistsList 
                  playlists={allPlaylists} 
                  selectedPlaylistId={selectedPlaylistId}
                  onSelectPlaylist={handleSelectPlaylist}
                  onDeletePlaylist={handleDeletePlaylist}
                  onSendPlaylist={handleSendPlaylist}
                />
              </div>
              
              {/* Main content area - selected playlist details */}
              <div className="playlist-detail-container">
                {selectedPlaylist ? (
                  <PlaylistDetail
                    playlist={selectedPlaylist}
                    onUpdatePlaylist={handleUpdatePlaylist}
                  />
                ) : (
                  <div className="empty-playlist-selection" style={themedStyles.emptyPlaylistSelection}>
                    <h3 style={{ color: themeColors.text }}>Select a playlist to view and edit</h3>
                    <p style={{ color: themeColors.textSecondary }}>Choose a playlist from the sidebar or create a new one</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Send to Friend Modal */}
          {showSendModal && playlistToSend && (
            <div className="send-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="send-modal" style={{ background: '#fff', padding: 32, borderRadius: 12, minWidth: 320, boxShadow: '0 4px 24px rgba(0,0,0,0.2)', position: 'relative' }}>
                <button onClick={() => setShowSendModal(false)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer' }}>×</button>
                <h3 style={{ marginBottom: 16, color: 'black' }}>Send "{playlistToSend.name}" to a Friend</h3>
                <label htmlFor="friend-select" style={{ color: 'black' }}>Select Friend:</label>
                <select
                  id="friend-select"
                  value={selectedFriendId}
                  onChange={e => setSelectedFriendId(e.target.value)}
                  style={{ width: '100%', padding: 8, margin: '12px 0 20px 0', borderRadius: 6 }}
                  disabled={sending}
                >
                  <option value="">Choose a friend...</option>
                  {friendsList.filter(f => f.id !== currentUser.id).map(friend => (
                    <option key={friend.id} value={friend.id}>{friend.username}</option>
                  ))}
                </select>
                <button
                  onClick={handleConfirmSend}
                  disabled={!selectedFriendId || sending}
                  style={{ background: '#3498db', color: '#fff', padding: '8px 20px', borderRadius: 6, border: 'none', fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer' }}
                >
                  {sending ? 'Sending...' : 'Send Playlist'}
                </button>
                {sendError && <div style={{ color: 'red', marginTop: 12 }}>{sendError}</div>}
                {sendSuccess && <div style={{ color: 'green', marginTop: 12 }}>{sendSuccess}</div>}
              </div>
            </div>
          )}
        </>
      )}
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
    </div>
  );
});

export default Playlists;