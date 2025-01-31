'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@headlessui/react';
import CampaignForm from '@/components/CampaignForm';
import { useRouter } from 'next/navigation';
import { FiSearch, FiX } from 'react-icons/fi';
import { BiBarChart, BiEdit, BiPause, BiPlay } from 'react-icons/bi';
import supabase from '@/lib/supabase';
import type { Campaign } from '@/types/campaign';

type CampaignWithState = Campaign & { 
  state: 'Active' | 'Scheduled' | 'Completed';
  progress: number;
  timeText: string;
};

export default function Campaign() {
  const router = useRouter();
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignWithState[]>([]);
  const [selectedState, setSelectedState] = useState<string>('all');
  const [editCampaignId, setEditCampaignId] = useState<number>(0);

  const formatTimeAgo = (date: Date, isEndDate: boolean = false) => {
    const now = new Date();
    const diffTime = Math.abs(date.getTime() - now.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffWeeks > 0) {
      return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''}`;
    }
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const fetchCampaigns = async () => {
    const userDetails = localStorage.getItem('userDetails');
    if (!userDetails) return;
    
    const { customerId } = JSON.parse(userDetails);
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('customerid', customerId)
      .eq('isdeleted', false)
      .order('startdate', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns:', error);
      return;
    }

    const currentDate = new Date();
    const currentDateStr = currentDate.toISOString().split('T')[0];

    const processedCampaigns = data.map(campaign => {
      const startDate = new Date(campaign.startdate);
      const endDate = new Date(campaign.enddate);
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      let state: 'Active' | 'Scheduled' | 'Completed' = 'Scheduled';
      let progress = 0;
      let timeText = '';

      // Determine state and progress
      if (currentDateStr >= startDateStr && currentDateStr <= endDateStr) {
        state = 'Active';
        const totalDuration = endDate.getTime() - startDate.getTime();
        const elapsed = currentDate.getTime() - startDate.getTime();
        progress = Math.min(Math.round((elapsed / totalDuration) * 100), 100);

        if (isSameDay(currentDate, startDate)) {
          timeText = 'Started Today';
        } else {
          timeText = `Started ${formatTimeAgo(startDate)} ago`;
        }

        if (isSameDay(currentDate, endDate)) {
          timeText = 'Will End Today';
        }
      } else if (currentDateStr < startDateStr) {
        state = 'Scheduled';
        progress = 0;

        if (isSameDay(currentDate, startDate)) {
          timeText = 'Starts Today';
        } else {
          timeText = `Starts in ${formatTimeAgo(startDate)}`;
        }
      } else if (currentDateStr > endDateStr) {
        state = 'Completed';
        progress = 100;

        if (isSameDay(currentDate, endDate)) {
          timeText = 'Ended Today';
        } else {
          timeText = `Ended ${formatTimeAgo(endDate)} ago`;
        }
      }

      return { ...campaign, state, progress, timeText };
    });

    setCampaigns(processedCampaigns);
  };

  const handlePlayStateUpdate = async (campaignId: number, newPlayState: boolean) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ playstate: newPlayState })
        .eq('campaignid', campaignId);

      if (error) {
        console.error('Error updating play state:', error);
        return;
      }

      // Immediately refresh the campaign list
      await fetchCampaigns();
    } catch (error) {
      console.error('Error updating play state:', error);
    }
  };

  useEffect(() => {
    const handleCloseDrawer = () => {
      setIsDrawerOpen(false);
      setEditCampaignId(0);
      fetchCampaigns();
    };
    window.addEventListener('closeDrawer', handleCloseDrawer);
    return () => window.removeEventListener('closeDrawer', handleCloseDrawer);
  }, []);

  useEffect(() => {
    const userDetails = localStorage.getItem('userDetails');
    if (!userDetails) {
      router.push('/');
    } else {
      fetchCampaigns();
    }
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      setSearchTags([...searchTags, inputValue.trim()]);
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && searchTags.length > 0) {
      e.preventDefault();
      const newTags = [...searchTags];
      newTags.pop();
      setSearchTags(newTags);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setSearchTags(searchTags.filter(tag => tag !== tagToRemove));
  };

  const clearSearch = () => {
    setSearchTags([]);
    setInputValue('');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Campaigns</h1>
        <button 
          onClick={() => {
            setEditCampaignId(0);
            setIsDrawerOpen(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Create Campaign
        </button>

        {/* Campaign Form Dialog */}
        <Dialog
          open={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          className="fixed inset-0 overflow-hidden z-50"
        >
          <div className="absolute inset-0 overflow-hidden">
            <div className="fixed inset-0 bg-black bg-opacity-40" />

            <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
              <div className="w-screen max-w-md">
                <div className="h-full flex flex-col bg-white shadow-xl">
                  <div className="flex-1 h-0 overflow-y-auto">
                    <div className="p-6">
                      <CampaignForm campaignId={editCampaignId} mediaId={0} />
                    </div>
                  </div>
                  <div className="flex-shrink-0 px-4 py-4 flex justify-end bg-gray-50">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        onClick={() => setIsDrawerOpen(false)}
                      >
                        Cancel
                      </button>
                      {editCampaignId > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const form = document.getElementById('campaign-form') as HTMLFormElement;
                            const deleteButton = form.querySelector('[data-action="delete"]') as HTMLButtonElement;
                            deleteButton?.click();
                          }}
                          className="bg-red-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Delete Campaign
                        </button>
                      )}
                      <button
                        type="submit"
                        form="campaign-form"
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        {editCampaignId ? 'Update Campaign' : 'Create Campaign'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="flex space-x-4 mb-4">
          <button 
            onClick={() => setSelectedState('all')}
            className={`text-sm ${selectedState === 'all' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          >
            All Campaigns
          </button>
          <button 
            onClick={() => setSelectedState('Active')}
            className={`text-sm ${selectedState === 'Active' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Active
          </button>
          <button 
            onClick={() => setSelectedState('Scheduled')}
            className={`text-sm ${selectedState === 'Scheduled' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Scheduled
          </button>
          <button 
            onClick={() => setSelectedState('Completed')}
            className={`text-sm ${selectedState === 'Completed' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Completed
          </button>
        </div>
        <div className="relative flex items-center">
          <div className="flex-1 flex flex-wrap gap-2 px-4 py-2 border border-gray-300 rounded-md focus-within:ring-blue-500 focus-within:border-blue-500">
            {searchTags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-1.5 h-4 w-4 flex items-center justify-center"
                >
                  <FiX className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchTags.length === 0 ? "Search campaigns..." : ""}
              className="flex-1 outline-none bg-transparent min-w-[120px] border-none focus:ring-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (inputValue.trim()) {
                  setSearchTags([...searchTags, inputValue.trim()]);
                  setInputValue('');
                }
              }}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <FiSearch className="w-5 h-5" />
            </button>
            {(searchTags.length > 0 || inputValue) && (
              <button
                onClick={clearSearch}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <FiX className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Campaign Items */}
        {campaigns
          .filter(campaign => {
            // Filter by state
            if (selectedState !== 'all' && campaign.state !== selectedState) {
              return false;
            }
            
            // Filter by search tags
            if (searchTags.length > 0) {
              return searchTags.some(tag => 
                campaign.campaignname.toLowerCase().includes(tag.toLowerCase())
              );
            }
            
            return true;
          })
          .map(campaign => (
            <div key={campaign.campaignid} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{campaign.campaignname}</h3>
                  <p className="text-sm text-gray-500 mt-1">{campaign.state} • {campaign.timeText}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="text-gray-600 hover:text-gray-800">
                    <BiBarChart size={20} />
                  </button>
                  {(campaign.state === 'Active' || campaign.state === 'Scheduled' || campaign.state === 'Completed') && (
                    <button 
                      className="text-gray-600 hover:text-gray-800"
                      onClick={() => {
                        setEditCampaignId(campaign.campaignid);
                        setIsDrawerOpen(true);
                      }}
                    >
                      <BiEdit size={20} />
                    </button>
                  )}
                  {campaign.state === 'Active' && (
                    (campaign.playstate === null || campaign.playstate === true) ? (
                      <button 
                        className="text-gray-600 hover:text-gray-800"
                        onClick={() => handlePlayStateUpdate(campaign.campaignid, false)}
                      >
                        <BiPause size={20} />
                      </button>
                    ) : (
                      <button 
                        className="text-gray-600 hover:text-gray-800"
                        onClick={() => handlePlayStateUpdate(campaign.campaignid, true)}
                      >
                        <BiPlay size={20} />
                      </button>
                    )
                  )}
                </div>
              </div>
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      campaign.state === 'Completed' 
                        ? 'bg-green-600' 
                        : campaign.state === 'Active' 
                          ? 'bg-blue-600' 
                          : 'bg-gray-400'
                    }`} 
                    style={{ width: `${campaign.progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {campaign.state === 'Completed' 
                    ? 'Campaign completed'
                    : campaign.state === 'Scheduled'
                      ? 'Not started'
                      : `${campaign.progress}% Completed`}
                </p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
