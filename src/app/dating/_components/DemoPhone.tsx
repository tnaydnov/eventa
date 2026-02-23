'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/* ═══════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════ */

type User = { name: string; age: number; city: string; bio: string; gender: string; seed: string; photo: string; lookingFor: string };
type Msg = { id: number; text: string; type: 'text' | 'system'; sent: boolean; time: string };
type Screen = 'grid' | 'swipe' | 'user' | 'chats' | 'chat' | 'likes' | 'profile';
type LikesTab = 'matches' | 'received' | 'sent';

const USERS: User[] = [
  { name: 'נועה', age: 24, city: 'תל אביב', bio: 'אוהבת ריקודים, מוזיקה וערבי יין 🍷', gender: 'נקבה', seed: 'Noa24f', lookingFor: 'קשר רציני', photo: '/demo/noa.jpg' },
  { name: 'איתי', age: 27, city: 'הרצליה', bio: 'סרפר בשבתות, שף חובב בימי חול 🏄‍♂️', gender: 'זכר', seed: 'Itay27m', lookingFor: 'משהו קליל', photo: '/demo/itay.jpg' },
  { name: 'מאיה', age: 25, city: 'רמת גן', bio: 'מעצבת גרפית, חולמת בגדול 🎨', gender: 'נקבה', seed: 'Maya25f', lookingFor: 'חברים/ות', photo: '/demo/maya.jpg' },
  { name: 'דניאל', age: 28, city: 'תל אביב', bio: 'מפתח תוכנה ואוהב טיולים בטבע 🌿', gender: 'זכר', seed: 'Daniel28m', lookingFor: 'קשר רציני', photo: '/demo/daniel.jpg' },
  { name: 'שיר', age: 23, city: 'חיפה', bio: 'סטודנטית לפסיכולוגיה, אוהבת חתולים 🐱', gender: 'נקבה', seed: 'Shir23f', lookingFor: 'עוד לא יודע/ת', photo: '/demo/shir.jpg' },
  { name: 'עומר', age: 26, city: 'ראשון לציון', bio: 'מוזיקאי וצלם חובב 📸', gender: 'זכר', seed: 'Omer26m', lookingFor: 'משהו קליל', photo: '/demo/omer.jpg' },
  { name: 'תמר', age: 25, city: 'תל אביב', bio: 'עורכת דין ביום, יוגיסטית בלילה 🧘‍♀️', gender: 'נקבה', seed: 'Tamar25f', lookingFor: 'קשר רציני', photo: '/demo/tamar.jpg' },
  { name: 'יונתן', age: 29, city: 'פתח תקווה', bio: 'מהנדס מזון, שוחרי אוכל טוב 🍕', gender: 'זכר', seed: 'Yonatan29m', lookingFor: 'חברים/ות', photo: '/demo/yonatan.jpg' },
  { name: 'ליאור', age: 24, city: 'גבעתיים', bio: 'רקדנית היפ-הופ, חיוכים 24/7 💃', gender: 'נקבה', seed: 'Lior24f', lookingFor: 'משהו קליל', photo: '/demo/lior.jpg' },
  { name: 'רועי', age: 27, city: 'כפר סבא', bio: 'רואה חשבון עם תשוקה לקומדיות 😂', gender: 'זכר', seed: 'Roi27m', lookingFor: 'עוד לא יודע/ת', photo: '/demo/roi.jpg' },
  { name: 'אגם', age: 22, city: 'הוד השרון', bio: 'סטודנטית לאומנות, צמחונית גאה 🌻', gender: 'נקבה', seed: 'Agam22f', lookingFor: 'חברים/ות', photo: '/demo/agam.jpg' },
  { name: 'אלון', age: 30, city: 'תל אביב', bio: 'יזם סטארטאפ עם חלום 🚀', gender: 'זכר', seed: 'Alon30m', lookingFor: 'קשר רציני', photo: '/demo/alon.jpg' },
  { name: 'נועם', age: 26, city: 'באר שבע', bio: 'מדריכת כושר ואוהבת טבע 💪', gender: 'נקבה', seed: 'Noam26f', lookingFor: 'משהו קליל', photo: '/demo/noam.jpg' },
  { name: 'גיל', age: 25, city: 'נתניה', bio: 'דיג׳יי בסופשים ומתכנת בשאר הזמן 🎵', gender: 'זכר', seed: 'Gil25m', lookingFor: 'עוד לא יודע/ת', photo: '/demo/gil.jpg' },
  { name: 'הילה', age: 23, city: 'רעננה', bio: 'אופטימיסטית מטבע, אוהבת ים 🌊', gender: 'נקבה', seed: 'Hila23f', lookingFor: 'קשר רציני', photo: '/demo/hila.jpg' },
  { name: 'תומר', age: 28, city: 'מודיעין', bio: 'רופא שיניים בהכשרה, חייכו! 😁', gender: 'זכר', seed: 'Tomer28m', lookingFor: 'משהו קליל', photo: '/demo/tomer.jpg' },
  { name: 'רוני', age: 24, city: 'תל אביב', bio: 'בואו נהיה חברות קודם ☕', gender: 'נקבה', seed: 'Roni24f', lookingFor: 'חברים/ות', photo: '/demo/roni.jpg' },
  { name: 'עידו', age: 31, city: 'ירושלים', bio: 'עורך דין, ספרן מושבע, רץ מרתון 📚', gender: 'זכר', seed: 'Ido31m', lookingFor: 'קשר רציני', photo: '/demo/ido.jpg' },
];

