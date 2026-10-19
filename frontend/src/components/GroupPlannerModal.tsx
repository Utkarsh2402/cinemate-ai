import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Sparkles,
  Check,
  ArrowRight,
  Share2,
  Copy,
  Smartphone,
  RefreshCw,
  Trophy,
  AlertCircle,
  LogOut,
  Film,
  MessageSquareQuote,
  Heart,
  Send,
  MessageCircle,
} from 'lucide-react';
import type { GroupPlannerResult, Movie, MovieSuggestion } from '../types';
import { api } from '../api';
import { buildInviteUrl, clearRoomCodeFromUrl, getRoomCodeFromUrl } from '../utils/url';

interface GroupPlannerModalProps {
  currentCity: string;
  initialRoomCode?: string;
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
  initialRoomCode,
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
  const [isHost, setIsHost] = useState<boolean>(false);

  // Movie Suggestions with Descriptions State
  const [activeMovies, setActiveMovies] = useState<Movie[]>([]);
  const [selectedMovieForSuggestion, setSelectedMovieForSuggestion] = useState<string>('');
  const [customMovieTitle, setCustomMovieTitle] = useState<string>('');
  const [movieDescription, setMovieDescription] = useState<string>('');
  const [isAddingSuggestion, setIsAddingSuggestion] = useState<boolean>(false);
  const [showAddSuggestionDrawer, setShowAddSuggestionDrawer] = useState<boolean>(false);

  // Helper to ensure clean 4-digit code display without CNM- prefixes or dashes
  const formatDisplayCode = (rawCode: string) => {
    if (!rawCode) return '----';
    return rawCode.replace(/^CNM-/i, '').replace(/[\s-]/g, '').trim();
  };

  // Fetch active movies for suggestions
  useEffect(() => {
    api.getMovies()
      .then((res) => {
        const movies = res.items || [];
        setActiveMovies(movies);
        if (movies.length > 0) {
          setSelectedMovieForSuggestion(movies[0].id);
        }
      })
      .catch((err) => console.error('Failed to load movies:', err));
  }, []);

  // Connection & Error States
  const [isLoadingRoom, setIsLoadingRoom] = useState<boolean>(false);
  const [roomError, setRoomError] = useState<string | null>(null);

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

  // Connect to room by 4-digit code
  const connectToRoom = useCallback(async (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    try {
      setIsLoadingRoom(true);
      setRoomError(null);
      const data = await api.getGroupSession(cleanCode);
      setSessionData(data);
      setSessionCode(data.invite_code);
      setJoinCodeInput(data.invite_code);

      // Check if user is already a member in this room
      const savedName = localStorage.getItem('cinemate_member_name') || '';
      if (savedName) {
        setJoinName(savedName);
        const isMember = data.members?.some(
          (m: any) => m.name.toLowerCase() === savedName.toLowerCase()
        );
        if (isMember) {
          setJoinedSuccess(true);
        }
      }
    } catch (err: any) {
      console.error('Failed to connect to room:', err);
      setRoomError(err.message || `Room #${cleanCode} not found. Please verify the 4-digit code.`);
      setSessionData(null);
      setSessionCode('');
    } finally {
      setIsLoadingRoom(false);
    }
  }, []);

  // On mount or when initialRoomCode changes, auto-connect to room if code is present
  useEffect(() => {
    const code = (initialRoomCode || getRoomCodeFromUrl() || '').trim().toUpperCase();
    if (code) {
      setJoinCodeInput(code);
      setActiveTab('live');
      connectToRoom(code);
    } else {
      const savedName = localStorage.getItem('cinemate_member_name') || '';
      if (savedName) {
        setJoinName(savedName);
      }
    }
  }, [initialRoomCode, connectToRoom]);

  // Poll room data if active room exists and user is in the room
  useEffect(() => {
    if (!sessionCode || (!joinedSuccess && !isHost)) return;
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
  }, [sessionCode, joinedSuccess, isHost]);

