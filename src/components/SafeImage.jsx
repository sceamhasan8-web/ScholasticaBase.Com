import React, { useState, useEffect } from 'react';

/**
 * SafeImage - Defensive Image Component with Skeleton Loader & Fallback UI
 * Bulletproofs the app against missing, slow-loading, or broken images.
 */
export default function SafeImage({
  src,
  alt = '',
  className = '',
  style = {},
  fallbackVariant = 'school', // 'school' | 'avatar' | 'generic'
  fallbackText = '',
  width,
  height,
  objectFit = 'contain',
  onLoad,
  onError,
  ...props
}) {
  const [status, setStatus] = useState(() => (!src || typeof src !== 'string' || !src.trim() ? 'error' : 'loading'));

  useEffect(() => {
    if (!src || typeof src !== 'string' || !src.trim()) {
      setStatus('error');
    } else {
      setStatus('loading');
    }
  }, [src]);

  const handleImageLoad = (e) => {
    setStatus('loaded');
    if (onLoad) onLoad(e);
  };

  const handleImageError = (e) => {
    setStatus('error');
    if (onError) onError(e);
  };

  // Helper to extract initials (e.g., "JAMALPUR KALIYAKAIR" -> "JK", "Student" -> "S")
  const getInitials = (text) => {
    if (!text || typeof text !== 'string') return '';
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  const containerStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
    boxSizing: 'border-box',
    width: width || undefined,
    height: height || undefined,
    ...style,
  };

  // Render Fallback UI
  const renderFallback = () => {
    const initials = fallbackText ? getInitials(fallbackText) : '';

    if (fallbackVariant === 'avatar') {
      return (
        <div
          className={`safe-img-fallback safe-img-fallback-avatar ${className}`}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 'calc(40% + 4px)',
            userSelect: 'none',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)',
          }}
          title={alt || fallbackText || 'Avatar'}
        >
          {initials ? (
            <span>{initials}</span>
          ) : (
            <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </div>
      );
    }

    if (fallbackVariant === 'school') {
      return (
        <div
          className={`safe-img-fallback safe-img-fallback-school ${className}`}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
            color: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            padding: '2px',
            userSelect: 'none',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
          }}
          title={alt || fallbackText || 'School Crest'}
        >
          {initials ? (
            <span style={{ fontSize: 'calc(35% + 4px)', letterSpacing: '0.05em' }}>{initials}</span>
          ) : (
            <svg width="55%" height="55%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          )}
        </div>
      );
    }

    // Generic fallback
    return (
      <div
        className={`safe-img-fallback safe-img-fallback-generic ${className}`}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '8px',
          background: '#f1f5f9',
          border: '1px solid #cbd5e1',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title={alt || 'Image'}
      >
        <svg width="50%" height="50%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      </div>
    );
  };

  return (
    <span className={`safe-img-wrapper ${className}`} style={containerStyle}>
      {/* 1. Loading Skeleton */}
      {status === 'loading' && (
        <span
          className="skeleton-shimmer"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            zIndex: 1,
            height: '100%',
            width: '100%',
          }}
        />
      )}

      {/* 2. Hidden preload / Active Image */}
      {status !== 'error' && (
        <img
          src={src}
          alt={alt}
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{
            width: '100%',
            height: '100%',
            objectFit,
            display: status === 'loaded' ? 'block' : 'none',
            borderRadius: 'inherit',
          }}
          {...props}
        />
      )}

      {/* 3. Error Fallback UI */}
      {status === 'error' && renderFallback()}
    </span>
  );
}
