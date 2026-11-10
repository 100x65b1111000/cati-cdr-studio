'use client';

import { notFound } from 'next/navigation';
import { NAV } from '../../../components/layout/navConfig';

export default function ViewRenderer({ viewId }) {
  const view = NAV.find((n) => n.id === viewId);
  if (!view) notFound();
  const View = view.component;
  return <View />;
}
