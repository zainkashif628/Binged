import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ConfirmedPage from './pages/ConfirmedPage.jsx';
import SignupForm from './components/SignUpForm.jsx';
import LoginForm from './components/LoginForm.jsx';
// import Dashboard from './Dashboard';

// Add a simple Home component
function Home() {
  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '3rem auto', 
      padding: '2rem', 
      textAlign: 'center',
      borderRadius: '10px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
    }}>
      <h1>Movie Playlist Site</h1>
      <p>Create and share your favorite movie playlists!</p>
      
      <div style={{ marginTop: '2rem' }}>
        <a href="/signup" style={{
          display: 'inline-block',
          padding: '12px 24px',
          backgroundColor: '#4CAF50',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '5px',
          fontWeight: 'bold',
          marginRight: '15px'
        }}>
          Sign Up
        </a>
        <a href="/login" style={{
          display: 'inline-block',
          padding: '12px 24px',
          backgroundColor: '#2196F3',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '5px',
          fontWeight: 'bold'
        }}>
          Log In
        </a>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<SignupForm />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/confirmed" element={<ConfirmedPage />} />
        {/* <Route path="/dashboard" element={<Dashboard />} /> */}
      </Routes>
    </BrowserRouter>
  );
}


export default App;