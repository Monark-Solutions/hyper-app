"use client";

import { useEditor } from "./EditorContext";
import { useCallback, useState, useEffect, useRef } from "react";

type ResizeHandle = "top" | "right" | "bottom" | "left" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

export function Canvas() {
  const { design, zoom, elements, addElement, updateElement, selectedElement, setSelectedElement } = useEditor();
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<ResizeHandle | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [elementInitialState, setElementInitialState] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  // Calculate available space and center canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateCanvasPosition = () => {
      const wrapper = container.querySelector('.transform-wrapper') as HTMLElement;
      if (!wrapper) return;

      // Get container dimensions (available space)
      const containerRect = container.getBoundingClientRect();
      const availableWidth = containerRect.width - 64; // subtract padding (32px each side)
      const availableHeight = containerRect.height - 64; // subtract padding (32px each side)

      // Calculate scaled canvas dimensions
      const scaledWidth = design.width * zoom;
      const scaledHeight = design.height * zoom;

      // Calculate position to center the canvas
      const left = Math.max(32, (availableWidth - scaledWidth) / 2);
      const top = Math.max(32, (availableHeight - scaledHeight) / 2);

      // Update wrapper position
      wrapper.style.top = `${top}px`;
      wrapper.style.left = `${left}px`;
    };

    // Create resize observer
    const resizeObserver = new ResizeObserver(updateCanvasPosition);
    resizeObserver.observe(container);
    
    // Initial position update
    updateCanvasPosition();

    // Cleanup
    return () => resizeObserver.disconnect();
  }, [design.width, design.height, zoom]);

  const getScaledCoordinates = useCallback((clientX: number, clientY: number) => {
    const canvas = containerRef.current?.querySelector('.canvas') as HTMLElement;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, (clientX - rect.left) / zoom);
    const y = Math.max(0, (clientY - rect.top) / zoom);

    return { x, y };
  }, [zoom]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = e.dataTransfer.getData('text/plain');
      if (!data) return;
      
      let element;
      try {
        // First try to parse as JSON (for sidebar elements)
        element = JSON.parse(data);
      } catch {
        // If not JSON, check if it's a URL
        if (data.startsWith('http')) {
          // Determine if it's an image or video based on file extension
          const isVideo = /\.(mp4|webm|ogg)$/i.test(data);
          const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(data);
          
          if (isVideo || isImage) {
            element = {
              id: crypto.randomUUID(),
              type: isVideo ? 'video' : 'image',
              src: data,
              style: {
                objectFit: 'fill'
              }
            };
          }
        }
      }

      if (!element) return;
      
      const { x, y } = getScaledCoordinates(e.clientX, e.clientY);
      const newElement = {
        ...element,
        top: y,
        left: x,
        width: element.width || 200,
        height: element.height || 200,
        content: element.type === 'text' ? 'Sample Text' : element.content
      };

      addElement(newElement);
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  }, [addElement, getScaledCoordinates]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, element: typeof elements[0]) => {
    if (e.button !== 0) return; // Only handle left click
    
    const target = e.target as HTMLElement;
    
    // If clicking on img/video element, prevent default behavior and stop propagation
    if (target.tagName.toLowerCase() === 'img' || target.tagName.toLowerCase() === 'video') {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Get initial scaled coordinates
    const { x, y } = getScaledCoordinates(e.clientX, e.clientY);
    
    if (target.getAttribute('data-resize-handle')) {
      setIsResizing(target.getAttribute('data-resize-handle') as ResizeHandle);
    } else if (!target.isContentEditable) {
      setIsDragging(true);
    }
    
    setStartPos({ x, y });
    setElementInitialState({
      top: element.top || 0,
      left: element.left || 0,
      width: element.width || 200,
      height: element.height || 200,
    });
    setSelectedElement(element);
  }, [setSelectedElement, getScaledCoordinates]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging && !isResizing) return;
    if (!elementInitialState || !selectedElement) return;

    const { x, y } = getScaledCoordinates(e.clientX, e.clientY);
    const dx = x - startPos.x;
    const dy = y - startPos.y;

    if (isDragging) {
      // Keep element within canvas bounds
      const newLeft = Math.max(0, Math.min(design.width - elementInitialState.width, elementInitialState.left + dx));
      const newTop = Math.max(0, Math.min(design.height - elementInitialState.height, elementInitialState.top + dy));
      
      updateElement(selectedElement.id, {
        top: newTop,
        left: newLeft,
      });
    }

    if (isResizing) {
      const newState = { ...elementInitialState };

      switch (isResizing) {
        case "top":
          newState.top = Math.max(0, elementInitialState.top + dy);
          newState.height = Math.max(20, elementInitialState.height - dy);
          break;
        case "right":
          newState.width = Math.max(20, Math.min(design.width - elementInitialState.left, elementInitialState.width + dx));
          break;
        case "bottom":
          newState.height = Math.max(20, Math.min(design.height - elementInitialState.top, elementInitialState.height + dy));
          break;
        case "left":
          newState.left = Math.max(0, elementInitialState.left + dx);
          newState.width = Math.max(20, elementInitialState.width - dx);
          break;
        case "topLeft":
          newState.top = Math.max(0, elementInitialState.top + dy);
          newState.left = Math.max(0, elementInitialState.left + dx);
          newState.width = Math.max(20, elementInitialState.width - dx);
          newState.height = Math.max(20, elementInitialState.height - dy);
          break;
        case "topRight":
          newState.top = Math.max(0, elementInitialState.top + dy);
          newState.width = Math.max(20, Math.min(design.width - elementInitialState.left, elementInitialState.width + dx));
          newState.height = Math.max(20, elementInitialState.height - dy);
          break;
        case "bottomLeft":
          newState.left = Math.max(0, elementInitialState.left + dx);
          newState.width = Math.max(20, elementInitialState.width - dx);
          newState.height = Math.max(20, Math.min(design.height - elementInitialState.top, elementInitialState.height + dy));
          break;
        case "bottomRight":
          newState.width = Math.max(20, Math.min(design.width - elementInitialState.left, elementInitialState.width + dx));
          newState.height = Math.max(20, Math.min(design.height - elementInitialState.top, elementInitialState.height + dy));
          break;
      }

      updateElement(selectedElement.id, newState);
    }
  }, [isDragging, isResizing, startPos, elementInitialState, selectedElement, updateElement, zoom, design.width, design.height]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
    setElementInitialState(null);
  }, []);

  const ResizeHandle = ({ position }: { position: ResizeHandle }) => (
    <div
      data-resize-handle={position}
      className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-sm hover:scale-125 transition-transform"
      style={{
        cursor: position === 'topLeft' ? 'nw-resize' :
               position === 'topRight' ? 'ne-resize' :
               position === 'bottomLeft' ? 'sw-resize' :
               position === 'bottomRight' ? 'se-resize' :
               position === 'left' || position === 'right' ? 'ew-resize' :
               position === 'top' || position === 'bottom' ? 'ns-resize' :
               'move',
        ...(position.includes('top') && { top: '-8px' }),
        ...(position.includes('bottom') && { bottom: '-8px' }),
        ...(position.includes('Left') && { left: '-8px' }),
        ...(position.includes('Right') && { right: '-8px' }),
        ...(!position.includes('Left') && !position.includes('Right') && { left: '50%', marginLeft: '-8px' }),
        ...(!position.includes('top') && !position.includes('bottom') && { top: '50%', marginTop: '-8px' }),
      }}
    />
  );

  return (
    <div 
      ref={containerRef}
      className="flex-1 bg-slate-100 min-h-screen relative"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="absolute inset-0 overflow-auto">
        <div className="min-w-full min-h-full p-8">
          <div className="transform-wrapper" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            <div 
              className="canvas bg-white rounded-lg shadow-lg"
              style={{
                width: design.width,
                height: design.height,
                backgroundColor: design.backgroundColor || '#ffffff',
                backgroundImage: 'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                backgroundPosition: 'center',
                willChange: 'transform',
                position: 'relative'
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {elements.map((element) => (
                <div
                  key={element.id}
                  data-element-container="true"
                  className={`absolute rounded-md transition-all ${
                    selectedElement?.id === element.id ? 'shadow-lg ring-2 ring-blue-500 ring-opacity-50' : ''
                  }`}
                  style={{
                    top: element.top || 0,
                    left: element.left || 0,
                    width: element.width || 200,
                    height: element.height || 200,
                    border: '1px solid #e5e7eb',
                    padding: '8px',
                    cursor: isDragging ? 'move' : selectedElement?.id === element.id && element.type === 'text' ? 'text' : 'pointer',
                    ...element.style,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, element)}
                >
                  {element.type === 'text' && (
                    <div 
                      className="w-full h-full break-words select-none"
                      style={{
                        fontSize: element.style?.fontSize || 16,
                        fontFamily: element.style?.fontFamily,
                        color: element.style?.color,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        justifyContent: element.style?.textAlign === 'center' ? 'center' :
                                      element.style?.textAlign === 'right' ? 'flex-end' : 'flex-start',
                        alignItems: element.style?.verticalAlign === 'middle' ? 'center' : 
                                  element.style?.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start'
                      }}
                    >
                      {element.content || 'Sample Text'}
                    </div>
                  )}
                  {element.type === 'image' && (
                    <div className="w-full h-full rounded border border-gray-200 flex items-center justify-center text-gray-400 overflow-hidden">
                      {element.src ? (
                        <img 
                          src={element.src} 
                          alt=""
                          draggable={false}
                          className="w-full h-full"
                          style={{ objectFit: 'fill' }}
                        />
                      ) : (
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                  )}
                  {element.type === 'video' && (
                    <div className="w-full h-full rounded border border-gray-200 flex items-center justify-center text-gray-400 overflow-hidden">
                      {element.src ? (
                        <video 
                          src={element.src}
                          autoPlay
                          muted
                          loop
                          playsInline
                          draggable={false}
                          className="w-full h-full"
                          style={{ objectFit: 'fill' }}
                        />
                      ) : (
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                  )}
                  
                  {selectedElement?.id === element.id && (
                    <>
                      <ResizeHandle position="top" />
                      <ResizeHandle position="right" />
                      <ResizeHandle position="bottom" />
                      <ResizeHandle position="left" />
                      <ResizeHandle position="topLeft" />
                      <ResizeHandle position="topRight" />
                      <ResizeHandle position="bottomLeft" />
                      <ResizeHandle position="bottomRight" />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
