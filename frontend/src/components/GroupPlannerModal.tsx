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

  // Poll room data if active room exists
  useEffect(() => {
    if (!sessionCode) return;
    const fetchSession = async () => {
      try {
        const data = await api.getGroupSession(sessionCode);
        setSessionData(data);
        if (data.status === 'DECIDED' && data.consensus_result) {
          setPlanResult(data.consensus_result);
        }
      } catch (err) {
        console.error('Failed to poll room:', err);
      }
    };

    fetchSession();
    const interval = setInterval(fetchSession, 2500);
    return () => clearInterval(interval);
  }, [sessionCode]);

  // Handle Host creating a room
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

  // Handle Joining a room
  const handleJoinSession = async () => {
    if (!joinCodeInput.trim() || !joinName.trim()) {
      alert('Please enter both the room code and your name');
      return;
    }
    try {
      setIsJoining(true);
      const res = await api.joinGroupSession(joinCodeInput.trim().toUpperCase(), {
        name: joinName.trim(),
        preferred_genres: joinGenres,
        preferred_languages: ['Hindi', 'English'],
        max_budget: joinBudget,
      });
      setSessionCode(joinCodeInput.trim().toUpperCase());
      setSessionData(res);
      setJoinedSuccess(true);
    } catch (err: any) {
      alert(err.message || 'Failed to join room');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 flex flex-col justify-between my-auto shadow-2xl text-slate-900">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-md shadow-rose-200">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                  Multiplayer Movie Night Planner
                </h2>
                <p className="text-xs text-slate-500">
                  Invite friends via link or phone code • Everyone votes • AI selects the winning film
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors font-bold text-sm"
            >
              ✕
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-2 mt-5 p-1 bg-slate-100 rounded-2xl border border-slate-200 max-w-md mx-auto">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'live'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Live Phone Invite Room</span>
            </button>
            <button
              onClick={() => setActiveTab('quick')}
              className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'quick'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Quick Offline Simulator</span>
            </button>
          </div>

          {/* TAB 1: LIVE MULTIPLAYER INVITE */}
          {activeTab === 'live' && (
            <div className="mt-6 space-y-6">
              {!sessionCode ? (
                /* Step A: Create or Join View */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Host Box */}
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-rose-600 font-bold text-sm mb-2">
                        <Share2 className="w-4 h-4" />
                        Option 1: Host a New Movie Night
                      </div>
                      <p className="text-xs text-slate-500 mb-4">
                        Create an invite link to send on WhatsApp or scan with a phone camera.
                      </p>
                      <div className="space-y-3 mb-6">
                        <div>
                          <label className="text-xs text-slate-600 font-semibold block mb-1">Session Name</label>
                          <input
                            type="text"
                            value={sessionName}
                            onChange={(e) => setSessionName(e.target.value)}
                            placeholder="e.g. Friday Squad Movie"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-rose-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-600 font-semibold block mb-1">Your Name (Host)</label>
                          <input
                            type="text"
                            value={hostName}
                            onChange={(e) => setHostName(e.target.value)}
                            placeholder="Your Name"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-rose-500"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleCreateSession}
                      disabled={isCreatingSession}
                      className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-rose-200 flex items-center justify-center gap-2"
                    >
                      {isCreatingSession ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Create Invite Room
                    </button>
                  </div>

                  {/* Join Box */}
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-amber-600 font-bold text-sm mb-2">
                        <Smartphone className="w-4 h-4" />
                        Option 2: Join a Friend's Room
                      </div>
                      <p className="text-xs text-slate-500 mb-4">
                        Did a friend send you a 6-digit room code? Enter it below to submit your picks!
                      </p>
                      <div className="space-y-3 mb-4">
                        <div>
                          <label className="text-xs text-slate-600 font-semibold block mb-1">Room Code</label>
                          <input
                            type="text"
                            value={joinCodeInput}
                            onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                            placeholder="e.g. CNM-8492"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-mono uppercase tracking-widest focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-600 font-semibold block mb-1">Your Name</label>
                          <input
                            type="text"
                            value={joinName}
                            onChange={(e) => setJoinName(e.target.value)}
                            placeholder="e.g. Rohan"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-slate-600 font-semibold mb-1">
                            <span>Your Max Budget:</span>
                            <span className="font-bold text-amber-600">₹{joinBudget}</span>
                          </div>
                          <input
                            type="range"
                            min="150"
                            max="1000"
                            step="50"
                            value={joinBudget}
                            onChange={(e) => setJoinBudget(Number(e.target.value))}
                            className="w-full accent-amber-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-600 font-semibold block mb-1.5">Pick Your Favorite Genres:</label>
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
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
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
                        <div className="p-3 my-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2 font-semibold">
                          <Check className="w-4 h-4 text-emerald-600" />
                          You have joined the room! Preferences submitted.
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleJoinSession}
                      disabled={isJoining}
                      className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-200 flex items-center justify-center gap-2"
                    >
                      {isJoining ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Join Room & Submit My Preferences
                    </button>
                  </div>
                </div>
              ) : (
                /* Step B: Active Waiting Room / Joined Members */
                <div className="space-y-6 animate-fadeIn">
                  {/* Shareable Code Banner */}
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-rose-600 text-xs font-black uppercase tracking-wider mb-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Room Active • Live Sharing Enabled
                      </div>
                      <h3 className="text-xl font-black text-slate-900">{sessionData?.name || sessionName}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Share this link with your friends. When they join from their phone, they will appear below!
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="px-4 py-2 bg-white rounded-xl border border-slate-300 font-mono text-lg font-black text-amber-600 tracking-widest shadow-sm">
                        {sessionCode}
                      </div>
                      <button
                        onClick={handleCopyLink}
                        className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-200"
                        title="Copy Link"
                      >
                        {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        {isCopied ? 'Copied!' : 'Copy Link'}
                      </button>
                      <button
                        onClick={handleShareWhatsApp}
                        className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Share2 className="w-4 h-4" />
                        WhatsApp
                      </button>
                    </div>
                  </div>

                  {/* Joined Friends Roster */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Users className="w-4 h-4 text-rose-600" />
                        Joined Friends ({sessionData?.members?.length || 0})
                      </h4>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        Auto-syncing every 2.5s
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {sessionData?.members?.map((m: any, idx: number) => (
                        <div
                          key={m.id || idx}
                          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-black">
                                {m.name[0]?.toUpperCase()}
                              </span>
                              {m.name}
                            </span>
                            <span className="text-xs font-bold text-amber-600">₹{m.max_budget}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {m.preferred_genres?.map((g: string) => (
                              <span
                                key={g}
                                className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
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
                      className="w-full py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm uppercase tracking-wider transition-all shadow-md shadow-rose-200 flex items-center justify-center gap-2"
                    >
                      {isCalculating ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trophy className="w-5 h-5 text-amber-300" />
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
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:border-rose-500 w-full max-w-md"
                />
                <button
                  onClick={() =>
                    setFriends([
                      ...friends,
                      { id: Date.now().toString(), name: `Friend ${friends.length + 1}`, genres: ['Action', 'Comedy'], languages: ['Hindi'], maxBudget: 400 },
                    ])
                  }
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 border border-slate-200 transition-colors"
                >
                  <Plus className="w-4 h-4 text-rose-600" />
                  Add Friend
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {friends.map((f, idx) => (
                  <div key={f.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={f.name}
                        onChange={(e) => {
                          const updated = [...friends];
                          updated[idx].name = e.target.value;
                          setFriends(updated);
                        }}
                        className="font-black text-sm text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:outline-none focus:border-rose-500"
                      />
                      {friends.length > 2 && (
                        <button
                          onClick={() => setFriends(friends.filter((x) => x.id !== f.id))}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-slate-600 font-semibold mb-1">
                        <span>Max Budget:</span>
                        <span className="font-bold text-amber-600">₹{f.maxBudget}</span>
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
                        className="w-full accent-amber-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-600 font-semibold block mb-1">Favorite Genres</span>
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
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
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
                className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-md shadow-rose-200 flex items-center justify-center gap-2"
              >
                {isCalculating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Calculate Group Match & Recommendations
              </button>
            </div>
          )}

          {/* CONSENSUS RESULTS (Shown in both tabs when calculated) */}
          {planResult && (
            <div className="mt-8 pt-6 border-t border-slate-100 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    AI Group Consensus Result
                  </div>
                  <h3 className="text-lg font-black text-slate-900">{planResult.group_name} Choice</h3>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-slate-700 leading-relaxed font-medium">
                {planResult.insights}
              </div>

              {/* Winning Movie Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {planResult.recommendations.map((rec, idx) => (
                  <div
                    key={rec.movie_id}
                    className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex gap-4 items-center justify-between hover:border-rose-400 hover:shadow-md transition-all"
                  >
                    <div className="flex gap-3 items-center">
                      <img
                        src={rec.poster_url}
                        alt={rec.title}
                        referrerPolicy="no-referrer"
                        className="w-16 h-24 object-cover rounded-xl bg-slate-100 shadow-sm border border-slate-100"
                      />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              idx === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            #{idx + 1} Choice
                          </span>
                          <span className="text-xs font-black text-emerald-600">
                            {rec.compatibility_score}% Match
                          </span>
                        </div>
                        <h4 className="font-extrabold text-sm text-slate-900">{rec.title}</h4>
                        <p className="text-[11px] text-slate-500 mb-2">{rec.genres.slice(0, 2).join(', ')}</p>
                        <ul className="text-[10px] text-slate-600 space-y-0.5">
                          {rec.consensus_reasons.map((r, i) => (
                            <li key={i} className="flex items-center gap-1">
                              <Check className="w-2.5 h-2.5 text-emerald-600 flex-shrink-0" /> {r}
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
                      className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-sm flex-shrink-0"
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
