"use client";
import { useCallback, useEffect, useState } from 'react';
import StaffView from './staff-view';
import { useApi } from '../ui';

const KEY = 'supportyou-staff-facility';

export default function StaffPage() {
  const [facility, setFacilityState] = useState<string | null>(null);
  useEffect(() => {
    let initial = new URLSearchParams(location.search).get('f') || '';
    if (!initial) try { initial = localStorage.getItem(KEY) || ''; } catch { }
    setFacilityState(initial);
  }, []);
  const setFacility = useCallback((id: string) => {
    setFacilityState(id);
    try { localStorage.setItem(KEY, id); } catch { }
    const url = new URL(location.href); if (id) url.searchParams.set('f', id); else url.searchParams.delete('f');
    history.replaceState(null, '', url);
  }, []);
  return facility === null ? null : <Staff facility={facility} setFacility={setFacility} />;
}

function Staff({ facility, setFacility }: { facility: string, setFacility: (id: string) => void }) {
  const api = useApi('staff', facility);
  const s = api.state;
  // A remembered facility that is no longer accessible falls back to the first one.
  useEffect(() => {
    if (!s?.authenticated || !s.facilities) return;
    const ids = s.facilities.map((f: { id: string }) => f.id);
    if (facility && !ids.includes(facility)) setFacility(ids[0] || '');
    else if (!facility && ids.length === 1) setFacility(ids[0]);
  }, [s, facility, setFacility]);
  return <StaffView api={api} facility={facility} setFacility={setFacility} />;
}
