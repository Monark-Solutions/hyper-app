'use client';

import { forwardRef } from 'react';
import Image from 'next/image';
import dayjs from 'dayjs';
import { ReportPreviewProps } from '@/types/report';

const formatDate = (date: string) => {
  const formatted = dayjs(date).format('DD-MM-YYYY');
  return formatted.toLowerCase();
};

const ReportPreview = forwardRef<HTMLDivElement, ReportPreviewProps>(
  ({ data, startDate, endDate, className = '' }, ref) => (
    <div ref={ref} className={`mt-6 p-10 bg-white print:p-0 ${className}`}>
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className="align-top w-1/2">
              <span className="text-6xl font-black text-black tracking-wider">HYPER</span>
            </td>
            <td rowSpan={2} className="align-top w-1/2">
              <div className="w-[450px]">
                <img
                  src={`data:image/jpeg;base64,${data.thumbnail}`}
                  alt="Campaign Thumbnail"
                  className="w-full h-[150px] object-contain rounded-lg"
                />
              </div>
            </td>
          </tr>
          <tr>
            <td className="text-5xl font-bold pt-4">{data.campaignname}</td>
          </tr>
          <tr>
            <td className="pt-6">
              <p className="text-2xl font-bold text-gray-700">Campaign Dates</p>
            </td>
            <td className="pt-6">
              <p className="text-2xl font-bold text-gray-700">Report Dates</p>
            </td>
          </tr>
          <tr>
            <td className="pt-3">
              <p className="text-2xl text-gray-600">{formatDate(data.startdate)} - {formatDate(data.enddate)}</p>
            </td>
            <td className="pt-3">
              <p className="text-2xl text-gray-600">{formatDate(startDate)} - {formatDate(endDate)}</p>
            </td>
          </tr>
          <tr>
            <td className="pt-6">
              <p className="text-2xl font-bold text-gray-700">No. of Sites</p>
            </td>
            <td className="pt-6">
              <p className="text-2xl font-bold text-gray-700">Total Views</p>
            </td>
          </tr>
          <tr>
            <td className="pt-3">
              <p className="text-2xl text-gray-600">{data.totalsites}</p>
            </td>
            <td className="pt-3">
              <p className="text-2xl text-gray-600">{data.totalviews}</p>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-8">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="px-6 py-4 bg-black text-left text-sm font-semibold text-white uppercase tracking-wider border border-gray-200">
                Screen Name
              </th>
              <th className="px-6 py-4 bg-black text-left text-sm font-semibold text-white uppercase tracking-wider border border-gray-200">
                Location
              </th>
              <th className="px-6 py-4 bg-black text-right text-sm font-semibold text-white uppercase tracking-wider border border-gray-200">
                Total Views
              </th>
            </tr>
          </thead>
          <tbody>
            {data.screeninfo.map((screen, index) => (
              <tr key={index}>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 border border-gray-200">
                  {screen.screenname}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 border border-gray-200">
                  {screen.screenlocation}
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-900 border border-gray-200">
                  {screen.screentotalviews}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
);

ReportPreview.displayName = 'ReportPreview';

export default ReportPreview;
