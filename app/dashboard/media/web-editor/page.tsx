"use client";

import { EditorProvider } from '../../../../components/web-editor/EditorContext';
import { Canvas } from '../../../../components/web-editor/Canvas';
import { Sidebar } from '../../../../components/web-editor/Sidebar';
import { PropertiesPanel } from '../../../../components/web-editor/PropertiesPanel';
import { Topbar } from '../../../../components/web-editor/Topbar';

export default function WebEditorPage() {
  return (
    <EditorProvider>
      <div className="h-screen flex flex-col">
        <Topbar />
        <div className="flex-1 flex">
          <Sidebar />
          <Canvas />
          <PropertiesPanel />
        </div>
      </div>
    </EditorProvider>
  );
}
