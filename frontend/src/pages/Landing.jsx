import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useAnimation, useInView } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { LandingLayout } from '../layouts/LandingLayout';

// ─── Animation Variants ───────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};

// ─── Section Wrapper ──────────────────────────────────────
const Section = ({ id, children, className = '', bg = '' }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section
      id={id}
      ref={ref}
      className={`landing-section ${bg} ${className}`}
    >
      <motion.div
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        variants={staggerContainer}
        className="landing-section-inner"
      >
        {children}
      </motion.div>
    </section>
  );
};

// ─── Floating Shapes Component ────────────────────────────
const FloatingShapes = () => {
  const shapes = [
    { size: 60, x: '10%', y: '15%', duration: 8, color: 'rgba(99,102,241,0.08)' },
    { size: 100, x: '85%', y: '20%', duration: 12, color: 'rgba(139,92,246,0.06)' },
    { size: 40, x: '70%', y: '70%', duration: 6, color: 'rgba(6,182,212,0.08)' },
    { size: 80, x: '20%', y: '75%', duration: 10, color: 'rgba(168,85,247,0.05)' },
    { size: 50, x: '50%', y: '10%', duration: 9, color: 'rgba(99,102,241,0.06)' },
  ];

  return shapes.map((s, i) => (
    <motion.div
      key={i}
      className="floating-shape"
      style={{
        width: s.size,
        height: s.size,
        left: s.x,
        top: s.y,
        background: s.color,
        borderRadius: i % 2 === 0 ? '50%' : '30%',
      }}
      animate={{
        y: [0, -30, 0, 20, 0],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration: s.duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  ));
};

// ─── Animated Counter ──────────────────────────────────────
const Counter = ({ from = 0, to, suffix = '', prefix = '', decimals = 0 }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(from);

  useEffect(() => {
    if (!isInView) return;
    let start = from;
    const end = to;
    const duration = 2000;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, from, to]);

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
};

// ─── Testimonial Data ─────────────────────────────────────
const getTestimonials = (t) => [
  {
    name: 'Sarah Chen',
    role: 'Product Manager, TechFlow',
    avatar: 'SC',
    gradient: 'from-indigo-500 to-purple-600',
    content: t('landing.testimonials.0.content'),
  },
  {
    name: 'Marcus Johnson',
    role: 'Software Engineer, BuildRight',
    avatar: 'MJ',
    gradient: 'from-emerald-500 to-teal-600',
    content: t('landing.testimonials.1.content'),
  },
  {
    name: 'Priya Patel',
    role: 'UX Designer, DesignLab',
    avatar: 'PP',
    gradient: 'from-rose-500 to-pink-600',
    content: t('landing.testimonials.2.content'),
  },
  {
    name: 'Alex Rodriguez',
    role: 'CTO, DataSync Inc.',
    avatar: 'AR',
    gradient: 'from-cyan-500 to-blue-600',
    content: t('landing.testimonials.3.content'),
  },
];

const getFaqData = (t) => [
  { q: t('landing.faqs.0.q'), a: t('landing.faqs.0.a') },
  { q: t('landing.faqs.1.q'), a: t('landing.faqs.1.a') },
  { q: t('landing.faqs.2.q'), a: t('landing.faqs.2.a') },
  { q: t('landing.faqs.3.q'), a: t('landing.faqs.3.a') },
  { q: t('landing.faqs.4.q'), a: t('landing.faqs.4.a') },
  { q: t('landing.faqs.5.q'), a: t('landing.faqs.5.a') },
];

// ─── Feature Data ─────────────────────────────────────────
const getFeatures = (t) => [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    title: t('landing.features.builder.title'),
    description: t('landing.features.builder.desc'),
    gradient: 'from-indigo-500 to-purple-600',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    title: t('landing.features.logic.title'),
    description: t('landing.features.logic.desc'),
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: t('landing.features.versioning.title'),
    description: t('landing.features.versioning.desc'),
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    title: t('landing.features.validation.title'),
    description: t('landing.features.validation.desc'),
    gradient: 'from-rose-500 to-pink-600',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7V4h16v3" />
        <path d="M9 20h6" />
        <path d="M12 4v16" />
      </svg>
    ),
    title: t('landing.features.fieldTypes.title'),
    description: t('landing.features.fieldTypes.desc'),
    gradient: 'from-cyan-500 to-blue-600',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
    title: t('landing.features.upload.title'),
    description: t('landing.features.upload.desc'),
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: t('landing.features.downloads.title'),
    description: t('landing.features.downloads.desc'),
    gradient: 'from-red-500 to-rose-600',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22 6 12 13 2 6" />
      </svg>
    ),
    title: t('landing.features.links.title'),
    description: t('landing.features.links.desc'),
    gradient: 'from-sky-500 to-indigo-600',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <line x1="9" y1="10" x2="15" y2="10" />
        <line x1="12" y1="7" x2="12" y2="13" />
      </svg>
    ),
    title: t('landing.features.responses.title'),
    description: t('landing.features.responses.desc'),
    gradient: 'from-teal-500 to-emerald-600',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    title: t('landing.features.dashboard.title'),
    description: t('landing.features.dashboard.desc'),
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    title: t('landing.features.performance.title'),
    description: t('landing.features.performance.desc'),
    gradient: 'from-yellow-500 to-amber-600',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    title: t('landing.features.responsive.title'),
    description: t('landing.features.responsive.desc'),
    gradient: 'from-purple-500 to-violet-600',
  },
];

