/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { hashPassword, comparePasswords } from '@/utils/password';
import Swal from 'sweetalert2';
import Link from 'next/link';
import Image from 'next/image';
import LoadingOverlay from '@/components/LoadingOverlay';
import { 
  RiDashboardLine, 
  RiMovie2Line, 
  RiMegaphoneLine, 
  RiComputerLine,
  RiFileChartLine,
  RiSettings4Line,
  RiUserLine,
  RiLogoutBoxRLine,
  RiArrowDownSLine,
  RiMenuLine,
  RiCloseLine
} from 'react-icons/ri';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState('/dashboard');
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isManagingUser, setIsManagingUser] = useState(false);
  const [isAddingNewUser, setIsAddingNewUser] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState<{
    username: string;
    useremail: string;
    userrole: number;
    isactive: boolean;
  } | null>(null);
  const [managedUser, setManagedUser] = useState<{
    username: string;
    useremail: string;
    userrole: number;
    isactive: boolean;
  } | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async (username?: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select(`
          username,
          useremail,
          userrole,
          isactive,
          customers!inner(
            customerid
          )
        `)
        .eq('username', username || user?.username)
        .eq('customers.customerid', user.customerId)
        .single();

      if (error) throw error;
      
      const profileInfo = {
        username: data.username,
        useremail: data.useremail || '',
        userrole: data.userrole || 0,
        isactive: data.isactive || false
      };

      if (isManagingUser) {
        setManagedUser(profileInfo);
      } else {
        setProfileData(profileInfo);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setError('Failed to fetch user profile');
    } finally {
      setIsLoading(false);
    }
  }, [user?.username, user?.customerId]);

  useEffect(() => {
    const userDetails = localStorage.getItem('userDetails');
    if (!userDetails) {
      router.push('/');
      return;
    }
    setUser(JSON.parse(userDetails));
  }, [router]);

  // Event listener for user management
  useEffect(() => {
    const handleManageUser = (e: CustomEvent) => {
      if (e.detail) {
        setIsManagingUser(true);
        setIsProfileDrawerOpen(true);
        if (e.detail.user) {
          setIsAddingNewUser(false);
          setManagedUser(e.detail.user);
          fetchUserProfile(e.detail.user.username);
        } else {
          setIsAddingNewUser(true);
          setManagedUser({
            username: '',
            useremail: '',
            userrole: 1,
            isactive: true
          });
        }
      }
    };

    window.addEventListener('manageUser', handleManageUser as EventListener);
    return () => window.removeEventListener('manageUser', handleManageUser as EventListener);
  }, [fetchUserProfile]);

  const handleProfileUpdate = async (e: React.FormEvent, isNewUser: boolean = false) => {
    e.preventDefault();
    if (!user?.username || !profileData) return;

    try {
      setIsLoading(true);
      setError(null);

      // Validate password for new users
      if (isNewUser) {
        if (!passwordData.newPassword || !passwordData.confirmPassword) {
          throw new Error('Password is required for new users');
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (passwordData.newPassword.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }
      }
      
      if (isManagingUser) {
        const userData = {
          useremail: managedUser!.useremail,
          userrole: managedUser!.userrole,
          isactive: managedUser!.isactive
        };

        if (isNewUser) {
          // Hash password for new user
          const hashedPassword = await hashPassword(passwordData.newPassword);

          // Add new user
          const { error } = await supabase
            .from('users')
            .insert([{
              ...userData,
              username: managedUser!.username,
              customerid: user?.customerId,
              isdeleted: false,
              password: hashedPassword
            }]);
          if (error) throw error;

          // Clear password data
          setPasswordData({
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          });
        } else {
          // Update existing user
          const { error } = await supabase
            .from('users')
            .update(userData)
            .eq('username', managedUser!.username);
          if (error) throw error;
        }

        // Emit a custom event to refresh users list
        window.dispatchEvent(new CustomEvent('refreshUsers'));
      } else {
        // Update current user's profile
        const { error } = await supabase
          .from('users')
          .update({
            useremail: profileData!.useremail,
            userrole: profileData!.userrole,
            isactive: profileData!.isactive
          })
          .eq('username', user!.username);
        if (error) throw error;
      }

      const successMessage = isNewUser ? 'User created successfully' : 'Profile updated successfully';
      setSuccess(successMessage);
      setTimeout(() => {
        setSuccess(null);
        if (isManagingUser) {
          setIsProfileDrawerOpen(false);
          setManagedUser(null);
          setIsManagingUser(false);
          setIsAddingNewUser(false);
        }
      }, 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.username) return;

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // First verify current password
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('password')
        .eq('username', user.username)
        .single();

      if (fetchError) throw fetchError;

      const isCurrentPasswordValid = await comparePasswords(
        passwordData.currentPassword,
        userData.password
      );

      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await hashPassword(passwordData.newPassword);

      // Update password
      const { error: updateError } = await supabase
        .from('users')
        .update({
          password: hashedPassword
        })
        .eq('username', user.username);

      if (updateError) throw updateError;

      setSuccess('Password updated successfully. Please login again with your new password.');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      // Show alert and then logout
      setTimeout(async () => {
        await Swal.fire({
          title: 'Password Changed',
          text: 'Please login again with your new password',
          icon: 'success',
          confirmButtonText: 'OK'
        });
        handleLogout();
      }, 1000);
    } catch (error: any) {
      setError(error.message || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userDetails');
    router.push('/');
  };

  const navItems = [
    { name: 'DASHBOARD', icon: RiDashboardLine, path: '/dashboard' },
    { name: 'MEDIA', icon: RiMovie2Line, path: '/dashboard/media' },
    { name: 'CAMPAIGN', icon: RiMegaphoneLine, path: '/dashboard/campaign' },
    { name: 'SCREENS', icon: RiComputerLine, path: '/dashboard/screens' },
    { name: 'REPORTS', icon: RiFileChartLine, path: '/dashboard/reports' },
    { name: 'SETTINGS', icon: RiSettings4Line, path: '/dashboard/settings' },
  ];

  const handleNavigation = (path: string) => {
    setActiveMenu(path);
    setIsMobileMenuOpen(false);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm fixed w-full top-0 z-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex-shrink-0">
                <Image 
                  src="/logo.svg"
                  alt="Company Logo"
                  width={150}
                  height={50}
                  className="logo"
                />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:ml-8 md:flex md:space-x-4 flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeMenu === item.path;
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    prefetch={true}
                    onClick={() => handleNavigation(item.path)}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out
                      ${isActive 
                        ? 'text-blue-600 bg-blue-50' 
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                  >
                    <Icon className="w-5 h-5 mr-2" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-md text-gray-600 hover:text-blue-600 hover:bg-blue-50 focus:outline-none"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <RiCloseLine className="w-6 h-6" />
              ) : (
                <RiMenuLine className="w-6 h-6" />
              )}
            </button>

            <div className="flex items-center">
              <div className="relative">
                <button
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-150 ease-in-out ${
                    isDropdownOpen ? 'bg-blue-50 text-blue-600' : ''
                  }`}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <span>Welcome {user.username}</span>
                  <RiUserLine className="w-5 h-5" />
                  <RiArrowDownSLine className={`w-5 h-5 transition-transform duration-200 ${
                    isDropdownOpen ? 'transform rotate-180' : ''
                  }`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                    <div className="py-1">
                      <button
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          setIsProfileDrawerOpen(true);
                          fetchUserProfile();
                        }}
                      >
                        <RiUserLine className="w-5 h-5 mr-2" />
                        Profile
                      </button>
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <RiLogoutBoxRLine className="w-5 h-5 mr-2" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          <div className={`md:hidden transition-all duration-300 ease-in-out ${
            isMobileMenuOpen 
              ? 'max-h-screen opacity-100 visible'
              : 'max-h-0 opacity-0 invisible'
          }`}>
            <nav className="px-4 pt-2 pb-3 space-y-1 bg-white shadow-lg">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeMenu === item.path;
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    prefetch={true}
                    onClick={() => handleNavigation(item.path)}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out
                      ${isActive 
                        ? 'text-blue-600 bg-blue-50' 
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                  >
                    <Icon className="w-5 h-5 mr-2" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto pt-20 p-4 sm:px-6 lg:px-8">
        <Suspense fallback={<LoadingOverlay />}>
          {children}
        </Suspense>
      </main>

      {/* Profile Drawer */}
      <div
        className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity z-50 ${
          isProfileDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => {
          setIsProfileDrawerOpen(false);
          setIsManagingUser(false);
          setIsAddingNewUser(false);
        }}
      >
        <div
          className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transition-transform duration-300 ease-in-out ${
            isProfileDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex h-full flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {isManagingUser ? (isAddingNewUser ? 'Add New User' : 'Edit User') : 'Profile Settings'}
              </h2>
              <button
                onClick={() => {
                  setIsProfileDrawerOpen(false);
                  setIsManagingUser(false);
                  setIsAddingNewUser(false);
                }}
                className="rounded-md p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                <RiCloseLine className="h-6 w-6" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  {/* Profile Form */}
                  <form className="space-y-6" onSubmit={(e) => handleProfileUpdate(e, isAddingNewUser)}>
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                        Username
                      </label>
                      <input
                        type="text"
                        id="username"
                        name="username"
                        value={(isManagingUser ? managedUser : profileData)?.username || ''}
                        onChange={(e) => {
                          if (isManagingUser && isAddingNewUser) {
                            setManagedUser(prev => ({ ...prev!, username: e.target.value }));
                          }
                        }}
                        disabled={!isManagingUser || !isAddingNewUser}
                        className={`mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm ${
                          isManagingUser && isAddingNewUser ? 'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500' : 'bg-gray-50'
                        }`}
                      />
                    </div>

                    <div>
                      <label htmlFor="useremail" className="block text-sm font-medium text-gray-700">
                        Email
                      </label>
                      <input
                        type="email"
                        id="useremail"
                        name="useremail"
                        value={(isManagingUser ? managedUser : profileData)?.useremail || ''}
                        onChange={(e) => {
                          if (isManagingUser) {
                            setManagedUser(prev => ({ ...prev!, useremail: e.target.value }));
                          } else {
                            setProfileData(prev => ({ ...prev!, useremail: e.target.value }));
                          }
                        }}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="userrole" className="block text-sm font-medium text-gray-700">
                        Role
                      </label>
                      <select
                        id="userrole"
                        name="userrole"
                        value={(isManagingUser ? managedUser : profileData)?.userrole || 0}
                        onChange={(e) => {
                          if (isManagingUser) {
                            setManagedUser(prev => ({ ...prev!, userrole: Number(e.target.value) }));
                          } else {
                            setProfileData(prev => ({ ...prev!, userrole: Number(e.target.value) }));
                          }
                        }}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value={0}>Administrator</option>
                        <option value={1}>Staff</option>
                      </select>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="isactive"
                        name="isactive"
                        checked={(isManagingUser ? managedUser : profileData)?.isactive || false}
                        onChange={(e) => {
                          if (isManagingUser) {
                            setManagedUser(prev => ({ ...prev!, isactive: e.target.checked }));
                          } else {
                            setProfileData(prev => ({ ...prev!, isactive: e.target.checked }));
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="isactive" className="ml-2 block text-sm text-gray-700">
                        Active
                      </label>
                    </div>

                    <div>
                      <button
                        type="submit"
                        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        {isManagingUser 
                          ? (isAddingNewUser ? 'Create User' : 'Update User')
                          : 'Update Profile'
                        }
                      </button>
                    </div>
                  </form>

                  {/* Password Section */}
                  <div className="mt-8 pt-8 border-t border-gray-200">
                    {isManagingUser && isAddingNewUser ? (
                      // New User Password Form
                      <div className="space-y-6">
                        <h3 className="text-lg font-medium text-gray-900">Set Password</h3>
                        <div>
                          <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                            Password
                          </label>
                          <input
                            type="password"
                            id="new-password"
                            name="new-password"
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            required
                            minLength={6}
                          />
                        </div>
                        <div>
                          <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                            Confirm Password
                          </label>
                          <input
                            type="password"
                            id="confirm-password"
                            name="confirm-password"
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            required
                            minLength={6}
                          />
                        </div>
                      </div>
                    ) : (
                      // Change Password Form for Existing Users
                      <>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="show-password-form"
                            checked={showPasswordForm}
                            onChange={(e) => setShowPasswordForm(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="show-password-form" className="ml-2 text-lg font-medium text-gray-900">
                            Change Password
                          </label>
                        </div>
                        <form className={`mt-4 space-y-6 ${showPasswordForm ? 'block' : 'hidden'}`} onSubmit={handlePasswordChange}>
                          <div>
                            <label htmlFor="current-password" className="block text-sm font-medium text-gray-700">
                              Current Password
                            </label>
                            <input
                              type="password"
                              id="current-password"
                              name="current-password"
                              value={passwordData.currentPassword}
                              onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              required
                            />
                          </div>
                          <div>
                            <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                              New Password
                            </label>
                            <input
                              type="password"
                              id="new-password"
                              name="new-password"
                              value={passwordData.newPassword}
                              onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              required
                              minLength={6}
                            />
                          </div>
                          <div>
                            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                              Confirm New Password
                            </label>
                            <input
                              type="password"
                              id="confirm-password"
                              name="confirm-password"
                              value={passwordData.confirmPassword}
                              onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              required
                              minLength={6}
                            />
                          </div>
                          <div>
                            <button
                              type="submit"
                              className="w-full rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                            >
                              Change Password
                            </button>
                          </div>
                        </form>
                      </>
                    )}
                  </div>
                </>
              )}
              
              {/* Notifications */}
              {(error || success) && (
                <div className={`fixed bottom-4 right-4 p-4 rounded-md shadow-lg ${
                  error ? 'bg-red-50 text-red-900' : 'bg-green-50 text-green-900'
                }`}>
                  <p className="text-sm font-medium">
                    {error || success}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
