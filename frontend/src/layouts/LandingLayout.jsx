import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../hooks/useDarkMode';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export const LandingLayout = ({ children, hideFooter = false }) => {
  const { t } = useTranslation();
  const { isAuthenticated, logout, user } = useAuth();
  const { isDark, toggle } = useDarkMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isLanding = location.pathname === '/';

  const navLinks = isLanding
    ? [
        { label: t('nav.home'), href: '#hero' },
        { label: t('nav.features'), href: '#features' },
        { label: t('nav.workflow'), href: '#workflow' },
        { label: t('nav.about'), href: '#about' },
      ]
    : [];

  const handleNavClick = (e, href) => {
    e.preventDefault();
    if (location.pathname !== '/') {
      navigate('/' + href);
      return;
    }
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="landing-wrapper">
      {/* ── Navigation ─────────────────────────────────────── */}
      <header className={`landing-nav ${scrolled ? 'landing-nav-scrolled' : ''}`}>
        <div className="landing-nav-inner">
          <Link to="/" className="landing-logo">
            <div className="landing-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <span className="landing-logo-text">FormFlow</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="landing-nav-links">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="landing-nav-link"
                onClick={(e) => handleNavClick(e, link.href)}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="landing-nav-actions">
            <LanguageSwitcher />
            <button
              onClick={toggle}
              className="landing-theme-toggle"
              aria-label={isDark ? t('common.lightMode') : t('common.darkMode')}
              title={isDark ? t('common.lightMode') : t('common.darkMode')}
            >
              {isDark ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="landing-nav-user">
                  <span className="landing-nav-user-avatar">{user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'U'}</span>
                  <span className="hidden md:inline text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{user?.fullName || user?.username}</span>
                </span>
                <Link to="/dashboard" className="landing-btn landing-btn-primary text-sm px-4 py-2">
                  {t('nav.dashboard')}
                </Link>
                <button onClick={handleLogout} className="landing-btn landing-btn-ghost text-sm px-3 py-2">
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="landing-btn landing-btn-ghost text-sm px-4 py-2 hidden sm:inline-flex">
                  {t('nav.login')}
                </Link>
                <Link to="/register" className="landing-btn landing-btn-primary text-sm px-4 py-2">
                  {t('nav.register')}
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="landing-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={t('nav.toggleMenu')}
            >
              <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`landing-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="landing-mobile-menu-content">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="landing-mobile-link"
                onClick={(e) => handleNavClick(e, link.href)}
              >
                {link.label}
              </a>
            ))}
            {isAuthenticated ? (
              <>
                <div className="border-t my-3" style={{ borderColor: 'var(--color-border)' }} />
                <Link to="/dashboard" className="landing-mobile-link font-semibold">{t('nav.dashboard')}</Link>
                <button onClick={handleLogout} className="landing-mobile-link text-red-500">{t('nav.logout')}</button>
              </>
            ) : (
              <>
                <div className="border-t my-3" style={{ borderColor: 'var(--color-border)' }} />
                <Link to="/login" className="landing-mobile-link">{t('nav.login')}</Link>
                <Link to="/register" className="landing-mobile-link font-semibold" style={{ color: 'var(--color-info)' }}>{t('nav.register')}</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────── */}
      <main className="landing-main">
        {children}
      </main>

      {/* ── Footer ────────────────────────────────────────── */}
      {!hideFooter && (
        <footer className="landing-footer">
          <div className="landing-footer-inner">
            <div className="landing-footer-grid">
              <div className="landing-footer-brand">
                <div className="landing-logo mb-3">
                  <div className="landing-logo-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>
                  <span className="landing-logo-text">FormFlow</span>
                </div>
                <p className="landing-footer-desc">
                  {t('landing.footerDesc')}
                </p>
              </div>

              <div className="landing-footer-col">
                <h4>{t('landing.product')}</h4>
                <a href="#features">{t('nav.features')}</a>
                <a href="#workflow">{t('landing.workflowBadge')}</a>
                <Link to="/register">{t('landing.pricing')}</Link>
                <Link to="/register">{t('landing.changelog')}</Link>
              </div>

              <div className="landing-footer-col">
                <h4>{t('landing.company')}</h4>
                <a href="#about">{t('nav.about')}</a>
                <a href="mailto:hello@formflow.dev">{t('landing.contact')}</a>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">Twitter</a>
              </div>

              <div className="landing-footer-col">
                <h4>{t('landing.legal')}</h4>
                <a href="#">{t('landing.privacy')}</a>
                <a href="#">{t('landing.terms')}</a>
                <a href="#">{t('landing.cookiePolicy')}</a>
              </div>
            </div>

            <div className="landing-footer-bottom">
              <p>&copy; {new Date().getFullYear()} FormFlow. {t('landing.rightsReserved')}</p>
              <div className="landing-footer-social">
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                </a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};
