import React from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { HamburgerMenu } from '../common/HamburgerMenu';

type TabType = 'pipelines' | 'configurations' | 'logs' | 'dashboard';

interface HeaderProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
}

export const Header: React.FC = () => {
    const pathname = usePathname();
    const router = useRouter();

    return (
        <header className="w-full border-b border-white/5 bg-[#0f111a]/80 backdrop-blur-xl sticky top-0 z-50 transition-all duration-300 mb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <HamburgerMenu />
                    <div
                        className="flex items-center space-x-4 cursor-pointer"
                        onClick={() => router.push('/pipelines')}
                    >
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                            <Image src="/logo.png" alt="Logo" width={40} height={40} className="relative w-10 h-10 rounded-lg shadow-xl" />
                        </div>
                        <div>
                            <h1 className="font-bold text-xl tracking-tight text-white leading-none">DataFlow <span className="text-indigo-400">Reimagined</span></h1>
                        </div>
                    </div>
                </div>
                <nav className="hidden md:flex space-x-1">
                    {[
                        { name: 'Pipelines', href: '/pipelines' },
                        { name: 'Dashboard', href: '/dashboard' },
                        { name: 'Logs', href: '/logs' }
                    ].map((tab) => {
                        const isActive = pathname === tab.href || (tab.href === '/pipelines' && pathname === '/');
                        return (
                            <button
                                key={tab.name}
                                onClick={() => router.push(tab.href)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                    ? 'bg-white/10 text-white shadow-inner'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {tab.name}
                            </button>
                        );
                    })}
                </nav>
            </div>
        </header>
    );
};
