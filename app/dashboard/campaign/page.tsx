/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@headlessui/react';
import { FiX, FiSearch } from 'react-icons/fi';
import { BiEdit, BiBarChart, BiPlay, BiPause, BiTrash } from 'react-icons/bi';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Select, { SingleValue } from 'react-select';
import Swal from 'sweetalert2';

import CampaignForm from '@/components/CampaignForm';
import LoadingOverlay from '@/components/LoadingOverlay';
import ReportPreview from '@/components/ReportPreview';
import supabase from '@/lib/supabase';
import { Campaign } from '@/types/campaign';
import { ReportData, ScreenInfo } from '@/types/report';

dayjs.extend(relativeTime);

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
  }
}

interface MediaFile {
  mediaid: number;
  medianame: string;
}

interface SelectOption {
  value: string;
  label: string;
}

const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

export default function CampaignsPage() {
  const router = useRouter();
  // State for campaign list and filtering
  const [campaigns, setCampaigns] = useState<(Campaign & { state: string; progress: number; timeText: string })[]>([]);
  const [selectedState, setSelectedState] = useState('all');
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');

  // State for campaign form drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editCampaignId, setEditCampaignId] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // State for report drawer
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  const [selectedCampaignForReport, setSelectedCampaignForReport] = useState<Campaign | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [selectedMediaForReport, setSelectedMediaForReport] = useState<string>('');
  const [mediaFilesForReport, setMediaFilesForReport] = useState<MediaFile[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressText, setProgressText] = useState<string>('');
  const reportRef = useRef<HTMLDivElement>(null);

  const didFetch = useRef(false);

  // Initial load with didFetch pattern
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
      loadCampaigns(userDetails.customerId);
    } catch (error) {
      console.error('Error parsing user details:', error);
      router.push('/');
    }
  }, [router]);

  // Handle drawer close event
  useEffect(() => {
    const handleCloseDrawer = () => {
      setIsDrawerOpen(false);
      setEditCampaignId(0);
      const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
      if (userDetails?.customerId) {
        loadCampaigns(userDetails.customerId);
      }
    };
    window.addEventListener('closeDrawer', handleCloseDrawer);
    return () => window.removeEventListener('closeDrawer', handleCloseDrawer);
  }, []);

  const loadCampaigns = async (customerId: string) => {
    try {
      const { data: campaignsData, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('isdeleted', false)
        .eq('customerid', customerId)
        .order('campaignid', { ascending: false });

      if (error) throw error;

      const processedCampaigns = (campaignsData || []).map(campaign => {
        const currentDate = dayjs();
        const startDate = dayjs(campaign.startdate);
        const endDate = dayjs(campaign.enddate);
        
        let state: 'Active' | 'Scheduled' | 'Completed' = 'Scheduled';
        let progress = 0;
        let timeText = '';

        if (currentDate.isAfter(startDate) && currentDate.isBefore(endDate) || currentDate.isSame(startDate) || currentDate.isSame(endDate)) {
          state = 'Active';
          const totalDuration = endDate.diff(startDate);
          const elapsed = currentDate.diff(startDate);
          progress = Math.min(Math.round((elapsed / totalDuration) * 100), 100);
        
          if (currentDate.isSame(startDate, 'day')) {
            timeText = 'Started Today';
          } else {
            timeText = `Started ${startDate.fromNow()}`;
          }
        
          if (currentDate.isSame(endDate, 'day')) {
            timeText = 'Will End Today';
          }
        } else if (currentDate.isBefore(startDate)) {
          state = 'Scheduled';
          progress = 0;
        
          if (currentDate.isSame(startDate, 'day')) {
            timeText = 'Starts Today';
          } else {
            timeText = `Starts in ${startDate.fromNow()}`;
          }
        } else if (currentDate.isAfter(endDate)) {
          state = 'Completed';
          progress = 100;
        
          if (currentDate.isSame(endDate, 'day')) {
            timeText = 'Ended Today';
          } else {
            timeText = `Ended ${endDate.fromNow()}`;
          }
        }

        return {
          ...campaign,
          state,
          progress,
          timeText
        };
      });

      setCampaigns(processedCampaigns);
    } catch (err) {
      console.error('Error loading campaigns:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      setSearchTags([...searchTags, inputValue.trim()]);
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setSearchTags(searchTags.filter(tag => tag !== tagToRemove));
  };

  const clearSearch = () => {
    setSearchTags([]);
    setInputValue('');
  };

  const handlePlayStateUpdate = async (campaignId: number, playState: boolean) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ playstate: playState })
        .eq('campaignid', campaignId);

      if (error) throw error;

      // Update local state
      setCampaigns(campaigns.map(campaign => 
        campaign.campaignid === campaignId 
          ? { ...campaign, playstate: playState } 
          : campaign
      ));
    } catch (err) {
      console.error('Error updating campaign play state:', err);
    }
  };

  const handleDeleteUpdate = async (campaignId: number) => {
    try {
      if (!campaignId) return;

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
        setIsDeleting(true);
        const { error } = await supabase
          .from('campaigns')
          .update({ isdeleted: true })
          .eq('campaignid', campaignId);

        if (error) throw error;

        // Delete existing screen and media associations
        const { error: deleteScreenError } = await supabase
          .from('campaignscreens')
          .delete()
          .eq('campaignid', campaignId);

        if (deleteScreenError) throw deleteScreenError;

        // Delete existing screen and media associations
        const { error: deleteMediaError } = await supabase
          .from('campaignmedia')
          .delete()
          .eq('campaignid', campaignId);

        if (deleteMediaError) throw deleteMediaError;

        // refresh list
        const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
        if (userDetails?.customerId) {
          await loadCampaigns(userDetails.customerId);
        }
        setIsDeleting(false);
      }

    } catch (err) {
      console.error('Error updating campaign play state:', err);
      setIsDeleting(false);
    }
  };

  const handleCloseReportDrawer = () => {
    setIsReportDrawerOpen(false);
    setSelectedCampaignForReport(null);
    setReportStartDate('');
    setReportEndDate('');
    setReportData(null);
    setReportError(null);
    setSelectedMediaForReport('');
    setMediaFilesForReport([]);
  };

  const fetchMediaFiles = async (campaignId: string) => {
    try {
      setIsReportLoading(true);
      setReportError(null);
      
      const { data, error } = await supabase
        .from('campaignmedia')
        .select(`
          media:mediaid (
            mediaid,
            medianame
          )
        `)
        .eq('campaignid', campaignId);

      if (error) throw error;
      
      // Transform the data to match MediaFile interface
      const transformedData: MediaFile[] = data
        .filter((item: any) => item.media)
        .map((item: any) => ({
          mediaid: item.media.mediaid,
          medianame: item.media.medianame
        }));
      
      setMediaFilesForReport(transformedData || []);
    } catch (err) {
      console.error('Error fetching media files:', err);
      setReportError('Failed to fetch media files');
    } finally {
      setIsReportLoading(false);
    }
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaignForReport || !reportStartDate || !reportEndDate) return;

    try {
      setIsReportLoading(true);
      setReportError(null);
      setProgress(10);
      setProgressText('Fetching campaign data...');

      // Fetch campaign data
      const { data, error: rpcError } = await supabase.rpc('get_campaign_summary', {
        _campaignid: selectedCampaignForReport.campaignid,
        _mediaid: selectedMediaForReport ? parseInt(selectedMediaForReport, 10) : 0,
        _startdate: reportStartDate,
        _enddate: reportEndDate
      });

      if (rpcError) throw new Error(rpcError.message);
      if (!data || data.length === 0) throw new Error('No data found for the selected period');

      const reportDataValue = data[0];
      if (!reportDataValue) throw new Error('Report data not available');
      setReportData(reportDataValue);
      setProgress(30);
      setProgressText('Preparing report layout...');

      // Wait for DOM to update with report data
      await new Promise<void>(resolve => {
        setTimeout(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              resolve();
            }, 500);
          });
        }, 0);
      });

      // Ensure report element exists
      if (!reportRef.current) {
        throw new Error('Report layout not ready');
      }

      setProgress(40);
      setProgressText('Loading campaign image...');

      // Pre-load image if thumbnail exists
      if (reportDataValue.thumbnail && reportDataValue.thumbnail !== '') {
        const tempImg = document.createElement('img');
        await new Promise<void>((resolve, reject) => {
          tempImg.onload = () => resolve();
          tempImg.onerror = () => reject(new Error('Failed to load image'));
          tempImg.src = `data:image/jpeg;base64,${reportDataValue.thumbnail}`;
        });
      }

      setProgress(50);
      setProgressText('Preparing PDF generation...');

      // Apply styles for PDF generation
      const style = document.createElement('style');
      style.setAttribute('data-pdf-styles', 'true');
      style.innerHTML = `
        th {
          background-color: #000000 !important;
          color: #ffffff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        img {
          object-fit: contain !important;
          border-radius: 0.5rem !important;
        }
      `;
      document.head.appendChild(style);

      // Generate high-quality canvas
      const canvas = await html2canvas(reportRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: reportRef.current.offsetWidth,
        height: reportRef.current.offsetHeight,
        imageTimeout: 0,
        onclone: (doc) => {
          // Ensure styles are applied in cloned document
          doc.head.appendChild(style.cloneNode(true));
        }
      });

      setProgress(70);
      setProgressText('Converting to PDF format...');

      try {
        // Create PDF
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true,
          putOnlyUsedFonts: true
        });

        // Get header section only
        const reportHeaderSection = reportRef.current?.querySelector('table:first-of-type');
        if (!reportHeaderSection) throw new Error('Report header section not found');

        // Convert header section to image
        const reportHeaderCanvas = await html2canvas(reportHeaderSection as HTMLElement, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false
        });

        // Add header image to PDF
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const margin = 10;
        const contentWidth = pdfWidth - (margin * 2);
        const reportHeaderHeight = (reportHeaderCanvas.height * contentWidth) / reportHeaderCanvas.width;
        const reportHeaderImgData = reportHeaderCanvas.toDataURL('image/jpeg', 1.0);
        pdf.addImage(reportHeaderImgData, 'JPEG', margin, margin, contentWidth, reportHeaderHeight);

        // Prepare table data
        const tableData = reportDataValue.screeninfo.map((screen: ScreenInfo) => [
          screen.screenname,
          screen.screenlocation,
          screen.screentotalviews.toString()
        ]);

        // Add table using autoTable
        pdf.autoTable({
          startY: reportHeaderHeight + margin + 10,
          head: [[
            'Screen Name',
            'Location',
            'Total Views'
          ]],
          body: tableData,
          theme: 'grid',
          headStyles: {
            fillColor: [0, 0, 0],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          styles: {
            fontSize: 10,
            cellPadding: 5
          },
          columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 'auto', halign: 'right' }
          },
          didDrawPage: (pageInfo: any) => {
            // Start table content from top margin on subsequent pages
            if (pageInfo.pageNumber > 1) {
              pageInfo.settings.startY = margin;
            }
          },
          showHead: 'everyPage',
          margin: { top: margin, right: margin, bottom: margin, left: margin }
        });

        // Generate filename with timestamp
        const timestamp = dayjs().format('YYYY-MM-DD-HHmmss');
        const fileName = `campaign-report-${timestamp}.pdf`;

        setProgress(90);
        setProgressText('Finalizing report...');

        // Save PDF and clean up
        pdf.save(fileName);
        document.head.removeChild(style);

        setProgress(100);
        setProgressText('Report downloaded successfully!');

        // Show success message
        Swal.fire({
          title: 'Success!',
          text: 'Report has been generated and downloaded',
          icon: 'success'
        });
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        throw new Error('Failed to generate PDF');
      }

    } catch (err: any) {
      setReportError(err.message || 'Failed to generate report');
      console.error('Error generating report:', err);
      Swal.fire({
        title: 'Error',
        text: err.message || 'Failed to generate report',
        icon: 'error'
      });
    } finally {
      setIsReportLoading(false);
      setProgress(0);
      setProgressText('');
    }
  };

  return (
    <LoadingOverlay active={isDeleting}>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Campaigns</h1>
          <button 
            onClick={() => {
              setEditCampaignId(0);
              setIsDrawerOpen(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Create Campaign
          </button>
        </div>

        <div className="mb-6">
          <div className="flex space-x-4 mb-4">
            <button 
              onClick={() => setSelectedState('all')}
              className={`text-sm ${selectedState === 'all' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              All Campaigns
            </button>
            <button 
              onClick={() => setSelectedState('Active')}
              className={`text-sm ${selectedState === 'Active' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Active
            </button>
            <button 
              onClick={() => setSelectedState('Scheduled')}
              className={`text-sm ${selectedState === 'Scheduled' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Scheduled
            </button>
            <button 
              onClick={() => setSelectedState('Completed')}
              className={`text-sm ${selectedState === 'Completed' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Completed
            </button>
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
                placeholder={searchTags.length === 0 ? "Search campaigns. Type term and press enter to search." : ""}
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
          {campaigns
            .filter(campaign => {
              if (selectedState !== 'all' && campaign.state !== selectedState) {
                return false;
              }
              if (searchTags.length > 0) {
                return searchTags.some(tag => 
                  campaign.campaignname.toLowerCase().includes(tag.toLowerCase())
                );
              }
              return true;
            })
            .map(campaign => (
              <div key={campaign.campaignid} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{campaign.campaignname}</h3>
                    <p className="text-sm text-gray-500 mt-1">{campaign.state} • {campaign.timeText}</p>
                    <p className="text-sm text-gray-500 mt-1 bold">
                      {dayjs(campaign.startdate).format('DD-MM-YYYY')} - {dayjs(campaign.enddate).format('DD-MM-YYYY')}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="relative group">
                      <button 
                        className="text-gray-600 hover:text-gray-800"
                        onClick={() => {
                          setSelectedCampaignForReport(campaign);
                          setIsReportDrawerOpen(true);
                          setReportError(null);
                          setMediaFilesForReport([]);
                          setIsReportLoading(true);
                          setReportStartDate(campaign.startdate)
                          setReportEndDate(dayjs().format('YYYY-MM-DD'))
                          fetchMediaFiles(String(campaign.campaignid)).catch(err => {
                            console.error('Error loading media files:', err);
                            setReportError('Failed to fetch media files');
                            setIsReportLoading(false);
                          });
                        }}
                      >
                        <BiBarChart size={20} />
                      </button>
                      <div className="absolute left-1/2 -translate-x-1/2 -top-10 px-2.5 py-1.5 bg-black text-white text-sm rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                        Report
                      </div>
                    </div>
                    {(campaign.state === 'Active' || campaign.state === 'Scheduled' || campaign.state === 'Completed') && (
                      <div className="relative group">
                        <button 
                          className="text-gray-600 hover:text-gray-800"
                          onClick={() => {
                            setEditCampaignId(campaign.campaignid);
                            setIsDrawerOpen(true);
                          }}
                        >
                          <BiEdit size={20} />
                        </button>
                        <div className="absolute left-1/2 -translate-x-1/2 -top-10 px-2.5 py-1.5 bg-black text-white text-sm rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                          Edit
                        </div>
                      </div>
                    )}
                    {campaign.state === 'Active' && (
                      (campaign.playstate === null || campaign.playstate === true) ? (
                        <div className="relative group">
                          <button 
                            className="text-gray-600 hover:text-gray-800"
                            onClick={() => handlePlayStateUpdate(campaign.campaignid, false)}
                          >
                            <BiPause size={20} />
                          </button>
                          <div className="absolute left-1/2 -translate-x-1/2 -top-10 px-2.5 py-1.5 bg-black text-white text-sm rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                            Pause Campaign
                          </div>
                        </div>
                      ) : (
                        <div className="relative group">
                          <button 
                            className="text-gray-600 hover:text-gray-800"
                            onClick={() => handlePlayStateUpdate(campaign.campaignid, true)}
                          >
                            <BiPlay size={20} />
                          </button>
                          <div className="absolute left-1/2 -translate-x-1/2 -top-10 px-2.5 py-1.5 bg-black text-white text-sm rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                            Resume Campaign
                          </div>
                        </div>
                      )
                    )}
                    <div className="relative group">
                        <button 
                          className="text-gray-600 hover:text-gray-800"
                          onClick={() => {
                            handleDeleteUpdate(campaign.campaignid);
                          }}
                        >
                          <BiTrash size={20} />
                        </button>
                        <div className="absolute left-1/2 -translate-x-1/2 -top-10 px-2.5 py-1.5 bg-black text-white text-sm rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                          Delete
                        </div>
                      </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        campaign.state === 'Completed' 
                          ? 'bg-green-600' 
                          : campaign.state === 'Active' 
                            ? campaign.playstate === false ? 'bg-yellow-600 bg-opacity-40' : 'bg-blue-650' 
                            : 'bg-gray-400'
                      }`} 
                      style={{ width: `${campaign.progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {campaign.state === 'Completed' 
                      ? 'Campaign completed'
                      : campaign.state === 'Scheduled'
                        ? 'Not started'
                        : `${campaign.progress}% Completed`}
                  </p>
                </div>
              </div>
            ))}
        </div>

        {/* Campaign Form Dialog */}
        <Dialog
          open={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          className="fixed inset-0 z-[60]"
        >
          <div className="fixed inset-0">
            <div className="absolute inset-0 bg-black bg-opacity-40" />
            <div className="fixed inset-0">
              <Dialog.Panel className="w-full h-full bg-white overflow-auto">
                <div className="h-full flex flex-col">
                  <div className="border-b border-gray-200 px-8 py-4">
                    <div className="flex items-center justify-between max-w-[1920px] mx-auto">
                      <h2 className="text-xl font-semibold text-gray-900">
                        {editCampaignId ? 'Edit Campaign' : 'Create Campaign'}
                      </h2>
                      <button
                        onClick={() => setIsDrawerOpen(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <FiX className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="px-6 py-2 w-full h-full">
                      <CampaignForm 
                        campaignId={editCampaignId} 
                        mediaId={0} 
                        setIsDrawerOpen={setIsDrawerOpen}
                        isSaving={isSaving}
                        setIsSaving={setIsSaving}
                      />
                    </div>
                  </div>
                  <div className="flex-shrink-0 px-8 py-4 flex justify-end border-t border-gray-200 bg-white">
                    <div className="flex items-center gap-6">
                      {editCampaignId > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const form = document.getElementById('campaign-form') as HTMLFormElement;
                            const deleteButton = form.querySelector('[data-action="delete"]') as HTMLButtonElement;
                            deleteButton?.click();
                          }}
                          className="bg-red-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Delete Campaign
                        </button>
                      )}
                      <button
                        type="submit"
                        form="campaign-form"
                        disabled={isSaving}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving 
                          ? (editCampaignId ? 'Updating...' : 'Creating...') 
                          : (editCampaignId ? 'Update Campaign' : 'Create Campaign')}
                      </button>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>

        {/* Report Dialog */}
        <Dialog
          open={isReportDrawerOpen}
          onClose={handleCloseReportDrawer}
          className="fixed inset-0 z-[60]"
        >
          <div className="fixed inset-0">
            <div className="absolute inset-0 bg-black bg-opacity-40" />
            <div className="fixed inset-0">
              <Dialog.Panel className="w-full h-full bg-white overflow-auto">
                <LoadingOverlay active={isReportLoading}>
                  <div className="h-full flex flex-col">
                    <div className="border-b border-gray-200 px-8 py-4">
                      <div className="flex items-center justify-between max-w-[1920px] mx-auto">
                        <h2 className="text-xl font-semibold text-gray-900">
                          {selectedCampaignForReport?.campaignname}
                        </h2>
                        <button
                          onClick={handleCloseReportDrawer}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <FiX className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="px-6 py-4 overflow-auto h-full">
                        {reportError && (
                          <div className="mb-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg">
                            {reportError}
                          </div>
                        )}
                        <form onSubmit={handleGenerateReport} className="space-y-4 mb-6">
                          {/* Media Selection */}
                          <div>
                            <label htmlFor="media" className="block text-sm font-medium text-gray-700">
                              Select Media File (Optional)
                            </label>
                            <Select<SelectOption>
                              id="media"
                              value={selectedMediaForReport ? { 
                                value: selectedMediaForReport, 
                                label: mediaFilesForReport.find(m => String(m.mediaid) === selectedMediaForReport)?.medianame || '' 
                              } : null}
                              onChange={(newValue: SingleValue<SelectOption>) => setSelectedMediaForReport(newValue?.value || '')}
                              options={mediaFilesForReport.map(media => ({
                                value: String(media.mediaid),
                                label: media.medianame || ''
                              }))}
                              isDisabled={isReportLoading}
                              isClearable={true}
                              isSearchable={true}
                              placeholder="Choose a media file"
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

                          {/* Date Range */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                                Start Date
                              </label>
                              <input
                                type="date"
                                id="startDate"
                                value={reportStartDate}
                                onChange={(e) => setReportStartDate(e.target.value)}
                                className={inputClasses}
                                disabled={isReportLoading}
                              />
                            </div>
                            <div>
                              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                                End Date
                              </label>
                              <input
                                type="date"
                                id="endDate"
                                value={reportEndDate}
                                onChange={(e) => setReportEndDate(e.target.value)}
                                className={inputClasses}
                                disabled={isReportLoading}
                              />
                            </div>
                          </div>
                          <button
                            type="submit"
                            disabled={isReportLoading}
                            className={`w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
                              ${isReportLoading
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                              }`}
                          >
                            {isReportLoading ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Generating...
                              </>
                            ) : 'Generate Report'}
                          </button>
                        </form>

                        {/* Report Preview */}
                        {reportData && (
                          <div ref={reportRef}>
                            <ReportPreview
                              data={reportData}
                              startDate={reportStartDate}
                              endDate={reportEndDate}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </LoadingOverlay>
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
      </div>
    </LoadingOverlay>
  );
}
