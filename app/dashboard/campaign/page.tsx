/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX, FiSearch } from 'react-icons/fi';
import { BiEdit, BiBarChart, BiPlay, BiPause } from 'react-icons/bi';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import CampaignForm from '@/components/CampaignForm';
import LoadingOverlay from '@/components/LoadingOverlay';
import ReportPreview from '@/components/ReportPreview';
import supabase from '@/lib/supabase';
import { Campaign } from '@/types/campaign';
import { ReportData, ScreenInfo } from '@/types/report';

dayjs.extend(relativeTime);

const inputClasses = 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm';

export default function CampaignsPage() {
  // State for campaign list and filtering
  const [campaigns, setCampaigns] = useState<(Campaign & { state: string; progress: number; timeText: string })[]>([]);
  const [selectedState, setSelectedState] = useState('all');
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');

  // State for campaign form drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editCampaignId, setEditCampaignId] = useState(0);

  // State for report drawer
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  const [selectedCampaignForReport, setSelectedCampaignForReport] = useState<Campaign | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const { data: campaignsData, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('isdeleted', false)
        .order('campaignid', { ascending: false });

      if (error) throw error;

      const processedCampaigns = (campaignsData || []).map(campaign => {
        const now = dayjs();
        const startDate = dayjs(campaign.startdate);
        const endDate = dayjs(campaign.enddate);
        
        let state = 'Scheduled';
        let progress = 0;
        let timeText = '';

        if (now.isAfter(endDate)) {
          state = 'Completed';
          progress = 100;
          timeText = 'Ended ' + endDate.fromNow();
        } else if (now.isBefore(startDate)) {
          state = 'Scheduled';
          progress = 0;
          timeText = 'Starts ' + startDate.fromNow();
        } else {
          state = 'Active';
          const totalDuration = endDate.diff(startDate);
          const elapsed = now.diff(startDate);
          progress = Math.min(100, Math.round((elapsed / totalDuration) * 100));
          timeText = 'Ends ' + endDate.fromNow();
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

  const handleCloseReportDrawer = () => {
    setIsReportDrawerOpen(false);
    setSelectedCampaignForReport(null);
    setReportStartDate('');
    setReportEndDate('');
    setReportData(null);
    setReportError(null);
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaignForReport || !reportStartDate || !reportEndDate) return;

    try {
      setIsReportLoading(true);
      setReportError(null);

      // Fetch screen views
      const { data: viewsData, error: viewsError } = await supabase
        .from('screen_views')
        .select(`
          screens (
            screenname,
            screenlocation
          ),
          count
        `)
        .eq('campaignid', selectedCampaignForReport.campaignid)
        .gte('viewdate', reportStartDate)
        .lte('viewdate', reportEndDate);

      if (viewsError) throw viewsError;

      // Process data for report
      const screenInfo: ScreenInfo[] = [];
      let totalViews = 0;

      viewsData?.forEach(view => {
        if (view.screens && typeof view.screens === 'object' && 'screenname' in view.screens && 'screenlocation' in view.screens) {
          const screenData: ScreenInfo = {
            screenname: String(view.screens.screenname),
            screenlocation: String(view.screens.screenlocation),
            screentotalviews: Number(view.count) || 0
          };
          screenInfo.push(screenData);
          totalViews += screenData.screentotalviews;
        }
      });

      const reportData: ReportData = {
        campaignname: selectedCampaignForReport.campaignname,
        startdate: selectedCampaignForReport.startdate,
        enddate: selectedCampaignForReport.enddate,
        totalsites: screenInfo.length,
        totalviews: totalViews,
        thumbnail: '',
        screeninfo: screenInfo
      };

      setReportData(reportData);

      // Generate PDF after a short delay
      setTimeout(() => {
        if (reportRef.current) {
          html2canvas(reportRef.current).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`campaign-report-${dayjs().format('YYYY-MM-DD')}.pdf`);
          });
        }
      }, 500);

    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'An error occurred while generating the report');
    } finally {
      setIsReportLoading(false);
    }
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
  );
}