const LIKED_BY = new Set(['Shir23f', 'Agam22f', 'Roni24f']);
const PRE_MATCHED = new Set(['Tamar25f', 'Noa24f']);

const INITIAL_CONVOS: Record<string, Msg[]> = {
  Tamar25f: [
    { id: 1, text: 'היי! 😊', type: 'text', sent: false, time: '20:14' },
    { id: 2, text: 'היי תמר, מה קורה?', type: 'text', sent: true, time: '20:15' },
    { id: 3, text: 'הכל טוב! אירוע מדהים, לא?', type: 'text', sent: false, time: '20:16' },
    { id: 4, text: 'ממש! רוצה להיפגש?', type: 'text', sent: true, time: '20:18' },
  ],
  Noa24f: [
    { id: 1, text: 'היי!', type: 'text', sent: true, time: '20:20' },
    { id: 2, text: 'היי 🥰 נעים מאוד', type: 'text', sent: false, time: '20:21' },
  ],
};

const AUTO_REPLIES = ['😊 נעים מאוד!', 'כן! אירוע מדהים', 'מסכים/ה לגמרי 😂', 'בוא/י נדבר אחרי?', 'תודה על הלייק 💕', 'איזה כיף!'];

/* ═══════════════════════════════════════════
   SVG ICONS - exact copies from real app
   ═══════════════════════════════════════════ */

const I = {
  grid: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" aria-hidden="true" focusable="false"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  swipe: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" aria-hidden="true" focusable="false"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 21h8"/></svg>,
  chatTab: (c = 'currentColor') => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" aria-hidden="true" focusable="false"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  chatLg: (c = 'currentColor') => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" aria-hidden="true" focusable="false"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  heartTab: (c = 'currentColor') => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" aria-hidden="true" focusable="false"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  heartFill: (c = 'currentColor', s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke="none" aria-hidden="true" focusable="false"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  person: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  personSm: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  back: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false"><path d="M19 12H5M12 19l7-7-7-7"/></svg>,
  close: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" focusable="false"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  send: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>,
  block: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  dots: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>,
  camera: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
};

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */

// Helper: makes a div act like a button for keyboard users (WCAG 2.1.1)
const kbClick = (handler: () => void) => ({
  role: 'button' as const,
  tabIndex: 0,
  onClick: handler,
  onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } },
});

