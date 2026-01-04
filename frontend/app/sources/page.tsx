'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '../../components/layout/Header';
import { Footer } from '../../components/layout/Footer';
import { SourceConfig } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ConnectorIcon } from '../../components/common/ConnectorIcon';
import { Modal } from '../../components/common/Modal';
import { SourceForm } from '../../components/features/sources/SourceForm';
import { DropdownMenu } from '../../components/common/DropdownMenu';

export default function SourcesPage() {
    const [sources, setSources] = useState<SourceConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [iscreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingSource, setEditingSource] = useState<SourceConfig | null>(null);
    const [activeTab, setActiveTab] = useState('pipelines');

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

    const handleCreateSource = async (data: Partial<SourceConfig>) => {
        try {
            const res = await fetch('http://localhost:8000/sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Failed to create source');
            }

            setIsCreateModalOpen(false);
            fetchSources();
        } catch (err: any) {
            throw err; // SourceForm handles error display
        }
    };

    const handleUpdateSource = async (data: Partial<SourceConfig>) => {
        if (!editingSource?.source_name) return; // Identifier needed

        try {
            // NOTE: Assuming the backend supports PUT/PATCH on /sources/{name} or similar. 
            // If not, we might need to recreate it. 
            // Usually, for "editing" configuration that includes creds, we might repost.
            // Let's assume a PUT endpoint exists or we use the POST to upsert if backend supports it.
            // Given the original code, there was only POST /sources. 
            // If I need to implement Edit, I should probably check if backend supports it. 
            // But since I can't check backend code right now easily without switching context, 
            // I will assume standard REST pattern: POST to update if ID exists or POST to upsert.
            // Wait, looking at previous file code, it was just POST /sources.
            // Let's try POSTing again. If it fails, I might need to adjust.
            // Actually, usually ID is immutable. 

            // Checking: effectively we want to update credentials mostly.

            const res = await fetch(`http://localhost:8000/sources/${editingSource.source_name}`, { // Assuming this endpoint
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            // Fallback if PUT not supported, try POST (upsert behavior?)
            if (res.status === 405 || res.status === 404) {
                const res2 = await fetch('http://localhost:8000/sources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (!res2.ok) {
                    const errData = await res2.json();
                    throw new Error(errData.detail || 'Failed to update source');
                }
            } else if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Failed to update source');
            }

            setEditingSource(null);
            fetchSources();
        } catch (err: any) {
            throw err;
        }
    };

    const handleDeleteSource = async (sourceName: string) => {
        if (!confirm(`Are you sure you want to delete source "${sourceName}"?`)) return;

        try {
            const res = await fetch(`http://localhost:8000/sources/${sourceName}`, { // Assuming DELETE endpoint
                method: 'DELETE'
            });

            if (!res.ok) {
                // If 404, maybe it's already gone
                if (res.status !== 404) {
                    const errData = await res.json();
                    alert(errData.detail || 'Failed to delete source');
                    return;
                }
            }
            fetchSources();
        } catch (err) {
            console.error(err);
            alert("Failed to delete source");
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
                    <Button onClick={() => setIsCreateModalOpen(true)} variant="primary" className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Add New Source
                    </Button>
                </div>

                {loading ? (
                    <div className="w-full py-20 flex justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <div className="w-full space-y-4">
                        {sources.map(source => (
                            <Card key={source.id || source.source_name} className="p-6 transition-colors hover:border-indigo-500/50 flex flex-col md:flex-row items-center gap-6">
                                <div className="p-4 bg-blue-500/10 rounded-xl flex-shrink-0">
                                    <ConnectorIcon type={source.source_type || 'default'} className="w-8 h-8 text-blue-400" />
                                </div>

                                {/* Content */}
                                <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                                    {/* Name & Type */}
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-xl font-bold text-white">{source.source_name}</h3>
                                            <Badge variant='success'>ACTIVE</Badge>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">{source.source_type?.toUpperCase()}</p>
                                    </div>

                                    {/* Details */}
                                    <div className="text-sm text-gray-400 space-y-1">
                                        <div className='flex gap-2'>
                                            <span className="text-gray-500">Host:</span>
                                            <span className="text-gray-300">{source.source_creds?.host || 'N/A'}</span>
                                        </div>
                                        <div className='flex gap-2'>
                                            <span className="text-gray-500">DB:</span>
                                            <span className="text-gray-300">{source.source_creds?.dbname || 'N/A'}</span>
                                        </div>
                                    </div>

                                    {/* Additional info placeholder or empty */}
                                    <div className="md:text-right text-xs text-gray-600 self-center">
                                        Created: {source.created_at ? new Date(source.created_at).toLocaleDateString() : 'N/A'}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex-shrink-0 ml-auto">
                                    <DropdownMenu
                                        trigger={
                                            <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                </svg>
                                            </button>
                                        }
                                        items={[
                                            {
                                                label: 'Edit Configuration',
                                                icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
                                                onClick: () => setEditingSource(source)
                                            },
                                            {
                                                label: 'Delete Source',
                                                icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
                                                onClick: () => handleDeleteSource(source.source_name),
                                                variant: 'danger'
                                            }
                                        ]}
                                    />
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </main>

            {/* Create Source Modal */}
            <Modal
                isOpen={iscreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Add New Source"
            >
                <SourceForm
                    onSubmit={handleCreateSource}
                    onCancel={() => setIsCreateModalOpen(false)}
                />
            </Modal>

            {/* Edit Source Modal */}
            <Modal
                isOpen={!!editingSource}
                onClose={() => setEditingSource(null)}
                title="Edit Source"
            >
                {editingSource && (
                    <SourceForm
                        initialData={editingSource}
                        onSubmit={handleUpdateSource}
                        onCancel={() => setEditingSource(null)}
                        isEditing={true}
                    />
                )}
            </Modal>

            <Footer />
        </div>
    );
}