// ─── Workflow Steps ───────────────────────────────────────
const getWorkflowSteps = (t) => [
  { label: t('landing.workflowSteps.0.label'), icon: '📝', desc: t('landing.workflowSteps.0.desc') },
  { label: t('landing.workflowSteps.1.label'), icon: '🧩', desc: t('landing.workflowSteps.1.desc') },
  { label: t('landing.workflowSteps.2.label'), icon: '⚡', desc: t('landing.workflowSteps.2.desc') },
  { label: t('landing.workflowSteps.3.label'), icon: '🚀', desc: t('landing.workflowSteps.3.desc') },
  { label: t('landing.workflowSteps.4.label'), icon: '🔗', desc: t('landing.workflowSteps.4.desc') },
  { label: t('landing.workflowSteps.5.label'), icon: '📊', desc: t('landing.workflowSteps.5.desc') },
  { label: t('landing.workflowSteps.6.label'), icon: '📥', desc: t('landing.workflowSteps.6.desc') },
];

// ─── Trusted Brands ─────────────────────────────────────
const getBrands = (t) => [
  t('landing.trustedBrands.0'), t('landing.trustedBrands.1'), t('landing.trustedBrands.2'),
  t('landing.trustedBrands.3'), t('landing.trustedBrands.4'), t('landing.trustedBrands.5'),
];

// ─── Stat Data ───────────────────────────────────────────
const getStats = (t) => [
  { label: t('landing.stats.0.label'), value: 12500, suffix: '+', icon: '📋' },
  { label: t('landing.stats.1.label'), value: 850000, suffix: '+', icon: '📈' },
  { label: t('landing.stats.2.label'), value: 42000, suffix: '+', icon: '⚡' },
  { label: t('landing.stats.3.label'), value: 15000, suffix: '+', icon: '📁' },
];

// ─── Highlight Cards ────────────────────────────────────
const getHighlights = (t) => [
  { icon: '✅', title: t('landing.highlights.0.title'), desc: t('landing.highlights.0.desc') },
  { icon: '🎨', title: t('landing.highlights.1.title'), desc: t('landing.highlights.1.desc') },
  { icon: '📈', title: t('landing.highlights.2.title'), desc: t('landing.highlights.2.desc') },
  { icon: '⚡', title: t('landing.highlights.3.title'), desc: t('landing.highlights.3.desc') },
  { icon: '🔒', title: t('landing.highlights.4.title'), desc: t('landing.highlights.4.desc') },
  { icon: '🔄', title: t('landing.highlights.5.title'), desc: t('landing.highlights.5.desc') },
  { icon: '✨', title: t('landing.highlights.6.title'), desc: t('landing.highlights.6.desc') },
  { icon: '📱', title: t('landing.highlights.7.title'), desc: t('landing.highlights.7.desc') },
];

// ─── Screenshot Data ────────────────────────────────────
const getScreenshots = (t) => [
  { label: t('landing.screenshots.0.label'), desc: t('landing.screenshots.0.desc'), emoji: '📊', gradient: 'from-indigo-500 to-purple-600' },
  { label: t('landing.screenshots.1.label'), desc: t('landing.screenshots.1.desc'), emoji: '🏗️', gradient: 'from-emerald-500 to-teal-600' },
  { label: t('landing.screenshots.2.label'), desc: t('landing.screenshots.2.desc'), emoji: '📝', gradient: 'from-cyan-500 to-blue-600' },
  { label: t('landing.screenshots.3.label'), desc: t('landing.screenshots.3.desc'), emoji: '👁️', gradient: 'from-rose-500 to-pink-600' },
];

