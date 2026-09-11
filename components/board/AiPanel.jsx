'use client';
import { useEffect, useRef, useState } from 'react';
import { buildBoardContext, buildSystemPrompt, parseActions, describeAction } from '@/lib/ai/prompt';
import { applyActions } from '@/lib/ai/applyActions';

export default function AiPanel({ sb, tree, boardId, options, userId, onClose }) {
  const [messages, setMessages] = useState([]); // { role, text, actions?, applied? }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [applyingAt, setApplyingAt] = useState(null);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setError(null);
    const history = [...messages, { role: 'user', text }];
    setMessages(history);
    setBusy(true);
    try {
      const system = buildSystemPrompt(buildBoardContext(tree, options));
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ system, messages: history.map((m) => ({ role: m.role, content: m.text })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      const { clean, actions } = parseActions(data.completion || '');
      setMessages((m) => [...m, { role: 'assistant', text: clean || '(no response)', actions }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async (msgIndex) => {
    setApplyingAt(msgIndex);
    setError(null);
    try {
      await applyActions(sb, messages[msgIndex].actions, { tree, boardId, userId });
      setMessages((m) => m.map((mm, i) => (i === msgIndex ? { ...mm, applied: true } : mm)));
    } catch (e) {
      setError(e.message);
    } finally {
      setApplyingAt(null);
    }
  };

  return (
    <div className="ai-overlay" onClick={onClose}>
      <div className="ai-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ai-head">
          <span>✨ AI Assistant</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="ai-body">
          {messages.length === 0 && (
            <div className="ai-empty">
              Ask about this board, or ask me to make changes —
              e.g. &ldquo;mark all submitted deals as approved&rdquo; or &ldquo;move Sanita, Christina to Active Deals&rdquo;.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={'ai-msg ' + m.role}>
              <div className="ai-msg-col">
                <div className="ai-msg-text">{m.text}</div>
                {m.actions?.length > 0 && (
                  <div className="ai-actions">
                    {m.actions.map((a, j) => (
                      <div key={j} className="ai-action-row">{describeAction(a, tree)}</div>
                    ))}
                    {!m.applied ? (
                      <button className="board-btn ai-apply" disabled={applyingAt === i} onClick={() => apply(i)}>
                        {applyingAt === i ? 'Applying…' : `Apply ${m.actions.length} change${m.actions.length > 1 ? 's' : ''}`}
                      </button>
                    ) : (
                      <div className="ai-applied">✓ Applied</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="ai-msg assistant"><div className="ai-msg-col"><div className="ai-msg-text">…</div></div></div>}
          {error && <div className="ai-error">{error}</div>}
          <div ref={bottomRef} />
        </div>
        <div className="ai-input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about this board…"
            rows={2}
          />
          <button className="board-btn" onClick={send} disabled={busy || !input.trim()}>Send</button>
        </div>
      </div>
    </div>
  );
}
