"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ElementType = 'text' | 'image' | 'video';

export interface Element {
  id: string;
  type: ElementType;
  top: number;
  left: number;
  width: number;
  height: number;
  content?: string;
  src?: string;
  urlPlaceholder?: string;
  dataMapping?: {
    [key: string]: string | null;
  };
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    textAlign?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'middle' | 'bottom';
    objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  };
}

interface Design {
  name: string;
  width: number;
  height: number;
  apiUrl?: string;
  backgroundColor?: string;
  apiDataKeys?: string[] | null;
  apiData?: any;
  apiDataFetched?: boolean;
}

interface EditorContextType {
  design: Design;
  setDesign: (design: Design) => void;
  elements: Element[];
  setElements: (elements: Element[]) => void;
  addElement: (element: Element) => void;
  updateElement: (id: string, updates: Partial<Element>) => void;
  selectedElement: Element | null;
  setSelectedElement: (element: Element | null) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  apiData: any;
  setApiData: (data: any) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [design, setDesign] = useState<Design>({
    name: 'Untitled Design',
    width: 1920,
    height: 1080,
    backgroundColor: '#ffffff',
  });
  const [elements, setElements] = useState<Element[]>([]);
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);
  const [zoom, setZoom] = useState(0.4); // 40% default zoom
  const [apiData, setApiData] = useState<any>(null);

  const addElement = useCallback((element: Element) => {
    setElements((prev) => [...prev, element]);
  }, []);

  const updateElement = useCallback((id: string, updates: Partial<Element>) => {
    setElements((prev) => 
      prev.map((el) => {
        if (el.id === id) {
          const updated = { ...el, ...updates };
          // Update selected element if this is the one being modified
          setSelectedElement((current) => 
            current?.id === id ? updated : current
          );
          return updated;
        }
        return el;
      })
    );
  }, []);

  return (
    <EditorContext.Provider
      value={{
        design,
        setDesign,
        elements,
        setElements,
        addElement,
        updateElement,
        selectedElement,
        setSelectedElement,
        zoom,
        setZoom,
        apiData,
        setApiData,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const context = useContext(EditorContext);
  if (context === undefined) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
}
