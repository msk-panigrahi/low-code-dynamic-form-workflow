import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, LabelList, CartesianGrid,
} from 'recharts';

// ─── Palette (works on both light & dark surfaces) ───────────────────
const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6',
  '#f43f5e', '#14b8a6', '#f97316', '#22c55e', '#eab308',
  '#3b82f6', '#ec4899', '#84cc16', '#06b6d4', '#a855f7',
];

const typeColor = (type) =>
  ({ dropdown: '#6366f1', radio: '#8b5cf6', checkbox: '#0ea5e9', rating: '#f59e0b' }[type] || '#6366f1');

// ─── Shared bits ─────────────────────────────────────────────────────
const AXIS_TICK = { fill: 'var(--color-text-tertiary)', fontSize: 11 };

const TruncatedTick = ({ x, y, payload, maxWidth = 150, anchor = 'end' }) => {
  const text = payload?.value != null ? String(payload.value) : '';
  const display = text.length > 16 ? `${text.slice(0, 15)}…` : text;
  return (
    <text x={x} y={y} dy={4} textAnchor={anchor} fill="var(--color-text-tertiary)" fontSize={11}>
      <title>{text}</title>
      {display}
    </text>
  );
};

// Custom tooltip — theme aware, shows count + percentage
const ChartTooltip = ({ active, payload, label }) => {
  const { t } = useTranslation();
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload || {};
  const count = payload[0]?.value ?? row.count ?? 0;
  const pct = row.percentage;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-xl border"
      style={{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border)' }}
    >
      <p className="font-semibold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        {t('analytics.distributions.countPct', { count, percentage: pct != null ? pct : 0 })}
      </p>
    </div>
  );
};

const legendFormatter = (value, entry) => {
  const pct = entry?.payload?.percentage;
  return (
    <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
      {value}
      {pct != null ? ` · ${pct}%` : ''}
    </span>
  );
};

// ─── Pie chart (dropdown / radio) ────────────────────────────────────
export const PieDistributionChart = ({ data }) => {
  const { t } = useTranslation();
  return (
  <ResponsiveContainer width="100%" height={260}>
    <PieChart role="img" aria-label={t('analytics.distributions.pieChartAria')}>
      <Pie
        data={data}
        dataKey="count"
        nameKey="value"
        innerRadius={48}
        outerRadius={82}
        paddingAngle={2}
        stroke="var(--color-card-bg)"
        strokeWidth={2}
      >
        {data.map((entry, i) => (
          <Cell key={`cell-${i}`} fill={PALETTE[i % PALETTE.length]} />
        ))}
        <LabelList
          dataKey="count"
          position="outside"
          style={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }}
        />
      </Pie>
      <Tooltip content={<ChartTooltip />} />
      <Legend formatter={legendFormatter} iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
    </PieChart>
  </ResponsiveContainer>
  );
};

