"use client";
import { useEffect, useState, type ComponentProps } from 'react';
import { lineEntry, isLinePath } from '@/lib/line-entry.mjs';
import { revealById, WorkflowTabs as BaseTabs } from './interaction';
const storageKey='supportyou-parent-active-tab';
const allowed=new Set(['bookings','children','guide']);
export function PersistentParentTabs(props:ComponentProps<typeof BaseTabs>){
 const [value,setValue]=useState('bookings');
 useEffect(()=>{let saved='';if(isLinePath(location.pathname))saved=lineEntry(location.search).tab;else try{saved=localStorage.getItem(storageKey)||'';}catch{}const timer=setTimeout(()=>{if(allowed.has(saved))setValue(saved);if(isLinePath(location.pathname))revealById(lineEntry(location.search).target);},0);return()=>clearTimeout(timer);},[]);
 return <BaseTabs {...props} value={value} onValueChange={next=>{if(!allowed.has(next))return;setValue(next);try{localStorage.setItem(storageKey,next);}catch{}props.onValueChange?.(next);}}/>;
}
