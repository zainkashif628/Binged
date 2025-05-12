import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MovieCard from '../components/MovieCard';
import Chatbot from '../components/Chatbot';
import { useTheme } from '../contexts/ThemeContext';
import { moviesService as supabaseService } from '../services/databaseSupabase';
import { useUser } from '../contexts/UserContext';
import PlaylistDropdown from '../components/PlaylistDropdown';
import { getRecommendations } from '../services/recommendationService';

import './Home.css';

const Home = () => {
  const { themeColors } = useTheme();
  const { currentUser, addToDefaultPlaylist, addToWatched } = useUser();
  const navigate = useNavigate();
  
  const [animatedMovies, setAnimatedMovies] = useState([]);
  const [horrorMovies, setHorrorMovies] = useState([]);
  const [popularMovies, setPopularMovies] = useState([]);
  const [upcomingMovies, setUpcomingMovies] = useState([]);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [recommendedMovies, setRecommendedMovies] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);
  const slideIntervalRef = useRef(null);
  
  // Hero slider movies
  const [heroMovies, setHeroMovies] = useState([]);
  const [error, setError] = useState(null);
  const [heroLikeStates, setHeroLikeStates] = useState({});
  const [heroWatchedStates, setHeroWatchedStates] = useState({});

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
        const popular = await supabaseService.getPopularMovies();
        // console.log(`Fetched ${popular?.length || 0} popular movies`);
        
        const upcoming = await supabaseService.getUpcomingMovies();
        // console.log(`Fetched ${upcoming?.length || 0} upcoming movies`);
        
        if (currentUser?.id) {
          try {
            const recommendations = await getRecommendations(currentUser.id);
            console.log("Fetched recommendations:", recommendations);
            setRecommendedMovies(recommendations);
          } catch (err) {
            console.error('Error fetching recommendations:', err);
          }
        }

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

  // Update like/watched states for hero movies when user or heroMovies change
  useEffect(() => {
    if (!currentUser || !heroMovies.length) return;
    const likeStates = {};
    const watchedStates = {};
    heroMovies.forEach(movie => {
      // Liked
      const likedPlaylist = currentUser.playlists?.find(p => p.name === 'Liked');
      likeStates[movie.movie_id] = !!(likedPlaylist && likedPlaylist.movies.some(m => (m.movie_id || m.id) === movie.movie_id));
      // Watched
      watchedStates[movie.movie_id] = !!(currentUser.watchedMovies && currentUser.watchedMovies.some(m => (m.movie_id || m.id) === movie.movie_id));
    });
    setHeroLikeStates(likeStates);
    setHeroWatchedStates(watchedStates);
  }, [currentUser, heroMovies]);

  const handleHeroLike = async (movie, e) => {
    e.stopPropagation();
    if (!currentUser) {
      alert('Please log in to like movies');
      return;
    }
    const newLiked = !heroLikeStates[movie.movie_id];
    setHeroLikeStates(prev => ({ ...prev, [movie.movie_id]: newLiked }));
    await addToDefaultPlaylist(movie, 'Liked', newLiked);
  };

  const handleHeroWatched = async (movie, e) => {
    e.stopPropagation();
    if (!currentUser) {
      alert('Please log in to mark movies as watched');
      return;
    }
    const newWatched = !heroWatchedStates[movie.movie_id];
    setHeroWatchedStates(prev => ({ ...prev, [movie.movie_id]: newWatched }));
    await addToWatched(movie, newWatched);
  };

  const handleAddToPlaylist = (movie, e) => {
    e.stopPropagation();
    if (currentUser) {
      setShowAddToPlaylist(!showAddToPlaylist);
    } else {
      if (window.confirm('You need to be logged in to add movies to playlists. Go to login page?')) {
        navigate('/login');
      }
    }
  };
  
  const handlePlaylistSelected = (playlistId) => {
    setShowAddToPlaylist(false);
    setIsAdding(true);
    // Show checkmark for 1.5 seconds
    setTimeout(() => {
      setIsAdding(false);
    }, 1500);
    // Implementation would connect to your playlists state management
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
    <>
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
                      <div className="hero-buttons">
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
                        {/* Like and Watched buttons (replace Add to Playlist) */}
                        <button
                          className={`like-btn ${heroLikeStates[movie.movie_id] ? 'active' : ''}`}
                          onClick={(e) => handleHeroLike(movie, e)}
                          aria-label={heroLikeStates[movie.movie_id] ? "Remove from liked" : "Add to liked"}
                          title="Like"
                          style={{ marginLeft: 1 }}
                        >
                          <span className="heart-icon">{heroLikeStates[movie.movie_id] ? '♥' : '♡'}</span>
                        </button>
                        <button
                          className={`watched-btn ${heroWatchedStates[movie.movie_id] ? 'active' : ''}`}
                          onClick={(e) => handleHeroWatched(movie, e)}
                          aria-label={heroWatchedStates[movie.movie_id] ? "Unmark as watched" : "Mark as watched"}
                          title="Mark as watched"
                          style={{ marginLeft: 1, borderRadius: '50%'}}
                        >
                          <span className="eye-icon">{heroWatchedStates[movie.movie_id] ? '✓' : '👁️'}</span>
                        </button>
                        <button 
                          className={`action-btn playlist-btn ${isAdding ? 'active' : ''}`}
                          onClick={(e) => handleAddToPlaylist(movie, e)}
                          aria-label="Add to playlist"
                          title="Add to playlist"
                        >
                          <span className="btn-icon">{isAdding ? '✓' : '+'}</span>
                        </button>
                        
                        {showAddToPlaylist && (
                          <div
                            style={{position: 'absolute', top: 60, right: 24, zIndex: 9999}}
                            className="playlist-dropdown-wrapper header-dropdown"
                            onClick={e => e.stopPropagation()}
                          >
                            <PlaylistDropdown
                              movie={movie}
                              onPlaylistSelected={handlePlaylistSelected}
                              onClose={() => setShowAddToPlaylist(false)}
                            />
                          </div>
                        )}
                      </div>
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

          {/* Recommended Movies Section - Only show if user is logged in */}
          {currentUser && recommendedMovies.length > 0 && (
            <div className="movie-section">
              <h2 className="section-title" style={titleStyle}>Recommended for You 🎯</h2>
              <div className="movie-row">
                {recommendedMovies.slice(0, 6).map((movie) => (
                  <div className="movie-card-container" key={movie.movie_id || movie.id}>
                    <MovieCard
                      movie={movie}
                      showAddToPlaylist
                      onAddToPlaylist={handleAddToPlaylist}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

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
    </>
  );
};

export default Home;