import React, { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    fetch('http://localhost:5000/api/movies')
      .then(response => response.json())
      .then(data => {
        setMovies(data);
        console.log(data);
        console.log('hi');
      })
      .catch(error => console.error('Error fetching movies:', error));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1 style={{ paddingLeft: '50px' }}>Movie List</h1>
        <ul>
          {movies.map(movie => (
            <li key={movie.movie_id}>
              <img src={"https://image.tmdb.org/t/p/w200" + movie.poster_path} alt={movie.title} />
              <h2>{movie.title}</h2>
              <p>{movie.synopsis}</p>
              <p>Release Date: {movie.release_date}</p>
              <p>Popularity: {movie.popularity}</p>
              <br></br>
            </li>
          ))}
        </ul>
      </header>
    </div>
  );
}

export default App;