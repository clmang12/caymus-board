'use client';
import { useMemo } from 'react';
import { isRichText, sanitizeHtml } from '@/lib/richtext';

// Shows an update body: sanitized HTML from the rich composer, or plain text.
export default function UpdateBody({ body, className = 'update-body' }) {
  const html = useMemo(() => (isRichText(body) ? sanitizeHtml(body) : null), [body]);
  if (html === null) return <div className={className}>{body}</div>;
  return <div className={className + ' rich'} dangerouslySetInnerHTML={{ __html: html }} />;
}
