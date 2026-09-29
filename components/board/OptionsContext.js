'use client';
import { createContext } from 'react';

// addOption(field, label) → Promise, provided by BoardGrid so a dropdown cell
// can add a new choice (e.g. an appraiser) without threading it through every row.
export const AddOptionContext = createContext(null);
