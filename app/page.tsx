"use client";
import ParentView from './parent-view';
import { useApi } from './ui';
export default function ParentPage() { const api = useApi('parent'); return <ParentView api={api} />; }
