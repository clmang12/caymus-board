'use client';
import { useEffect, useRef } from 'react';

// Uncontrolled input (commits on blur, no re-render per keystroke) that still
// shows changes made elsewhere — a teammate's edit over realtime, or an undo —
// unless the user is in the middle of editing it.
export default function SyncedInput({ value, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.value !== value) el.value = value;
  }, [value]);
  return <input ref={ref} defaultValue={value} {...props} />;
}
