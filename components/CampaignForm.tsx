"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Select from 'react-select';
import { FiSearch, FiX } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import supabase from '@/lib/supabase';
import { Campaign, CampaignFormProps, CampaignScreen, Media, Screen, Tag } from '@/types/campaign';
import LoadingOverlay from '@/components/LoadingOverlay';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set access token
mapboxgl.accessToken = 'pk.eyJ1IjoicmF4aXRnb2hlbCIsImEiOiJjbGF3MGVhajUwOWQ5M3BwNDgydnBkNmR4In0.9UL0prYTv9r5SBXXUIM-9Q';

export default function CampaignForm({ campaignId, mediaId, isSaving, setIsSaving, setIsDrawerOpen }: CampaignFormProps): React.ReactElement {
  const router = useRouter();
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [media, setMedia] = useState<Media[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [filteredScreens, setFilteredScreens] = useState<Screen[]>([]);
  const [selectedScreens, setSelectedScreens] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilteredOnly, setShowFilteredOnly] = useState(false);
  const [showAllLink, setShowAllLink] = useState(false);
  const screensPerPage = 100;
  const [formData, setFormData] = useState<{
    campaignName: string;
    mediaIds: number[];
    startDate: string;
    endDate: string;
    duration: number;
  }>({
    campaignName: '',
    mediaIds: mediaId ? [mediaId] : [],
    startDate: '',
    endDate: '',
    duration: 7,
  });

  // Map reference
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const popups = useRef<{ [key: string]: mapboxgl.Popup }>({});

  // Handle campaign deletion
  const handleDelete = async () => {
    if (!campaignId) return;

    try {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#6B7280',
        confirmButtonText: 'Yes, delete it!'
      });

      if (result.isConfirmed) {
        const { error } = await supabase
          .from('campaigns')
          .update({ isdeleted: true })
          .eq('campaignid', campaignId);

        if (error) throw error;

        Swal.fire(
          'Deleted!',
          'Campaign has been deleted.',
          'success'
        ).then(() => {
          if (setIsSaving) setIsSaving(false);
          window.dispatchEvent(new Event('closeDrawer'));
        });
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      Swal.fire('Error', 'Failed to delete campaign', 'error');
    }
  };

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [174.7633, -41.2865], // Default to New Zealand's center
      zoom: 8
    });

    // Clean up function
    return () => {
      // Remove all markers and popups
      Object.values(markers.current).forEach(marker => marker.remove());
      Object.values(popups.current).forEach(popup => popup.remove());
      markers.current = {};
      popups.current = {};
      
      // Remove map
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Function to load and update map markers
  const loadMap = () => {
    if (!map.current) return;

    // Remove existing markers and popups
    Object.values(markers.current).forEach(marker => marker.remove());
    Object.values(popups.current).forEach(popup => popup.remove());
    markers.current = {};
    popups.current = {};

    // Add new markers for each screen
    screens.forEach(screen => {
      if (screen.latitude && screen.longitude) {
        // Create popup
        // Create popup element
        const popupElement = document.createElement('div');
        popupElement.className = 'p-2';
        popupElement.innerHTML = `
          <h3 class="font-medium text-sm">${screen.screenname}</h3>
          <p class="text-xs text-gray-600 mt-1">${screen.screenlocation}</p>
          ${screen.tags.length > 0 ? `
            <div class="flex flex-wrap gap-1 mt-2">
              ${screen.tags.map(tag => `
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                  ${tag.tagname}
                </span>
              `).join('')}
            </div>
          ` : ''}
          <button class="mt-2 w-full px-2 py-1 text-xs font-medium text-white ${
            selectedScreens.has(screen.screenid) 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-indigo-600 hover:bg-indigo-700'
          } rounded">
            ${selectedScreens.has(screen.screenid) ? 'Remove from Campaign' : 'Add to Campaign'}
          </button>
        `;

        // Add click handler to the button
        const button = popupElement.querySelector('button');
        if (button) {
          button.addEventListener('click', () => {
            handleScreenSelect(screen.screenid);
            // Close the popup after selection
            popups.current[screen.screenid].remove();
          });
        }

        // Create popup with the element
        const popup = new mapboxgl.Popup({ offset: 25 })
          .setDOMContent(popupElement);

        // Create marker
        const marker = new mapboxgl.Marker({
          color: selectedScreens.has(screen.screenid) ? '#4F46E5' : '#6B7280'
        })
          .setLngLat([screen.longitude, screen.latitude])
          .setPopup(popup)
          .addTo(map.current!);

        // Add click handler to marker element
        marker.getElement().addEventListener('click', () => {
          // Fly to clicked marker with animation
          if (map.current) {
            map.current.flyTo({
              center: [screen.longitude, screen.latitude],
              zoom: 14, // Zoom level when marker is clicked
              duration: 1500 // Animation duration in milliseconds
            });
          }
        });

        // Set visibility based on filteredScreens
        const isVisible = filteredScreens.some(s => s.screenid === screen.screenid);
        marker.getElement().style.display = isVisible ? 'block' : 'none';

        // Store references
        markers.current[screen.screenid] = marker;
        popups.current[screen.screenid] = popup;
      }
    });

    // Fit map bounds to include all markers
    const bounds = new mapboxgl.LngLatBounds();
    screens.forEach(screen => {
      if (screen.latitude && screen.longitude) {
        bounds.extend([screen.longitude, screen.latitude]);
      }
    });
    if (!bounds.isEmpty()) {
      map.current.fitBounds(bounds, { padding: 50 });
    }
  };

  // Update markers when screens, selected screens, or filtered screens change
  useEffect(() => {
    loadMap();
  }, [screens, selectedScreens, filteredScreens]);

  // Load media data
  const loadMediaData = async (customerId: string) => {
    const { data, error } = await supabase
      .from('media')
      .select('mediaid, medianame, customerid, isdeleted')
      .eq('customerid', customerId)
      .eq('isdeleted', false)
      .order('medianame',{ascending: true});

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
        latitude,
        longitude,
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
          latitude: screen.latitude,
          longitude: screen.longitude,
          tags
        };
      });

      setScreens(transformedScreens);
      setFilteredScreens(transformedScreens);
      loadMap();
    }
  };

  // Check user authentication and load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const userDetailsStr = localStorage.getItem('userDetails');
      if (!userDetailsStr) {
        router.push('/');
        return;
      }

      try {
        const userDetails = JSON.parse(userDetailsStr);
        if (userDetails?.customerId) {
          await Promise.all([
            loadMediaData(userDetails.customerId),
            loadScreensData(userDetails.customerId)
          ]);
        }
      } catch (error) {
        console.error('Error parsing user details:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

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
        // Fetch associated media
        const { data: mediaData, error: mediaError } = await supabase
          .from('campaignmedia')
          .select('mediaid')
          .eq('campaignid', campaignId)
          .eq('isdeleted', false);

        if (mediaError) {
          console.error('Error fetching campaign media:', mediaError);
          return;
        }

        setFormData({
          campaignName: campaignData.campaignname,
          mediaIds: mediaData ? mediaData.map(m => m.mediaid) : [],
          startDate: campaignData.startdate,
          endDate: campaignData.enddate,
          duration: campaignData.duration || 7,
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
      if (!showFilteredOnly) {
        handleSearchWithTags(newTags, '');
      }
    } else if (e.key === 'Backspace' && !searchTerm && searchTags.length > 0) {
      e.preventDefault();
      const newTags = [...searchTags];
      newTags.pop();
      setSearchTags(newTags);
      // Search with updated tags
      if (!showFilteredOnly) {
        handleSearchWithTags(newTags, '');
      }
    }
  };

  // Remove a specific tag
  const removeTag = (tagToRemove: string) => {
    const newTags = searchTags.filter(tag => tag !== tagToRemove);
    setSearchTags(newTags);
    // Search with updated tags
    if (!showFilteredOnly) {
      handleSearchWithTags(newTags, searchTerm);
    }
  };

  // Helper function to handle search with given tags and term
  const handleSearchWithTags = (tags: string[], term: string) => {
    if (tags.length === 0 && !term.trim()) {
      setFilteredScreens(screens);
      // Show all markers
      Object.values(markers.current).forEach(marker => {
        marker.getElement().style.display = 'block';
      });
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

    // Update marker visibility based on search results
    Object.entries(markers.current).forEach(([screenId, marker]) => {
      const isVisible = filtered.some(s => s.screenid === screenId);
      marker.getElement().style.display = isVisible ? 'block' : 'none';
    });
  };

  // Handle screen search button click
  const handleSearch = () => {
    if (!showFilteredOnly) {
      handleSearchWithTags(searchTags, searchTerm);
    }
  };

  // Handle search clear
  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchTags([]);
    if (!showFilteredOnly) {
      setFilteredScreens(screens);
      // Show all markers
      Object.values(markers.current).forEach(marker => {
        marker.getElement().style.display = 'block';
      });
    }
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

    // Update marker color
    const marker = markers.current[screenId];
    if (marker) {
      marker.remove();
      const screen = screens.find(s => s.screenid === screenId);
      if (screen && screen.latitude && screen.longitude) {
        markers.current[screenId] = new mapboxgl.Marker({
          color: newSelected.has(screenId) ? '#4F46E5' : '#6B7280'
        })
          .setLngLat([screen.longitude, screen.latitude])
          .setPopup(popups.current[screenId])
          .addTo(map.current!);
      }
    }
  };

  // Handle select all screens
  const handleSelectAll = () => {
    const newSelected = selectedScreens.size === filteredScreens.length
      ? new Set<string>()
      : new Set(filteredScreens.map(s => s.screenid));
    setSelectedScreens(newSelected);

    // Update all marker colors
    filteredScreens.forEach(screen => {
      const marker = markers.current[screen.screenid];
      if (marker && screen.latitude && screen.longitude) {
        marker.remove();
        markers.current[screen.screenid] = new mapboxgl.Marker({
          color: newSelected.has(screen.screenid) ? '#4F46E5' : '#6B7280'
        })
          .setLngLat([screen.longitude, screen.latitude])
          .setPopup(popups.current[screen.screenid])
          .addTo(map.current!);
      }
    });
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const userDetailsStr = localStorage.getItem('userDetails');
    if (!userDetailsStr) {
      router.push('/');
      return;
    }

    if (setIsSaving) setIsSaving(true);
    try {
      const userDetails = JSON.parse(userDetailsStr);
      const customerId = userDetails?.customerId;
      
      if (!customerId) {
        throw new Error('User details not found');
      }

      // Form validation
      if (formData.mediaIds.length === 0) {
        throw new Error('Please select at least one media file');
      }

      if (!formData.campaignName.trim()) {
        throw new Error('Please enter a campaign name');
      }

      if (!formData.startDate) {
        throw new Error('Please select a start date');
      }

      if (!formData.endDate) {
        throw new Error('Please select an end date');
      }

      if (selectedScreens.size === 0) {
        throw new Error('Please select at least one screen');
      }

      // Check if any selected media is an image file
      const hasImageFile = formData.mediaIds.some(id => {
        const selectedMedia = media.find(item => item.mediaid === id);
        return selectedMedia?.medianame?.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp)$/);
      });

      // Validate duration for image files
      if (hasImageFile && (!formData.duration || formData.duration <= 0)) {
        throw new Error('Please enter a valid playback duration for image files');
      }

      // Validate date range
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      if (endDate < startDate) {
        throw new Error('End date cannot be before start date');
      }

      // Check for campaigns with exact same dates
      const { data: existingCampaigns, error: campaignError } = await supabase
        .from('campaignmedia')
        .select('campaignid')
        .in('mediaid', formData.mediaIds)
        .eq('isdeleted', false)
        .neq('campaignid', campaignId || 0);

      if (campaignError) throw campaignError;

      if (existingCampaigns && existingCampaigns.length > 0) {
        throw new Error('A campaign with these media files already exists');
      }

      if (campaignId > 0) {
        // Update existing campaign
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({
            campaignname: formData.campaignName,
            startdate: formData.startDate,
            enddate: formData.endDate,
            duration: formData.duration,
          })
          .eq('campaignid', campaignId);

        if (updateError) throw updateError;

        // Delete existing screen and media associations
        const { error: deleteScreenError } = await supabase
          .from('campaignscreens')
          .delete()
          .eq('campaignid', campaignId);

        if (deleteScreenError) throw deleteScreenError;

        const { error: deleteMediaError } = await supabase
          .from('campaignmedia')
          .delete()
          .eq('campaignid', campaignId);

        if (deleteMediaError) throw deleteMediaError;
      } else {
        // Create new campaign
        const { data: newCampaign, error: insertError } = await supabase
          .from('campaigns')
          .insert({
            campaignname: formData.campaignName,
            startdate: formData.startDate,
            enddate: formData.endDate,
            customerid: customerId,
            isdeleted: false,
            duration: formData.duration,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        
        if (newCampaign) {
          campaignId = newCampaign.campaignid;
        }
      }

      // Insert new media associations
      if (formData.mediaIds.length > 0) {
        const mediaAssociations = formData.mediaIds.map(mediaId => ({
          campaignid: campaignId,
          mediaid: mediaId,
          isdeleted: false
        }));

        const { error: mediaError } = await supabase
          .from('campaignmedia')
          .insert(mediaAssociations);

        if (mediaError) throw mediaError;
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

      Swal.fire('Success', 'Campaign saved successfully', 'success').then(() => {
        if (setIsSaving) setIsSaving(false);
        window.dispatchEvent(new Event('closeDrawer'));
      });
    } catch (error) {
      console.error('Error saving campaign:', error);
      Swal.fire('Error', 'Failed to save campaign', 'error');
    } finally {
      if (setIsSaving) setIsSaving(false);
    }
  };

  const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

  // Get current page's screens
  const indexOfLastScreen = currentPage * screensPerPage;
  const indexOfFirstScreen = indexOfLastScreen - screensPerPage;
  const currentScreens = filteredScreens.slice(indexOfFirstScreen, indexOfLastScreen);

  return (
    <div className="w-full h-full px-4 md:px-6 relative">
      <LoadingOverlay active={isLoading} />
      <form id="campaign-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Hidden delete button for parent component to trigger */}
        <button
          type="button"
          data-action="delete"
          onClick={handleDelete}
          className="hidden"
        />

        {/* Campaign Name and Media File */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Campaign Name</label>
            <input
              type="text"
              value={formData.campaignName}
              onChange={(e) => setFormData({ ...formData, campaignName: e.target.value })}
              className={inputClasses}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Media File</label>
            <Select
              isMulti
              value={formData.mediaIds.map(id => ({
                value: id,
                label: media.find(item => item.mediaid === id)?.medianame
              }))}
              onChange={(options) => setFormData({ 
                ...formData, 
                mediaIds: options ? options.map(opt => Number(opt.value)) : [] 
              })}
              options={media.map(item => ({
                value: item.mediaid,
                label: item.medianame
              }))}
              isClearable={true}
              isSearchable={true}
              placeholder="Select Media Files"
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
        </div>

        {/* Playback Duration for Image Files */}
        {formData.mediaIds.some(id => media.find(item => item.mediaid === id)?.medianame?.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp)$/)) && (
          <div className="max-w-md">
            <label className="block text-sm font-medium text-gray-700">Playback Duration (in sec.)</label>
            <input
              type="number"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: Math.max(0, parseInt(e.target.value) || 0) })}
              min="0"
              className={inputClasses}
              required
            />
          </div>
        )}

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
          {/* Left Column: Screen Selection */}
          <div className="order-2 lg:order-1">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
              <h2 className="text-lg font-medium text-gray-900">Select Screens</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const selectedOnlyScreens = screens.filter(screen => selectedScreens.has(screen.screenid));
                    setFilteredScreens(selectedOnlyScreens);
                    setShowFilteredOnly(true);
                    setShowAllLink(true);
                    
                    Object.entries(markers.current).forEach(([screenId, marker]) => {
                      const isVisible = selectedOnlyScreens.some(s => s.screenid === screenId);
                      marker.getElement().style.display = isVisible ? 'block' : 'none';
                    });
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  {selectedScreens.size} {selectedScreens.size === 1 ? 'screen' : 'screens'} selected
                </button>
                {showAllLink && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowFilteredOnly(false);
                      setShowAllLink(false);
                      setFilteredScreens(screens);
                      
                      Object.values(markers.current).forEach(marker => {
                        marker.getElement().style.display = 'block';
                      });
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    All
                  </button>
                )}
              </div>
            </div>
            
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
                        onClick={() => removeTag(tag)}
                        className="ml-1.5 h-4 w-4 flex items-center justify-center"
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
                    placeholder="Search screens..."
                    className="flex-1 outline-none bg-transparent min-w-[120px] border-none focus:ring-0"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSearch}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <FiSearch className="w-5 h-5" />
                </button>
                {(searchTags.length > 0 || searchTerm) && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Screen List Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedScreens.size === filteredScreens.length}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Screen Name</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Location</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">Tags</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentScreens.map((screen) => (
                    <tr 
                      key={screen.screenid}
                      className={`${selectedScreens.has(screen.screenid) ? 'bg-indigo-50' : 'hover:bg-gray-50'} cursor-pointer`}
                      onClick={() => {
                        if (map.current && screen.latitude && screen.longitude) {
                          // First remove any existing popups
                          Object.values(popups.current).forEach(popup => popup.remove());
                          
                          // Start the flyTo animation
                          map.current.flyTo({
                            center: [screen.longitude, screen.latitude],
                            zoom: 14,
                            duration: 1500
                          });

                          // Listen for the moveend event
                          const onMoveEnd = () => {
                            // Show popup for this screen
                            popups.current[screen.screenid].addTo(map.current!);
                            // Remove the event listener
                            map.current?.off('moveend', onMoveEnd);
                          };
                          map.current.on('moveend', onMoveEnd);
                        }
                      }}
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedScreens.has(screen.screenid)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleScreenSelect(screen.screenid);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">{screen.screenname}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{screen.screenlocation}</td>
                      <td className="px-4 py-2">
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

          {/* Right Column: Map */}
          <div className="order-1 lg:order-2">
            <div className="sticky top-0">
              <div ref={mapContainer} className="w-full h-[400px] rounded-lg overflow-hidden" />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
