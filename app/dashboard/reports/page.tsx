/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Campaign } from '@/types/campaign';
import { ReportData, ScreenInfo, SelectOption, ScreenOption, ScreenActivity, ScreenPerformance } from '@/types/report';
import supabase from '@/lib/supabase';
import LoadingOverlay from '@/components/LoadingOverlay';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import dayjs from 'dayjs';
import 'jspdf-autotable';
import Select, { SingleValue } from 'react-select';
import ReportPreview from '@/components/ReportPreview';

const inputClasses = 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm';

export default function ReportsPage() {
  const router = useRouter();
  const reportRef = useRef<HTMLDivElement>(null);
  const screenReportRef = useRef<HTMLDivElement>(null);

  // State for loading and error handling
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for campaigns and screens
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [screens, setScreens] = useState<any[]>([]);

  // State for campaign report
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [campaignStartDate, setCampaignStartDate] = useState('');
  const [campaignEndDate, setCampaignEndDate] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');

  // State for screen performance
  const [screenStartDate, setScreenStartDate] = useState('');
  const [screenEndDate, setScreenEndDate] = useState('');
  const [screenPerformanceData, setScreenPerformanceData] = useState<ScreenPerformance[]>([]);

  // State for screen activity
  const [selectedScreen, setSelectedScreen] = useState('');
  const [activityStartDate, setActivityStartDate] = useState('');
  const [activityEndDate, setActivityEndDate] = useState('');
  const [screenActivityData, setScreenActivityData] = useState<ScreenActivity[]>([]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch campaigns
        const { data: campaignsData, error: campaignsError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('isdeleted', false)
          .order('campaignname');

        if (campaignsError) throw new Error(campaignsError.message);
        setCampaigns(campaignsData || []);

        // Fetch screens
        const { data: screensData, error: screensError } = await supabase
          .from('screens')
          .select('*')
          .eq('isdeleted', false)
          .order('screenname');

        if (screensError) throw new Error(screensError.message);
        setScreens(screensData || []);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while loading data');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch campaign details
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select(`
          *,
          media (
            thumbnail
          )
        `)
        .eq('campaignid', selectedCampaign)
        .single();

      if (campaignError) throw new Error(campaignError.message);

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
        .eq('campaignid', selectedCampaign)
        .gte('viewdate', campaignStartDate)
        .lte('viewdate', campaignEndDate);

      if (viewsError) throw new Error(viewsError.message);

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
        campaignname: campaignData.campaignname,
        startdate: campaignData.startdate,
        enddate: campaignData.enddate,
        totalsites: screenInfo.length,
        totalviews: totalViews,
        thumbnail: campaignData.media?.thumbnail || '',
        screeninfo: screenInfo
      };

      setReportData(reportData);
      setReportStartDate(campaignStartDate);
      setReportEndDate(campaignEndDate);

      // Generate PDF after a short delay to ensure the DOM is updated
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
      setError(err instanceof Error ? err.message : 'An error occurred while generating the report');
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err instanceof Error ? err.message : 'An error occurred while generating the report'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateScreenReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenStartDate || !screenEndDate) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .rpc('get_screen_performance', {
          start_date: screenStartDate,
          end_date: screenEndDate
        });

      if (error) throw new Error(error.message);

      setScreenPerformanceData(data || []);

      // Generate PDF after a short delay
      setTimeout(() => {
        if (screenReportRef.current) {
          html2canvas(screenReportRef.current).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`screen-performance-${dayjs().format('YYYY-MM-DD')}.pdf`);
          });
        }
      }, 500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while generating the screen report');
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err instanceof Error ? err.message : 'An error occurred while generating the screen report'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateScreenActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityStartDate || !activityEndDate) return;

    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from('screen_logs')
        .select(`
          screens (
            screenname
          ),
          logheader,
          logtype,
          logdatetime
        `)
        .gte('logdatetime', activityStartDate)
        .lte('logdatetime', activityEndDate)
        .order('logdatetime', { ascending: false });

      if (selectedScreen) {
        query = query.eq('screenid', selectedScreen);
      }

      const { data, error } = await query;

      if (error) throw new Error(error.message);
      
      // Transform the data to match ScreenActivity type
      const transformedData: ScreenActivity[] = (data || []).map(item => {
        // Ensure screens object exists and has the correct shape
        const screenData = Array.isArray(item.screens) ? item.screens[0] : item.screens;
        
        return {
          screens: {
            screenname: String(screenData?.screenname || '')
          },
          logheader: String(item.logheader || ''),
          logtype: String(item.logtype || ''),
          logdatetime: String(item.logdatetime || '')
        };
      });

      setScreenActivityData(transformedData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching screen activity');
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err instanceof Error ? err.message : 'An error occurred while fetching screen activity'
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <LoadingOverlay active={isLoading}>
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Reports</h1>
        <p className="text-gray-600 mb-6">
          View and generate reports for your campaigns and screens.
        </p>

        <div className="space-y-6">
          {/* Campaign Performance Section */}
          <div className="border rounded-lg p-6">
            <h3 className="font-medium text-gray-900 mb-4">Campaign Performance</h3>
            
            {error && (
              <div className="mb-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleGenerateReport} className="space-y-4">
              {/* Campaign Selection */}
              <div>
                <label htmlFor="campaign" className="block text-sm font-medium text-gray-700">
                  Select Campaign
                </label>
                <Select<SelectOption>
                  id="campaign"
                  value={selectedCampaign ? { value: selectedCampaign, label: campaigns.find(c => String(c.campaignid) === selectedCampaign)?.campaignname || '' } : null}
                  onChange={(newValue: SingleValue<SelectOption>) => setSelectedCampaign(newValue?.value || '')}
                  options={campaigns.map(campaign => ({
                    value: String(campaign.campaignid),
                    label: campaign.campaignname || ''
                  }))}
                  isDisabled={isLoading}
                  isClearable={true}
                  isSearchable={true}
                  placeholder="Choose a campaign"
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
                    value={campaignStartDate}
                    onChange={(e) => setCampaignStartDate(e.target.value)}
                    className={inputClasses}
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                    End Date
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={campaignEndDate}
                    onChange={(e) => setCampaignEndDate(e.target.value)}
                    className={inputClasses}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Generate Report Button */}
              <button
                type="submit"
                disabled={!selectedCampaign || isLoading}
                className={`w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
                  ${!selectedCampaign || isLoading
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  }`}
              >
                {isLoading ? (
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
          </div>

          {/* Screen Performance Section */}
          <div className="border rounded-lg p-6">
            <h3 className="font-medium text-gray-900 mb-4">Screen Performance</h3>
            
            <form onSubmit={handleGenerateScreenReport} className="space-y-4">
              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="screenStartDate" className="block text-sm font-medium text-gray-700">
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="screenStartDate"
                    value={screenStartDate}
                    onChange={(e) => setScreenStartDate(e.target.value)}
                    className={inputClasses}
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label htmlFor="screenEndDate" className="block text-sm font-medium text-gray-700">
                    End Date
                  </label>
                  <input
                    type="date"
                    id="screenEndDate"
                    value={screenEndDate}
                    onChange={(e) => setScreenEndDate(e.target.value)}
                    className={inputClasses}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Generate Report Button */}
              <button
                type="submit"
                disabled={!screenStartDate || !screenEndDate || isLoading}
                className={`w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
                  ${!screenStartDate || !screenEndDate || isLoading
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  }`}
              >
                {isLoading ? (
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
          </div>

          {/* Screen Activity Section */}
          <div className="border rounded-lg p-6">
            <h3 className="font-medium text-gray-900 mb-4">Screen Activity</h3>
            
            <form onSubmit={handleGenerateScreenActivity} className="space-y-4">
              {/* Screen Selection */}
              <div>
                <label htmlFor="screen" className="block text-sm font-medium text-gray-700">
                  Select Screen
                </label>
                <Select<ScreenOption>
                  id="screen"
                  value={selectedScreen ? { 
                    value: selectedScreen, 
                    label: screens.find(s => String(s.screenid) === selectedScreen)?.screenname || '' 
                  } : null}
                  onChange={(newValue: SingleValue<ScreenOption>) => 
                    setSelectedScreen(newValue?.value || '')}
                  options={screens.map(screen => ({
                    value: String(screen.screenid),
                    label: screen.screenname
                  }))}
                  isDisabled={isLoading}
                  isClearable={true}
                  isSearchable={true}
                  placeholder="Choose a screen (optional)"
                  className="mt-1"
                  classNames={{
                    control: (state) => 
                      `!border-slate-300 !shadow-sm ${
                        state.isFocused ? '!border-indigo-500 !ring-1 !ring-indigo-500' : ''
                      }`,
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
                  <label htmlFor="activityStartDate" className="block text-sm font-medium text-gray-700">
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="activityStartDate"
                    value={activityStartDate}
                    onChange={(e) => setActivityStartDate(e.target.value)}
                    className={inputClasses}
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label htmlFor="activityEndDate" className="block text-sm font-medium text-gray-700">
                    End Date
                  </label>
                  <input
                    type="date"
                    id="activityEndDate"
                    value={activityEndDate}
                    onChange={(e) => setActivityEndDate(e.target.value)}
                    className={inputClasses}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Generate Report Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
                  ${isLoading
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  }`}
              >
                {isLoading ? (
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

            {/* Activity Results Table */}
            {screenActivityData.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-black text-white">
                    <tr>
                      <th className="px-4 py-2 text-left">Screen Name</th>
                      <th className="px-4 py-2 text-left">Log Header</th>
                      <th className="px-4 py-2 text-left">Log Type</th>
                      <th className="px-4 py-2 text-left">Date/Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {screenActivityData.map((activity, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-4 py-2 border">{activity.screens.screenname}</td>
                        <td className="px-4 py-2 border">{activity.logheader}</td>
                        <td className="px-4 py-2 border">{activity.logtype}</td>
                        <td className="px-4 py-2 border">
                          {dayjs(activity.logdatetime).format('DD-MM-YYYY HH:mm:ss')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {reportData && (
          <div ref={reportRef}>
            <ReportPreview
              data={reportData}
              startDate={reportStartDate}
              endDate={reportEndDate}
            />
          </div>
        )}

        {screenPerformanceData && (
          <div ref={screenReportRef} className="mt-6">
            <div className="flex justify-between items-start mb-4">
              <div className="text-4xl font-bold">HYPER</div>
              <div className="text-right">
                <h2 className="text-3xl font-bold mb-2">Screen Performance</h2>
                <p className="text-gray-600">Report Dates {dayjs(screenStartDate).format('DD-MM-YYYY')} - {dayjs(screenEndDate).format('DD-MM-YYYY')}</p>
              </div>
            </div>
            
            <table className="min-w-full mt-6">
              <thead className="bg-black text-white">
                <tr>
                  <th className="px-4 py-2 text-left" rowSpan={2}>Screen Name</th>
                  <th className="px-4 py-2 text-left" rowSpan={2}>Location</th>
                  <th className="px-4 py-2 text-left" rowSpan={2}>Start Time</th>
                  <th className="px-4 py-2 text-left" rowSpan={2}>End Time</th>
                  <th className="px-4 py-2 text-center" colSpan={2}>Screen Time</th>
                  <th className="px-4 py-2 text-right" rowSpan={2}>Performance %</th>
                </tr>
                <tr>
                  <th className="px-4 py-2 text-right">Expected</th>
                  <th className="px-4 py-2 text-right">Average</th>
                </tr>
              </thead>
              <tbody>
                {screenPerformanceData.map((screen, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-4 py-2 border">{screen.screen_name}</td>
                    <td className="px-4 py-2 border">{screen.screen_location}</td>
                    <td className="px-4 py-2 border">{screen.start_time}</td>
                    <td className="px-4 py-2 border">{screen.end_time}</td>
                    <td className="px-4 py-2 border text-right">{screen.expected_screentime.toFixed(2)}</td>
                    <td className="px-4 py-2 border text-right">{screen.average_screentime.toFixed(2)}</td>
                    <td className="px-4 py-2 border text-right">{screen.performance.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </LoadingOverlay>
  );
}
