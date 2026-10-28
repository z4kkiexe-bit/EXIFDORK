import { HomePage } from './pages/HomePage.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import './App.css'

// Tiny path switch so you don't need a router yet.
// If the app grows, swap this for react-router.
function App() {
  const sPath = window.location.pathname.replace(/\/+$/, '')

  if (sPath === '/login') return <LoginPage />

  return <HomePage />
}

export default App