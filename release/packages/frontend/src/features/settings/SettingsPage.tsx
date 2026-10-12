import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { AccountSettings } from './AccountSettings';
import { UserManagement } from './UserManagement';
import { DataManagement } from './DataManagement';
import PreferencesPage from '@/features/preferences/PreferencesPage';
import AISettingsPage from '@/features/ai/AISettingsPage';

type Tab = 'account' | 'preferences' | 'ai' | 'users' | 'data';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('account');

  const tabs = [
    { id: 'account' as Tab, label: 'Account', visible: true },
    { id: 'preferences' as Tab, label: 'Preferences', visible: true },
    { id: 'ai' as Tab, label: 'AI Settings', visible: user?.role === 'admin' },
    { id: 'users' as Tab, label: 'User Management', visible: user?.role === 'admin' },
    { id: 'data' as Tab, label: 'Data Management', visible: user?.role === 'admin' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <div className="bg-card border border-border rounded-lg shadow">
        {/* Tabs */}
        <div className="border-b border-border">
          <nav className="flex -mb-px">
            {tabs
              .filter((tab) => tab.visible)
              .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'account' && <AccountSettings />}
          {activeTab === 'preferences' && <PreferencesPage />}
          {activeTab === 'ai' && <AISettingsPage />}
          {activeTab === 'users' && user?.role === 'admin' && <UserManagement />}
          {activeTab === 'data' && user?.role === 'admin' && <DataManagement />}
        </div>
      </div>
    </div>
  );
}
