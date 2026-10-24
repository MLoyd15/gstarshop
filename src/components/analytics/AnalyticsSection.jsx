import { useEffect, useState } from 'react';
import '../../styles/AnalyticsSection.css';
import ExpensesDonutChart from './ExpensesDonutChart.jsx';
import IncomeExpensesBarChart from './IncomeExpensesBarChart.jsx';
import BookingFunnelChart from './BookingFunnelChart.jsx';
import GrossMarginChart from './GrossMarginChart.jsx';
import UnpaidBalancesChart from './UnpaidBalancesChart.jsx';
import ProductRevenuePlaceholder from './ProductRevenuePlaceholder.jsx';

export default function AnalyticsSection({ period, chartMonths = 6, onChartMonthsChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!period) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');

    fetch(`/api/analytics?period=${period}&months=${chartMonths}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Could not load analytics summary.');
        return res.json();
      })
      .then((json) => {
        setData(json);
        setError('');
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message || 'Error loading analytics.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [period, chartMonths, reloadKey]);

  return (
    <section className="analytics-section" aria-label="Terminal Analytics Overview">
      <button
        type="button"
        className="analytics-header-toggle"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
      >
        <div className="analytics-header-title-wrap">
          <span className="analytics-terminal-tag">Trends</span>
          <h2 className="analytics-header-title">Financial trends</h2>
          <span className="analytics-header-period">
            [{period} · {chartMonths}M window]
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="analytics-pill">{collapsed ? 'Show' : 'Hide'}</span>
          <span className={`analytics-chevron ${collapsed ? 'is-collapsed' : ''}`} aria-hidden="true">
            ▼
          </span>
        </div>
      </button>

      {!collapsed && (
        <div className="analytics-body">
          {error ? (
            <div className="analytics-state-box">
              <span className="analytics-prompt-symbol">!</span>
              <span>{error}</span>
              <button
                type="button"
                className="analytics-retry-btn"
                onClick={() => setReloadKey((n) => n + 1)}
              >
                Retry Request
              </button>
            </div>
          ) : (
            <div className="analytics-grid">
              <IncomeExpensesBarChart
                data={data?.monthlyComparison}
                loading={loading}
                error={Boolean(error)}
                chartMonths={chartMonths}
                onChartMonthsChange={onChartMonthsChange}
              />
              <ExpensesDonutChart
                data={data?.expensesByCategory}
                loading={loading}
                error={Boolean(error)}
              />
              <GrossMarginChart
                data={data?.grossMargin}
                loading={loading}
                error={Boolean(error)}
              />
              <BookingFunnelChart
                data={data?.funnel}
                loading={loading}
                error={Boolean(error)}
              />
              <UnpaidBalancesChart
                data={data?.unpaidBalances}
                loading={loading}
                error={Boolean(error)}
              />
              <ProductRevenuePlaceholder />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

