'use client';

import { useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { FiX } from 'react-icons/fi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (url: string) => void;
}

declare global {
  interface Window {
    pmw: {
      init: (options: {
        container: string;
        mode: string;
        elementsToHide: string[];
        onSave: (data: { url: string }) => void;
      }) => void;
    };
  }
}

export default function PosterMyWallDesigner({ isOpen, onClose, onSave }: Props) {
  useEffect(() => {
    // Load PosterMyWall Editor script
    if (isOpen && !window.pmw) {
      const script = document.createElement('script');
      script.src = 'https://www.postermywall.com/plugin/editor.js';
      script.async = true;
      script.onload = () => {
        // Initialize editor when script loads
        window.pmw.init({
          container: 'pmw-editor-container',
          mode: 'export',
          elementsToHide: ['download', 'file', 'upgrade'],
          onSave: (data) => {
            onSave(data.url);
          }
        });
      };
      document.body.appendChild(script);

      return () => {
        document.body.removeChild(script);
      };
    }
  }, [isOpen, onSave]);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 z-[70] overflow-hidden"
    >
      <div className="fixed inset-0 bg-black bg-opacity-40" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-full h-full bg-white">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Design with PosterMyWall
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          {/* Editor Container */}
          <div id="pmw-editor-container" className="w-full h-[calc(100vh-73px)]" />
        </div>
      </div>
    </Dialog>
  );
}
