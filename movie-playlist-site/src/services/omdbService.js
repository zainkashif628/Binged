// omdbService.js
// Use environment variables for API keys. Set REACT_APP_TMDB_API_KEY and REACT_APP_OMDB_API_KEY in your .env file.
const TMDB_API_KEY = process.env.REACT_APP_TMDB_API_KEY;   // TMDB API key
const OMDB_API_KEY = process.env.REACT_APP_OMDB_API_KEY;   // OMDb API key

// Step 1: Get IMDb ID from TMDB ID
const getImdbIdFromTmdb = async (tmdbId) => {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to get IMDb ID from TMDB');
    const data = await response.json();
    return data.imdb_id;
  } catch (error) {
    console.error('Error in getImdbIdFromTmdb:', error);
    return null;
  }
};

// Step 2: Get IMDb rating from OMDb using IMDb ID
const getImdbRatingFromOmdb = async (imdbId) => {
  const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to get IMDb rating from OMDb');
    const data = await response.json();
    return {
      rating: data.imdbRating,
      votes: data.imdbVotes,
      metascore: data.Metascore
    };
  } catch (error) {
    console.error('Error in getImdbRatingFromOmdb:', error);
    return null;
  }
};

// Step 3: Combine both steps
export const getImdbRating = async (tmdbId) => {
  const imdbId = await getImdbIdFromTmdb(tmdbId);
  if (!imdbId) return null;
  return await getImdbRatingFromOmdb(imdbId);
};
