import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { LandingLayout } from '../layouts/LandingLayout';
import { useToast } from '../components/Toast';

export const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { success: toastSuccess, error: toastError, ToastContainer } = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [remember, setRemember] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
    emailRef.current?.focus();
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password.trim()) {
      toastError(t('auth.loginFailed'), t('auth.fillFields'));
      return;
    }
    setLoading(true);
    try {
      await login(form.email.trim(), form.password);
      toastSuccess(t('auth.welcomeBackToast'), t('auth.loginSuccessToast'));
      setSuccess(true);
      setTimeout(() => navigate('/dashboard', { replace: true }), 600);
    } catch (err) {
      toastError(t('auth.loginFailed'), err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LandingLayout hideFooter>
      <ToastContainer />
      <div className="auth-page">
        <div className="auth-container">
          {/* Left - Illustration */}
          <div className="auth-illustration">
            <div className="auth-illustration-content">
              <div className="auth-illustration-badge">{t('auth.loginTitle')}</div>
              <h2 className="auth-illustration-title">
                {t('auth.illustrationTitle1')}<br />
                <span className="auth-illustration-gradient">{t('auth.illustrationTitle2')}</span>
              </h2>
              <ul className="auth-benefits">
                {[
                  { icon: '🚀', text: t('auth.benefitAccess') },
                  { icon: '⚡', text: t('auth.benefitRules') },
                  { icon: '📊', text: t('auth.benefitAnalytics') },
                  { icon: '🔒', text: t('auth.benefitSecure') },
                ].map((b) => (
                  <li key={b.text} className="auth-benefit-item">
                    <span className="auth-benefit-icon">{b.icon}</span>
                    <span>{b.text}</span>
                  </li>
                ))}
              </ul>
              <div className="auth-illustration-quote">
                {t('auth.quoteText')}
                <span className="auth-illustration-author">{t('auth.quoteAuthor')}</span>
              </div>
            </div>
          </div>

          {/* Right - Login Form */}
          <div className="auth-form-wrapper">
            <div className="auth-form-card">
              <div className="auth-form-header">
                <Link to="/" className="auth-form-logo">
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
                <h2 className="auth-form-title">{t('auth.loginTitle')}</h2>
                <p className="auth-form-subtitle">{t('auth.loginSubtitle')}</p>
              </div>

              {success ? (
                <div className="auth-success-state">
                  <div className="auth-success-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3>{t('auth.loginSuccessful')}</h3>
                  <p>{t('auth.redirecting')}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="auth-form" noValidate>

                  <div className="auth-input-group">
                    <label htmlFor="email" className="auth-label">{t('auth.emailOrUsername')}</label>
                    <div className="auth-input-wrapper">
                      <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22 6 12 13 2 6" />
                      </svg>
                      <input
                        ref={emailRef}
                        id="email"
                        name="email"
                        type="text"
                        value={form.email}
                        onChange={handleChange}
                        className="auth-input"
                        placeholder={t('auth.emailPlaceholder')}
                        autoComplete="username"
                        aria-required="true"
                      />
                    </div>
                  </div>

                  <div className="auth-input-group">
                    <label htmlFor="password" className="auth-label">{t('auth.password')}</label>
                    <div className="auth-input-wrapper">
                      <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={handleChange}
                        className="auth-input"
                        placeholder={t('auth.passwordPlaceholder')}
                        autoComplete="current-password"
                        aria-required="true"
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                      >
                        {showPassword ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="auth-form-options">
                    <label className="auth-checkbox">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                      />
                      <span className="auth-checkbox-mark" />
                      <span>{t('auth.rememberMe')}</span>
                    </label>
                    <button type="button" className="auth-forgot-btn" tabIndex={-1}>
                      {t('auth.forgotPassword')}
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="auth-spinner" />
                    ) : (
                      <>
                        {t('auth.login')}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                        </svg>
                      </>
                    )}
                  </button>

                  <p className="auth-switch">
                    {t('auth.dontHaveAccount')}{' '}
                    <Link to="/register">{t('auth.createOne')}</Link>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </LandingLayout>
  );
};
