'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@headlessui/react';
import { useDropzone } from 'react-dropzone';
import { FiUpload, FiX, FiSearch, FiImage, FiVideo, FiTag, FiTrash2 } from 'react-icons/fi';
import supabase from '@/lib/supabase';
import Swal from 'sweetalert2';

interface Tag {
  tagid: number;
  tagname: string;
}

interface UploadFile {
  file: File;
  thumbnail: string;
  name: string;
  size: string;
  resolution: string;
}

interface MediaItem {
  mediaid: number;
  medianame: string;
  thumbnail: string;
  mediasize: string;
  mediaresolution: string;
  mediatags?: Array<{
    tagid: number;
    tags: {
      tagname: string;
    };
  }>;
}

export default function Media() {
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<UploadFile[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedMediaType, setSelectedMediaType] = useState<'all' | 'image' | 'video'>('all');
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    const userDetailsStr = localStorage.getItem('userDetails');
    if (!userDetailsStr) {
      router.push('/');
    } else {
      try {
        const userDetails = JSON.parse(userDetailsStr);
        if (userDetails?.customerId) {
          // Load existing tags and media
          loadTags(userDetails.customerId);
          loadMediaItems(userDetails.customerId, 1, false, selectedMediaType, searchTerms);
        }
      } catch (error) {
        console.error('Error parsing user details:', error);
        router.push('/');
      }
    }
  }, [router]);

  const loadTags = async (customerId: string) => {
    const { data: tags, error } = await supabase
      .from('tags')
      .select('*')
      .eq('customerid', customerId);

    if (!error && tags) {
      setTags(tags);
    }
  };

  const loadMediaItems = async (
    customerId: string, 
    pageNum = 1, 
    append = false, 
    mediaType: 'all' | 'image' | 'video' = 'all',
    terms: string[] = []
  ) => {
    const start = (pageNum - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from('media')
      .select(`
        *,
        mediatags:mediatags(
          tagid,
          tags:tags(
            tagname
          )
        )
      `, { count: 'exact' })
      .eq('customerid', customerId);

    // Apply media type filter
    if (mediaType !== 'all') {
      const extensions = mediaType === 'image' ? 
        ['.jpg', '.jpeg', '.png', '.gif'] : 
        ['.mp4', '.mov', '.avi'];
      query = query.or(
        extensions.map(ext => `medianame.ilike.%${ext}`).join(',')
      );
    }

    // Apply search terms filter
    if (terms.length > 0) {
      // First get media IDs with matching tags
      const { data: matchingTags } = await supabase
        .from('tags')
        .select('tagid')
        .eq('customerid', customerId)
        .or(terms.map(term => `tagname.ilike.%${term}%`).join(','));

      if (matchingTags && matchingTags.length > 0) {
        const { data: taggedMedia } = await supabase
          .from('mediatags')
          .select('mediaid')
          .in('tagid', matchingTags.map(t => t.tagid));

        // Build the query
        const conditions = [];
        
        // Add media name conditions
        conditions.push(...terms.map(term => `medianame.ilike.%${term}%`));
        
        // Add tagged media condition if any found
        if (taggedMedia && taggedMedia.length > 0) {
          conditions.push(`mediaid.in.(${taggedMedia.map(m => m.mediaid).join(',')})`);
        }
        
        // Apply all conditions
        query = query.or(conditions.join(','));
      } else {
        // If no matching tags, just search in media names
        query = query.or(terms.map(term => `medianame.ilike.%${term}%`).join(','));
      }
    }

    const { data: media, error, count } = await query
      .order('uploaddatetime', { ascending: false })
      .range(start, end);

    if (error) {
      console.error('Error loading media:', error);
      // If join fails, try loading media without tags
      const { data: mediaOnly, error: mediaError } = await supabase
        .from('media')
        .select('*')
        .eq('customerid', customerId)
        .order('uploaddatetime', { ascending: false })
        .range(start, end);

      if (!mediaError) {
        setMediaItems(append ? [...mediaItems, ...(mediaOnly || [])] : (mediaOnly || []));
      }
    } else {
      setMediaItems(append ? [...mediaItems, ...(media || [])] : (media || []));
      setHasMore(count ? (start + ITEMS_PER_PAGE) < count : false);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': [],
      'video/*': []
    },
    onDrop: async (acceptedFiles) => {
      const newFiles = await Promise.all(acceptedFiles.map(async (file) => {
        const thumbnail = await generateThumbnail(file);
        const resolution = await getFileResolution(file);
        return {
          file,
          thumbnail,
          name: file.name,
          size: formatFileSize(file.size),
          resolution
        };
      }));
      setSelectedFiles([...selectedFiles, ...newFiles]);
    }
  });

  const generateThumbnail = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Calculate new dimensions maintaining aspect ratio
          if (width > height) {
            if (width > 280) {
              height = Math.round((height * 280) / width);
              width = 280;
            }
          } else {
            if (height > 280) {
              width = Math.round((width * 280) / height);
              height = 280;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const base64String = canvas.toDataURL('image/jpeg').split(',')[1];
          resolve(base64String);
        };
        img.src = URL.createObjectURL(file);
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        
        video.addEventListener('loadeddata', () => {
          video.currentTime = 1;
        });

        video.addEventListener('seeked', () => {
          let width = video.videoWidth;
          let height = video.videoHeight;
          
          // Calculate new dimensions maintaining aspect ratio
          if (width > height) {
            if (width > 280) {
              height = Math.round((height * 280) / width);
              width = 280;
            }
          } else {
            if (height > 280) {
              width = Math.round((width * 280) / height);
              height = 280;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d')?.drawImage(video, 0, 0, width, height);
          const base64String = canvas.toDataURL('image/jpeg').split(',')[1];
          resolve(base64String);
        });

        video.src = URL.createObjectURL(file);
        video.load();
      }
    });
  };

  const getFileResolution = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => resolve(`${img.width}x${img.height}`);
        img.src = URL.createObjectURL(file);
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.onloadedmetadata = () => {
          resolve(`${video.videoWidth}x${video.videoHeight}`);
        };
        video.src = URL.createObjectURL(file);
      }
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleTagInput = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
      const customerId = userDetails?.customerId;
      if (!customerId) return;
      const existingTag = tags.find(t => t.tagname.toLowerCase() === newTag.toLowerCase());
      
      if (!existingTag) {
        const { data, error } = await supabase
          .from('tags')
          .insert([{ customerid: customerId, tagname: newTag }])
          .select();

        if (!error && data) {
          setTags([...tags, data[0]]);
          setSelectedTags([...selectedTags, data[0]]);
        }
      } else {
        setSelectedTags([...selectedTags, existingTag]);
      }
      setNewTag('');
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
  };

  const uploadFiles = async () => {
    setIsUploading(true);
    const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
    const customerId = userDetails?.customerId;
    if (!customerId) {
      Swal.fire({
        title: 'Error',
        text: 'User details not found',
        icon: 'error'
      });
      setIsUploading(false);
      return;
    }

    const totalFiles = selectedFiles.length;
    let completedFiles = 0;

    for (const [index, fileData] of selectedFiles.entries()) {
      try {
        // Initialize progress for this file
        setUploadProgress(prev => ({
          ...prev,
          [fileData.file.name]: 0
        }));

        // Create a progress tracker that smoothly increases during upload
        let currentProgress = 0;
        const progressInterval = setInterval(() => {
          if (currentProgress < 90) {
            // Faster progress at the start, slower towards the end
            const increment = currentProgress < 30 ? 5 : 
                            currentProgress < 60 ? 3 : 
                            currentProgress < 80 ? 1 : 0.5;
            
            currentProgress += increment;
            setUploadProgress(prev => ({
              ...prev,
              [fileData.file.name]: Math.min(90, currentProgress)
            }));
          }
        }, 100);

        // Perform the actual upload
        const { data: storageData, error: storageError } = await supabase.storage
          .from('MediaLibrary')
          .upload(`${customerId}/${fileData.file.name}`, fileData.file);

        if (storageError) {
          clearInterval(progressInterval);
          throw storageError;
        }

        // Clear interval and set to 95% after successful upload
        clearInterval(progressInterval);
        setUploadProgress(prev => ({
          ...prev,
          [fileData.file.name]: 95
        }));

        // Add record to media table
        const { data: mediaData, error: mediaError } = await supabase
          .from('media')
          .insert([{
            customerid: customerId,
            medianame: fileData.name,
            thumbnail: fileData.thumbnail,
            uploaddatetime: new Date().toISOString(),
            mediasize: fileData.size,
            mediaresolution: fileData.resolution
          }])
          .select();

        if (mediaError) throw mediaError;

        // Add tag assignments
        if (selectedTags.length > 0) {
          const tagAssignments = selectedTags.map(tag => ({
            tagid: tag.tagid,
            mediaid: mediaData[0].mediaid
          }));

          const { error: tagError } = await supabase
            .from('mediatags')
            .insert(tagAssignments);

          if (tagError) throw tagError;
        }

        // Update progress to indicate completion
        setUploadProgress(prev => ({
          ...prev,
          [fileData.file.name]: 100
        }));

        completedFiles++;

      } catch (error) {
        console.error('Error uploading file:', error);
        Swal.fire({
          title: 'Error',
          text: `Error uploading ${fileData.name}`,
          icon: 'error'
        });
      }
    }

    setIsUploading(false);
    setSelectedFiles([]);
    setSelectedTags([]);
    setIsDrawerOpen(false);
    
    // Reset page state and refresh both media and tags
    setPage(1);
    setHasMore(true);
    loadMediaItems(customerId, 1, false, selectedMediaType, searchTerms);
    loadTags(customerId);
    
    Swal.fire({
      title: 'Success',
      text: 'Files uploaded successfully!',
      icon: 'success'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Media Library</h1>
        <button
          onClick={() => {
            setIsDrawerOpen(true);
            setUploadProgress({});
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <FiUpload className="w-4 h-4" />
          Upload Media
        </button>
      </div>

      {/* Filter Buttons */}
      <div className="mb-6">
        <div className="flex space-x-4 mb-4">
          <button 
            onClick={() => {
              setSelectedMediaType('all');
              const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
              loadMediaItems(userDetails?.customerId, 1, false, 'all', searchTerms);
              setPage(1);
            }}
            className={`${selectedMediaType === 'all' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'} text-sm`}
          >
            All Media
          </button>
          <button 
            onClick={() => {
              setSelectedMediaType('image');
              const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
              loadMediaItems(userDetails?.customerId, 1, false, 'image', searchTerms);
              setPage(1);
            }}
            className={`${selectedMediaType === 'image' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'} text-sm flex items-center gap-1`}
          >
            <FiImage className="w-4 h-4" />
            Images
          </button>
          <button 
            onClick={() => {
              setSelectedMediaType('video');
              const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
              loadMediaItems(userDetails?.customerId, 1, false, 'video', searchTerms);
              setPage(1);
            }}
            className={`${selectedMediaType === 'video' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'} text-sm flex items-center gap-1`}
          >
            <FiVideo className="w-4 h-4" />
            Videos
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
                    const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
                    loadMediaItems(userDetails?.customerId, 1, false, selectedMediaType, newTerms);
                    setPage(1);
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
                  const newTerms = [...searchTerms, searchInput.trim()];
                  setSearchTerms(newTerms);
                  setSearchInput('');
                  const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
                  loadMediaItems(userDetails?.customerId, 1, false, selectedMediaType, newTerms);
                  setPage(1);
                }
              }}
              placeholder={searchTerms.length === 0 ? "Search media..." : ""}
              className="flex-1 min-w-[150px] outline-none border-none focus:ring-0"
            />
          </div>
          <button
            onClick={() => {
              if (searchInput.trim()) {
                const newTerms = [...searchTerms, searchInput.trim()];
                setSearchTerms(newTerms);
                setSearchInput('');
                const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
                loadMediaItems(userDetails?.customerId, 1, false, selectedMediaType, newTerms);
                setPage(1);
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
                const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
                loadMediaItems(userDetails?.customerId, 1, false, selectedMediaType, []);
                setPage(1);
              }}
              className="ml-2 p-2 text-gray-400 hover:text-gray-600"
            >
              <FiX className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
        {mediaItems.map((item) => (
          <div key={item.mediaid} className="border rounded-lg overflow-hidden w-[280px]">
            <div className="aspect-w-16 aspect-h-9 bg-gray-100 flex items-center justify-center">
              {item.thumbnail ? (
                <img 
                  src={`data:image/jpeg;base64,${item.thumbnail}`}
                  alt={item.medianame} 
                  className="object-cover w-full h-full" 
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement?.querySelector('.fallback-icon')?.removeAttribute('style');
                  }}
                />
              ) : (
                <div className="fallback-icon" style={{ display: 'none' }}>
                  {item.medianame.toLowerCase().includes('.mp4') ? (
                    <FiVideo className="w-12 h-12 text-gray-400" />
                  ) : (
                    <FiImage className="w-12 h-12 text-gray-400" />
                  )}
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-medium text-gray-900">{item.medianame}</h3>
              <p className="text-sm text-gray-500 mt-1">{item.mediaresolution} • {item.mediasize}</p>
              {item.mediatags && item.mediatags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.mediatags.map((ta) => (
                    <span
                      key={ta.tagid}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {ta.tags.tagname}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Load More Button */}
      <div className="mt-6 flex justify-center">
        {hasMore && (
          <button 
            onClick={() => {
              const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
              const customerId = userDetails?.customerId;
              if (customerId) {
                setPage(prev => prev + 1);
                loadMediaItems(customerId, page + 1, true, selectedMediaType, searchTerms);
              }
            }}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Load More
          </button>
        )}
      </div>

      {/* Upload Drawer */}
      <Dialog
        open={isDrawerOpen}
        onClose={() => !isUploading && setIsDrawerOpen(false)}
        className="fixed inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="fixed inset-0 bg-black bg-opacity-40" />
          
          <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
            <div className="w-screen max-w-md">
              <div className="h-full flex flex-col bg-white shadow-xl">
                <div className="flex-1 h-0 overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <Dialog.Title className="text-lg font-medium text-gray-900">
                        Upload Media
                      </Dialog.Title>
                      <button
                        onClick={() => !isUploading && setIsDrawerOpen(false)}
                        className="ml-3 h-7 flex items-center"
                      >
                        <FiX className="w-6 h-6 text-gray-400" />
                      </button>
                    </div>

                    <div className="mt-6">
                      <div {...getRootProps()} className="border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-blue-500">
                        <input {...getInputProps()} />
                        <div className="text-center">
                          <FiUpload className="mx-auto h-12 w-12 text-gray-400" />
                          <p className="mt-2 text-sm text-gray-600">
                            Drag and drop files here, or click to select files
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Images and videos only
                          </p>
                        </div>
                      </div>

                      <div className="mt-6">
                        <label className="block text-sm font-medium text-gray-700">Tags</label>
                        <div className="mt-1">
                          <div className="relative">
                            <input
                              type="text"
                              value={newTag}
                              onChange={(e) => {
                                setNewTag(e.target.value);
                                const filtered = tags.filter(tag => 
                                  tag.tagname.toLowerCase().includes(e.target.value.toLowerCase()) &&
                                  !selectedTags.some(st => st.tagid === tag.tagid)
                                );
                                setFilteredTags(filtered);
                                setShowTagDropdown(true);
                              }}
                              onKeyDown={handleTagInput}
                              onFocus={() => {
                                const filtered = tags.filter(tag => 
                                  !selectedTags.some(st => st.tagid === tag.tagid)
                                );
                                setFilteredTags(filtered);
                                setShowTagDropdown(true);
                              }}
                              onBlur={() => {
                                setTimeout(() => setShowTagDropdown(false), 200);
                              }}
                              placeholder="Type tag and press Enter"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                            {showTagDropdown && filteredTags.length > 0 && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-auto">
                                {filteredTags.map((tag, index) => (
                                  <div
                                    key={`dropdown-${tag.tagid}-${index}`}
                                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                    onClick={() => {
                                      setSelectedTags([...selectedTags, tag]);
                                      setNewTag('');
                                      setShowTagDropdown(false);
                                    }}
                                  >
                                    {tag.tagname}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedTags.map((tag, index) => (
                            <span
                              key={`${tag.tagid}-${index}`}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {tag.tagname}
                              <button
                                onClick={() => setSelectedTags(selectedTags.filter(t => t.tagid !== tag.tagid))}
                                className="ml-1.5 h-4 w-4 flex items-center justify-center"
                              >
                                <FiX className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-6">
                        <h3 className="text-sm font-medium text-gray-700">Selected Files</h3>
                        {isUploading && (
                          <div className="mb-4">
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div 
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                                style={{ 
                                  width: `${Object.values(uploadProgress).reduce((a, b) => a + b, 0) / selectedFiles.length}%` 
                                }}
                              ></div>
                            </div>
                            <p className="text-sm text-gray-500 mt-1 text-center">
                              Uploading files... {Math.round(Object.values(uploadProgress).reduce((a, b) => a + b, 0) / selectedFiles.length)}%
                            </p>
                          </div>
                        )}
                        <ul className="mt-3 divide-y divide-gray-200">
                          {selectedFiles.map((file, index) => (
                            <li key={index} className="py-3 flex items-center justify-between">
                              <div className="flex items-center">
                                <img
                                  src={`data:image/jpeg;base64,${file.thumbnail}`}
                                  alt={file.name}
                                  className="h-10 w-10 object-cover rounded"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.parentElement?.querySelector('.fallback-icon')?.removeAttribute('style');
                                  }}
                                />
                                <div className="fallback-icon h-10 w-10 bg-gray-100 rounded flex items-center justify-center" style={{ display: 'none' }}>
                                  <FiImage className="w-6 h-6 text-gray-400" />
                                </div>
                                <div className="ml-3">
                                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {file.resolution} • {file.size}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => removeFile(index)}
                                className="ml-4 flex-shrink-0"
                                disabled={isUploading}
                              >
                                <FiTrash2 className="w-5 h-5 text-gray-400 hover:text-red-500" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 px-4 py-4 flex justify-end bg-gray-50">
                  <button
                    type="button"
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={() => !isUploading && setIsDrawerOpen(false)}
                    disabled={isUploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="ml-4 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    onClick={uploadFiles}
                    disabled={isUploading || selectedFiles.length === 0}
                  >
                    {isUploading ? 'Uploading...' : 'Upload Files'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
