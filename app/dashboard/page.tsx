'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  RiMegaphoneLine, 
  RiComputerLine,
  RiMovie2Line,
  RiEyeLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiTimeLine,
  RiUploadCloud2Line,
  RiCheckboxCircleLine
} from 'react-icons/ri';
import supabase from '@/lib/supabase';

type UserDetails = {
  name: string;
  companyName: string;
  customerId: string;
  username: string;
};

type RecentActivity = {
  activitytype: string;
  recentactivity: string;
  status: string;
};

type DashboardSummary = {
  active_campaigns: number;
  last_month_campaigns: number;
  active_vs_last_month_percent: number;
  campaign_trend: 'Up' | 'Down';
  total_screens: number;
  active_screens: number;
  files_uploaded: number;
  storage_used_kb: number;
  storage_used_mb: number;
  storage_used_gb: number;
  total_views_current_month: number;
  total_views_previous_month: number;
  views_percentage_change: number;
  views_trend: 'Up' | 'Down';
};

export default function Dashboard() {
  const router = useRouter();
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);

  useEffect(() => {
    const storedDetails = localStorage.getItem('userDetails');
    if (!storedDetails) {
      router.push('/');
      return;
    }
    setUserDetails(JSON.parse(storedDetails));
  }, [router]);

  useEffect(() => {
    if (userDetails?.customerId) {
      const fetchDashboardData = async () => {
        try {
          const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          //console.log('Fetching data for customer:', userDetails.customerId);
          const { data, error } = await supabase
            .rpc('get_dashboard_summary', {
              customerid: userDetails.customerId,
              time_zone: timeZone
            });
          
          if (error) {
            console.error('Supabase RPC Error:', error.message, error.details, error.hint);
            return;
          }
          
          if (!data) {
            console.error('No data returned from RPC call');
            return;
          }

          setDashboardData(data);

          // Fetch recent activities
          const { data: activityData, error: activityError } = await supabase
            .rpc('get_recent_activity', {
              customerid_param: userDetails.customerId
            });

          if (activityError) {
            console.error('Recent Activity Error:', activityError);
            return;
          }

          if (activityData) {
            setRecentActivities(activityData);
          }
        } catch (err) {
          console.error('Error in fetchDashboardData:', err);
        }
      };

      fetchDashboardData();
    }
  }, [userDetails]);

  if (!userDetails || !dashboardData) return null;

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
          <p className="mt-4 text-3xl font-semibold text-gray-900">{dashboardData.active_campaigns}</p>
          <div className="mt-2 flex items-center text-sm text-green-600">
            {dashboardData.campaign_trend === 'Up' ? (
              <RiArrowUpLine className="w-4 h-4 mr-1 text-green-600" />
            ) : (
              <RiArrowDownLine className="w-4 h-4 mr-1 text-red-600" />
            )}
            <span>{dashboardData.active_vs_last_month_percent}% from last month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 transform hover:scale-105 transition-transform duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500">Connected Screens</h2>
            <div className="p-2 bg-purple-100 rounded-lg">
              <RiComputerLine className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-semibold text-gray-900">{dashboardData.total_screens}</p>
          <div className="mt-2 flex items-center text-sm text-gray-600">
            <RiCheckboxCircleLine className="w-4 h-4 mr-1 text-green-500" />
            <span>{dashboardData.active_screens} screens active</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 transform hover:scale-105 transition-transform duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500">Media Files</h2>
            <div className="p-2 bg-orange-100 rounded-lg">
              <RiMovie2Line className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-semibold text-gray-900">{dashboardData.files_uploaded}</p>
          <div className="mt-2 flex items-center text-sm text-blue-600">
            <RiUploadCloud2Line className="w-4 h-4 mr-1" />
            <span>{(dashboardData.storage_used_gb ?? 0).toFixed(2)} GB used</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 transform hover:scale-105 transition-transform duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500">Total Views</h2>
            <div className="p-2 bg-green-100 rounded-lg">
              <RiEyeLine className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-semibold text-gray-900">{((dashboardData.total_views_current_month ?? 0) / 1000).toFixed(2)}K</p>
          <div className="mt-2 flex items-center text-sm text-green-600">
            {dashboardData.views_trend === 'Up' ? (
              <RiArrowUpLine className="w-4 h-4 mr-1 text-green-600" />
            ) : (
              <RiArrowDownLine className="w-4 h-4 mr-1 text-red-600" />
            )}
            <span>{dashboardData.views_percentage_change}% from last month</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
        <div className="flex flex-wrap gap-4">
          {recentActivities.map((activity, index) => {
            let Icon = RiMegaphoneLine;
            let bgColor = 'bg-blue-100';
            let textColor = 'text-blue-600';

            if (activity.activitytype === 'screens') {
              Icon = RiComputerLine;
              bgColor = 'bg-purple-100';
              textColor = 'text-purple-600';
            } else if (activity.activitytype === 'media') {
              Icon = RiMovie2Line;
              bgColor = 'bg-orange-100';
              textColor = 'text-orange-600';
            }

            return (
              <div key={index} className="flex items-center space-x-4 min-w-[300px] flex-1">
                <div className={`flex-shrink-0 w-10 h-10 ${bgColor} rounded-full flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${textColor}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{activity.recentactivity}</p>
                  <div className="flex items-center text-sm text-gray-500 mt-1">
                    <RiTimeLine className="w-4 h-4 mr-1" />
                    <span>{activity.status}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
