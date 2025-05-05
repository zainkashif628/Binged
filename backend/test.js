const express = require('express');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

dotenv.config();

const app = express();
const port = 5000;

app.use(cors());

// Supabase client setup
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_API_KEY);

// API endpoint to fetch movies
app.get('/api/movies', async (req, res) => {
  try {
    const { data, error } = await supabase.from('movie').select('*');
    if (error) throw error;

    // Example processing: filter movies with a popularity > 50
    const processedMovies = data.filter(movie => movie.popularity > 50);
    res.json(processedMovies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});