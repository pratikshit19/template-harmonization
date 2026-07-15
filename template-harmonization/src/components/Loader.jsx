import React from 'react';
import loaderGif from '../assets/Sirion-loader-New.gif';

/**
 * Loader overlay displayed while the app is processing or loading data.
 * It covers the entire viewport with a semi‑transparent backdrop and a centered GIF.
 */
export default function Loader() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <img src={loaderGif} alt="Loading..." style={{ width: '120px', height: 'auto' }} />
    </div>
  );
}
