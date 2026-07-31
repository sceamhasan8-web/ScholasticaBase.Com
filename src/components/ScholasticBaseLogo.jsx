import React from 'react';

/**
 * ScholasticBaseLogo - Vector SVG Logo Component
 * Features silver crown, deep emerald open book with stylized 'S', and optional brand text.
 * 
 * @param {Object} props
 * @param {string} [props.variant='full'] - 'full', 'mark', 'horizontal', 'light'
 * @param {number} [props.size=48] - Height/width scale factor
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {boolean} [props.showTagline=false] - Whether to display tagline
 */
export default function ScholasticBaseLogo({
  variant = 'full',
  size = 48,
  className = '',
  showTagline = false
}) {
  const isMarkOnly = variant === 'mark';
  const isHorizontal = variant === 'horizontal';
  const isLight = variant === 'light';

  const primaryGreen = isLight ? '#10B981' : '#064E3B';
  const darkGreen = isLight ? '#34D399' : '#04392B';
  const textPrimary = isLight ? '#FFFFFF' : '#064E3B';
  const textMuted = isLight ? '#94A3B8' : '#475569';

  return (
    <div
      className={`scholasticbase-logo-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexDirection: isHorizontal ? 'row' : (isMarkOnly ? 'row' : 'column'),
        gap: isHorizontal ? '12px' : '6px',
        userSelect: 'none'
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Silver Metallic Gradient for Crown */}
          <linearGradient id="silverCrownGrad" x1="50" y1="20" x2="150" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="25%" stopColor="#CBD5E1" />
            <stop offset="50%" stopColor="#94A3B8" />
            <stop offset="75%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>

          {/* Silver Glow / Shadow */}
          <filter id="silverGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.15" />
          </filter>

          {/* Deep Emerald Green Book Gradient */}
          <linearGradient id="emeraldBookGrad" x1="20" y1="70" x2="180" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0B4F3D" />
            <stop offset="50%" stopColor={primaryGreen} />
            <stop offset="100%" stopColor={darkGreen} />
          </linearGradient>

          {/* Book Inner Page Shadow */}
          <linearGradient id="pageShadowGrad" x1="100" y1="70" x2="100" y2="170" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#022C22" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#022C22" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 👑 CROWN - Silver Chrome Metallic Finish */}
        <g filter="url(#silverGlow)">
          {/* Crown Base Ring */}
          <path
            d="M60 55 C60 52, 140 52, 140 55 C140 58, 60 58, 60 55 Z"
            fill="url(#silverCrownGrad)"
          />
          {/* Crown Main Body (5 Spikes with Jewels) */}
          <path
            d="M62 53 
               L42 26 L68 38 
               L100 16 
               L132 38 L158 26 
               L138 53 Z"
            fill="url(#silverCrownGrad)"
            stroke="#94A3B8"
            strokeWidth="1"
          />
          {/* Crown Pearls / Diamonds */}
          <circle cx="42" cy="24" r="3.5" fill="#FFFFFF" stroke="#64748B" strokeWidth="1" />
          <circle cx="68" cy="36" r="2.5" fill="#FFFFFF" stroke="#64748B" strokeWidth="1" />
          <circle cx="100" cy="14" r="4.5" fill="#FFFFFF" stroke="#64748B" strokeWidth="1" />
          <circle cx="132" cy="36" r="2.5" fill="#FFFFFF" stroke="#64748B" strokeWidth="1" />
          <circle cx="158" cy="24" r="3.5" fill="#FFFFFF" stroke="#64748B" strokeWidth="1" />
          <circle cx="100" cy="42" r="3" fill="#064E3B" />
        </g>

        {/* 📖 OPEN BOOK - Layered Deep Emerald Pages */}
        <g>
          {/* Outer Layer Book Outline Left & Right */}
          <path
            d="M100 75 
               C70 65, 35 72, 22 78 
               V148 
               C35 142, 70 135, 100 145 
               C130 135, 165 142, 178 148 
               V78 
               C165 72, 130 65, 100 75 Z"
            fill="url(#emeraldBookGrad)"
            stroke="#022C22"
            strokeWidth="2.5"
          />

          {/* Inner Pages Left */}
          <path
            d="M96 82 
               C70 73, 40 79, 30 84 
               V142 
               C40 137, 70 131, 96 139 Z"
            fill="#0F4C3A"
            stroke="#34D399"
            strokeWidth="1.2"
            strokeOpacity="0.6"
          />

          {/* Inner Pages Right */}
          <path
            d="M104 82 
               C130 73, 160 79, 170 84 
               V142 
               C160 137, 130 131, 104 139 Z"
            fill="#0F4C3A"
            stroke="#34D399"
            strokeWidth="1.2"
            strokeOpacity="0.6"
          />

          {/* Middle Spine Accent */}
          <path
            d="M100 72 V152"
            stroke="#022C22"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M100 72 V152"
            stroke="#A7F3D0"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* 🌿 STYLIZED 'S' EMBLEM IN CENTER CREASE */}
          <path
            d="M110 90 
               C105 83, 93 83, 90 91 
               C87 99, 114 105, 110 118 
               C106 128, 90 128, 86 119"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M110 90 
               C105 83, 93 83, 90 91 
               C87 99, 114 105, 110 118 
               C106 128, 90 128, 86 119"
            fill="none"
            stroke="#059669"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Book Bottom Base Arch */}
          <path
            d="M85 148 C95 156, 105 156, 115 148"
            fill="none"
            stroke="#04392B"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      </svg>

      {!isMarkOnly && (
        <div style={{ textAlign: isHorizontal ? 'left' : 'center', display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontFamily: "'Merriweather', Georgia, serif",
              fontWeight: 800,
              fontSize: isHorizontal ? `${size * 0.42}px` : `${size * 0.36}px`,
              letterSpacing: '0.12em',
              color: textPrimary,
              textTransform: 'uppercase',
              lineHeight: 1.1
            }}
          >
            SCHOLASTIC
          </span>
          <span
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: isHorizontal ? `${size * 0.32}px` : `${size * 0.28}px`,
              letterSpacing: '0.38em',
              color: textPrimary,
              textTransform: 'uppercase',
              lineHeight: 1.1,
              marginTop: '1px'
            }}
          >
            BASE
          </span>
          {showTagline && (
            <span
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: `${Math.max(10, size * 0.18)}px`,
                fontWeight: 500,
                color: textMuted,
                letterSpacing: '0.05em',
                marginTop: '4px'
              }}
            >
              Smart School Management Platform
            </span>
          )}
        </div>
      )}
    </div>
  );
}
