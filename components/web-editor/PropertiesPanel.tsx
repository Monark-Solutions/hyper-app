"use client";

import React, { useEffect } from 'react';
import { useEditor, Element } from './EditorContext';
import { FiX, FiCheck, FiX as FiXCircle } from 'react-icons/fi';

// Helper function to extract keys with dot notation for nested properties
const extractKeysFromData = (data: any, prefix = ''): string[] => {
  let keys: string[] = [];
  
  if (Array.isArray(data) && data.length > 0) {
    // If it's an array, extract keys from the first item
    return extractKeysFromData(data[0], prefix);
  } else if (typeof data === 'object' && data !== null) {
    // For objects, extract keys and handle nested objects
    for (const key in data) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      
      if (typeof data[key] === 'object' && data[key] !== null) {
        // For nested objects, recursively extract keys
        keys = [...keys, newPrefix, ...extractKeysFromData(data[key], newPrefix)];
      } else {
        keys.push(newPrefix);
      }
    }
  }
  
  return keys;
};

// Helper function to get a value from a nested path using dot notation
const getValueFromPath = (obj: any, path: string): any => {
  if (!obj || !path) return '';
  
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return '';
    
    // If we encounter an array and it's not the last part, use the first item
    if (Array.isArray(current)) {
      if (current.length === 0) return '';
      current = current[0];
    }
    
    current = current[part];
    
    // If we get an array and it's the last part, use the first item's specified field
    if (Array.isArray(current) && current.length > 0) {
      current = current[0];
    }
  }
  
  return current !== null && current !== undefined ? current : '';
};

// Helper function to check if a string is a valid URL
const isValidUrl = (string: string): boolean => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

// Helper function to resolve URL placeholders
const resolvePlaceholderUrl = (urlTemplate: string, fieldPath: string, data: any): string => {
  if (!urlTemplate || !fieldPath || !data) return urlTemplate;
  
  const fieldValue = getValueFromPath(data, fieldPath);
  return urlTemplate.replace(/\{([^}]+)\}/g, (_, placeholder) => {
    // Replace the placeholder with the field value if it matches the field path
    return placeholder === fieldPath ? fieldValue : `{${placeholder}}`;
  });
};

const KEYBOARD_SHORTCUTS = {
  DELETE: ['Delete', 'Backspace'],
  CLOSE: ['Escape'],
  NUDGE: {
    LEFT: ['ArrowLeft'],
    RIGHT: ['ArrowRight'],
    UP: ['ArrowUp'],
    DOWN: ['ArrowDown'],
  },
};

const NUDGE_AMOUNT = 1; // pixels to move per arrow key press
const NUDGE_AMOUNT_SHIFT = 10; // pixels to move when holding shift

