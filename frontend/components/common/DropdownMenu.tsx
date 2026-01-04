import React, { useState, useRef, useEffect } from 'react';

interface DropdownItem {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'danger';
    icon?: React.ReactNode;
}

interface DropdownMenuProps {
    trigger: React.ReactNode;
    items: DropdownItem[];
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ trigger, items }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
                {trigger}
            </div>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#1a1c24] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in-up">
                    <div className="py-1">
                        {items.map((item, index) => (
                            <button
                                key={index}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    item.onClick();
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors
                                    ${item.variant === 'danger'
                                        ? 'text-red-400 hover:bg-red-500/10'
                                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                {item.icon}
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
