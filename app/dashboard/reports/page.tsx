'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Campaign } from '@/types/campaign';
import { ReportData, ScreenInfo } from '@/types/report';
import supabase from '@/lib/supabase';
import LoadingOverlay from 'react-loading-overlay-ts';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import dayjs from 'dayjs';
import 'jspdf-autotable';
import Select, { SingleValue } from 'react-select';
import ReportPreview from '@/components/ReportPreview';

interface SelectOption {
  value: string;
  label: string;
}

interface ScreenPerformance {
  screen_name: string;
  screen_location: string;
  start_time: string;
  end_time: string;
  expected_screentime: number;
  average_screentime: number;
  performance: number;
}

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
  }
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
  const [screenPerformanceData, setScreenPerformanceData] = useState<ScreenPerformance[] | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const screenReportRef = useRef<HTMLDivElement>(null);
  const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";
  
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

  const validateScreenReportInputs = (): boolean => {
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
    const formatted = dayjs(date).format('DD-MM-YYYY');
    return formatted.toLowerCase();
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

      // Set report data
      const reportDataValue = data[0];
      if (!reportDataValue) throw new Error('Report data not available');
      setReportData(reportDataValue);
      setProgress(30);
      setProgressText('Preparing report layout...');

      // Wait for next render cycle and ensure reportData is set
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

      // Ensure report element exists
      if (!reportRef.current) {
        throw new Error('Report layout not ready');
      }

      setProgress(40);
      setProgressText('Loading campaign image...');

      // Pre-load image
      const tempImg = document.createElement('img');
      await new Promise<void>((resolve, reject) => {
        tempImg.onload = () => resolve();
        tempImg.onerror = () => reject(new Error('Failed to load image'));
        tempImg.src = `data:image/jpeg;base64,${data[0].thumbnail}`;
      });

      setProgress(50);
      setProgressText('Preparing PDF generation...');

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

  const handleGenerateScreenReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProgress(0);
    setProgressText('');

    if (!validateScreenReportInputs()) return;

    try {
      setIsLoading(true);
      setProgressText('Fetching screen performance data...');
      setProgress(10);

      // Fetch screen performance data
      const { data, error: rpcError } = await supabase.rpc('get_screen_performance', {
        p_customerid: userDetails.customerId,
        p_reportstartdate: startDate,
        p_reportenddate: endDate
      });

      if (rpcError) throw new Error(rpcError.message);
      if (!data || data.length === 0) throw new Error('No data found for the selected period');

      setScreenPerformanceData(data);
      setProgress(30);
      setProgressText('Preparing report layout...');

      // Wait for next render cycle
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

      // Ensure report element exists
      if (!screenReportRef.current) {
        throw new Error('Report layout not ready');
      }

      setProgress(50);
      setProgressText('Preparing PDF generation...');

      // Apply styles for PDF generation
      const style = document.createElement('style');
      style.innerHTML = `
        th {
          background-color: #000000 !important;
          color: #ffffff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      `;
      document.head.appendChild(style);

      // Generate high-quality canvas
      const canvas = await html2canvas(screenReportRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: screenReportRef.current.offsetWidth,
        height: screenReportRef.current.offsetHeight
      });

      setProgress(70);
      setProgressText('Converting to PDF format...');

      try {
        // Create PDF
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4',
          compress: true
        });

        // Get header section and convert to image
        const screenHeaderSection = screenReportRef.current?.querySelector('.flex.justify-between');
        if (!screenHeaderSection) throw new Error('Screen header section not found');

        // Convert header section to image
        const screenHeaderCanvas = await html2canvas(screenHeaderSection as HTMLElement, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false
        });

        // Add header image to PDF
        const screenPdfWidth = pdf.internal.pageSize.getWidth();
        const screenMargin = 10;
        const screenContentWidth = screenPdfWidth - (screenMargin * 2);
        const screenHeaderHeight = (screenHeaderCanvas.height * screenContentWidth) / screenHeaderCanvas.width;
        const screenHeaderImgData = screenHeaderCanvas.toDataURL('image/jpeg', 1.0);
        pdf.addImage(screenHeaderImgData, 'JPEG', screenMargin, screenMargin, screenContentWidth, screenHeaderHeight);

        // Add table using autoTable
        pdf.autoTable({
          startY: screenHeaderHeight + screenMargin + 10,
          head: [
            [
              { content: 'Screen Name', rowSpan: 2 },
              { content: 'Location', rowSpan: 2 },
              { content: 'Start Time', rowSpan: 2 },
              { content: 'End Time', rowSpan: 2 },
              { content: 'Screen Time', colSpan: 2 },
              { content: 'Performance %', rowSpan: 2 }
            ],
            [
              '',
              '',
              '',
              '',
              'Expected',
              'Average'
            ]
          ],
          body: data.map((screen: ScreenPerformance) => [
            screen.screen_name,
            screen.screen_location,
            screen.start_time,
            screen.end_time,
            screen.expected_screentime.toFixed(2),
            screen.average_screentime.toFixed(2),
            `${screen.performance.toFixed(2)}%`
          ]),
          theme: 'grid',
          headStyles: {
            fillColor: [0, 0, 0],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center'
          },
          styles: {
            fontSize: 10,
            cellPadding: 5
          },
          columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 'auto', halign: 'right' },
            5: { cellWidth: 'auto', halign: 'right' },
            6: { cellWidth: 'auto', halign: 'right' }
          },
          didDrawPage: (pageInfo: any) => {
            if (pageInfo.pageNumber > 1) {
              pageInfo.settings.startY = screenMargin;
            }
          },
          showHead: 'everyPage',
          margin: { top: screenMargin, right: screenMargin, bottom: screenMargin, left: screenMargin }
        });

        // Generate filename with timestamp
        const timestamp = dayjs().format('YYYY-MM-DD-HHmmss');
        const fileName = `screen-performance-${timestamp}.pdf`;

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
      setError(err.message || 'Failed to generate report');
      console.error('Error generating screen report:', err);
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
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
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
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
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
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
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
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={inputClasses}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Generate Report Button */}
              <button
                type="submit"
                disabled={!startDate || !endDate || isLoading}
                className={`w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
                  ${!startDate || !endDate || isLoading
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

          {/* Media Insights Section */}
          <div className="border p-4 rounded-lg hover:bg-gray-50 cursor-pointer">
            <h3 className="font-medium text-gray-900">Media Insights</h3>
            <p className="text-sm text-gray-500 mt-1">Track media performance and viewer engagement</p>
          </div>
        </div>

        {reportData && (
          <ReportPreview
            ref={reportRef}
            data={reportData}
            startDate={startDate}
            endDate={endDate}
          />
        )}

        {screenPerformanceData && (
          <div ref={screenReportRef} className="mt-6">
            <div className="flex justify-between items-start mb-4">
              <div className="text-4xl font-bold">HYPER</div>
              <div className="text-right">
                <h2 className="text-3xl font-bold mb-2">Screen Performance</h2>
                <p className="text-gray-600">Report Dates {dayjs(startDate).format('DD-MM-YYYY')} - {dayjs(endDate).format('DD-MM-YYYY')}</p>
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