  // Handle Host creating a room
  const handleCreateSession = async () => {
    try {
      setIsCreatingSession(true);
      setRoomError(null);
      const res = await api.createGroupSession(sessionName, hostName);
      localStorage.setItem('cinemate_member_name', hostName.trim() || 'Host');
      setSessionCode(res.invite_code);
      setSessionData(res);
      setIsHost(true);
      setJoinedSuccess(true);
    } catch (err: any) {
      alert(err.message || 'Failed to create room');
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Handle Joining a room
  const handleJoinSession = async () => {
    const targetCode = (sessionCode || joinCodeInput).trim().toUpperCase();
    if (!targetCode) {
      alert('Please enter a 4-digit room code');
      return;
    }
    if (!joinName.trim()) {
      alert('Please enter your name');
      return;
    }
    try {
      setIsJoining(true);
      setRoomError(null);
      const res = await api.joinGroupSession(targetCode, {
        name: joinName.trim(),
        preferred_genres: joinGenres,
        preferred_languages: ['Hindi', 'English'],
        max_budget: joinBudget,
      });
      localStorage.setItem('cinemate_member_name', joinName.trim());
      setSessionCode(res.invite_code);
      setSessionData(res);
      setJoinedSuccess(true);
    } catch (err: any) {
      alert(err.message || 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  };

  // Handle Host or friend leaving/resetting room
  const handleLeaveRoom = () => {
    setSessionCode('');
    setSessionData(null);
    setJoinedSuccess(false);
    setIsHost(false);
    setRoomError(null);
    setPlanResult(null);
    clearRoomCodeFromUrl();
  };

  // Handle Calculating consensus
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

  // Copy Invite Link to Clipboard (Clean 4-digit numeric code)
  const getInviteUrl = () => {
    return buildInviteUrl(formatDisplayCode(sessionCode));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getInviteUrl());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const roomTitle = sessionData?.name || sessionName;
    const cleanCode = formatDisplayCode(sessionCode);
    const text = encodeURIComponent(
      `🍿 Hey! Join our movie night "${roomTitle}" on CineMate AI! Use 4-digit code: *${cleanCode}* or tap here to join:\n${getInviteUrl()}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Add Movie Suggestion with Description
  const handleAddMovieSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formatDisplayCode(sessionCode);
    if (!cleanCode) return;

    const currentMemberName = joinName.trim() || hostName.trim() || localStorage.getItem('cinemate_member_name') || 'Friend';

    if (!movieDescription.trim()) {
      alert('Please add a description/pitch explaining why you want to watch this movie!');
      return;
    }

    let movieTitle = '';
    let moviePoster: string | undefined = undefined;
    let movieId: string | undefined = undefined;

    if (selectedMovieForSuggestion === 'OTHER') {
      if (!customMovieTitle.trim()) {
        alert('Please enter a movie title');
        return;
      }
      movieTitle = customMovieTitle.trim();
    } else {
      const found = activeMovies.find((m) => m.id === selectedMovieForSuggestion);
      if (found) {
        movieId = found.id;
        movieTitle = found.title;
        moviePoster = found.poster_url;
      } else {
        movieTitle = customMovieTitle.trim() || 'Selected Film';
      }
    }

    try {
      setIsAddingSuggestion(true);
      const updated = await api.addMovieSuggestion(cleanCode, {
        movie_id: movieId,
        movie_title: movieTitle,
        movie_poster: moviePoster,
        suggested_by: currentMemberName,
        description: movieDescription.trim(),
      });
      setSessionData(updated);
      setMovieDescription('');
      setCustomMovieTitle('');
      setShowAddSuggestionDrawer(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add movie suggestion');
    } finally {
      setIsAddingSuggestion(false);
    }
  };

  const handleToggleLike = async (suggestionId: string) => {
    const cleanCode = formatDisplayCode(sessionCode);
    if (!cleanCode) return;
    const currentMemberName = joinName.trim() || hostName.trim() || localStorage.getItem('cinemate_member_name') || 'Friend';
    try {
      const updated = await api.toggleSuggestionLike(cleanCode, suggestionId, currentMemberName);
      setSessionData(updated);
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const handleDeleteSuggestion = async (suggestionId: string) => {
    const cleanCode = formatDisplayCode(sessionCode);
    if (!cleanCode) return;
    try {
      const updated = await api.deleteMovieSuggestion(cleanCode, suggestionId);
      setSessionData(updated);
    } catch (err) {
      console.error('Failed to delete suggestion:', err);
    }
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
                  Invite friends via 4-digit code or link • Everyone votes • AI selects the winning film
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors font-bold text-sm"
              aria-label="Close modal"
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
              {/* STATE 1: Connecting to room via invite link */}
              {isLoadingRoom ? (
                <div className="py-16 text-center flex flex-col items-center justify-center animate-fadeIn">
                  <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mb-4 shadow-sm">
                    <RefreshCw className="w-7 h-7 text-rose-600 animate-spin" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">
                    Connecting to Room #{initialRoomCode || joinCodeInput}...
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Loading group session details, host info, and real-time voting preferences.
                  </p>
                </div>
              ) : roomError ? (
                /* STATE 2: Room Connection Error */
                <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center animate-fadeIn space-y-4">
                  <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-rose-950">Room Connection Failed</h3>
                    <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">{roomError}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={4}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="4 digits"
                        className="w-32 text-center bg-white border border-rose-300 rounded-xl px-3 py-2 text-sm font-mono font-bold tracking-widest text-slate-900 focus:outline-none focus:border-rose-500"
                      />
                      <button
                        onClick={() => connectToRoom(joinCodeInput)}
                        disabled={joinCodeInput.length !== 4}
                        className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition-all"
                      >
                        Retry
                      </button>
                    </div>
                    <span className="text-xs text-slate-400">or</span>
                    <button
                      onClick={() => {
                        setRoomError(null);
                        setSessionCode('');
                        setSessionData(null);
                        clearRoomCodeFromUrl();
                      }}
                      className="text-xs font-bold text-slate-700 hover:text-slate-900 underline"
                    >
                      Host a New Session Instead
                    </button>
                  </div>
                </div>
              ) : sessionData && !joinedSuccess && !isHost ? (
                /* STATE 3: Connected via Invite Link - Dedicated Join Room Form */
                <div className="max-w-xl mx-auto p-6 sm:p-8 rounded-3xl bg-slate-50 border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
                  <div className="text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black tracking-wide mb-3">
                      <Smartphone className="w-3.5 h-3.5 text-amber-700" />
                      Room Code: {formatDisplayCode(sessionData.invite_code)} • Live Invite
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">
                      Join "{sessionData.name}"
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Invited by <strong className="text-slate-800">{sessionData.members?.[0]?.name || 'Host'}</strong>. Enter your preferences to vote on the winning movie!
                    </p>
                  </div>

                  {/* Joined Members Pill List */}
                  {sessionData.members && sessionData.members.length > 0 && (
                    <div className="p-3 bg-white rounded-2xl border border-slate-200">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-rose-600" />
                        Already in this Room ({sessionData.members.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sessionData.members.map((m: any, i: number) => (
                          <span
                            key={m.id || i}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200"
                          >
                            <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                              {m.name[0]?.toUpperCase()}
                            </span>
                            {m.name} {i === 0 ? '(Host)' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Join Form */}
                  <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200">
                    <div>
                      <label className="text-xs text-slate-700 font-bold block mb-1">Your Name</label>
                      <input
                        type="text"
                        value={joinName}
                        onChange={(e) => setJoinName(e.target.value)}
                        placeholder="Enter your name (e.g. Rohan)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-semibold focus:outline-none focus:border-rose-500 focus:bg-white transition-colors"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-slate-700 font-bold mb-1">
                        <span>Your Maximum Budget:</span>
                        <span className="font-extrabold text-amber-600">₹{joinBudget}</span>
                      </div>
                      <input
                        type="range"
                        min="150"
                        max="1000"
                        step="50"
                        value={joinBudget}
                        onChange={(e) => setJoinBudget(Number(e.target.value))}
                        className="w-full accent-amber-500 h-2 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-700 font-bold block mb-1.5">Pick Your Favorite Genres:</label>
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
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                active
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-sm'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              {g}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleJoinSession}
                    disabled={isJoining || !joinName.trim()}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-md shadow-rose-200 flex items-center justify-center gap-2"
                  >
                    {isJoining ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    🚀 Connect to Room & Submit My Preferences
                  </button>

                  <div className="text-center pt-1">
                    <button
                      onClick={handleLeaveRoom}
                      className="text-xs text-slate-400 hover:text-slate-600 underline font-semibold"
                    >
                      Or host a different movie night instead
                    </button>
                  </div>
                </div>
              ) : sessionCode && (joinedSuccess || isHost) ? (
                /* STATE 4: Active Waiting Room / Joined Members */
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
                        Share this 4-digit code or link with your friends. They will appear live below!
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="px-5 py-2.5 bg-white rounded-2xl border-2 border-amber-300 font-mono text-2xl font-black text-amber-600 tracking-[0.25em] shadow-sm">
                        {formatDisplayCode(sessionCode)}
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
                      <button
                        onClick={handleLeaveRoom}
                        title="Leave or reset room"
                        className="p-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 text-xs font-bold transition-colors border border-slate-200"
                      >
                        <LogOut className="w-4 h-4" />
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

                  {/* Group Movie Picks & Pitches (Member Descriptions) */}
                  <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Film className="w-4 h-4 text-rose-600" />
                          <h4 className="text-sm font-black text-slate-900">
                            Pitched Movies & Member Descriptions ({sessionData?.movie_suggestions?.length || 0})
                          </h4>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Suggest a movie you want to watch and tell your friends why they should vote for it!
                        </p>
                      </div>

                      <button
                        onClick={() => setShowAddSuggestionDrawer(!showAddSuggestionDrawer)}
                        className="self-start sm:self-auto px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{showAddSuggestionDrawer ? 'Close Form' : 'Pitch a Movie & Add Description'}</span>
                      </button>
                    </div>

                    {/* Add Suggestion Form Drawer */}
                    {showAddSuggestionDrawer && (
                      <form
                        onSubmit={handleAddMovieSuggestion}
                        className="p-4 rounded-2xl bg-white border border-rose-200 shadow-sm space-y-3.5 animate-fadeIn"
                      >
                        <div className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                          <MessageSquareQuote className="w-4 h-4 text-rose-600" />
                          <span>Suggest a Movie with Your Custom Description</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Select Movie</label>
                            <select
                              value={selectedMovieForSuggestion}
                              onChange={(e) => setSelectedMovieForSuggestion(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-rose-500"
                            >
                              {activeMovies.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.title} ({m.rating ? `★ ${m.rating}` : 'Running'})
                                </option>
                              ))}
                              <option value="OTHER">+ Other Film (Type Custom Title)</option>
                            </select>
                          </div>

                          {selectedMovieForSuggestion === 'OTHER' && (
                            <div>
                              <label className="text-[11px] font-bold text-slate-600 block mb-1">Movie Title</label>
                              <input
                                type="text"
                                value={customMovieTitle}
                                onChange={(e) => setCustomMovieTitle(e.target.value)}
                                placeholder="Enter movie title (e.g. Interstellar)"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-rose-500"
                              />
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">
                            Your Pitch / Description for this Movie *
                          </label>
                          <textarea
                            rows={3}
                            value={movieDescription}
                            onChange={(e) => setMovieDescription(e.target.value)}
                            placeholder="Why should the group watch this? (e.g. 'Must watch in IMAX! The soundtrack and visuals are legendary, plus tickets are ₹250 this Friday!')"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 leading-relaxed"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowAddSuggestionDrawer(false)}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isAddingSuggestion || !movieDescription.trim()}
                            className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-rose-200 transition-all"
                          >
                            {isAddingSuggestion ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            <span>Post Movie & Description</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Pitched Movie Cards */}
                    {sessionData?.movie_suggestions && sessionData.movie_suggestions.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {sessionData.movie_suggestions.map((sug: MovieSuggestion) => {
                          const currentMemberName = joinName.trim() || hostName.trim() || localStorage.getItem('cinemate_member_name') || 'Friend';
                          const hasLiked = sug.likes?.includes(currentMemberName);
                          const isAuthor = sug.suggested_by?.toLowerCase() === currentMemberName.toLowerCase() || isHost;

                          return (
                            <div
                              key={sug.id}
                              className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-amber-300 transition-all flex flex-col justify-between space-y-3 shadow-xs"
                            >
                              <div className="flex gap-3 items-start">
                                {sug.movie_poster ? (
                                  <img
                                    src={sug.movie_poster}
                                    alt={sug.movie_title}
                                    referrerPolicy="no-referrer"
                                    className="w-14 h-20 object-cover rounded-xl bg-slate-200 flex-shrink-0 shadow-sm border border-slate-200"
                                  />
                                ) : (
                                  <div className="w-14 h-20 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                                    <Film className="w-6 h-6" />
                                  </div>
                                )}

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <h5 className="font-extrabold text-sm text-slate-900 truncate">{sug.movie_title}</h5>
                                    {isAuthor && (
                                      <button
                                        onClick={() => handleDeleteSuggestion(sug.id)}
                                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                                        title="Remove your pitch"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>

                                  <div className="text-[11px] text-slate-500 font-semibold mb-1 flex items-center gap-1.5">
                                    <span>Pitched by</span>
                                    <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                      {sug.suggested_by}
                                    </span>
                                  </div>

                                  {/* Speech bubble / Description */}
                                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 italic leading-snug relative">
                                    <MessageSquareQuote className="w-3.5 h-3.5 text-rose-500 inline mr-1 -mt-0.5" />
                                    <span>"{sug.description}"</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                                <button
                                  onClick={() => handleToggleLike(sug.id)}
                                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all ${
                                    hasLiked
                                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}
                                  title="Vote / Like this movie choice"
                                >
                                  <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-rose-600 text-rose-600' : 'text-slate-400'}`} />
                                  <span>{sug.likes?.length || 0} Votes</span>
                                </button>

                                <span className="text-[10px] text-slate-400">
                                  {sug.likes && sug.likes.length > 0 ? `Voted by ${sug.likes.join(', ')}` : 'No votes yet'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-6 px-4 rounded-xl bg-white border border-dashed border-slate-300 text-center space-y-1.5">
                        <MessageCircle className="w-6 h-6 text-slate-400 mx-auto" />
                        <p className="text-xs font-bold text-slate-700">No movies pitched yet</p>
                        <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                          Tap "+ Pitch a Movie & Add Description" above to suggest your favorite film and explain why your friends should watch it!
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Decision Action */}
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
              ) : (
                /* STATE 5: Default Host or Join View (No room selected yet) */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Host Box */}
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-rose-600 font-bold text-sm mb-2">
                        <Share2 className="w-4 h-4" />
                        Option 1: Host a New Movie Night
                      </div>
                      <p className="text-xs text-slate-500 mb-4">
                        Creates an invite room with a 4-digit code to share with your friends.
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
                      Create 4-Digit Room
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
                        Did a friend send you a 4-digit room code? Enter it below to submit your picks!
                      </p>
                      <div className="space-y-3 mb-4">
                        <div>
                          <label className="text-xs text-slate-600 font-semibold block mb-1">4-Digit Room Code</label>
                          <input
                            type="text"
                            maxLength={4}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={joinCodeInput}
                            onChange={(e) => setJoinCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="e.g. 4829"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-base text-slate-900 font-mono font-bold uppercase tracking-widest focus:outline-none focus:border-amber-500"
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
                      disabled={isJoining || joinCodeInput.length !== 4 || !joinName.trim()}
                      className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-200 flex items-center justify-center gap-2"
                    >
                      {isJoining ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Join Room & Submit Preferences
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

          {/* CONSENSUS RESULTS (Shown when calculated) */}
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

                        {/* Member Pitch / Description if available */}
                        {(() => {
                          const matchedSuggestion = sessionData?.movie_suggestions?.find(
                            (s: MovieSuggestion) =>
                              (s.movie_id && s.movie_id === rec.movie_id) ||
                              s.movie_title.toLowerCase() === rec.title.toLowerCase()
                          );
                          if (!matchedSuggestion) return null;
                          return (
                            <div className="mt-1.5 p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-900 flex items-start gap-1">
                              <MessageSquareQuote className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
                              <span>
                                <strong className="font-bold">{matchedSuggestion.suggested_by}:</strong> "{matchedSuggestion.description}"
                              </span>
                            </div>
                          );
                        })()}
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
