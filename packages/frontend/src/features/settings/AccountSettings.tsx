import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { userApi } from '@/services/api';

export function AccountSettings() {
  const { user, setUser } = useAuthStore();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  // Profile form state
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');

  // Email form state
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [emailPassword, setEmailPassword] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Messages
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!user) return null;

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setErrorMessage('');
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    successTimeoutRef.current = setTimeout(() => setSuccessMessage(''), 5000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setSuccessMessage('');
  };

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError('Image must be less than 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const response = await userApi.uploadProfilePhoto(file);
      setUser(response.data.user);
      showSuccess('Profile photo updated successfully');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await userApi.updateProfile({ firstName, lastName });
      setUser(response.data.user);
      setIsEditingProfile(false);
      showSuccess('Profile updated successfully');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to update profile');
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !emailPassword) {
      showError('Please fill in all fields');
      return;
    }

    try {
      const response = await userApi.updateEmail({ email: newEmail, password: emailPassword });
      setUser(response.data.user);
      setIsEditingEmail(false);
      setEmailPassword('');
      showSuccess('Email updated successfully');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to update email');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      showError('Please fill in all fields');
      return;
    }

    if (newPassword.length < 8) {
      showError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('New passwords do not match');
      return;
    }

    try {
      await userApi.updatePassword({ currentPassword, newPassword });
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showSuccess('Password changed successfully');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to change password');
    }
  };

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Profile Photo Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Profile Photo</h2>
        <div className="flex items-center gap-6">
          <div className="relative">
            {user.profilePhotoUrl ? (
              <img
                src={user.profilePhotoUrl}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover border-2 border-border"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-semibold border-2 border-border">
                {(user.firstName?.[0] || user.username[0]).toUpperCase()}
              </div>
            )}
            {uploadingPhoto && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfilePhotoChange}
              className="hidden"
              aria-label="Upload profile photo"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
            </button>
            <p className="text-sm text-muted-foreground mt-2">
              JPG, PNG, GIF or WebP. Max 5MB.
            </p>
          </div>
        </div>
      </div>

      {/* Profile Information Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Profile Information</h2>
          {!isEditingProfile && (
            <button
              onClick={() => {
                setFirstName(user.firstName || '');
                setLastName(user.lastName || '');
                setIsEditingProfile(true);
              }}
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Edit
            </button>
          )}
        </div>

        {isEditingProfile ? (
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label htmlFor="profile-first-name" className="block text-sm font-medium text-foreground mb-1">First Name</label>
              <input
                id="profile-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="profile-last-name" className="block text-sm font-medium text-foreground mb-1">Last Name</label>
              <input
                id="profile-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">First Name</label>
              <div className="text-foreground">{user.firstName || 'Not set'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Last Name</label>
              <div className="text-foreground">{user.lastName || 'Not set'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Username</label>
              <div className="text-foreground">{user.username}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Role</label>
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary">
                {user.role === 'admin' ? 'Administrator' : 'User'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Email Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Email Address</h2>
          {!isEditingEmail && (
            <button
              onClick={() => {
                setNewEmail(user.email);
                setIsEditingEmail(true);
              }}
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Change Email
            </button>
          )}
        </div>

        {isEditingEmail ? (
          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <div>
              <label htmlFor="email-new" className="block text-sm font-medium text-foreground mb-1">New Email</label>
              <input
                id="email-new"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label htmlFor="email-current-password" className="block text-sm font-medium text-foreground mb-1">
                Current Password (for verification)
              </label>
              <input
                id="email-current-password"
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Update Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingEmail(false);
                  setEmailPassword('');
                }}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="text-foreground">{user.email}</div>
        )}
      </div>

      {/* Change Password Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Password</h2>
          {!isChangingPassword && (
            <button
              onClick={() => setIsChangingPassword(true)}
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Change Password
            </button>
          )}
        </div>

        {isChangingPassword ? (
          <form onSubmit={handleChangePassword} className="space-y-4">
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                {errorMessage}
              </div>
            )}
            <div>
              <label htmlFor="pw-current" className="block text-sm font-medium text-foreground mb-1">Current Password</label>
              <input
                id="pw-current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label htmlFor="pw-new" className="block text-sm font-medium text-foreground mb-1">New Password</label>
              <input
                id="pw-new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                minLength={8}
                required
              />
              <p className="text-sm text-muted-foreground mt-1">Must be at least 8 characters</p>
            </div>
            <div>
              <label htmlFor="pw-confirm" className="block text-sm font-medium text-foreground mb-1">Confirm New Password</label>
              <input
                id="pw-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Change Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsChangingPassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p className="text-muted-foreground">••••••••</p>
        )}
      </div>
    </div>
  );
}