// ─── Vertical bar chart (rating / dropdown / radio) ──────────────────
export const BarDistributionChart = ({ data, color = '#6366f1' }) => (
  <ResponsiveContainer width="100%" height={260}>
    <BarChart data={data} margin={{ top: 22, right: 12, left: -18, bottom: 4 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
      <XAxis dataKey="value" tick={AXIS_TICK} interval={0} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
      <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
      <Tooltip content={<ChartTooltip />} />
      <Legend formatter={legendFormatter} iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
      <Bar dataKey="count" fill={color} radius={[6, 6, 0, 0]} maxBarSize={56}>
        {data.map((entry, i) => (
          <Cell key={`cell-${i}`} fill={PALETTE[i % PALETTE.length]} />
        ))}
        <LabelList dataKey="count" position="top" style={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }} />
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

// ─── Horizontal bar chart (checkbox — long labels) ───────────────────
export const HorizontalBarChart = ({ data }) => {
  const maxLabel = useMemo(
    () => Math.min(170, Math.max(60, ...data.map((d) => String(d.value).length * 7))),
    [data],
  );
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 42, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="value"
          width={maxLabel}
          tick={<TruncatedTick />}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend formatter={legendFormatter} iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={26}>
          {data.map((entry, i) => (
            <Cell key={`cell-${i}`} fill={PALETTE[i % PALETTE.length]} />
          ))}
          <LabelList dataKey="count" position="right" style={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ─── Submissions-over-time trend chart ───────────────────────────────
const isoWeekKey = (dateStr) => {
  // ISO 8601 week key, e.g. "2026-W30"
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const weekStartDate = (dateStr) => {
  // Monday of the ISO week containing dateStr (UTC, DST-safe)
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
};

const TrendTooltip = ({ active, payload, label }) => {
  const { t } = useTranslation();
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-xl border"
      style={{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border)' }}
    >
      <p className="font-semibold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        {t('analytics.trend.countOn', { count: payload[0].value, date: label })}
      </p>
    </div>
  );
};

export const TrendChart = ({ data }) => {
  const { t, i18n } = useTranslation();
  const [bucket, setBucket] = useState('day'); // 'day' | 'week'

  const chartData = useMemo(() => {
    const fmt = (d) =>
      new Date(`${d}T00:00:00Z`).toLocaleDateString(i18n.language || 'en-US', {
        month: 'short', day: 'numeric',
      });
    if (bucket === 'day') {
      return data.map((p) => ({ date: p.date, label: fmt(p.date), count: p.count }));
    }
    // Aggregate daily buckets into ISO weeks, labelled by the week's Monday
    const weeks = new Map();
    for (const p of data) {
      const key = isoWeekKey(p.date);
      if (!weeks.has(key)) {
        weeks.set(key, { label: fmt(weekStartDate(p.date).toISOString().slice(0, 10)), count: 0 });
      }
      weeks.get(key).count += p.count;
    }
    return [...weeks.values()];
  }, [data, bucket, i18n.language]);

  // Only draw per-bar count labels when they won't overlap.
  const showLabels = chartData.length <= 31;
  // Cap the visible X-axis labels at ~10 to avoid crowding on long ranges.
  const tickInterval = Math.max(1, Math.ceil(chartData.length / 10));

  return (
    <div>
      {/* Day / Week toggle */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
          {t('analytics.trend.total', { count: data.reduce((s, p) => s + p.count, 0) })}
        </span>
        <div
          role="radiogroup"
          aria-label={t('analytics.trend.bucketLabel')}
          className="relative flex rounded-lg p-0.5 border"
          style={{ backgroundColor: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}
        >
          {['day', 'week'].map((mode) => (
            <button
              key={mode}
              role="radio"
              aria-checked={bucket === mode}
              onClick={() => setBucket(mode)}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors duration-150"
              style={{
                color: bucket === mode ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                backgroundColor: bucket === mode ? 'var(--color-bg-primary)' : 'transparent',
              }}
            >
              {t(`analytics.trend.${mode}`)}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 22, right: 12, left: -18, bottom: 4 }} role="img" aria-label={t('analytics.trend.title')}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            interval={tickInterval}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border)' }}
          />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<TrendTooltip />} />
          <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={bucket === 'week' ? 44 : 26}>
            {showLabels && (
              <LabelList dataKey="count" position="top" style={{ fill: 'var(--color-text-tertiary)', fontSize: 10 }} />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Trend section card (used by the analytics page) ─────────────────
export const TrendSection = ({ data }) => {
  const { t } = useTranslation();
  if (!data || data.length === 0) {
    return null; // analytics page gates on submissions; nothing to trend otherwise
  }
  return (
    <div className="card-surface overflow-hidden" role="group" aria-label={t('analytics.trend.title')}>
      <div className="px-5 pt-4 pb-1">
        <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {t('analytics.trend.title')}
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
          {t('analytics.trend.subtitle')}
        </p>
      </div>
      <div className="px-4 py-3" aria-live="polite">
        <TrendChart data={data} />
      </div>
    </div>
  );
};

// ─── Empty distribution state ────────────────────────────────────────
const DistributionEmpty = () => {
  const { t } = useTranslation();
  return (
    <div className="text-center py-10">
      <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
          style={{ color: 'var(--color-text-tertiary)' }}>
          <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {t('analytics.distributions.noResponses')}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
        {t('analytics.distributions.noResponsesDesc')}
      </p>
    </div>
  );
};

// ─── Field distribution card ─────────────────────────────────────────
export const FieldDistributionCard = ({ data }) => {
  const { t } = useTranslation();
  const [chartType, setChartType] = useState('pie'); // 'pie' | 'bar' (dropdown/radio only)

  const hasData = (data.distribution || []).length > 0 && (data.total_responses || 0) > 0;
  const canToggle = data.type === 'dropdown' || data.type === 'radio';

  return (
    <div
      className="card-surface overflow-hidden"
      role="group"
      aria-label={`${data.label} — ${data.type}`}
    >
      {/* Card header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold leading-snug" style={{ color: 'var(--color-text-primary)' }}>
            {data.label}
          </h4>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: `${typeColor(data.type)}1a`, color: typeColor(data.type) }}
            >
              {t(`analytics.distributions.type.${data.type}`)}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              {t('analytics.distributions.totalResponses', { count: data.total_responses || 0 })}
            </span>
            {data.type === 'rating' && data.average != null && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
              >
                <svg className="w-3 h-3 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {t('analytics.distributions.averageRating', { value: data.average })}
              </span>
            )}
          </div>
        </div>

        {/* Chart type toggle (dropdown/radio) */}
        {canToggle && hasData && (
          <div
            role="radiogroup"
            aria-label={t('analytics.distributions.chartToggleLabel')}
            className="relative flex rounded-lg p-0.5 border flex-shrink-0"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}
          >
            {['pie', 'bar'].map((mode) => (
              <button
                key={mode}
                role="radio"
                aria-checked={chartType === mode}
                onClick={() => setChartType(mode)}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors duration-150"
                style={{
                  color: chartType === mode ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  backgroundColor: chartType === mode ? 'var(--color-bg-primary)' : 'transparent',
                }}
              >
                {t(`analytics.distributions.${mode}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart body */}
      <div className="px-4 py-3" aria-live="polite">
        {!hasData ? (
          <DistributionEmpty />
        ) : data.type === 'checkbox' ? (
          <HorizontalBarChart data={data.distribution} />
        ) : data.type === 'rating' ? (
          <BarDistributionChart data={data.distribution} color="#f59e0b" />
        ) : chartType === 'bar' ? (
          <BarDistributionChart data={data.distribution} color="#6366f1" />
        ) : (
          <PieDistributionChart data={data.distribution} />
        )}
      </div>
    </div>
  );
};

// ─── Section wrapper (used by the analytics page) ────────────────────
export const DistributionSection = ({ distributions }) => {
  const { t } = useTranslation();
  if (!distributions || distributions.length === 0) {
    return (
      <div className="card-surface p-8 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            style={{ color: 'var(--color-text-tertiary)' }}>
            <circle cx="12" cy="12" r="10" /><path d="M8 12h8" />
          </svg>
        </div>
        <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          {t('analytics.distributions.noData')}
        </h3>
        <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--color-text-tertiary)' }}>
          {t('analytics.distributions.noDataDesc')}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {t('analytics.distributions.title')}
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
          {t('analytics.distributions.subtitle')}
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {distributions.map((fd) => (
          <FieldDistributionCard key={fd.field_id} data={fd} />
        ))}
      </div>
    </div>
  );
};

// ─── Skeleton (loading) ──────────────────────────────────────────────
export const DistributionCardSkeleton = () => (
  <div className="card-surface p-5">
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="space-y-2 flex-1">
        <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3" />
        <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3" />
      </div>
      <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
    </div>
    <div className="h-52 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
  </div>
);
