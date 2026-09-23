"use client";
import { useParams } from 'next/navigation';
import ParentView from '../../parent-view';
import { useApi } from '../../ui';

export default function FacilityParentPage() {
  const { slug } = useParams<{ slug: string }>();
  const api = useApi('parent', slug);
  return <ParentView api={api} facilityId={slug} />;
}
