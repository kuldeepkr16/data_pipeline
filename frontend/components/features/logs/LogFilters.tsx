import React, { useState } from 'react';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { Input } from '../../common/Input';
import { Select } from '../../common/Select';
import { Config } from '../../../types';

interface LogFiltersProps {
    startDate: string;
    setStartDate: (date: string) => void;
    endDate: string;
    setEndDate: (date: string) => void;
    selectedTable: string | null;
    setSelectedTable: (table: string | null) => void;
    onRefresh: () => void;
    onReset: () => void;
    configs: Config[];
}

export const LogFilters: React.FC<LogFiltersProps> = ({
    startDate, setStartDate,
    endDate, setEndDate,
    selectedTable, setSelectedTable,
    onRefresh, onReset,
    configs
}) => {
    const [filterMenuOpen, setFilterMenuOpen] = useState(false);

    const uniqueTables = Array.from(new Set(configs.map(c => c.source_tablename).filter(Boolean)));
    const tableOptions = [
        { value: "", label: "Select Table" },
        ...uniqueTables.map(t => ({ value: t, label: t }))
    ];

    return (
        <Card className="flex flex-col sm:flex-row justify-between items-end gap-4 p-4 !bg-gray-900/40">
            <div className="flex items-end gap-4 w-full sm:w-auto flex-wrap">
                <Input
                    type="date"
                    label="Start Date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-auto"
                />
                <Input
                    type="date"
                    label="End Date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-auto"
                />
                <div className="flex flex-col space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Table</label>
                    <select
                        value={selectedTable || ''}
                        onChange={(e) => setSelectedTable(e.target.value || null)}
                        className="bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500 transition-colors min-w-[150px]"
                    >
                        <option value="" disabled>Select Table</option>
                        {uniqueTables.map((table) => (
                            <option key={String(table)} value={String(table)}>{String(table)}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="relative">
                <Button
                    variant="secondary"
                    className="!p-2"
                    onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                </Button>

                {filterMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setFilterMenuOpen(false)}></div>
                        <div className="absolute right-0 mt-2 w-48 bg-[#0f111a] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden ring-1 ring-black/50 origin-top-right">
                            <button
                                onClick={() => {
                                    onRefresh();
                                    setFilterMenuOpen(false);
                                }}
                                disabled={!selectedTable}
                                className={`w-full text-left px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors border-b border-white/5 ${!selectedTable ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Refresh
                            </button>
                            <button
                                onClick={() => {
                                    onReset();
                                    setFilterMenuOpen(false);
                                }}
                                className="w-full text-left px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Reset Defaults
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
};
