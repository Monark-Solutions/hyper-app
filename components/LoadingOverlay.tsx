import React from 'react';

interface LoadingOverlayProps {
  active?: boolean;
  children?: React.ReactNode;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ active = true, children }) => {
  return (
    <>
      {active && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[60] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-600 font-medium">Loading...</p>
          </div>
        </div>
      )}
      {children}
    </>
  );
};

export default LoadingOverlay;
