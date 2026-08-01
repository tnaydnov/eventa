import { LikesSkeleton } from '@/components/Skeletons';

export default function LikesLoading() {
  return (
    <div className="app-container">
      <div style={{ height: '56px' }} />
      <div className="main-content">
        <LikesSkeleton />
      </div>
      <div style={{ height: '64px' }} />
    </div>
  );
}
