'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiSearch } from 'react-icons/fi';
import supabase from '@/lib/supabase';

interface Tag {
  tagid: number;
  tagname: string;
}

interface MediaItem {
  mediaid: number;
  medianame: string;
  associated: boolean;
}

interface MediaTagDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tag: Tag;
  customerId: string;
}

export default function MediaTagDrawer({ isOpen, onClose, tag, customerId }: MediaTagDrawerProps) {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [allSelected, setAllSelected] = useState(false);

  // Filter media based on search tags
  const filterMedia = (items: MediaItem[]) => {
    if (searchTags.length === 0) return items;

    return items.filter(item =>
      searchTags.some(tag =>
        item.medianame.toLowerCase().includes(tag.toLowerCase())
      )
    );
  };

  const filteredMedia = filterMedia(mediaItems);

  // Handle select all checkbox change
  const handleSelectAll = (checked: boolean) => {
    const filteredIds = new Set(filteredMedia.map(item => item.mediaid));
    setAllSelected(checked);
    setMediaItems(items => items.map(item => ({
      ...item,
      associated: filteredIds.has(item.mediaid) ? checked : item.associated
    })));
  };

  // Update allSelected state when filtered items change
  useEffect(() => {
    const allFilteredSelected = filteredMedia.length > 0 && 
      filteredMedia.every(item => item.associated);
    setAllSelected(allFilteredSelected);
  }, [filteredMedia]);

  // Fetch media with association status
  const fetchMediaWithAssociation = async () => {
    try {
      setIsLoading(true);
      // First get all media
      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .select('mediaid, medianame')
        .eq('customerid', customerId)
        .eq('isdeleted', false)
        .order('medianame');

      if (mediaError) throw mediaError;

      // Then get associated media for this tag
      const { data: tagData, error: tagError } = await supabase
        .from('mediatags')
        .select('mediaid')
        .eq('tagid', tag.tagid);

      if (tagError) throw tagError;

      // Create a set of associated media IDs for faster lookup
      const associatedMediaIds = new Set(tagData?.map(t => t.mediaid) || []);

      // Process the data
      const processedData = mediaData.map(item => ({
        mediaid: item.mediaid,
        medianame: item.medianame,
        associated: associatedMediaIds.has(item.mediaid)
      }));

      setMediaItems(processedData);
    } catch (error) {
      console.error('Error fetching media:', error);
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
  const handleCheckboxChange = (mediaid: number) => {
    setMediaItems(items =>
      items.map(item =>
        item.mediaid === mediaid
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
        .from('mediatags')
        .delete()
        .eq('tagid', tag.tagid);

      // Insert new associations
      const newAssociations = mediaItems
        .filter(item => item.associated)
        .map(item => ({
          tagid: tag.tagid,
          mediaid: item.mediaid
        }));

      if (newAssociations.length > 0) {
        const { error } = await supabase
          .from('mediatags')
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

  // Fetch media on mount
  useEffect(() => {
    if (isOpen) {
      fetchMediaWithAssociation();
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
          <div className="w-screen max-w-md">
            <div className="h-full flex flex-col bg-white shadow-xl">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <Dialog.Title className="text-lg font-medium text-gray-900">
                  Associated Media Files - {tag.tagname}
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
                      placeholder={searchTags.length === 0 ? "Type a search term and press Enter ↵" : ""}
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

              {/* Media List */}
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
                  </div>
                ) : (
                  <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Media Name
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                      {filteredMedia.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500">
                            No media files found
                          </td>
                        </tr>
                      ) : (
                        filteredMedia.map((item) => (
                          <tr key={item.mediaid}>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-900">
                              {item.medianame}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <input
                                type="checkbox"
                                checked={item.associated}
                                onChange={() => handleCheckboxChange(item.mediaid)}
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
