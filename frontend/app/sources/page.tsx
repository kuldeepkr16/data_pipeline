'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '../../components/layout/Header';
import { Footer } from '../../components/layout/Footer';
import { SourceConfig, ConnectionCreds } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';

export default function SourcesPage() {
    const [sources, setSources] = useState<SourceConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('pipelines');

    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
    const [testMessage, setTestMessage] = useState<string | null>(null);

    // Form State
    const [newSource, setNewSource] = useState<Partial<SourceConfig>>({
        source_name: '',
        source_type: 'postgres',
        source_creds: {
            host: 'localhost',
            port: 5432,
            user: 'postgres',
            password: '',
            dbname: 'postgres'
        }
    });

    const updateCreds = (field: keyof ConnectionCreds, value: any) => {
        setTestStatus('idle'); // Reset test status on change
        setTestMessage(null);
        setNewSource(prev => ({
            ...prev,
            source_creds: {
                ...prev.source_creds,
                [field]: value
            }
        }));
    };

    const handleTestConnection = async () => {
        setTestStatus('testing');
        setTestMessage(null);
        try {
            const res = await fetch('http://localhost:8000/connections/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: newSource.source_type,
                    creds: newSource.source_creds
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Connection failed');
            }

            setTestStatus('success');
            setTestMessage('Connection successful!');
        } catch (err: any) {
            setTestStatus('failed');
            setTestMessage(err.message);
        }
    };

    const [createError, setCreateError] = useState<string | null>(null);

    useEffect(() => {
        fetchSources();
    }, []);

    const fetchSources = async () => {
        try {
            const res = await fetch('http://localhost:8000/sources');
            if (res.ok) {
                setSources(await res.json());
            }
        } catch (e) {
            console.error("Failed to fetch sources", e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSource = async () => {
        setCreateError(null);
        if (!newSource.source_name) {
            setCreateError("Source Name is required");
            return;
        }

        try {
            const res = await fetch('http://localhost:8000/sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSource)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Failed to create source');
            }

            // Success
            setIsModalOpen(false);
            setNewSource({
                source_name: '',
                source_type: 'postgres',
                source_creds: { host: 'localhost', port: 5432, user: 'postgres', password: '', dbname: 'postgres' }
            });
            setTestStatus('idle');
            setTestMessage(null);
            fetchSources();
        } catch (err: any) {
            setCreateError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f111a] text-gray-100 font-sans flex flex-col">
            <div className="fixed inset-0 bg-grid-white/[0.02] bg-[length:50px_50px] pointer-events-none" />
            <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-900/20 via-[#0f111a]/50 to-[#0f111a] pointer-events-none" />

            <Header activeTab={activeTab as any} setActiveTab={setActiveTab as any} />

            <main className="relative flex-grow flex flex-col items-center p-6 md:p-10 z-10 w-full max-w-7xl mx-auto">
                <div className="w-full flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Sources</h1>
                        <p className="text-gray-400">Manage your data ingestion sources.</p>
                    </div>
                    <Button onClick={() => setIsModalOpen(true)} variant="primary" className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Add New Source
                    </Button>
                </div>

                {loading ? (
                    <div className="w-full py-20 flex justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                        {sources.map(source => (
                            <Card key={source.id || source.source_name} className="p-6 hover:border-indigo-500/50 transition-colors">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-blue-500/10 rounded-lg">
                                        <svg className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.22-3.22-7.51-7.51 3.22 3.22 7.51z" />
                                        </svg>
                                    </div>
                                    <Badge variant='success'>
                                        ACTIVE
                                    </Badge>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1">{source.source_name}</h3>
                                <p className="text-sm text-gray-500 mb-4">{source.source_type?.toUpperCase()}</p>

                                <div className="text-xs text-gray-400 pt-4 border-t border-white/5 space-y-1">
                                    <div className='flex justify-between'>
                                        <span>Host:</span>
                                        <span className="text-gray-300">{source.source_creds?.host || 'N/A'}</span>
                                    </div>
                                    <div className='flex justify-between'>
                                        <span>DB:</span>
                                        <span className="text-gray-300">{source.source_creds?.dbname || 'N/A'}</span>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </main>

            {/* Add New Source Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-[#1a1c24] border border-white/10 rounded-xl max-w-md w-full p-6 shadow-2xl animate-fade-in-up my-8">
                        <h2 className="text-xl font-bold text-white mb-6">Add New Source</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Connector Type</label>
                                <select
                                    className="w-full bg-[#0f111a] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                    value={newSource.source_type}
                                    onChange={(e) => {
                                        setNewSource({ ...newSource, source_type: e.target.value });
                                        setTestStatus('idle');
                                    }}
                                >
                                    <option value="postgres">Postgres</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Source Name (Identifier)</label>
                                <Input
                                    value={newSource.source_name}
                                    onChange={(e) => setNewSource({ ...newSource, source_name: e.target.value })}
                                    placeholder="e.g., prod_main_db"
                                />
                            </div>

                            <div className="pt-4 border-t border-white/5">
                                <h3 className="text-md font-semibold text-gray-300 mb-3">Connection Details</h3>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Host</label>
                                        <Input
                                            value={newSource.source_creds?.host}
                                            onChange={(e) => updateCreds('host', e.target.value)}
                                            placeholder="localhost"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Port</label>
                                            <Input
                                                type="number"
                                                value={newSource.source_creds?.port?.toString()}
                                                onChange={(e) => updateCreds('port', parseInt(e.target.value))}
                                                placeholder="5432"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Database Name</label>
                                            <Input
                                                value={newSource.source_creds?.dbname}
                                                onChange={(e) => updateCreds('dbname', e.target.value)}
                                                placeholder="postgres"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">User</label>
                                        <Input
                                            value={newSource.source_creds?.user}
                                            onChange={(e) => updateCreds('user', e.target.value)}
                                            placeholder="postgres"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Password</label>
                                        <Input
                                            type="password"
                                            value={newSource.source_creds?.password}
                                            onChange={(e) => updateCreds('password', e.target.value)}
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Test Connection Status and Button */}
                        <div className="mt-6 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <Button
                                    onClick={handleTestConnection}
                                    disabled={testStatus === 'testing'}
                                    className={`w-full ${testStatus === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                                >
                                    {testStatus === 'testing' ? 'Testing...' : testStatus === 'success' ? 'Connection Verified' : 'Test Connection'}
                                </Button>
                            </div>
                            {testMessage && (
                                <div className={`text-xs p-2 rounded ${testStatus === 'success' ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20'}`}>
                                    {testMessage}
                                </div>
                            )}
                        </div>

                        {createError && (
                            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                {createError}
                            </div>
                        )}

                        <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-white/5">
                            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button
                                variant="primary"
                                onClick={handleCreateSource}
                                disabled={testStatus !== 'success'} // Enforce test success
                                title={testStatus !== 'success' ? "Please verify connection first" : ""}
                            >
                                Create Source
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}
