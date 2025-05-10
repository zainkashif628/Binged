import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNowPlayingMovies, fetchTopRatedMovies, fetchPopularMovies, fetchUpcomingMovies, fetchMovieBackdrop } from '../services/tmdbService';
import MovieCard from '../components/MovieCard';
import { useTheme } from '../contexts/ThemeContext';
import { moviesService as supabaseService } from '../services/databaseSupabase';
import './Home.css';

const Home = () => {
  const { themeColors } = useTheme();
  const navigate = useNavigate();
  
  const [animatedMovies, setAnimatedMovies] = useState([]);
  const [horrorMovies, setHorrorMovies] = useState([]);
  const [popularMovies, setPopularMovies] = useState([]);
  const [upcomingMovies, setUpcomingMovies] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);
  const slideIntervalRef = useRef(null);
  
  // Hero slider movies
  const [heroMovies, setHeroMovies] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadMovies = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log("Home component: Starting to fetch movies from TMDB...");
        
        // Fetch different movie categories
        const animated = await supabaseService.getAnimatedMovies();
        // console.log(`Fetched ${nowPlaying?.length || 0} now playing movies`);
        
        const horror = await supabaseService.getHorrorMovies();
        // console.log(`Fetched ${topRated?.length || 0} top rated movies`);
        console.log(`Fetched ${horror?.length || 0} horror movies`);
        const popular = await supabaseService.getPopularMovies();
        // console.log(`Fetched ${popular?.length || 0} popular movies`);
        
        const upcoming = await supabaseService.getUpcomingMovies();
        // console.log(`Fetched ${upcoming?.length || 0} upcoming movies`);
        
        // fetch movie backdrops for hero section
        const potentialHeroMovies = await supabaseService.getHeroMovies();
        // Filter to only include movies with backdrop images for hero section
        // const potentialHeroMovies = [
        //   ...topRated.filter(movie => movie.backdrop_path).slice(0, 3),
        //   ...popular.filter(movie => movie.backdrop_path).slice(0, 3),  
        //   ...upcoming.filter(movie => movie.backdrop_path).slice(0, 2)
        // ];
        
        // Set hero movies for slider
        setHeroMovies(potentialHeroMovies.slice(0, 6) || []);
        console.log(potentialHeroMovies);
        // Set category movies
        setAnimatedMovies(animated);
        setHorrorMovies(horror);
        setPopularMovies(popular);
        setUpcomingMovies(upcoming);
        
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load movies:', err);
        setError(`Error loading movies: ${err.message}`);
        setIsLoading(false);
      }
    };

    loadMovies();
  }, []);

  // Set up automatic slider
  useEffect(() => {
    if (heroMovies.length > 0) {
      slideIntervalRef.current = setInterval(() => {
        setActiveSlide(prev => (prev + 1) % heroMovies.length);
      }, 6000);
    }
    
    return () => {
      if (slideIntervalRef.current) {
        clearInterval(slideIntervalRef.current);
      }
    };
  }, [heroMovies.length]);

  const handleAddToPlaylist = (movie) => {
    console.log(`Add to playlist: ${movie.title}`);
    alert(`"${movie.title}" added to playlist!`);
  };
  
  const handleHeroMovieClick = (movieId) => {
    navigate(`/movie/${movieId}`);
  };

  // Apply theme-based styling
  const homeStyle = {
    backgroundColor: themeColors.background,
    color: themeColors.text,
  };

  const titleStyle = {
    color: themeColors.primary
  };

  return (
    <div className="home-page" style={homeStyle}>
      {/* Hero Slider Section */}
      {heroMovies.length > 0 && (
        <div className="hero-slider">
          <div className="hero-slides">
            {heroMovies.map((movie, index) => (
              <div 
                key={movie.movie_id}
                className={`hero-slide ${index === activeSlide ? 'active' : ''}`}
                onClick={() => handleHeroMovieClick(movie.movie_id)}
              >
                <div 
                  className="hero-backdrop"
                  style={{ 
                    backgroundImage: `url(https://image.tmdb.org/t/p/original${movie.backdrop_path})` 
                  }}
                ></div>
                <div className="hero-content">
                  <div className="hero-info">
                    <h1 className="hero-title">{movie.title}</h1>
                    <p className="hero-description">
                      {movie.synopsis.length > 180 
                        ? `${movie.synopsis.substring(0, 180)}...` 
                        : movie.synopsis}
                    </p>
                    <div className="hero-metadata">
                      {/* vote_avg might be null */}
                      <span className="rating">⭐ {movie.vote_avg?.toFixed(1) || 0}</span>
                      {movie.release_date && (
                        <span className="year">{new Date(movie.release_date).getFullYear()}</span>
                      )}
                    </div>
                    <button 
                      className="hero-cta"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/movie/${movie.movie_id}`);
                      }}
                      style={{
                        backgroundColor: themeColors.primary,
                        color: themeColors.buttonText
                      }}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="slider-dots">
            {heroMovies.map((_, index) => (
              <button 
                key={index} 
                className={`slider-dot ${index === activeSlide ? 'active' : ''}`}
                onClick={() => setActiveSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
              ></button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="loading-container">
          <div className="loading">Loading movies...</div>
        </div>
      ) : error ? (
        <div className="error-container">
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <>
          {/* Fan Favorites Section */}
          <div className="movie-section">
            <h2 className="section-title" style={titleStyle}>Fan Favorites ❤️</h2>
            <div className="movie-row">
              {popularMovies.slice(0, 20).map((movie) => (
                <div className="movie-card-container" key={movie.movie_id}>
                  <MovieCard
                    movie={movie}
                    showAddToPlaylist
                    onAddToPlaylist={handleAddToPlaylist}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* New Releases Section */}
          <div className="movie-section">
            <h2 className="section-title" style={titleStyle}>Upcoming 🍿</h2>
            <div className="movie-row">
              {upcomingMovies.slice(0, 20).map((movie) => (
                <div className="movie-card-container" key={movie.movie_id}>
                  <MovieCard
                    movie={movie}
                    showAddToPlaylist
                    onAddToPlaylist={handleAddToPlaylist}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Horror Movies Section */}
          <div className="movie-section">
            <h2 className="section-title" style={titleStyle}>Top Horror Movies 👻</h2>
            <div className="movie-row">
              {horrorMovies.slice(0, 20).map((movie) => (
                <div className="movie-card-container" key={movie.movie_id}>
                  <MovieCard
                    movie={movie}
                    showAddToPlaylist
                    onAddToPlaylist={handleAddToPlaylist}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Animated Section */}
          <div className="movie-section">
            <h2 className="section-title" style={titleStyle}>Animated Movies 🎨</h2>
            <div className="movie-row">
              {animatedMovies.slice(0, 20).map((movie) => (
                <div className="movie-card-container" key={movie.movie_id}>
                  <MovieCard
                    movie={movie}
                    showAddToPlaylist
                    onAddToPlaylist={handleAddToPlaylist}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Home;