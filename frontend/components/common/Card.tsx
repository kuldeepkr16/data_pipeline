import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
    return (
        <div className={`bg-gray-900/40 border border-white/10 rounded-xl p-4 shadow-xl ${className}`}>
            {children}
        </div>
    );
};
