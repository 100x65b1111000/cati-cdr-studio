import { redirect } from 'next/navigation';

// The views are routes now; the root only decides which one a bare visit gets.
export default function Home() {
  redirect('/rundown');
}
