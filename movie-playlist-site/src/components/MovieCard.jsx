import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { useTheme } from "../contexts/ThemeContext";
import PlaylistDropdown from "./PlaylistDropdown";
import { playlistsService } from '../services/databaseSupabase';
import "./MovieCard.css";

const MovieCard = ({ movie, showAddToPlaylist = true, onAddToPlaylist }) => {
  const navigate = useNavigate();
  const { currentUser, addToDefaultPlaylist, addToWatched } = useUser();
  const { themeColors } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isWatched, setIsWatched] = useState(false);

  // Format the poster URL or use a fallback image
  const posterUrl = movie.poster_path 
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : 'https://dummyimage.com/500x750/000/fff&text=No+Poster';

  // Check if movie is in liked playlist when component mounts
  useEffect(() => {
    if (currentUser && currentUser.playlists) {
      const likedPlaylist = currentUser.playlists.find(p => p.name === 'Liked');
      if (likedPlaylist) {
        const isInLiked = likedPlaylist.movies.some(m => (m.movie_id || m.id) === (movie.movie_id || movie.id));
        setIsLiked(isInLiked);
      } else {
        setIsLiked(false);
      }
    } else {
      setIsLiked(false);
    }
  }, [currentUser, movie.movie_id, movie.id]);

  // Check if movie is in watched list when component mounts
  useEffect(() => {
    if (currentUser && currentUser.watchedMovies) {
      const watched = currentUser.watchedMovies.some(m => (m.movie_id || m.id) === (movie.movie_id || movie.id));
      setIsWatched(watched);
    } else {
      setIsWatched(false);
    }
  }, [currentUser, movie.movie_id, movie.id]);

  const handleCardClick = () => {
    // Navigate to movie detail page instead of showing modal
    navigate(`/movie/${movie.movie_id}`);
  };

  const handleAddToPlaylistClick = (e) => {
    e.stopPropagation();
    if (!currentUser) {
      alert("Please log in to add movies to playlists");
      return;
    }
    setShowDropdown(prev => !prev);
  };

  const handleLikeClick = async (e) => {
    e.stopPropagation();
    if (!currentUser) {
      alert("Please log in to like movies");
      return;
    }
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    await addToDefaultPlaylist(movie, 'Liked', newLikedState);
  };

  const handleWatchedClick = async (e) => {
    e.stopPropagation();
    if (!currentUser) {
      alert("Please log in to mark movies as watched");
      return;
    }
    const newWatchedState = !isWatched;
    setIsWatched(newWatchedState);
    await addToWatched(movie, newWatchedState);
  };

  const handlePlaylistSelected = (playlistId) => {
    setShowDropdown(false);
    setIsAdding(true);
    setTimeout(() => {
      setIsAdding(false);
    }, 2000);
  };

  // Create a truncated synopsis if it's too long
  const truncatedSynopsis = movie.synopsis
    ? movie.synopsis.length > 100
      ? `${movie.synopsis.slice(0, 100)}...`
      : movie.synopsis
    : "No synopsis available";

  // Format release date to year only if available
  const releaseYear = movie.release_date
    ? new Date(movie.release_date).getFullYear()
    : null;

  return (
    <div 
      className="movie-card" 
      onClick={handleCardClick} 
      title={movie.title}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="poster-container">
        <img
          className="poster"
          src={posterUrl}
          alt={movie.title}
          loading="lazy"
        />
        {movie.vote_avg && (
          <div className="rating" style={{ 
            backgroundColor: `${themeColors.surface}CC`,
            color: themeColors.primary 
          }}>
            <span>⭐ {movie.vote_avg.toFixed(1)}</span>
          </div>
        )}
        
        {showAddToPlaylist && (
          <div className="poster-actions">
            <button 
              className={`like-btn ${isLiked ? 'active' : ''}`}
              onClick={handleLikeClick}
              aria-label={isLiked ? "Remove from liked" : "Add to liked"}
              title="Like"
            >
              <span className="heart-icon">{isLiked ? '♥' : '♡'}</span>
            </button>
            <button 
              className={`watched-btn ${isWatched ? 'active' : ''}`}
              onClick={handleWatchedClick}
              aria-label={isWatched ? "Unmark as watched" : "Mark as watched"}
              title="Mark as watched"
            >
              <span className="eye-icon">{isWatched ? '✓' : '👁️'}</span>
            </button>
            <button 
              className={`add-btn ${isAdding ? 'active' : ''}`}
              onClick={handleAddToPlaylistClick}
              aria-label="Add to playlist"
              title="Add to playlist"
            >
              {isAdding ? '✓' : '+'}
            </button>
          </div>
        )}
      </div>
      <div className={`overlay ${isHovered ? 'show-overlay' : ''}`}>
        <div className="movie-info">
          <h3>{movie.title}</h3>
          {releaseYear && <span className="year">({releaseYear})</span>}
          <p className="overview">{truncatedSynopsis}</p>
        </div>
      </div>
      
      {showDropdown && currentUser && (
        <div 
          className={`playlist-dropdown-container ${showDropdown ? 'visible' : ''}`} 
          onClick={e => e.stopPropagation()}
        >
          <PlaylistDropdown 
            movie={movie} 
            onPlaylistSelected={handlePlaylistSelected} 
            onClose={() => setShowDropdown(false)}
          />
        </div>
      )}
    </div>
  );
};

export default MovieCard;