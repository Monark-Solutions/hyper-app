'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Campaign } from '@/types/campaign';
import supabase from '@/lib/supabase';
import * as XLSX from 'xlsx';
import LoadingOverlay from 'react-loading-overlay-ts';
import Image from 'next/image';
import Swal from 'sweetalert2';

interface ScreenInfo {
  screenname: string;
  screenlocation: string;
  screentotalviews: number;
}

interface ReportData {
  campaignname: string;
  startdate: string;
  enddate: string;
  totalsites: number;
  totalviews: number;
  thumbnail: string;
  screeninfo: ScreenInfo[];
}

export default function Reports() {
  const router = useRouter();
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [progressText, setProgressText] = useState<string>('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);

  useEffect(() => {
    const userDetailsStr = localStorage.getItem('userDetails');
    if (!userDetailsStr) {
      router.push('/');
    } else {
      setUserDetails(JSON.parse(userDetailsStr));
    }
  }, [router]);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('isdeleted', false)
        .order('campaignname');

      if (error) throw error;
      setCampaigns(data || []);
    } catch (err) {
      setError('Failed to fetch campaigns');
      console.error('Error fetching campaigns:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const validateReportInputs = (): boolean => {
    if (!selectedCampaign) {
      setError('Please select a campaign');
      return false;
    }
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return false;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before end date');
      return false;
    }
    return true;
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProgress(0);
    setProgressText('');

    if (!validateReportInputs()) return;

    try {
      setIsLoading(true);
      setProgressText('Fetching campaign data...');
      setProgress(10);

      // Fetch campaign data
      const { data, error: rpcError } = await supabase.rpc('get_campaign_summary', {
        p_campaign_id: selectedCampaign,
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (rpcError) throw new Error(rpcError.message);
      if (!data || data.length === 0) throw new Error('No data found for the selected period');

      setReportData(data[0]);
      setProgress(30);
      setProgressText('Generating report...');

      // Generate Excel file
      const workbook = XLSX.utils.book_new();
      
      // Campaign Summary Sheet
      const summaryData = [
        ['HYPER'],
        ['Campaign Name', data[0].campaignname],
        ['Campaign Dates', `${data[0].startdate} - ${data[0].enddate}`],
        ['Total Sites', data[0].totalsites],
        ['Total Views', data[0].totalviews],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Campaign Summary');

      // Screen Performance Sheet
      const screenHeaders = [['Screen Name', 'Location', 'Total Views']];
      const screenData = data[0].screeninfo.map((screen: ScreenInfo) => [
        screen.screenname,
        screen.screenlocation,
        screen.screentotalviews
      ]);
      const screenSheet = XLSX.utils.aoa_to_sheet([...screenHeaders, ...screenData]);
      XLSX.utils.book_append_sheet(workbook, screenSheet, 'Screen Performance');

      setProgress(60);
      setProgressText('Preparing file for download...');

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `campaign-report-${timestamp}.xlsx`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('MediaLibrary')
        .upload(`${userDetails.customerId}/${fileName}`, excelBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

      if (uploadError) throw new Error('Failed to upload report');

      setProgress(80);
      setProgressText('Downloading report...');

      // Get download URL
      const { data: urlData } = supabase.storage
        .from('MediaLibrary')
        .getPublicUrl(`${userDetails.customerId}/${fileName}`);

      if (!urlData?.publicUrl) throw new Error('Failed to generate download link');

      // Trigger download
      const link = document.createElement('a');
      link.href = urlData.publicUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setProgress(100);
      setProgressText('Report generated successfully!');

      Swal.fire({
        title: 'Success!',
        text: 'Report has been generated and downloaded',
        icon: 'success'
      });

    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
      console.error('Error generating report:', err);
      Swal.fire({
        title: 'Error',
        text: err.message || 'Failed to generate report',
        icon: 'error'
      });
    } finally {
      setIsLoading(false);
      setProgress(0);
      setProgressText('');
    }
  };

  const ReportPreview = ({ data }: { data: ReportData }) => (
    <div className="mt-6 p-6 border rounded-lg bg-white">
      <div className="mb-6">
        <span className="text-2xl font-bold text-blue-600">HYPER</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">{data.campaignname}</h2>
          <p className="text-gray-600 mb-2">Campaign Dates</p>
          <p className="font-medium mb-4">{data.startdate} - {data.enddate}</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600">No. of Sites</p>
              <p className="text-xl font-semibold">{data.totalsites}</p>
            </div>
            <div>
              <p className="text-gray-600">Total Views</p>
              <p className="text-xl font-semibold">{data.totalviews}</p>
            </div>
          </div>
        </div>
        
        <div className="relative h-48 md:h-full">
          <Image
            src={`data:image/jpeg;base64,${data.thumbnail}`}
            alt="Campaign Thumbnail"
            fill
            style={{ objectFit: 'contain' }}
          />
        </div>
      </div>

      <div className="mt-8">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Screen Name
              </th>
              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Views
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.screeninfo.map((screen, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {screen.screenname}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {screen.screenlocation}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {screen.screentotalviews}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <LoadingOverlay
      active={isLoading}
      spinner
      text={progressText}
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
                <select
                  id="campaign"
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  disabled={isLoading}
                >
                  <option value="">Choose a campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.campaignid} value={campaign.campaignid}>
                      {campaign.campaignname}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : 'Generate Report'}
              </button>
            </form>
          </div>

          {/* Other Report Types */}
          <div className="border p-4 rounded-lg hover:bg-gray-50 cursor-pointer">
            <h3 className="font-medium text-gray-900">Screen Analytics</h3>
            <p className="text-sm text-gray-500 mt-1">Monitor screen engagement and performance</p>
          </div>
          <div className="border p-4 rounded-lg hover:bg-gray-50 cursor-pointer">
            <h3 className="font-medium text-gray-900">Media Insights</h3>
            <p className="text-sm text-gray-500 mt-1">Track media performance and viewer engagement</p>
          </div>
        </div>

        {reportData && <ReportPreview data={reportData} />}
      </div>
    </LoadingOverlay>
  );
}
