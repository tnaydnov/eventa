/**
 * Shared analytics computation for a single event.
 * Used by both the analytics API route (live events) and the archive route (snapshot before purge).
 * Extracted to avoid fragile self-referential HTTP fetches in serverless environments.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventAnalytics } from '@/app/admin/_components/shared';
import { logger } from '@/lib/logger';

/**
 * Compute the full EventAnalytics object by querying all event data from Supabase.
 * Throws if critical queries fail.
 */
export async function computeEventAnalytics(
  supabase: SupabaseClient,
  eventId: string
): Promise<EventAnalytics> {
  const LIMIT = 100_000;

  const [
    participantsRes,
    photosRes,
    likesRes,
    conversationsRes,
    messagesRes,
    blocksRes,
    activityRes,
  ] = await Promise.all([
    supabase
      .from('participants')
      .select('id, display_name, gender, attracted_to, age, created_at')
      .eq('event_id', eventId)
      .eq('is_banned', false)
      .limit(LIMIT),

    supabase
      .from('participant_photos')
      .select('participant_id')
      .eq('event_id', eventId)
      .limit(LIMIT),

    supabase
      .from('likes')
      .select('id, from_participant_id, to_participant_id, created_at, seen_at')
      .eq('event_id', eventId)
      .limit(LIMIT),

    supabase
      .from('conversations')
      .select('id, a_participant_id, b_participant_id, created_at')
      .eq('event_id', eventId)
      .limit(LIMIT),

    supabase
      .from('messages')
      .select('id, conversation_id, sender_participant_id, type, created_at')
      .eq('event_id', eventId)
      .eq('is_deleted', false)
      .limit(LIMIT),

    supabase
      .from('blocks')
      .select('id, blocker_id, blocked_id, had_like, had_conversation, had_match, created_at')
      .eq('event_id', eventId)
      .limit(LIMIT),

    supabase
      .from('activity_log')
      .select('participant_id, action, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
      .limit(LIMIT),
  ]);

  // ── Check for query errors ──
  const queryErrors = [
    participantsRes.error && `participants: ${participantsRes.error.message}`,
    photosRes.error && `photos: ${photosRes.error.message}`,
    likesRes.error && `likes: ${likesRes.error.message}`,
    conversationsRes.error && `conversations: ${conversationsRes.error.message}`,
    messagesRes.error && `messages: ${messagesRes.error.message}`,
    blocksRes.error && `blocks: ${blocksRes.error.message}`,
    activityRes.error && `activity: ${activityRes.error.message}`,
  ].filter(Boolean);

  if (queryErrors.length > 0) {
    const msg = queryErrors.join('; ');
    logger.error('[COMPUTE_ANALYTICS] query errors:', msg);
    throw new Error(`Analytics query errors: ${msg}`);
  }

  const allParticipants = participantsRes.data || [];
  const photos = photosRes.data || [];
  const likes = likesRes.data || [];
  const conversations = conversationsRes.data || [];
  const messages = messagesRes.data || [];
  const blocks = blocksRes.data || [];
  const activityRows = activityRes.data || [];

  // ── Split complete vs incomplete registrations ──
  const incompleteRegistrations = allParticipants.filter(
    p => !p.display_name || !p.display_name.trim()
  ).length;
  const participants = allParticipants.filter(
    p => p.display_name && p.display_name.trim().length > 0
  );

  // ── Build participant lookup (complete profiles only) ──
  const pMap = new Map<string, {
    gender: string; attracted_to: string; age: number | null;
    display_name: string; created_at: string;
  }>();
  for (const p of participants) {
    pMap.set(p.id, {
      gender: p.gender, attracted_to: p.attracted_to,
      age: p.age, display_name: p.display_name, created_at: p.created_at,
    });
  }

  // ── Participant demographics (complete profiles only) ──
  const totalParticipants = participants.length;
  let totalMen = 0, totalWomen = 0;
  let menAttractedToMen = 0, menAttractedToWomen = 0, menAttractedToAll = 0;
  let womenAttractedToMen = 0, womenAttractedToWomen = 0, womenAttractedToAll = 0;

  const ageBuckets: Record<string, number> = {};

  for (const p of participants) {
    const isMale = p.gender === 'male';
    const isFemale = p.gender === 'female';

    if (isMale) {
      totalMen++;
      if (p.attracted_to === 'men') menAttractedToMen++;
      else if (p.attracted_to === 'women') menAttractedToWomen++;
      else menAttractedToAll++;
    } else if (isFemale) {
      totalWomen++;
      if (p.attracted_to === 'men') womenAttractedToMen++;
      else if (p.attracted_to === 'women') womenAttractedToWomen++;
      else womenAttractedToAll++;
    }

    if (p.age != null) {
      const bucket = p.age < 23 ? '18-22'
        : p.age < 28 ? '23-27'
        : p.age < 33 ? '28-32'
        : p.age < 38 ? '33-37'
        : '38+';
      ageBuckets[bucket] = (ageBuckets[bucket] || 0) + 1;
    }
  }

  const ageDistribution = ['18-22', '23-27', '28-32', '33-37', '38+']
    .map(range => ({ range, count: ageBuckets[range] || 0 }));

  // ── Photos ──
  const participantsWithPhotos = new Set(photos.map(p => p.participant_id)).size;
  const totalPhotosUploaded = photos.length;
  const avgPhotosPerParticipant = totalParticipants > 0
    ? Math.round((totalPhotosUploaded / totalParticipants) * 100) / 100
    : 0;

  // ── Likes ──
  const totalLikes = likes.length;
  let likeSentByMen = 0, likeSentByWomen = 0;
  let likesSeenCount = 0, likesUnseenCount = 0;
  const firstLikeTime: Record<string, string> = {};

  for (const l of likes) {
    const sender = pMap.get(l.from_participant_id);
    if (sender?.gender === 'male') likeSentByMen++;
    else if (sender?.gender === 'female') likeSentByWomen++;

    if (l.seen_at) likesSeenCount++;
    else likesUnseenCount++;

    if (!firstLikeTime[l.from_participant_id] || l.created_at < firstLikeTime[l.from_participant_id]) {
      firstLikeTime[l.from_participant_id] = l.created_at;
    }
  }

  const firstLikeByGender = { men: 0, women: 0 };
  for (const [pid] of Object.entries(firstLikeTime)) {
    const g = pMap.get(pid)?.gender;
    if (g === 'male') firstLikeByGender.men++;
    else if (g === 'female') firstLikeByGender.women++;
  }

  const avgLikesPerParticipant = totalParticipants > 0
    ? Math.round((totalLikes / totalParticipants) * 10) / 10
    : 0;

  // ── Matches ──
  const likeSet = new Set(likes.map(l => `${l.from_participant_id}→${l.to_participant_id}`));
  const matchedPairs = new Set<string>();
  for (const l of likes) {
    if (likeSet.has(`${l.to_participant_id}→${l.from_participant_id}`)) {
      const pair = [l.from_participant_id, l.to_participant_id].sort().join('|');
      matchedPairs.add(pair);
    }
  }
  const totalMatches = matchedPairs.size;

  const uniqueLikePairs = new Set(
    likes.map(l => [l.from_participant_id, l.to_participant_id].sort().join('|'))
  ).size;
  const matchRate = uniqueLikePairs > 0 ? Math.round((totalMatches / uniqueLikePairs) * 100) : 0;

  const convoPairSet = new Set(
    conversations.map(c =>
      [c.a_participant_id, c.b_participant_id].sort().join('|')
    )
  );

  let matchesToConversation = 0;
  for (const pair of matchedPairs) {
    if (convoPairSet.has(pair)) matchesToConversation++;
  }
  const deadMatches = totalMatches - matchesToConversation;

  // ── Conversations & Messages ──
  const totalConversations = conversations.length;
  const totalMessages = messages.length;

  let textMessages = 0, imageMessages = 0;
  for (const m of messages) {
    if (m.type === 'image') imageMessages++;
    else textMessages++;
  }

  const firstMsgByConvo = new Map<string, { senderId: string; time: string }>();
  const msgCountByConvo = new Map<string, number>();
  for (const m of messages) {
    msgCountByConvo.set(m.conversation_id, (msgCountByConvo.get(m.conversation_id) || 0) + 1);
    const existing = firstMsgByConvo.get(m.conversation_id);
    if (!existing || m.created_at < existing.time) {
      firstMsgByConvo.set(m.conversation_id, { senderId: m.sender_participant_id, time: m.created_at });
    }
  }

  let firstMessageByMen = 0, firstMessageByWomen = 0;
  for (const [, v] of firstMsgByConvo) {
    const g = pMap.get(v.senderId)?.gender;
    if (g === 'male') firstMessageByMen++;
    else if (g === 'female') firstMessageByWomen++;
  }

  const avgMessagesPerConversation = totalConversations > 0
    ? Math.round((totalMessages / totalConversations) * 10) / 10
    : 0;

  let activeConversations = 0, oneMessageConversations = 0;
  for (const [, count] of msgCountByConvo) {
    if (count >= 2) activeConversations++;
    else if (count === 1) oneMessageConversations++;
  }

  // ── Funnel ──
  const setupProfile = participants.length;
  const likeSenders = new Set(likes.map(l => l.from_participant_id));
  const sentFirstLike = [...likeSenders].filter(id => pMap.has(id)).length;

  const matchedParticipants = new Set<string>();
  for (const pair of matchedPairs) {
    const [a, b] = pair.split('|');
    matchedParticipants.add(a);
    matchedParticipants.add(b);
  }
  const gotMatch = [...matchedParticipants].filter(id => pMap.has(id)).length;

  const messageSenders = new Set(messages.map(m => m.sender_participant_id));
  const sentFirstMessage = [...messageSenders].filter(id => pMap.has(id)).length;

  const msgCountByParticipant = new Map<string, number>();
  for (const m of messages) {
    msgCountByParticipant.set(m.sender_participant_id, (msgCountByParticipant.get(m.sender_participant_id) || 0) + 1);
  }
  const activeChatter = [...msgCountByParticipant.entries()]
    .filter(([id, count]) => count >= 3 && pMap.has(id)).length;

  const funnel = {
    joined: allParticipants.length,
    setupProfile,
    sentFirstLike,
    gotMatch,
    sentFirstMessage,
    activeChatter,
  };

  // ── Timing Metrics ──
  let totalTimeToFirstLike = 0, firstLikeCount = 0;
  for (const [pid, likeTime] of Object.entries(firstLikeTime)) {
    const p = pMap.get(pid);
    if (p) {
      const diff = new Date(likeTime).getTime() - new Date(p.created_at).getTime();
      if (diff > 0) { totalTimeToFirstLike += diff; firstLikeCount++; }
    }
  }
  const avgTimeToFirstLikeMinutes = firstLikeCount > 0
    ? Math.round(totalTimeToFirstLike / firstLikeCount / 60000) : 0;

  let totalTimeToFirstMsg = 0, firstMsgTimingCount = 0;
  for (const conv of conversations) {
    const fm = firstMsgByConvo.get(conv.id);
    if (fm) {
      const diff = new Date(fm.time).getTime() - new Date(conv.created_at).getTime();
      if (diff >= 0) { totalTimeToFirstMsg += diff; firstMsgTimingCount++; }
    }
  }
  const avgTimeToFirstMessageMinutes = firstMsgTimingCount > 0
    ? Math.round(totalTimeToFirstMsg / firstMsgTimingCount / 60000) : 0;

  // ── Blocks ──
  const totalBlocks = blocks.length;
  let blocksByMen = 0, blocksByWomen = 0;
  let blocksAfterConversation = 0, blocksAfterLike = 0, blocksWithNoInteraction = 0;

  for (const b of blocks) {
    const blocker = pMap.get(b.blocker_id);
    if (blocker?.gender === 'male') blocksByMen++;
    else if (blocker?.gender === 'female') blocksByWomen++;

    if (b.had_conversation) blocksAfterConversation++;
    else if (b.had_like) blocksAfterLike++;
    else blocksWithNoInteraction++;
  }

  // ── Usage Timeline ──
  const usageTimeline: EventAnalytics['usageTimeline'] = [];
  {
    const BUCKET_MS = 5 * 60 * 1000;
    const buckets = new Map<number, { total: Set<string>; men: Set<string>; women: Set<string> }>();

    const addToBucket = (ts: string, pid: string) => {
      const t = new Date(ts).getTime();
      const bucketKey = Math.floor(t / BUCKET_MS) * BUCKET_MS;
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, { total: new Set(), men: new Set(), women: new Set() });
      }
      const bucket = buckets.get(bucketKey)!;
      bucket.total.add(pid);
      const g = pMap.get(pid)?.gender;
      if (g === 'male') bucket.men.add(pid);
      else if (g === 'female') bucket.women.add(pid);
    };

    for (const row of activityRows) addToBucket(row.created_at, row.participant_id);
    for (const p of participants) addToBucket(p.created_at, p.id);
    for (const l of likes) addToBucket(l.created_at, l.from_participant_id);
    for (const m of messages) addToBucket(m.created_at, m.sender_participant_id);

    for (const [key, bucket] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
      usageTimeline.push({
        timestamp: new Date(key).toISOString(),
        totalOnline: bucket.total.size,
        menOnline: bucket.men.size,
        womenOnline: bucket.women.size,
      });
    }
  }

  // ── Usage by gender + attraction ──
  const interactionCount = new Map<string, number>();
  for (const l of likes) {
    interactionCount.set(l.from_participant_id, (interactionCount.get(l.from_participant_id) || 0) + 1);
  }
  for (const m of messages) {
    interactionCount.set(m.sender_participant_id, (interactionCount.get(m.sender_participant_id) || 0) + 1);
  }
  for (const row of activityRows) {
    if (row.action !== 'heartbeat') {
      interactionCount.set(row.participant_id, (interactionCount.get(row.participant_id) || 0) + 1);
    }
  }

  const groupAgg: Record<string, { totalActions: number; count: number }> = {};
  for (const p of participants) {
    const group = `${p.gender === 'male' ? 'גברים' : 'נשים'} ← ${
      p.attracted_to === 'men' ? 'גברים' : p.attracted_to === 'women' ? 'נשים' : 'הכל'
    }`;
    if (!groupAgg[group]) groupAgg[group] = { totalActions: 0, count: 0 };
    groupAgg[group].count++;
    groupAgg[group].totalActions += interactionCount.get(p.id) || 0;
  }

  const usageByGenderAttraction = Object.entries(groupAgg).map(([group, v]) => ({
    group,
    avgInteractions: v.count > 0 ? Math.round((v.totalActions / v.count) * 10) / 10 : 0,
  }));

  // ── Peak Activity Hour (Israel timezone) ──
  const getIsraelHour = (iso: string) =>
    parseInt(new Date(iso).toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' }), 10);
  const hourCounts: Record<number, number> = {};
  for (const l of likes) {
    const h = getIsraelHour(l.created_at);
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  }
  for (const m of messages) {
    const h = getIsraelHour(m.created_at);
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  }
  let peakActivityHour = '-';
  let peakActivityCount = 0;
  for (const [hour, count] of Object.entries(hourCounts)) {
    if (count > peakActivityCount) {
      peakActivityCount = count;
      peakActivityHour = `${String(hour).padStart(2, '0')}:00`;
    }
  }

  // ── Response Rate, Avg Response Time, Ghost Rate ──
  const msgsByConvo = new Map<string, { senderId: string; time: string }[]>();
  for (const m of messages) {
    if (!msgsByConvo.has(m.conversation_id)) msgsByConvo.set(m.conversation_id, []);
    msgsByConvo.get(m.conversation_id)!.push({ senderId: m.sender_participant_id, time: m.created_at });
  }
  let repliedMessages = 0;
  let responseTotalMs = 0;
  let responseTimeCount = 0;
  let ghostedConversations = 0;
  let conversationsWithMessages = 0;

  for (const [, msgs] of msgsByConvo) {
    msgs.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    conversationsWithMessages++;
    const uniqueSenders = new Set(msgs.map(m => m.senderId));
    if (uniqueSenders.size < 2) {
      ghostedConversations++;
      continue;
    }
    for (let i = 0; i < msgs.length - 1; i++) {
      for (let j = i + 1; j < msgs.length; j++) {
        if (msgs[j].senderId !== msgs[i].senderId) {
          repliedMessages++;
          const diff = new Date(msgs[j].time).getTime() - new Date(msgs[i].time).getTime();
          if (diff > 0) { responseTotalMs += diff; responseTimeCount++; }
          break;
        }
      }
    }
  }

  const responseRate = totalMessages > 0
    ? Math.round((repliedMessages / totalMessages) * 100) : 0;
  const avgResponseTimeMinutes = responseTimeCount > 0
    ? Math.round(responseTotalMs / responseTimeCount / 60000) : 0;
  const ghostRate = conversationsWithMessages > 0
    ? Math.round((ghostedConversations / conversationsWithMessages) * 100) : 0;

  // ── Most Popular Participants (anonymized top 3) ──
  const likesReceivedCount = new Map<string, number>();
  for (const l of likes) {
    likesReceivedCount.set(l.to_participant_id, (likesReceivedCount.get(l.to_participant_id) || 0) + 1);
  }
  const matchCountByPid = new Map<string, number>();
  for (const pair of matchedPairs) {
    const [a, b] = pair.split('|');
    matchCountByPid.set(a, (matchCountByPid.get(a) || 0) + 1);
    matchCountByPid.set(b, (matchCountByPid.get(b) || 0) + 1);
  }
  const mostPopular = [...likesReceivedCount.entries()]
    .filter(([pid]) => pMap.has(pid))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pid, lr], i) => ({
      rank: i + 1,
      likesReceived: lr,
      matchCount: matchCountByPid.get(pid) || 0,
    }));

  // ── Funnel Timing ──
  const likeLookup = new Map<string, number>();
  for (const l of likes) {
    likeLookup.set(`${l.from_participant_id}→${l.to_participant_id}`, new Date(l.created_at).getTime());
  }
  const matchTimeByPid = new Map<string, number>();
  for (const pair of matchedPairs) {
    const [a, b] = pair.split('|');
    const tA = likeLookup.get(`${a}→${b}`) || 0;
    const tB = likeLookup.get(`${b}→${a}`) || 0;
    const matchTs = Math.max(tA, tB);
    if (matchTs > 0) {
      const eA = matchTimeByPid.get(a);
      if (!eA || matchTs < eA) matchTimeByPid.set(a, matchTs);
      const eB = matchTimeByPid.get(b);
      if (!eB || matchTs < eB) matchTimeByPid.set(b, matchTs);
    }
  }

  let totalLikeToMatch = 0, likeToMatchN = 0;
  for (const [pid, matchTs] of matchTimeByPid) {
    const fl = firstLikeTime[pid];
    if (fl) {
      const diff = matchTs - new Date(fl).getTime();
      if (diff >= 0) { totalLikeToMatch += diff; likeToMatchN++; }
    }
  }

  const firstMsgTimePid = new Map<string, number>();
  for (const m of messages) {
    const t = new Date(m.created_at).getTime();
    const ex = firstMsgTimePid.get(m.sender_participant_id);
    if (!ex || t < ex) firstMsgTimePid.set(m.sender_participant_id, t);
  }
  let totalMatchToMsg = 0, matchToMsgN = 0;
  for (const [pid, matchTs] of matchTimeByPid) {
    const fmTime = firstMsgTimePid.get(pid);
    if (fmTime && fmTime >= matchTs) {
      totalMatchToMsg += fmTime - matchTs;
      matchToMsgN++;
    }
  }

  const funnelTiming = {
    avgJoinToFirstLikeMinutes: avgTimeToFirstLikeMinutes,
    avgFirstLikeToMatchMinutes: likeToMatchN > 0 ? Math.round(totalLikeToMatch / likeToMatchN / 60000) : 0,
    avgMatchToFirstMessageMinutes: matchToMsgN > 0 ? Math.round(totalMatchToMsg / matchToMsgN / 60000) : 0,
  };

  // ── Mutual Attraction Heatmap ──
  const getGroup = (pid: string) => {
    const p = pMap.get(pid);
    if (!p) return null;
    return `${p.gender === 'male' ? 'גברים' : 'נשים'} ← ${
      p.attracted_to === 'men' ? 'גברים' : p.attracted_to === 'women' ? 'נשים' : 'הכל'
    }`;
  };
  const heatmapAgg = new Map<string, number>();
  for (const pair of matchedPairs) {
    const [a, b] = pair.split('|');
    const gA = getGroup(a);
    const gB = getGroup(b);
    if (gA && gB) {
      const key = [gA, gB].sort().join('§');
      heatmapAgg.set(key, (heatmapAgg.get(key) || 0) + 1);
    }
  }
  const mutualAttractionMatrix = [...heatmapAgg.entries()].map(([key, matches]) => {
    const [fromGroup, toGroup] = key.split('§');
    return { fromGroup, toGroup, matches };
  }).sort((a, b) => b.matches - a.matches);

  // ── Block After Match Rate ──
  let blockAfterMatchCount = 0;
  for (const b of blocks) {
    if (b.had_match) blockAfterMatchCount++;
  }
  const blockAfterMatchRate = totalBlocks > 0
    ? Math.round((blockAfterMatchCount / totalBlocks) * 100) : 0;

  // ── Photo Impact ──
  const pidsWithPhoto = new Set(photos.map(p => p.participant_id));
  let likesWithPhoto = 0, nWithPhoto = 0;
  let likesNoPhoto = 0, nNoPhoto = 0;
  for (const p of participants) {
    const rcv = likesReceivedCount.get(p.id) || 0;
    if (pidsWithPhoto.has(p.id)) { likesWithPhoto += rcv; nWithPhoto++; }
    else { likesNoPhoto += rcv; nNoPhoto++; }
  }
  const photoImpact = {
    avgLikesWithPhoto: nWithPhoto > 0 ? Math.round((likesWithPhoto / nWithPhoto) * 10) / 10 : 0,
    avgLikesWithoutPhoto: nNoPhoto > 0 ? Math.round((likesNoPhoto / nNoPhoto) * 10) / 10 : 0,
  };

  // ── Assemble ──
  return {
    incompleteRegistrations,
    totalParticipants,
    totalMen,
    totalWomen,
    menAttractedToMen,
    menAttractedToWomen,
    menAttractedToAll,
    womenAttractedToMen,
    womenAttractedToWomen,
    womenAttractedToAll,
    ageDistribution,
    participantsWithPhotos,
    totalPhotosUploaded,
    avgPhotosPerParticipant,
    totalLikes,
    likeSentByMen,
    likeSentByWomen,
    firstLikeByGender,
    likesSeenCount,
    likesUnseenCount,
    avgLikesPerParticipant,
    totalMatches,
    matchRate,
    matchesToConversation,
    deadMatches,
    totalConversations,
    firstMessageByMen,
    firstMessageByWomen,
    totalMessages,
    textMessages,
    imageMessages,
    avgMessagesPerConversation,
    activeConversations,
    oneMessageConversations,
    funnel,
    avgTimeToFirstLikeMinutes,
    avgTimeToFirstMessageMinutes,
    totalBlocks,
    blocksByMen,
    blocksByWomen,
    blocksAfterConversation,
    blocksAfterLike,
    blocksWithNoInteraction,
    usageTimeline,
    usageByGenderAttraction,
    peakActivityHour,
    peakActivityCount,
    responseRate,
    avgResponseTimeMinutes,
    ghostRate,
    ghostedConversations,
    mostPopular,
    funnelTiming,
    mutualAttractionMatrix,
    blockAfterMatchRate,
    blockAfterMatchCount,
    photoImpact,
  };
}
