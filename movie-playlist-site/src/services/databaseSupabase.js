import { supabase } from './supabaseClient';
import { getMovieCredits, fetchMovieBackdrop } from './tmdbService';

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
    const DEFAULT_LIMIT = 32; // Default number of results
    const limit = filters.limit || DEFAULT_LIMIT;

    let supabaseQuery = supabase
      .from('movie')
      .select(`
        *,
        movie_genre (
          genre_id,
          genre (
            name
          )
        )
      `)
      .ilike('title', `%${query}%`);

    // Apply genre filter if specified
    if (filters.genres && filters.genres.length > 0) {
      supabaseQuery = supabaseQuery
        .in('movie_genre.genre_id', filters.genres);
    }

    // Apply year filter if specified
    if (filters.year) {
      const startDate = `${filters.year}-01-01`;
      const endDate = `${filters.year}-12-31`;
      supabaseQuery = supabaseQuery
        .gte('release_date', startDate)
        .lte('release_date', endDate);
    }

    // Apply rating filter if specified
    if (filters.vote_avg) {
      const [minRating] = filters.vote_avg.split(',');
      supabaseQuery = supabaseQuery
        .gte('vote_avg', parseFloat(minRating));
    }

    // Default sorting by popularity
    supabaseQuery = supabaseQuery
      .order('popularity', { ascending: false })
      .limit(limit);

    const { data, error } = await supabaseQuery;
    
    if (error) throw error;
    return data;
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
            *
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
      movies: playlist.movie_playlists.map(mp => mp.movie)
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