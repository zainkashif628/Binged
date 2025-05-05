import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SignupForm from './components/SignUpForm.jsx';
import ConfirmedPage from './pages/ConfirmedPage.jsx'; // create this file as shown before

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SignupForm />} />
        <Route path="/confirmed" element={<ConfirmedPage />} />
      </Routes>
    </Router>
  );
}

export default App;