"use client";

import { useEffect, useState } from 'react';
import Select from 'react-select';
import { FiSearch, FiX } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import supabase from '@/lib/supabase';
import { Campaign, CampaignFormProps, CampaignScreen, Media, Screen, Tag } from '@/types/campaign';

export default function CampaignForm({ campaignId, mediaId }: CampaignFormProps) {
  const router = useRouter();
  // State management
  const [media, setMedia] = useState<Media[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [filteredScreens, setFilteredScreens] = useState<Screen[]>([]);
  const [selectedScreens, setSelectedScreens] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [formData, setFormData] = useState<{
    campaignName: string;
    mediaId: number;
    startDate: string;
    endDate: string;
  }>({
    campaignName: '',
    mediaId: mediaId,
    startDate: '',
    endDate: '',
  });

  // Check user authentication
  useEffect(() => {
    const userDetailsStr = localStorage.getItem('userDetails');
    if (!userDetailsStr) {
      router.push('/');
    } else {
      try {
        const userDetails = JSON.parse(userDetailsStr);
        if (userDetails?.customerId) {
          // Load media and screens data
          loadMediaData(userDetails.customerId);
          loadScreensData(userDetails.customerId);
        }
      } catch (error) {
        console.error('Error parsing user details:', error);
        router.push('/');
      }
    }
  }, [router]);

  // Load media data
  const loadMediaData = async (customerId: string) => {
    const { data, error } = await supabase
      .from('media')
      .select('mediaid, medianame, customerid, isdeleted')
      .eq('customerid', customerId)
      .eq('isdeleted', false);

    if (error) {
      console.error('Error fetching media:', error);
      return;
    }

    if (data) {
      const mediaData: Media[] = data.map(item => ({
        mediaid: item.mediaid,
        medianame: item.medianame,
        customerid: item.customerid,
        isdeleted: item.isdeleted
      }));
      setMedia(mediaData);
    }
  };

  // Load screens data
  const loadScreensData = async (customerId: string) => {
    const { data, error } = await supabase
      .from('screens')
      .select(`
        id,
        screenid,
        screenname,
        screenlocation,
        customerid,
        isdeleted,
        screentags:screentags(
          id,
          tagid,
          screenid,
          tags:tags(
            tagid,
            tagname
          )
        )
      `)
      .eq('customerid', customerId)
      .eq('isdeleted', false)
      .order('screenname');

    if (error) {
      console.error('Error fetching screens:', error);
      return;
    }

    if (data) {
      // Transform the data to match our Screen interface
      const transformedScreens: Screen[] = data.map(screen => {
        // Extract and transform tags from the nested structure
        const tags: Tag[] = (screen.screentags || [])
          .filter((t: any) => t.tags) // Filter for valid tag assignments
          .map((t: any) => ({
            tagid: t.tags.tagid,
            tagname: t.tags.tagname
          }));

        return {
          id: screen.id,
          screenid: screen.screenid,
          screenname: screen.screenname,
          screenlocation: screen.screenlocation,
          customerid: screen.customerid,
          isdeleted: screen.isdeleted,
          tags
        };
      });

      setScreens(transformedScreens);
      setFilteredScreens(transformedScreens);
    }
  };

  // Fetch campaign data if editing
  useEffect(() => {
    async function fetchCampaignData() {
      if (campaignId <= 0) return;

      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('campaignid', campaignId)
        .single();

      if (campaignError) {
        console.error('Error fetching campaign:', campaignError);
        return;
      }

      if (campaignData) {
        setFormData({
          campaignName: campaignData.campaignname,
          mediaId: campaignData.mediaid,
          startDate: campaignData.startdate,
          endDate: campaignData.enddate,
        });

        // Fetch associated screens
        const { data: screenData, error: screenError } = await supabase
          .from('campaignscreens')
          .select('screenid')
          .eq('campaignid', campaignId);

        if (screenError) {
          console.error('Error fetching campaign screens:', screenError);
          return;
        }

        if (screenData) {
          const screenIds = new Set(screenData.map(s => s.screenid));
          setSelectedScreens(screenIds);
        }
      }
    }

    fetchCampaignData();
  }, [campaignId]);

  // Handle key events for tag input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault();
      const newTags = [...searchTags, searchTerm.trim()];
      setSearchTags(newTags);
      setSearchTerm('');
      // Search with updated tags
      handleSearchWithTags(newTags, '');
    } else if (e.key === 'Backspace' && !searchTerm && searchTags.length > 0) {
      e.preventDefault();
      const newTags = [...searchTags];
      newTags.pop();
      setSearchTags(newTags);
      // Search with updated tags
      handleSearchWithTags(newTags, '');
    }
  };

  // Remove a specific tag
  const removeTag = (tagToRemove: string) => {
    const newTags = searchTags.filter(tag => tag !== tagToRemove);
    setSearchTags(newTags);
    // Search with updated tags
    handleSearchWithTags(newTags, searchTerm);
  };

  // Helper function to handle search with given tags and term
  const handleSearchWithTags = (tags: string[], term: string) => {
    if (tags.length === 0 && !term.trim()) {
      setFilteredScreens(screens);
      return;
    }

    const allSearchTerms = [...tags];
    if (term.trim()) {
      allSearchTerms.push(term.trim());
    }

    const filtered = screens.filter(screen => 
      allSearchTerms.some(term => {
        const searchLower = term.toLowerCase();
        return screen.screenname.toLowerCase().includes(searchLower) ||
               screen.screenlocation.toLowerCase().includes(searchLower) ||
               screen.tags.some(tag => tag.tagname.toLowerCase().includes(searchLower));
      })
    );

    setFilteredScreens(filtered);
  };

  // Handle screen search button click
  const handleSearch = () => {
    handleSearchWithTags(searchTags, searchTerm);
  };

  // Handle search clear
  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchTags([]);
    setFilteredScreens(screens);
  };

  // Handle screen selection
  const handleScreenSelect = (screenId: string) => {
    const newSelected = new Set(selectedScreens);
    if (newSelected.has(screenId)) {
      newSelected.delete(screenId);
    } else {
      newSelected.add(screenId);
    }
    setSelectedScreens(newSelected);
  };

  // Handle select all screens
  const handleSelectAll = () => {
    if (selectedScreens.size === filteredScreens.length) {
      setSelectedScreens(new Set());
    } else {
      setSelectedScreens(new Set(filteredScreens.map(s => s.screenid)));
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const userDetailsStr = localStorage.getItem('userDetails');
    if (!userDetailsStr) {
      router.push('/');
      return;
    }

    try {
      const userDetails = JSON.parse(userDetailsStr);
      const customerId = userDetails?.customerId;
      
      if (!customerId) {
        Swal.fire('Error', 'User details not found', 'error');
        return;
      }

      if (campaignId > 0) {
        // Update existing campaign
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({
            campaignname: formData.campaignName,
            startdate: formData.startDate,
            enddate: formData.endDate,
          })
          .eq('campaignid', campaignId);

        if (updateError) throw updateError;

        // Delete existing screen associations
        const { error: deleteError } = await supabase
          .from('campaignscreens')
          .delete()
          .eq('campaignid', campaignId);

        if (deleteError) throw deleteError;
      } else {
        // Create new campaign
        const { data: newCampaign, error: insertError } = await supabase
          .from('campaigns')
          .insert({
            campaignname: formData.campaignName,
            mediaid: formData.mediaId,
            startdate: formData.startDate,
            enddate: formData.endDate,
            customerid: customerId,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        
        if (newCampaign) {
          campaignId = newCampaign.campaignid;
        }
      }

      // Insert new screen associations
      if (selectedScreens.size > 0) {
        const screenAssociations = Array.from(selectedScreens).map(screenId => ({
          campaignid: campaignId,
          screenid: screenId,
        }));

        const { error: screenError } = await supabase
          .from('campaignscreens')
          .insert(screenAssociations);

        if (screenError) throw screenError;
      }

      Swal.fire('Success', 'Campaign saved successfully', 'success');
    } catch (error) {
      console.error('Error saving campaign:', error);
      Swal.fire('Error', 'Failed to save campaign', 'error');
    }
  };

  // Handle campaign deletion
  const handleDelete = async () => {
    if (campaignId <= 0) return;

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
      try {
        // Delete campaign screens first
        const { error: screenError } = await supabase
          .from('campaignscreens')
          .delete()
          .eq('campaignid', campaignId);

        if (screenError) throw screenError;

        // Then delete the campaign
        const { error: campaignError } = await supabase
          .from('campaigns')
          .delete()
          .eq('campaignid', campaignId);

        if (campaignError) throw campaignError;

        Swal.fire('Deleted!', 'Campaign has been deleted.', 'success');
      } catch (error) {
        console.error('Error deleting campaign:', error);
        Swal.fire('Error', 'Failed to delete campaign', 'error');
      }
    }
  };

  const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";
  const selectClasses = "mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";
  const searchInputClasses = "w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 pr-20";

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        {campaignId > 0 ? 'Edit Campaign' : 'Create Campaign'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Media File Dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Media File</label>
          <Select
            value={media.find(item => item.mediaid === formData.mediaId)
              ? { value: formData.mediaId, label: media.find(item => item.mediaid === formData.mediaId)?.medianame }
              : null}
            onChange={(option) => setFormData({ ...formData, mediaId: option ? Number(option.value) : 0 })}
            options={media.map(item => ({
              value: item.mediaid,
              label: item.medianame
            }))}
            isDisabled={campaignId > 0 || mediaId > 0}
            isClearable={true}
            isSearchable={true}
            placeholder="Select Media File"
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

        {/* Campaign Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Campaign Name</label>
          <input
            type="text"
            value={formData.campaignName}
            onChange={(e) => setFormData({ ...formData, campaignName: e.target.value })}
            className={inputClasses}
            required
          />
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Start Date</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className={inputClasses}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">End Date</label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className={inputClasses}
              required
            />
          </div>
        </div>

        {/* Screens Section */}
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Select Screens</h2>
          
          {/* Search Box */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <div className="flex flex-wrap gap-2 px-3 py-2 bg-white border border-slate-300 rounded-md focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                {searchTags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1.5 h-4 w-4 flex items-center justify-center hover:text-indigo-900"
                    >
                      <FiX className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={searchTags.length === 0 ? "Search screens..." : ""}
                  className="flex-1 min-w-[120px] outline-none text-sm"
                />
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (searchTerm.trim()) {
                      setSearchTags([...searchTags, searchTerm.trim()]);
                      setSearchTerm('');
                    }
                    handleSearch();
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <FiSearch className="w-5 h-5" />
                </button>
                {(searchTags.length > 0 || searchTerm) && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Screens Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedScreens.size === filteredScreens.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Screen Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tags
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredScreens.map((screen) => (
                  <tr key={screen.screenid}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedScreens.has(screen.screenid)}
                        onChange={() => handleScreenSelect(screen.screenid)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{screen.screenname}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{screen.screenlocation}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {screen.tags.map((tag) => (
                          <span
                            key={tag.tagid}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {tag.tagname}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <div>
            {campaignId > 0 && (
              <button
                type="button"
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Delete this campaign
              </button>
            )}
          </div>
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {campaignId > 0 ? 'Update Campaign' : 'Create Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
}
