"use client";

import { MdTextFields, MdImage, MdVideocam } from "react-icons/md";
import { useEditor } from "./EditorContext";

export function Sidebar() {
  const { addElement, design } = useEditor();

  const handleDragStart = (type: 'text' | 'image' | 'video') => (e: React.DragEvent) => {
    const element = {
      id: crypto.randomUUID(),
      type,
      top: 0,
      left: 0,
      width: type === 'text' ? 200 : 300,
      height: type === 'text' ? 50 : 200,
      content: type === 'text' ? 'Sample Text' : undefined,
      style: type === 'text' ? {
        fontFamily: 'Arial',
        fontSize: 16,
        fontWeight: 'normal',
        color: '#000000',
        textAlign: 'left' as const,
        verticalAlign: 'top' as const,
      } : undefined
    };
    
    e.dataTransfer.setData('text/plain', JSON.stringify(element));
  };

  return (
    <div className="w-[80px] border-r bg-white p-2 flex flex-col gap-2">
      <button
        className="flex flex-col items-center justify-center h-20 rounded-md hover:bg-gray-100 transition-colors"
        draggable
        onDragStart={handleDragStart('text')}
      >
        <MdTextFields className="h-6 w-6 text-gray-700" />
        <span className="text-xs mt-1 text-gray-600">Text</span>
      </button>
      <button
        className="flex flex-col items-center justify-center h-20 rounded-md hover:bg-gray-100 transition-colors"
        draggable
        onDragStart={handleDragStart('image')}
      >
        <MdImage className="h-6 w-6 text-gray-700" />
        <span className="text-xs mt-1 text-gray-600">Image</span>
      </button>
      <button
        className="flex flex-col items-center justify-center h-20 rounded-md hover:bg-gray-100 transition-colors"
        draggable
        onDragStart={handleDragStart('video')}
      >
        <MdVideocam className="h-6 w-6 text-gray-700" />
        <span className="text-xs mt-1 text-gray-600">Video</span>
      </button>
    </div>
  );
}
