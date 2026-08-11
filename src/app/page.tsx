import { redirect } from 'next/navigation';

/** Landing page redirects straight to the trading dashboard. */
export default function Home() {
  redirect('/dashboard');
}
