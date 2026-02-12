export default function EventLoading() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        background: 'var(--background, #0a0a0a)',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          border: '3px solid rgba(233, 30, 99, 0.2)',
          borderTopColor: '#e91e63',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
