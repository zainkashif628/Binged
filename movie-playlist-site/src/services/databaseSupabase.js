import { supabase } from './supabaseClient';
import { getMovieCredits } from './tmdbService';

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
  
  // get movie backdrop direct from tmdb
  async getMovieBackdrop(id) {

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

// Playlists CRUD operations
export const playlistsService = {
  // Create a new playlist
  async createPlaylist(playlistData) {
    const { data, error } = await supabase
      .from('playlists')
      .insert([playlistData]);
    
    if (error) throw error;
    return data;
  },

  // Get all playlists
  async getPlaylists() {
    const { data, error } = await supabase
      .from('playlists')
      .select('*');
    
    if (error) throw error;
    return data;
  },

  // Get a specific playlist by id
  async getPlaylistById(id) {
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update a playlist
  async updatePlaylist(id, updates) {
    const { data, error } = await supabase
      .from('playlists')
      .update(updates)
      .eq('id', id);
    
    if (error) throw error;
    return data;
  },

  // Delete a playlist
  async deletePlaylist(id) {
    const { data, error } = await supabase
      .from('playlists')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return data;
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