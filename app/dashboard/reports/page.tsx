'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Reports() {
  const router = useRouter();

  useEffect(() => {
    const userDetails = localStorage.getItem('userDetails');
    if (!userDetails) {
      router.push('/');
    }
  }, [router]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">Reports</h1>
      <p className="text-gray-600">
        View and generate reports for your campaigns and screens.
      </p>
      <div className="mt-6 space-y-4">
        <div className="border p-4 rounded-lg hover:bg-gray-50 cursor-pointer">
          <h3 className="font-medium text-gray-900">Campaign Performance</h3>
          <p className="text-sm text-gray-500 mt-1">View campaign metrics and analytics</p>
        </div>
        <div className="border p-4 rounded-lg hover:bg-gray-50 cursor-pointer">
          <h3 className="font-medium text-gray-900">Screen Analytics</h3>
          <p className="text-sm text-gray-500 mt-1">Monitor screen engagement and performance</p>
        </div>
        <div className="border p-4 rounded-lg hover:bg-gray-50 cursor-pointer">
          <h3 className="font-medium text-gray-900">Media Insights</h3>
          <p className="text-sm text-gray-500 mt-1">Track media performance and viewer engagement</p>
        </div>
      </div>
    </div>
  );
}
