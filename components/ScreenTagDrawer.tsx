'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiSearch } from 'react-icons/fi';
import supabase from '@/lib/supabase';

interface Tag {
  tagid: number;
  tagname: string;
}

interface Screen {
  id: number;
  screenname: string;
  screenlocation: string;
  associated: boolean;
}

interface ScreenTagDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tag: Tag;
  customerId: string;
}

export default function ScreenTagDrawer({ isOpen, onClose, tag, customerId }: ScreenTagDrawerProps) {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [allSelected, setAllSelected] = useState(false);

  // Filter screens based on search tags
  const filterScreens = (items: Screen[]) => {
    if (searchTags.length === 0) return items;

    return items.filter(item =>
      searchTags.some(tag => {
        const searchTerm = tag.toLowerCase();
        return (
          item.screenname.toLowerCase().includes(searchTerm) ||
          item.screenlocation.toLowerCase().includes(searchTerm)
        );
      })
    );
  };

  const filteredScreens = filterScreens(screens);

  // Handle select all checkbox change
  const handleSelectAll = (checked: boolean) => {
    const filteredIds = new Set(filteredScreens.map(screen => screen.id));
    setAllSelected(checked);
    setScreens(items => items.map(item => ({
      ...item,
      associated: filteredIds.has(item.id) ? checked : item.associated
    })));
  };

  // Update allSelected state when filtered items change
  useEffect(() => {
    const allFilteredSelected = filteredScreens.length > 0 && 
      filteredScreens.every(screen => screen.associated);
    setAllSelected(allFilteredSelected);
  }, [filteredScreens]);

  // Fetch screens with association status
  const fetchScreensWithAssociation = async () => {
    try {
      setIsLoading(true);
      // First get all screens
      const { data: screenData, error: screenError } = await supabase
        .from('screens')
        .select('id, screenname, screenlocation')
        .eq('customerid', customerId)
        .eq('isdeleted', false)
        .order('screenname');

      if (screenError) throw screenError;

      // Then get associated screens for this tag
      const { data: tagData, error: tagError } = await supabase
        .from('screentags')
        .select('screenid')
        .eq('tagid', tag.tagid);

      if (tagError) throw tagError;

      // Create a set of associated screen IDs for faster lookup
      const associatedScreenIds = new Set(tagData?.map(t => t.screenid) || []);

      // Process the data
      const processedData = screenData.map(screen => ({
        id: screen.id,
        screenname: screen.screenname,
        screenlocation: screen.screenlocation,
        associated: associatedScreenIds.has(screen.id)
      }));

      setScreens(processedData);
    } catch (error) {
      console.error('Error fetching screens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search input
  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchInput.trim()) {
      setSearchTags([...searchTags, searchInput.trim()]);
      setSearchInput('');
    }
  };

  // Handle checkbox change
  const handleCheckboxChange = (id: number) => {
    setScreens(items =>
      items.map(item =>
        item.id === id
          ? { ...item, associated: !item.associated }
          : item
      )
    );
  };

  // Handle save
  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Delete existing associations
      await supabase
        .from('screentags')
        .delete()
        .eq('tagid', tag.tagid);

      // Insert new associations
      const newAssociations = screens
        .filter(item => item.associated)
        .map(item => ({
          tagid: tag.tagid,
          screenid: item.id
        }));

      if (newAssociations.length > 0) {
        const { error } = await supabase
          .from('screentags')
          .insert(newAssociations);

        if (error) throw error;
      }

      onClose();
    } catch (error) {
      console.error('Error saving associations:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchTags([]);
    setSearchInput('');
  };

  // Fetch screens on mount
  useEffect(() => {
    if (isOpen) {
      fetchScreensWithAssociation();
    }
  }, [isOpen]);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 overflow-hidden z-50"
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="fixed inset-0 bg-black bg-opacity-40" />
        
        <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex sm:pl-16">
          <div className="w-screen">
            <div className="h-full flex flex-col bg-white shadow-xl">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <Dialog.Title className="text-lg font-medium text-gray-900">
                  Associated Screens - {tag.tagname}
                </Dialog.Title>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>

              {/* Search */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="relative flex items-center">
                  <div className="flex-1 flex flex-wrap gap-2 px-4 py-2 border border-gray-300 rounded-md focus-within:ring-blue-500 focus-within:border-blue-500">
                    {searchTags.map((term, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {term}
                        <button
                          onClick={() => {
                            setSearchTags(searchTags.filter((_, i) => i !== index));
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
                      onKeyDown={handleSearch}
                      placeholder={searchTags.length === 0 ? "Search Screens by name, location or tag. Type a search term and press Enter ↵" : ""}
                      className="flex-1 min-w-[150px] outline-none border-none focus:ring-0"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (searchInput.trim()) {
                        setSearchTags([...searchTags, searchInput.trim()]);
                        setSearchInput('');
                      }
                    }}
                    className="ml-2 p-2 text-gray-400 hover:text-gray-600"
                  >
                    <FiSearch className="w-5 h-5" />
                  </button>
                  {searchTags.length > 0 && (
                    <button
                      onClick={handleClearSearch}
                      className="ml-2 p-2 text-gray-400 hover:text-gray-600"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Screen List */}
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
                  </div>
                ) : (
                  <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-1/2 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Screen Name
                        </th>
                        <th className="w-2/5 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Location
                        </th>
                        <th className="w-[10%] px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center justify-end">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={(e) => handleSelectAll(e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredScreens.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                            No screens found
                          </td>
                        </tr>
                      ) : (
                        filteredScreens.map((screen) => (
                          <tr key={screen.id}>
                            <td className="px-6 py-4 whitespace-normal text-xs text-gray-900">
                              {screen.screenname}
                            </td>
                            <td className="px-6 py-4 whitespace-normal text-xs text-gray-900">
                              {screen.screenlocation}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <input
                                type="checkbox"
                                checked={screen.associated}
                                onChange={() => handleCheckboxChange(screen.id)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 px-4 py-4 flex justify-end bg-gray-50">
                <button
                  type="button"
                  onClick={onClose}
                  className="mx-4 inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Association'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
