// Older LINE menu links without a facility go to the facility directory.
"use client";
import { useEffect } from 'react';
export default function LegacyLine() { useEffect(() => { location.replace('/'); }, []); return null; }
