import './Navbar.css'

function Navbar() {
  return (
    <header className="navbar">
      <a className="brand" href="/" aria-label="EXIFDORK home">
        <span className="brand-mark">e.</span>
        <span>EXIFDORK</span>
      </a>

      <span className="navbar-caption">A LITTLE MORE THAN A FILE</span>
    </header>
  )
}

export default Navbar
