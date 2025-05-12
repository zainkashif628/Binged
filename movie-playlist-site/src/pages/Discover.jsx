import React, { useState, useEffect } from "react";
import { genresService, moviesService } from "../services/databaseSupabase";
import MovieCard from "../components/MovieCard";
import { useTheme } from "../contexts/ThemeContext";
import Chatbot from '../components/Chatbot';

import "./Discover.css";

const Discover = () => {
  const { themeColors } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [genres, setGenres] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState([]);
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
        const genreData = await genresService.getGenres();
        setGenres(genreData);
      } catch (error) {
        console.error("Failed to load genres:", error);
      }
    };
    
    // Load some initial movies
    const loadInitialMovies = async () => {
      setIsLoading(true);
      try {
        const initialMovies = await moviesService.getPopularMovies();
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
        data = await moviesService.searchMovies(query, {
          year: yearFilter,
          vote_avg: ratingFilter ? `${ratingFilter},10` : "",
          genres: selectedGenres
        });
      } else {
        // Otherwise use discover endpoint with filters
        const filters = {
          sort_by: sortBy,
          genres: selectedGenres,
          release_year: yearFilter,
          "vote_avg.gte": ratingFilter
        };
        
        data = await moviesService.discoverMovies(filters);
      }
      
      setResults(data);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGenreClick = async (genreId) => {
    setIsLoading(true);
    try {
      let newSelectedGenres;
      if (genreId === null) {
        // If "All" is clicked, clear all selections
        newSelectedGenres = [];
      } else {
        // Toggle the selected genre
        newSelectedGenres = selectedGenres.includes(genreId)
          ? selectedGenres.filter(id => id !== genreId)
          : [...selectedGenres, genreId];
      }
      setSelectedGenres(newSelectedGenres);
      // Build filters object
      const filters = {
        sort_by: sortBy,
        genres: newSelectedGenres,
        release_year: yearFilter,
        "vote_avg.gte": ratingFilter
      };
      let data;
      if (query) {
        // If there is a search query, use fuzzy search
        data = await moviesService.searchMovies(query, filters);
      } else {
        // Otherwise, just filter by genre
        data = await moviesService.discoverMovies(filters);
      }
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
                  <option value="vote_avg.desc">Rating (High to Low)</option>
                  <option value="release_date.desc">Release Date (Newest)</option>
                  <option value="release_date.asc">Release Date (Oldest)</option>
                  <option value="title.asc">Title (A-Z)</option>
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
              className={`genre-button ${selectedGenres.length === 0 ? 'active' : ''}`}
              onClick={() => handleGenreClick(null)}
            >
              All
            </button>
            {genres.map((genre) => (
              <button 
                key={genre.genre_id}
                className={`genre-button ${selectedGenres.includes(genre.genre_id) ? 'active' : ''}`}
                onClick={() => handleGenreClick(genre.genre_id)}
              >
                {genre.name}
              </button>
            ))}
          </div>
          
          {/* Results heading */}
          <div className="results-heading">
            <h2>
              {selectedGenres.length > 0
                ? `${selectedGenres.length} Genre${selectedGenres.length > 1 ? 's' : ''} Selected`
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
                  key={movie.movie_id} 
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
        {/* Floating Chatbot Window */}
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
};

export default Discover;