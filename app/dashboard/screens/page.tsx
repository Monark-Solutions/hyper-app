'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FiSearch, FiX, FiCheckSquare, FiRefreshCw } from 'react-icons/fi';
import supabase from '@/lib/supabase';

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

  const filterScreens = useCallback((screen: Screen) => {
    // Filter by status
    if (selectedStatus !== 'all') {
      const isOnline = screen.status.toLowerCase() === 'online';
      if (selectedStatus === 'online' && !isOnline) return false;
      if (selectedStatus === 'offline' && isOnline) return false;
    }
    
    // Filter by search terms (screenname, status, or tags)
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

  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;

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

      // Set flag before fetching to prevent duplicate calls
      didFetch.current = true;

      // Load data in parallel
      Promise.all([
        supabase
          .from('tags')
          .select('*')
          .eq('customerid', userDetails.customerId)
          .eq('isdeleted', false),
        supabase
          .rpc('get_screens', { customer_id: userDetails.customerId })
      ]).then(([tagsResult, screensResult]) => {
        if (!tagsResult.error && tagsResult.data) {
          setTags(tagsResult.data);
        }
        if (!screensResult.error && screensResult.data) {
          setScreens(screensResult.data);
        }
      }).catch(error => {
        console.error('Error loading data:', error);
        router.push('/');
      });
    } catch (error) {
      console.error('Error parsing user details:', error);
      router.push('/');
    }
  }, []); // Empty dependency array since we're using didFetch ref

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Screens</h1>
        <div className="flex gap-2">
          <button className="p-2 text-gray-600 hover:text-gray-800">
            <FiCheckSquare className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-600 hover:text-gray-800">
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
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
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
            <div key={screen.id} className="border p-4 rounded-lg">
              {/* Header with Screen Name and Checkbox */}
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-medium text-gray-900">{screen.screenname}</h3>
                <input
                  type="checkbox"
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
  );
}
