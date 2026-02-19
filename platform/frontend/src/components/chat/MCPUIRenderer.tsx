import React, { useEffect, useRef, useState } from 'react';

interface MCPUIProps {
  resourceUri: string;
  renderData?: any;
  onIntent?: (intent: string, params: any) => void;
  onToolCall?: (toolName: string, params: any) => Promise<any>;
  onPrompt?: (prompt: string) => void;
  onLink?: (url: string) => void;
}

const MCPUIRenderer: React.FC<MCPUIProps> = ({
  resourceUri,
  renderData,
  onIntent,
  onToolCall,
  onPrompt,
  onLink,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState('200px');

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Security: Validate origin if needed
      // if (event.origin !== expectedOrigin) return;

      const { type, messageId, payload } = event.data;

      switch (type) {
        case 'ui-lifecycle-iframe-ready':
          // Iframe is ready, send initial render data
          iframeRef.current?.contentWindow?.postMessage({
            type: 'ui-lifecycle-iframe-render-data',
            payload: { renderData }
          }, '*');
          break;

        case 'ui-size-change':
          if (payload?.height) {
            setHeight(`${payload.height}px`);
          }
          break;

        case 'intent':
          onIntent?.(payload.intent, payload.params);
          break;

        case 'tool':
          if (onToolCall) {
            try {
              // Acknowledge receipt
              iframeRef.current?.contentWindow?.postMessage({
                type: 'ui-message-received',
                messageId
              }, '*');

              const result = await onToolCall(payload.toolName, payload.params);
              
              // Send response
              iframeRef.current?.contentWindow?.postMessage({
                type: 'ui-message-response',
                messageId,
                payload: { response: result }
              }, '*');
            } catch (error) {
              iframeRef.current?.contentWindow?.postMessage({
                type: 'ui-message-response',
                messageId,
                payload: { error: String(error) }
              }, '*');
            }
          }
          break;

        case 'prompt':
          onPrompt?.(payload.prompt);
          break;

        case 'link':
          if (payload.url) {
            if (onLink) {
              onLink(payload.url);
            } else {
              window.open(payload.url, '_blank');
            }
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [renderData, onIntent, onToolCall, onPrompt, onLink]);

  return (
    <div className="mcp-ui-container w-full border rounded-lg overflow-hidden bg-background">
      <iframe
        ref={iframeRef}
        src={`${resourceUri}?waitForRenderData=true`}
        style={{ width: '100%', height, border: 'none' }}
        sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
        title="MCP App UI"
      />
    </div>
  );
};

export default MCPUIRenderer;
