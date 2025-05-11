import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { playlistsService, watchedMoviesService } from '../services/databaseSupabase';
import { supabase } from '../services/supabaseClient';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  // --- Auth/session state ---
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const sessionTimeout = useRef(null);
  const isNavigating = useRef(false);

  // --- App state ---
  const [users, setUsers] = useState(() => {
    const savedUsers = localStorage.getItem('users');
    return savedUsers ? JSON.parse(savedUsers) : [];
  });
  const [friends, setFriends] = useState(() => {
    const savedFriends = localStorage.getItem('friends');
    return savedFriends ? JSON.parse(savedFriends) : [];
  });

  // --- Cleanup function for user data ---
  const cleanupUserData = useCallback(() => {
    if (!mounted.current) return;
    setCurrentUser(null);
    setSession(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('sessionExpiry');
    localStorage.removeItem('userPlaylists');
    localStorage.removeItem('userConnections');
    localStorage.removeItem('friends');
    supabase.removeAllChannels();
  }, []);

  // --- Auth state change handler ---
  const handleAuthStateChange = useCallback(async (event, session) => {
    if (!mounted.current) return;
    if (sessionTimeout.current) {
      clearTimeout(sessionTimeout.current);
    }
    sessionTimeout.current = setTimeout(() => {
      if (mounted.current) {
        if (event === 'SIGNED_OUT') {
          cleanupUserData();
        } else if (event === 'TOKEN_REFRESHED' && session) {
          localStorage.setItem('sessionExpiry', new Date(session.expires_at).toISOString());
        }
        if (!isNavigating.current) {
          setSession(session);
        }
      }
    }, 100);
  }, [cleanupUserData]);

  // --- Initialize auth and subscribe to auth changes ---
  useEffect(() => {
    mounted.current = true;
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (mounted.current) {
          sessionTimeout.current = setTimeout(() => {
            if (mounted.current && !isNavigating.current) {
              setSession(currentSession);
              setLoading(false);
            }
          }, 100);
        }
      } catch (error) {
        console.error('Error getting session:', error);
        if (mounted.current) {
          setLoading(false);
        }
      }
    };
    initializeAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);
    return () => {
      mounted.current = false;
      if (sessionTimeout.current) {
        clearTimeout(sessionTimeout.current);
      }
      subscription.unsubscribe();
    };
  }, [handleAuthStateChange]);

  // --- LocalStorage syncs ---
  useEffect(() => {
    if (!mounted.current) return;
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('currentUser');
    }
  }, [currentUser]);
  useEffect(() => {
    if (!mounted.current) return;
    localStorage.setItem('users', JSON.stringify(users));
  }, [users]);
  useEffect(() => {
    if (!mounted.current) return;
    localStorage.setItem('friends', JSON.stringify(friends));
  }, [friends]);

  // --- Social/friends logic ---
  const getActiveFriends = useCallback(() => {
    if (!currentUser) return [];
    return friends.filter(friend => 
      friend.status === 'accepted' && 
      (friend.user_id === currentUser.id || friend.friend_id === currentUser.id)
    ).map(friend => {
      const friendId = friend.user_id === currentUser.id ? friend.friend_id : friend.user_id;
      const friendUser = users.find(u => u.id === friendId);
      return {
        ...friend,
        user: friendUser,
        compatibility: calculateCompatibility(friendUser)
      };
    });
  }, [currentUser, friends, users]);

  const getFriendRequests = useCallback(() => {
    if (!currentUser) return [];
    return friends.filter(friend => 
      friend.status === 'pending' && 
      friend.friend_id === currentUser.id
    ).map(friend => {
      const requestingUser = users.find(u => u.id === friend.user_id);
      return {
        ...friend,
        user: requestingUser
      };
    });
  }, [currentUser, friends, users]);

  const addFriend = useCallback(async (userId) => {
    if (!currentUser) return { success: false, message: 'Not logged in' };
    try {
      const { data, error } = await supabase
        .from('user_connections')
        .insert([
          {
            user_id: currentUser.id,
            friend_id: userId,
            status: 'pending'
          }
        ]);
      if (error) throw error;
      const newFriend = {
        id: data[0].id,
        user_id: currentUser.id,
        friend_id: userId,
        status: 'pending'
      };
      setFriends(prev => [...prev, newFriend]);
      return { success: true, data: newFriend };
    } catch (error) {
      console.error('Error adding friend:', error);
      return { success: false, message: error.message };
    }
  }, [currentUser]);

  const acceptFriendRequest = useCallback(async (friendshipId) => {
    if (!currentUser) return { success: false, message: 'Not logged in' };
    try {
      const { data, error } = await supabase
        .from('user_connections')
        .update({ status: 'accepted' })
        .eq('id', friendshipId)
        .eq('friend_id', currentUser.id);
      if (error) throw error;
      setFriends(prev => 
        prev.map(friend => 
          friend.id === friendshipId 
            ? { ...friend, status: 'accepted' }
            : friend
        )
      );
      return { success: true, data };
    } catch (error) {
      console.error('Error accepting friend request:', error);
      return { success: false, message: error.message };
    }
  }, [currentUser]);

  // Helper function to calculate compatibility between users
  const calculateCompatibility = useCallback((friendUser) => {
    if (!currentUser || !friendUser) return 0;
    const currentUserPrefs = currentUser.favoriteGenres || [];
    const friendUserPrefs = friendUser.favoriteGenres || [];
    const commonGenres = currentUserPrefs.filter(genre => 
      friendUserPrefs.includes(genre)
    );
    const totalGenres = new Set([...currentUserPrefs, ...friendUserPrefs]).size;
    const compatibilityScore = totalGenres > 0 
      ? Math.round((commonGenres.length / totalGenres) * 100)
      : 0;
    return compatibilityScore;
  }, [currentUser]);

  // --- Playlist/like logic (Supabase-powered) ---
  const addToDefaultPlaylist = async (movie, playlistName, add = true) => {
    if (!currentUser) return { success: false, message: 'Not logged in' };
    try {
      let playlists = await playlistsService.getUserPlaylists(currentUser.id);
      let likedPlaylist = playlists.find(p => p.name === playlistName);
      if (!likedPlaylist) {
        likedPlaylist = await playlistsService.createPlaylist({
          name: playlistName,
          status: 'private',
          user_id: currentUser.id
        });
        playlists = await playlistsService.getUserPlaylists(currentUser.id);
        likedPlaylist = playlists.find(p => p.name === playlistName);
      }
      if (add) {
        await playlistsService.addMovieToPlaylist(likedPlaylist.id, movie.movie_id || movie.id);
      } else {
        await playlistsService.removeMovieFromPlaylist(likedPlaylist.id, movie.movie_id || movie.id);
      }
      // Refresh playlists and watchedMovies
      const updatedPlaylists = await playlistsService.getUserPlaylists(currentUser.id);
      const updatedWatched = await watchedMoviesService.getWatchedMovies(currentUser.id);
      const watchedPlaylist = await watchedMoviesService.getWatchedPlaylist(currentUser.id);
      setCurrentUser({ ...currentUser, playlists: updatedPlaylists, watchedMovies: updatedWatched, watchedPlaylist });
      return { success: true };
    } catch (err) {
      console.error('Error updating Liked playlist:', err);
      return { success: false, message: err.message };
    }
  };

  // --- Watched logic (Supabase-powered) ---
  const addToWatched = async (movie, add = true) => {
    if (!currentUser) return { success: false, message: 'Not logged in' };
    try {
      if (add) {
        await watchedMoviesService.addWatchedMovie(currentUser.id, movie.movie_id || movie.id);
      } else {
        await watchedMoviesService.removeWatchedMovie(currentUser.id, movie.movie_id || movie.id);
      }
      // Refresh watchedMovies and playlists
      const watched = await watchedMoviesService.getWatchedMovies(currentUser.id);
      const updatedPlaylists = await playlistsService.getUserPlaylists(currentUser.id);
      const watchedPlaylist = await watchedMoviesService.getWatchedPlaylist(currentUser.id);
      setCurrentUser({ ...currentUser, watchedMovies: watched, playlists: updatedPlaylists, watchedPlaylist });
      return { success: true };
    } catch (err) {
      console.error('Error updating Watched:', err);
      return { success: false, message: err.message };
    }
  };

  // On login, fetch watchedPlaylist as well
  useEffect(() => {
    if (currentUser && currentUser.id) {
      (async () => {
        try {
          const watchedPlaylist = await watchedMoviesService.getWatchedPlaylist(currentUser.id);
          setCurrentUser(prev => ({ ...prev, watchedPlaylist }));
        } catch (err) {
          // ignore
        }
      })();
    }
  }, [currentUser && currentUser.id]);

  // --- Logout function (Supabase sign out + cleanup) ---
  const logout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      cleanupUserData();
      return { success: true };
    } catch (error) {
      console.error('Error signing out:', error);
      cleanupUserData();
      return { success: false, error: error.message };
    }
  }, [cleanupUserData]);

  // --- Context value ---
  const value = {
    currentUser,
    session,
    loading,
    users,
    friends,
    setCurrentUser,
    logout,
    getActiveFriends,
    getFriendRequests,
    addFriend,
    acceptFriendRequest,
    isNavigating,
    addToDefaultPlaylist,
    addToWatched
  };

  return (
    <UserContext.Provider value={value}>
      {!loading && children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserProvider;