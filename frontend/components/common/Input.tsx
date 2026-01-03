import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
    return (
        <div className={`flex flex-col space-y-1 ${className}`}>
            {label && <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>}
            <input
                className="bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500 transition-colors w-full"
                {...props}
            />
        </div>
    );
};
