import { useState, useEffect } from 'react';
import { invitationApi, userApi } from '@/services/api';
import type { User, UserRole } from '@nommable/shared';

interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'user';
  expiresAt: string;
  createdAt: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'create' | 'invite'>('create');

  // Create user form
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [role, setRole] = useState<UserRole>('user' as UserRole);
  const [creating, setCreating] = useState(false);

  // Invite user form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'user'>('user');
  const [sending, setSending] = useState(false);

  // Messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersResponse, invitationsResponse] = await Promise.all([
        userApi.getAll(),
        invitationApi.getAll(),
      ]);
      setUsers(usersResponse.data.users);
      setInvitations(invitationsResponse.data);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Username suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (firstName.trim() && lastName.trim()) {
        try {
          const response = await userApi.getUsernameSuggestions(firstName, lastName);
          setUsernameSuggestions(response.data.suggestions);
          if (!username && response.data.suggestions.length > 0) {
            setUsername(response.data.suggestions[0]);
          }
        } catch (err) {
          console.error('Failed to get username suggestions:', err);
        }
      }
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [firstName, lastName]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setGeneratedPassword('');

    if (!email || !firstName || !lastName || !username) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setCreating(true);
      const response = await userApi.create({
        email,
        username,
        firstName,
        lastName,
        role,
      });

      setSuccess(`User created successfully!`);
      setGeneratedPassword(response.data.generatedPassword);

      // Reset form
      setEmail('');
      setFirstName('');
      setLastName('');
      setUsername('');
      setUsernameSuggestions([]);
      setRole('user' as UserRole);

      // Reload users
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setGeneratedPassword('');

    if (!inviteEmail) {
      setError('Please enter an email address');
      return;
    }

    try {
      setSending(true);
      await invitationApi.create({ email: inviteEmail, role: inviteRole });
      setSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('user');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await userApi.delete(userId);
      setSuccess('User deleted successfully');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleRevokeInvitation = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) {
      return;
    }

    try {
      await invitationApi.revoke(id);
      setSuccess('Invitation revoked');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to revoke invitation');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Selector */}
      <div className="border-b border-border">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'create'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Create User
          </button>
          <button
            onClick={() => setActiveTab('invite')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'invite'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Send Invitation
          </button>
        </nav>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md">
          {success}
        </div>
      )}

      {generatedPassword && (
        <div className="p-4 bg-accent/20 border border-accent rounded-md">
          <h3 className="font-semibold text-foreground mb-2">Generated Password</h3>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-background border border-border rounded font-mono text-sm">
              {generatedPassword}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedPassword);
                alert('Password copied to clipboard!');
              }}
              className="px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm"
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Make sure to save this password - it won't be shown again!
          </p>
        </div>
      )}

      {/* Create User Form */}
      {activeTab === 'create' && (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-foreground">Create New User</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-1">
                  First Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="John"
                  required
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-1">
                  Last Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                Email Address <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="user@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1">
                Username <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="johndoe"
                required
              />
              {usernameSuggestions.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Suggestions:</p>
                  <div className="flex flex-wrap gap-2">
                    {usernameSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setUsername(suggestion)}
                        className={`px-2 py-1 text-xs rounded border transition-colors ${
                          username === suggestion
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-foreground border-border hover:border-primary'
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-foreground mb-1">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-muted disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create User'}
            </button>
          </form>
        </div>
      )}

      {/* Send Invitation Form */}
      {activeTab === 'invite' && (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-foreground">Send Invitation</h2>
          <form onSubmit={handleSendInvitation} className="space-y-4">
            <div>
              <label htmlFor="inviteEmail" className="block text-sm font-medium text-foreground mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="inviteEmail"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="user@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="inviteRole" className="block text-sm font-medium text-foreground mb-1">
                Role
              </label>
              <select
                id="inviteRole"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'user')}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-muted disabled:cursor-not-allowed"
            >
              {sending ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="pt-6 border-t border-border">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Users</h2>

        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">No users yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{user.email}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{user.username}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {!user.isSystemAdmin && (
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-destructive hover:text-destructive/80"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {activeTab === 'invite' && (
        <div className="pt-6 border-t border-border">
          <h2 className="text-lg font-semibold mb-4 text-foreground">Pending Invitations</h2>

          {invitations.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No pending invitations</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {invitations.map((invitation) => (
                    <tr key={invitation.id}>
                      <td className="px-4 py-3 text-sm text-foreground">{invitation.email}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            invitation.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {invitation.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => handleRevokeInvitation(invitation.id)}
                          className="text-destructive hover:text-destructive/80"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
