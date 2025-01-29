'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiSearch, FiX } from 'react-icons/fi';
import { BiBarChart, BiEdit, BiPause, BiPlay, BiRefresh, BiTrash } from 'react-icons/bi';

export default function Campaign() {
  const router = useRouter();
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const userDetails = localStorage.getItem('userDetails');
    if (!userDetails) {
      router.push('/');
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
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Summer Promotion</h3>
              <p className="text-sm text-gray-500 mt-1">Active • Started 3 days ago</p>
            </div>
            <div className="flex items-center space-x-2">
              <button className="text-gray-600 hover:text-gray-800">
                <BiBarChart size={20} />
              </button>
              <button className="text-gray-600 hover:text-gray-800">
                <BiEdit size={20} />
              </button>
              <button className="text-gray-600 hover:text-gray-800">
                <BiPause size={20} />
              </button>
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
              <button className="text-gray-600 hover:text-gray-800">
                <BiBarChart size={20} />
              </button>
              <button className="text-gray-600 hover:text-gray-800">
                <BiEdit size={20} />
              </button>
              <button className="text-gray-600 hover:text-gray-800">
                <BiPlay size={20} />
              </button>
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
              <button className="text-gray-600 hover:text-gray-800">
                <BiBarChart size={20} />
              </button>
              <button className="text-gray-600 hover:text-gray-800">
                <BiRefresh size={20} />
              </button>
              <button className="text-gray-600 hover:text-gray-800">
                <BiTrash size={20} />
              </button>
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