export default function DemoPhone() {
  const [screen, setScreen] = useState<Screen>('grid');
  const [activeTab, setActiveTab] = useState<'grid' | 'chats' | 'likes'>('grid');
  const [viewMode, setViewMode] = useState<'grid' | 'swipe'>('grid');
  const [likesTab, setLikesTab] = useState<LikesTab>('matches');

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [chatUser, setChatUser] = useState<User | null>(null);
  const [likedUsers, setLikedUsers] = useState<Set<string>>(new Set());
  const [sentLikes, setSentLikes] = useState<Set<string>>(new Set());
  const [matchedUsers, setMatchedUsers] = useState<Set<string>>(new Set(PRE_MATCHED));
  const [skippedUsers, setSkippedUsers] = useState<Set<string>>(new Set());
  const [matchPopup, setMatchPopup] = useState<User | null>(null);
  const [convos, setConvos] = useState<Record<string, Msg[]>>(() => JSON.parse(JSON.stringify(INITIAL_CONVOS)));
  const [chatInput, setChatInput] = useState('');
  const [myName, setMyName] = useState('');
  const [myAge, setMyAge] = useState('');
  const [myCity, setMyCity] = useState('');
  const [myBio, setMyBio] = useState('');
  const [myGender, setMyGender] = useState('');
  const [myAttracted, setMyAttracted] = useState('');
  const [myLooking, setMyLooking] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  const [swipeDelta, setSwipeDelta] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [exitDir, setExitDir] = useState<'left' | 'right' | null>(null);
  const startXRef = useRef(0);
  const msgsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight; }, [convos, chatUser]);

  // ─── Handlers ───
  const goTab = useCallback((tab: 'grid' | 'chats' | 'likes') => {
    setActiveTab(tab);
    if (tab === 'grid') setScreen(viewMode === 'swipe' ? 'swipe' : 'grid');
    else if (tab === 'chats') setScreen('chats');
    else { setScreen('likes'); setLikesTab('matches'); }
    setSelectedUser(null);
  }, [viewMode]);

  const toggleView = useCallback((mode: 'grid' | 'swipe') => { setViewMode(mode); setScreen(mode); }, []);

  const doLike = useCallback((user: User) => {
    setLikedUsers(p => { const n = new Set(p); n.add(user.seed); return n; });
    setSentLikes(p => { const n = new Set(p); n.add(user.seed); return n; });
    if (LIKED_BY.has(user.seed) && !matchedUsers.has(user.seed)) {
      setMatchedUsers(p => { const n = new Set(p); n.add(user.seed); return n; });
      setConvos(p => ({ ...p, [user.seed]: [{ id: 1, text: '✨ יש לכם מאצ׳!', type: 'system', sent: false, time: 'עכשיו' }] }));
      setMatchPopup(user);
      setTimeout(() => {
        setConvos(p => ({ ...p, [user.seed]: [...(p[user.seed] || []), { id: 2, text: 'היי! 😊', type: 'text', sent: false, time: 'עכשיו' }] }));
      }, 3000);
    }
  }, [matchedUsers]);

  const doSkip = useCallback((user: User) => { setSkippedUsers(p => { const n = new Set(p); n.add(user.seed); return n; }); }, []);
  const openUser = useCallback((user: User) => { setSelectedUser(user); setScreen('user'); }, []);
  const openChat = useCallback((user: User) => { setChatUser(user); setScreen('chat'); setChatInput(''); }, []);

  const sendMessage = useCallback(() => {
    if (!chatInput.trim() || !chatUser) return;
    const text = chatInput.trim();
    setChatInput('');
    setConvos(p => ({ ...p, [chatUser.seed]: [...(p[chatUser.seed] || []), { id: Date.now(), text, type: 'text', sent: true, time: 'עכשיו' }] }));
    const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
    setTimeout(() => {
      setConvos(p => ({ ...p, [chatUser.seed]: [...(p[chatUser.seed] || []), { id: Date.now(), text: reply, type: 'text', sent: false, time: 'עכשיו' }] }));
    }, 1500);
  }, [chatInput, chatUser]);

  // Swipe pointer
  const onPointerDown = useCallback((e: React.PointerEvent) => { startXRef.current = e.clientX; setSwiping(true); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => { if (!swiping) return; setSwipeDelta(e.clientX - startXRef.current); }, [swiping]);
  const swipeableUsers = USERS.filter(u => !likedUsers.has(u.seed) && !skippedUsers.has(u.seed));
  const currentSwipe = swipeableUsers[0];
  const nextSwipe = swipeableUsers[1];
  const onPointerUp = useCallback(() => {
    setSwiping(false);
    if (Math.abs(swipeDelta) > 60 && currentSwipe) {
      const dir = swipeDelta > 0 ? 'right' : 'left';
      setExitDir(dir);
      setTimeout(() => { if (dir === 'right') doLike(currentSwipe); else doSkip(currentSwipe); setExitDir(null); setSwipeDelta(0); }, 300);
    } else setSwipeDelta(0);
  }, [swipeDelta, currentSwipe, doLike, doSkip]);
  const handleSwipeBtnLike = useCallback(() => { if (!currentSwipe) return; setExitDir('right'); setTimeout(() => { doLike(currentSwipe); setExitDir(null); setSwipeDelta(0); }, 300); }, [currentSwipe, doLike]);
  const handleSwipeBtnSkip = useCallback(() => { if (!currentSwipe) return; setExitDir('left'); setTimeout(() => { doSkip(currentSwipe); setExitDir(null); setSwipeDelta(0); }, 300); }, [currentSwipe, doSkip]);

  // Derived
  const pendingLikes = USERS.filter(u => LIKED_BY.has(u.seed) && !likedUsers.has(u.seed));
  const receivedLikeUsers = USERS.filter(u => LIKED_BY.has(u.seed));
  const sentLikeUsers = USERS.filter(u => sentLikes.has(u.seed));
  const matchList = USERS.filter(u => matchedUsers.has(u.seed));
  const chatListData = matchList.map(u => ({
    user: u, lastMsg: (convos[u.seed] || []).slice(-1)[0],
    unread: (convos[u.seed] || []).filter(m => !m.sent).length > 0,
    unreadCount: (convos[u.seed] || []).filter(m => !m.sent).length,
  }));
  const likeBadge = pendingLikes.length;
  const chatBadge = chatListData.filter(c => c.unread).length;
  const mainScreens: Screen[] = ['grid', 'swipe', 'chats', 'likes'];
  const showTabBar = mainScreens.includes(screen);
  const showHeader = mainScreens.includes(screen);

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */

  // ── Header (exact match of AppHeader.tsx) ──
  const renderHeader = () => (
    <header className="demo-header">
      <h1>החתונה של דנה ואיתי 💍</h1>
      <button className="demo-header-btn" onClick={() => setScreen('profile')}>{I.person}</button>
    </header>
  );

  // ── Tab Bar (exact match - 3 buttons, RTL order: likes|chats|grid, 10px label, badge) ──
  const renderTabBar = () => (
    <div className="demo-tabbar">
      <button className={activeTab === 'grid' ? 'dtb-active' : ''} onClick={() => goTab('grid')}>
        {I.grid(activeTab === 'grid' ? 'var(--primary)' : 'currentColor')}
        <span>גריד</span>
      </button>
      <button className={activeTab === 'chats' ? 'dtb-active' : ''} onClick={() => goTab('chats')}>
        {I.chatTab(activeTab === 'chats' ? 'var(--primary)' : 'currentColor')}
        <span>צ׳אטים</span>
        {chatBadge > 0 && <span className="dtb-badge">{chatBadge > 9 ? '9+' : chatBadge}</span>}
      </button>
      <button className={activeTab === 'likes' ? 'dtb-active' : ''} onClick={() => goTab('likes')}>
        {I.heartTab(activeTab === 'likes' ? 'var(--primary)' : 'currentColor')}
        <span>לייקים</span>
        {likeBadge > 0 && <span className="dtb-badge">{likeBadge > 9 ? '9+' : likeBadge}</span>}
      </button>
    </div>
  );

  // ── View Toggle (exact: pill container, bg rgba(255,255,255,0.04), 12px radius, active=primary bg) ──
  const renderViewToggle = () => (
    <div className="dvt-wrap">
      <div className="dvt-pill">
        <button className={viewMode === 'swipe' ? 'dvt-on' : ''} onClick={() => toggleView('swipe')}>
          {I.swipe(viewMode === 'swipe' ? '#1a1a1a' : 'var(--text-muted)')}
        </button>
        <button className={viewMode === 'grid' ? 'dvt-on' : ''} onClick={() => toggleView('grid')}>
          {I.grid(viewMode === 'grid' ? '#1a1a1a' : 'var(--text-muted)')}
        </button>
      </div>
    </div>
  );

  // ── Grid ──
  const renderGrid = () => (
    <div className="demo-scroll">
      {renderViewToggle()}
      <div className="profile-grid">
        {USERS.map(u => (
          <div key={u.seed} className="grid-card" {...kbClick(() => openUser(u))}>
            <img src={u.photo} alt={u.name} draggable={false} />
            <div className="card-overlay"><div className="name">{u.name}</div></div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Swipe ──
  const renderSwipe = () => (
    <div className="demo-scroll demo-swipe-wrap">
      {renderViewToggle()}
      {currentSwipe ? (
        <>
          <div className="demo-swipe-stack">
            {nextSwipe && <div className="demo-sc demo-sc--next"><img src={nextSwipe.photo} alt="" draggable={false}/></div>}
            <div
              className={`demo-sc demo-sc--top${exitDir ? ` demo-sc-exit-${exitDir}` : ''}`}
              style={!exitDir ? { transform: `translateX(${swipeDelta}px) rotate(${swipeDelta * 0.06}deg)`, transition: swiping ? 'none' : 'transform 0.2s' } : undefined}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            >
              <img src={currentSwipe.photo} alt={currentSwipe.name} draggable={false}/>
              <div className="demo-sc-grad">
                <div className="demo-sc-nameline"><span className="demo-sc-name">{currentSwipe.name}</span><span className="demo-sc-age">{currentSwipe.age}</span></div>
                <div className="demo-sc-city">📍 {currentSwipe.city}</div>
                <div className="demo-sc-tag">🎯 {currentSwipe.lookingFor}</div>
                <p className="demo-sc-bio">{currentSwipe.bio}</p>
              </div>
              {swipeDelta > 20 && <div className="demo-badge-like" style={{ opacity: Math.min(Math.abs(swipeDelta) / 80, 1) }}>LIKE</div>}
              {swipeDelta < -20 && <div className="demo-badge-nope" style={{ opacity: Math.min(Math.abs(swipeDelta) / 80, 1) }}>NOPE</div>}
            </div>
          </div>
          <div className="demo-sa" dir="ltr">
            <button className="demo-sa-skip" onClick={handleSwipeBtnSkip}>✕</button>
            <button className="demo-sa-view" onClick={() => openUser(currentSwipe)}>{I.personSm}</button>
            <button className="demo-sa-like" onClick={handleSwipeBtnLike}>♥</button>
          </div>
        </>
      ) : (
        <div className="demo-empty">
          <div style={{ opacity: 0.8, color: 'var(--primary)' }}>{I.heartFill('var(--primary)', 52)}</div>
          <p className="demo-empty-t">עברת על כולם! 🎉</p>
          <p className="demo-empty-s">כשמישהו חדש יצטרף - הוא יופיע כאן אוטומטית</p>
          <button className="demo-empty-btn" onClick={() => { setSkippedUsers(new Set()); setLikedUsers(new Set()); setSentLikes(new Set()); }}>🔄 אפס רשימה</button>
        </div>
      )}
    </div>
  );

  // ── User Profile ──
  const renderUser = () => selectedUser && (
    <div className="demo-user-overlay">
      <button className="demo-x-btn" onClick={() => { setSelectedUser(null); setScreen(activeTab === 'grid' ? viewMode : activeTab === 'likes' ? 'likes' : 'chats'); }}>{I.close}</button>
      <img className="demo-user-photo" src={selectedUser.photo} alt={selectedUser.name} draggable={false}/>
      <div className="demo-user-info">
        <div className="demo-user-name">{selectedUser.name} <span>{selectedUser.age}</span></div>
        <div className="demo-user-meta">{selectedUser.gender} · {selectedUser.city}</div>
        <span className="demo-user-tag">🎯 {selectedUser.lookingFor}</span>
        <p className="demo-user-bio">{selectedUser.bio}</p>
      </div>
      <div className="demo-user-acts">
        <button className="demo-ua demo-ua--block">{I.block}<span>חסימה</span></button>
        <button className="demo-ua" onClick={() => { if (matchedUsers.has(selectedUser.seed)) openChat(selectedUser); else { doLike(selectedUser); setSelectedUser(null); setScreen('grid'); } }}>{I.chatTab()}<span>הודעה</span></button>
        <button className="demo-ua demo-ua--like" onClick={() => { doLike(selectedUser); setSelectedUser(null); setScreen(activeTab === 'grid' ? viewMode : 'likes'); }}>{I.heartFill('currentColor')}<span>לייק</span></button>
      </div>
    </div>
  );

  // ── Chat List (exact: notification banner + chat-list-item rows) ──
  const renderChats = () => (
    <div className="demo-scroll">
      {chatListData.length === 0 ? (
        <div className="demo-empty">
          <div style={{ opacity: 0.8 }}>{I.chatLg('var(--primary)')}</div>
          <p className="demo-empty-t">אין שיחות עדיין</p>
          <p className="demo-empty-s">לחצו על פרופיל כדי לשלוח הודעה ראשונה</p>
        </div>
      ) : chatListData.map(c => (
        <div key={c.user.seed} className="chat-list-item" {...kbClick(() => openChat(c.user))}>
          <img src={c.user.photo} alt={c.user.name} className="chat-avatar" />
          <div className="chat-info">
            <div className="chat-name" style={c.unread ? { fontWeight: 700 } : undefined}>{c.user.name}</div>
            <div className="chat-last-msg" style={c.unread ? { color: 'var(--foreground)', fontWeight: 600 } : undefined}>{c.lastMsg?.text || 'שיחה חדשה'}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '4px', minWidth: '40px' }}>
            <div className="chat-time">{c.lastMsg?.time || ''}</div>
            {c.unread && <span className="demo-unread-badge">{c.unreadCount > 99 ? '99+' : c.unreadCount}</span>}
          </div>
        </div>
      ))}
    </div>
  );

  // ── Chat Conversation (exact: header → messages → input bar w/ camera, send) ──
  const msgs = chatUser ? (convos[chatUser.seed] || []) : [];
  const renderChat = () => chatUser && (
    <div className="demo-chat-screen">
      <div className="demo-chat-hdr">
        <button className="demo-ibtn" onClick={() => { setChatUser(null); setScreen('chats'); setActiveTab('chats'); }}>{I.back}</button>
        <img className="demo-chat-hdr-av" src={chatUser.photo} alt="" />
        <span className="demo-chat-hdr-name">{chatUser.name}</span>
        <div style={{ flex: 1 }} />
        <button className="demo-ibtn">{I.dots}</button>
      </div>
      <div className="chat-messages demo-msgs" ref={msgsRef}>
        {msgs.map(m => (
          <div key={m.id} className={`message-bubble ${m.type === 'system' ? 'demo-sys-msg' : m.sent ? 'sent' : 'received'}`}>{m.text}</div>
        ))}
      </div>
      <div className="demo-input-bar">
        <button className="demo-input-icon">{I.camera}</button>
        <input type="text" placeholder="הקלידו הודעה..." dir="rtl" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
        <button className="demo-send-btn" onClick={sendMessage}>{I.send}</button>
      </div>
    </div>
  );

  // ── Likes (exact: 3 sub-tabs row - התאמות / קיבלתי / עשיתי with counts) ──
  const renderLikes = () => (
    <div className="demo-scroll">
      <div className="demo-lt-bar">
        <button className={likesTab === 'sent' ? 'demo-lt-on' : ''} onClick={() => setLikesTab('sent')}>עשיתי ({sentLikeUsers.length})</button>
        <button className={likesTab === 'received' ? 'demo-lt-on' : ''} onClick={() => setLikesTab('received')}>קיבלתי ({receivedLikeUsers.length})</button>
        <button className={likesTab === 'matches' ? 'demo-lt-on' : ''} onClick={() => setLikesTab('matches')}>התאמות ({matchList.length})</button>
      </div>
      <div style={{ padding: '0 0 8px' }}>
        {likesTab === 'matches' ? (
          matchList.length === 0 ? (
            <div className="demo-empty"><div style={{ fontSize: 48 }}>💞</div><p className="demo-empty-t">עדיין אין התאמות</p><p className="demo-empty-s">כששני אנשים עושים לייק אחד לשני - זו התאמה!</p></div>
          ) : (
            <div className="profile-grid" style={{ padding: '12px' }}>
              {matchList.map(u => (
                <div key={u.seed} className="grid-card" {...kbClick(() => openUser(u))} style={{ position: 'relative' }}>
                  <img src={u.photo} alt={u.name} draggable={false}/>
                  <div className="card-overlay"><div className="name">{u.name}</div></div>
                  <div className="demo-match-label">💞 Match</div>
                </div>
              ))}
            </div>
          )
        ) : likesTab === 'received' ? (
          receivedLikeUsers.length === 0 ? (
            <div className="demo-empty"><div style={{ opacity: 0.8 }}>{I.heartFill('var(--primary)', 48)}</div><p className="demo-empty-t">עדיין לא קיבלתם לייקים</p></div>
          ) : (
            <div className="profile-grid" style={{ padding: '12px' }}>
              {receivedLikeUsers.map(u => (
                <div key={u.seed} className="grid-card" {...kbClick(() => openUser(u))}>
                  <img src={u.photo} alt={u.name} draggable={false}/>
                  <div className="card-overlay"><div className="name">{u.name}</div></div>
                </div>
              ))}
            </div>
          )
        ) : (
          sentLikeUsers.length === 0 ? (
            <div className="demo-empty"><div style={{ opacity: 0.8 }}>{I.heartTab('var(--primary)')}</div><p className="demo-empty-t">עדיין לא עשיתם לייקים</p></div>
          ) : (
            <div className="profile-grid" style={{ padding: '12px' }}>
              {sentLikeUsers.map(u => (
                <div key={u.seed} className="grid-card" {...kbClick(() => openUser(u))}>
                  <img src={u.photo} alt={u.name} draggable={false}/>
                  <div className="card-overlay"><div className="name">{u.name}</div></div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );

  // ── Profile Edit ──
  const renderProfile = () => (
    <div className="demo-pe-screen">
      <div className="demo-detail-hdr">
        <span style={{ fontWeight: 600, fontSize: 17 }}>עריכת פרופיל</span>
        <button className="demo-ibtn" onClick={() => { setScreen('grid'); setActiveTab('grid'); }}>{I.back}</button>
      </div>
      <div className="demo-scroll" style={{ padding: '0 12px 24px' }}>
        <div className="demo-pe-sec">
          <div className="demo-pe-head"><span>📷 תמונות</span><span className="demo-pe-cnt">0/10</span></div>
          <div className="demo-pe-add"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" aria-hidden="true" focusable="false"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>הוספה</span></div>
        </div>
        <div className="demo-pe-sec">
          <div className="demo-pe-head">✏️ פרטים בסיסיים</div>
          <label className="demo-pe-lbl">שם / כינוי</label>
          <input className="demo-pe-inp" value={myName} onChange={e => setMyName(e.target.value)} />
          <label className="demo-pe-lbl">גיל</label>
          <input className="demo-pe-inp" placeholder="הזינו גיל" value={myAge} onChange={e => setMyAge(e.target.value)} />
          <label className="demo-pe-lbl">עיר</label>
          <input className="demo-pe-inp" placeholder="מאיפה אתם?" value={myCity} onChange={e => setMyCity(e.target.value)} />
          <label className="demo-pe-lbl">קצת עליי</label>
          <textarea className="demo-pe-inp demo-pe-ta" placeholder="ספרו משהו על עצמכם..." value={myBio} onChange={e => setMyBio(e.target.value)} />
        </div>
        <div className="demo-pe-sec">
          <div className="demo-pe-head">❤️ מגדר והעדפות</div>
          <label className="demo-pe-lbl">אני</label>
          <div className="demo-chips">{['גבר', 'אישה', 'אחר'].map(v => <button key={v} className={`demo-chip${myGender === v ? ' demo-chip-on' : ''}`} onClick={() => setMyGender(v)}>{v}</button>)}</div>
          <label className="demo-pe-lbl">מעוניין/ת ב</label>
          <div className="demo-chips">{['גברים', 'נשים', 'כולם'].map(v => <button key={v} className={`demo-chip${myAttracted === v ? ' demo-chip-on' : ''}`} onClick={() => setMyAttracted(v)}>{v}</button>)}</div>
          <div className="demo-pe-hint">זה ישפיע על מי שתראו ומי יראה אתכם</div>
          <label className="demo-pe-lbl">מחפש/ת</label>
          <div className="demo-chips">{['קשר רציני', 'משהו קליל', 'חברים/ות', 'עוד לא יודע/ת'].map(v => <button key={v} className={`demo-chip${myLooking === v ? ' demo-chip-on' : ''}`} onClick={() => setMyLooking(v)}>{v}</button>)}</div>
        </div>
        <button className="demo-pe-save" onClick={() => { setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2000); }} style={profileSaved ? { background: '#22c55e' } : undefined}>{profileSaved ? '✓ נשמר!' : 'שמירת שינויים'}</button>
        <button className="demo-pe-del">מחיקת חשבון</button>
      </div>
    </div>
  );

  // ── Match Popup ──
  const renderMatch = () => matchPopup && (
    <div className="demo-match-ov" onClick={() => setMatchPopup(null)}>
      <div className="demo-match-card" onClick={e => e.stopPropagation()}>
        <div className="demo-match-title">✨ יש לכם מאצ׳!</div>
        <div className="demo-match-pics">
          <div className="demo-match-ring"><img src={USERS[0].photo} alt="" /></div>
          <div className="demo-match-heart">{I.heartFill('#f87171', 20)}</div>
          <div className="demo-match-ring"><img src={matchPopup.photo} alt="" /></div>
        </div>
        <div className="demo-match-sub">אתם ו{matchPopup.name}</div>
        <button className="demo-match-cta" onClick={() => { setMatchPopup(null); openChat(matchPopup); setActiveTab('chats'); }}>שלחו הודעה 💬</button>
        <button className="demo-match-skip" onClick={() => setMatchPopup(null)}>המשיכו לגלול</button>
      </div>
    </div>
  );

  return (
    <div className="phone-frame">
      <div className="phone-frame__notch" />
      <div className="phone-frame__screen">
        {showHeader && renderHeader()}
        <div className="demo-content">
          {screen === 'grid' && renderGrid()}
          {screen === 'swipe' && renderSwipe()}
          {screen === 'user' && renderUser()}
          {screen === 'chats' && renderChats()}
          {screen === 'chat' && renderChat()}
          {screen === 'likes' && renderLikes()}
          {screen === 'profile' && renderProfile()}
        </div>
        {showTabBar && renderTabBar()}
        {renderMatch()}
      </div>
    </div>
  );
}
