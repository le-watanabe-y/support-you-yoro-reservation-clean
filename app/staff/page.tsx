"use client";
import StaffView from './staff-view';
import { useApi } from '../ui';
export default function StaffPage() { const api = useApi('staff'); return <StaffView api={api} />; }
