'use client';
import { createContext } from 'react';

// Provided by BoardGrid so a dropdown cell can edit the board's choices without
// threading callbacks through every row:
//   addOption(field, label) → Promise, removeOption(field, label) → Promise,
//   countUses(key, label) → number of deals using it, notify(text) shows the toast.
export const OptionsContext = createContext(null);
