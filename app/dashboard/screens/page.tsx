'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FiSearch, FiX, FiCheckSquare, FiRefreshCw } from 'react-icons/fi';
import Select from 'react-select';
import supabase from '@/lib/supabase';
import Swal from 'sweetalert2';

interface ScreenDetails {
  screenid: string;
  screenname: string;
  screenlocation: string;
  updatefrequency: string;
  starttime: string;
  endtime: string;
  screenemail: string;
  screenuniqueid: string;
}

interface Tag {
  tagid: number;
  tagname: string;
}

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

export default function Screens() {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [screens, setScreens] = useState<Screen[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedScreens, setSelectedScreens] = useState<number[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  const [screenDetails, setScreenDetails] = useState<ScreenDetails | null>(null);
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

  const handleScreenClick = async (screenId: string) => {
    setSelectedScreenId(screenId);
    
    const { data, error } = await supabase
      .from('screens')
      .select('*')
      .eq('screenid', screenId)
      .single();
    
    if (error) {
      console.error('Error fetching screen details:', error);
      return;
    }

    setScreenDetails(data);
    setIsDrawerOpen(true);
  };

  // Helper function to generate a GUID
  const generateGuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Function to fetch screens data
  const fetchScreens = async () => {
    const userDetailsStr = localStorage.getItem('userDetails');
    if (!userDetailsStr) {
      router.push('/');
      return;
    }

    try {
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
          .eq('isdeleted', false),
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

  const handleUpdateScreen = async () => {
    if (!screenDetails || !selectedScreenId) return;

    const { error } = await supabase
      .from('screens')
      .update({
        screenname: screenDetails.screenname,
        screenlocation: screenDetails.screenlocation,
        updatefrequency: screenDetails.updatefrequency,
        starttime: screenDetails.starttime,
        endtime: screenDetails.endtime,
        screenemail: screenDetails.screenemail,
        screenuniqueid: screenDetails.screenuniqueid,
        updateguid: generateGuid()
      })
      .eq('screenid', selectedScreenId);

    if (error) {
      console.error('Error updating screen:', error);
      Swal.fire('Error', 'Failed to update screen', 'error');
      return;
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
              className="p-2 text-gray-600 hover:text-gray-800"
            >
              <FiCheckSquare className="w-5 h-5" />
            </button>
            <button 
              onClick={fetchScreens}
              className="p-2 text-gray-600 hover:text-gray-800"
            >
              <FiRefreshCw className="w-5 h-5" />
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
                placeholder={searchTerms.length === 0 ? "Search Screens..." : ""}
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
                  <div className="p-4 bg-white border-b flex justify-between items-center">
                    <h2 className="text-xl font-semibold">{screenDetails?.screenname}</h2>
                    <button
                      onClick={() => setIsDrawerOpen(false)}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
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
                          value={timeOptions.find(option => option.value === screenDetails?.starttime)}
                          onChange={(option) => setScreenDetails(prev => prev ? {...prev, starttime: option?.value || ''} : null)}
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
                          value={timeOptions.find(option => option.value === screenDetails?.endtime)}
                          onChange={(option) => setScreenDetails(prev => prev ? {...prev, endtime: option?.value || ''} : null)}
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
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                          type="email"
                          value={screenDetails?.screenemail || ''}
                          onChange={(e) => setScreenDetails(prev => prev ? {...prev, screenemail: e.target.value} : null)}
                          className={inputClasses}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Unique ID</label>
                        <input
                          type="text"
                          value={screenDetails?.screenuniqueid || ''}
                          onChange={(e) => setScreenDetails(prev => prev ? {...prev, screenuniqueid: e.target.value} : null)}
                          className={inputClasses}
                        />
                      </div>

                      <div className="flex gap-4 pt-4">
                        <button
                          onClick={handleRetireScreen}
                          className="flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Retire Screen
                        </button>
                        <button
                          onClick={handleUpdateScreen}
                          className="flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Update Screen
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
