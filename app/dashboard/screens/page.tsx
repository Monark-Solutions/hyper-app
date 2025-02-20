/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FiSearch, FiX, FiCheckSquare, FiRefreshCw, FiTrash2, FiSend } from 'react-icons/fi';
import { ActionMeta, MultiValue, GroupBase } from 'react-select';
import CreatableSelect from 'react-select/creatable';
import Select from 'react-select';
import supabase from '@/lib/supabase';
import Swal from 'sweetalert2';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface ScreenDetails {
  screenid: string;
  screenname: string;
  screenlocation: string;
  updatefrequency: string;
  starttime: string;
  endtime: string;
  screenemail: string;
  screenuniqueid: string;
  latitude?: string;
  longitude?: string;
  tags?: number[];
  id?: number;
}

interface Tag {
  tagid: number;
  tagname: string;
}

interface Campaign {
  campaignid: number;
  campaignname: string;
  startdate: string;
  enddate: string;
  mediaid: number;
  customerid: number;
  isdeleted: boolean;
  playstate: boolean;
  duration: number;
}

type CampaignWithState = Campaign & { 
  state: 'Active' | 'Scheduled' | 'Completed';
  progress: number;
  timeText: string;
};

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

const processedCampaigns = (campaigns: Campaign[]): CampaignWithState[] => {
  const currentDate = dayjs();

  return campaigns.map(campaign => {
    const startDate = dayjs(campaign.startdate);
    const endDate = dayjs(campaign.enddate);
    
    let state: 'Active' | 'Scheduled' | 'Completed' = 'Scheduled';
    let progress = 0;
    let timeText = '';

    // Determine state and progress
    if (currentDate.isAfter(startDate) && currentDate.isBefore(endDate) || currentDate.isSame(startDate) || currentDate.isSame(endDate)) { // Check if currentDate is between or equal to startDate and endDate
      state = 'Active';
      const totalDuration = endDate.diff(startDate);
      const elapsed = currentDate.diff(startDate);
      progress = Math.min(Math.round((elapsed / totalDuration) * 100), 100);
    
      if (currentDate.isSame(startDate, 'day')) {
        timeText = 'Started Today';
      } else {
        timeText = `Started ${startDate.fromNow()}`;
      }
    
      if (currentDate.isSame(endDate, 'day')) {
        timeText = 'Will End Today';
      }
    } else if (currentDate.isBefore(startDate)) {
      state = 'Scheduled';
      progress = 0;
    
      if (currentDate.isSame(startDate, 'day')) {
        timeText = 'Starts Today';
      } else {
        timeText = `Starts in ${startDate.fromNow()}`;
      }
    } else if (currentDate.isAfter(endDate)) {
      state = 'Completed';
      progress = 100;
    
      if (currentDate.isSame(endDate, 'day')) {
        timeText = 'Ended Today';
      } else {
        timeText = `Ended ${endDate.fromNow()}`;
      }
    }

    return { ...campaign, state, progress, timeText };
  });
};

interface Screen {
  id: number;
  screenid: string;
  screenname: string;
  lastpingdatetime: string;
  version: string;
  status: string;
  filedownload: string;
  screenlocation: string;
  tags: number[];
}

