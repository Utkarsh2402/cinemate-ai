import React, { useState } from 'react';
import { Users, Plus, Trash2, Sparkles, Check, ArrowRight } from 'lucide-react';
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
  const [groupName, setGroupName] = useState<string>('Friday Movie Night');
  const [friends, setFriends] = useState<FriendProfile[]>([
    {
      id: '1',
      name: 'Rohan',
      genres: ['Sci-Fi', 'Action'],
      languages: ['English', 'Hindi'],
      maxBudget: 450,
    },
    {
      id: '2',
      name: 'Sneha',
      genres: ['Comedy', 'Romance'],
      languages: ['Hindi'],
      maxBudget: 350,
    },
    {
      id: '3',
      name: 'Vikram',
      genres: ['Action', 'Thriller'],
      languages: ['Hindi', 'English'],
      maxBudget: 500,
    },
  ]);

  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [planResult, setPlanResult] = useState<GroupPlannerResult | null>(null);

  const availableGenres = ['Action', 'Sci-Fi', 'Comedy', 'Drama', 'Horror', 'Thriller', 'Adventure'];

  const handleAddFriend = () => {
    const id = Date.now().toString();
    setFriends([
      ...friends,
      {
        id,
        name: `Friend ${friends.length + 1}`,
        genres: ['Action'],
        languages: ['Hindi'],
        maxBudget: 400,
      },
    ]);
  };

  const handleRemoveFriend = (id: string) => {
    if (friends.length <= 2) return;
    setFriends(friends.filter((f) => f.id !== id));
  };

  const handleCalculatePlan = async () => {
    try {
      setIsCalculating(true);
      const membersPayload = friends.map((f) => ({
        name: f.name,
        preferred_genres: f.genres,
        preferred_languages: f.languages,
        max_budget: f.maxBudget,
      }));
      const res = await api.planGroupMovie(groupName, membersPayload, currentCity);
      setPlanResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto glass-panel rounded-3xl p-6 sm:p-8 border border-amber-500/40 shadow-glow-gold">
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center shadow-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">Group Movie Planner</h2>
              <p className="text-xs text-amber-300">
                Multi-preference compatibility scoring & consensus algorithm
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Group Name Header */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Squad / Group Name"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-amber-400"
          />
          <button
            onClick={handleAddFriend}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Friend
          </button>
        </div>

        {/* Friends Preference Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {friends.map((friend) => (
            <div key={friend.id} className="glass-card rounded-2xl p-4 border border-slate-800 relative">
              {friends.length > 2 && (
                <button
                  onClick={() => handleRemoveFriend(friend.id)}
                  className="absolute top-3 right-3 text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <input
                type="text"
                value={friend.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setFriends(friends.map((f) => (f.id === friend.id ? { ...f, name: val } : f)));
                }}
                className="bg-transparent font-bold text-white text-sm mb-3 border-b border-slate-700 focus:border-amber-400 outline-none pb-1 w-3/4"
              />

              {/* Budget slider */}
              <div className="mb-3">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Max Budget:</span>
                  <span className="font-bold text-amber-300">₹{friend.maxBudget}</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="800"
                  step="50"
                  value={friend.maxBudget}
                  onChange={(e) => {
                    const budget = Number(e.target.value);
                    setFriends(friends.map((f) => (f.id === friend.id ? { ...f, maxBudget: budget } : f)));
                  }}
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Genre Pills */}
              <div className="mb-2">
                <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Favorite Genres</p>
                <div className="flex flex-wrap gap-1">
                  {availableGenres.slice(0, 5).map((g) => {
                    const active = friend.genres.includes(g);
                    return (
                      <button
                        key={g}
                        onClick={() => {
                          const updated = active ? friend.genres.filter((x) => x !== g) : [...friend.genres, g];
                          setFriends(friends.map((f) => (f.id === friend.id ? { ...f, genres: updated } : f)));
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                          active
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
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

        {/* Calculate Action */}
        <button
          disabled={isCalculating}
          onClick={handleCalculatePlan}
          className="w-full py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white shadow-glow-gold transition-all mb-6 flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {isCalculating ? 'Computing Group Consensus...' : 'Calculate Group Match & Recommendations'}
        </button>

        {/* Results Container */}
        {planResult && (
          <div className="space-y-4 animate-fadeIn">
            <div className="glass-card rounded-2xl p-4 border border-amber-500/20">
              <h3 className="font-extrabold text-white text-sm mb-1">{planResult.insights}</h3>
              <p className="text-xs text-amber-200/90 leading-relaxed">{planResult.compromise_notes}</p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Ranked Movie Matches
              </h4>
              {planResult.recommendations.map((rec) => (
                <div
                  key={rec.movie_id}
                  className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <img
                      src={rec.poster_url}
                      alt={rec.title}
                      className="w-14 h-20 rounded-xl object-cover bg-slate-900 shadow-md flex-shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {rec.compatibility_score}% Match
                        </span>
                        <span className="text-xs text-slate-400">
                          {rec.language} • {rec.duration_minutes}m
                        </span>
                      </div>
                      <h4 className="font-bold text-base text-white">{rec.title}</h4>
                      <p className="text-xs text-amber-300 font-medium mt-0.5">{rec.price_fit}</p>
                      <ul className="text-[11px] text-slate-400 mt-1 space-y-0.5">
                        {rec.consensus_reasons.map((r, i) => (
                          <li key={i} className="flex items-center gap-1 text-slate-300">
                            <Check className="w-3 h-3 text-emerald-400" />
                            {r}
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
                    className="self-end sm:self-center flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-glow-gold transition-all"
                  >
                    <span>View Shows</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
