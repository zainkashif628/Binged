import { supabase } from './supabaseClient';

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
      .from('movies')
      .select('*')
      .eq('id', id)
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