// ─── Mouse Glow Effect ──────────────────────────────────
const MouseGlow = () => {
  const containerRef = useRef(null);
  const glowRef = useRef(null);
  const rafRef = useRef(null);

  const handleMouse = useCallback((e) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (containerRef.current && glowRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        glowRef.current.style.transform = `translate(${e.clientX - rect.left - 150}px, ${e.clientY - rect.top - 150}px)`;
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} onMouseMove={handleMouse} className="hero-glow-container">
      <div ref={glowRef} className="hero-glow" />
    </div>
  );
};

// ─── Hero Section ────────────────────────────────────────
const HeroSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <section id="hero" ref={ref} className="hero-section">
      <MouseGlow />
      <FloatingShapes />
      <div className="hero-grid-bg" />

      <div className="hero-content">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="hero-badge"
        >
          <span className="hero-badge-dot" />
          {t('landing.heroBadge')}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="hero-title"
        >
          {t('landing.heroTitle1')}{' '}
          <span className="hero-title-gradient">{t('landing.heroTitle2')}</span>
          <br />
          {t('landing.heroTitle3')}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="hero-subtitle"
        >
          {t('landing.heroSubtitle')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="hero-actions"
        >
          {isAuthenticated ? (
            <Link to="/dashboard" className="hero-btn hero-btn-primary">
              {t('landing.goToDashboard')}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          ) : (
            <>
              <Link to="/register" className="hero-btn hero-btn-primary">
                {t('landing.startBuilding')}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <button
                onClick={() => {
                  const el = document.querySelector('#features');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="hero-btn hero-btn-secondary"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {t('landing.watchDemo')}
              </button>
            </>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="hero-mockup"
        >
          <div className="hero-mockup-bar">
            <span className="hero-mockup-dot bg-red-400" />
            <span className="hero-mockup-dot bg-yellow-400" />
            <span className="hero-mockup-dot bg-green-400" />
            <span className="hero-mockup-url">app.formflow.dev</span>
          </div>
          <div className="hero-mockup-content">
            <div className="hero-mockup-sidebar">
              {[t('nav.dashboard'), t('nav.formBuilder'), t('nav.responses'), t('nav.settings')].map((item) => (
                <div key={item} className={`hero-mockup-menu-item ${item === t('nav.formBuilder') ? 'active' : ''}`}>
                  {item}
                </div>
              ))}
            </div>
            <div className="hero-mockup-main">
              <div className="hero-mockup-header">
                <div className="hero-mockup-header-title">{t('dashboard.allForms')}</div>
                <div className="hero-mockup-header-action">+ {t('dashboard.newForm')}</div>
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="hero-mockup-row">
                  <div className="hero-mockup-row-icon" />
                  <div>
                    <div className="hero-mockup-row-title" />
                    <div className="hero-mockup-row-subtitle" />
                  </div>
                  <div className="hero-mockup-row-badge" />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ─── Featured In Section ──────────────────────────────────
const FeaturedSection = () => {
  const { t } = useTranslation();
  const brands = getBrands(t);
  return (
    <Section id="trusted" className="featured-section">
      <motion.p variants={fadeUp} className="featured-label">
        {t('landing.trustedBy')}
      </motion.p>
      <motion.div variants={fadeUp} className="featured-brands">
        {brands.map((brand, i) => (
          <motion.div
            key={brand}
            className="featured-brand"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <span className="featured-brand-icon">
              {['🚀', '📚', '🏢', '🏥', '🛍️', '💰'][i]}
            </span>
            {brand}
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
};

// ─── Features Grid ────────────────────────────────────────
const FeaturesSection = () => {
  const { t } = useTranslation();
  const features = getFeatures(t);
  return (
    <Section id="features" className="features-section" bg="landing-bg-alt">
      <motion.div variants={fadeUp} className="section-header">
        <span className="section-badge">{t('landing.featuresBadge')}</span>
        <h2 className="section-title">
          {t('landing.featuresTitle1')}{' '}
          <span className="section-title-gradient">{t('landing.featuresTitle2')}</span>
        </h2>
        <p className="section-desc">
          {t('landing.featuresDesc')}
        </p>
      </motion.div>

      <div className="features-grid">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            variants={fadeUp}
            custom={i}
            className="feature-card"
            whileHover={{ y: -6, transition: { type: 'spring', stiffness: 300 } }}
          >
            <div className={`feature-card-icon ${f.gradient}`}>
              {f.icon}
            </div>
            <h3 className="feature-card-title">{f.title}</h3>
            <p className="feature-card-desc">{f.description}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
};

// ─── Interactive Workflow ─────────────────────────────────
const WorkflowSection = () => {
  const { t } = useTranslation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  const workflowSteps = getWorkflowSteps(t);

  return (
    <Section id="workflow" className="workflow-section">
      <motion.div variants={fadeUp} className="section-header">
        <span className="section-badge">{t('landing.workflowBadge')}</span>
        <h2 className="section-title">
          {t('landing.workflowTitle1')}{' '}
          <span className="section-title-gradient">{t('landing.workflowTitle2')}</span>
        </h2>
        <p className="section-desc">
          {t('landing.workflowDesc')}
        </p>
      </motion.div>

      <div ref={ref} className="workflow-flow">
        {workflowSteps.map((step, i) => (
          <React.Fragment key={step.label}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="workflow-step"
              whileHover={{ scale: 1.03 }}
            >
              <div className="workflow-step-number">{i + 1}</div>
              <div className="workflow-step-icon">{step.icon}</div>
              <div className="workflow-step-label">{step.label}</div>
              <div className="workflow-step-desc">{step.desc}</div>
            </motion.div>
            {i < workflowSteps.length - 1 && (
              <motion.div
                initial={{ opacity: 0, scaleY: 0 }}
                animate={isInView ? { opacity: 1, scaleY: 1 } : {}}
                transition={{ duration: 0.4, delay: i * 0.12 + 0.2 }}
                className="workflow-connector"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
              </motion.div>
            )}
          </React.Fragment>
        ))}
      </div>
    </Section>
  );
};

// ─── Platform Highlights ──────────────────────────────────
const HighlightsSection = () => {
  const { t } = useTranslation();
  const highlights = getHighlights(t);
  return (
    <Section id="about" className="highlights-section" bg="landing-bg-alt">
      <motion.div variants={fadeUp} className="section-header">
        <span className="section-badge">{t('landing.whyBadge')}</span>
        <h2 className="section-title">
          {t('landing.whyTitle1')}{' '}
          <span className="section-title-gradient">{t('landing.whyTitle2')}</span>
        </h2>
        <p className="section-desc">
          {t('landing.whyDesc')}
        </p>
      </motion.div>

      <div className="highlights-grid">
        {highlights.map((h, i) => (
          <motion.div
            key={h.title}
            variants={fadeUp}
            custom={i}
            className="highlight-card"
            whileHover={{ y: -4, transition: { type: 'spring', stiffness: 300 } }}
          >
            <span className="highlight-icon">{h.icon}</span>
            <h3 className="highlight-title">{h.title}</h3>
            <p className="highlight-desc">{h.desc}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
};

// ─── Statistics Section ───────────────────────────────────
const StatsSection = () => {
  const { t } = useTranslation();
  const stats = getStats(t);
  return (
    <Section id="stats" className="stats-section">
      <motion.div variants={fadeUp} className="section-header">
        <span className="section-badge">{t('landing.impactBadge')}</span>
        <h2 className="section-title">
          {t('landing.impactTitle1')}{' '}
          <span className="section-title-gradient">{t('landing.impactTitle2')}</span>
        </h2>
      </motion.div>

      <motion.div variants={fadeUp} className="stats-grid">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            className="stat-card"
            variants={scaleIn}
            whileHover={{ scale: 1.02 }}
          >
            <span className="stat-icon">{s.icon}</span>
            <div className="stat-value">
              <Counter to={s.value} suffix={s.suffix} />
            </div>
            <div className="stat-label">{s.label}</div>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
};

// ─── Screenshots Section ──────────────────────────────────
const ScreenshotsSection = () => {
  const { t } = useTranslation();
  const screenshots = getScreenshots(t);
  return (
    <Section id="screenshots" className="screenshots-section" bg="landing-bg-alt">
      <motion.div variants={fadeUp} className="section-header">
        <span className="section-badge">{t('landing.previewBadge')}</span>
        <h2 className="section-title">
          {t('landing.previewTitle1')}{' '}
          <span className="section-title-gradient">{t('landing.previewTitle2')}</span>
        </h2>
        <p className="section-desc">
          {t('landing.previewDesc')}
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="screenshots-grid">
        {screenshots.map((s, i) => (
          <motion.div
            key={s.label}
            className="screenshot-card"
            whileHover={{ y: -8, transition: { type: 'spring', stiffness: 300 } }}
          >
            <div className={`screenshot-visual ${s.gradient}`}>
              <span className="screenshot-emoji">{s.emoji}</span>
            </div>
            <div className="screenshot-info">
              <h3>{s.label}</h3>
              <p>{s.desc}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
};

// ─── Testimonials Section ─────────────────────────────────
const TestimonialsSection = () => {
  const { t } = useTranslation();
  const testimonials = getTestimonials(t);
  return (
    <Section id="testimonials" className="testimonials-section">
      <motion.div variants={fadeUp} className="section-header">
        <span className="section-badge">{t('landing.testimonialsBadge')}</span>
        <h2 className="section-title">
          {t('landing.testimonialsTitle1')}{' '}
          <span className="section-title-gradient">{t('landing.testimonialsTitle2')}</span>
        </h2>
        <p className="section-desc">
          {t('landing.testimonialsDesc')}
        </p>
      </motion.div>

      <div className="testimonials-grid">
        {testimonials.map((tm, i) => (
          <motion.div
            key={tm.name}
            variants={fadeUp}
            custom={i}
            className="testimonial-card"
            whileHover={{ y: -6, transition: { type: 'spring', stiffness: 300 } }}
          >
            <div className="testimonial-content">{tm.content}</div>
            <div className="testimonial-author">
              <div className={`testimonial-avatar ${tm.gradient}`}>
                {tm.avatar}
              </div>
              <div>
                <div className="testimonial-name">{tm.name}</div>
                <div className="testimonial-role">{tm.role}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
};

// ─── FAQ Section ─────────────────────────────────────────
const FAQSection = () => {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState(null);
  const faqData = getFaqData(t);

  return (
    <Section id="faq" className="faq-section" bg="landing-bg-alt">
      <motion.div variants={fadeUp} className="section-header">
        <span className="section-badge">{t('landing.faqBadge')}</span>
        <h2 className="section-title">
          {t('landing.faqTitle1')}{' '}
          <span className="section-title-gradient">{t('landing.faqTitle2')}</span>
        </h2>
        <p className="section-desc">
          {t('landing.faqDesc')}
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="faq-list">
        {faqData.map((faq, i) => (
          <div key={i} className={`faq-item ${openIndex === i ? 'open' : ''}`}>
            <button
              className="faq-question"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              aria-expanded={openIndex === i}
            >
              <span>{faq.q}</span>
              <svg
                className="faq-chevron"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div
              className="faq-answer"
              style={{
                maxHeight: openIndex === i ? '200px' : '0px',
                opacity: openIndex === i ? 1 : 0,
              }}
            >
              <p>{faq.a}</p>
            </div>
          </div>
        ))}
      </motion.div>
    </Section>
  );
};

// ─── CTA Section ─────────────────────────────────────────
const CTASection = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <section ref={ref} className="cta-section">
      <div className="cta-bg" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="cta-content"
      >
        <h2 className="cta-title">{t('landing.ctaTitle')}</h2>
        <p className="cta-desc">
          {t('landing.ctaDesc')}
        </p>
        <div className="cta-actions">
          {isAuthenticated ? (
            <button onClick={() => navigate('/dashboard')} className="cta-btn cta-btn-primary">
              {t('landing.goToDashboard')}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          ) : (
            <>
              <Link to="/register" className="cta-btn cta-btn-primary">
                {t('landing.createFreeAccount')}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <Link to="/login" className="cta-btn cta-btn-secondary">
                {t('nav.login')}
              </Link>
            </>
          )}
        </div>
      </motion.div>
    </section>
  );
};

// ─── Main Landing Page ────────────────────────────────────
export const Landing = () => {
  // Smooth scroll for anchor links
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash) {
        setTimeout(() => {
          const el = document.querySelector(hash);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    };
    handleHash();
  }, []);

  return (
    <LandingLayout>
      <HeroSection />
      <FeaturedSection />
      <FeaturesSection />
      <WorkflowSection />
      <HighlightsSection />
      <StatsSection />
      <ScreenshotsSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
    </LandingLayout>
  );
};
