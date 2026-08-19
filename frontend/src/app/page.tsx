import { Dashboard } from '@/components/Dashboard';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '📍 TrackIt Live Location Dashboard',
  description: 'Real-time background geolocation tracking visualizer for react-native-trackit built with Next.js, React, TypeScript & Leaflet.',
};

export default function Home() {
  return <Dashboard />;
}
