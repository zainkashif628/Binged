import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../contexts/ThemeContext';
import { playlistsService } from '../services/databaseSupabase';
import PlaylistCreator from '../components/PlaylistCreator';
import PlaylistsList from '../components/PlaylistsList';
import PlaylistDetail from '../components/PlaylistDetail';
import AuthPrompt from '../components/AuthPrompt';
import './Playlists.css';

// Use React.memo to prevent unnecessary re-renders of the entire component
const Playlists = React.memo(() => {
  const { currentUser } = useUser();
  const { themeColors } = useTheme();
  const navigate = useNavigate();
  
  // State for playlists management
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
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
  
  // Load playlists on component mount
  useEffect(() => {
    // if (currentUser) {
      loadPlaylists();
    // }
  }, [/* currentUser */]); // Comment out dependency but keep for future reference
  
  // Memoize the savePlaylist function to prevent unnecessary rerenders
  const savePlaylistsToStorage = useCallback((playlistsToSave) => {
    // Debounce the save operation to prevent rapid successive updates
    const handler = setTimeout(() => {
      try {
        // Always save playlists, even if empty array
        localStorage.setItem('playlists', JSON.stringify(playlistsToSave));
        
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
      // const loadedPlaylists = await playlistsService.getUserPlaylists(currentUser.id);
      const loadedPlaylists = await playlistsService.getUserPlaylists(currentUser.id);
      setPlaylists(loadedPlaylists);
    } catch (err) {
      console.error("Error loading playlists:", err);
      setError("Failed to load your playlists. Please refresh the page.");
    } finally {
      setIsLoading(false);
    }
  }, [/* currentUser */]); // Comment out dependency but keep for future reference
  
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
  }, [/* currentUser */]); // Comment out dependency but keep for future reference
  
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
      // Update playlist details
      await playlistsService.updatePlaylist(updatedPlaylist.id, {
        name: updatedPlaylist.name,
        status: updatedPlaylist.status
      });
      
      // Update movies in playlist
      const currentPlaylist = playlists.find(p => p.id === updatedPlaylist.id);
      if (currentPlaylist) {
        // Find movies to add
        const moviesToAdd = updatedPlaylist.movies.filter(
          newMovie => !currentPlaylist.movies.some(m => m.movie_id === newMovie.movie_id) && newMovie.movie_id
        );
        
        // Find movies to remove
        const moviesToRemove = currentPlaylist.movies.filter(
          oldMovie => !updatedPlaylist.movies.some(m => m.movie_id === oldMovie.movie_id) && oldMovie.movie_id
        );
        
        // Add new movies
        for (const movie of moviesToAdd) {
          if (movie.movie_id) {
            await playlistsService.addMovieToPlaylist(updatedPlaylist.id, movie.movie_id);
          }
        }
        
        // Remove old movies
        for (const movie of moviesToRemove) {
          if (movie.movie_id) {
            await playlistsService.removeMovieFromPlaylist(updatedPlaylist.id, movie.movie_id);
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
  }, [playlists]);
  
  // Select a playlist to view/edit
  const handleSelectPlaylist = useCallback((playlistId) => {
    setSelectedPlaylistId(playlistId);
  }, []);
  
  // Combine real playlists with the virtual Watched playlist
  const allPlaylists = useMemo(() => {
    if (!currentUser) return playlists;
    const watched = {
      id: 'watched',
      name: 'Watched',
      status: 'special',
      user_id: currentUser.id,
      movies: currentUser.watchedPlaylist || []
    };
    // Only add if there are watched movies
    if (watched.movies && watched.movies.length > 0) {
      return [watched, ...playlists];
    }
    return playlists;
  }, [playlists, currentUser]);
  
  // Get the selected playlist
  const selectedPlaylist = useMemo(() => {
    return allPlaylists.find(playlist => playlist.id === selectedPlaylistId);
  }, [allPlaylists, selectedPlaylistId]);

  // Clear any error messages
  const dismissError = () => {
    setError(null);
  };
  
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
        </>
      )}
    </div>
  );
});

export default Playlists;