export default function Screens(): React.ReactElement {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [screens, setScreens] = useState<Screen[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedScreens, setSelectedScreens] = useState<number[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'configuration' | 'campaigns'>('configuration');
  const [screenDetails, setScreenDetails] = useState<ScreenDetails | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignWithState[]>([]);
  const screenNameInputRef = useRef<HTMLInputElement>(null);
  const didFetch = useRef(false);

  const timeOptions = [
    '12:00 AM', '12:30 AM', '01:00 AM', '01:30 AM', '02:00 AM', '02:30 AM',
    '03:00 AM', '03:30 AM', '04:00 AM', '04:30 AM', '05:00 AM', '05:30 AM',
    '06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM', '08:00 AM', '08:30 AM',
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM',
    '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM',
    '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM',
    '09:00 PM', '09:30 PM', '10:00 PM', '10:30 PM', '11:00 PM', '11:30 PM'
  ].map(time => ({ value: time, label: time }));

  const filterScreens = useCallback((screen: Screen) => {
    // Filter by status
    if (selectedStatus !== 'all') {
      const isOnline = screen.status.toLowerCase() === 'online';
      if (selectedStatus === 'online' && !isOnline) return false;
      if (selectedStatus === 'offline' && isOnline) return false;
    }
    
    // Filter by search terms
    if (searchTerms.length > 0) {
      return searchTerms.some(term => {
        const termLower = term.toLowerCase();
        return (
          (screen.screenname?.toLowerCase() || '').includes(termLower) ||
          (screen.status?.toLowerCase() || '').includes(termLower) ||
          (screen.screenlocation?.toLowerCase() || '').includes(termLower) ||
          (screen.tags && tags?.some(tag => 
            tag?.tagname && 
            screen.tags.includes(tag.tagid) && 
            tag.tagname.toLowerCase().includes(termLower)
          )) || false
        );
      });
    }
    
    return true;
  }, [selectedStatus, searchTerms, tags]);

  const toggleAllScreens = useCallback(() => {
    const filteredScreens = screens.filter(filterScreens);
    if (selectedScreens.length === filteredScreens.length) {
      setSelectedScreens([]);
    } else {
      setSelectedScreens(filteredScreens.map(screen => screen.id));
    }
  }, [screens, filterScreens, selectedScreens]);

  // Helper function to generate a GUID
  const generateGuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Function to fetch screens data
  const fetchScreens = async (updateSelected: boolean = false) => {
    const userDetailsStr = localStorage.getItem('userDetails');
    if (!userDetailsStr) {
      router.push('/');
      return;
    }

    try {
      // If updateSelected is true, update the updateguid for selected screens
      if (updateSelected && selectedScreens.length > 0) {
        const { error: updateError } = await supabase
          .from('screens')
          .update({ updateguid: generateGuid() })
          .in('id', selectedScreens);

        if (updateError) {
          console.error('Error updating screens:', updateError);
          Swal.fire('Error', 'Failed to update selected screens', 'error');
          return;
        }

        // Clear selected screens after successful update
        setSelectedScreens([]);
      }

      const userDetails = JSON.parse(userDetailsStr);
      if (!userDetails?.customerId) {
        router.push('/');
        return;
      }

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const [tagsResult, screensResult] = await Promise.all([
        supabase
          .from('tags')
          .select('*')
          .eq('customerid', userDetails.customerId)
          .eq('isdeleted', false)
          .order('tagname', { ascending: true }),
        supabase
          .rpc('get_screens', { 
            customer_id: userDetails.customerId,
            time_zone: timeZone
          })
      ]);

      if (!tagsResult.error && tagsResult.data) {
        setTags(tagsResult.data);
      }
      if (!screensResult.error && screensResult.data) {
        setScreens(screensResult.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      router.push('/');
    }
  };

  const loadCampaigns = async (screenId: string) => {
    try {
      const { data, error } = await supabase
        .from('campaignscreens')
        .select(`
          campaigns!inner (
            campaignid,
            campaignname,
            startdate,
            enddate,
            mediaid,
            customerid,
            isdeleted,
            playstate,
            duration
          )
        `)
        .eq('screenid', screenId)
        .eq('campaigns.isdeleted', false) as { data: { campaigns: Campaign }[] | null, error: any };

      if (error) {
        console.error('Error fetching campaigns:', error);
        return;
      }

      if (!data) {
        setCampaigns([]);
        return;
      }

      const campaignsList = data?.map(item => item.campaigns) || [];
      const processedList = processedCampaigns(campaignsList);
      setCampaigns(processedList);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  };

  const handleDeleteCampaign = async (campaignId: number) => {
    try {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
      });

      if (result.isConfirmed) {
        const { error } = await supabase
          .from('campaignscreens')
          .delete()
          .eq('campaignid', campaignId)
          .eq('screenid', screenDetails?.screenid);

        if (error) {
          console.error('Error deleting campaign:', error);
          Swal.fire('Error', 'Failed to delete campaign', 'error');
          return;
        }

        // Refresh campaigns list
        if (screenDetails?.screenid) {
          loadCampaigns(screenDetails.screenid);
        }

        Swal.fire('Deleted!', 'Campaign has been deleted.', 'success');
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      Swal.fire('Error', 'Failed to delete campaign', 'error');
    }
  };

  const handleScreenClick = async (screenId: string) => {
    setSelectedScreenId(screenId);
    setActiveTab('configuration'); // Reset to configuration tab when opening drawer
    
    try {
      // First get the screen details to get the id
      const { data: screenData, error: screenError } = await supabase
        .from('screens')
        .select('*')
        .eq('screenid', screenId)
        .single();
    
      if (screenError) {
        console.error('Error fetching screen details:', screenError);
        return;
      }

      // Then get the tags using the numeric id
      const { data: tagData, error: tagError } = await supabase
        .from('screentags')
        .select('tagid')
        .eq('screenid', screenData.id);

      if (tagError) {
        console.error('Error fetching screen tags:', tagError);
        return;
      }

      const screenDetailsWithTags = {
        ...screenData,
        tags: tagData.map(t => t.tagid)
      };
      console.log('Setting screen details with tags:', screenDetailsWithTags);
      console.log('Available tags:', tags);
      
      setScreenDetails(screenDetailsWithTags);
      setIsDrawerOpen(true);

      // Load campaigns when screen is opened
      loadCampaigns(screenData.screenid);
    } catch (error) {
      console.error('Error loading screen data:', error);
      Swal.fire('Error', 'Failed to load screen details', 'error');
      return;
    }
  };

  const handleUpdateScreen = async () => {
    if (!screenDetails || !selectedScreenId) return;

    // First update the screen details
    const { error: screenUpdateError } = await supabase
      .from('screens')
      .update({
        screenname: screenDetails.screenname,
        screenlocation: screenDetails.screenlocation,
        updatefrequency: screenDetails.updatefrequency,
        starttime: screenDetails.starttime,
        endtime: screenDetails.endtime,
        screenemail: screenDetails.screenemail,
        screenuniqueid: screenDetails.screenuniqueid,
        latitude: screenDetails.latitude,
        longitude: screenDetails.longitude,
        updateguid: generateGuid()
      })
      .eq('screenid', selectedScreenId);

    if (screenUpdateError) {
      console.error('Error updating screen:', screenUpdateError);
      Swal.fire('Error', 'Failed to update screen', 'error');
      return;
    }

    // Delete existing tag associations using numeric id
    const { error: deleteTagsError } = await supabase
      .from('screentags')
      .delete()
      .eq('screenid', screenDetails.id);

    if (deleteTagsError) {
      console.error('Error deleting existing tags:', deleteTagsError);
      Swal.fire('Error', 'Failed to update screen tags', 'error');
      return;
    }

    // Add new tag associations if there are any tags selected
    if (screenDetails.tags && screenDetails.tags.length > 0) {
      const tagAssociations = screenDetails.tags.map(tagId => ({
        screenid: screenDetails.id,
        tagid: tagId
      }));

      const { error: addTagsError } = await supabase
        .from('screentags')
        .insert(tagAssociations);

      if (addTagsError) {
        console.error('Error adding new tags:', addTagsError);
        Swal.fire('Error', 'Failed to update screen tags', 'error');
        return;
      }
    }

    setIsDrawerOpen(false);
    await fetchScreens(); // Refresh screen list
    Swal.fire('Success', 'Screen updated successfully', 'success');
  };

  const handleRetireScreen = async () => {
    if (!selectedScreenId) return;

    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, retire it!'
    });

    if (result.isConfirmed) {
      const { error } = await supabase
        .from('screens')
        .update({ 
          isdeleted: true,
          updateguid: generateGuid()
        })
        .eq('screenid', selectedScreenId);

      if (error) {
        console.error('Error retiring screen:', error);
        Swal.fire('Error', 'Failed to retire screen', 'error');
        return;
      }

      setIsDrawerOpen(false);
      await fetchScreens(); // Refresh screen list
      Swal.fire('Success', 'Screen retired successfully', 'success');
    }
  };

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    fetchScreens();
  }, [router]);

  // Load campaigns when switching to campaigns tab
  useEffect(() => {
    if (activeTab === 'campaigns' && screenDetails?.screenid) {
      loadCampaigns(screenDetails.screenid);
    }
  }, [activeTab, screenDetails?.screenid]);

  const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

  return (
    <div>
      <div className="bg-white rounded-lg shadow p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Screens</h1>
          <div className="flex gap-2">
            <button 
              onClick={toggleAllScreens}
              className="p-2 text-gray-600 hover:text-gray-800 relative group"
            >
              <FiCheckSquare className="w-5 h-5" />
              <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                Select/Deselect All
              </div>
            </button>
            <button 
              onClick={() => fetchScreens(true)}
              className="p-2 text-gray-600 hover:text-gray-800 relative group"
            >
              <FiSend className="w-5 h-5" />
              <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                Send Update Notification
              </div>
            </button>
            <button 
              onClick={() => fetchScreens(true)}
              className="p-2 text-gray-600 hover:text-gray-800 relative group"
            >
              <FiRefreshCw className="w-5 h-5" />
              <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                Refresh Screens List
              </div>
            </button>
            
          </div>
        </div>

        {/* Status Links */}
        <div className="mb-6">
          <div className="flex space-x-4 mb-4">
            <button 
              onClick={() => setSelectedStatus('all')}
              className={`${selectedStatus === 'all' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'} text-sm`}
            >
              All
            </button>
            <button 
              onClick={() => setSelectedStatus('online')}
              className={`${selectedStatus === 'online' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'} text-sm`}
            >
              Online
            </button>
            <button 
              onClick={() => setSelectedStatus('offline')}
              className={`${selectedStatus === 'offline' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'} text-sm`}
            >
              Offline
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative flex items-center">
            <div className="flex-1 flex flex-wrap gap-2 px-4 py-2 border border-gray-300 rounded-md focus-within:ring-blue-500 focus-within:border-blue-500">
              {searchTerms.map((term, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {term}
                  <button
                    onClick={() => {
                      const newTerms = searchTerms.filter((_, i) => i !== index);
                      setSearchTerms(newTerms);
                    }}
                    className="ml-1.5 h-4 w-4 flex items-center justify-center"
                  >
                    <FiX className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={searchInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' && searchInput.trim()) {
                    e.preventDefault();
                    setSearchTerms([...searchTerms, searchInput.trim()]);
                    setSearchInput('');
                  }
                }}
                placeholder={searchTerms.length === 0 ? "Search screens by name, location or tag. Type a search term and press Enter ↵" : ""}
                className="flex-1 min-w-[150px] outline-none border-none focus:ring-0"
              />
            </div>
            <button
              onClick={() => {
                if (searchInput.trim()) {
                  setSearchTerms([...searchTerms, searchInput.trim()]);
                  setSearchInput('');
                }
              }}
              className="ml-2 p-2 text-gray-400 hover:text-gray-600"
            >
              <FiSearch className="w-5 h-5" />
            </button>
            {searchTerms.length > 0 && (
              <button
                onClick={() => {
                  setSearchTerms([]);
                  setSearchInput('');
                }}
                className="ml-2 p-2 text-gray-400 hover:text-gray-600"
              >
                <FiX className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Screens Grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {screens
            .filter(filterScreens)
            .map((screen) => (
              <div 
                key={screen.id} 
                className="border p-4 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
                onClick={(e) => {
                  // Don't open drawer if clicking checkbox
                  if (e.target instanceof HTMLInputElement && e.target.type === 'checkbox') {
                    return;
                  }
                  handleScreenClick(screen.screenid);
                }}
              >
                {/* Header with Screen Name and Checkbox */}
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-medium text-gray-900">{screen.screenname}</h3>
                  <input
                    type="checkbox"
                    checked={selectedScreens.includes(screen.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedScreens(prev => 
                        prev.includes(screen.id)
                          ? prev.filter(id => id !== screen.id)
                          : [...prev, screen.id]
                      );
                    }}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-[1fr,auto] gap-4">
                  {/* Left Column - Details */}
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-500">
                      <div className={`w-3 h-3 rounded-full mr-2 ${
                        screen.status.toLowerCase() === 'online' 
                          ? 'bg-green-500' 
                          : 'bg-red-500'
                      }`} />
                      <span>{screen.status}</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Last Ping: {new Date(screen.lastpingdatetime).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Version: {screen.version}
                    </p>
                  </div>

                  {/* Right Column - Progress Circle */}
                  <div className="w-14 h-14">
                    {screen.filedownload ? (
                      (() => {
                        const [current, total] = screen.filedownload.split('~').map(Number);
                        const percentage = (current / total) * 100;
                        
                        return (
                          <div 
                            className="w-full h-full rounded-full flex items-center justify-center relative"
                            style={{
                              background: `conic-gradient(#3B82F6 ${percentage}%, transparent ${percentage}%)`,
                            }}
                          >
                            <div className="absolute w-[90%] h-[90%] rounded-full bg-white flex items-center justify-center">
                              <span className="text-[10px] text-gray-600 whitespace-nowrap">
                                {current} of {total}
                              </span>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                        <span className="text-xs text-gray-600">N/A</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {screen.tags && screen.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-4">
                    {screen.tags.map((tagId) => {
                      const tag = tags.find(t => t.tagid === tagId);
                      return tag && (
                        <span
                          key={tag.tagid}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700"
                        >
                          {tag.tagname}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>

      {isDrawerOpen && (
        <div className="fixed inset-0 overflow-hidden z-50">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
              <div className="relative w-screen max-w-md">
                <div className="h-full flex flex-col bg-white shadow-xl">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white relative z-10">
                    <h2 className="text-lg font-medium text-gray-900">{screenDetails?.screenname}</h2>
                    <button
                      onClick={() => setIsDrawerOpen(false)}
                      className="h-7 flex items-center"
                    >
                      <FiX className="w-6 h-6 text-gray-400" />
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="border-b border-gray-200">
                    <nav className="flex -mb-px">
                      <button
                        onClick={() => setActiveTab('configuration')}
                        className={`${
                          activeTab === 'configuration'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm`}
                      >
                        Configuration
                      </button>
                      <button
                        onClick={() => setActiveTab('campaigns')}
                        className={`${
                          activeTab === 'campaigns'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm`}
                      >
                        Campaigns
                      </button>
                    </nav>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto relative z-20 pb-24">
                    {activeTab === 'configuration' && (
                      <div className="p-6 space-y-6 bg-white">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Screen Name</label>
                          <input
                            ref={screenNameInputRef}
                            type="text"
                            value={screenDetails?.screenname || ''}
                            onChange={(e) => setScreenDetails(prev => prev ? {...prev, screenname: e.target.value} : null)}
                            className={inputClasses}
                            autoFocus
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Screen Location</label>
                          <textarea
                            value={screenDetails?.screenlocation || ''}
                            onChange={(e) => setScreenDetails(prev => prev ? {...prev, screenlocation: e.target.value} : null)}
                            className={inputClasses}
                            rows={3}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Tags</label>
                          <CreatableSelect
                            isMulti
                            menuPortalTarget={document.body}
                            styles={{
                              menuPortal: base => ({ ...base, zIndex: 9999 })
                            }}
                            value={tags
                              .filter(tag => screenDetails?.tags?.includes(tag.tagid))
                              .map(tag => ({
                                value: tag.tagid,
                                label: tag.tagname
                              }))}
                            options={tags.map(tag => ({
                              value: tag.tagid,
                              label: tag.tagname
                            }))}
                            onChange={(
                              newValue: MultiValue<{ value: number; label: string }>,
                              _actionMeta: ActionMeta<{ value: number; label: string }>
                            ) => {
                              const selectedTagIds = newValue.map(option => option.value);
                              setScreenDetails(prev => prev ? { ...prev, tags: selectedTagIds } : null);
                            }}
                            onCreateOption={async (inputValue: string) => {
                              const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
                              const customerId = userDetails?.customerId;
                              if (!customerId) return;

                              const { data, error } = await supabase
                                .from('tags')
                                .insert([{ customerid: customerId, tagname: inputValue }])
                                .select();

                              if (!error && data) {
                                const newTag = data[0];
                                setTags([...tags, newTag]);
                                setScreenDetails(prev => prev ? { 
                                  ...prev, 
                                  tags: [...(prev.tags || []), newTag.tagid] 
                                } : null);
                              }
                            }}
                            isClearable
                            classNames={{
                              control: () => 
                                'px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus-within:ring-blue-500 focus-within:border-blue-500',
                              menu: () => 'mt-1 bg-white border border-gray-300 rounded-md shadow-lg',
                              option: ({ isFocused }) => 
                                `px-3 py-2 ${isFocused ? 'bg-gray-100' : 'hover:bg-gray-50'}`,
                              multiValue: () => 
                                'bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-sm font-medium mr-1',
                              multiValueRemove: () => 
                                'ml-1 hover:text-blue-900 cursor-pointer'
                            }}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Update Frequency</label>
                          <input
                            type="text"
                            value={screenDetails?.updatefrequency || ''}
                            onChange={(e) => setScreenDetails(prev => prev ? {...prev, updatefrequency: e.target.value} : null)}
                            className={inputClasses}
                            placeholder="00:00:00"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Start Time</label>
                          <Select
                            menuPortalTarget={document.body}
                            styles={{
                              menuPortal: (base: any) => ({ ...base, zIndex: 9999 })
                            }}
                            value={timeOptions.find(option => option.value === screenDetails?.starttime)}
                            onChange={(option: { value: string; label: string } | null) => 
                              setScreenDetails(prev => prev ? {...prev, starttime: option?.value || ''} : null)
                            }
                            options={timeOptions}
                            className="mt-1"
                            classNames={{
                              control: (state) => 
                                `!border-slate-300 !shadow-sm ${state.isFocused ? '!border-indigo-500 !ring-1 !ring-indigo-500' : ''}`,
                              input: () => "!text-sm",
                              option: () => "!text-sm",
                              placeholder: () => "!text-sm !text-slate-400",
                              singleValue: () => "!text-sm"
                            }}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">End Time</label>
                          <Select
                            menuPortalTarget={document.body}
                            styles={{
                              menuPortal: (base: any) => ({ ...base, zIndex: 9999 })
                            }}
                            value={timeOptions.find(option => option.value === screenDetails?.endtime)}
                            onChange={(option: { value: string; label: string } | null) => 
                              setScreenDetails(prev => prev ? {...prev, endtime: option?.value || ''} : null)
                            }
                            options={timeOptions}
                            className="mt-1"
                            classNames={{
                              control: (state: any) => 
                                `!border-slate-300 !shadow-sm ${state.isFocused ? '!border-indigo-500 !ring-1 !ring-indigo-500' : ''}`,
                              input: () => "!text-sm",
                              option: () => "!text-sm",
                              placeholder: () => "!text-sm !text-slate-400",
                              singleValue: () => "!text-sm"
                            }}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Latitude</label>
                          <input
                            type="text"
                            value={screenDetails?.latitude || ''}
                            onChange={(e) => setScreenDetails(prev => prev ? {...prev, latitude: e.target.value} : null)}
                            className={inputClasses}
                            placeholder="Enter latitude"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Longitude</label>
                          <input
                            type="text"
                            value={screenDetails?.longitude || ''}
                            onChange={(e) => setScreenDetails(prev => prev ? {...prev, longitude: e.target.value} : null)}
                            className={inputClasses}
                            placeholder="Enter longitude"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Email</label>
                          <input
                            type="email"
                            value={screenDetails?.screenemail || ''}
                            onChange={(e) => setScreenDetails(prev => prev ? {...prev, screenemail: e.target.value} : null)}
                            className={inputClasses}
                            placeholder="Enter email address"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Unique ID</label>
                          <input
                            type="text"
                            value={screenDetails?.screenuniqueid || ''}
                            onChange={(e) => setScreenDetails(prev => prev ? {...prev, screenuniqueid: e.target.value} : null)}
                            className={inputClasses}
                            placeholder="Enter unique ID"
                          />
                        </div>

                    </div>
                    )}

                    {activeTab === 'campaigns' && (
                      <div className="p-6 space-y-6">
                        {campaigns.length > 0 ? (
                          campaigns.map((campaign) => (
                            <div
                              key={campaign.campaignid}
                              className="flex items-center justify-between p-4 bg-white border rounded-lg"
                            >
                              <div className="flex-1">
                                <h3 className="font-medium text-gray-900">{campaign.campaignname}</h3>
                                <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                                  <span>Duration: {campaign.duration ? `${campaign.duration}s` : 'Play to end'}</span>
                                  <span className="h-1 w-1 rounded-full bg-gray-300"></span>
                                  <span>{campaign.state}</span>
                                  <span className="h-1 w-1 rounded-full bg-gray-300"></span>
                                  <span>{campaign.timeText}</span>
                                </div>
                                <div className="mt-2">
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full ${
                                        campaign.state === 'Completed' 
                                          ? 'bg-green-600' 
                                          : campaign.state === 'Active' 
                                          ? campaign.playstate === false ? 'bg-yellow-600 bg-opacity-40' : 'bg-blue-650' 
                                            : 'bg-gray-400'
                                      }`} 
                                      style={{ width: `${campaign.progress}%` }}
                                    ></div>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {campaign.state === 'Completed' 
                                      ? 'Campaign completed'
                                      : campaign.state === 'Scheduled'
                                        ? 'Not started'
                                        : `${campaign.progress}% Completed`}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteCampaign(campaign.campaignid)}
                                className="p-2 text-gray-600 hover:text-gray-700"
                              >
                                <FiTrash2 className="w-5 h-5" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-gray-500">No campaigns assigned to this screen</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Fixed Action Buttons */}
                  {activeTab === 'configuration' && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-30">
                      <div className="flex gap-4">
                      <button
                          onClick={handleRetireScreen}
                          className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        >
                          Retire Screen
                        </button>
                        <button
                          onClick={handleUpdateScreen}
                          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          Update Screen
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
