'use client';

import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth, useFriends, useFriendRequests, useFriendWorkouts, useFriendWeight, useFriendCaloriesWeek } from '@/lib/hooks';
import { WeightChart } from '@/components/WeightChart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Check, X, ChevronDown, ChevronUp, Dumbbell, Scale, Mail, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, eachWeekOfInterval, startOfWeek, startOfYear, differenceInWeeks } from 'date-fns';

export default function FriendsPage() {
  const { user } = useAuth();
  const { friends, loading: friendsLoading, refresh: refreshFriends } = useFriends();
  const { requests, refresh: refreshRequests } = useFriendRequests();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [expandedFriend, setExpandedFriend] = useState<string | null>(null);

  async function handleAddFriend() {
    if (!user || !email.trim()) {
      toast.error('please enter an email.');
      return;
    }

    if (email.trim().toLowerCase() === user.email?.toLowerCase()) {
      toast.error('you can\'t add yourself.');
      return;
    }

    setSending(true);

    const { data: found, error: searchErr } = await supabase.rpc('search_user_by_email', {
      search_email: email.trim(),
    });

    if (searchErr || !found || found.length === 0) {
      toast.error('no user found with that email.');
      setSending(false);
      return;
    }

    const friendId = found[0].id;

    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`);

    if (existing && existing.length > 0) {
      const status = existing[0].status;
      toast.error(status === 'accepted' ? 'already friends.' : 'request already sent.');
      setSending(false);
      return;
    }

    const { error } = await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: friendId,
      status: 'pending',
    });

    if (error) {
      toast.error('failed to send request.');
    } else {
      toast.success('friend request sent!');
      setEmail('');
      refreshFriends();
      refreshRequests();
    }
    setSending(false);
  }

  async function handleAccept(requestId: string) {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', requestId);

    if (error) {
      toast.error('failed to accept.');
    } else {
      toast.success('friend added!');
      refreshFriends();
      refreshRequests();
    }
  }

  async function handleDecline(requestId: string) {
    await supabase.from('friendships').delete().eq('id', requestId);
    refreshRequests();
  }

  async function handleRemove(friendshipId: string) {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
    if (error) {
      toast.error('failed to remove friend.');
    } else {
      toast.success('friend removed.');
      refreshFriends();
      setExpandedFriend(null);
    }
  }

  async function handleSetNickname(friendshipId: string, nickname: string) {
    await supabase
      .from('friendships')
      .update({ nickname: nickname || null })
      .eq('id', friendshipId);
    refreshFriends();
  }

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <h1 className="text-2xl font-bold">friends</h1>

      {/* Add Friend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="friend's email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
              />
            </div>
            <Button onClick={handleAddFriend} disabled={sending} size="icon" className="shrink-0">
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Requests */}
      {requests.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              requests
              <Badge variant="secondary" className="text-xs">{requests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-2 rounded-md bg-muted/20">
                <div>
                  <p className="text-sm font-medium">
                    {req.friend_profile?.display_name || req.friend_profile?.email || 'unknown'}
                  </p>
                  {req.friend_profile?.display_name && (
                    <p className="text-xs text-muted-foreground">{req.friend_profile?.email}</p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500" onClick={() => handleAccept(req.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDecline(req.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Friends List */}
      {friendsLoading ? (
        <div className="text-center text-muted-foreground text-sm py-8">loading...</div>
      ) : friends.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-8">
          no friends yet. add someone by email!
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map((f) => {
            const fp = f.friend_profile;
            const friendId = fp?.id || '';
            const displayName = f.nickname || fp?.display_name || fp?.email || '?';
            const isExpanded = expandedFriend === f.id;

            return (
              <Card key={f.id}>
                <button
                  onClick={() => setExpandedFriend(isExpanded ? null : f.id)}
                  className="w-full text-left"
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{fp?.email || displayName}</p>
                      {fp?.email && <p className="text-xs text-muted-foreground">{displayName}</p>}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </CardContent>
                </button>
                {isExpanded && (
                  <FriendDashboard
                    friendId={friendId}
                    friendshipId={f.id}
                    currentNickname={f.nickname || ''}
                    onSetNickname={handleSetNickname}
                    onRemove={handleRemove}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FriendDashboard({
  friendId,
  friendshipId,
  currentNickname,
  onSetNickname,
  onRemove,
}: {
  friendId: string;
  friendshipId: string;
  currentNickname: string;
  onSetNickname: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const { workouts, loading: workoutsLoading } = useFriendWorkouts(friendId);
  const { entries: weightEntries, loading: weightLoading } = useFriendWeight(friendId);
  const { days: calorieDays } = useFriendCaloriesWeek(friendId);
  const [editingName, setEditingName] = useState(false);
  const [nickname, setNickname] = useState(currentNickname);

  const now = new Date();
  const yearStart = startOfYear(now);

  // Workouts this week
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeekStr = format(thisWeekStart, 'yyyy-MM-dd');
  const workoutsThisWeek = workouts.filter(w => w.date >= thisWeekStr).length;

  // Avg calories this week
  const avgCaloriesWeek = calorieDays.length > 0
    ? Math.round(calorieDays.reduce((s, d) => s + Number(d.total_calories), 0) / calorieDays.length)
    : null;

  // Last weight
  const weightChartEntries = useMemo(() => {
    return weightEntries.map((e) => ({
      id: e.date,
      user_id: '',
      date: e.date,
      weight_kg: Number(e.weight_kg),
      body_fat_pct: null,
      notes: null,
      created_at: '',
    }));
  }, [weightEntries]);

  const latestWeight = weightChartEntries.length > 0
    ? weightChartEntries[weightChartEntries.length - 1].weight_kg
    : null;

  // Per week average (from first entry this year)
  const perWeekAvg = useMemo(() => {
    if (workouts.length === 0) return 0;
    const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
    const firstEntryDate = new Date(sorted[0].date + 'T12:00:00');
    const weeksActive = Math.max(1, differenceInWeeks(now, firstEntryDate) + 1);
    return Math.round((workouts.length / weeksActive) * 10) / 10;
  }, [workouts, now]);

  // Build activity grid: from Jan 1 to now
  const activityByWeek = useMemo(() => {
    const weeks = eachWeekOfInterval({ start: yearStart, end: now }, { weekStartsOn: 1 });

    return weeks.map((ws) => {
      const days = Array.from({ length: 7 }, (_, i) => {
        const day = addDays(ws, i);
        const dayStr = format(day, 'yyyy-MM-dd');
        const workout = workouts.find((w) => w.date === dayStr);
        return { date: day, dayStr, workout };
      });
      return { weekStart: ws, days };
    });
  }, [workouts, yearStart, now]);

  function saveNickname() {
    onSetNickname(friendshipId, nickname.trim());
    setEditingName(false);
  }

  // Calculate label interval based on number of weeks
  const labelInterval = activityByWeek.length > 20 ? 6 : activityByWeek.length > 10 ? 4 : 3;

  return (
    <div className="px-3 pb-3 space-y-4 border-t border-border pt-3">
      {/* Nickname edit */}
      <div className="flex items-center gap-2">
        {editingName ? (
          <div className="flex gap-2 flex-1">
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="nickname..."
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && saveNickname()}
            />
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={saveNickname}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setEditingName(false); setNickname(currentNickname); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-3 w-3" />
            {currentNickname ? 'edit nickname' : 'set nickname'}
          </button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-muted/20 p-2.5 text-center">
          <p className="text-lg font-bold font-mono">{workoutsThisWeek}</p>
          <p className="text-[10px] text-muted-foreground">workouts this week</p>
        </div>
        <div className="rounded-lg bg-muted/20 p-2.5 text-center">
          <p className="text-lg font-bold font-mono">{avgCaloriesWeek ?? '–'}</p>
          <p className="text-[10px] text-muted-foreground">avg kcal this week</p>
        </div>
        <div className="rounded-lg bg-muted/20 p-2.5 text-center">
          <p className="text-lg font-bold font-mono">{latestWeight ?? '–'}</p>
          <p className="text-[10px] text-muted-foreground">last weight</p>
        </div>
      </div>

      {/* Gym Activity Heatmap - this year */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Dumbbell className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">gym activity {now.getFullYear()}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {workouts.length} workouts · {perWeekAvg}/week
          </span>
        </div>
        {workoutsLoading ? (
          <div className="text-xs text-muted-foreground py-2">loading...</div>
        ) : (
          <div className="space-y-0.5 overflow-x-auto">
            {/* Month labels */}
            <div className="flex gap-[2px] mb-1">
              <div className="w-4 shrink-0" />
              {activityByWeek.map((week, wi) => (
                <div key={wi} className="flex-1 min-w-[8px] text-center">
                  {wi % labelInterval === 0 && (
                    <span className="text-[7px] text-muted-foreground">
                      {format(week.weekStart, 'MMM')}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {/* Grid rows (Mon-Sun) */}
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayLabel, dayIdx) => (
              <div key={dayIdx} className="flex gap-[2px] items-center">
                <span className="text-[7px] text-muted-foreground w-4 shrink-0 text-right pr-0.5">
                  {dayIdx % 2 === 0 ? dayLabel : ''}
                </span>
                {activityByWeek.map((week, wi) => {
                  const day = week.days[dayIdx];
                  const hasWorkout = !!day?.workout;
                  const isFuture = day?.date > now;
                  return (
                    <div
                      key={wi}
                      className={`flex-1 min-w-[8px] aspect-square rounded-[2px] ${
                        isFuture
                          ? 'bg-transparent'
                          : hasWorkout
                          ? 'bg-[#2626FF]'
                          : 'bg-muted/20'
                      }`}
                      title={hasWorkout ? `${day.dayStr}: ${day.workout?.name || 'workout'}` : day?.dayStr}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weight Chart - this year */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Scale className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">weight {now.getFullYear()}</span>
        </div>
        {weightLoading ? (
          <div className="text-xs text-muted-foreground py-2">loading...</div>
        ) : weightChartEntries.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">no weight data.</div>
        ) : (
          <WeightChart entries={weightChartEntries} />
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full text-xs text-destructive hover:text-destructive"
        onClick={() => onRemove(friendshipId)}
      >
        remove friend
      </Button>
    </div>
  );
}
