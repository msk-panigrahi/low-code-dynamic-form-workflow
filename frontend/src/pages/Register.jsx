import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { LandingLayout } from '../layouts/LandingLayout';
import { useToast } from '../components/Toast';

const PasswordStrength = ({ password }) => {
  const { t } = useTranslation();
  const getStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return Math.min(score, 5);
  };

  const strength = getStrength(password);
  const labels = t('auth.strengthLabels', { returnObjects: true });
  const colors = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#10b981'];
  const width = password ? (strength / 5) * 100 : 0;

  return (
    <div className="auth-password-strength" style={{ opacity: password ? 1 : 0 }}>
      <div className="auth-strength-bar">
        <div
          className="auth-strength-fill"
          style={{ width: `${width}%`, backgroundColor: colors[strength - 1] || '#e2e6ef' }}
        />
      </div>
      {password && (
        <span className="auth-strength-label" style={{ color: colors[strength - 1] }}>
          {labels[strength - 1]}
        </span>
      )}
    </div>
  );
};

export const Register = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, isAuthenticated } = useAuth();
  const { success: toastSuccess, error: toastError, ToastContainer } = useToast();
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
    nameRef.current?.focus();
  }, [isAuthenticated, navigate]);

  const validateField = (name, value) => {
    const errs = { ...fieldErrors };
    switch (name) {
      case 'fullName':
        if (!value.trim()) errs.fullName = t('auth.fullNameRequired');
        else if (value.trim().length < 2) errs.fullName = t('auth.nameMinLength');
        else delete errs.fullName;
        break;
      case 'username':
        if (!value.trim()) errs.username = t('auth.usernameRequired');
        else if (!/^[a-zA-Z0-9_]{3,20}$/.test(value)) errs.username = t('auth.usernamePattern');
        else delete errs.username;
        break;
      case 'email':
        if (!value.trim()) errs.email = t('auth.emailRequired');
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errs.email = t('auth.emailInvalid');
        else delete errs.email;
        break;
      case 'password':
        if (!value) errs.password = t('auth.passwordRequired');
        else if (value.length < 8) errs.password = t('auth.passwordMinLength');
        else delete errs.password;
        if (form.confirmPassword && value !== form.confirmPassword) {
          errs.confirmPassword = t('auth.passwordMatch');
        } else if (form.confirmPassword) {
          delete errs.confirmPassword;
        }
        break;
      case 'confirmPassword':
        if (!value) errs.confirmPassword = t('auth.confirmPasswordRequired');
        else if (value !== form.password) errs.confirmPassword = t('auth.passwordMatch');
        else delete errs.confirmPassword;
        break;
    }
    setFieldErrors(errs);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Final validation
    const errs = {};
    if (!form.fullName.trim()) errs.fullName = t('auth.fullNameRequired');
    if (!form.username.trim()) errs.username = t('auth.usernameRequired');
    if (!form.email.trim()) errs.email = t('auth.emailRequired');
    if (!form.password) errs.password = t('auth.passwordRequired');
    if (form.password !== form.confirmPassword) errs.confirmPassword = t('auth.passwordMatch');
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      toastError(t('auth.registrationFailed'), t('auth.fixFields'));
      return;
    }
    setLoading(true);
    try {
      await register({
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      toastSuccess(t('auth.accountCreatedToast'), t('auth.welcomeToast'));
      setSuccess(true);
      setTimeout(() => navigate('/dashboard', { replace: true }), 800);
    } catch (err) {
      toastError(t('auth.registrationFailed'), err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) =>
    `auth-input ${fieldErrors[field] ? 'auth-input-error' : ''}`;

  return (
    <LandingLayout hideFooter>
      <ToastContainer />
      <div className="auth-page">
        <div className="auth-container">
          {/* Left - Illustration */}
          <div className="auth-illustration">
            <div className="auth-illustration-content">
              <div className="auth-illustration-badge">{t('nav.register')}</div>
              <h2 className="auth-illustration-title">
                {t('auth.regIllustrationTitle1')}<br />
                <span className="auth-illustration-gradient">{t('auth.regIllustrationTitle2')}</span>
              </h2>
              <ul className="auth-benefits">
                {[
                  { icon: '✨', text: t('auth.regBenefitFree') },
                  { icon: '🧩', text: t('auth.regBenefitBuilder') },
                  { icon: '⚡', text: t('auth.regBenefitLogic') },
                  { icon: '🔗', text: t('auth.regBenefitShare') },
                ].map((b) => (
                  <li key={b.text} className="auth-benefit-item">
                    <span className="auth-benefit-icon">{b.icon}</span>
                    <span>{b.text}</span>
                  </li>
                ))}
              </ul>
              <div className="auth-illustration-quote">
                {t('auth.regQuoteText')}
                <span className="auth-illustration-author">{t('auth.regQuoteAuthor')}</span>
              </div>
            </div>
          </div>

          {/* Right - Register Form */}
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
                <h2 className="auth-form-title">{t('auth.registerTitle')}</h2>
                <p className="auth-form-subtitle">{t('auth.registerSubtitle')}</p>
              </div>

              {success ? (
                <div className="auth-success-state">
                  <div className="auth-success-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3>{t('auth.accountCreated')}</h3>
                  <p>{t('auth.welcomeToast')} {t('auth.redirecting')}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="auth-form" noValidate>

                  <div className="auth-input-group">
                    <label htmlFor="fullName" className="auth-label">{t('auth.fullName')}</label>
                    <div className="auth-input-wrapper">
                      <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                      <input
                        ref={nameRef}
                        id="fullName"
                        name="fullName"
                        type="text"
                        value={form.fullName}
                        onChange={handleChange}
                        className={inputClass('fullName')}
                        placeholder={t('auth.fullNamePlaceholder')}
                        autoComplete="name"
                        aria-required="true"
                      />
                    </div>
                    {fieldErrors.fullName && <span className="auth-field-error">{fieldErrors.fullName}</span>}
                  </div>

                  <div className="auth-input-group">
                    <label htmlFor="username" className="auth-label">{t('auth.username')}</label>
                    <div className="auth-input-wrapper">
                      <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
                      </svg>
                      <input
                        id="username"
                        name="username"
                        type="text"
                        value={form.username}
                        onChange={handleChange}
                        className={inputClass('username')}
                        placeholder={t('auth.usernamePlaceholder')}
                        autoComplete="username"
                        aria-required="true"
                      />
                    </div>
                    {fieldErrors.username && <span className="auth-field-error">{fieldErrors.username}</span>}
                  </div>

                  <div className="auth-input-group">
                    <label htmlFor="regEmail" className="auth-label">{t('auth.email')}</label>
                    <div className="auth-input-wrapper">
                      <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22 6 12 13 2 6" />
                      </svg>
                      <input
                        id="regEmail"
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        className={inputClass('email')}
                        placeholder={t('auth.emailRegPlaceholder')}
                        autoComplete="email"
                        aria-required="true"
                      />
                    </div>
                    {fieldErrors.email && <span className="auth-field-error">{fieldErrors.email}</span>}
                  </div>

                  <div className="auth-input-group">
                    <label htmlFor="regPassword" className="auth-label">{t('auth.password')}</label>
                    <div className="auth-input-wrapper">
                      <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <input
                        id="regPassword"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={handleChange}
                        className={inputClass('password')}
                        placeholder={t('auth.passwordCreatePlaceholder')}
                        autoComplete="new-password"
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
                    <PasswordStrength password={form.password} />
                    {fieldErrors.password && <span className="auth-field-error">{fieldErrors.password}</span>}
                  </div>

                  <div className="auth-input-group">
                    <label htmlFor="confirmPassword" className="auth-label">{t('auth.confirmPassword')}</label>
                    <div className="auth-input-wrapper">
                      <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        value={form.confirmPassword}
                        onChange={handleChange}
                        className={inputClass('confirmPassword')}
                        placeholder={t('auth.confirmPasswordPlaceholder')}
                        autoComplete="new-password"
                        aria-required="true"
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={() => setShowConfirm(!showConfirm)}
                        aria-label={showConfirm ? t('auth.hideConfirmPassword') : t('auth.showConfirmPassword')}
                      >
                        {showConfirm ? (
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
                    {fieldErrors.confirmPassword && <span className="auth-field-error">{fieldErrors.confirmPassword}</span>}
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
                        {t('auth.register')}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                        </svg>
                      </>
                    )}
                  </button>

                  <p className="auth-switch">
                    {t('auth.alreadyHaveAccount')}{' '}
                    <Link to="/login">{t('auth.logInHere')}</Link>
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
