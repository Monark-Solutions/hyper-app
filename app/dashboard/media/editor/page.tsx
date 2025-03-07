'use client';

import React, { useEffect, useState } from 'react';
import Script from 'next/script';

// OAuth Configuration
// const CLIENT_KEY = 'e9DCzLMeQ84S0rpaHvCJ1hjDkJvprrOL';
// const CLIENT_SECRET = 'fs0FZyHn7fuju5wI';
// const REDIRECT_URI = 'http://localhost:3000/dashboard/media/editor';

const CLIENT_KEY = 'vq4nEFMZAIWUT2NoHhXSfaCPfPBhKGpi';
const CLIENT_SECRET = 'r00Otg8Appxg8TZG';
const REDIRECT_URI = 'http://cms.infokliks.com/dashboard/media/editor';

// Editor Configuration
const EDITOR_SCRIPT_URL = 'https://d1csarkz8obe9u.cloudfront.net/plugins/editor/postermywall-editor-v3.js';

declare global {
  interface Window {
    PMW: {
      plugin: {
        editor: {
          open: (options: {
            container: string;
            mode: string;
            elementsToHide: string[];
            onSave?: (data: string) => void;
            onClose?: () => void;
          }) => void;
        };
      };
    };
    pmwPluginEditorInit?: () => void;
    jso: any;
    $: any;
    moment: any;
  }
}

export default function EditorPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Loading...');
  const [scriptsLoaded, setScriptsLoaded] = useState(0);

  // Initialize editor after authentication
  const initializeEditor = () => {
    // Set initialization callback
    window.pmwPluginEditorInit = function() {
      console.log('Editor initialization callback triggered');
      if (window.PMW?.plugin?.editor) {
        window.PMW.plugin.editor.open({
          container: 'pmw-editor-container',
          mode: 'expert',
          elementsToHide: ['download', 'file', 'upgrade'],
          onSave: (designId) => {
            console.log('Design saved:', designId);
            window.opener?.postMessage({ type: 'EDITOR_CLOSED' }, '*');
            window.close();
          },
          onClose: () => {
            window.opener?.postMessage({ type: 'EDITOR_CLOSED' }, '*');
            window.close();
          }
        });
        setIsLoading(false);
      }
    };

    // Load editor script
    const script = document.createElement('script');
    script.src = EDITOR_SCRIPT_URL;
    script.async = false;
    script.defer = false;
    document.head.appendChild(script);
  };

  // Handle script load completion
  const handleScriptLoad = () => {
    setScriptsLoaded(prev => {
      const newCount = prev + 1;
      if (newCount === 3) { // All scripts loaded
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (!code) {
          console.log('Starting new OAuth flow');
          let client = new window.jso.JSO({
            client_id: CLIENT_KEY,
            redirect_uri: REDIRECT_URI,
            authorization: 'https://api.postermywall.com/v1/oauth/authorize',
            scopes: { request: ['designs.read', 'designs.write'] }
          });
          client.callback();
          client.getToken()
            .then((token: any) => {
              console.log('Got token:', token);
              if (token.code) {
                // Exchange code for token
                const authHeader = 'Basic ' + btoa(`${CLIENT_KEY}:${CLIENT_SECRET}`);
                window.$.ajax({
                  url: 'https://api.postermywall.com/v1/oauth/token/',
                  type: 'POST',
                  dataType: 'json',
                  contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
                  headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/x-www-form-urlencoded'
                  },
                  data: {
                    grant_type: 'authorization_code',
                    redirect_uri: REDIRECT_URI,
                    code: token.code
                  },
                  success: function(result: any) {
                    console.log('Token exchange success:', result);
                    const userId = result.user_id;
                    const accessToken = 'Bearer ' + result.access_token;
                    console.log('User ID:', userId);
                    console.log('Access Token:', accessToken);
                    initializeEditor();
                  },
                  error: function(error: any) {
                    console.error('Token exchange error:', error);
                    setLoadingText('Authentication failed');
                  }
                });
              }
            })
            .catch((error: any) => {
              console.error('OAuth error:', error);
              setLoadingText('Authentication failed');
            });
        } else {
          console.log('Exchanging code for token');
          const authHeader = 'Basic ' + btoa(`${CLIENT_KEY}:${CLIENT_SECRET}`);
          window.$.ajax({
            url: 'https://api.postermywall.com/v1/oauth/token/',
            type: 'POST',
            dataType: 'json',
            contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: {
              grant_type: 'authorization_code',
              redirect_uri: REDIRECT_URI,
              code: code
            },
            success: function(result: any) {
              console.log('Token exchange success:', result);
              const userId = result.user_id;
              const accessToken = 'Bearer ' + result.access_token;
              console.log('User ID:', userId);
              console.log('Access Token:', accessToken);
              initializeEditor();
            },
            error: function(error: any) {
              console.error('Token exchange error:', error);
              setLoadingText('Authentication failed');
            }
          });
        }
      }
      return newCount;
    });
  };

  return (
    <>
      <Script 
        src="https://code.jquery.com/jquery-3.7.0.min.js"
        onLoad={handleScriptLoad}
      />
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.4/moment-with-locales.min.js"
        onLoad={handleScriptLoad}
      />
      <Script 
        src="/js/jso.js"
        onLoad={handleScriptLoad}
      />
      <div className="w-full h-screen">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="text-lg text-gray-700">{loadingText}</div>
          </div>
        ) : (
          <div id="pmw-editor-container" className="w-full h-full" />
        )}
      </div>
    </>
  );
}
