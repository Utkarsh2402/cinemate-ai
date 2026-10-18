import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Sparkles, Check, ArrowRight, Share2, Copy, Smartphone, RefreshCw, Trophy } from 'lucide-react';
import type { GroupPlannerResult } from '../types';
import { api } from '../api';

interface GroupPlannerModalProps {
  currentCity: string;
  onSelectMovieById: (movieId: string) => void;
  onClose: () => void;
}

interface FriendProfile {
  id: string;
  name: string;
  genres: string[];
  languages: string[];
  maxBudget: number;
}

export const GroupPlannerModal: React.FC<GroupPlannerModalProps> = ({
  currentCity,
  onSelectMovieById,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'live' | 'quick'>('live');

  // Live Session State
  const [sessionName, setSessionName] = useState<string>('Friday Night Cinema');
  const [hostName, setHostName] = useState<string>('Me (Host)');
  const [sessionCode, setSessionCode] = useState<string>('');
  const [sessionData, setSessionData] = useState<any>(null);
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Join State (for friends joining on phone or modal)
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [joinName, setJoinName] = useState<string>('');
  const [joinBudget, setJoinBudget] = useState<number>(450);
  const [joinGenres, setJoinGenres] = useState<string[]>(['Action', 'Comedy']);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [joinedSuccess, setJoinedSuccess] = useState<boolean>(false);

  // Quick Offline Simulator State
  const [friends, setFriends] = useState<FriendProfile[]>([
    { id: '1', name: 'Rohan', genres: ['Sci-Fi', 'Action'], languages: ['Hindi', 'English'], maxBudget: 450 },
    { id: '2', name: 'Sneha', genres: ['Comedy', 'Drama'], languages: ['Hindi'], maxBudget: 350 },
    { id: '3', name: 'Vikram', genres: ['Action', 'Thriller'], languages: ['Hindi'], maxBudget: 500 },
  ]);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [planResult, setPlanResult] = useState<GroupPlannerResult | null>(null);

  const availableGenres = ['Action', 'Sci-Fi', 'Comedy', 'Drama', 'Horror', 'Thriller', 'Adventure', 'Mystery'];

  // Check URL params for ?room=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setJoinCodeInput(roomParam.toUpperCase());
      setActiveTab('live');
    }
  }, []);

  // Poll active session for joined members
  useEffect(() => {
    if (!sessionCode) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.getGroupSession(sessionCode);
        setSessionData(res);
        if (res.status === 'DECIDED' && res.consensus_result) {
          setPlanResult(res.consensus_result);
        }
      } catch (err) {
        console.error('Polling group session failed:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [sessionCode]);

  // Handle Host creating a live invite session
  const handleCreateSession = async () => {
    try {
      setIsCreatingSession(true);
      const res = await api.createGroupSession(sessionName, hostName);
      setSessionCode(res.invite_code);
      setSessionData(res);
    } catch (err: any) {
      alert(err.message || 'Failed to create room');
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Handle Friend joining the session
  const handleJoinSession = async () => {
    if (!joinCodeInput || !joinName) {
      alert('Please enter both Room Code and Your Name');
      return;
    }
    try {
      setIsJoining(true);
      const res = await api.joinGroupSession(joinCodeInput.trim().toUpperCase(), {
        name: joinName,
        preferred_genres: joinGenres,
        preferred_languages: ['Hindi', 'English'],
        max_budget: joinBudget,
      });
      setSessionCode(res.invite_code);
      setSessionData(res);
      setJoinedSuccess(true);
    } catch (err: any) {
      alert(err.message || 'Could not join room');
    } finally {
      setIsJoining(false);
    }
  };

  // Handle Host calculating consensus
  const handleDecideSession = async () => {
    if (!sessionCode) return;
    try {
      setIsCalculating(true);
      const res = await api.decideGroupSession(sessionCode);
      setSessionData(res);
      if (res.consensus_result) {
        setPlanResult(res.consensus_result);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to calculate consensus');
    } finally {
      setIsCalculating(false);
    }
  };

  // Copy Invite Link to Clipboard
  const getInviteUrl = () => {
    const origin = window.location.origin;
    return `${origin}/?room=${sessionCode}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getInviteUrl());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `🍿 Hey! Vote for our movie night on CineMate AI! Tap to choose your favorite genres and budget: ${getInviteUrl()}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Quick local calculations
  const handleQuickCalculate = async () => {
    try {
      setIsCalculating(true);
      const membersInput = friends.map((f) => ({
        name: f.name,
        preferred_genres: f.genres,
        preferred_languages: f.languages,
        max_budget: f.maxBudget,
      }));
      const res = await api.planGroupMovie(sessionName, membersInput, currentCity);
      setPlanResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl glass-card border border-slate-700/80 p-6 sm:p-8 flex flex-col justify-between my-auto shadow-2xl">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-900/40">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  Multiplayer Movie Night Planner
                </h2>
                <p className="text-xs text-slate-400">
                  Invite friends via link or phone code • Everyone votes • AI selects the winning film
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-2 mt-5 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 max-w-md mx-auto">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'live'
                  ? 'bg-rose-600 text-white shadow-glow-red'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              📱 Live Phone Invite Room
            </button>
            <button
              onClick={() => setActiveTab('quick')}
              className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'quick'
                  ? 'bg-rose-600 text-white shadow-glow-red'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚡ Quick Offline Simulator
            </button>
          </div>

          {/* TAB 1: LIVE MULTIPLAYER INVITE */}
          {activeTab === 'live' && (
            <div className="mt-6 space-y-6">
              {!sessionCode ? (
                /* Step A: Create or Join View */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Host Box */}
                  <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-rose-400 font-bold text-sm mb-2">
                        <Share2 className="w-4 h-4" />
                        Option 1: Host a New Movie Night
                      </div>
                      <p className="text-xs text-slate-400 mb-4">
                        Create an invite link to send on WhatsApp or scan with a phone camera.
                      </p>
                      <div className="space-y-3 mb-6">
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Session Name</label>
                          <input
                            type="text"
                            value={sessionName}
                            onChange={(e) => setSessionName(e.target.value)}
                            placeholder="e.g. Friday Squad Movie"
                            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Your Name (Host)</label>
                          <input
                            type="text"
                            value={hostName}
                            onChange={(e) => setHostName(e.target.value)}
                            placeholder="Your Name"
                            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleCreateSession}
                      disabled={isCreatingSession}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-glow-red flex items-center justify-center gap-2"
                    >
                      {isCreatingSession ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Create Invite Room
                    </button>
                  </div>

                  {/* Join Box */}
                  <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-2">
                        <Smartphone className="w-4 h-4" />
                        Option 2: Join a Friend's Room
                      </div>
                      <p className="text-xs text-slate-400 mb-4">
                        Did a friend send you a 6-digit room code? Enter it below to submit your picks!
                      </p>
                      <div className="space-y-3 mb-4">
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Room Code</label>
                          <input
                            type="text"
                            value={joinCodeInput}
                            onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                            placeholder="e.g. CNM-8492"
                            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white font-mono uppercase tracking-widest focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Your Name</label>
                          <input
                            type="text"
                            value={joinName}
                            onChange={(e) => setJoinName(e.target.value)}
                            placeholder="e.g. Rohan"
                            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Your Max Budget:</span>
                            <span className="font-bold text-amber-400">₹{joinBudget}</span>
                          </div>
                          <input
                            type="range"
                            min="150"
                            max="1000"
                            step="50"
                            value={joinBudget}
                            onChange={(e) => setJoinBudget(Number(e.target.value))}
                            className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1.5">Pick Your Favorite Genres:</label>
                          <div className="flex flex-wrap gap-1.5">
                            {availableGenres.map((g) => {
                              const active = joinGenres.includes(g);
                              return (
                                <button
                                  key={g}
                                  type="button"
                                  onClick={() =>
                                    setJoinGenres(active ? joinGenres.filter((x) => x !== g) : [...joinGenres, g])
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                                    active
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                                  }`}
                                >
                                  {g}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      {joinedSuccess && (
                        <div className="p-3 my-2 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-400" />
                          You have joined the room! Preferences submitted.
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleJoinSession}
                      disabled={isJoining}
                      className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      {isJoining ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Join Room & Submit My Preferences
                    </button>
                  </div>
                </div>
              ) : (
                /* Step B: Active Waiting Room / Joined Members */
                <div className="space-y-6 animate-fade-in">
                  {/* Shareable Code Banner */}
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-rose-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Room Active • Live Sharing Enabled
                      </div>
                      <h3 className="text-xl font-black text-white">{sessionData?.name || sessionName}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Share this link with your friends. When they join from their phone, they will appear below!
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="px-4 py-2 bg-slate-950 rounded-xl border border-slate-700 font-mono text-lg font-black text-amber-400 tracking-widest">
                        {sessionCode}
                      </div>
                      <button
                        onClick={handleCopyLink}
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                        title="Copy Link"
                      >
                        {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        {isCopied ? 'Copied!' : 'Copy Link'}
                      </button>
                      <button
                        onClick={handleShareWhatsApp}
                        className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg"
                      >
                        <Share2 className="w-4 h-4" />
                        WhatsApp
                      </button>
                    </div>
                  </div>

                  {/* Joined Friends Roster */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-rose-400" />
                        Joined Friends ({sessionData?.members?.length || 0})
                      </h4>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Auto-syncing every 2s
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {sessionData?.members?.map((m: any, idx: number) => (
                        <div
                          key={m.id || idx}
                          className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-sm text-white flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-rose-600/30 text-rose-400 flex items-center justify-center text-xs font-black">
                                {m.name[0]?.toUpperCase()}
                              </span>
                              {m.name}
                            </span>
                            <span className="text-xs font-semibold text-amber-400">₹{m.max_budget}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {m.preferred_genres?.map((g: string) => (
                              <span
                                key={g}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700/50"
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Host Decision Action */}
                  <div className="pt-2">
                    <button
                      onClick={handleDecideSession}
                      disabled={isCalculating}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-extrabold text-sm uppercase tracking-wider transition-all shadow-glow-red flex items-center justify-center gap-2"
                    >
                      {isCalculating ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trophy className="w-5 h-5 text-amber-200" />
                      )}
                      ✨ Calculate Group Match & Reveal Winning Movie
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: QUICK OFFLINE SIMULATOR */}
          {activeTab === 'quick' && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-base font-bold text-white focus:outline-none focus:border-rose-500 w-full max-w-md"
                />
                <button
                  onClick={() =>
                    setFriends([
                      ...friends,
                      { id: Date.now().toString(), name: `Friend ${friends.length + 1}`, genres: ['Action', 'Comedy'], languages: ['Hindi'], maxBudget: 400 },
                    ])
                  }
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700"
                >
                  <Plus className="w-4 h-4 text-rose-500" />
                  Add Friend
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {friends.map((f, idx) => (
                  <div key={f.id} className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={f.name}
                        onChange={(e) => {
                          const updated = [...friends];
                          updated[idx].name = e.target.value;
                          setFriends(updated);
                        }}
                        className="font-bold text-sm text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:outline-none focus:border-rose-500"
                      />
                      {friends.length > 2 && (
                        <button
                          onClick={() => setFriends(friends.filter((x) => x.id !== f.id))}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Max Budget:</span>
                        <span className="font-bold text-amber-400">₹{f.maxBudget}</span>
                      </div>
                      <input
                        type="range"
                        min="150"
                        max="1000"
                        step="50"
                        value={f.maxBudget}
                        onChange={(e) => {
                          const updated = [...friends];
                          updated[idx].maxBudget = Number(e.target.value);
                          setFriends(updated);
                        }}
                        className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">Favorite Genres</span>
                      <div className="flex flex-wrap gap-1">
                        {availableGenres.map((g) => {
                          const active = f.genres.includes(g);
                          return (
                            <button
                              key={g}
                              type="button"
                              onClick={() => {
                                const updated = [...friends];
                                updated[idx].genres = active ? f.genres.filter((x) => x !== g) : [...f.genres, g];
                                setFriends(updated);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                active
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-slate-950 text-slate-500 border-slate-800'
                              }`}
                            >
                              {g}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleQuickCalculate}
                disabled={isCalculating}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-glow-red flex items-center justify-center gap-2"
              >
                {isCalculating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Calculate Group Match & Recommendations
              </button>
            </div>
          )}

          {/* CONSENSUS RESULTS (Shown in both tabs when calculated) */}
          {planResult && (
            <div className="mt-8 pt-6 border-t border-slate-800 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    AI Group Consensus Result
                  </div>
                  <h3 className="text-lg font-black text-white">{planResult.group_name} Choice</h3>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-slate-300 leading-relaxed">
                {planResult.insights}
              </div>

              {/* Winning Movie Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {planResult.recommendations.map((rec, idx) => (
                  <div
                    key={rec.movie_id}
                    className="p-4 rounded-2xl glass-card border border-slate-800 flex gap-4 items-center justify-between hover:border-rose-500/40 transition-all"
                  >
                    <div className="flex gap-3 items-center">
                      <img
                        src={rec.poster_url}
                        alt={rec.title}
                        className="w-16 h-24 object-cover rounded-xl bg-slate-900 shadow-md"
                      />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              idx === 0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            #{idx + 1} Choice
                          </span>
                          <span className="text-xs font-black text-emerald-400">
                            {rec.compatibility_score}% Match
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-white">{rec.title}</h4>
                        <p className="text-[11px] text-slate-400 mb-2">{rec.genres.slice(0, 2).join(', ')}</p>
                        <ul className="text-[10px] text-slate-400 space-y-0.5">
                          {rec.consensus_reasons.map((r, i) => (
                            <li key={i} className="flex items-center gap-1">
                              <Check className="w-2.5 h-2.5 text-emerald-400" /> {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onClose();
                        onSelectMovieById(rec.movie_id);
                      }}
                      className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-glow-red flex-shrink-0"
                    >
                      Book <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
