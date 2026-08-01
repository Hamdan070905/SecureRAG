import React from "react";

export function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
      <div className="banter-loader" style={{ transform: 'scale(0.5)', transformOrigin: 'center left' }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="banter-loader__box" />
        ))}
      </div>
    </div>
  );
}
