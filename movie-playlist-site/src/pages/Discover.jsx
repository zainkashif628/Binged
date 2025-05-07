import React, { useState, useEffect } from "react";
import { searchMovies, getMovieGenres, discoverMovies } from "../services/tmdbService";
import MovieCard from "../components/MovieCard";
import { useTheme } from "../contexts/ThemeContext";
import "./Discover.css";

const Discover = () => {
  const { themeColors } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Search filter states
  const [yearFilter, setYearFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [sortBy, setSortBy] = useState("popularity.desc");

  // Generate year options from 1900 to current year
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1900 + 1 }, (_, i) => currentYear - i);
  
  useEffect(() => {
    // Load movie genres on component mount
    const loadGenres = async () => {
      try {
        const genreData = await getMovieGenres();
        setGenres(genreData);
      } catch (error) {
        console.error("Failed to load genres:", error);
      }
    };
    
    // Load some initial movies
    const loadInitialMovies = async () => {
      setIsLoading(true);
      try {
        const initialMovies = await discoverMovies({
          sort_by: "popularity.desc"
        });
        setResults(initialMovies);
      } catch (error) {
        console.error("Failed to load initial movies:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadGenres();
    loadInitialMovies();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      let data;
      
      if (query) {
        // If there's a search query, use search endpoint
        data = await searchMovies(query, {
          year: yearFilter,
          vote_average: ratingFilter ? `${ratingFilter},10` : ""
        });
      } else {
        // Otherwise use discover endpoint with filters
        const filters = {
          sort_by: sortBy,
          with_genres: selectedGenre,
          primary_release_year: yearFilter,
          "vote_average.gte": ratingFilter
        };
        
        data = await discoverMovies(filters);
      }
      
      setResults(data);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGenreClick = async (genreId) => {
    setSelectedGenre(genreId);
    setIsLoading(true);
    
    try {
      const data = await discoverMovies({
        sort_by: sortBy,
        with_genres: genreId,
        primary_release_year: yearFilter,
        "vote_average.gte": ratingFilter
      });
      
      setResults(data);
    } catch (error) {
      console.error("Failed to load genre movies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToPlaylist = (movie) => {
    console.log(`Add to playlist: ${movie.title}`);
    alert(`"${movie.title}" added to playlist!`);
  };

  return (
    <div className="discover-page">
      <div className="discover-container">
        {/* Left sidebar for advanced search options */}
        <div className="discover-sidebar">
          <div className="sidebar-section">
            <h3>Search By</h3>
            <form onSubmit={handleSearch}>
              <div className="search-field">
                <label htmlFor="movie-query">Movie Title</label>
                <input
                  id="movie-query"
                  type="text"
                  placeholder="Search movies..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              
              <div className="search-field">
                <label htmlFor="year-filter">Year</label>
                <select 
                  id="year-filter" 
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                >
                  <option value="">Any Year</option>
                  {years.slice(0, 70).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              
              <div className="search-field">
                <label htmlFor="rating-filter">Minimum Rating</label>
                <select 
                  id="rating-filter" 
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                >
                  <option value="">Any Rating</option>
                  <option value="9">9+</option>
                  <option value="8">8+</option>
                  <option value="7">7+</option>
                  <option value="6">6+</option>
                  <option value="5">5+</option>
                </select>
              </div>
              
              <div className="search-field">
                <label htmlFor="sort-by">Sort By</label>
                <select 
                  id="sort-by" 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="popularity.desc">Popularity (High to Low)</option>
                  <option value="vote_average.desc">Rating (High to Low)</option>
                  <option value="primary_release_date.desc">Release Date (Newest)</option>
                  <option value="primary_release_date.asc">Release Date (Oldest)</option>
                  <option value="original_title.asc">Title (A-Z)</option>
                </select>
              </div>
              
              <button type="submit" className="search-button">
                Search
              </button>
            </form>
          </div>
        </div>
        
        {/* Main content area */}
        <div className="discover-content">
          <h1>Discover Movies</h1>
          
          {/* Genre buttons */}
          <div className="genre-buttons">
            <button 
              className={`genre-button ${selectedGenre === null ? 'active' : ''}`}
              onClick={() => handleGenreClick(null)}
            >
              All
            </button>
            {genres.slice(0, 14).map((genre) => (
              <button 
                key={genre.id}
                className={`genre-button ${selectedGenre === genre.id ? 'active' : ''}`}
                onClick={() => handleGenreClick(genre.id)}
              >
                {genre.name}
              </button>
            ))}
          </div>
          
          {/* Results heading */}
          <div className="results-heading">
            <h2>
              {selectedGenre 
                ? `${genres.find(g => g.id === selectedGenre)?.name} Movies` 
                : 'Popular Movies'}
            </h2>
            <span className="results-count">{results.length} movies found</span>
          </div>

          {/* Movies grid */}
          {isLoading ? (
            <div className="loading-container">
              <div className="loading">Loading movies...</div>
            </div>
          ) : results.length > 0 ? (
            <div className="movie-grid">
              {results.map((movie) => (
                <MovieCard 
                  key={movie.id} 
                  movie={movie} 
                  showAddToPlaylist 
                  onAddToPlaylist={handleAddToPlaylist}
                />
              ))}
            </div>
          ) : (
            <p className="no-results">No movies found matching your criteria. Try adjusting your search.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Discover;