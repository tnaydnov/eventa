import { ChatRoomSkeleton } from '@/components/Skeletons';

export default function ChatRoomLoading() {
  return (
    <div className="app-container">
      <div style={{ height: '56px', background: 'var(--background, #0a0a0a)' }} />
      <div className="main-content">
        <ChatRoomSkeleton />
      </div>
    </div>
  );
}
