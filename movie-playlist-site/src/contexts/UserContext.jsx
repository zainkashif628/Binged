import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { playlistsService, watchedMoviesService, usersService, friendsService } from '../services/databaseSupabase';
import { supabase } from '../services/supabaseClient';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  // --- Auth/session state ---
  const [currentUser, setCurrentUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const sessionTimeout = useRef(null);
  const isNavigating = useRef(false);

  // --- App state ---
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);

  // --- Cleanup function for user data ---
  const cleanupUserData = useCallback(() => {
    if (!mounted.current) return;
    setCurrentUser(null);
    setSession(null);
    setUsers([]);
    setFriends([]);
    supabase.removeAllChannels();
  }, []);

  // --- Register new user with Supabase Auth ---
  const register = async (username, email, password) => {
    try {
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username }
        }
      });
      if (error) return { success: false, message: error.message };
      // Insert user profile into user table (if not auto-created)
      const userId = data.user?.id;
      if (userId) {
        await usersService.getUserById(userId); // Will throw if not found
      }
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // --- Login user with Supabase Auth ---
  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) return { success: false, message: error.message };
      console.log("data", data);
      setSession(data.session);
      console.log("session", session);
      // Fetch full user profile with playlists and watchedMovies
      const userId = data.user.id;
      // Fetch user profile
      const userProfile = await usersService.getUserById(userId);
      // Fetch playlists and watchedMovies
      const playlists = await playlistsService.getUserPlaylists(userId);
      let watchedMovies = [];
      try {
        watchedMovies = await watchedMoviesService.getWatchedMovies(userId);
      } catch (e) {
        watchedMovies = [];
      }
      setCurrentUser({ ...userProfile, playlists, watchedMovies });
      setLoading(false);
      return { success: true, user: { ...userProfile, playlists, watchedMovies } };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // --- Logout user with Supabase Auth ---
  const logout = async () => {
    await supabase.auth.signOut();
    cleanupUserData();
  };

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
          // No-op for now
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

  // --- Fetch users and friends from Supabase ---
  useEffect(() => {
    if (!session) return;
    const fetchData = async () => {
      try {
        // Fetch all users
        const allUsers = await usersService.getAllUsers();
        // Fetch playlists and watchedMovies for each user
        const usersWithData = await Promise.all(
          allUsers.map(async user => {
            const playlists = await playlistsService.getUserPlaylists(user.id);
            let watchedMovies = [];
            try {
              watchedMovies = await watchedMoviesService.getWatchedMovies(user.id);
            } catch (e) {
              watchedMovies = [];
            }
            return { ...user, playlists, watchedMovies };
          })
        );
        setUsers(usersWithData);
        // Fetch all friendships for the current user
        const allFriends = await friendsService.getAllFriends(session.user.id);
        setFriends(allFriends);
        // Fetch current user profile with playlists and watchedMovies
        const userProfile = usersWithData.find(u => u.id === session.user.id);
        setCurrentUser(userProfile);
      } catch (err) {
        console.error('Error fetching users/friends:', err);
      }
    };
    fetchData();
  }, [session]);

  // Get active friends (accepted status)
  const getActiveFriends = () => {
    if (!currentUser) return [];
    
    return friends
      .filter(f => 
        f.status === 'accepted' && 
        (f.user_id === currentUser.id || f.friend_id === currentUser.id)
      )
      .map(f => { 
        const friendId = f.user_id === currentUser.id ? f.friend_id : f.user_id;
        const friendUser = users.find(u => u.id === friendId);
        
        if (friendUser) {
          return {
            ...friendUser,
            compatibility: calculateBlendCompatibility(friendUser.id)
          };
        }
        
        return null;
      })
      .filter(Boolean);
  };

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
      // Use new friendsService.addFriend (composite key logic handled in service)
      const newFriend = await friendsService.addFriend(currentUser.id, userId);
      setFriends(prev => [...prev, newFriend]);
      return { success: true, data: newFriend };
    } catch (error) {
      console.error('Error adding friend:', error);
      return { success: false, message: error.message };
    }
  }, [currentUser]);

  // Accept friend request: pass both user IDs
  const acceptFriendRequest = useCallback(async (friendUserId) => {
    if (!currentUser) return { success: false, message: 'Not logged in' };
    try {
      // Use new friendsService.acceptFriendRequest (composite key logic handled in service)
      const updated = await friendsService.acceptFriendRequest(currentUser.id, friendUserId);
      setFriends(prev => 
        prev.map(friend => {
          // Update the correct friendship row (composite key match)
          const least_id = currentUser.id < friendUserId ? currentUser.id : friendUserId;
          const greatest_id = currentUser.id > friendUserId ? currentUser.id : friendUserId;
          const friend_least_id = friend.least_id || (friend.user_id < friend.friend_id ? friend.user_id : friend.friend_id);
          const friend_greatest_id = friend.greatest_id || (friend.user_id > friend.friend_id ? friend.user_id : friend.friend_id);
          if (friend_least_id === least_id && friend_greatest_id === greatest_id) {
            return { ...friend, status: 'accepted' };
          }
          return friend;
        })
      );
      return { success: true, data: updated };
    } catch (error) {
      console.error('Error accepting friend request:', error);
      return { success: false, message: error.message };
    }
  }, [currentUser]);

  const declineFriendRequest = useCallback(async (friendId) => {
    if (!currentUser) return { success: false, message: 'Not logged in' };
    try {
      // Use new friendsService.declineFriendRequest (composite key logic handled in service)
      await friendsService.declineFriendRequest(currentUser.id, friendId);
      setFriends(getActiveFriends());
      return { success: true };
    } catch (error) {
      console.error('Error declining friend request:', error);
      return { success: false, message: error.message };
    }
  }, [currentUser, getActiveFriends, getFriendRequests]);

  const calculateBlendCompatibility = (userId) => {
    if (!currentUser) return 0;
    const otherUser = users.find(user => user.id === userId);
    if (!otherUser) return 0;
    // Helper to get liked movie IDs from the Liked playlist
    const getLikedMovieIds = (user) => {
      const likedPlaylist = user.playlists?.find(p => p.name === 'Liked');
      return likedPlaylist ? likedPlaylist.movies.map(m => m.movie_id || m.id) : [];
    };
    const myLiked = new Set(getLikedMovieIds(currentUser));
    const theirLiked = new Set(getLikedMovieIds(otherUser));
    // Get movie IDs from playlists
    const myPlaylistMovies = new Set();
    const theirPlaylistMovies = new Set();
    if (currentUser.playlists && currentUser.playlists.length > 0) {
      currentUser.playlists.forEach(playlist => {
        if (playlist.movies && playlist.movies.length > 0) {
          playlist.movies.forEach(movie => {
            if (movie && (movie.movie_id || movie.id)) {
              myPlaylistMovies.add(movie.movie_id || movie.id);
            }
          });
        }
      });
    }
    if (otherUser.playlists && otherUser.playlists.length > 0) {
      otherUser.playlists.forEach(playlist => {
        if (playlist.movies && playlist.movies.length > 0) {
          playlist.movies.forEach(movie => {
            if (movie && (movie.movie_id || movie.id)) {
              theirPlaylistMovies.add(movie.movie_id || movie.id);
            }
          });
        }
      });
    }
    // Combine liked movies with playlist movies
    const allMyMovies = new Set([...myLiked, ...myPlaylistMovies]);
    const allTheirMovies = new Set([...theirLiked, ...theirPlaylistMovies]);
    // Intersection of all movies (common movies)
    const commonMovies = [...allMyMovies].filter(id => allTheirMovies.has(id));
    // Calculate compatibility percentage
    const totalUniqueMovies = new Set([...allMyMovies, ...allTheirMovies]);
    const movieOverlapScore = totalUniqueMovies.size > 0 
      ? Math.round((commonMovies.length / totalUniqueMovies.size) * 100)
      : 0;
    // Calculate genre match percentage (50% movie overlap, 50% genre match)
    const genreMatchScore = calculateGenreMatchPercentage(currentUser.id, userId);
    // Weighted average of both scores
    return Math.round((movieOverlapScore * 0.5) + (genreMatchScore * 0.5));
  };


  // --- Playlist/like logic (Supabase-powered) ---
  const addToDefaultPlaylist = async (movie, playlistName, add = true) => {
    if (!currentUser) return { success: false, message: 'Not logged in' };
    try {
      let playlists = await playlistsService.getUserPlaylists(currentUser.id);
      let defaultPlaylist = playlists.find(p => p.name === playlistName);
      if (!defaultPlaylist) {
        defaultPlaylist = await playlistsService.createPlaylist({
          name: playlistName,
          status: 'private',
          user_id: currentUser.id
        });
        playlists = await playlistsService.getUserPlaylists(currentUser.id);
        defaultPlaylist = playlists.find(p => p.name === playlistName);
      }
      if (add) {
        await playlistsService.addMovieToPlaylist(defaultPlaylist.id, movie.movie_id || movie.id);
      } else {
        await playlistsService.removeMovieFromPlaylist(defaultPlaylist.id, movie.movie_id || movie.id);
      }
      // Refresh playlists
      const updatedPlaylists = await playlistsService.getUserPlaylists(currentUser.id);
      setCurrentUser({ ...currentUser, playlists: updatedPlaylists });
      return { success: true };
    } catch (err) {
      console.error('Error updating playlist:', err);
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
      setCurrentUser({ ...currentUser, watchedMovies: watched, playlists: updatedPlaylists });
      return { success: true };
    } catch (err) {
      console.error('Error updating Watched:', err);
      return { success: false, message: err.message };
    }
  };

  // --- Update user profile in Supabase ---
  const updateProfile = async (updates) => {
    if (!currentUser) return { success: false, message: 'Not logged in' };
    try {
      // Only update allowed fields
      const allowed = ['username', 'bio'];
      const updateObj = {};
      allowed.forEach(key => {
        if (updates[key] !== undefined) updateObj[key] = updates[key];
      });
      // Update user table
      const { data, error } = await supabase
        .from('user')
        .update(updateObj)
        .eq('id', currentUser.id)
        .select()
        .single();

      if (error) return { success: false, message: error.message };
      // Optionally update password
      if (updates.password) {
        const { error: pwError } = await supabase.auth.updateUser({ password: updates.password });
        if (pwError) return { success: false, message: pwError.message };
      }
      // Refresh user data
      const updatedUser = await usersService.getUserById(currentUser.id);
      setCurrentUser({ ...currentUser, ...updatedUser });
      return { success: true, user: updatedUser };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // Helper: get all movies for a user (from playlists and watched)
  const getAllUserMovies = (user) => {
    const movieSet = new Set();
    if (user?.playlists) {
      user.playlists.forEach(playlist => {
        if (playlist.movies) {
          playlist.movies.forEach(movie => movieSet.add(movie.movie_id || movie.id));
        }
      });
    }
    if (user?.watchedMovies) {
      user.watchedMovies.forEach(movie => movieSet.add(movie.movie_id || movie.id));
    }
    return Array.from(movieSet);
  };

  const calculateUserTasteProfile = (userId = null) => {
    const user = userId ? users.find(u => u.id === userId) : currentUser;
    if (!user || !user.playlists) return {};
    
    // Initialize counters for each genre
    const genreCounts = {};
    let totalGenreInstances = 0;
    
    // Function to process a movie and count its genres
    const processMovie = (movie) => {
      let genres = [];
      if (movie.genre_ids) {
        genres = movie.genre_ids;
      } else if (movie.genres) {
        genres = movie.genres.map(g => g.id);
      } else if (movie.movie_genre) {
        genres = movie.movie_genre.map(g => g.genre_id);
      }
      genres.forEach(genreId => {
        const genreName = getGenreName(genreId);
        if (genreName) {
          genreCounts[genreName] = (genreCounts[genreName] || 0) + 1;
          totalGenreInstances++;
        }
      });
    };

    
    // Process watched and liked playlists with higher weight
    user.playlists.forEach(playlist => {
      if (!playlist.movies) return;
      
      const isWatched = playlist.name === 'Watched';
      const isLiked = playlist.name === 'Liked';
      
      playlist.movies.forEach(movie => {
        // Process regular playlist movies
        processMovie(movie);
        
        // Give extra weight to watched and liked movies
        if (isWatched || isLiked) {
          processMovie(movie); // Process again for extra weight
        }
        
        // Give even more weight to movies that are both watched and liked
        if (isWatched && user.playlists.some(p => 
          p.name === 'Liked' && p.movies && p.movies.some(m => m.movie_id === movie.movie_id))
        ) {
          processMovie(movie); // Process a third time for extra-extra weight
        }
      });
    });
    
    // Calculate percentages
    const profile = {};
    if (totalGenreInstances > 0) {
      Object.keys(genreCounts).forEach(genre => {
        profile[genre] = Math.round((genreCounts[genre] / totalGenreInstances) * 100);
      });
    }
    
    return profile;
  };


  const calculateGenreMatchPercentage = (userId) => {
    if (!currentUser) return 0;
    
    const myProfile = calculateUserTasteProfile();
    const otherProfile = calculateUserTasteProfile(userId);
    
    // Find all unique genres between both users
    const allGenres = new Set([
      ...Object.keys(myProfile),
      ...Object.keys(otherProfile)
    ]);
    
    if (allGenres.size === 0) return 0;
    
    let totalOverlap = 0;
    let totalPossible = 0;
    
    allGenres.forEach(genre => {
      const myValue = myProfile[genre] || 0;
      const otherValue = otherProfile[genre] || 0;
      
      // Add the minimum (the overlap) to the total
      totalOverlap += Math.min(myValue, otherValue);
      
      // Add the maximum (the possible) to the total
      totalPossible += Math.max(myValue, otherValue);
    });
    
    // Calculate percentage based on overlap
    return totalPossible > 0 ? Math.round((totalOverlap / totalPossible) * 100) : 0;
  };
  
  // Get movie recommendations based on shared tastes with a friend
  const getSharedTasteRecommendations = (friendId) => {
    if (!currentUser) return [];

    const friend = users.find(user => user.id === friendId);
    if (!friend || !friend.playlists) return [];

    const myProfile = calculateUserTasteProfile();
    const friendProfile = calculateUserTasteProfile(friendId);

    // Find common strong genres (both users have at least 10% interest)
    const commonGenres = Object.keys(myProfile).filter(genre => 
      myProfile[genre] >= 10 && friendProfile[genre] >= 10
    );

    // Get genre IDs from names
    const commonGenreIds = commonGenres.map(getGenreId).filter(Boolean);


    // If no common genres, use friend's top genres
    let genresToUse = commonGenreIds;
    if (genresToUse.length === 0) {
      const topFriendGenres = Object.entries(friendProfile)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([genre]) => getGenreId(genre))
        .filter(Boolean);
      genresToUse = topFriendGenres;
    }

    // Get all my watched movie IDs
    const myWatchedIds = new Set();
    if (currentUser.playlists) {
      currentUser.playlists.forEach(playlist => {
        if (playlist.movies) {
          playlist.movies.forEach(movie => {
            const id = movie.movie_id || movie.id;
            if (id !== undefined && id !== null) {
              myWatchedIds.add(id);
            }
          });
        }
      });
    }
    // Find movies from friend's playlists that match target genres and I haven't watched
    let recommendations = [];
    if (friend.playlists) {
      friend.playlists.forEach(playlist => {
        if (playlist.movies) {
          playlist.movies.forEach(movie => {
            const id = movie.movie_id || movie.id;
            if (myWatchedIds.has(id)) return;
            const movieGenreIds = movie.genre_ids || (movie.genres ? movie.genres.map(g => g.id) : []);
            const hasTargetGenre = movieGenreIds.some(genreId => genresToUse.includes(genreId));
            if ((hasTargetGenre || genresToUse.length === 0) && !recommendations.some(rec => (rec.movie_id || rec.id) === id)) {
              recommendations.push(movie);
            }
          });
        }
      });
    }
    // If still no recommendations, include some of friend's highest rated movies you haven't watched
    if (recommendations.length === 0 && friend.playlists) {
      const allFriendMovies = [];
      friend.playlists.forEach(playlist => {
        if (playlist.movies) {
          playlist.movies.forEach(movie => {
            const id = movie.movie_id || movie.id;
            if (!myWatchedIds.has(id)) {
              allFriendMovies.push(movie);
            }
          });
        }
      });
      // Get top rated movies from friend
      const topRatedMovies = allFriendMovies
        .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
        .slice(0, 6);
      recommendations.push(...topRatedMovies);
    }

    // remove dupes
    const uniqueRecommendations = recommendations.filter((movie, index, self) =>
      index === self.findIndex((t) => (t.movie_id || t.id) === (movie.movie_id || movie.id))
    );
    
    // Sort by vote average (highest rated first)
    return uniqueRecommendations
      .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
      .slice(0, 6); // Limit to 6 recommendations
  };
  
  // Get personalized movie recommendations based on user's taste profile
  const getPersonalizedRecommendations = () => {
    if (!currentUser) return [];
    
    // Get the user's taste profile
    const tasteProfile = calculateUserTasteProfile();
    
    // Get the top 3 genres from the user's profile
    const topGenres = Object.entries(tasteProfile)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([genre]) => genre);
    
    // Convert genre names to IDs
    const topGenreIds = topGenres.map(getGenreId).filter(Boolean);
    
    // Create a set of already watched movies to avoid recommending them
    const watchedMovieIds = new Set();
    
    if (currentUser.playlists) {
      currentUser.playlists.forEach(playlist => {
        if (playlist.movies) {
          playlist.movies.forEach(movie => {
            watchedMovieIds.add(movie.movie_id || movie.id);
          });
        }
      });
    }
    
    // Collect potential recommendations from other users' playlists
    const allRecommendations = [];
    
    users.forEach(user => {
      if (user.id === currentUser.id) return; // Skip current user
      
      if (user.playlists) {
        user.playlists.forEach(playlist => {
          if (playlist.movies) {
            playlist.movies.forEach(movie => {
              // Skip if already watched
              if (watchedMovieIds.has(movie.movie_id || movie.id)) return;
              
              // Check if the movie matches any of the top genres
              const movieGenreIds = movie.genre_ids || 
                (movie.genres ? movie.genres.map(g => g.id) : []);
              
              const matchesTopGenre = movieGenreIds.some(genreId => 
                topGenreIds.includes(genreId)
              );
              
              if (matchesTopGenre) {
                // Add to recommendations if not already in the list
                if (!allRecommendations.some(rec => (rec.movie_id || rec.id) === (movie.movie_id || movie.id))) {
                  allRecommendations.push({
                    ...movie,
                    recommendationScore: calculateRecommendationScore(movie, tasteProfile)
                  });
                }
              }
            });
          }
        });
      }
    });
    
    // Sort by recommendation score and return the top 8
    return allRecommendations
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, 8);
  };
  
  // Calculate a recommendation score based on genre match and rating
  const calculateRecommendationScore = (movie, tasteProfile) => {
    let score = movie.vote_average || 5; // Base score from movie rating
    
    // Get movie genres
    const movieGenres = movie.genres ? 
      movie.genres.map(g => g.name) : 
      (movie.genre_ids || []).map(id => getGenreName(id)).filter(Boolean);
    
    // Boost score based on genre match percentage
    movieGenres.forEach(genre => {
      if (tasteProfile[genre]) {
        // Add a percentage of the user's interest in this genre
        score += (tasteProfile[genre] / 100) * 3; // Up to 3 points boost per genre
      }
    });
    
    return score;
  };

  // Helper function to convert genre ID to name
  const getGenreName = (genreId) => {
    const genreMap = {
      28: 'Action',
      12: 'Adventure',
      16: 'Animation',
      35: 'Comedy',
      80: 'Crime',
      99: 'Documentary',
      18: 'Drama',
      10751: 'Family',
      14: 'Fantasy',
      36: 'History',
      27: 'Horror',
      10402: 'Music',
      9648: 'Mystery',
      10749: 'Romance',
      878: 'Science Fiction',
      53: 'Thriller',
      10752: 'War',
      37: 'Western'
    };
    
    return genreMap[genreId];
  };
  
  // Helper function to convert genre name to ID
  const getGenreId = (genreName) => {
    const genreMap = {
      'Action': 28,
      'Adventure': 12,
      'Animation': 16,
      'Comedy': 35,
      'Crime': 80,
      'Documentary': 99,
      'Drama': 18,
      'Family': 10751,
      'Fantasy': 14,
      'History': 36,
      'Horror': 27,
      'Music': 10402,
      'Mystery': 9648,
      'Romance': 10749,
      'Science Fiction': 878,
      'Thriller': 53,
      'War': 10752,
      'Western': 37
    };
    
    return genreMap[genreName];
  };

  const getFriendshipStatus = (otherUserId) => {
    if (!currentUser) return null;
    const friendship = friends.find(f =>
      (f.user_id === currentUser.id && f.friend_id === otherUserId) ||
      (f.user_id === otherUserId && f.friend_id === currentUser.id)
    );
    return friendship ? friendship.status : null;
  };

  const removeFriend = async (friendId) => {
    if (!currentUser) return { success: false, message: 'Not logged in' };
    try {
      // Remove the friendship from Supabase (handle both directions)
      await friendsService.removeFriend(currentUser.id, friendId);
      // Update local state
      setFriends(prev => prev.filter(f => f.id !== friendId));
      return { success: true };
    } catch (error) {
      console.error('Error removing friend:', error);
      return { success: false, message: error.message };
    }
  };

  return (
    <UserContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        users,
        friends,
        loading,
        session,
        register,
        login,
        logout,
        addFriend,
        acceptFriendRequest,
        declineFriendRequest,
        getActiveFriends,
        getFriendRequests,
        calculateBlendCompatibility,
        updateProfile,
        getAllUserMovies,
        addToWatched,
        addToDefaultPlaylist,
        calculateUserTasteProfile,
        calculateGenreMatchPercentage,
        getSharedTasteRecommendations,
        getPersonalizedRecommendations,
        getFriendshipStatus,
        removeFriend
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

// Custom hook for using the auth context
export const useUser = () => useContext(UserContext);

export default UserProvider;