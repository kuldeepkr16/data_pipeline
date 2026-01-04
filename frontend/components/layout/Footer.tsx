import React from 'react';

export const Footer: React.FC = () => {
    return (
        <footer className="w-full border-t border-white/5 bg-[#0f111a] py-8 mt-auto">
            <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-xs text-gray-600">
                <p>&copy; 2024 DataFlow Reimagined. Enterprise Edition.</p>
                <div className="flex space-x-6 mt-4 md:mt-0">
                    <span>v2.4.0-stable</span>
                    <span className="hover:text-gray-400 cursor-pointer transition-colors">Documentation</span>
                    <span className="hover:text-gray-400 cursor-pointer transition-colors">Support</span>
                    <span className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        <span>IST Timezone</span>
                    </span>
                </div>
            </div>
        </footer>
    );
};
