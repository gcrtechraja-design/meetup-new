import React, { useEffect, useState } from 'react';
import { 
  Shield, 
  Users, 
  PhoneCall, 
  DollarSign, 
  Flag, 
  Search, 
  X, 
  CheckCircle, 
  Ban, 
  Edit3, 
  Radio, 
  Headphones,
  Check,
  AlertCircle
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { UserProfile, Report, CallLog, ListenerApplication, Transaction } from '../types';
import { getUserAvatarUrl } from '../services/staticCdnService';
import { isListenerOffline } from '../utils/presence';

interface AdminDashboardProps {
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'users' | 'reports' | 'applications' | 'calls'>('users');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [reportsList, setReportsList] = useState<Report[]>([]);
  const [applicationsList, setApplicationsList] = useState<ListenerApplication[]>([]);
  const [callLogsList, setCallLogsList] = useState<CallLog[]>([]);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Edit coins modal state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [coinInput, setCoinInput] = useState<number>(0);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const users: UserProfile[] = [];
      usersSnap.forEach((d) => users.push({ uid: d.id, ...d.data() } as UserProfile));
      setUsersList(users);

      // 2. Fetch Reports
      const reportsSnap = await getDocs(collection(db, 'reports'));
      const reps: Report[] = [];
      reportsSnap.forEach((d) => reps.push({ id: d.id, ...d.data() } as Report));
      setReportsList(reps);

      // 3. Fetch Listener Applications
      const appsSnap = await getDocs(collection(db, 'listener_applications'));
      const apps: ListenerApplication[] = [];
      appsSnap.forEach((d) => apps.push({ id: d.id, ...d.data() } as ListenerApplication));
      setApplicationsList(apps);

      // 4. Fetch Call Logs
      const callsSnap = await getDocs(collection(db, 'call_logs'));
      const calls: CallLog[] = [];
      callsSnap.forEach((d) => calls.push({ id: d.id, ...d.data() } as CallLog));
      setCallLogsList(calls);

      // 5. Fetch Total Revenue from Transactions
      const txSnap = await getDocs(collection(db, 'transactions'));
      let rev = 0;
      txSnap.forEach((d) => {
        const tx = d.data() as Transaction;
        if (tx.status === 'success') {
          rev += tx.amount_inr || 0;
        }
      });
      setTotalRevenue(rev);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  if (currentUser?.role !== 'admin') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
        <div className="bg-[#16161C] border border-red-500/40 rounded-3xl p-6 text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">Access Denied</h3>
          <p className="text-xs text-zinc-400 mt-1">This panel is protected for platform administrators only.</p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 rounded-xl bg-zinc-800 text-white text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Actions
  const handleToggleBlock = async (user: UserProfile) => {
    try {
      const newBlocked = !user.is_blocked;
      await updateDoc(doc(db, 'users', user.uid), {
        is_blocked: newBlocked,
      });
      setUsersList((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, is_blocked: newBlocked } : u))
      );
    } catch (e) {
      console.error('Failed to toggle block:', e);
    }
  };

  const handleTogglePresence = async (user: UserProfile) => {
    try {
      const isCurrentlyOffline = isListenerOffline(user);
      const newStatus = isCurrentlyOffline ? 'online' : 'unavailable';
      const newPresence = isCurrentlyOffline ? 'available' : 'unavailable';
      const newIsAvailable = isCurrentlyOffline;

      await updateDoc(doc(db, 'users', user.uid), {
        status: newStatus,
        presence_status: newPresence,
        presence: newPresence,
        is_available: newIsAvailable,
      });

      setUsersList((prev) =>
        prev.map((u) =>
          u.uid === user.uid
            ? {
                ...u,
                status: newStatus as any,
                presence_status: newPresence,
                presence: newPresence,
                is_available: newIsAvailable,
              }
            : u
        )
      );
    } catch (e) {
      console.error('Failed to toggle presence:', e);
    }
  };

  const handleSaveCoins = async () => {
    if (!editingUser) return;
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), {
        coins_balance: Number(coinInput),
      });
      setUsersList((prev) =>
        prev.map((u) => (u.uid === editingUser.uid ? { ...u, coins_balance: Number(coinInput) } : u))
      );
      setEditingUser(null);
    } catch (e) {
      console.error('Failed to update coins:', e);
    }
  };

  const handleApproveApplication = async (app: ListenerApplication) => {
    try {
      // 1. Update application status
      if (app.id) {
        await updateDoc(doc(db, 'listener_applications', app.id), {
          status: 'approved',
        });
      }
      // 2. Elevate user role to 'listener' in Firestore
      await updateDoc(doc(db, 'users', app.user_id), {
        role: 'listener',
        isBlocked: false,
        is_blocked: false,
        voice_rate: app.voice_rate || 20,
        video_rate: app.video_rate || 50,
      });

      setApplicationsList((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status: 'approved' } : a))
      );
      fetchAdminData();
    } catch (e) {
      console.error('Failed to approve application:', e);
    }
  };

  const handleRejectApplication = async (appId?: string) => {
    if (!appId) return;
    try {
      await updateDoc(doc(db, 'listener_applications', appId), {
        status: 'rejected',
      });
      setApplicationsList((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: 'rejected' } : a))
      );
    } catch (e) {
      console.error('Failed to reject application:', e);
    }
  };

  const handleDismissReport = async (reportId?: string) => {
    if (!reportId) return;
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setReportsList((prev) => prev.filter((r) => r.id !== reportId));
    } catch (e) {
      console.error('Failed to dismiss report:', e);
    }
  };

  const filteredUsers = usersList.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onlineListenersCount = usersList.filter((u) => u.role === 'listener' && u.status === 'online').length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0B0B0E] text-white overflow-y-auto">
      {/* Top Navbar */}
      <div className="sticky top-0 z-20 bg-[#16161C]/90 backdrop-blur-md border-b border-[#23232C] px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#FF69B4]/20 text-[#FF69B4]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm tracking-wide">Meet Up Admin Panel</h2>
            <p className="text-[10px] text-zinc-400">Direct Firestore Management</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-[#23232C] transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-4xl w-full mx-auto p-4 space-y-4 pb-20">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-[#16161C] border border-[#23232C] rounded-2xl">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-medium">Total Users</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-xl font-black text-white">{usersList.length}</span>
          </div>

          <div className="p-3.5 bg-[#16161C] border border-[#23232C] rounded-2xl">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-medium">Online Listeners</span>
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <span className="text-xl font-black text-emerald-400">{onlineListenersCount}</span>
          </div>

          <div className="p-3.5 bg-[#16161C] border border-[#23232C] rounded-2xl">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-medium">Total Revenue</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-xl font-black text-amber-300">₹{totalRevenue.toLocaleString()}</span>
          </div>

          <div className="p-3.5 bg-[#16161C] border border-[#23232C] rounded-2xl">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-medium">Calls Logged</span>
              <PhoneCall className="w-4 h-4 text-[#FF69B4]" />
            </div>
            <span className="text-xl font-black text-[#FF69B4]">{callLogsList.length}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-[#16161C] border border-[#23232C] rounded-2xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'users'
                ? 'bg-[#FF69B4] text-white shadow-[0_0_10px_rgba(255,105,180,0.5)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All Users ({usersList.length})
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'reports'
                ? 'bg-[#FF69B4] text-white shadow-[0_0_10px_rgba(255,105,180,0.5)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Reports ({reportsList.length})
          </button>

          <button
            onClick={() => setActiveTab('applications')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'applications'
                ? 'bg-[#FF69B4] text-white shadow-[0_0_10px_rgba(255,105,180,0.5)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Applications ({applicationsList.length})
          </button>

          <button
            onClick={() => setActiveTab('calls')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'calls'
                ? 'bg-[#FF69B4] text-white shadow-[0_0_10px_rgba(255,105,180,0.5)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Call Logs ({callLogsList.length})
          </button>
        </div>

        {/* Tab 1: All Users Table */}
        {activeTab === 'users' && (
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by name, email, location..."
                className="w-full bg-[#16161C] border border-[#23232C] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF69B4]"
              />
            </div>

            <div className="bg-[#16161C] border border-[#23232C] rounded-2xl divide-y divide-zinc-800/60 overflow-hidden">
              {filteredUsers.map((user) => (
                <div
                  key={user.uid}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#1C1C24] transition"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={getUserAvatarUrl(user)}
                      alt={user.name}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = 'https://randomuser.me/api/portraits/women/11.jpg';
                      }}
                      className="w-10 h-10 rounded-full object-cover border border-zinc-700"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{user.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          user.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-400'
                            : user.role === 'listener'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {user.role}
                        </span>
                        {user.role === 'listener' && (
                          isListenerOffline(user) ? (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[9px] font-bold border border-zinc-700">
                              OFFLINE
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                              ONLINE
                            </span>
                          )
                        )}
                        {user.is_blocked && (
                          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] font-bold">
                            BLOCKED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{user.email} • {user.location}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <div className="text-right mr-2">
                      <span className="text-xs font-bold text-amber-300 block">{user.coins_balance} Coins</span>
                      <span className="text-[10px] text-cyan-400">{user.diamonds_balance} Dia</span>
                    </div>

                    {user.role === 'listener' && (
                      <button
                        onClick={() => handleTogglePresence(user)}
                        className={`p-2 rounded-xl text-xs flex items-center gap-1 transition ${
                          isListenerOffline(user)
                            ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                            : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300'
                        }`}
                        title={isListenerOffline(user) ? 'Set Available (Online) in Firestore' : 'Set Unavailable (Offline) in Firestore'}
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span className="text-[10px] hidden sm:inline">{isListenerOffline(user) ? 'Online' : 'Unavailable'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setEditingUser(user);
                        setCoinInput(user.coins_balance);
                      }}
                      className="p-2 rounded-xl bg-[#23232C] hover:bg-[#2F2F3D] text-zinc-300 text-xs flex items-center gap-1 transition"
                      title="Edit Coins"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleToggleBlock(user)}
                      className={`p-2 rounded-xl text-xs flex items-center gap-1 transition ${
                        user.is_blocked
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      }`}
                      title={user.is_blocked ? 'Unblock User' : 'Block User'}
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Reports */}
        {activeTab === 'reports' && (
          <div className="space-y-3">
            {reportsList.length === 0 ? (
              <div className="py-12 text-center bg-[#16161C] rounded-2xl p-6 text-zinc-400 text-xs">
                No user reports recorded. Platform is safe!
              </div>
            ) : (
              reportsList.map((report) => (
                <div
                  key={report.id}
                  className="p-4 bg-[#16161C] border border-[#23232C] rounded-2xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4 text-red-400" />
                      <span className="text-xs font-bold text-red-400">{report.reason}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">
                      Reporter: {report.reporter_name || report.reporter_id}
                    </span>
                  </div>

                  <p className="text-xs text-white">
                    Reported User: <span className="font-bold text-[#FF69B4]">{report.reported_name || report.reported_id}</span>
                  </p>
                  {report.description && (
                    <p className="text-xs text-zinc-400 bg-[#0B0B0E] p-2.5 rounded-xl border border-zinc-800">
                      "{report.description}"
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => handleDismissReport(report.id)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={async () => {
                        await updateDoc(doc(db, 'users', report.reported_id), { is_blocked: true });
                        alert(`User ${report.reported_name || report.reported_id} blocked.`);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-xs font-bold text-white transition"
                    >
                      Ban User
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Listener Applications */}
        {activeTab === 'applications' && (
          <div className="space-y-3">
            {applicationsList.length === 0 ? (
              <div className="py-12 text-center bg-[#16161C] rounded-2xl p-6 text-zinc-400 text-xs">
                No listener applications pending.
              </div>
            ) : (
              applicationsList.map((app) => (
                <div
                  key={app.id}
                  className="p-4 bg-[#16161C] border border-[#23232C] rounded-2xl space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Headphones className="w-4 h-4 text-[#FF69B4]" />
                      <span className="text-xs font-bold text-white">{app.name || 'Applicant'}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      app.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : app.status === 'rejected'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {app.status}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-400 space-y-1">
                    <div><span className="text-zinc-500">Languages:</span> {app.languages?.join(', ')}</div>
                    <div><span className="text-zinc-500">Proposed Rates:</span> {app.voice_rate} Voice / {app.video_rate} Video coins/min</div>
                    {app.experience && (
                      <p className="bg-[#0B0B0E] p-2.5 rounded-xl border border-zinc-800 text-zinc-300">
                        {app.experience}
                      </p>
                    )}
                  </div>

                  {app.status === 'pending' && (
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => handleRejectApplication(app.id)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveApplication(app)}
                        className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white transition flex items-center gap-1 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve as Listener
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Call Logs */}
        {activeTab === 'calls' && (
          <div className="space-y-2">
            {callLogsList.length === 0 ? (
              <div className="py-12 text-center bg-[#16161C] rounded-2xl p-6 text-zinc-400 text-xs">
                No calls recorded yet.
              </div>
            ) : (
              callLogsList.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-[#16161C] border border-[#23232C] rounded-2xl flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-white">{c.caller_name || 'Caller'}</span>
                    <span className="text-zinc-400"> called </span>
                    <span className="font-bold text-[#FF69B4]">{c.receiver_name || 'Listener'}</span>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      Type: {c.type?.toUpperCase()} • Duration: {c.duration_sec || 0}s
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-amber-300 block">{c.coins_spent || 0} coins</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit Coins Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#16161C] border border-[#23232C] rounded-2xl p-5 w-full max-w-xs space-y-4">
            <h4 className="text-sm font-bold text-white">Edit Coin Balance for {editingUser.name}</h4>
            <input
              type="number"
              value={coinInput}
              onChange={(e) => setCoinInput(Number(e.target.value))}
              className="w-full bg-[#0B0B0E] border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white font-bold"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 py-2 rounded-xl bg-[#23232C] text-xs font-semibold text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCoins}
                className="flex-1 py-2 rounded-xl bg-[#FF69B4] text-xs font-bold text-white"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
