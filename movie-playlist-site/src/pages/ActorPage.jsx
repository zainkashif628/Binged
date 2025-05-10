import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../services/supabaseClient';
import './ActorPage.css';

const ActorPage = () => {
  const { actorId } = useParams();
  const { themeColors } = useTheme();
  const navigate = useNavigate();
  
  const [actor, setActor] = useState(null);
  const [movies, setMovies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchActorData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch actor details
        const { data, error } = await supabase
          .from('crew_member')
          .select(`
            *,
            movie_actor (
              movie_id,
              movie:movie_id (
                movie_id,
                title,
                release_date,
                poster_path,
                vote_avg
              )
            )
          `)
          .eq('member_id', actorId);
        if (error) throw error;
        const actorData = data;
        console.log(actorData);
        setActor(actorData[0]);

        // Fetch actor's movies
        // const creditsResponse = await fetch(`https://api.themoviedb.org/3/person/${actorId}/movie_credits?api_key=11f9c5c0b5a6586654ea01368e6c5ed4&language=en-US`);

        // if (!creditsResponse.ok) {
        //   throw new Error('Failed to fetch actor credits');
        // }
        
        // const creditsData = await creditsResponse.json();
        
        // Sort movies by popularity
        // const sortedMovies = creditsData.cast.sort((a, b) => b.popularity - a.popularity);
        // extract movie details
        const moviesData = actorData.flatMap(item =>
          item.movie_actor?.map(actorMovie => actorMovie.movie).filter(Boolean) || []
        );
        // Sort movies by popularity
        const sortedMovies = moviesData.sort((a, b) => b.popularity - a.popularity);
        setMovies(sortedMovies);
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching actor data:', err);
        setError(err.message || 'Failed to load actor data');
        setIsLoading(false);
      }
    };
    
    fetchActorData();
  }, [actorId]);
  
  if (isLoading) {
    return (
      <div className="actor-page loading" style={{ backgroundColor: themeColors.background }}>
        <div className="loading-spinner"></div>
        <p>Loading actor information...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="actor-page error" style={{ backgroundColor: themeColors.background }}>
        <h2>Error</h2>
        <p>{error}</p>
        <button 
          onClick={() => navigate(-1)}
          style={{ backgroundColor: themeColors.primary }}
        >
          Go Back
        </button>
      </div>
    );
  }
  
  if (!actor) {
    return (
      <div className="actor-page not-found" style={{ backgroundColor: themeColors.background }}>
        <h2>Actor Not Found</h2>
        <p>We couldn't find the actor you're looking for.</p>
        <button 
          onClick={() => navigate(-1)}
          style={{ backgroundColor: themeColors.primary }}
        >
          Go Back
        </button>
      </div>
    );
  }
  
  // Format the profile URL
  const profileUrl = actor.profile_url 
    ? `https://image.tmdb.org/t/p/w300${actor.profile_url}`
    : 'https://via.placeholder.com/300x450?text=No+Photo';
  
  // Calculate age if birth date is available and actor is alive
  const calculateAge = () => {
    if (!actor.birthday) return null;
    
    const birthDate = new Date(actor.birthday);
    let endDate = new Date();
    
    if (actor.death_date) {
      endDate = new Date(actor.death_date);
    }
    
    let age = endDate.getFullYear() - birthDate.getFullYear();
    
    // Adjust age if birthday hasn't occurred yet this year
    if (
      endDate.getMonth() < birthDate.getMonth() || 
      (endDate.getMonth() === birthDate.getMonth() && endDate.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    
    return age;
  };
  
  // Format date to be more readable
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="actor-page" style={{ backgroundColor: themeColors.background, color: themeColors.text }}>
      <div className="actor-content">
        <div className="actor-header">
          <div className="profile-container">
            <img src={profileUrl} alt={actor.name} className="profile-image" />
          </div>
          
          <div className="actor-info">
            <h1>{actor.name}</h1>
            
            {actor.birthday && (
              <div className="birth-info">
                <span className="birth-date">Born: {formatDate(actor.birthday)}</span>
                
                {actor.place_of_birth && (
                  <span className="birth-place">in {actor.place_of_birth}</span>
                )}
                
                {calculateAge() !== null && !actor.death_date && (
                  <span className="age">({calculateAge()} years old)</span>
                )}
              </div>
            )}
            
            {actor.death_date && (
              <div className="death-info">
                <span>Died: {formatDate(actor.death_date)}</span>
                {calculateAge() !== null && (
                  <span className="age">({calculateAge()} years old)</span>
                )}
              </div>
            )}
            
            {actor.known_for && (
              <div className="department">{actor.known_for === "Directing" ? "Director" : actor.gender === "female" ? "Actress" : "Actor"}</div>
            )}

            {actor.biography && (
              <div className="biography">
                <h3>Biography</h3>
                <div className="biography-text">{actor.biography}</div>
              </div>
            )}
          </div>
        </div>
        
        {movies.length > 0 && (
          <div className="filmography-section">
            <h2>Filmography</h2>
            <div className="movies-grid">
              {movies.map(movie => (
                <Link to={`/movie/${movie.movie_id}`} key={movie.movie_id} className="movie-card">
                  <div className="movie-poster-container">
                    {movie.poster_path ? (
                      <img 
                        src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`} 
                        alt={movie.title}
                        className="movie-poster"
                      />
                    ) : (
                      <div className="no-poster" style={{ backgroundColor: themeColors.surface }}>
                        No Poster
                      </div>
                    )}
                    
                    {movie.vote_avg > 0 && (
                      <div className="movie-rating" style={{ backgroundColor: `${themeColors.surface}CC` }}>
                        <span>⭐ {movie.vote_avg.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="movie-details" style={{ backgroundColor: themeColors.surface }}>
                    <h3 className="movie-title">{movie.title}</h3>
                    {movie.release_date && (
                      <div className="movie-year">
                        {new Date(movie.release_date).getFullYear()}
                      </div>
                    )}
                    {/* {movie.character && (
                      <div className="movie-character">
                        as <span>{movie.character}</span>
                      </div>
                    )} */}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        
        <button 
          onClick={() => navigate(-1)} 
          className="back-button"
          style={{ backgroundColor: themeColors.primary }}
        >
          Back to Movie
        </button>
      </div>
    </div>
  );
};

export default ActorPage;