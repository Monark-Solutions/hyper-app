'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DesignPage() {
  const router = useRouter();

  useEffect(() => {
    // Open editor in popup
    const editorWindow = window.open(
      '/dashboard/media/editor',
      'PosterMyWall Editor',
      'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no'
    );

    // Handle messages from editor
    const handleEditorMessage = (event: MessageEvent) => {
      if (event.data?.type === 'EDITOR_CLOSED') {
        router.push('/dashboard/media');
      }
    };

    window.addEventListener('message', handleEditorMessage);

    // Redirect to media page if popup blocked
    if (!editorWindow) {
      console.error('Popup blocked');
      router.push('/dashboard/media');
    }

    return () => {
      window.removeEventListener('message', handleEditorMessage);
      if (editorWindow) {
        editorWindow.close();
      }
    };
  }, [router]);

  // This page just opens the popup and redirects
  return null;
}
