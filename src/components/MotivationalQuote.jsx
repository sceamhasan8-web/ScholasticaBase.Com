import React from 'react';

/**
 * MotivationalQuote Component for Login Panel
 * Clean light style with quotation mark icons and soft blue border.
 */
export function MotivationalQuote() {
  return (
    <div className="login-quote-box">
      <span className="quote-icon quote-open">“</span>
      <p className="quote-text">
        অগাধ ধন সম্পদের চেয়ে একজন সুশিক্ষিত সন্তানের মুল্য অনেক বেশি
      </p>
      <span className="quote-icon quote-close">”</span>
    </div>
  );
}

/**
 * DashboardQuoteCard Component for Home / Dashboards
 * Dark blue gradient hero banner matching dashboard theme with educational badge.
 */
export function DashboardQuoteCard() {
  return (
    <div className="dashboard-quote-card">
      <div className="dashboard-quote-badge">
        <span className="dashboard-quote-icon">🎓</span>
        <span className="dashboard-quote-label">আজকের বাণী</span>
      </div>
      <p className="dashboard-quote-text">
        “অগাধ ধন সম্পদের চেয়ে একজন সুশিক্ষিত সন্তানের মুল্য অনেক বেশি”
      </p>
    </div>
  );
}

export default MotivationalQuote;
