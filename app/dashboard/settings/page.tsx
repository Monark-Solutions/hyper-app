'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type UserDetails = {
  name: string;
  companyName: string;
  customerId: string;
  username: string;
};

export default function Settings() {
  const router = useRouter();
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);

  useEffect(() => {
    const storedDetails = localStorage.getItem('userDetails');
    if (!storedDetails) {
      router.push('/');
      return;
    }
    setUserDetails(JSON.parse(storedDetails));
  }, [router]);

  if (!userDetails) return null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">Settings</h1>
      <div className="space-y-6">
        {/* Profile Section */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <p className="mt-1 text-sm text-gray-900">{userDetails.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Company</label>
              <p className="mt-1 text-sm text-gray-900">{userDetails.companyName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer ID</label>
              <p className="mt-1 text-sm text-gray-900">{userDetails.customerId}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <p className="mt-1 text-sm text-gray-900">{userDetails.username}</p>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Preferences</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Email Notifications</label>
                <p className="text-sm text-gray-500">Receive email updates about your campaigns</p>
              </div>
              <button className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm">
                Configure
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Two-Factor Authentication</label>
                <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
              </div>
              <button className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm">
                Enable
              </button>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Account</h2>
          <div className="space-y-4">
            <button className="text-red-600 hover:text-red-700 text-sm font-medium">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
