import { ChatsSkeleton } from '@/components/Skeletons';

export default function ChatsLoading() {
  return (
    <div className="app-container">
      <div style={{ height: '56px' }} />
      <div className="main-content">
        <ChatsSkeleton />
      </div>
      <div style={{ height: '64px' }} />
    </div>
  );
}
