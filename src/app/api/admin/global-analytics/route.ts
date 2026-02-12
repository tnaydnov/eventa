import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, jsonError } from '../_helpers';
import type { GlobalAnalytics, EventComparisonRow, EventRankItem } from '@/app/admin/_components/shared';

/**
 * GET /api/admin/global-analytics
 * Returns comprehensive aggregated analytics across ALL events,
 * including archived events via event_analytics_snapshots.
 */
export async function GET(req: NextRequest) {
  const denied = adminGuard(req, 'admin-global-analytics', RATE_LIMITS.standard);
  if (denied) return denied;

  try {
    const supabase = getServiceClient();

    /* ── Run all independent queries in parallel ── */
    const [
      eventsRes, participantsRes, photosRes, likesRes,
      conversationsRes, messagesRes, blocksRes, compassRes, snapshotsRes,
    ] = await Promise.all([
      supabase.from('events').select('id, name, event_type, status, created_at, archived_at'),
      supabase.from('participants').select('id, event_id, gender, attracted_to, age, display_name, created_at'),
      supabase.from('participant_photos').select('participant_id, event_id'),
      supabase.from('likes').select('id, event_id, from_participant_id, to_participant_id, seen_at, created_at'),
      supabase.from('conversations').select('id, event_id, created_at'),
      supabase.from('messages').select('id, event_id, conversation_id, sender_participant_id, type, created_at').eq('is_deleted', false),
      supabase.from('blocks').select('id, event_id, blocker_id, blocked_id, had_like, had_conversation, had_match, created_at'),
      supabase.from('compass_sessions').select('id, event_id, activated_at, closed_at'),
      supabase.from('event_analytics_snapshots').select('event_id, snapshot'),
    ]);

    const events       = eventsRes.data || [];
    const participants = participantsRes.data || [];
    const photos       = photosRes.data || [];
    const likes        = likesRes.data || [];
    const conversations = conversationsRes.data || [];
    const messages     = messagesRes.data || [];
    const blocks       = blocksRes.data || [];
    const compassSessions = compassRes.data || [];
    const snapshots    = snapshotsRes.data || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshotMap = new Map<string, any>();
    for (const s of snapshots) snapshotMap.set(s.event_id, s.snapshot);

    const eventNameMap = new Map<string, { name: string; eventType: string; status: string }>();
    for (const e of events) eventNameMap.set(e.id, { name: e.name, eventType: e.event_type, status: e.status });

    /* ═══ Event breakdowns ═══ */
    const totalEvents    = events.length;
    const activeEvents   = events.filter(e => e.status === 'active').length;
    const archivedEvents = events.filter(e => e.status === 'archived').length;
    const liveEvents     = events.filter(e => e.status !== 'archived');

    const eventsByStatus: Record<string, number> = {};
    const eventsByType:   Record<string, number> = {};
    for (const e of events) {
      eventsByStatus[e.status]     = (eventsByStatus[e.status] || 0) + 1;
      eventsByType[e.event_type]   = (eventsByType[e.event_type] || 0) + 1;
    }

    /* ═══ Per-event live data aggregation ═══ */
    interface LiveBucket {
      participants: number; men: number; women: number;
      likes: number; matches: number; conversations: number; messages: number; blocks: number;
      likePairs: number; matchRate: number;
      textMsgs: number; imageMsgs: number; audioMsgs: number;
      photosCount: number; participantsWithPhoto: number;
      likesSeen: number; likesUnseen: number;
      blocksAfterConvo: number; blocksAfterLike: number; blocksNoInteraction: number;
    }
    const liveData = new Map<string, LiveBucket>();
    const emptyBucket = (): LiveBucket => ({
      participants: 0, men: 0, women: 0,
      likes: 0, matches: 0, conversations: 0, messages: 0, blocks: 0,
      likePairs: 0, matchRate: 0,
      textMsgs: 0, imageMsgs: 0, audioMsgs: 0,
      photosCount: 0, participantsWithPhoto: 0,
      likesSeen: 0, likesUnseen: 0,
      blocksAfterConvo: 0, blocksAfterLike: 0, blocksNoInteraction: 0,
    });
    const initLive = (eid: string) => {
      if (!liveData.has(eid)) liveData.set(eid, emptyBucket());
      return liveData.get(eid)!;
    };

    /* ── Participants ── */
    const attractionCounts: Record<string, number> = {};
    const ageBuckets: Record<string, number> = {};
    let setupProfileCount = 0;
    const pEventMap = new Map<string, string>(); // pid → event_id

    for (const p of participants) {
      const d = initLive(p.event_id);
      d.participants++;
      pEventMap.set(p.id, p.event_id);
      if (p.gender === 'male') d.men++;
      else if (p.gender === 'female') d.women++;

      const gLabel = p.gender === 'male' ? 'גברים' : 'נשים';
      const aLabel = p.attracted_to === 'men' ? 'גברים' : p.attracted_to === 'women' ? 'נשים' : 'הכל';
      const key = `${gLabel} ← ${aLabel}`;
      attractionCounts[key] = (attractionCounts[key] || 0) + 1;

      if (p.age != null) {
        const bucket = p.age < 23 ? '18-22' : p.age < 28 ? '23-27' : p.age < 33 ? '28-32' : p.age < 38 ? '33-37' : '38+';
        ageBuckets[bucket] = (ageBuckets[bucket] || 0) + 1;
      }
      if (p.display_name && p.display_name.trim().length > 0) setupProfileCount++;
    }

    /* ── Photos ── */
    const pidsWithPhoto = new Set<string>();
    for (const ph of photos) {
      const d = initLive(ph.event_id);
      d.photosCount++;
      if (!pidsWithPhoto.has(ph.participant_id)) { pidsWithPhoto.add(ph.participant_id); d.participantsWithPhoto++; }
    }

    /* ── Likes + Matches ── */
    const likesByEvent = new Map<string, Set<string>>();
    const likeSenderSet = new Set<string>();
    const getIsraelHour = (iso: string) =>
      parseInt(new Date(iso).toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' }), 10);
    const hourCounts: Record<number, number> = {};

    for (const l of likes) {
      const d = initLive(l.event_id);
      d.likes++;
      likeSenderSet.add(l.from_participant_id);
      if (l.seen_at) d.likesSeen++; else d.likesUnseen++;
      if (!likesByEvent.has(l.event_id)) likesByEvent.set(l.event_id, new Set());
      likesByEvent.get(l.event_id)!.add(`${l.from_participant_id}→${l.to_participant_id}`);

      const h = getIsraelHour(l.created_at);
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }

    // Compute matches per event
    const matchedPidsGlobal = new Set<string>();
    for (const [eventId, likeSet] of likesByEvent) {
      const d = liveData.get(eventId)!;
      let eventMatches = 0;
      const matchedPairs = new Set<string>();
      for (const key of likeSet) {
        const [from, to] = key.split('→');
        if (likeSet.has(`${to}→${from}`)) {
          const pair = [from, to].sort().join('|');
          if (!matchedPairs.has(pair)) {
            matchedPairs.add(pair);
            eventMatches++;
            matchedPidsGlobal.add(from);
            matchedPidsGlobal.add(to);
          }
        }
      }
      d.matches = eventMatches;
      const uniquePairs = new Set(
        [...likeSet].map(k => { const [a, b] = k.split('→'); return [a, b].sort().join('|'); })
      ).size;
      d.likePairs = uniquePairs;
      d.matchRate = uniquePairs > 0 ? Math.round((eventMatches / uniquePairs) * 100) : 0;
    }

    /* ── Conversations & Messages ── */
    const msgSenderSet = new Set<string>();
    const msgCountByConvo = new Map<string, Set<string>>();
    const msgCountByPid  = new Map<string, number>();

    for (const c of conversations) initLive(c.event_id).conversations++;

    for (const m of messages) {
      const d = initLive(m.event_id);
      d.messages++;
      msgSenderSet.add(m.sender_participant_id);
      if (m.type === 'image') d.imageMsgs++;
      else if (m.type === 'audio') d.audioMsgs++;
      else d.textMsgs++;

      if (!msgCountByConvo.has(m.conversation_id)) msgCountByConvo.set(m.conversation_id, new Set());
      msgCountByConvo.get(m.conversation_id)!.add(m.sender_participant_id);
      msgCountByPid.set(m.sender_participant_id, (msgCountByPid.get(m.sender_participant_id) || 0) + 1);

      const h = getIsraelHour(m.created_at);
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }

    let activeChatters = 0;
    for (const [, cnt] of msgCountByPid) { if (cnt >= 3) activeChatters++; }

    let ghostedConvos = 0;
    for (const [, senders] of msgCountByConvo) { if (senders.size < 2) ghostedConvos++; }
    const convosWithMessages = msgCountByConvo.size;

    /* ── Blocks ── */
    for (const b of blocks) {
      const d = initLive(b.event_id);
      d.blocks++;
      if (b.had_conversation) d.blocksAfterConvo++;
      else if (b.had_like) d.blocksAfterLike++;
      else d.blocksNoInteraction++;
    }

    /* ── Compass ── */
    const compassTotal = compassSessions.length;
    let compassDurTotal = 0, compassDurN = 0;
    for (const s of compassSessions) {
      if (s.activated_at && s.closed_at) {
        const dur = new Date(s.closed_at).getTime() - new Date(s.activated_at).getTime();
        if (dur > 0) { compassDurTotal += dur; compassDurN++; }
      }
    }

    /* ═══ Archived event snapshot data ═══ */
    const archivedRows: EventComparisonRow[] = [];
    for (const e of events) {
      if (e.status === 'archived' && snapshotMap.has(e.id)) {
        const snap = snapshotMap.get(e.id);
        archivedRows.push({
          eventId: e.id, name: e.name, eventType: e.event_type, status: 'archived',
          participants: snap.totalParticipants || 0,
          likes: snap.totalLikes || 0,
          matches: snap.totalMatches || 0,
          matchRate: snap.matchRate || 0,
          conversations: snap.totalConversations || 0,
          messages: snap.totalMessages || 0,
          blocks: snap.totalBlocks || 0,
        });
      }
    }

    /* ═══ Grand totals (live + archived) ═══ */
    let gP = 0, gMen = 0, gWomen = 0;
    let gLikes = 0, gMatches = 0, gConvos = 0, gMessages = 0, gBlocks = 0;
    let gPhotos = 0, gCompass = compassTotal;
    let gLikesSeen = 0, gLikesTotal = 0;
    let gBlocksConvo = 0, gBlocksLike = 0, gBlocksNone = 0;
    let gText = 0, gImage = 0, gAudio = 0;
    let mRateSum = 0, mRateN = 0;

    const gFunnel = { joined: 0, setupProfile: 0, sentFirstLike: 0, gotMatch: 0, sentFirstMessage: 0, activeChatter: 0 };

    for (const [, d] of liveData) {
      gP += d.participants; gMen += d.men; gWomen += d.women;
      gLikes += d.likes; gMatches += d.matches; gConvos += d.conversations;
      gMessages += d.messages; gBlocks += d.blocks; gPhotos += d.photosCount;
      gLikesSeen += d.likesSeen; gLikesTotal += d.likes;
      gBlocksConvo += d.blocksAfterConvo; gBlocksLike += d.blocksAfterLike; gBlocksNone += d.blocksNoInteraction;
      gText += d.textMsgs; gImage += d.imageMsgs; gAudio += d.audioMsgs;
      if (d.likePairs > 0) { mRateSum += d.matchRate; mRateN++; }
    }

    // Live funnel
    gFunnel.joined = participants.length;
    gFunnel.setupProfile = setupProfileCount;
    gFunnel.sentFirstLike = likeSenderSet.size;
    gFunnel.gotMatch = [...matchedPidsGlobal].filter(id => pEventMap.has(id)).length;
    gFunnel.sentFirstMessage = msgSenderSet.size;
    gFunnel.activeChatter = activeChatters;

    // Merge archived snapshots
    for (const row of archivedRows) {
      gP += row.participants; gLikes += row.likes; gMatches += row.matches;
      gConvos += row.conversations; gMessages += row.messages; gBlocks += row.blocks;

      const snap = snapshotMap.get(row.eventId);
      if (snap) {
        gMen += snap.totalMen || 0;
        gWomen += snap.totalWomen || 0;
        gPhotos += snap.totalPhotosUploaded || 0;
        gCompass += snap.compassRequestsSent || 0;
        gLikesSeen += snap.likesSeenCount || 0;
        gLikesTotal += snap.totalLikes || 0;
        gBlocksConvo += snap.blocksAfterConversation || 0;
        gBlocksLike += snap.blocksAfterLike || 0;
        gBlocksNone += snap.blocksWithNoInteraction || 0;
        gText += snap.textMessages || 0;
        gImage += snap.imageMessages || 0;
        gAudio += snap.audioMessages || 0;
        if (snap.matchRate > 0) { mRateSum += snap.matchRate; mRateN++; }

        if (snap.funnel) {
          gFunnel.joined += snap.funnel.joined || 0;
          gFunnel.setupProfile += snap.funnel.setupProfile || 0;
          gFunnel.sentFirstLike += snap.funnel.sentFirstLike || 0;
          gFunnel.gotMatch += snap.funnel.gotMatch || 0;
          gFunnel.sentFirstMessage += snap.funnel.sentFirstMessage || 0;
          gFunnel.activeChatter += snap.funnel.activeChatter || 0;
        }
        if (snap.ageDistribution) {
          for (const a of snap.ageDistribution) ageBuckets[a.range] = (ageBuckets[a.range] || 0) + a.count;
        }
      }
    }

    /* ═══ Event comparison table ═══ */
    const eventComparison: EventComparisonRow[] = [];
    for (const e of liveEvents) {
      const d = liveData.get(e.id);
      eventComparison.push({
        eventId: e.id, name: e.name, eventType: e.event_type, status: e.status,
        participants: d?.participants || 0, likes: d?.likes || 0,
        matches: d?.matches || 0, matchRate: d?.matchRate || 0,
        conversations: d?.conversations || 0, messages: d?.messages || 0,
        blocks: d?.blocks || 0,
      });
    }
    eventComparison.push(...archivedRows);
    eventComparison.sort((a, b) => b.participants - a.participants);

    /* ═══ Global rates ═══ */
    const overallMatchRate    = mRateN > 0 ? Math.round(mRateSum / mRateN) : 0;
    const overallGhostRate    = convosWithMessages > 0 ? Math.round((ghostedConvos / convosWithMessages) * 100) : 0;
    const overallLikeSeenRate = gLikesTotal > 0 ? Math.round((gLikesSeen / gLikesTotal) * 100) : 0;
    const overallBlockRate    = gP > 0 ? Math.round((gBlocks / gP) * 100) : 0;

    // Photo rate (avg across live + archived pct)
    let archivedPhotoPct = 0, archivedPhotoN = 0;
    for (const snap of snapshots.map(s => s.snapshot)) {
      if (snap?.totalParticipants > 0 && snap?.participantsWithPhotos != null) {
        archivedPhotoPct += (snap.participantsWithPhotos / snap.totalParticipants) * 100;
        archivedPhotoN++;
      }
    }
    const livePhotoPct = participants.length > 0 ? (pidsWithPhoto.size / participants.length) * 100 : 0;
    const overallPhotoRate = (archivedPhotoN + (participants.length > 0 ? 1 : 0)) > 0
      ? Math.round((livePhotoPct + archivedPhotoPct) / (archivedPhotoN + (participants.length > 0 ? 1 : 0)))
      : 0;

    // Photo impact delta
    let piSum = 0, piN = 0;
    for (const snap of snapshots.map(s => s.snapshot)) {
      if (snap?.photoImpact) { piSum += snap.photoImpact.avgLikesWithPhoto - snap.photoImpact.avgLikesWithoutPhoto; piN++; }
    }
    const photoImpactDelta = piN > 0 ? Math.round(piSum / piN * 10) / 10 : 0;

    /* ═══ Response rate & time ═══ */
    const msgsByConvoArr = new Map<string, { sid: string; t: string }[]>();
    for (const m of messages) {
      if (!msgsByConvoArr.has(m.conversation_id)) msgsByConvoArr.set(m.conversation_id, []);
      msgsByConvoArr.get(m.conversation_id)!.push({ sid: m.sender_participant_id, t: m.created_at });
    }
    let repliedMsgs = 0, respTotalMs = 0, respN = 0;
    for (const [, msgs] of msgsByConvoArr) {
      msgs.sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
      const senders = new Set(msgs.map(x => x.sid));
      if (senders.size < 2) continue;
      for (let i = 0; i < msgs.length - 1; i++) {
        for (let j = i + 1; j < msgs.length; j++) {
          if (msgs[j].sid !== msgs[i].sid) {
            repliedMsgs++;
            const diff = new Date(msgs[j].t).getTime() - new Date(msgs[i].t).getTime();
            if (diff > 0) { respTotalMs += diff; respN++; }
            break;
          }
        }
      }
    }
    const liveRespRate = messages.length > 0 ? Math.round((repliedMsgs / messages.length) * 100) : 0;

    let rrSum = liveRespRate, rrN = messages.length > 0 ? 1 : 0;
    let rtSum = respN > 0 ? respTotalMs / respN / 60000 : 0;
    let rtN = respN > 0 ? 1 : 0;
    for (const snap of snapshots.map(s => s.snapshot)) {
      if (snap?.responseRate != null) { rrSum += snap.responseRate; rrN++; }
      if (snap?.avgResponseTimeMinutes > 0) { rtSum += snap.avgResponseTimeMinutes; rtN++; }
    }
    const overallResponseRate    = rrN > 0 ? Math.round(rrSum / rrN) : 0;
    const avgResponseTimeMinutes = rtN > 0 ? Math.round(rtSum / rtN) : 0;

    /* ═══ Timing ═══ */
    let tLikeSum = 0, tLikeN = 0, tMsgSum = 0, tMsgN = 0;
    for (const snap of snapshots.map(s => s.snapshot)) {
      if (snap?.avgTimeToFirstLikeMinutes > 0) { tLikeSum += snap.avgTimeToFirstLikeMinutes; tLikeN++; }
      if (snap?.avgTimeToFirstMessageMinutes > 0) { tMsgSum += snap.avgTimeToFirstMessageMinutes; tMsgN++; }
    }

    // Live first-like timing
    const firstLikeByPid: Record<string, string> = {};
    for (const l of likes) {
      if (!firstLikeByPid[l.from_participant_id] || l.created_at < firstLikeByPid[l.from_participant_id])
        firstLikeByPid[l.from_participant_id] = l.created_at;
    }
    let liveTLike = 0, liveTLikeN = 0;
    for (const p of participants) {
      const fl = firstLikeByPid[p.id];
      if (fl) { const d = new Date(fl).getTime() - new Date(p.created_at).getTime(); if (d > 0) { liveTLike += d; liveTLikeN++; } }
    }
    if (liveTLikeN > 0) { tLikeSum += Math.round(liveTLike / liveTLikeN / 60000); tLikeN++; }

    // Live first-message timing
    const firstMsgByConvo = new Map<string, string>();
    for (const m of messages) {
      const ex = firstMsgByConvo.get(m.conversation_id);
      if (!ex || m.created_at < ex) firstMsgByConvo.set(m.conversation_id, m.created_at);
    }
    let liveTMsg = 0, liveTMsgN = 0;
    for (const c of conversations) {
      const fm = firstMsgByConvo.get(c.id);
      if (fm) { const d = new Date(fm).getTime() - new Date(c.created_at).getTime(); if (d >= 0) { liveTMsg += d; liveTMsgN++; } }
    }
    if (liveTMsgN > 0) { tMsgSum += Math.round(liveTMsg / liveTMsgN / 60000); tMsgN++; }

    const avgTimeToFirstLikeMinutes    = tLikeN > 0 ? Math.round(tLikeSum / tLikeN) : 0;
    const avgTimeToFirstMessageMinutes = tMsgN  > 0 ? Math.round(tMsgSum / tMsgN) : 0;
    const avgCompassDurationSeconds    = compassDurN > 0 ? Math.round(compassDurTotal / compassDurN / 1000) : 0;

    /* ═══ Cross-event averages ═══ */
    const n = totalEvents || 1;

    /* ═══ Top events rankings ═══ */
    const makeRank = (rows: EventComparisonRow[], field: keyof EventComparisonRow): EventRankItem[] =>
      [...rows].sort((a, b) => (b[field] as number) - (a[field] as number))
        .slice(0, 5)
        .map(e => ({ eventId: e.eventId, name: e.name, eventType: e.eventType, value: e[field] as number }));

    const topEventsByParticipants = makeRank(eventComparison, 'participants');
    const topEventsByLikes        = makeRank(eventComparison, 'likes');
    const topEventsByMessages     = makeRank(eventComparison, 'messages');
    const topEventsByMatchRate    = makeRank(eventComparison.filter(e => e.participants >= 2), 'matchRate');

    const topEventsByEngagement = eventComparison
      .filter(e => e.participants > 0)
      .map(e => ({
        ...e,
        eng: Math.round(((e.likes + e.messages + e.conversations) / e.participants) * 10) / 10,
      }))
      .sort((a, b) => b.eng - a.eng)
      .slice(0, 5)
      .map(e => ({ eventId: e.eventId, name: e.name, eventType: e.eventType, value: e.eng }));

    /* ═══ Growth timelines ═══ */
    const eventsCreatedByMonth       = buildMonthlyTimeline(events.map(e => e.created_at));
    const participantsJoinedByMonth  = buildMonthlyTimeline(participants.map(p => p.created_at));

    const engMonthly = new Map<string, { likes: number; matches: number; messages: number }>();
    for (const l of likes)    { const k = monthKey(l.created_at); if (!engMonthly.has(k)) engMonthly.set(k, { likes: 0, matches: 0, messages: 0 }); engMonthly.get(k)!.likes++; }
    for (const m of messages) { const k = monthKey(m.created_at); if (!engMonthly.has(k)) engMonthly.set(k, { likes: 0, matches: 0, messages: 0 }); engMonthly.get(k)!.messages++; }
    const engagementByMonth = [...engMonthly.entries()]
      .sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
      .map(([month, d]) => ({ month, ...d }));

    /* ═══ Breakdowns ═══ */
    const attractionBreakdown = Object.entries(attractionCounts)
      .map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

    const ageDistribution = ['18-22', '23-27', '28-32', '33-37', '38+']
      .map(range => ({ range, count: ageBuckets[range] || 0 }));

    const peakHours = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, '0')}:00`, count: hourCounts[h] || 0,
    }));

    const messageTypes = [
      { type: 'טקסט', count: gText },
      { type: 'תמונה', count: gImage },
      { type: 'אודיו', count: gAudio },
    ];

    const blockReasons = [
      { reason: 'אחרי שיחה', count: gBlocksConvo },
      { reason: 'אחרי לייק', count: gBlocksLike },
      { reason: 'ללא אינטראקציה', count: gBlocksNone },
    ].filter(b => b.count > 0);

    /* ═══ Assemble response ═══ */
    const analytics: GlobalAnalytics = {
      totalEvents, activeEvents, archivedEvents,
      eventsByStatus, eventsByType,
      totalParticipants: gP, totalMen: gMen, totalWomen: gWomen,
      avgParticipantsPerEvent: Math.round((gP / n) * 10) / 10,
      avgMenPct: gP > 0 ? Math.round((gMen / gP) * 100) : 0,
      avgWomenPct: gP > 0 ? Math.round((gWomen / gP) * 100) : 0,
      totalLikes: gLikes, totalMatches: gMatches, totalConversations: gConvos,
      totalMessages: gMessages, totalBlocks: gBlocks,
      totalCompassSessions: gCompass, totalPhotos: gPhotos,
      overallMatchRate, overallGhostRate, overallResponseRate,
      overallLikeSeenRate, overallBlockRate, overallPhotoRate, photoImpactDelta,
      avgLikesPerEvent:         Math.round((gLikes / n) * 10) / 10,
      avgMatchesPerEvent:       Math.round((gMatches / n) * 10) / 10,
      avgConversationsPerEvent: Math.round((gConvos / n) * 10) / 10,
      avgMessagesPerEvent:      Math.round((gMessages / n) * 10) / 10,
      avgBlocksPerEvent:        Math.round((gBlocks / n) * 10) / 10,
      avgMatchRatePerEvent:     overallMatchRate,
      avgTimeToFirstLikeMinutes, avgTimeToFirstMessageMinutes,
      avgResponseTimeMinutes, avgCompassDurationSeconds,
      funnel: gFunnel,
      topEventsByParticipants, topEventsByLikes, topEventsByMessages,
      topEventsByMatchRate, topEventsByEngagement,
      eventComparison,
      eventsCreatedByMonth, participantsJoinedByMonth, engagementByMonth,
      attractionBreakdown, ageDistribution, peakHours, messageTypes, blockReasons,
    };

    return NextResponse.json(analytics);
  } catch (err) {
    console.error('[ADMIN_GLOBAL_ANALYTICS] error:', err);
    return jsonError('Failed to load global analytics', 500);
  }
}

/* ── Helpers ── */

function monthKey(ts: string): string {
  try { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  catch { return '?'; }
}

function buildMonthlyTimeline(timestamps: string[]): { month: string; count: number }[] {
  const buckets = new Map<string, number>();
  for (const ts of timestamps) {
    const key = monthKey(ts);
    if (key !== '?') buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));
}
