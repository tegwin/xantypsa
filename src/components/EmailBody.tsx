'use client';

// ============================================================
// Showing an email the way it was written
// ============================================================
// Customer HTML, rendered in a sandboxed frame with no scripts, no same-origin
// access and no form submission. That is a stronger guarantee than a sanitiser,
// which has to be right about every tag; this is right by construction.

import { useEffect, useRef, useState } from 'react';

export default function EmailBody({ html, text }: { html?: string | null; text: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);

  // Grow the frame to its content, so an email is not read through a letterbox.
  useEffect(() => {
    if (!html) return;
    const resize = () => {
      const doc = frame.current?.contentDocument;
      if (doc?.body) setHeight(Math.min(doc.body.scrollHeight + 16, 900));
    };
    const timer = setTimeout(resize, 50);
    return () => clearTimeout(timer);
  }, [html]);

  if (!html) {
    return <p className="whitespace-pre-wrap text-sm text-surface-300">{text}</p>;
  }

  // A light page, because that is what the customer's mail client showed them
  // and an email written for white will be unreadable on dark.
  const srcDoc = `<!doctype html><meta charset="utf-8">
<base target="_blank">
<style>
  body{margin:0;padding:12px;background:#fff;color:#111;
       font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;
       word-break:break-word}
  img{max-width:100%;height:auto}
  blockquote{margin:0 0 0 12px;padding-left:12px;border-left:3px solid #ddd;color:#555}
  table{max-width:100%}
</style>
<body>${html}</body>`;

  return (
    <iframe
      ref={frame}
      title="Message"
      sandbox=""
      srcDoc={srcDoc}
      onLoad={() => {
        const doc = frame.current?.contentDocument;
        if (doc?.body) setHeight(Math.min(doc.body.scrollHeight + 16, 900));
      }}
      style={{ height }}
      className="w-full rounded-lg border border-surface-700/50 bg-white"
    />
  );
}
