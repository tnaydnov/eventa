'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { DemoUser, DemoMsg } from './demo-data';
import { USERS, LIKED_BY, PRE_MATCHED, INITIAL_CONVOS, AUTO_REPLIES } from './demo-data';
import { DemoIcons as I } from './DemoIcons';

type Screen = 'grid' | 'swipe' | 'user' | 'chats' | 'chat' | 'likes' | 'profile';
type LikesTab = 'matches' | 'received' | 'sent';

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

  const [selectedUser, setSelectedUser] = useState<DemoUser | null>(null);
  const [chatUser, setChatUser] = useState<DemoUser | null>(null);
  const [likedUsers, setLikedUsers] = useState<Set<string>>(new Set());
  const [sentLikes, setSentLikes] = useState<Set<string>>(new Set());
  const [matchedUsers, setMatchedUsers] = useState<Set<string>>(new Set(PRE_MATCHED));
  const [skippedUsers, setSkippedUsers] = useState<Set<string>>(new Set());
  const [matchPopup, setMatchPopup] = useState<DemoUser | null>(null);
  const [convos, setConvos] = useState<Record<string, DemoMsg[]>>(() => JSON.parse(JSON.stringify(INITIAL_CONVOS)));
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

  const doLike = useCallback((user: DemoUser) => {
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

  const doSkip = useCallback((user: DemoUser) => { setSkippedUsers(p => { const n = new Set(p); n.add(user.seed); return n; }); }, []);
  const openUser = useCallback((user: DemoUser) => { setSelectedUser(user); setScreen('user'); }, []);
  const openChat = useCallback((user: DemoUser) => { setChatUser(user); setScreen('chat'); setChatInput(''); }, []);

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
      <h1>Dana & Itai</h1>
      <button className="demo-header-btn" onClick={() => setScreen('profile')} aria-label="פרופיל">{I.person}</button>
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
        <button className={viewMode === 'swipe' ? 'dvt-on' : ''} onClick={() => toggleView('swipe')} aria-label="תצוגת סוויפ">
          {I.swipe(viewMode === 'swipe' ? '#1a1a1a' : 'var(--text-muted)')}
        </button>
        <button className={viewMode === 'grid' ? 'dvt-on' : ''} onClick={() => toggleView('grid')} aria-label="תצוגת גריד">
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
                <div className="demo-sc-city"><span aria-hidden="true">📍</span> {currentSwipe.city}</div>
                <div className="demo-sc-tag"><span aria-hidden="true">🎯</span> {currentSwipe.lookingFor}</div>
                <p className="demo-sc-bio">{currentSwipe.bio}</p>
              </div>
              {swipeDelta > 20 && <div className="demo-badge-like" style={{ opacity: Math.min(Math.abs(swipeDelta) / 80, 1) }}>LIKE</div>}
              {swipeDelta < -20 && <div className="demo-badge-nope" style={{ opacity: Math.min(Math.abs(swipeDelta) / 80, 1) }}>NOPE</div>}
            </div>
          </div>
          <div className="demo-sa" dir="ltr">
            <button className="demo-sa-skip" onClick={handleSwipeBtnSkip} aria-label="דלג">✕</button>
            <button className="demo-sa-view" onClick={() => openUser(currentSwipe)} aria-label="צפה בפרופיל">{I.personSm}</button>
            <button className="demo-sa-like" onClick={handleSwipeBtnLike} aria-label="לייק">♥</button>
          </div>
        </>
      ) : (
        <div className="demo-empty">
          <div style={{ opacity: 0.8, color: 'var(--primary)' }}>{I.heartFill('var(--primary)', 52)}</div>
          <p className="demo-empty-t">עברת על כולם! <span aria-hidden="true">🎉</span></p>
          <p className="demo-empty-s">כשמישהו חדש יצטרף - הוא יופיע כאן אוטומטית</p>
          <button className="demo-empty-btn" onClick={() => { setSkippedUsers(new Set()); setLikedUsers(new Set()); setSentLikes(new Set()); }}><span aria-hidden="true">🔄</span> אפס רשימה</button>
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
        <span className="demo-user-tag"><span aria-hidden="true">🎯</span> {selectedUser.lookingFor}</span>
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
            <div className="demo-empty"><div style={{ fontSize: 48 }} aria-hidden="true">💞</div><p className="demo-empty-t">עדיין אין התאמות</p><p className="demo-empty-s">כששני אנשים עושים לייק אחד לשני - זו התאמה!</p></div>
          ) : (
            <div className="profile-grid" style={{ padding: '12px' }}>
              {matchList.map(u => (
                <div key={u.seed} className="grid-card" {...kbClick(() => openUser(u))} style={{ position: 'relative' }}>
                  <img src={u.photo} alt={u.name} draggable={false}/>
                  <div className="card-overlay"><div className="name">{u.name}</div></div>
                  <div className="demo-match-label"><span aria-hidden="true">💞</span> Match</div>
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
          <div className="demo-pe-head"><span><span aria-hidden="true">📷</span> תמונות</span><span className="demo-pe-cnt">0/10</span></div>
          <div className="demo-pe-add"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" aria-hidden="true" focusable="false"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>הוספה</span></div>
        </div>
        <div className="demo-pe-sec">
          <div className="demo-pe-head"><span aria-hidden="true">✏️</span> פרטים בסיסיים</div>
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
          <div className="demo-pe-head"><span aria-hidden="true">❤️</span> מגדר והעדפות</div>
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
        <div className="demo-match-title"><span aria-hidden="true">✨</span> יש לכם מאצ׳!</div>
        <div className="demo-match-pics">
          <div className="demo-match-ring"><img src={USERS[0].photo} alt="" /></div>
          <div className="demo-match-heart">{I.heartFill('#f87171', 20)}</div>
          <div className="demo-match-ring"><img src={matchPopup.photo} alt="" /></div>
        </div>
        <div className="demo-match-sub">אתם ו{matchPopup.name}</div>
        <button className="demo-match-cta" onClick={() => { setMatchPopup(null); openChat(matchPopup); setActiveTab('chats'); }}>שלחו הודעה <span aria-hidden="true">💬</span></button>
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
