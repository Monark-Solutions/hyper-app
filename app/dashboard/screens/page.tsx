'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Screens() {
  const router = useRouter();

  useEffect(() => {
    const userDetails = localStorage.getItem('userDetails');
    if (!userDetails) {
      router.push('/');
    }
  }, [router]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">Screens</h1>
      <p className="text-gray-600">
        Manage your screen configurations here.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="border p-4 rounded-lg">
          <h3 className="font-medium text-gray-900">Screen 1</h3>
          <p className="text-sm text-gray-500 mt-1">Status: Active</p>
        </div>
        <div className="border p-4 rounded-lg">
          <h3 className="font-medium text-gray-900">Screen 2</h3>
          <p className="text-sm text-gray-500 mt-1">Status: Inactive</p>
        </div>
        <div className="border p-4 rounded-lg">
          <h3 className="font-medium text-gray-900">Screen 3</h3>
          <p className="text-sm text-gray-500 mt-1">Status: Active</p>
        </div>
      </div>
    </div>
  );
}
