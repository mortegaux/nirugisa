import { useState } from 'react';
import { settingsApi } from '@/services/api';

export function DataManagement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirming, setConfirming] = useState(false);

  const handleEmptyDatabase = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setConfirming(false);
      await settingsApi.clearData();
      setSuccess('Database emptied successfully.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to empty database');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Data Management</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md">
            {success}
          </div>
        )}

        <div className="border border-red-300 bg-red-50 rounded-lg p-4">
          <h3 className="font-semibold text-red-900 mb-2">Empty Database</h3>
          <p className="text-sm text-red-700 mb-3">
            Permanently delete all recipes, meal plans, shopping lists, pantry items, and other
            data. This action cannot be undone.
          </p>
          {confirming && (
            <p className="text-sm font-medium text-red-800 mb-3">
              Are you sure? This will permanently erase all your data.
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleEmptyDatabase}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Emptying...' : confirming ? 'Yes, Empty Database' : 'Empty Database'}
            </button>
            {confirming && (
              <button
                onClick={() => setConfirming(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
