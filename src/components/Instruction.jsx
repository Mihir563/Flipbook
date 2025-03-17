import React from 'react';

export function ARInstructions() {
  return (
    <div className="ar-instructions">
      <div className="instruction-card">
        <div className="icon">📱</div>
        <h3>AR Mode Instructions</h3>
        <ol>
          <li>Move your phone around to detect surfaces</li>
          <li>When you see a circular indicator, tap to place the album</li>
          <li>Use pinch gestures to resize the album</li>
          <li>Tap the reset button to reposition</li>
        </ol>
      </div>
      <style jsx>{`
        .ar-instructions {
          position: absolute;
          bottom: 20px;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          pointer-events: none;
          z-index: 1000;
        }
        .instruction-card {
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 15px 20px;
          border-radius: 12px;
          max-width: 300px;
          text-align: center;
          pointer-events: auto;
        }
        .icon {
          font-size: 24px;
          margin-bottom: 10px;
        }
        ol {
          text-align: left;
          margin-top: 10px;
          padding-left: 20px;
        }
        li {
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}