import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { fetchMovieBackdrop } from '../services/tmdbService';
import { getImdbRating } from '../services/omdbService';
import { usersService, moviesService as supabaseService } from '../services/databaseSupabase';
import Chatbot from '../components/Chatbot';
import PlaylistDropdown from '../components/PlaylistDropdown';
import './MoviePage.css';

// Star Rating Component
const StarRating = ({ rating, setRating }) => {
  const [hover, setHover] = useState(0);
  
  return (
    <div className="star-rating">
      {[...Array(10)].map((_, index) => {
        const ratingValue = index + 1;
        
        return (
          <button
            type="button"
            key={ratingValue}
            className={`star-btn ${ratingValue <= (hover || rating) ? "active" : ""}`}
            onClick={() => setRating(ratingValue)}
            onMouseEnter={() => setHover(ratingValue)}
            onMouseLeave={() => setHover(0)}
          >
            <span className="star">★</span>
          </button>
        );
      })}
      <span className="rating-value">{rating}/10</span>
    </div>
  );
};

const MoviePage = () => {
  const { movieId } = useParams();
  const { themeColors } = useTheme();
  const { currentUser, addToDefaultPlaylist, addToWatched } = useUser();
  const navigate = useNavigate();
  
  const [movie, setMovie] = useState(null);
  const [backdropUrl, setBackdropUrl] = useState(null);
  const [credits, setCredits] = useState(null);
  const [userReviews, setUserReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [newReview, setNewReview] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [isLiked, setIsLiked] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [reviewUsernames, setReviewUsernames] = useState({});

  useEffect(() => {
    const fetchMovieData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch movie details
        const movieData = await supabaseService.getMovieById(movieId);
        const imdbRating = await getImdbRating(movieId);
        movieData.imdb_rating = imdbRating;
        // const movieData = await getMovieDetails(movieId);
        setMovie(movieData);
        
        // Fetch credits (cast and crew)
        const creditsData = await supabaseService.getMovieCredits(movieId);
        setCredits(creditsData);
        
        // Fetch user reviews
        const { reviews: fetchedUserReviews } = await supabaseService.getMovieReviews(movieId);
        setUserReviews(fetchedUserReviews || []);
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching movie data:', JSON.stringify(err));
        setError('Failed to load movie data. Please try again.');
        setIsLoading(false);
      }
    };
    
    fetchMovieData();
  }, [movieId]);

  // Fetch usernames for all reviews after userReviews is set
  useEffect(() => {
    const fetchUsernames = async () => {
      const uniqueUserIds = [...new Set(userReviews.map(r => r.user_id).filter(Boolean))];
      const usernames = {};
      await Promise.all(uniqueUserIds.map(async (userId) => {
        try {
          usernames[userId] = await usersService.getUsernameById(userId);
        } catch (e) {
          usernames[userId] = 'Unknown';
        }
      }));
      setReviewUsernames(usernames);
    };
    if (userReviews.length > 0) {
      fetchUsernames();
    } else {
      setReviewUsernames({});
    }
  }, [userReviews]);

  // Check if movie is in liked/watched playlists when component mounts
  useEffect(() => {
    if (currentUser && currentUser.playlists && movie) {
      // Check if in Liked playlist
      const likedPlaylist = currentUser.playlists.find(p => p.name === 'Liked');
      if (likedPlaylist) {
        const isInLiked = likedPlaylist.movies.some(m => m.movie_id === movie.movie_id);
        setIsLiked(isInLiked);
      }
      
      // Check if in Watched playlist
      const watchedPlaylist = currentUser.playlists.find(p => p.name === 'Watched');
      if (watchedPlaylist) {
        const isInWatched = watchedPlaylist.movies.some(m => m.movie_id === movie.movie_id);
        setIsWatched(isInWatched);
      }
    }
  }, [currentUser, movie]);

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleAddToPlaylist = () => {
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
    console.log(`Movie ${movie.title} added to playlist with ID: ${playlistId}`);
  };
  
  const handleLikeClick = () => {
    if (!currentUser) {
      // If no user is logged in, prompt to login
      if (window.confirm('Please log in to like movies. Go to login page?')) {
        navigate('/login');
      }
      return;
    }
    
    // Toggle liked state
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    
    // Add to or remove from default "Liked" playlist
    addToDefaultPlaylist(movie, 'Liked', newLikedState);
  };

  const handleWatchedClick = () => {
    if (!currentUser) {
      // If no user is logged in, prompt to login
      if (window.confirm('Please log in to mark movies as watched. Go to login page?')) {
        navigate('/login');
      }
      return;
    }
    
    // Toggle watched state
    const newWatchedState = !isWatched;
    setIsWatched(newWatchedState);
    
    // Add to or remove from default "Watched" playlist
    addToDefaultPlaylist(movie, 'Watched', newWatchedState);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      if (window.confirm('You need to be logged in to post reviews. Go to login page?')) {
        navigate('/login');
      }
      return;
    }
    const review = {
      movie_id: movieId,
      content: newReview,
      vote: newRating,
      created: new Date().toISOString(),
      user_id: currentUser.id,
    };
    try {
      await supabaseService.addReview(movieId, review);
      // After adding, reload reviews from backend to get correct review_id
      const { reviews: fetchedUserReviews } = await supabaseService.getMovieReviews(movieId);
      setUserReviews(fetchedUserReviews || []);
      setNewReview('');
      setNewRating(5);
    } catch (err) {
      console.error('Error adding review:', err.message);
      setError('Failed to add review. Please try again.');
      return;
    }
  };

  useEffect(() => {
    const getBackdrop = async () => {
      const backdropPath = await fetchMovieBackdrop(movieId);

      if (backdropPath) {
        setBackdropUrl(`https://image.tmdb.org/t/p/original${backdropPath}`);
      }
    };

    getBackdrop();
  }, [movieId]);

  if (isLoading) {
    return (
      <div className="movie-page loading">
        <div className="loading-spinner"></div>
        <p>Loading movie details...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="movie-page error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }
  
  if (!movie) {
    return (
      <div className="movie-page not-found">
        <h2>Movie Not Found</h2>
        <p>We couldn't find the movie you're looking for.</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  // Format the poster URL
  const posterUrl = movie.poster_path 
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : 'https://dummyimage.com/500x750/000/fff&text=No+Poster';

  return (
    <div className="movie-page" style={{ backgroundColor: themeColors.background }}>
      {/* Header with Go Back Button and Action Buttons */}
      <div className="movie-page-header">
        <button 
          onClick={handleGoBack} 
          className="go-back-btn"
        >
          ← Back
        </button>
        
        {movie && (
          <div className="header-action-buttons">
            <button 
              className={`action-btn like-btn ${isLiked ? 'active' : ''}`}
              onClick={handleLikeClick}
              aria-label={isLiked ? "Remove from liked" : "Add to liked"}
              title={isLiked ? "Unlike" : "Like"}
            >
              <span className="btn-icon">{isLiked ? '♥' : '♡'}</span>
            </button>
            
            <button 
              className={`action-btn watched-btn ${isWatched ? 'active' : ''}`}
              onClick={handleWatchedClick}
              aria-label={isWatched ? "Remove from watched" : "Add to watched"}
              title={isWatched ? "Unmark as watched" : "Mark as watched"}
            >
              <span className="btn-icon">{isWatched ? '✓' : '👁️'}</span>
            </button>
            
            <button 
              className={`action-btn playlist-btn ${isAdding ? 'active' : ''}`}
              onClick={handleAddToPlaylist}
              aria-label="Add to playlist"
              title="Add to playlist"
            >
              <span className="btn-icon">{isAdding ? '✓' : '+'}</span>
            </button>
            
            {showAddToPlaylist && (
              <div className="playlist-dropdown-wrapper header-dropdown">
                <PlaylistDropdown
                  movie={movie}
                  onPlaylistSelected={handlePlaylistSelected}
                  onClose={() => setShowAddToPlaylist(false)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Move the backdrop here, after the header but before the main content */}
      {backdropUrl && (
        <div className="backdrop" style={{ backgroundImage: `url(${backdropUrl})` }}>
          <div className="backdrop-overlay" style={{ backgroundColor: `${themeColors.background}CC` }}></div>
        </div>
      )}
      
      {/* Movie Content */}
      <div className="movie-content">
        <div className="movie-header">
          <div className="poster-container">
            <img src={posterUrl} alt={movie.title} className="movie-poster" />
          </div>
          
          <div className="movie-info">
            <h1>{movie.title} {movie.release_date && <span>({new Date(movie.release_date).getFullYear()})</span>}</h1>
            <div className="tagline">{movie.tagline}</div>

            <div className="movie-meta">
              {movie.runtime && <span>{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span>}
              {movie.genres && movie.genres.map(genre => (
                <span key={genre.genre_id} className="genre-tag">{genre}</span>
              ))}
              {movie.vote_avg && (
                <div className="rating">
                  <span>⭐ {movie.vote_avg.toFixed(1)}</span>
                  <span>({movie.vote_count} votes)</span>
                  {movie.imdb_rating && (
                    <div className="rating-source"> | </div>
                  )}
                  {movie.imdb_rating && (
                    <div className="imdb-rating">
                        <span>IMDb: {movie.imdb_rating.rating}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            
            <div className="overview">
              <h3>Overview</h3>
              <p>{movie.synopsis || 'No synopsis available'}</p>
            </div>
            
            <div className="additional-info">
            <div>
                <strong>Status:</strong> {movie.status}
              </div>
              {movie.budget > 0 && (
                <div>
                  <strong>Budget:</strong> ${(movie.budget / 1000000).toFixed(1)} million
                </div>
              )}
              {movie.language.name && (
                <div>
                  <strong>Language:</strong> {movie.language.name}
                </div>
              )}

              {movie.release_date && (
                <div>
                  <strong>Release Date:</strong> {new Date(movie.release_date).toLocaleDateString()}
                </div>
              )}
              {movie.revenue > 0 && (
                <div>
                  <strong>Revenue:</strong> ${(movie.revenue / 1000000).toFixed(1)} million
                </div>
              )}
              {movie.rating && (
                <div>
                  <strong>MPAA Rating:</strong> {movie.rating}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Cast Section */}
        {credits && credits.cast && credits.cast.length > 0 && (
          <div className="cast-section">
            <h2>Crew</h2>
            <div className="cast-list">
              {credits.cast.slice(0, 12).map(person => (
                <Link to={`/actor/${person.id}`} key={person.id} className="cast-member">
                  <div className="actor-photo">
                    {person.profile_url ? (
                      <img 
                        src={`https://image.tmdb.org/t/p/w185${person.profile_url}`} 
                        alt={person.name}
                      />
                    ) : (
                      <img
                        src={`https://dummyimage.com/185x278/000/fff&text=No+Photo`}
                        alt="No Photo"
                      />
                    )}
                  </div>
                  <div className="actor-info">
                    <div className="actor-name">{person.name}</div>
                    <div className="role"> {person.known_for === "Directing" ? "Director" : person.gender === "female" ? "Actress" : "Actor"}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        
        {/* Reviews Section */}
        <div className="reviews-section">
          <h2>Reviews</h2>
          
          {/* User review form */}
          {currentUser && (
            <form onSubmit={handleSubmitReview} className="review-form">
              <h3>Write a Review</h3>
              
              <div className="rating-input">
                <label>Your Rating:</label>
                <StarRating rating={newRating} setRating={setNewRating} />
              </div>
              
              <textarea
                placeholder="Share your thoughts on this movie..."
                value={newReview}
                onChange={(e) => setNewReview(e.target.value)}
                style={{ backgroundColor: themeColors.surface, color: themeColors.text }}
              ></textarea>
              
              <button 
                type="submit"
                style={{ backgroundColor: themeColors.primary, color: themeColors.buttonText }}
              >
                Submit Review
              </button>
            </form>
          )}
          
          {/* All reviews */}
          <div className="reviews-list">
            {/* User reviews */}
            {userReviews.length > 0 && (
              <div className="reviews-container">
                <h3>User Reviews</h3>
                {userReviews.map(review => (
                  <div key={review.review_id} className="review" style={{ backgroundColor: themeColors.surface }}>
                    <div className="review-header">
                      <div className="reviewer">
                        <strong>{reviewUsernames[review.user_id] || '...'}</strong>
                        <span className="review-date">
                          {new Date(review.created).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="review-rating">{'★'.repeat(review.vote)} <span className="rating-number">{review.vote}/10</span></div>
                    </div>
                    <div className="review-content">{review.content}</div>
                  </div>
                ))}
              </div>
            )}
          
            {userReviews.length === 0 && (
              <div className="no-reviews">
                <p>No reviews yet. {!currentUser && 'Log in to be the first to review!'}</p>
              </div>
            )}
          </div>
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


export default MoviePage;