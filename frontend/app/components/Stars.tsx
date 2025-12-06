'use client';

import { useEffect, useState } from 'react';

export default function Stars() {
  const [stars, setStars] = useState<{ id: number; style: React.CSSProperties }[]>([]);

  useEffect(() => {
    // Generate 100 stars with random positions and animation properties
    const newStars = Array.from({ length: 100 }).map((_, i) => ({
      id: i,
      style: {
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        width: `${Math.random() * 2 + 1}px`,
        height: `${Math.random() * 2 + 1}px`,
        '--duration': `${Math.random() * 3 + 2}s`,
        '--delay': `${Math.random() * 5}s`,
      } as React.CSSProperties,
    }));
    setStars(newStars);
  }, []);

  return (
    <div className="stars-container pointer-events-none">
      {stars.map((star) => (
        <div key={star.id} className="star" style={star.style} />
      ))}
    </div>
  );
}

