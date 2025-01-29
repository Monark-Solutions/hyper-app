'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  RiMegaphoneLine, 
  RiComputerLine,
  RiMovie2Line,
  RiEyeLine,
  RiArrowUpLine,
  RiTimeLine,
  RiUploadCloud2Line,
  RiCheckboxCircleLine
} from 'react-icons/ri';

type UserDetails = {
  name: string;
  companyName: string;
  customerId: string;
  username: string;
};

export default function Dashboard() {
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
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-3xl font-bold">
          Welcome back, {userDetails.name}!
        </h1>
        <p className="mt-2 text-blue-100">
          Here's an overview of your digital signage operations.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 transform hover:scale-105 transition-transform duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500">Active Campaigns</h2>
            <div className="p-2 bg-blue-100 rounded-lg">
              <RiMegaphoneLine className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-semibold text-gray-900">3</p>
          <div className="mt-2 flex items-center text-sm text-green-600">
            <RiArrowUpLine className="w-4 h-4 mr-1" />
            <span>12% from last month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 transform hover:scale-105 transition-transform duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500">Connected Screens</h2>
            <div className="p-2 bg-purple-100 rounded-lg">
              <RiComputerLine className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-semibold text-gray-900">12</p>
          <div className="mt-2 flex items-center text-sm text-gray-600">
            <RiCheckboxCircleLine className="w-4 h-4 mr-1 text-green-500" />
            <span>All screens active</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 transform hover:scale-105 transition-transform duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500">Media Files</h2>
            <div className="p-2 bg-orange-100 rounded-lg">
              <RiMovie2Line className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-semibold text-gray-900">48</p>
          <div className="mt-2 flex items-center text-sm text-blue-600">
            <RiUploadCloud2Line className="w-4 h-4 mr-1" />
            <span>23.4 GB used</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 transform hover:scale-105 transition-transform duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500">Total Views</h2>
            <div className="p-2 bg-green-100 rounded-lg">
              <RiEyeLine className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-semibold text-gray-900">8.2K</p>
          <div className="mt-2 flex items-center text-sm text-green-600">
            <RiArrowUpLine className="w-4 h-4 mr-1" />
            <span>18% from last month</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <RiMegaphoneLine className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">New campaign "Summer Promotion" started</p>
              <div className="flex items-center text-sm text-gray-500 mt-1">
                <RiTimeLine className="w-4 h-4 mr-1" />
                <span>3 days ago</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <RiComputerLine className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">2 new screens connected</p>
              <div className="flex items-center text-sm text-gray-500 mt-1">
                <RiTimeLine className="w-4 h-4 mr-1" />
                <span>1 week ago</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <RiMovie2Line className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">5 new media files uploaded</p>
              <div className="flex items-center text-sm text-gray-500 mt-1">
                <RiTimeLine className="w-4 h-4 mr-1" />
                <span>1 week ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
