'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Campaign() {
  const router = useRouter();

  useEffect(() => {
    const userDetails = localStorage.getItem('userDetails');
    if (!userDetails) {
      router.push('/');
    }
  }, [router]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Campaigns</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          Create Campaign
        </button>
      </div>

      <div className="mb-6">
        <div className="flex space-x-4 mb-4">
          <button className="text-blue-600 font-medium text-sm">All Campaigns</button>
          <button className="text-gray-500 hover:text-gray-700 text-sm">Active</button>
          <button className="text-gray-500 hover:text-gray-700 text-sm">Scheduled</button>
          <button className="text-gray-500 hover:text-gray-700 text-sm">Completed</button>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search campaigns..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="absolute right-3 top-2.5 text-gray-400">🔍</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Campaign Items */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Summer Promotion</h3>
              <p className="text-sm text-gray-500 mt-1">Active • Started 3 days ago</p>
            </div>
            <div className="flex items-center space-x-2">
              <button className="text-gray-600 hover:text-gray-800">📊</button>
              <button className="text-gray-600 hover:text-gray-800">✏️</button>
              <button className="text-gray-600 hover:text-gray-800">⏸️</button>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '60%' }}></div>
            </div>
            <p className="text-sm text-gray-500 mt-1">60% completed</p>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Holiday Special</h3>
              <p className="text-sm text-gray-500 mt-1">Scheduled • Starts in 5 days</p>
            </div>
            <div className="flex items-center space-x-2">
              <button className="text-gray-600 hover:text-gray-800">📊</button>
              <button className="text-gray-600 hover:text-gray-800">✏️</button>
              <button className="text-gray-600 hover:text-gray-800">▶️</button>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-gray-400 h-2 rounded-full" style={{ width: '0%' }}></div>
            </div>
            <p className="text-sm text-gray-500 mt-1">Not started</p>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Spring Collection</h3>
              <p className="text-sm text-gray-500 mt-1">Completed • Ended 2 weeks ago</p>
            </div>
            <div className="flex items-center space-x-2">
              <button className="text-gray-600 hover:text-gray-800">📊</button>
              <button className="text-gray-600 hover:text-gray-800">🔄</button>
              <button className="text-gray-600 hover:text-gray-800">🗑️</button>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-600 h-2 rounded-full" style={{ width: '100%' }}></div>
            </div>
            <p className="text-sm text-gray-500 mt-1">Campaign completed</p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
          Load More
        </button>
      </div>
    </div>
  );
}
