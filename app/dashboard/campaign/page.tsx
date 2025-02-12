'use client';

import { useEffect, useState, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import CampaignForm from '@/components/CampaignForm';
import { useRouter } from 'next/navigation';
import { FiSearch, FiX } from 'react-icons/fi';
import { BiBarChart, BiEdit, BiPause, BiPlay } from 'react-icons/bi';
import supabase from '@/lib/supabase';
import type { Campaign } from '@/types/campaign';
import type { ReportData, ScreenInfo } from '@/types/report';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
  }
}
import LoadingOverlay from 'react-loading-overlay-ts';
import Swal from 'sweetalert2';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import 'jspdf-autotable';
import ReportPreview from '@/components/ReportPreview';

type CampaignWithState = Campaign & { 
  state: 'Active' | 'Scheduled' | 'Completed';
  progress: number;
  timeText: string;
};

export default function Campaign() {
  const router = useRouter();
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignWithState[]>([]);
  const [selectedState, setSelectedState] = useState<string>('all');
  const [editCampaignId, setEditCampaignId] = useState<number>(0);
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  const [selectedCampaignForReport, setSelectedCampaignForReport] = useState<CampaignWithState | null>(null);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportProgress, setReportProgress] = useState<number>(0);
  const [reportProgressText, setReportProgressText] = useState<string>('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportError, setReportError] = useState<string>('');
  const reportRef = useRef<HTMLDivElement>(null);
  const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

  const formatTimeAgo = (date: Date, isEndDate: boolean = false) => {
    const now = new Date();
    const diffTime = Math.abs(date.getTime() - now.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffWeeks > 0) {
      return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''}`;
    }
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const fetchCampaigns = async () => {
    const userDetails = localStorage.getItem('userDetails');
    if (!userDetails) return;
    
    const { customerId } = JSON.parse(userDetails);
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('customerid', customerId)
      .eq('isdeleted', false)
      .order('startdate', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns:', error);
      return;
    }

    const currentDate = new Date();
    const currentDateStr = currentDate.toISOString().split('T')[0];

    const processedCampaigns = data.map(campaign => {
      const startDate = new Date(campaign.startdate);
      const endDate = new Date(campaign.enddate);
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      let state: 'Active' | 'Scheduled' | 'Completed' = 'Scheduled';
      let progress = 0;
      let timeText = '';

      // Determine state and progress
      if (currentDateStr >= startDateStr && currentDateStr <= endDateStr) {
        state = 'Active';
        const totalDuration = endDate.getTime() - startDate.getTime();
        const elapsed = currentDate.getTime() - startDate.getTime();
        progress = Math.min(Math.round((elapsed / totalDuration) * 100), 100);

        if (isSameDay(currentDate, startDate)) {
          timeText = 'Started Today';
        } else {
          timeText = `Started ${formatTimeAgo(startDate)} ago`;
        }

        if (isSameDay(currentDate, endDate)) {
          timeText = 'Will End Today';
        }
      } else if (currentDateStr < startDateStr) {
        state = 'Scheduled';
        progress = 0;

        if (isSameDay(currentDate, startDate)) {
          timeText = 'Starts Today';
        } else {
          timeText = `Starts in ${formatTimeAgo(startDate)}`;
        }
      } else if (currentDateStr > endDateStr) {
        state = 'Completed';
        progress = 100;

        if (isSameDay(currentDate, endDate)) {
          timeText = 'Ended Today';
        } else {
          timeText = `Ended ${formatTimeAgo(endDate)} ago`;
        }
      }

      return { ...campaign, state, progress, timeText };
    });

    setCampaigns(processedCampaigns);
  };

  const handlePlayStateUpdate = async (campaignId: number, newPlayState: boolean) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ playstate: newPlayState })
        .eq('campaignid', campaignId);

      if (error) {
        console.error('Error updating play state:', error);
        return;
      }

      // Immediately refresh the campaign list
      await fetchCampaigns();
    } catch (error) {
      console.error('Error updating play state:', error);
    }
  };

  const didFetch = useRef(false);

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

      // Load campaigns
      fetchCampaigns().catch(error => {
        console.error('Error loading campaigns:', error);
        router.push('/');
      });
    } catch (error) {
      console.error('Error parsing user details:', error);
      router.push('/');
    }
  }, []); // Empty dependency array since we're using didFetch ref

  // Handle drawer close events
  useEffect(() => {
    const handleCloseDrawer = () => {
      setIsDrawerOpen(false);
      setEditCampaignId(0);
      fetchCampaigns();
    };
    window.addEventListener('closeDrawer', handleCloseDrawer);
    return () => window.removeEventListener('closeDrawer', handleCloseDrawer);
  }, []);

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

  const validateReportDates = (): boolean => {
    if (!reportStartDate || !reportEndDate) {
      setReportError('Please select both start and end dates');
      return false;
    }
    if (new Date(reportStartDate) > new Date(reportEndDate)) {
      setReportError('Start date must be before end date');
      return false;
    }
    return true;
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportError('');
    setReportProgress(0);
    setReportProgressText('');

    if (!validateReportDates()) return;

    try {
      setIsReportLoading(true);
      setReportProgressText('Fetching campaign data...');
      setReportProgress(10);

      // Fetch campaign data
      const { data, error: rpcError } = await supabase.rpc('get_campaign_summary', {
        _campaignid: String(selectedCampaignForReport?.campaignid),
        _startdate: reportStartDate,
        _enddate: reportEndDate
      });

      if (rpcError) throw new Error(rpcError.message);
      if (!data || data.length === 0) throw new Error('No data found for the selected period');

      // Set report data
      const reportDataValue = data[0];
      if (!reportDataValue) throw new Error('Report data not available');
      setReportData(reportDataValue);
      setReportProgress(30);
      setReportProgressText('Preparing report layout...');

      // Wait for next render cycle and ensure reportData is set
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

      // Ensure report element exists
      if (!reportRef.current) {
        throw new Error('Report layout not ready');
      }

      setReportProgress(40);
      setReportProgressText('Loading campaign image...');

      // Pre-load image
      const tempImg = document.createElement('img');
      await new Promise<void>((resolve, reject) => {
        tempImg.onload = () => resolve();
        tempImg.onerror = () => reject(new Error('Failed to load image'));
        tempImg.src = `data:image/jpeg;base64,${data[0].thumbnail}`;
      });

      setReportProgress(50);
      setReportProgressText('Preparing PDF generation...');

      // Apply styles for PDF generation
      const style = document.createElement('style');
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

      setReportProgress(70);
      setReportProgressText('Converting to PDF format...');

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
        const headerSection = reportRef.current?.querySelector('table:first-of-type');
        if (!headerSection) throw new Error('Header section not found');

        // Convert header section to image
        const headerCanvas = await html2canvas(headerSection as HTMLElement, {
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
        const headerHeight = (headerCanvas.height * contentWidth) / headerCanvas.width;
        const headerImgData = headerCanvas.toDataURL('image/jpeg', 1.0);
        pdf.addImage(headerImgData, 'JPEG', margin, margin, contentWidth, headerHeight);

        // Add table using autoTable
        const tableData = reportDataValue.screeninfo.map((screen: ScreenInfo) => [
          screen.screenname,
          screen.screenlocation,
          screen.screentotalviews.toString()
        ]);

        pdf.autoTable({
          startY: headerHeight + (margin * 2),
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

        setReportProgress(90);
        setReportProgressText('Finalizing report...');

        // Save PDF and clean up
        pdf.save(fileName);
        document.head.removeChild(style);

        setReportProgress(100);
        setReportProgressText('Report downloaded successfully!');

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
      setReportProgress(0);
      setReportProgressText('');
    }
  };

  const handleCloseReportDrawer = () => {
    setIsReportDrawerOpen(false);
    setSelectedCampaignForReport(null);
    setReportStartDate('');
    setReportEndDate('');
    setReportError('');
    setReportData(null);
  };

  return (
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
                      <CampaignForm campaignId={editCampaignId} mediaId={0} />
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
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        {editCampaignId ? 'Update Campaign' : 'Create Campaign'}
                      </button>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
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
        {/* Campaign Items */}
        {campaigns
          .filter(campaign => {
            // Filter by state
            if (selectedState !== 'all' && campaign.state !== selectedState) {
              return false;
            }
            
            // Filter by search tags
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
                  <p className="text-sm text-gray-500 mt-1 bold">{dayjs(campaign.startdate).format('DD-MM-YYYY')} - {dayjs(campaign.enddate).format('DD-MM-YYYY')}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="relative group">
                    <button 
                      className="text-gray-600 hover:text-gray-800"
                      onClick={() => {
                        setSelectedCampaignForReport(campaign);
                        setIsReportDrawerOpen(true);
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
                  ></div>
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

      {/* Report Drawer */}
      <Dialog
        open={isReportDrawerOpen}
        onClose={handleCloseReportDrawer}
        className="fixed inset-0 z-[60]"
      >
        <div className="fixed inset-0">
          <div className="absolute inset-0 bg-black bg-opacity-40" />
          <div className="fixed inset-0">
            <Dialog.Panel className="w-full h-full bg-white overflow-auto">
              <LoadingOverlay
                active={isReportLoading}
                spinner
                text={reportProgressText}
                styles={{
                  overlay: (base) => ({
                    ...base,
                    background: 'rgba(255, 255, 255, 0.8)'
                  }),
                  content: (base) => ({
                    ...base,
                    color: '#2563eb'
                  })
                }}
              >
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
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
  );
}
