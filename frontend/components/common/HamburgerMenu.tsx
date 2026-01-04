import React, { useState } from 'react';
import Link from 'next/link';

export const HamburgerMenu: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative">
            {/* Hamburger Icon */}
            <button
                onClick={toggleMenu}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                aria-label="Main menu"
            >
                <div className="flex flex-col space-y-1.5 w-6">
                    <span
                        className={`block h-0.5 w-full bg-gray-300 transform transition-all duration-300 ease-in-out ${isOpen ? "rotate-45 translate-y-2" : ""
                            }`}
                    />
                    <span
                        className={`block h-0.5 w-full bg-gray-300 transition-all duration-300 ease-in-out ${isOpen ? "opacity-0" : "opacity-100"
                            }`}
                    />
                    <span
                        className={`block h-0.5 w-full bg-gray-300 transform transition-all duration-300 ease-in-out ${isOpen ? "-rotate-45 -translate-y-2" : ""
                            }`}
                    />
                </div>
            </button>

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 top-20 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
                    onClick={toggleMenu}
                />
            )}

            {/* Side Drawer */}
            <div className={`fixed top-20 left-0 h-[calc(100vh-5rem)] w-[320px] bg-[#121212] shadow-2xl z-40 transform transition-transform duration-300 ease-in-out border-t border-white/10 ${isOpen ? "translate-x-0" : "-translate-x-full"
                }`}>
                <div className="flex flex-col h-full">
                    {/* Drawer Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#121212]">
                        <span className="text-lg font-bold text-white tracking-wide">MENU</span>
                        {/* 
                            Optional: Internal Close Button. 
                            Since the main Hamburger icon is visible (below header) and turns to 'X', 
                            we might not need a second close button here. But keeping a subtle one is harmless.
                        */}
                    </div>

                    {/* Navigation Links */}
                    <nav className="flex-1 overflow-y-auto py-4">
                        <Link
                            href="/sources"
                            className="block px-6 py-4 text-[15px] font-medium text-gray-300 hover:bg-white/5 hover:text-white border-l-2 border-transparent hover:border-blue-500 transition-all"
                            onClick={() => setIsOpen(false)}
                        >
                            SOURCES
                        </Link>
                        <Link
                            href="/destinations"
                            className="block px-6 py-4 text-[15px] font-medium text-gray-300 hover:bg-white/5 hover:text-white border-l-2 border-transparent hover:border-purple-500 transition-all"
                            onClick={() => setIsOpen(false)}
                        >
                            DESTINATIONS
                        </Link>
                    </nav>

                    {/* Drawer Footer */}
                    <div className="p-6 border-t border-white/10">
                        <p className="text-xs text-center text-gray-500">
                            DataFlow Reimagined
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
