import ViewRenderer from './ViewRenderer';

export function generateStaticParams() {
  return [
    { view: 'rundown' },
    { view: 'rawCdr' },
    { view: 'analytics' },
    { view: 'directory' },
    { view: 'settings' }
  ];
}

export default async function ViewPage({ params }) {
  const { view } = await params;
  return <ViewRenderer viewId={view} />;
}
