import { supabase } from './supabaseClient';
import { fetchMovieBackdrop } from './tmdbService';

// --- USERS SERVICE ---
export const usersService = {
  async getAllUsers() {
    const { data, error } = await supabase.from('user').select('*');
    if (error) throw error;
    console.log("data", data);
    return data;
  },
  async getUserById(userId) {
    const { data, error } = await supabase.from('user').select('*').eq('id', userId).single();
    if (error) throw error;
    return data;
  },

  async getUsernameById(userId) {
    const { data, error } = await supabase.from('user').select('username').eq('id', userId).single();
    if (error) throw error;
    return data.username;
  },

  async updateUser(userId, updates) {
    // Only allow updating username and bio
    const allowed = ['username', 'bio'];
    const updateObj = {};
    allowed.forEach(key => {
      if (updates[key] !== undefined) updateObj[key] = updates[key];
    });
    const { data, error } = await supabase
      .from('user')
      .update(updateObj)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// --- FRIENDS SERVICE ---
export const friendsService = {
  // Get all friendships for a user (where user is either user_id or friend_id)
  async getAllFriends(userId) {
    const { data, error } = await supabase
      .from('friendship')
      .select('*')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    if (error) throw error;
    return data;
  },

  // Add a friend (request): always insert with user_id < friend_id for composite key
  async addFriend(userId, friendId) {
    const { data, error } = await supabase
      .from('friendship')
      .insert([{
        user_id: userId,
        friend_id: friendId,
        status: 'pending'
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Accept a friend request (update status to 'accepted')
  async acceptFriendRequest(userId, friendId) {
    const least_id = userId < friendId ? userId : friendId;
    const greatest_id = userId > friendId ? userId : friendId;
    const { data, error } = await supabase
      .from('friendship')
      .update({ status: 'accepted' })
      .eq('least_id', least_id)
      .eq('greatest_id', greatest_id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async declineFriendRequest(userId, friendId) {
    // Decline means delete the friendship row (pending request)
    const least_id = userId < friendId ? userId : friendId;
    const greatest_id = userId > friendId ? userId : friendId;
    const { error } = await supabase
      .from('friendship')
      .delete()
      .eq('least_id', least_id)
      .eq('greatest_id', greatest_id);
    if (error) throw error;
  }, 

  // Remove a friend (delete friendship row)
  async removeFriend(userId, friendId) {
    // Always use composite key (least_id, greatest_id)
    const least_id = userId < friendId ? userId : friendId;
    const greatest_id = userId > friendId ? userId : friendId;
    const { error } = await supabase
      .from('friendship')
      .delete()
      .eq('least_id', least_id)
      .eq('greatest_id', greatest_id);
    if (error) throw error;
  }
};

// Movies CRUD operations
export const moviesService = {
  // Create a new movie
  async createMovie(movieData) {
    const { data, error } = await supabase
      .from('movies')
      .insert([movieData]);
    
    if (error) throw error;
    return data;
  },

  // Get all movies
  async getMovies() {
    const { data, error } = await supabase
      .from('movies')
      .select('*');
    
    if (error) throw error;
    return data;
  },

  async getNowPlayingMovies() {
    const { data, error } = await supabase
      .from('movie')
      .select('*')
      .gte('release_date', new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString().split('T')[0])
      .lte('release_date', new Date().toISOString().split('T')[0])
      .order('release_date', { ascending: false })
      .order('popularity', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching hero movies:', error);
      return [];
    };
    return data;
  },

  async getAnimatedMovies() {
    const { data, error } = await supabase
      .from('movie_genre')
      .select(`
        movie (
          *
        )
      `)
      .eq('genre_id', 16)
      .limit(50); // get more in case we filter later

    if (error) {
      console.error('Error fetching animated movies:', error);
      return [];
    }

    // Extract and sort movies by popularity (descending)
    const sorted = data
      .map(entry => entry.movie)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 20); // return top 20

    return sorted;
  },

  async getHorrorMovies() {
    const { data, error } = await supabase
      .from('movie_genre')
      .select(`
        movie (
          *
        )
      `)
      .eq('genre_id', 27)
      .limit(50); // get more in case we filter later

    if (error) {
      console.error('Error fetching horror movies:', error);
      return [];
    }

    // Extract and sort movies by popularity (descending)
    const sorted = data
      .map(entry => entry.movie)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 20); // return top 20

    return sorted;
  },

  async getPopularMovies() {
    const { data, error } = await supabase
      .from('movie')
      .select('*')
      .order('popularity', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching hero movies:', error);
      return [];
    };
    return data;
  },

  async getUpcomingMovies() {
    const { data, error } = await supabase
      .from('movie')
      .select('*')
      .gt('release_date', new Date().toISOString().split('T')[0]) // Only upcoming movies
      .order('popularity', { ascending: false }) // Sort by popularity
      .order('release_date', { ascending: true })
      .limit(20);

    if (error) {
      console.error('Error fetching hero movies:', error);
      return [];
    };
    return data;
  },

  async getHeroMovies() {
    const { data, error } = await supabase
      .from('movie')
      .select('*')
      .order('popularity', { ascending: false })  // Popular movies
      .order('vote_avg', { ascending: false })  // Sorted by vote average
      .limit(20); // Hero section would generally be limited to a few movies

    if (error) {
      console.error('Error fetching hero movies:', error);
      return [];
    };
    let filteredMovies = [];
    // filter to only include movies with backdrop images for hero section
    for (const movie of data) {
      let backdrop = await fetchMovieBackdrop(movie.movie_id);
      if (backdrop) {
        movie.backdrop_path = backdrop;
        filteredMovies.push(movie);
      }
    }
    console.log(filteredMovies);
    return filteredMovies;
  },

  // Get a specific movie by id
  async getMovieById(id) {
    const { data, error } = await supabase
      .from('movie')
      .select(`
        *,
        movie_genre (
          genre_id,
          genre (
            name
          )
        ),
        language:lang_id (
          name
        )
      `)
      .eq('movie_id', id)
      .single();
    
    if (error) throw error;

    // Transform the data to include genres
    const genres = data.movie_genre.map(item => item.genre.name);
    return { ...data, genres };
  },
  
  async getMovieCredits(id) {
    const { data, error } = await supabase
      .from('movie_actor')
      .select(`
        actor_id,
        movie_id,
        crew_member (
          name,
          profile_url,
          known_for,
          gender
        )
      `)
      .eq('movie_id', id);
  
    if (error) throw error;

    // Transform the data to match the expected structure
    return { cast: data.map(item => ({
        id: item.actor_id,
        name: item.crew_member.name,
        profile_url: item.crew_member.profile_url,
        known_for: item.crew_member.known_for,
        gender: item.crew_member.gender
    })) };
  },

  // discover movies by filters
  async discoverMovies(filters) {
    const DEFAULT_LIMIT = 32; // Default number of results
    const limit = filters.limit || DEFAULT_LIMIT;

    let query = supabase
      .from('movie')
      .select(`
        *,
        movie_genre!inner (
          genre_id,
          genre (
            name
          )
        )
      `);

    // Apply genre filter if specified
    if (filters.genres && filters.genres.length > 0) {
      // Use in operator to match any of the selected genres
      query = query
        .in('movie_genre.genre_id', filters.genres);
    } else {
      // If no genre filter, remove the inner join to get all movies
      query = supabase
        .from('movie')
        .select(`
          *,
          movie_genre (
            genre_id,
            genre (
              name
            )
          )
        `);
    }

    // Apply year filter if specified
    if (filters.release_year) {
      const startDate = `${filters.release_year}-01-01`;
      const endDate = `${filters.release_year}-12-31`;
      query = query
        .gte('release_date', startDate)
        .lte('release_date', endDate);
    }

    // Apply rating filter if specified
    if (filters['vote_avg.gte']) {
      query = query
        .gte('vote_avg', parseFloat(filters['vote_avg.gte']));
    }

    // Apply sorting
    if (filters.sort_by) {
      const [field, order] = filters.sort_by.split('.');
      query = query.order(field, { ascending: order === 'asc' });
    } else {
      // Default sorting by popularity
      query = query.order('popularity', { ascending: false });
    }

    // Apply limit
    query = query.limit(limit);

    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  },

  // Search movies by title
  async searchMovies(query, filters) {
    if (query) {
      console.log(query);
      // Use the fuzzy search RPC for typo-tolerant search
      const { data, error } = await supabase
        .rpc('fuzzy_movie_search', { query });
      if (error) throw error;
      console.log(data);
      let results = data;
      // Optionally filter further by genre/year/rating in JS if filters are provided
      if (filters) {
        if (filters.genres && filters.genres.length > 0) {
          console.log('filters.genres:', filters.genres, typeof filters.genres[0]);
          results = results.filter(movie => {
            if (!movie.movie_genre) return false;
            console.log('movie.movie_genre:', movie.movie_genre, typeof movie.movie_genre[0]?.genre_id);
            return movie.movie_genre.some(g => filters.genres.includes(Number(g.genre_id)));
          });
        }
        if (filters.year) {
          results = results.filter(movie => {
            if (!movie.release_date) return false;
            return new Date(movie.release_date).getFullYear().toString() === filters.year.toString();
          });
        }

        if (filters.vote_avg) {
          const [minRating] = filters.vote_avg.split(',');
          results = results.filter(movie => parseFloat(movie.vote_avg || movie.vote_average || 0) >= parseFloat(minRating));
        }
      }
      return results;
    } else {
      // Otherwise use discover endpoint with filters
      return this.discoverMovies(filters);
    }
  },

  // Get movie reviews
  async getMovieReviews(id) {
    const { data, error } = await supabase
      .from('review')
      .select(`
        *,
        user: user_id (
          profile_url,
          username
        )
        
      `)
      .eq('movie_id', id)
      .order('created', { ascending: false });
    
    if (error) throw error;
    
    // Transform the data to match the expected structure
    return { reviews: data.map(item => ({
        id: item.review_id,
        // username: item.user.username,
        // profile_url: item.user.profile_url,
        user_id: item.user_id,
        content: item.content,
        vote: item.vote,
        created: item.created
      })),
    };
  },

  // Add review
  async addReview(movie_id, reviewData) {
    try {
      const response = await supabase
        .from('review')
        .insert([{ movie_id, ...reviewData }]);

      console.log('Insert response:', response);

      if (response.error) throw response.error;
    } catch (err) {
      console.error('Error adding review:', err);
      throw err;
    }
  },

  // get user
  async getUser() {
    const { data: authUser, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;

    const { data, error } = await supabase
      .from('user')
      .select('*')
      .eq('id', authUser.user.id)
      .single();

    if (error) throw error;
    return data;
  },

  async getUserWatchedMovies(userId) {
    const { data, error } = await supabase
      .from('watched_movies')
      .select('movie:movie_id(*)')
      .eq('user_id', userId);

    if (error) throw error;
    return data;
  },
  
  // Update a movie
  async updateMovie(id, updates) {
    const { data, error } = await supabase
      .from('movies')
      .update(updates)
      .eq('id', id);
    
    if (error) throw error;
    return data;
  },

  // Delete a movie
  async deleteMovie(id) {
    const { data, error } = await supabase
      .from('movies')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return data;
  }
};

export const genresService = {
  // Get all genres
  async getGenres() {
    const { data, error } = await supabase
      .from('genre')
      .select('*');
    
    if (error) throw error;
    return data;
  },

  // Get a specific genre by id
  async getGenreById(id) {
    const { data, error } = await supabase
      .from('genre')
      .select('*')
      .eq('genre_id', id)
      .single();
    
    if (error) throw error;
    return data;
  }
};

// Playlists CRUD operations
export const playlistsService = {
  // Create a new playlist
  async createPlaylist(playlistData) {
    const { data, error } = await supabase
      .from('playlists')
      .insert([{
        name: playlistData.name || 'playlist',
        status: playlistData.status || 'private',
        user_id: playlistData.user_id // This should be a UUID
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get all playlists for a user
  async getUserPlaylists(userId) {
    const { data, error } = await supabase
      .from('playlists')
      .select(`
        playlist_id,
        name,
        status,
        user_id,
        movie_playlists (
          movie_id,
          movie (
            *,
            movie_genre (
              genre_id
            )
          )
        )
      `)
      .eq('user_id', userId) // userId should be a UUID
      .order('playlist_id', { ascending: false });
    
    if (error) throw error;

    // Transform the data to match the expected structure
    return data.map(playlist => ({
      id: playlist.playlist_id,
      name: playlist.name,
      status: playlist.status,
      user_id: playlist.user_id,
      movies: playlist.movie_playlists.map(mp => mp.movie),
      genre_ids: playlist.movie_playlists.map(mp => mp.movie.movie_genre ? mp.movie.movie_genre.map(g => g.genre_id) : [])
    }));
  },

  // Get a specific playlist by id
  async getPlaylistById(playlistId) {
    const { data, error } = await supabase
      .from('playlists')
      .select(`
        playlist_id,
        name,
        status,
        user_id,
        movie_playlists (
          movie_id,
          movie (
            *
          )
        )
      `)
      .eq('playlist_id', playlistId)
      .single();
    
    if (error) throw error;

    // Transform the data to match the expected structure
    return {
      id: data.playlist_id,
      name: data.name,
      status: data.status,
      user_id: data.user_id,
      movies: data.movie_playlists.map(mp => mp.movie)
    };
  },

  // Update a playlist
  async updatePlaylist(playlistId, updates) {
    const { data, error } = await supabase
      .from('playlists')
      .update({
        name: updates.name,
        status: updates.status
      })
      .eq('playlist_id', playlistId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Delete a playlist
  async deletePlaylist(playlistId) {
    // first check if liked playlist
    const { data: likedPlaylist, error: likedPlaylistError } = await supabase
      .from('playlists')
      .select('*')
      .eq('playlist_id', playlistId)
      .single();
    if (likedPlaylistError) throw likedPlaylistError;
    if (likedPlaylist.name === 'Liked') {
      throw new Error('Cannot delete liked playlist');
    }

    // First delete all movie associations
    const { error: movieError } = await supabase
      .from('movie_playlists')
      .delete()
      .eq('playlist_id', playlistId);
    
    if (movieError) throw movieError;

    // Then delete the playlist itself
    const { error } = await supabase
      .from('playlists')
      .delete()
      .eq('playlist_id', playlistId);
    
    if (error) throw error;
  },

  // Add a movie to a playlist
  async addMovieToPlaylist(playlistId, movieId) {
    const { error } = await supabase
      .from('movie_playlists')
      .insert([{
        playlist_id: playlistId,
        movie_id: movieId
      }]);
    
    if (error) throw error;
  },

  // Remove a movie from a playlist
  async removeMovieFromPlaylist(playlistId, movieId) {
    const { error } = await supabase
      .from('movie_playlists')
      .delete()
      .match({
        playlist_id: playlistId,
        movie_id: movieId
      });
    
    if (error) throw error;
  }
};

// Playlist-Movies relation operations
export const playlistMoviesService = {
  // Add a movie to a playlist
  async addMovieToPlaylist(playlistId, movieId) {
    const { data, error } = await supabase
      .from('playlist_movies')
      .insert([{ playlist_id: playlistId, movie_id: movieId }]);
    
    if (error) throw error;
    return data;
  },

  // Get all movies in a playlist
  async getMoviesInPlaylist(playlistId) {
    const { data, error } = await supabase
      .from('playlist_movies')
      .select('movies(*)')
      .eq('playlist_id', playlistId);
    
    if (error) throw error;
    return data.map(item => item.movies);
  },

  // Remove a movie from a playlist
  async removeMovieFromPlaylist(playlistId, movieId) {
    const { data, error } = await supabase
      .from('playlist_movies')
      .delete()
      .match({ playlist_id: playlistId, movie_id: movieId });
    
    if (error) throw error;
    return data;
  }
};

// Watched Movies CRUD operations
export const watchedMoviesService = {
  // Add a movie to watched
  async addWatchedMovie(userId, movieId) {
    const { error } = await supabase
      .from('watched_movies')
      .upsert([{ user_id: userId, movie_id: movieId, watch_date: new Date().toISOString() }]);
    if (error) throw error;
  },

  // Remove a movie from watched
  async removeWatchedMovie(userId, movieId) {
    const { error } = await supabase
      .from('watched_movies')
      .delete()
      .match({ user_id: userId, movie_id: movieId });
    if (error) throw error;
  },

  // Get all watched movies for a user (movie_id, watch_date)
  async getWatchedMovies(userId) {
    const { data, error } = await supabase
      .from('watched_movies')
      .select('movie_id, watch_date')
      .eq('user_id', userId);
    if (error) throw error;
    return data;
  },

  // Get the full Watched playlist for a user (with movie details)
  async getWatchedPlaylist(userId) {
    const { data, error } = await supabase
      .from('watched_movies')
      .select('movie:movie_id(*)')
      .eq('user_id', userId);
    if (error) throw error;
    // Return array of movie objects
    return data.map(entry => entry.movie);
  }
};

// Get the user's most watched genre (highest count in user_genre_prefs)
export async function getUserMostWatchedGenre(userId) {
  const { data, error } = await supabase
    .from('user_genre_prefs')
    .select('genre_id, watch_count')
    .eq('user_id', userId)
    .order('watch_count', { ascending: false })
    .limit(1);
  if (error) throw error;
  console.log("wtf: ", data);
  return data && data.length > 0 ? data[0].genre_id : null;
}

export async function getUserMostWatchedActor(userId) {
  const { data, error } = await supabase
    .from('user_actor_prefs')
    .select('actor_id, watch_count')
    .eq('user_id', userId)
    .order('watch_count', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? data[0].actor_id : null;
}

// Get recommended movies for user: movies in most watched genre or with most watched actor, excluding already watched, sorted by popularity
export async function getRecommendedMoviesForUser(userId, genreId, actorId, limit = 5) {
  // 1. Get watched movie IDs
  const { data: watchedData, error: watchedError } = await supabase
    .from('watched_movies')
    .select('movie_id')
    .eq('user_id', userId);
  if (watchedError) throw watchedError;
  const watchedIds = watchedData.map(w => w.movie_id);

  // 2. Get movies by genre
  let genreMovies = [];
  if (genreId) {
    let query = supabase
      .from('movie_genre')
      .select('movie:movie_id(*)')
      .eq('genre_id', genreId);
    if (watchedIds.length > 0) {
      query = query.not('movie_id', 'in', `(${watchedIds.join(',')})`);
    }
    const { data: genreData, error: genreError } = await query;
    if (genreError) throw genreError;
    genreMovies = genreData.map(d => d.movie).filter(Boolean);
  }

  // 3. Get movies by actor
  let actorMovies = [];
  if (actorId) {
    let query = supabase
      .from('movie_actor')
      .select('movie:movie_id(*)')
      .eq('actor_id', actorId);
    if (watchedIds.length > 0) {
      query = query.not('movie_id', 'in', `(${watchedIds.join(',')})`);
    }
    const { data: actorData, error: actorError } = await query;
    if (actorError) throw actorError;
    actorMovies = actorData.map(d => d.movie).filter(Boolean);
  }

  // 4. Combine, deduplicate, and sort by popularity
  const allMovies = [...genreMovies, ...actorMovies];
  const seen = new Set();
  const unique = [];
  for (const m of allMovies) {
    if (m && !seen.has(m.movie_id)) {
      unique.push(m);
      seen.add(m.movie_id);
    }
  }
  // Sort by popularity descending
  unique.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  return unique.slice(0, limit);
}

export async function getGenre(genreId) {
  if (!genreId) return null;
  const { data, error } = await supabase
    .from('genre')
    .select('*')
    .eq('genre_id', genreId)
    .single();
  if (error) throw error;
  return data.name;
}

export async function getActor(actorId) {
  if (!actorId) return null;
  const { data, error } = await supabase
    .from('crew_member')
    .select('*')
    .eq('member_id', actorId)
    .single();
  if (error) throw error;
  return data.name;
}

export const customUserMovieService = {
  getGenre,
  getActor,
  getUserMostWatchedGenre,
  getUserMostWatchedActor,
  getRecommendedMoviesForUser,
};