export function PropertiesPanel() {
  const { design, setDesign, selectedElement, setSelectedElement, updateElement, elements, setElements } = useEditor();

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when an element is selected
      if (!selectedElement) return;
      
      // Ignore shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (KEYBOARD_SHORTCUTS.DELETE.includes(e.key)) {
        e.preventDefault();
        if (window.confirm('Are you sure you want to delete this element?')) {
          setSelectedElement(null);
          setElements(elements.filter(el => el.id !== selectedElement.id));
        }
      } else if (KEYBOARD_SHORTCUTS.CLOSE.includes(e.key)) {
        e.preventDefault();
        setSelectedElement(null);
      } else if (Object.values(KEYBOARD_SHORTCUTS.NUDGE).some(keys => keys.includes(e.key))) {
        e.preventDefault();
        const amount = e.shiftKey ? NUDGE_AMOUNT_SHIFT : NUDGE_AMOUNT;
        
        if (KEYBOARD_SHORTCUTS.NUDGE.LEFT.includes(e.key)) {
          const newLeft = Math.round(Math.max(0, selectedElement.left - amount));
          updateElement(selectedElement.id, { left: newLeft });
        } else if (KEYBOARD_SHORTCUTS.NUDGE.RIGHT.includes(e.key)) {
          const newLeft = Math.round(Math.min(design.width - selectedElement.width, selectedElement.left + amount));
          updateElement(selectedElement.id, { left: newLeft });
        } else if (KEYBOARD_SHORTCUTS.NUDGE.UP.includes(e.key)) {
          const newTop = Math.round(Math.max(0, selectedElement.top - amount));
          updateElement(selectedElement.id, { top: newTop });
        } else if (KEYBOARD_SHORTCUTS.NUDGE.DOWN.includes(e.key)) {
          const newTop = Math.round(Math.min(design.height - selectedElement.height, selectedElement.top + amount));
          updateElement(selectedElement.id, { top: newTop });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement, setSelectedElement, setElements, elements, design.width, design.height, updateElement]);

  const handleDesignChange = (field: keyof typeof design) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    
    // Handle name field separately
    if (field === 'name') {
      setDesign({ ...design, name: value });
      return;
    }
    
    // For width and height, validate and convert to number
    if (field === 'width' || field === 'height') {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        const validValue = Math.round(Math.max(100, Math.min(10000, numValue))); // Max size of 10000px
        setDesign({
          ...design,
          [field]: validValue
        });
      }
    }
  };

  const handleDesignKeyDown = (field: keyof typeof design) => (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (field === 'name') return;

    // Prevent non-numeric input for width and height
    if (field === 'width' || field === 'height') {
      if (!/[\d\b]/.test(e.key) && // Allow only digits and backspace
          !['ArrowLeft', 'ArrowRight', 'Delete', 'Tab'].includes(e.key) && // Allow navigation keys
          !(e.ctrlKey || e.metaKey)) { // Allow copy/paste shortcuts
        e.preventDefault();
      }
    }
  };

  // Helper function to measure text dimensions
  const measureText = (text: string, fontSize: number, fontFamily: string, fontWeight: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.whiteSpace = 'nowrap';
    tempDiv.style.fontSize = `${fontSize}px`;
    tempDiv.style.fontFamily = fontFamily;
    tempDiv.style.fontWeight = fontWeight;
    tempDiv.innerText = text;
    document.body.appendChild(tempDiv);
    
    const dimensions = {
      width: Math.round(tempDiv.offsetWidth + 20), // Add padding
      height: Math.round(tempDiv.offsetHeight + 10) // Add padding
    };
    
    document.body.removeChild(tempDiv);
    return dimensions;
  };

  const handleElementChange = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!selectedElement) return;
    
    const value = e.target.value;
    
    // For position and size fields, validate and convert to number
    if (['left', 'top', 'width', 'height'].includes(field)) {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        let validValue = Math.round(numValue);
        
        // Apply constraints based on field
        if (field === 'width' || field === 'height') {
          validValue = Math.max(20, Math.min(design.width, numValue));
        } else {
          // For position, ensure element stays within canvas
          const maxPos = field === 'left' 
            ? design.width - (selectedElement.width || 0)
            : design.height - (selectedElement.height || 0);
          validValue = Math.max(0, Math.min(maxPos, numValue));
        }
        
        updateElement(selectedElement.id, {
          [field]: validValue
        });
      }
    } else if (field === 'content' && selectedElement.type === 'text') {
      // For text content, check if it overflows and adjust size if needed
      const dimensions = measureText(
        value || 'Sample Text',
        selectedElement.style?.fontSize || 16,
        selectedElement.style?.fontFamily || 'Arial',
        selectedElement.style?.fontWeight || 'normal'
      );
      
      updateElement(selectedElement.id, {
        content: value || 'Sample Text',
        width: Math.round(Math.max(selectedElement.width, dimensions.width)),
        height: Math.round(Math.max(selectedElement.height, dimensions.height))
      });
    }
  };

  const handleElementKeyDown = (field: string) => (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    // Prevent non-numeric input for position and size fields
    if (['left', 'top', 'width', 'height'].includes(field)) {
      if (!/[\d\b]/.test(e.key) && // Allow only digits and backspace
          !['ArrowLeft', 'ArrowRight', 'Delete', 'Tab'].includes(e.key) && // Allow navigation keys
          !(e.ctrlKey || e.metaKey)) { // Allow copy/paste shortcuts
        e.preventDefault();
      }
    }
  };

  const handleStyleChange = (property: string, value: string | number) => {
    if (!selectedElement) return;
    
    if (selectedElement.type === 'text') {
      // For properties that affect text dimensions, check if text overflows
      if (['fontSize', 'fontWeight', 'fontFamily'].includes(property)) {
        let fontSize = selectedElement.style?.fontSize || 16;
        let fontFamily = selectedElement.style?.fontFamily || 'Arial';
        let fontWeight = selectedElement.style?.fontWeight || 'normal';
        
        // Update the specific property being changed
        if (property === 'fontSize') {
          const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
          if (isNaN(numValue)) return;
          fontSize = numValue;
        } else if (property === 'fontFamily') {
          fontFamily = value as string;
        } else if (property === 'fontWeight') {
          fontWeight = value as string;
        }
        
        const dimensions = measureText(
          selectedElement.content || 'Sample Text',
          fontSize,
          fontFamily,
          fontWeight
        );
        
        updateElement(selectedElement.id, {
          style: {
            ...selectedElement.style,
            [property]: value,
          },
          width: Math.round(Math.max(selectedElement.width, dimensions.width)),
          height: Math.round(Math.max(selectedElement.height, dimensions.height))
        });
      } else {
        updateElement(selectedElement.id, {
          style: {
            ...selectedElement.style,
            [property]: value,
          },
        });
      }
    } else {
      updateElement(selectedElement.id, {
        style: {
          ...selectedElement.style,
          [property]: value,
        },
      });
    }
  };

  const Footer = () => (
    <div className="absolute bottom-0 left-0 right-0 border-t bg-white p-4">
      {selectedElement && (
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => {
              if (!selectedElement) return;
              if (window.confirm('Are you sure you want to delete this element?')) {
                setSelectedElement(null);
                setElements(elements.filter(el => el.id !== selectedElement.id));
              }
            }}
            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Element
          </button>
          <div className="text-xs text-gray-500 text-center">
            Use arrow keys to nudge position. Hold Shift for larger steps
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-[300px] border-l bg-white flex flex-col relative">
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {selectedElement ? (
          <div>
            <div className="space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Element Properties</h3>
                <button
                  className="p-1 hover:bg-gray-100 rounded-md"
                  onClick={() => setSelectedElement(null)}
                >
                  <FiX className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position X</label>
                <input
                  type="text"
                  value={Math.round(selectedElement.left)}
                  onChange={handleElementChange('left')}
                  onKeyDown={handleElementKeyDown('left')}
                  placeholder={`Min: 0, Max: ${Math.round(design.width - (selectedElement.width || 0))}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position Y</label>
                <input
                  type="text"
                  value={Math.round(selectedElement.top)}
                  onChange={handleElementChange('top')}
                  onKeyDown={handleElementKeyDown('top')}
                  placeholder={`Min: 0, Max: ${Math.round(design.height - (selectedElement.height || 0))}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                <input
                  type="text"
                  value={Math.round(selectedElement.width)}
                  onChange={handleElementChange('width')}
                  onKeyDown={handleElementKeyDown('width')}
                  placeholder="Min: 20, Max: Canvas Width"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                <input
                  type="text"
                  value={Math.round(selectedElement.height)}
                  onChange={handleElementChange('height')}
                  onKeyDown={handleElementKeyDown('height')}
                  placeholder="Min: 20, Max: Canvas Height"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Map API Data Field dropdown for all elements */}
              {design.apiDataKeys && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Map API Data Field</label>
                  <select
                    value={selectedElement.dataMapping?.content || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      
                      // Create updated dataMapping object
                      const updatedDataMapping = {
                        ...selectedElement.dataMapping,
                        content: value || null
                      };
                      
                      if (selectedElement.type === 'text' && value) {
                        // For text elements, update the content with the mapped value
                        const mappedValue = getValueFromPath(design.apiData, value);
                        updateElement(selectedElement.id, {
                          dataMapping: updatedDataMapping,
                          content: mappedValue || 'Sample Text'
                        });
                      } else if ((selectedElement.type === 'image' || selectedElement.type === 'video')) {
                        const updates: Partial<Element> = {
                          dataMapping: updatedDataMapping
                        };

                        if (value) {
                          // Check if there's a URL placeholder
                          if (selectedElement.urlPlaceholder) {
                            // Resolve the URL with the new field value
                            const resolvedUrl = resolvePlaceholderUrl(
                              selectedElement.urlPlaceholder,
                              value,
                              design.apiData
                            );
                            
                            if (isValidUrl(resolvedUrl)) {
                              updates.src = resolvedUrl;
                              updates.style = {
                                ...selectedElement.style,
                                objectFit: 'fill'
                              };
                            } else {
                              updates.src = undefined;
                              updates.style = {
                                ...selectedElement.style,
                                objectFit: undefined
                              };
                            }
                          } else {
                            // No URL placeholder, check if the mapped value itself is a URL
                            const mappedValue = getValueFromPath(design.apiData, value);
                            if (isValidUrl(mappedValue)) {
                              updates.src = mappedValue;
                              updates.style = {
                                ...selectedElement.style,
                                objectFit: 'fill'
                              };
                            } else {
                              updates.src = undefined;
                              updates.style = {
                                ...selectedElement.style,
                                objectFit: undefined
                              };
                            }
                          }
                        } else {
                          // "None" selected, clear src
                          updates.src = undefined;
                          updates.style = {
                            ...selectedElement.style,
                            objectFit: undefined
                          };
                        }
                        
                        updateElement(selectedElement.id, updates);
                      } else {
                        // For other cases
                        updateElement(selectedElement.id, {
                          dataMapping: updatedDataMapping
                        });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">None</option>
                    {design.apiDataKeys.map((key) => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </select>
                  {/* Preview of the mapped value from the first record */}
                  {selectedElement.dataMapping?.content && design.apiData && (
                    <div className="mt-1 text-xs text-gray-500">
                      Preview: {(() => {
                        const value = getValueFromPath(design.apiData, selectedElement.dataMapping.content);
                        if (value === null || value === undefined) return '';
                        if (typeof value === 'object') return JSON.stringify(value);
                        return String(value);
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* URL Placeholder for Image & Video elements */}
              {(selectedElement.type === 'image' || selectedElement.type === 'video') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL Placeholder</label>
                  <input
                    type="text"
                    value={selectedElement.urlPlaceholder || ''}
                    onChange={(e) => updateElement(selectedElement.id, { urlPlaceholder: e.target.value })}
                    onBlur={(e) => {
                      const value = e.target.value;
                      const updates: Partial<Element> = {
                        urlPlaceholder: value
                      };

                      // Process URL resolution if we have both placeholder and mapped field
                      if (selectedElement.dataMapping?.content && value) {
                        const resolvedUrl = resolvePlaceholderUrl(
                          value,
                          selectedElement.dataMapping.content,
                          design.apiData
                        );
                        
                        // Only set src and objectFit if resolved URL is valid
                        if (isValidUrl(resolvedUrl)) {
                          updates.src = resolvedUrl;
                          updates.style = {
                            ...selectedElement.style,
                            objectFit: 'fill'
                          };
                        } else {
                          updates.src = undefined;
                          updates.style = {
                            ...selectedElement.style,
                            objectFit: undefined
                          };
                        }
                      } else {
                        // Clear src and objectFit if we don't have both placeholder and mapped field
                        updates.src = undefined;
                        updates.style = {
                          ...selectedElement.style,
                          objectFit: undefined
                        };
                      }

                      // Update the element with all changes
                      updateElement(selectedElement.id, updates);
                    }}
                    placeholder="e.g., http://api.example.com/v1/asset/{data.icon}.png"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {'{field_name}'} to insert the value from the mapped API field (e.g., {'{data.icon}'})
                  </p>
                  
                  {/* Preview of the resolved URL with the actual value */}
                  {selectedElement.dataMapping?.content && selectedElement.urlPlaceholder && design.apiData && (
                    <div className="mt-1 text-xs text-gray-500">
                      Preview: {(() => {
                        const resolvedUrl = resolvePlaceholderUrl(
                          selectedElement.urlPlaceholder,
                          selectedElement.dataMapping.content,
                          design.apiData
                        );
                        return resolvedUrl || '';
                      })()}
                    </div>
                  )}
                </div>
              )}

              {selectedElement.type === 'text' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Text Content</label>
                    <input
                      type="text"
                      value={selectedElement.content || 'Sample Text'}
                      onChange={handleElementChange('content')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
                    <input
                      type="text"
                      value={Math.round(selectedElement.style?.fontSize || 16)}
                      onChange={(e) => {
                        const numValue = parseInt(e.target.value, 10);
                        if (!isNaN(numValue)) {
                          const validValue = Math.round(Math.max(8, Math.min(200, numValue))); // Font size between 8px and 200px
                          handleStyleChange('fontSize', validValue);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (!/[\d\b]/.test(e.key) && 
                            !['ArrowLeft', 'ArrowRight', 'Delete', 'Tab'].includes(e.key) &&
                            !(e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                        }
                      }}
                      placeholder="Min: 8, Max: 200"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Font Weight</label>
                    <select
                      value={selectedElement.style?.fontWeight || 'normal'}
                      onChange={(e) => handleStyleChange('fontWeight', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                      <option value="lighter">Light</option>
                      <option value="bolder">Bolder</option>
                      <option value="100">Thin (100)</option>
                      <option value="300">Light (300)</option>
                      <option value="400">Regular (400)</option>
                      <option value="500">Medium (500)</option>
                      <option value="600">Semi Bold (600)</option>
                      <option value="700">Bold (700)</option>
                      <option value="900">Black (900)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
                    <select
                      value={selectedElement.style?.fontFamily || 'Arial'}
                      onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="Arial">Arial</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Courier New">Courier New</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Verdana">Verdana</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Text Align</label>
                    <select
                      value={selectedElement.style?.textAlign || 'left'}
                      onChange={(e) => handleStyleChange('textAlign', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vertical Align</label>
                    <select
                      value={selectedElement.style?.verticalAlign || 'top'}
                      onChange={(e) => handleStyleChange('verticalAlign', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="top">Top</option>
                      <option value="middle">Middle</option>
                      <option value="bottom">Bottom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                    <input
                      type="color"
                      value={selectedElement.style?.color || '#000000'}
                      onChange={(e) => handleStyleChange('color', e.target.value)}
                      className="w-full h-10 px-1 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="font-medium">Design Properties</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Design Name</label>
              <input
                value={design.name}
                onChange={handleDesignChange('name')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
              <input
                type="text"
                value={Math.round(design.width)}
                onChange={handleDesignChange('width')}
                onKeyDown={handleDesignKeyDown('width')}
                placeholder="Min: 100, Max: 10000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
              <input
                type="text"
                value={Math.round(design.height)}
                onChange={handleDesignChange('height')}
                onKeyDown={handleDesignKeyDown('height')}
                placeholder="Min: 100, Max: 10000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
              <input
                type="color"
                value={design.backgroundColor || '#ffffff'}
                onChange={(e) => setDesign({ ...design, backgroundColor: e.target.value })}
                className="w-full h-10 px-1 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
              <div className="flex items-center">
                <input
                  value={design.apiUrl || ''}
                  onChange={(e) => setDesign({ ...design, apiUrl: e.target.value })}
                  onBlur={async (e) => {
                    const url = e.target.value;
                    if (!url) {
                      setDesign({ 
                        ...design, 
                        apiUrl: '', 
                        apiDataKeys: null, 
                        apiData: null, 
                        apiDataFetched: false 
                      });
                      return;
                    }
                    
                    try {
                      // Show loading indicator
                      setDesign({ ...design, apiUrl: url, apiDataFetched: false });
                      
                      const response = await fetch('/api/proxy', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ url }),
                      });

                      if (!response.ok) {
                        throw new Error('Failed to fetch data from API');
                      }

                      const data = await response.json();
                      
                      // Extract keys from the data (including nested keys with dot notation)
                      const keys = extractKeysFromData(data);
                      
                      setDesign({ 
                        ...design, 
                        apiUrl: url, 
                        apiDataKeys: keys, 
                        apiData: data, 
                        apiDataFetched: true 
                      });
                    } catch (error) {
                      console.error("Failed to fetch API data:", error);
                      setDesign({ 
                        ...design, 
                        apiUrl: url, 
                        apiDataKeys: null, 
                        apiData: null, 
                        apiDataFetched: false 
                      });
                    }
                  }}
                  placeholder="Enter API URL"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {design.apiUrl && (
                  <div className="ml-2">
                    {design.apiDataFetched ? (
                      <span className="text-green-500 text-sm flex items-center">
                        <FiCheck className="w-4 h-4 mr-1" />
                        Data loaded
                      </span>
                    ) : (
                      <span className="text-red-500 text-sm flex items-center">
                        <FiXCircle className="w-4 h-4 mr-1" />
                        No data
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
