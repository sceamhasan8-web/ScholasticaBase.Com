import React, { useState, useEffect } from 'react';

/**
 * Preloads an array or single URL of images into browser memory.
 * Resolves true when all images load or fail (prevents hanging skeleton UI).
 */
export const preloadImages = (urls) => {
  const urlArray = Array.isArray(urls) ? urls : [urls];
  const promises = urlArray
    .filter((url) => typeof url === 'string' && url.trim().length > 0)
    .map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
        })
    );
  return Promise.all(promises);
};

/**
 * Custom CSS-Based Shimmer Skeleton element
 * Works with or without external npm dependencies
 */
export function BaseSkeleton({
  width = '100%',
  height = '20px',
  borderRadius = '8px',
  circle = false,
  style = {},
  className = '',
  count = 1,
}) {
  const items = Array.from({ length: count });

  return (
    <>
      {items.map((_, index) => (
        <span
          key={index}
          className={`skeleton-shimmer ${className}`}
          style={{
            width,
            height,
            borderRadius: circle ? '50%' : borderRadius,
            marginBottom: count > 1 && index < count - 1 ? '8px' : style.marginBottom,
            ...style,
          }}
        />
      ))}
    </>
  );
}

/**
 * SkeletonWrapper for consistent container padding & styling
 */
export function SkeletonWrapper({ children }) {
  return <div className="skeleton-container-wrapper">{children}</div>;
}

/**
 * Card Grid Skeleton - For Admin/Teacher/Student dashboards
 */
export function CardSkeleton({ count = 4, height = 140 }) {
  return (
    <SkeletonWrapper>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', width: '100%' }}>
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            style={{
              background: '#ffffff',
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <BaseSkeleton circle width="46px" height="46px" />
              <div style={{ flex: 1 }}>
                <BaseSkeleton width="60%" height="18px" />
                <BaseSkeleton width="40%" height="14px" style={{ marginTop: 6 }} />
              </div>
            </div>
            <BaseSkeleton height={`${height - 80}px`} />
          </div>
        ))}
      </div>
    </SkeletonWrapper>
  );
}

/**
 * Table Skeleton - For Exam Results, Fee Records, Routines, and Lists
 */
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <SkeletonWrapper>
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          width: '100%',
          overflowX: 'auto',
        }}
      >
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '2px solid #f1f5f9' }}>
          {Array.from({ length: columns }).map((_, colIdx) => (
            <BaseSkeleton key={colIdx} style={{ flex: 1 }} height="24px" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} style={{ display: 'flex', gap: '16px', marginBottom: '14px', alignItems: 'center' }}>
            {Array.from({ length: columns }).map((_, colIdx) => (
              <BaseSkeleton key={colIdx} style={{ flex: 1 }} height="20px" />
            ))}
          </div>
        ))}
      </div>
    </SkeletonWrapper>
  );
}

/**
 * Portal Route Skeleton - Seamless substitute for ProtectedRoute loading screens
 */
export function PortalSkeleton({ message = 'Loading application portal...' }) {
  return (
    <SkeletonWrapper>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          padding: '20px',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            width: '100%',
            background: '#ffffff',
            borderRadius: '20px',
            padding: '36px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
            textAlign: 'center',
          }}
        >
          <div style={{ margin: '0 auto 20px auto', width: '64px', height: '64px' }}>
            <BaseSkeleton circle width="64px" height="64px" />
          </div>
          <BaseSkeleton width="70%" height="24px" style={{ margin: '0 auto 12px auto' }} />
          <BaseSkeleton width="90%" height="16px" count={2} style={{ marginTop: '8px' }} />
          <p style={{ color: '#64748b', fontSize: '13.5px', marginTop: '20px', fontWeight: 500 }}>
            {message}
          </p>
        </div>
      </div>
    </SkeletonWrapper>
  );
}

/**
 * ImageWithSkeleton - Drop-in replacement for <img> tags with automated Firebase Storage Skeleton loader
 */
export function ImageWithSkeleton({
  src,
  alt = '',
  width,
  height,
  borderRadius = '8px',
  style = {},
  className = '',
  objectFit = 'cover',
  fallbackText = '',
  ...props
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setError(true);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    setError(false);

    let isMounted = true;
    const img = new Image();
    img.src = src;
    img.onload = () => {
      if (isMounted) setLoaded(true);
    };
    img.onerror = () => {
      if (isMounted) {
        setError(true);
        setLoaded(true);
      }
    };

    return () => {
      isMounted = false;
    };
  }, [src]);

  const containerStyle = {
    position: 'relative',
    display: 'inline-block',
    width: width || '100%',
    height: height || '100%',
    borderRadius,
    overflow: 'hidden',
    ...style,
  };

  return (
    <SkeletonWrapper>
      <div style={containerStyle} className={`img-skeleton-wrapper ${className}`}>
        {!loaded && (
          <BaseSkeleton
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              borderRadius,
            }}
          />
        )}
        {src && !error && (
          <img
            src={src}
            alt={alt}
            style={{
              width: '100%',
              height: '100%',
              objectFit,
              borderRadius,
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.3s ease-in-out',
              display: 'block',
            }}
            {...props}
          />
        )}
        {error && (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '14px',
              borderRadius,
            }}
          >
            {fallbackText || alt?.charAt(0)?.toUpperCase() || '📷'}
          </div>
        )}
      </div>
    </SkeletonWrapper>
  );
}

export default {
  preloadImages,
  BaseSkeleton,
  SkeletonWrapper,
  CardSkeleton,
  TableSkeleton,
  PortalSkeleton,
  ImageWithSkeleton,
};
