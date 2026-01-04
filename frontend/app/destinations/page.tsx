'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '../../components/layout/Header';
import { Footer } from '../../components/layout/Footer';
import { DestinationConfig } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ConnectorIcon } from '../../components/common/ConnectorIcon';
import { Modal } from '../../components/common/Modal';
import { DestinationForm } from '../../components/features/destinations/DestinationForm';
import { DropdownMenu } from '../../components/common/DropdownMenu';

export default function DestinationsPage() {
    const [destinations, setDestinations] = useState<DestinationConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingDestination, setEditingDestination] = useState<DestinationConfig | null>(null);
    const [activeTab, setActiveTab] = useState('pipelines');

    useEffect(() => {
        fetchDestinations();
    }, []);

    const fetchDestinations = async () => {
        try {
            const res = await fetch('http://localhost:8000/destinations');
            if (res.ok) {
                setDestinations(await res.json());
            }
        } catch (e) {
            console.error("Failed to fetch destinations", e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDestination = async (data: Partial<DestinationConfig>) => {
        try {
            const res = await fetch('http://localhost:8000/destinations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Failed to create destination');
            }

            setIsCreateModalOpen(false);
            fetchDestinations();
        } catch (err: any) {
            throw err;
        }
    };

    const handleUpdateDestination = async (data: Partial<DestinationConfig>) => {
        if (!editingDestination?.destination_name) return;

        try {
            const res = await fetch(`http://localhost:8000/destinations/${editingDestination.destination_name}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.status === 405 || res.status === 404) {
                const res2 = await fetch('http://localhost:8000/destinations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (!res2.ok) {
                    const errData = await res2.json();
                    throw new Error(errData.detail || 'Failed to update destination');
                }
            } else if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Failed to update destination');
            }

            setEditingDestination(null);
            fetchDestinations();
        } catch (err: any) {
            throw err;
        }
    };

    const handleDeleteDestination = async (destinationName: string) => {
        if (!confirm(`Are you sure you want to delete destination "${destinationName}"?`)) return;

        try {
            const res = await fetch(`http://localhost:8000/destinations/${destinationName}`, {
                method: 'DELETE'
            });

            if (!res.ok && res.status !== 404) {
                const errData = await res.json();
                alert(errData.detail || 'Failed to delete destination');
                return;
            }
            fetchDestinations();
        } catch (err) {
            console.error(err);
            alert("Failed to delete destination");
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
                        <h1 className="text-3xl font-bold text-white mb-2">Destinations</h1>
                        <p className="text-gray-400">Manage your data export targets.</p>
                    </div>
                    <Button onClick={() => setIsCreateModalOpen(true)} variant="primary" className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Add New Destination
                    </Button>
                </div>

                {loading ? (
                    <div className="w-full py-20 flex justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <div className="w-full space-y-4">
                        {destinations.map(dest => (
                            <Card key={dest.id || dest.destination_name} className="p-6 transition-colors hover:border-purple-500/50 flex flex-col md:flex-row items-center gap-6">
                                <div className="p-4 bg-purple-500/10 rounded-xl flex-shrink-0">
                                    <ConnectorIcon type={dest.destination_type || 'default'} className="w-8 h-8 text-purple-400" />
                                </div>

                                {/* Content */}
                                <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                                    {/* Name & Type */}
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-xl font-bold text-white">{dest.destination_name}</h3>
                                            <Badge variant='success'>ACTIVE</Badge>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">{dest.destination_type?.toUpperCase()}</p>
                                    </div>

                                    {/* Details */}
                                    <div className="text-sm text-gray-400 space-y-1">
                                        <div className='flex gap-2'>
                                            <span className="text-gray-500">Host:</span>
                                            <span className="text-gray-300">{dest.destination_creds?.host || 'N/A'}</span>
                                        </div>
                                        <div className='flex gap-2'>
                                            <span className="text-gray-500">DB:</span>
                                            <span className="text-gray-300">{dest.destination_creds?.dbname || 'N/A'}</span>
                                        </div>
                                    </div>

                                    {/* Created At */}
                                    <div className="md:text-right text-xs text-gray-600 self-center">
                                        Created: {dest.created_at ? new Date(dest.created_at).toLocaleDateString() : 'N/A'}
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
                                                onClick: () => setEditingDestination(dest)
                                            },
                                            {
                                                label: 'Delete Destination',
                                                icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
                                                onClick: () => handleDeleteDestination(dest.destination_name),
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

            {/* Create Destination Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Add New Destination"
            >
                <DestinationForm
                    onSubmit={handleCreateDestination}
                    onCancel={() => setIsCreateModalOpen(false)}
                />
            </Modal>

            {/* Edit Destination Modal */}
            <Modal
                isOpen={!!editingDestination}
                onClose={() => setEditingDestination(null)}
                title="Edit Destination"
            >
                {editingDestination && (
                    <DestinationForm
                        initialData={editingDestination}
                        onSubmit={handleUpdateDestination}
                        onCancel={() => setEditingDestination(null)}
                        isEditing={true}
                    />
                )}
            </Modal>

            <Footer />
        </div>
    );
}
