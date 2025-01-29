'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@headlessui/react';
import { useDropzone } from 'react-dropzone';
import { FiUpload, FiX, FiSearch, FiImage, FiVideo, FiTag, FiTrash2 } from 'react-icons/fi';
import supabase from '@/lib/supabase';

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
  tagassignment?: Array<{
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
          loadMediaItems(userDetails.customerId);
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

  const loadMediaItems = async (customerId: string) => {
    const { data: media, error } = await supabase
      .from('media')
      .select(`
        *,
        tagassignment:tagassignment(
          tagid,
          tags:tags(
            tagname
          )
        )
      `)
      .eq('customerid', customerId)
      .order('uploaddatetime', { ascending: false });

    if (error) {
      console.error('Error loading media:', error);
      // If join fails, try loading media without tags
      const { data: mediaOnly, error: mediaError } = await supabase
        .from('media')
        .select('*')
        .eq('customerid', customerId)
        .order('uploaddatetime', { ascending: false });

      if (!mediaError) {
        setMediaItems(mediaOnly || []);
      }
    } else {
      setMediaItems(media || []);
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
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64String = (e.target?.result as string).split(',')[1];
          // const buffer = Buffer.from(base64String, 'base64');
          // resolve(JSON.stringify({ type: 'Buffer', data: [...buffer] }));
          resolve(base64String)
        };
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        
        video.addEventListener('loadeddata', () => {
          // Seek to 1 second to avoid black frames
          video.currentTime = 1;
        });

        video.addEventListener('seeked', () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext('2d')?.drawImage(video, 0, 0);
          const base64String = canvas.toDataURL('image/jpeg').split(',')[1];
          // const buffer = Buffer.from(base64String, 'base64');
          // resolve(JSON.stringify({ type: 'Buffer', data: [...buffer] }));
          resolve(base64String)
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
      alert('User details not found');
      setIsUploading(false);
      return;
    }

    for (const [index, fileData] of selectedFiles.entries()) {
      try {
        // Upload file to storage
        const { data: storageData, error: storageError } = await supabase.storage
          .from('MediaLibrary')
          .upload(`${customerId}/${fileData.file.name}`, fileData.file);
        
        // Update progress manually since onUploadProgress is not supported
        setUploadProgress(prev => ({
          ...prev,
          [fileData.file.name]: 100
        }));

        if (storageError) throw storageError;

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
            elementid: mediaData[0].mediaid,
            elementtype: 0
          }));

          const { error: tagError } = await supabase
            .from('tagassignment')
            .insert(tagAssignments);

          if (tagError) throw tagError;
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        alert(`Error uploading ${fileData.name}`);
      }
    }

    setIsUploading(false);
    setSelectedFiles([]);
    setSelectedTags([]);
    setIsDrawerOpen(false);
    loadMediaItems(customerId); // Reload media items after successful upload
    alert('Files uploaded successfully!');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Media Library</h1>
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <FiUpload className="w-4 h-4" />
          Upload Media
        </button>
      </div>

      <div className="mb-6">
        <div className="flex space-x-4 mb-4">
          <button className="text-blue-600 font-medium text-sm">All Media</button>
          <button className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1">
            <FiImage className="w-4 h-4" />
            Images
          </button>
          <button className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1">
            <FiVideo className="w-4 h-4" />
            Videos
          </button>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search media..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
          <FiSearch className="absolute right-3 top-2.5 text-gray-400 w-5 h-5" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {mediaItems.map((item) => (
          <div key={item.mediaid} className="border rounded-lg overflow-hidden">
            <div className="aspect-w-16 aspect-h-9 bg-gray-100 flex items-center justify-center">
              {item.thumbnail ? (
                <img 
                  src={(() => {
                    try {
                      // Try parsing as JSON first
                      //const parsed = JSON.parse(item.thumbnail);
                      return `data:image/jpeg;base64,${item.thumbnail}`;
                    } catch (e) {
                      // If not JSON, assume it's already base64
                      return `data:image/jpeg;base64,${item.thumbnail}`;
                    }
                  })()}
                  alt={item.medianame} 
                  className="object-cover w-full h-full" 
                  onError={(e) => {
                    // If image fails to load, show fallback icon
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
              {item.tagassignment && item.tagassignment.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.tagassignment.map((ta) => (
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

      <div className="mt-6 flex justify-center">
        <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
          Load More
        </button>
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
                                // Delay hiding dropdown to allow click events to fire
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
                        <ul className="mt-3 divide-y divide-gray-200">
                          {selectedFiles.map((file, index) => (
                            <li key={index} className="py-3 flex items-center justify-between">
                              <div className="flex items-center">
                                <img
                                  src={(() => {
                                    try {
                                      // Try parsing as JSON first
                                      const parsed = JSON.parse(file.thumbnail);
                                      return `data:image/jpeg;base64,${Buffer.from(parsed.data).toString('base64')}`;
                                    } catch (e) {
                                      // If not JSON, assume it's already base64
                                      return `data:image/jpeg;base64,${file.thumbnail}`;
                                    }
                                  })()}
                                  alt={file.name}
                                  className="h-10 w-10 object-cover rounded"
                                  onError={(e) => {
                                    // If image fails to load, show generic icon
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
