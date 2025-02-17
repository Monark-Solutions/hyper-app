"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import Select from 'react-select';
import { FiSearch, FiX } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import supabase from '@/lib/supabase';
import { Campaign, CampaignFormProps, CampaignScreen, Media, Screen, Tag } from '@/types/campaign';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set access token
mapboxgl.accessToken = 'pk.eyJ1IjoicmF4aXRnb2hlbCIsImEiOiJjbGF3MGVhajUwOWQ5M3BwNDgydnBkNmR4In0.9UL0prYTv9r5SBXXUIM-9Q';

export default function CampaignForm({ campaignId, mediaId }: CampaignFormProps) {
  const router = useRouter();
  // State management
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
    mediaId: number;
    startDate: string;
    endDate: string;
    duration: number;
  }>({
    campaignName: '',
    mediaId: mediaId,
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
    const userDetailsStr = localStorage.getItem('userDetails');
    if (!userDetailsStr) {
      router.push('/');
      return;
    }

    try {
      const userDetails = JSON.parse(userDetailsStr);
      if (userDetails?.customerId) {
        loadMediaData(userDetails.customerId);
        loadScreensData(userDetails.customerId);
      }
    } catch (error) {
      console.error('Error parsing user details:', error);
      router.push('/');
    }
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
        setFormData({
          campaignName: campaignData.campaignname,
          mediaId: campaignData.mediaid,
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

    try {
      const userDetails = JSON.parse(userDetailsStr);
      const customerId = userDetails?.customerId;
      
      if (!customerId) {
        Swal.fire('Error', 'User details not found', 'error');
        return;
      }

      // Form validation
      if (!formData.mediaId) {
        Swal.fire('Error', 'Please select a media file', 'error');
        return;
      }

      if (!formData.campaignName.trim()) {
        Swal.fire('Error', 'Please enter a campaign name', 'error');
        return;
      }

      if (!formData.startDate) {
        Swal.fire('Error', 'Please select a start date', 'error');
        return;
      }

      if (!formData.endDate) {
        Swal.fire('Error', 'Please select an end date', 'error');
        return;
      }

      if (selectedScreens.size === 0) {
        Swal.fire('Error', 'Please select at least one screen', 'error');
        return;
      }

      // Validate duration for image files
      const selectedMedia = media.find(item => item.mediaid === formData.mediaId);
      const isImageFile = selectedMedia?.medianame?.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp)$/);
      if (isImageFile && (!formData.duration || formData.duration <= 0)) {
        Swal.fire('Error', 'Please enter a valid playback duration for image files', 'error');
        return;
      }
      else if(!isImageFile){
        // empty formData.duration for video file
        formData.duration = 0;
      }

      // Validate date range
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      if (endDate < startDate) {
        Swal.fire('Error', 'End date cannot be before start date', 'error');
        return;
      }

      // Check for campaigns with exact same dates
      const { data: existingCampaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('customerid', customerId)
        .eq('mediaid', formData.mediaId)
        .eq('startdate', formData.startDate)
        .eq('enddate', formData.endDate)
        .eq('isdeleted', false)
        .neq('campaignid', campaignId || 0);

      if (campaignError) throw campaignError;

      if (existingCampaigns && existingCampaigns.length > 0) {
        Swal.fire('Error', 'A campaign with these exact dates already exists', 'error');
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
            duration: formData.duration,
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
        // Dispatch custom event to refresh campaign list and close drawer
        window.dispatchEvent(new Event('closeDrawer'));
      });
    } catch (error) {
      console.error('Error saving campaign:', error);
      Swal.fire('Error', 'Failed to save campaign', 'error');
    }
  };

  const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

  // Get current page's screens
  const indexOfLastScreen = currentPage * screensPerPage;
  const indexOfFirstScreen = indexOfLastScreen - screensPerPage;
  const currentScreens = filteredScreens.slice(indexOfFirstScreen, indexOfLastScreen);

  return (
    <div className="w-full h-full px-4 md:px-6">
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
        </div>

        {/* Playback Duration for Image Files */}
        {media.find(item => item.mediaid === formData.mediaId)?.medianame?.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp)$/) && (
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
                    placeholder={searchTags.length === 0 ? "Search screens by name, location or tag. Type term and press enter to search." : ""}
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
              <div className="max-h-[400px] md:max-h-[500px] overflow-y-auto overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="w-[40px] px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectedScreens.size === filteredScreens.length}
                          onChange={handleSelectAll}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="w-[30%] px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Screen Name
                      </th>
                      <th className="w-[35%] px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                        Location
                      </th>
                      <th className="w-[35%] px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tags
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentScreens.map((screen) => (
                      <tr 
                        key={screen.screenid} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={(e) => {
                          // Don't trigger row click when clicking checkbox
                          if ((e.target as HTMLElement).tagName === 'INPUT') return;
                          
                          if (map.current && screen.latitude && screen.longitude) {
                            map.current.flyTo({
                              center: [screen.longitude, screen.latitude],
                              zoom: 14,
                              duration: 1500
                            });
                          }
                        }}
                      >
                        <td className="px-2 md:px-6 py-2 md:py-4">
                          <input
                            type="checkbox"
                            checked={selectedScreens.has(screen.screenid)}
                            onChange={() => handleScreenSelect(screen.screenid)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-2 md:px-6 py-2 md:py-4">
                          <div className="text-sm truncate" title={screen.screenname}>{screen.screenname}</div>
                          <div className="text-xs text-gray-500 truncate md:hidden" title={screen.screenlocation}>{screen.screenlocation}</div>
                        </td>
                        <td className="px-2 md:px-6 py-2 md:py-4 truncate hidden md:table-cell" title={screen.screenlocation}>
                          <span className="text-sm">{screen.screenlocation}</span>
                        </td>
                        <td className="px-2 md:px-6 py-2 md:py-4">
                          <div className="flex flex-wrap gap-1">
                            {screen.tags.map((tag) => (
                              <span
                                key={tag.tagid}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 max-w-[150px] truncate"
                                title={tag.tagname}
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
          </div>

          {/* Right Column: Map */}
          <div className="order-1 lg:order-2 h-[300px] md:h-[400px] lg:h-[600px] bg-gray-100 rounded-lg overflow-hidden">
            <div ref={mapContainer} className="w-full h-full" />
          </div>
        </div>
      </form>
    </div>
  );
}
