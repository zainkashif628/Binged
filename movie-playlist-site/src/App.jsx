import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ConfirmedPage from './ConfirmedPage';
import SignupForm from './SignUpForm';
import Dashboard from './Dashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signup" element={<SignupForm />} />
        <Route path="/confirmed" element={<ConfirmedPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;