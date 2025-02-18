/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import Swal from 'sweetalert2';
import { RiPencilLine, RiDeleteBinLine, RiAddLine, RiUserLine, RiMovie2Line, RiComputerLine } from 'react-icons/ri';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import MediaTagDrawer from '@/components/MediaTagDrawer';
import ScreenTagDrawer from '@/components/ScreenTagDrawer';

type UserDetails = {
  name: string;
  companyName: string;
  customerId: string;
  username: string;
};

type User = {
  username: string;
  useremail: string;
  userrole: number;
  isactive: boolean;
};

type Tag = {
  tagid: number;
  customerid: number;
  tagname: string;
};

export default function Settings() {
  const router = useRouter();
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isUserDrawerOpen, setIsUserDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<number>(1);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [isMediaDrawerOpen, setIsMediaDrawerOpen] = useState(false);
  const [isScreenDrawerOpen, setIsScreenDrawerOpen] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isTagsLoading, setIsTagsLoading] = useState(false);
  const usersPerPage = 10;

  const handleDeleteTag = async (tag: Tag) => {
    try {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: "This tag will be deleted. You can't undo this action.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
      });

      if (result.isConfirmed) {
        // Delete associations from mediatags
        const { error: mediaTagsError } = await supabase
          .from('mediatags')
          .delete()
          .eq('tagid', tag.tagid);

        if (mediaTagsError) throw mediaTagsError;

        // Delete associations from screentags
        const { error: screenTagsError } = await supabase
          .from('screentags')
          .delete()
          .eq('tagid', tag.tagid);

        if (screenTagsError) throw screenTagsError;

        // Set isdeleted = true in tags table
        const { error: tagsError } = await supabase
          .from('tags')
          .update({ isdeleted: true })
          .eq('tagid', tag.tagid)
          .eq('customerid', userDetails?.customerId);

        if (tagsError) throw tagsError;

        await Swal.fire(
          'Deleted!',
          'Tag has been deleted.',
          'success'
        );
        
        fetchTags();
      }
    } catch (err: any) {
      Swal.fire(
        'Error!',
        err.message,
        'error'
      );
    }
  };

  const handleAddTag = async () => {
    try {
      const result = await Swal.fire({
        title: 'Add New Tag',
        input: 'text',
        inputLabel: 'Tag Name',
        inputPlaceholder: 'Enter tag name',
        showCancelButton: true,
        confirmButtonText: 'Save',
        cancelButtonText: 'Cancel',
        inputValidator: (value) => {
          if (!value) {
            return 'Tag name is required';
          }
          return null;
        }
      });

      if (result.isConfirmed && result.value) {
        const { error } = await supabase
          .from('tags')
          .insert([{ 
            tagname: result.value,
            customerid: userDetails?.customerId,
            isdeleted: false
          }]);

        if (error) throw error;

        await Swal.fire(
          'Success!',
          'Tag has been added.',
          'success'
        );
        
        fetchTags();
      }
    } catch (err: any) {
      Swal.fire(
        'Error!',
        err.message,
        'error'
      );
    }
  };

  const handleEditTag = async (tag: Tag) => {
    try {
      const result = await Swal.fire({
        title: 'Edit Tag',
        input: 'text',
        inputLabel: 'Tag Name',
        inputValue: tag.tagname,
        showCancelButton: true,
        confirmButtonText: 'Save',
        cancelButtonText: 'Cancel',
        inputValidator: (value) => {
          if (!value) {
            return 'Tag name is required';
          }
          return null;
        }
      });

      if (result.isConfirmed && result.value) {
        const { error } = await supabase
          .from('tags')
          .update({ tagname: result.value })
          .eq('tagid', tag.tagid)
          .eq('customerid', userDetails?.customerId);

        if (error) throw error;

        await Swal.fire(
          'Success!',
          'Tag has been updated.',
          'success'
        );
        
        fetchTags();
      }
    } catch (err: any) {
      Swal.fire(
        'Error!',
        err.message,
        'error'
      );
    }
  };

  // Fetch tags data
  const fetchTags = useCallback(async () => {
    if (!userDetails?.customerId) return;
    
    try {
      setIsTagsLoading(true);
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('customerid', userDetails.customerId)
        .eq('isdeleted', false)
        .order('tagname');

      if (error) throw error;
      setTags(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching tags:', err);
    } finally {
      setIsTagsLoading(false);
    }
  }, [userDetails?.customerId]);

  useEffect(() => {
    if (userDetails?.customerId) {
      fetchTags();
    }
  }, [fetchTags, userDetails?.customerId]);

  // Fetch users data
  const fetchUsers = useCallback(async () => {
    if (!userDetails?.customerId) return;
    
    try {
      setIsLoading(true);
      const start = (currentPage - 1) * usersPerPage;
      
      // Get total count
      const { count } = await supabase
        .from('users')
        .select('*, customers!inner(*)', { count: 'exact', head: true })
        .eq('isdeleted', false)
        .eq('customerid', userDetails.customerId);
      
      setTotalUsers(count || 0);

      // Get paginated users
      const { data, error } = await supabase
        .from('users')
        .select(`
          username,
          useremail,
          userrole,
          isactive,
          customers!inner(*)
        `)
        .eq('isdeleted', false)
        .eq('customerid', userDetails.customerId)
        .range(start, start + usersPerPage - 1)
        .order('username');

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, userDetails?.customerId]);

  useEffect(() => {
    if (userDetails?.customerId) {
      fetchUsers();
    }
  }, [fetchUsers, userDetails?.customerId]);

  useEffect(() => {
    const storedDetails = localStorage.getItem('userDetails');
    if (!storedDetails) {
      router.push('/');
      return;
    }
    setUserDetails(JSON.parse(storedDetails));
  }, [router]);

  const handleDeleteUser = async (username: string) => {
    try {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: "This user will be deactivated. You can't undo this action.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
      });

      if (result.isConfirmed) {
        const { error } = await supabase
          .from('users')
          .update({ isdeleted: true })
          .eq('username', username)
          .eq('customerid', userDetails?.customerId);

        if (error) throw error;

        await Swal.fire(
          'Deleted!',
          'User has been deactivated.',
          'success'
        );
        
        fetchUsers();
      }
    } catch (err: any) {
      Swal.fire(
        'Error!',
        err.message,
        'error'
      );
    }
  };

  const handleEditUser = (user: User) => {
    window.dispatchEvent(new CustomEvent('manageUser', {
      detail: { user }
    }));
  };

  const handleAddUser = () => {
    window.dispatchEvent(new CustomEvent('manageUser', {
      detail: { user: null }
    }));
  };

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => {
      fetchUsers();
    };
    window.addEventListener('refreshUsers', handleRefresh);
    return () => window.removeEventListener('refreshUsers', handleRefresh);
  }, [fetchUsers]);

  // Fetch current user's role when userDetails changes
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!userDetails?.username || !userDetails?.customerId) return;
      
      try {
        const { data, error } = await supabase
          .from('users')
          .select('userrole')
          .eq('username', userDetails.username)
          .eq('customerid', userDetails.customerId)
          .single();

        if (error) throw error;
        console.log('User Role from DB:', data.userrole); // Debug log
        setCurrentUserRole(data.userrole);
      } catch (err) {
        console.error('Error fetching user role:', err);
      }
    };

    fetchUserRole();
  }, [userDetails?.username, userDetails?.customerId]);

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Settings</h1>
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="profile">Company Profile</TabsTrigger>
            {currentUserRole === 0 && <TabsTrigger value="users">System Users</TabsTrigger>}
            <TabsTrigger value="tags">Tags</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
          {/* Profile Section */}
          <div 
            className="border-b pb-6"
            role="region"
            aria-label="Company profile information section displaying user and company details"
          >
          <h2 className="text-lg font-medium text-gray-900 mb-4">Company Profile Information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label 
                className="block text-sm font-medium text-gray-700"
                aria-label="User's full name"
              >
                Name
              </label>
              <p 
                className="mt-1 text-sm text-gray-900"
                aria-label={`Name: ${userDetails?.name}`}
              >
                {userDetails?.name}
              </p>
            </div>
            <div>
              <label 
                className="block text-sm font-medium text-gray-700"
                aria-label="Company name"
              >
                Company
              </label>
              <p 
                className="mt-1 text-sm text-gray-900"
                aria-label={`Company name: ${userDetails?.companyName}`}
              >
                {userDetails?.companyName}
              </p>
            </div>
            <div>
              <label 
                className="block text-sm font-medium text-gray-700"
                aria-label="Company identifier"
              >
                Company ID
              </label>
              <p 
                className="mt-1 text-sm text-gray-900"
                aria-label={`Company ID: ${userDetails?.customerId}`}
              >
                {userDetails?.customerId}
              </p>
            </div>
            <div>
              <label 
                className="block text-sm font-medium text-gray-700"
                aria-label="User's login username"
              >
                Username
              </label>
              <p 
                className="mt-1 text-sm text-gray-900"
                aria-label={`Username: ${userDetails?.username}`}
              >
                {userDetails?.username}
              </p>
            </div>
          </div>
        </div>

          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            {/* User Management Section - Only visible to administrators */}
            <div 
              role="region" 
              aria-label="User management section for adding, editing, and removing users"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">User Management</h2>
                <button
                  onClick={handleAddUser}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label="Add new user to the system"
                  title="Add New User"
                >
                  <RiAddLine className="w-5 h-5 mr-2" />
                  Add User
                </button>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div 
                    className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent"
                    role="status"
                    aria-label="Loading users..."
                  >
                    <span className="sr-only">Loading users...</span>
                  </div>
                  <p className="mt-4 text-sm text-gray-500 font-medium">Loading users...</p>
                </div>
              ) : error ? (
                <div 
                  className="flex flex-col items-center justify-center py-12 px-4" 
                  role="alert" 
                  aria-live="polite"
                >
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Error Loading Users</h3>
                  <p className="text-sm text-red-600 text-center max-w-md">
                    {error}
                  </p>
                  <button
                    onClick={fetchUsers}
                    className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table 
                      className="min-w-full divide-y divide-gray-200 bg-white"
                      aria-label="User management table with actions for editing and deleting users"
                      role="grid"
                    >
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" aria-label="Username">Username</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" aria-label="Email">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" aria-label="Role">Role</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" aria-label="Status">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" aria-label="Actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {users.length === 0 ? (
                          <tr>
                            <td 
                              colSpan={5} 
                              className="px-6 py-12 text-center"
                              aria-label="No users found in the system"
                            >
                              <div className="flex flex-col items-center justify-center space-y-3">
                                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                  <RiUserLine className="w-6 h-6 text-gray-400" />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-gray-900 font-medium">No Users Found</p>
                                  <p className="text-gray-500 text-sm">Get started by adding your first user</p>
                                </div>
                                <button
                                  onClick={handleAddUser}
                                  className="mt-2 inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                                >
                                  <RiAddLine className="w-4 h-4 mr-1.5" />
                                  Add User
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : users.map((user) => (
                          <tr key={user.username} className="hover:bg-gray-50">
                            <td 
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                              aria-label={`Username: ${user.username}`}
                            >
                              {user.username}
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                              aria-label={`Email: ${user.useremail}`}
                            >
                              {user.useremail}
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                              aria-label={`User role: ${user.userrole === 0 ? 'Administrator' : 'Staff'}`}
                            >
                              {user.userrole === 0 ? 'Administrator' : 'Staff'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span 
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  user.isactive 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}
                                aria-label={`User status: ${user.isactive ? 'Active' : 'Inactive'}`}
                              >
                                {user.isactive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => handleEditUser(user)}
                                  className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-full transition-colors"
                                  aria-label={`Edit user ${user.username}`}
                                  title="Edit User"
                                >
                                  <RiPencilLine className="w-5 h-5" />
                                </button>
                                {user.username !== userDetails?.username && (
                                  <button
                                    onClick={() => handleDeleteUser(user.username)}
                                    className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-full transition-colors"
                                    aria-label={`Delete user ${user.username}`}
                                    title="Delete User"
                                  >
                                    <RiDeleteBinLine className="w-5 h-5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalUsers > usersPerPage && (
                    <div className="flex justify-between items-center mt-6 px-4">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                          title="Previous Page"
                        >
                          Previous
                        </button>
                        <span 
                          className="text-sm text-gray-700 font-medium"
                          aria-label={`Page ${currentPage} of ${Math.ceil(totalUsers / usersPerPage)}`}
                          role="status"
                        >
                          Page {currentPage} of {Math.ceil(totalUsers / usersPerPage)}
                        </span>
                        <button
                          onClick={() => setCurrentPage(prev => prev + 1)}
                          disabled={currentPage >= Math.ceil(totalUsers / usersPerPage)}
                          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                          title="Next Page"
                        >
                          Next
                        </button>
                      </div>
                      <div className="text-sm text-gray-500">
                        Total users: {totalUsers}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tags" className="space-y-6">
            <div role="region" aria-label="Tags management section">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">Tags Management</h2>
                <button
                  onClick={handleAddTag}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label="Add new tag"
                  title="Add New Tag"
                >
                  <RiAddLine className="w-5 h-5 mr-2" />
                  Add Tag
                </button>
              </div>

              {isTagsLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div 
                    className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent"
                    role="status"
                    aria-label="Loading tags..."
                  >
                    <span className="sr-only">Loading tags...</span>
                  </div>
                  <p className="mt-4 text-sm text-gray-500 font-medium">Loading tags...</p>
                </div>
              ) : error ? (
                <div 
                  className="flex flex-col items-center justify-center py-12 px-4" 
                  role="alert" 
                  aria-live="polite"
                >
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Error Loading Tags</h3>
                  <p className="text-sm text-red-600 text-center max-w-md">
                    {error}
                  </p>
                  <button
                    onClick={fetchTags}
                    className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                  <table 
                    className="min-w-full divide-y divide-gray-200 bg-white"
                    aria-label="Tags management table with actions"
                    role="grid"
                  >
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tag Name
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tags.length === 0 ? (
                        <tr>
                          <td 
                            colSpan={2} 
                            className="px-6 py-12 text-center"
                            aria-label="No tags found in the system"
                          >
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <div className="space-y-1">
                                <p className="text-gray-900 font-medium">No Tags Found</p>
                                <p className="text-gray-500 text-sm">No tags have been created yet</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        tags.map((tag) => (
                          <tr key={tag.tagid} className="hover:bg-gray-50">
                            <td 
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                              aria-label={`Tag name: ${tag.tagname}`}
                            >
                              {tag.tagname}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => {
                                    setSelectedTag(tag);
                                    setIsMediaDrawerOpen(true);
                                  }}
                                  className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-full transition-colors"
                                  aria-label={`View media files for ${tag.tagname}`}
                                  title="Associated Media Files"
                                >
                                  <RiMovie2Line className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedTag(tag);
                                    setIsScreenDrawerOpen(true);
                                  }}
                                  className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-full transition-colors"
                                  aria-label={`View screens for ${tag.tagname}`}
                                  title="Associated Screens"
                                >
                                  <RiComputerLine className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleEditTag(tag)}
                                  className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-full transition-colors"
                                  aria-label={`Edit tag ${tag.tagname}`}
                                  title="Edit Tag"
                                >
                                  <RiPencilLine className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTag(tag)}
                                  className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-full transition-colors"
                                  aria-label={`Delete tag ${tag.tagname}`}
                                  title="Delete Tag"
                                >
                                  <RiDeleteBinLine className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Media Tag Drawer */}
      {selectedTag && (
        <MediaTagDrawer
          isOpen={isMediaDrawerOpen}
          onClose={() => {
            setIsMediaDrawerOpen(false);
            setSelectedTag(null);
          }}
          tag={selectedTag}
          customerId={userDetails?.customerId || ''}
        />
      )}

      {/* Screen Tag Drawer */}
      {selectedTag && (
        <ScreenTagDrawer
          isOpen={isScreenDrawerOpen}
          onClose={() => {
            setIsScreenDrawerOpen(false);
            setSelectedTag(null);
          }}
          tag={selectedTag}
          customerId={userDetails?.customerId || ''}
        />
      )}
    </div>
  );
}
