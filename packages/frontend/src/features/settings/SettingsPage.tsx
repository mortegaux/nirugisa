import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { AccountSettings } from './AccountSettings';
import { UserManagement } from './UserManagement';
import { EmailSettings } from './EmailSettings';
import { DataManagement } from './DataManagement';
import PreferencesPage from '@/features/preferences/PreferencesPage';
import AISettingsPage from '@/features/ai/AISettingsPage';
import UserAIKeySettings from './UserAIKeySettings';

type Tab = 'account' | 'preferences' | 'aikey' | 'ai' | 'users' | 'email' | 'data';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  // Deep link support: /settings?tab=ai opens the AI tab directly.
  // Used by the AI setup CTA when AI isn't configured yet.
  const initialTab = (searchParams.get('tab') as Tab) || 'account';
  // The AI Settings tab is admin-only — fall back to the BYOK key tab for
  // non-admins hitting the deep link.
  const safeInitialTab: Tab =
    initialTab === 'ai' && user?.role !== 'admin' ? 'aikey' : initialTab;
  const [activeTab, setActiveTab] = useState<Tab>(safeInitialTab);

  const tabs = [
    { id: 'account' as Tab, label: 'Account', visible: true },
    { id: 'preferences' as Tab, label: 'Preferences', visible: true },
    { id: 'aikey' as Tab, label: 'AI Key', visible: true },
    { id: 'ai' as Tab, label: 'AI Settings', visible: user?.role === 'admin' },
    { id: 'users' as Tab, label: 'User Management', visible: user?.role === 'admin' },
    { id: 'email' as Tab, label: 'Email / SMTP', visible: user?.role === 'admin' },
    { id: 'data' as Tab, label: 'Data Management', visible: user?.role === 'admin' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <div className="bg-card border border-border rounded-lg shadow">
        {/* Tabs */}
        <div className="border-b border-border overflow-x-auto">
          <nav className="flex -mb-px min-w-max">
            {tabs
              .filter((tab) => tab.visible)
              .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
        <div className="p-4 sm:p-6">
          {activeTab === 'account' && <AccountSettings />}
          {activeTab === 'preferences' && <PreferencesPage />}
          {activeTab === 'aikey' && <UserAIKeySettings />}
          {activeTab === 'ai' && <AISettingsPage />}
          {activeTab === 'users' && user?.role === 'admin' && <UserManagement />}
          {activeTab === 'email' && user?.role === 'admin' && <EmailSettings />}
          {activeTab === 'data' && user?.role === 'admin' && <DataManagement />}
        </div>
      </div>
    </div>
  );
}
