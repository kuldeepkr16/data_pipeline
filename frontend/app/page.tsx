'use client';

import { useState, useEffect } from 'react';

interface Config {
  source_tablename: string;
  source_to_dl_schedule: number;
  source_to_dl_load_type: string;
  source_to_dl_is_active: number;
  // Sink config (optional for now in UI, but available)
  dl_to_sink_schedule?: number;
  dl_to_sink_load_type?: string;
  dl_to_sink_is_active?: number;
}

export default function Home() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempConfig, setTempConfig] = useState<Config | null>(null);

  // Notification State
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

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
    setEditingId(config.source_tablename);
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
      const res = await fetch(`http://localhost:8000/config/${tempConfig.source_tablename}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tempConfig),
      });

      if (!res.ok) throw new Error('Failed to update config');

      // Update local state
      setConfigs(prev => prev.map(c => c.source_tablename === tempConfig.source_tablename ? tempConfig : c));
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
            <div className="w-full bg-gray-900/40 border border-white/5 rounded-xl overflow-hidden backdrop-blur-sm">
              <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/10 bg-black/20 text-xs font-bold text-gray-500 uppercase tracking-widest">
                <div className="col-span-3">Source Table</div>
                <div className="col-span-2 text-center">Source Status</div>
                <div className="col-span-2 text-center">Schedule</div>
                <div className="col-span-3 text-center">Load Type</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {configs.map((config) => {
                const isEditing = editingId === config.source_tablename;
                const current = isEditing ? tempConfig! : config;

                return (
                  <div
                    key={config.source_tablename}
                    className={`grid grid-cols-12 gap-4 p-4 items-center border-b border-white/5 hover:bg-white/5 transition-colors ${isEditing ? 'bg-indigo-900/20 border-indigo-500/30' : ''}`}
                  >
                    {/* Table Name */}
                    <div className="col-span-3 font-medium text-white capitalize">
                      {config.source_tablename}
                    </div>

                    {/* Status */}
                    <div className="col-span-2 text-center">
                      {isEditing ? (
                        <button
                          onClick={() => handleInputChange('source_to_dl_is_active', current.source_to_dl_is_active ? 0 : 1)}
                          className={`px-2 py-1 rounded text-xs font-bold w-20 ${current.source_to_dl_is_active
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                        >
                          {current.source_to_dl_is_active ? 'ACTIVE' : 'INACTIVE'}
                        </button>
                      ) : (
                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold w-20 ${config.source_to_dl_is_active
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                          {config.source_to_dl_is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      )}
                    </div>

                    {/* Schedule */}
                    <div className="col-span-2 text-center font-mono text-gray-300">
                      {isEditing ? (
                        <input
                          type="number"
                          value={current.source_to_dl_schedule}
                          onChange={(e) => handleInputChange('source_to_dl_schedule', parseInt(e.target.value))}
                          className="w-16 bg-black/50 border border-indigo-500/50 rounded px-2 py-1 text-center focus:outline-none focus:border-indigo-400"
                        />
                      ) : (
                        <span>{config.source_to_dl_schedule}m</span>
                      )}
                    </div>

                    {/* Load Type */}
                    <div className="col-span-3 text-center">
                      {isEditing ? (
                        <select
                          value={current.source_to_dl_load_type}
                          onChange={(e) => handleInputChange('source_to_dl_load_type', e.target.value)}
                          className="bg-black/50 border border-indigo-500/50 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-indigo-400"
                        >
                          <option value="full">Full Load</option>
                          <option value="incremental">Incremental</option>
                        </select>
                      ) : (
                        <span className="inline-block px-2 py-1 rounded bg-white/5 text-gray-400 text-xs">
                          {config.source_to_dl_load_type}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-2 flex justify-end space-x-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={handleSave}
                            className="p-1.5 bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
                            title="Save"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={handleCancel}
                            className="p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                            title="Cancel"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleEdit(config)}
                          className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 hover:border-indigo-500 rounded transition-all"
                        >
                          Edit
                        </button>
                      )}
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
        <div className={`fixed bottom-0 left-0 w-full p-4 text-center font-medium transform transition-transform duration-300 ease-in-out z-50 ${notification.type === 'success'
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
