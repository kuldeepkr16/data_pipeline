'use client';

import { useState, useEffect } from 'react';

interface Config {
  table_name: string;
  schedule_in_mins: number;
  load_type: string;
  is_active: number;
  source_type: string | null;
  incremental_key: string | null;
  last_incremental_value: string | null;
  last_loader_run_timestamp: string | null;
  last_loader_run_status: string | null;
}

export default function Home() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempConfig, setTempConfig] = useState<Config | null>(null);
  
  // Notification State
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Clear notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchData = async () => {
    try {
      const res = await fetch('http://localhost:8000/config');
      if (!res.ok) throw new Error('Failed to fetch data');
      const data = await res.json();
      setConfigs(data);
    } catch (err) {
      setError('Failed to load configuration data. Is the backend running?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (config: Config) => {
    setEditingId(config.table_name);
    setTempConfig({ ...config });
  };

  const handleCancel = () => {
    setEditingId(null);
    setTempConfig(null);
  };

  const handleInputChange = (field: keyof Config, value: any) => {
    if (tempConfig) {
      setTempConfig({ ...tempConfig, [field]: value });
    }
  };

  const handleSave = async () => {
    if (!tempConfig) return;

    try {
      const res = await fetch(`http://localhost:8000/config/${tempConfig.table_name}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tempConfig),
      });

      if (!res.ok) throw new Error('Failed to update config');
      
      // Update local state
      setConfigs(prev => prev.map(c => c.table_name === tempConfig.table_name ? tempConfig : c));
      setEditingId(null);
      setTempConfig(null);
      
      // Show success banner
      setNotification({ message: 'Configuration saved successfully!', type: 'success' });
    } catch (err) {
      console.error('Error saving config:', err);
      // Show error banner
      setNotification({ message: 'Failed to save configuration. Please try again.', type: 'error' });
    }
  };

  return (
    <>
      {/* Header */}
      <header className="w-full border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 animate-pulse"></div>
            <span className="font-bold text-xl tracking-tight text-white">
              Data Pipeline <span className="text-indigo-400">Reimagined</span>
            </span>
          </div>
          <nav className="hidden md:flex space-x-8">
            <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Dashboard</a>
            <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Pipelines</a>
            <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Settings</a>
          </nav>
          <div className="flex items-center">
            <span className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
            <span className="text-xs text-green-400 font-mono">SYSTEM ONLINE</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center p-8 md:p-12">
        <div className="w-full max-w-5xl">
          <div className="mb-12 text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Pipeline Configurations
            </h1>
            <p className="text-gray-400 max-w-2xl">
              Monitor and edit your data ingestion schedules and sync statuses in real-time.
            </p>
          </div>

          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-3"></div>
              <div className="text-indigo-400 animate-pulse text-lg">Acquiring signal...</div>
            </div>
          )}

          {error && (
            <div className="mx-auto max-w-2xl bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-center">
              <p className="text-red-400 font-medium">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="w-full space-y-4">
              {configs.map((config) => {
                const isEditing = editingId === config.table_name;
                const current = isEditing ? tempConfig! : config;

                return (
                  <div 
                    key={config.table_name} 
                    className={`bg-gray-900/40 border rounded-xl overflow-hidden backdrop-blur-sm transition-all ${
                      isEditing ? 'border-indigo-500/50 bg-indigo-900/20' : 'border-white/5 hover:border-white/10'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between p-4 border-b border-white/5">
                      <div className="flex items-center space-x-4">
                        {/* Table Name */}
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${config.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <h3 className="text-lg font-semibold text-white capitalize">{config.table_name}</h3>
                        </div>
                        
                        {/* Source Type Badge */}
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs font-medium border border-purple-500/30">
                          {config.source_type || 'postgres'}
                        </span>
                        
                        {/* Load Type Badge */}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
                          config.load_type === 'incremental' 
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {config.load_type}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2">
                        {isEditing ? (
                          <>
                            <button 
                              onClick={handleSave}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium transition-colors flex items-center space-x-1"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Save</span>
                            </button>
                            <button 
                              onClick={handleCancel}
                              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-medium transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleEdit(config)}
                            className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 hover:border-indigo-500 rounded text-sm font-medium transition-all"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Status */}
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500 uppercase tracking-wider">Status</label>
                        {isEditing ? (
                          <button
                            onClick={() => handleInputChange('is_active', current.is_active ? 0 : 1)}
                            className={`px-3 py-1.5 rounded text-sm font-bold w-full ${
                              current.is_active 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {current.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </button>
                        ) : (
                          <div className={`px-3 py-1.5 rounded text-sm font-bold text-center ${
                            config.is_active 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {config.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </div>
                        )}
                      </div>

                      {/* Schedule */}
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500 uppercase tracking-wider">Schedule</label>
                        {isEditing ? (
                          <input
                            type="number"
                            value={current.schedule_in_mins}
                            onChange={(e) => handleInputChange('schedule_in_mins', parseInt(e.target.value))}
                            className="w-full bg-black/50 border border-indigo-500/50 rounded px-3 py-1.5 text-center font-mono text-white focus:outline-none focus:border-indigo-400"
                          />
                        ) : (
                          <div className="px-3 py-1.5 rounded bg-white/5 text-gray-300 font-mono text-center">
                            {config.schedule_in_mins} mins
                          </div>
                        )}
                      </div>

                      {/* Load Type */}
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500 uppercase tracking-wider">Load Type</label>
                        {isEditing ? (
                          <select
                            value={current.load_type}
                            onChange={(e) => handleInputChange('load_type', e.target.value)}
                            className="w-full bg-black/50 border border-indigo-500/50 rounded px-3 py-1.5 text-gray-300 focus:outline-none focus:border-indigo-400"
                          >
                            <option value="full">Full Load</option>
                            <option value="incremental">Incremental</option>
                          </select>
                        ) : (
                          <div className="px-3 py-1.5 rounded bg-white/5 text-gray-300 text-center capitalize">
                            {config.load_type}
                          </div>
                        )}
                      </div>

                      {/* Incremental Key */}
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500 uppercase tracking-wider">Incremental Key</label>
                        <div className="px-3 py-1.5 rounded bg-white/5 text-gray-300 font-mono text-center text-sm">
                          {config.incremental_key || '-'}
                        </div>
                      </div>
                    </div>

                    {/* Run Status Row */}
                    <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Last Incremental Value */}
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500 uppercase tracking-wider">Last Incremental Value</label>
                        <div className="px-3 py-2 rounded bg-black/30 border border-white/5 text-gray-400 font-mono text-xs">
                          {config.last_incremental_value || 'N/A'}
                        </div>
                      </div>

                      {/* Last Run Timestamp */}
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500 uppercase tracking-wider">Last Run</label>
                        <div className="px-3 py-2 rounded bg-black/30 border border-white/5 text-gray-400 font-mono text-xs">
                          {config.last_loader_run_timestamp 
                            ? new Date(config.last_loader_run_timestamp).toLocaleString() 
                            : 'Never'}
                        </div>
                      </div>

                      {/* Last Run Status */}
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500 uppercase tracking-wider">Last Run Status</label>
                        <div className={`px-3 py-2 rounded border text-xs font-medium text-center uppercase ${
                          config.last_loader_run_status === 'success'
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : config.last_loader_run_status === 'failed'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }`}>
                          {config.last_loader_run_status || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 bg-black/30 backdrop-blur-sm py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm mb-2">
            &copy; 2024 Data Pipeline Reimagined. All systems nominal.
          </p>
        </div>
      </footer>

      {/* Notification Banner */}
      {notification && (
        <div className={`fixed bottom-0 left-0 w-full p-4 text-center font-medium transform transition-transform duration-300 ease-in-out z-50 ${
          notification.type === 'success' 
            ? 'bg-green-600/90 text-white backdrop-blur-md border-t border-green-400' 
            : 'bg-red-600/90 text-white backdrop-blur-md border-t border-red-400'
        }`}>
          <div className="flex justify-center items-center space-x-2">
            {notification.type === 'success' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}
    </>
  );
}
