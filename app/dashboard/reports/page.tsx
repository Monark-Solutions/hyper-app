'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Campaign } from '@/types/campaign';
import supabase from '@/lib/supabase';
import LoadingOverlay from 'react-loading-overlay-ts';
import Image from 'next/image';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import dayjs from 'dayjs';

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

  const reportRef = useRef<HTMLDivElement>(null);

  const formatDate = (date: string) => {
    return dayjs(date).format('DD-MM-YYYY');
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
        _campaignid: selectedCampaign,
        _startdate: startDate,
        _enddate: endDate
      });

      if (rpcError) throw new Error(rpcError.message);
      if (!data || data.length === 0) throw new Error('No data found for the selected period');

      setReportData(data[0]);
      setProgress(30);
      setProgressText('Generating report...');

      // Generate PDF
      if (!reportRef.current) return;

      setProgress(60);
      setProgressText('Generating PDF...');

      // Prepare for PDF generation
      setProgressText('Preparing PDF...');

      // Create a temporary image to ensure it's loaded
      const tempImg = document.createElement('img');
      await new Promise<void>((resolve, reject) => {
        tempImg.onload = () => resolve();
        tempImg.onerror = () => reject(new Error('Failed to load image'));
        tempImg.src = `data:image/jpeg;base64,${data[0].thumbnail}`;
      });

      // Wait for DOM updates
      await new Promise<void>(resolve => setTimeout(resolve, 1000));

      // Apply styles for PDF generation
      const style = document.createElement('style');
      style.innerHTML = `
        .text-blue-800 { color: rgb(30, 64, 175) !important; }
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

      // Generate canvas with better quality
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

      setProgressText('Generating PDF...');

      try {
        // Create PDF with high quality
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true,
          putOnlyUsedFonts: true
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const margin = 10;
        const contentWidth = pdfWidth - (margin * 2);
        const contentHeight = (canvas.height * contentWidth) / canvas.width;

        // Add image to PDF with better quality
        pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight, undefined, 'FAST');

        // Generate filename with timestamp
        const timestamp = dayjs().format('YYYY-MM-DD-HHmmss');
        const fileName = `campaign-report-${timestamp}.pdf`;

        // Save PDF directly
        pdf.save(fileName);

        // Clean up
        document.head.removeChild(style);
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        throw new Error('Failed to generate PDF');
      }

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
    <div ref={reportRef} className="mt-6 p-10 border rounded-lg bg-white print:p-0 print:border-0">
      <div className="mb-12">
        <span className="text-6xl font-black text-blue-800 tracking-wider">HYPER</span>
      </div>
      
      <div className="flex items-start">
        {/* Left side content */}
        <div className="flex-1 pr-8">
          <h2 className="text-5xl font-bold mb-10">{data.campaignname}</h2>
          <div className="mb-10">
            <p className="text-gray-700 mb-2">Campaign Dates</p>
            <p className="font-medium">{formatDate(data.startdate)} - {formatDate(data.enddate)}</p>
          </div>
          
          <div>
            <p className="text-2xl font-bold text-gray-700 mb-3">No. of Sites</p>
            <p className="text-2xl text-gray-600">{data.totalsites}</p>
          </div>
        </div>
        
        {/* Right side content */}
        <div className="w-[450px]">
          <div className="relative w-full h-[250px]">
            <Image
              src={`data:image/jpeg;base64,${data.thumbnail}`}
              alt="Campaign Thumbnail"
              fill
              style={{ objectFit: 'contain' }}
              priority
              className="rounded-lg"
            />
          </div>
          <div className="mt-8">
            <p className="text-2xl font-bold text-gray-700 mb-3">Total Views</p>
            <p className="text-2xl text-gray-600">{data.totalviews}</p>
          </div>
        </div>
      </div>

      <div className="mt-24 print:mt-20">
        <table className="min-w-full divide-y divide-gray-200 print:divide-y-2">
          <thead>
            <tr>
              <th className="px-6 py-4 bg-black text-left text-sm font-semibold text-white uppercase tracking-wider print:bg-black print:text-white">
                Screen Name
              </th>
              <th className="px-6 py-4 bg-black text-left text-sm font-semibold text-white uppercase tracking-wider print:bg-black print:text-white">
                Location
              </th>
              <th className="px-6 py-4 bg-black text-right text-sm font-semibold text-white uppercase tracking-wider print:bg-black print:text-white">
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
