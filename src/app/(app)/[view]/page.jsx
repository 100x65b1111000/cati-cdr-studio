'use client';

import { notFound, usePathname } from 'next/navigation';
import { NAV } from '../../../components/layout/navConfig';

// The URL segment is the view id, so the route list needs no second source of truth.
// Each view arrives through navConfig's lazy import, which is where the code splitting
// actually happens now.
export default function ViewPage() {
  const id = usePathname().split('/')[1];
  const view = NAV.find((n) => n.id === id);
  if (!view) notFound();
  const View = view.component;
  return <View />;
}
