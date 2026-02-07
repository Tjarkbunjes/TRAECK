'use client';

import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth, useFriends, useFriendRequests, useFriendWorkouts, useFriendWeight } from '@/lib/hooks';
import { WeightChart } from '@/components/WeightChart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Check, X, ChevronDown, ChevronUp, Dumbbell, Scale, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, startOfWeek, addDays, eachWeekOfInterval, subDays } from 'date-fns';

export default function FriendsPage() {
  const { user } = useAuth();
  const { friends, loading: friendsLoading, refresh: refreshFriends } = useFriends();
  const { requests, loading: requestsLoading, refresh: refreshRequests } = useFriendRequests();
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

    // Search for user by email
    const { data: found, error: searchErr } = await supabase.rpc('search_user_by_email', {
      search_email: email.trim(),
    });

    if (searchErr || !found || found.length === 0) {
      toast.error('no user found with that email.');
      setSending(false);
      return;
    }

    const friendId = found[0].id;

    // Check if friendship already exists
    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`);

    if (existing && existing.length > 0) {
      const status = existing[0].status;
      toast.error(status === 'accepted' ? 'you\'re already friends.' : 'request already sent.');
      setSending(false);
      return;
    }

    // Create friend request
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
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', requestId);

    if (error) {
      toast.error('failed to decline.');
    } else {
      refreshRequests();
    }
  }

  async function handleRemove(friendshipId: string) {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) {
      toast.error('failed to remove friend.');
    } else {
      toast.success('friend removed.');
      refreshFriends();
      if (expandedFriend) setExpandedFriend(null);
    }
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
                  <p className="text-sm font-medium">{req.profiles?.display_name || 'unknown'}</p>
                  <p className="text-xs text-muted-foreground">{req.profiles?.email}</p>
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
            const friendProfile = f.profiles;
            const friendId = friendProfile?.id || '';
            const isExpanded = expandedFriend === friendId;

            return (
              <Card key={f.id}>
                <button
                  onClick={() => setExpandedFriend(isExpanded ? null : friendId)}
                  className="w-full text-left"
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold">
                          {(friendProfile?.display_name || friendProfile?.email || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{friendProfile?.display_name || 'unknown'}</p>
                        <p className="text-xs text-muted-foreground">{friendProfile?.email}</p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </CardContent>
                </button>
                {isExpanded && (
                  <FriendDetail friendId={friendId} friendshipId={f.id} onRemove={handleRemove} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FriendDetail({ friendId, friendshipId, onRemove }: { friendId: string; friendshipId: string; onRemove: (id: string) => void }) {
  const { workouts, loading: workoutsLoading } = useFriendWorkouts(friendId);
  const { entries: weightEntries, loading: weightLoading } = useFriendWeight(friendId);

  // Build activity heatmap: last 12 weeks
  const activityByWeek = useMemo(() => {
    if (workouts.length === 0) return [];
    const now = new Date();
    const start = subDays(now, 84); // 12 weeks
    const weeks = eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 });

    return weeks.map((weekStart) => {
      const weekEnd = addDays(weekStart, 6);
      const count = workouts.filter((w) => {
        const d = parseISO(w.date);
        return d >= weekStart && d <= weekEnd;
      }).length;
      return { weekStart: format(weekStart, 'MMM d'), count };
    });
  }, [workouts]);

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

  return (
    <div className="px-3 pb-3 space-y-4">
      {/* Workout Activity */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Dumbbell className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">gym activity (12 weeks)</span>
        </div>
        {workoutsLoading ? (
          <div className="text-xs text-muted-foreground">loading...</div>
        ) : workouts.length === 0 ? (
          <div className="text-xs text-muted-foreground">no workouts yet.</div>
        ) : (
          <>
            <div className="flex gap-1">
              {activityByWeek.map((w, i) => (
                <div key={i} className="flex-1 text-center">
                  <div
                    className={`h-6 rounded-[4px] flex items-center justify-center ${
                      w.count > 0
                        ? w.count >= 4
                          ? 'bg-[#2626FF]/80'
                          : w.count >= 2
                          ? 'bg-[#2626FF]/50'
                          : 'bg-[#2626FF]/25'
                        : 'bg-muted/20'
                    }`}
                  >
                    {w.count > 0 && <span className="text-[9px] font-bold text-white">{w.count}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-muted-foreground">{activityByWeek[0]?.weekStart}</span>
              <span className="text-[9px] text-muted-foreground">now</span>
            </div>
          </>
        )}
      </div>

      {/* Weight Chart */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Scale className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">weight (90 days)</span>
        </div>
        {weightLoading ? (
          <div className="text-xs text-muted-foreground">loading...</div>
        ) : weightChartEntries.length === 0 ? (
          <div className="text-xs text-muted-foreground">no weight data.</div>
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
