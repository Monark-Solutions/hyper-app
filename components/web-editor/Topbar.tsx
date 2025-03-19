"use client";

import React from 'react';
import { useEditor } from './EditorContext';
import { FiZoomIn, FiZoomOut, FiSave } from 'react-icons/fi';

export function Topbar() {
  const { zoom, setZoom } = useEditor();

  const handleZoomIn = () => {
    const newZoom = Math.min(Math.round((zoom + 0.1) * 100) / 100, 1);
    setZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(Math.round((zoom - 0.1) * 100) / 100, 0.1);
    setZoom(newZoom);
  };

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace('%', '');
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setZoom(numValue / 100);
    }
  };

  const handleZoomBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value.replace('%', '');
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      // Constrain between 10% and 100%
      const constrainedZoom = Math.min(Math.max(numValue, 10), 100) / 100;
      setZoom(constrainedZoom);
    } else {
      // Reset to current zoom if invalid
      e.target.value = Math.round(zoom * 100) + '%';
    }
  };

  return (
    <div className="h-14 border-b bg-white flex items-center px-4 justify-between">
      <div className="flex items-center space-x-2">
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={zoom <= 0.1}
        >
          <FiZoomOut className="w-5 h-5" />
        </button>

        <div className="relative w-24">
          <input
            type="text"
            value={Math.round(zoom * 100) + '%'}
            onChange={handleZoomChange}
            onBlur={handleZoomBlur}
            className="w-full py-1.5 px-3 text-center bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={zoom >= 1}
        >
          <FiZoomIn className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center space-x-2">
        <button className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
          <FiSave className="w-4 h-4 mr-2" />
          Save
        </button>
      </div>
    </div>
  );
}
