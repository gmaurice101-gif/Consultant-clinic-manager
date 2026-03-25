import React, { useEffect, useState, createContext, useContext, Component, ErrorInfo, ReactNode, FormEvent } from 'react';
import { PatientStatus } from './types';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false, error: null };

  constructor(props: any) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    const { hasError } = this.state;
    const { children } = (this as any).props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-red-100">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-6">
              <Bell size={24} />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 mb-2">Something went wrong</h2>
            <p className="text-neutral-500 text-sm mb-6">
              An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-neutral-900 text-white py-3 rounded-xl font-bold hover:bg-neutral-800 transition-all"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, orderBy, addDoc, updateDoc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase';
import { getDocFromServer } from 'firebase/firestore';
import { UserProfile, Patient, Hospital, UserRole } from './types';
import { format, startOfDay, endOfDay, isSameDay, parseISO, addDays, isAfter, isBefore, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { LogIn, LogOut, Plus, Calendar, User as UserIcon, ClipboardList, Hospital as HospitalIcon, CheckCircle, XCircle, Clock, FileText, Printer, Download, ChevronRight, ChevronLeft, Search, Bell, Filter, Send, Trash2 } from 'lucide-react';
import { cn } from './lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Contexts ---
const AuthContext = createContext<{
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  logout: async () => {},
});

const useAuth = () => useContext(AuthContext);

// --- Components ---
const Layout = ({ children }: { children: React.ReactNode }) => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <ClipboardList size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight">ClinicManager</h1>
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">
              {profile?.role === 'admin' ? 'PA Dashboard' : 'Consultant Dashboard'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-neutral-900">{profile?.email}</p>
            <p className="text-xs text-neutral-500 capitalize">{profile?.role}</p>
          </div>
          <button
            onClick={() => logout().then(() => navigate('/login'))}
            className="p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
};

const LoginPage = () => {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-8 sm:p-12 text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-indigo-500/20">
            <ClipboardList size={32} />
          </div>
          <h2 className="text-3xl font-bold text-neutral-900 mb-2">Welcome Back</h2>
          <p className="text-neutral-500 mb-10">Sign in to manage your clinic and patients.</p>
          
          <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-3 bg-neutral-900 text-white py-4 px-6 rounded-2xl font-semibold hover:bg-neutral-800 transition-all active:scale-95 shadow-xl shadow-neutral-900/10"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Continue with Google
          </button>
          
          <div className="mt-12 pt-8 border-t border-neutral-100">
            <p className="text-xs text-neutral-400 uppercase tracking-widest font-bold">
              Secure Healthcare Management
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const RoleSelectionPage = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const selectRole = async (role: UserRole) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      role: role,
    });
    window.location.reload();
  };

  if (profile) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <h2 className="text-3xl font-bold text-neutral-900 text-center mb-12">Select Your Role</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <button
            onClick={() => selectRole('admin')}
            className="bg-white p-8 rounded-3xl border-2 border-transparent hover:border-indigo-600 transition-all text-left shadow-sm group"
          >
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <UserIcon size={24} />
            </div>
            <h3 className="text-xl font-bold text-neutral-900 mb-2">Personal Assistant</h3>
            <p className="text-neutral-500 text-sm leading-relaxed">
              Manage patient bookings, surgery pre-authorizations, and daily clinic lists across hospitals.
            </p>
          </button>
          <button
            onClick={() => selectRole('consultant')}
            className="bg-white p-8 rounded-3xl border-2 border-transparent hover:border-indigo-600 transition-all text-left shadow-sm group"
          >
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <HospitalIcon size={24} />
            </div>
            <h3 className="text-xl font-bold text-neutral-900 mb-2">Consultant</h3>
            <p className="text-neutral-500 text-sm leading-relaxed">
              View your daily schedule, track patient attendance, and manage surgery timelines.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Admin Dashboard ---
const AdminDashboard = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [newPatient, setNewPatient] = useState<Partial<Patient>>({
    type: 'clinic',
    status: 'booked',
    surgeryStatus: 'not pre-authorized',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'patients');
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'hospitals'), (snapshot) => {
      setHospitals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hospital)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'hospitals');
    });
    return unsubscribe;
  }, []);

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.name || !newPatient.phone || !newPatient.hospitalId || !newPatient.date) return;
    
    try {
      await addDoc(collection(db, 'patients'), {
        ...newPatient,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid,
      });
      setIsAddingPatient(false);
      setNewPatient({
        type: 'clinic',
        status: 'booked',
        surgeryStatus: 'not pre-authorized',
        date: format(new Date(), 'yyyy-MM-dd'),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'patients');
    }
  };

  const updateSurgeryStatus = async (id: string, status: Patient['surgeryStatus']) => {
    try {
      await updateDoc(doc(db, 'patients', id), { surgeryStatus: status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `patients/${id}`);
    }
  };

  const sendBulkSMS = () => {
    setIsConfirmingSMS(false);
    setIsSendingSMS(false);
    setStatusMessage({ 
      text: `Simulating bulk SMS reminders to ${filteredSmsPatients.length} patients...`, 
      type: 'success' 
    });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const printMasterList = () => {
    const doc = new jsPDF();
    doc.text('Master Patient List', 14, 15);
    const tableData = patients.map(p => [
      p.name,
      p.phone,
      p.type,
      p.date,
      p.diagnosis,
      p.status,
      p.type === 'surgery' ? p.surgeryStatus : '-'
    ]);
    autoTable(doc, {
      head: [['Name', 'Phone', 'Type', 'Date', 'Diagnosis', 'Status', 'Surgery Status']],
      body: tableData,
      startY: 20,
    });
    doc.save('master-patient-list.pdf');
  };

  const [isAddingHospital, setIsAddingHospital] = useState(false);
  const [newHospitalName, setNewHospitalName] = useState('');
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [smsFilters, setSmsFilters] = useState({
    hospitalId: 'all',
    type: 'all',
    startDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  });
  const [isConfirmingSMS, setIsConfirmingSMS] = useState(false);

  const filteredSmsPatients = patients.filter(p => {
    const pDate = parseISO(p.date);
    const sDate = startOfDay(parseISO(smsFilters.startDate));
    const eDate = endOfDay(parseISO(smsFilters.endDate));
    
    const dateMatch = (isSameDay(pDate, sDate) || isAfter(pDate, sDate)) && 
                     (isSameDay(pDate, eDate) || isBefore(pDate, eDate));
    const hospitalMatch = smsFilters.hospitalId === 'all' || p.hospitalId === smsFilters.hospitalId;
    const typeMatch = smsFilters.type === 'all' || p.type === smsFilters.type;
    
    return dateMatch && hospitalMatch && typeMatch;
  });

  const handleAddHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHospitalName) return;
    try {
      await addDoc(collection(db, 'hospitals'), { name: newHospitalName });
      setNewHospitalName('');
      setIsAddingHospital(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'hospitals');
    }
  };

  const deleteHospital = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'hospitals', id));
      setStatusMessage({ text: 'Hospital deleted successfully.', type: 'success' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `hospitals/${id}`);
    }
  };

  const seedTestData = async () => {
    setIsSeeding(true);
    setStatusMessage({ text: 'Seeding Kenyan data...', type: 'info' });
    const testHospitals = ['Nairobi Hospital', 'Aga Khan University Hospital', 'Kenyatta National Hospital'];
    const hospitalIds: string[] = [];

    try {
      // 1. Create hospitals
      for (const name of testHospitals) {
        const docRef = await addDoc(collection(db, 'hospitals'), { name });
        hospitalIds.push(docRef.id);
      }

      // 2. Create patients
      const patientTypes: Patient['type'][] = ['clinic', 'surgery'];
      const firstNames = ['John', 'Mary', 'Joseph', 'Jane', 'David', 'Alice', 'Peter', 'Grace', 'Samuel', 'Faith', 'Moses', 'Mercy', 'Daniel', 'Sarah', 'Isaac', 'Ruth'];
      const lastNames = ['Mwangi', 'Maina', 'Kamau', 'Otieno', 'Ochieng', 'Onyango', 'Kariuki', 'Njoroge', 'Wanjiru', 'Kimani', 'Mburu', 'Mutua', 'Musyoka', 'Kiplagat', 'Chepngetich', 'Korir'];

      for (const hospitalId of hospitalIds) {
        for (const type of patientTypes) {
          for (let i = 0; i < 10; i++) {
            const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
            const phone = `+254${700000000 + Math.floor(Math.random() * 99999999)}`;
            const date = format(addDays(new Date(), Math.floor(Math.random() * 5) + 1), 'yyyy-MM-dd');
            
            const patientData: any = {
              name,
              phone,
              hospitalId,
              type,
              date,
              status: 'booked',
              diagnosis: 'Test diagnosis for seeding',
              createdAt: serverTimestamp(),
              createdBy: auth.currentUser?.uid,
            };

            if (type === 'surgery') {
              patientData.surgeryStatus = 'not pre-authorized';
            }
            
            await addDoc(collection(db, 'patients'), patientData);
          }
        }
      }
      setStatusMessage({ text: 'Successfully seeded 3 Kenyan hospitals and 60 patients!', type: 'success' });
    } catch (error) {
      setStatusMessage({ text: 'Error seeding data. Check console.', type: 'error' });
      handleFirestoreError(error, OperationType.CREATE, 'seeding');
    } finally {
      setIsSeeding(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const clearAllData = async () => {
    setIsSeeding(true);
    setStatusMessage({ text: 'Clearing all data...', type: 'info' });
    try {
      const patientsSnap = await getDocs(collection(db, 'patients'));
      const hospitalsSnap = await getDocs(collection(db, 'hospitals'));
      
      const deletePromises = [
        ...patientsSnap.docs.map(d => deleteDoc(d.ref)),
        ...hospitalsSnap.docs.map(d => deleteDoc(d.ref))
      ];
      
      await Promise.all(deletePromises);
      setStatusMessage({ text: 'All data cleared successfully.', type: 'success' });
    } catch (error) {
      setStatusMessage({ text: 'Error clearing data. Check console.', type: 'error' });
      handleFirestoreError(error, OperationType.DELETE, 'clearAllData');
    } finally {
      setIsSeeding(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  return (
    <div className="space-y-8">
      {statusMessage && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300",
          statusMessage.type === 'success' ? "bg-emerald-600 text-white" : 
          statusMessage.type === 'error' ? "bg-red-600 text-white" : "bg-indigo-600 text-white"
        )}>
          {statusMessage.type === 'success' ? <CheckCircle size={20} /> : 
           statusMessage.type === 'error' ? <XCircle size={20} /> : <Clock size={20} />}
          <p className="font-semibold">{statusMessage.text}</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Patient Management</h2>
          <p className="text-neutral-500">Book and manage clinic and surgery schedules.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsAddingHospital(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border border-neutral-200 text-neutral-600 rounded-xl font-semibold hover:bg-neutral-50 transition-colors text-sm sm:text-base"
          >
            <HospitalIcon size={16} />
            Add Hospital
          </button>
          <button
            onClick={() => setIsSendingSMS(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-semibold hover:bg-indigo-100 transition-colors text-sm sm:text-base"
          >
            <Bell size={16} />
            SMS Reminders
          </button>
          <button
            onClick={printMasterList}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-colors text-sm sm:text-base"
          >
            <Printer size={16} />
            Master List
          </button>
        </div>
      </div>

      {isSendingSMS && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                <Bell size={24} className="text-indigo-600" />
                Bulk SMS Reminders
              </h3>
              <button onClick={() => setIsSendingSMS(false)} className="text-neutral-400 hover:text-neutral-600">
                <XCircle size={24} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                    value={smsFilters.startDate}
                    onChange={e => setSmsFilters({ ...smsFilters, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                    value={smsFilters.endDate}
                    onChange={e => setSmsFilters({ ...smsFilters, endDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Hospital</label>
                  <select
                    className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                    value={smsFilters.hospitalId}
                    onChange={e => setSmsFilters({ ...smsFilters, hospitalId: e.target.value })}
                  >
                    <option value="all">All Hospitals</option>
                    {hospitals.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Type</label>
                  <select
                    className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                    value={smsFilters.type}
                    onChange={e => setSmsFilters({ ...smsFilters, type: e.target.value })}
                  >
                    <option value="all">All Types</option>
                    <option value="clinic">Clinic Only</option>
                    <option value="surgery">Surgery Only</option>
                  </select>
                </div>
              </div>

              <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-indigo-900">Target Audience</p>
                  <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-lg">
                    {filteredSmsPatients.length} Patients
                  </span>
                </div>
                <p className="text-xs text-indigo-600 leading-relaxed">
                  Reminders will be sent to patients matching the selected criteria. This action cannot be undone.
                </p>
              </div>

              {isConfirmingSMS ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                    <Bell className="text-red-600 shrink-0" size={20} />
                    <div>
                      <p className="text-sm font-bold text-red-900">Are you absolutely sure?</p>
                      <p className="text-xs text-red-600">You are about to send messages to {filteredSmsPatients.length} patients.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsConfirmingSMS(false)}
                      className="flex-1 px-6 py-3 border border-neutral-200 text-neutral-600 rounded-xl font-bold hover:bg-neutral-50 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={sendBulkSMS}
                      disabled={filteredSmsPatients.length === 0}
                      className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
                    >
                      Yes, Send Now
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setIsSendingSMS(false)}
                    className="flex-1 px-6 py-3 border border-neutral-200 text-neutral-600 rounded-xl font-bold hover:bg-neutral-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setIsConfirmingSMS(true)}
                    disabled={filteredSmsPatients.length === 0}
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Send size={18} />
                    Prepare Reminders
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isAddingHospital && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-neutral-900 mb-6">Add New Hospital</h3>
            <form onSubmit={handleAddHospital} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Hospital Name</label>
                <input
                  type="text"
                  autoFocus
                  required
                  className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                  value={newHospitalName}
                  onChange={e => setNewHospitalName(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingHospital(false)}
                  className="flex-1 px-6 py-3 border border-neutral-200 text-neutral-600 rounded-xl font-bold hover:bg-neutral-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                >
                  Save Hospital
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Booking Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100">
            <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
              <Plus size={20} className="text-indigo-600" />
              New Booking
            </h3>
            <form onSubmit={handleAddPatient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Patient Name</label>
                <input
                  type="text"
                  required
                  className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                  value={newPatient.name || ''}
                  onChange={e => setNewPatient({ ...newPatient, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                  value={newPatient.phone || ''}
                  onChange={e => setNewPatient({ ...newPatient, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Hospital</label>
                <select
                  required
                  className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                  value={newPatient.hospitalId || ''}
                  onChange={e => setNewPatient({ ...newPatient, hospitalId: e.target.value })}
                >
                  <option value="">Select Hospital</option>
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Type</label>
                  <select
                    className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                    value={newPatient.type}
                    onChange={e => setNewPatient({ ...newPatient, type: e.target.value as any })}
                  >
                    <option value="clinic">Clinic</option>
                    <option value="surgery">Surgery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Date</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                    value={newPatient.date}
                    onChange={e => setNewPatient({ ...newPatient, date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Diagnosis</label>
                <textarea
                  required
                  rows={3}
                  className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                  value={newPatient.diagnosis || ''}
                  onChange={e => setNewPatient({ ...newPatient, diagnosis: e.target.value })}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
              >
                Book Appointment
              </button>
            </form>
          </div>
        </div>

        {/* Patient List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden">
            <div className="p-6 border-b border-neutral-50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-neutral-900">Recent Bookings</h3>
              <div className="flex items-center gap-2 bg-neutral-50 rounded-lg px-3 py-1.5">
                <Search size={16} className="text-neutral-400" />
                <input type="text" placeholder="Search..." className="bg-transparent border-none text-sm focus:ring-0 w-32" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Patient</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Type / Hospital</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {patients.map(p => (
                    <tr key={p.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-neutral-900">{p.name}</p>
                        <p className="text-xs text-neutral-500">{p.phone}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                          p.type === 'clinic' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                        )}>
                          {p.type}
                        </span>
                        <p className="text-xs text-neutral-500 mt-1">
                          {hospitals.find(h => h.id === p.hospitalId)?.name}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-neutral-700">{format(parseISO(p.date), 'MMM dd, yyyy')}</p>
                      </td>
                      <td className="px-6 py-4">
                        {p.type === 'surgery' ? (
                          <select
                            className="text-xs font-bold bg-neutral-100 border-none rounded-lg px-2 py-1 focus:ring-1 focus:ring-indigo-500"
                            value={p.surgeryStatus}
                            onChange={e => updateSurgeryStatus(p.id, e.target.value as any)}
                          >
                            <option value="not pre-authorized">Not Pre-auth</option>
                            <option value="awaiting preauth approval">Awaiting</option>
                            <option value="pre-authorization approved">Approved</option>
                          </select>
                        ) : (
                          <span className="text-xs font-bold text-neutral-500 capitalize">{p.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Consultant Dashboard ---
const ConsultantDashboard = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [newPatient, setNewPatient] = useState<Partial<Patient>>({
    type: 'clinic',
    status: 'booked',
    surgeryStatus: 'not pre-authorized',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.name || !newPatient.phone || !newPatient.hospitalId || !newPatient.date || !newPatient.diagnosis) return;
    
    try {
      await addDoc(collection(db, 'patients'), {
        ...newPatient,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid,
      });
      setIsAddingPatient(false);
      setStatusMessage({ text: 'Patient booked successfully.', type: 'success' });
      setTimeout(() => setStatusMessage(null), 3000);
      setNewPatient({
        type: 'clinic',
        status: 'booked',
        surgeryStatus: 'not pre-authorized',
        date: format(new Date(), 'yyyy-MM-dd'),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'patients');
    }
  };

  useEffect(() => {
    let q;
    if (viewMode === 'daily') {
      q = query(collection(db, 'patients'), where('date', '==', selectedDate));
    } else {
      const start = format(startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const end = format(endOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      q = query(
        collection(db, 'patients'),
        where('date', '>=', start),
        where('date', '<=', end)
      );
    }
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'patients');
    });
    return unsubscribe;
  }, [selectedDate, viewMode]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'hospitals'), (snapshot) => {
      setHospitals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hospital)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'hospitals');
    });
    return unsubscribe;
  }, []);

  const updateAttendance = async (id: string, status: PatientStatus) => {
    try {
      await updateDoc(doc(db, 'patients', id), { status });
      setStatusMessage({ text: `Patient marked as ${status}.`, type: 'success' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `patients/${id}`);
    }
  };

  const printDailyList = () => {
    const doc = new jsPDF();
    doc.text(`Clinic List - ${format(parseISO(selectedDate), 'MMMM dd, yyyy')}`, 14, 15);
    const tableData = patients.map(p => [
      p.name,
      p.diagnosis,
      p.type,
      hospitals.find(h => h.id === p.hospitalId)?.name || '',
      p.status
    ]);
    autoTable(doc, {
      head: [['Name', 'Diagnosis', 'Type', 'Hospital', 'Status']],
      body: tableData,
      startY: 20,
    });
    doc.save(`clinic-list-${selectedDate}.pdf`);
  };

  const clinicPatients = patients.filter(p => p.type === 'clinic');
  const surgeryPatients = patients.filter(p => p.type === 'surgery');

  const groupedByHospital = hospitals.map(h => ({
    hospital: h,
    patients: patients.filter(p => p.hospitalId === h.id)
  })).filter(g => g.patients.length > 0);

  return (
    <div className="space-y-8">
      {statusMessage && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300",
          statusMessage.type === 'success' ? "bg-emerald-600 text-white" : 
          statusMessage.type === 'error' ? "bg-red-600 text-white" : "bg-indigo-600 text-white"
        )}>
          {statusMessage.type === 'success' ? <CheckCircle size={20} /> : 
           statusMessage.type === 'error' ? <XCircle size={20} /> : <Clock size={20} />}
          <p className="font-semibold">{statusMessage.text}</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">{viewMode === 'daily' ? 'Daily Schedule' : 'Weekly Timeline'}</h2>
          <p className="text-neutral-500">
            {viewMode === 'daily' 
              ? format(parseISO(selectedDate), 'EEEE, MMMM dd, yyyy')
              : `${format(startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }), 'MMM dd')} - ${format(endOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }), 'MMM dd, yyyy')}`
            }
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center bg-white rounded-xl border border-neutral-200 p-1">
            <button
              onClick={() => setViewMode('daily')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                viewMode === 'daily' ? "bg-indigo-600 text-white shadow-md" : "text-neutral-500 hover:bg-neutral-50"
              )}
            >
              Daily
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                viewMode === 'weekly' ? "bg-indigo-600 text-white shadow-md" : "text-neutral-500 hover:bg-neutral-50"
              )}
            >
              Weekly
            </button>
          </div>
          <div className="flex items-center bg-white rounded-xl border border-neutral-200 p-1">
            <button
              onClick={() => setSelectedDate(format(new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() - 1)), 'yyyy-MM-dd'))}
              className="p-2 hover:bg-neutral-50 rounded-lg text-neutral-500"
            >
              <ChevronLeft size={20} />
            </button>
            <input
              type="date"
              className="border-none bg-transparent text-sm font-bold focus:ring-0 w-[120px]"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
            <button
              onClick={() => setSelectedDate(format(new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() + 1)), 'yyyy-MM-dd'))}
              className="p-2 hover:bg-neutral-50 rounded-lg text-neutral-500"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <button
            onClick={printDailyList}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-colors text-sm sm:text-base"
          >
            <Printer size={18} />
            Print List
          </button>
          <button
            onClick={() => setIsAddingPatient(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors text-sm sm:text-base shadow-lg shadow-indigo-600/20"
          >
            <Plus size={18} />
            Book Patient
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Total Booked</p>
          <p className="text-3xl font-bold text-neutral-900">{patients.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Attended</p>
          <p className="text-3xl font-bold text-green-600">{patients.filter(p => p.status === 'attended').length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">No-Shows</p>
          <p className="text-3xl font-bold text-red-600">{patients.filter(p => p.status === 'no-show').length}</p>
        </div>
      </div>

      {/* Hospital Summary */}
      <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-600/20">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <HospitalIcon size={20} />
          Hospital Breakdown
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {groupedByHospital.map(g => (
            <div key={g.hospital.id} className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <p className="text-xs font-bold text-indigo-100 uppercase tracking-wider mb-1 truncate">{g.hospital.name}</p>
              <p className="text-2xl font-bold">{g.patients.length}</p>
            </div>
          ))}
          {groupedByHospital.length === 0 && (
            <p className="text-indigo-100 text-sm italic">No patients booked across hospitals for this date.</p>
          )}
        </div>
      </div>

      {/* Timeline / Lists */}
      {viewMode === 'daily' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Clinic List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <ClipboardList size={20} className="text-blue-600" />
                Clinic Timeline
              </h3>
              <span className="text-xs font-bold bg-blue-100 text-blue-600 px-2 py-1 rounded-lg">
                {clinicPatients.length} Patients
              </span>
            </div>
            <div className="space-y-3">
              {clinicPatients.length === 0 && (
                <div className="bg-white p-8 rounded-3xl border border-dashed border-neutral-200 text-center">
                  <p className="text-neutral-400 text-sm">No clinic bookings for today.</p>
                </div>
              )}
              {clinicPatients.map(p => (
                <div key={p.id} className="bg-white p-5 rounded-3xl shadow-sm border border-neutral-100 flex items-center justify-between group hover:border-indigo-200 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                      p.status === 'attended' ? "bg-green-100 text-green-600" : 
                      p.status === 'no-show' ? "bg-red-100 text-red-600" : "bg-neutral-100 text-neutral-400"
                    )}>
                      {p.status === 'attended' ? <CheckCircle size={24} /> : 
                       p.status === 'no-show' ? <XCircle size={24} /> : <Clock size={24} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900">{p.name}</h4>
                      <p className="text-xs text-neutral-500">{p.diagnosis}</p>
                      <p className="text-[10px] font-bold text-indigo-600 uppercase mt-1">
                        {hospitals.find(h => h.id === p.hospitalId)?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 transition-opacity">
                    <button
                      onClick={() => updateAttendance(p.id, 'attended')}
                      className={cn(
                        "p-2 rounded-xl transition-all",
                        p.status === 'attended' ? "bg-green-600 text-white" : "bg-green-50 text-green-600 hover:bg-green-100"
                      )}
                      title="Mark Attended"
                    >
                      <CheckCircle size={18} />
                    </button>
                    <button
                      onClick={() => updateAttendance(p.id, 'no-show')}
                      className={cn(
                        "p-2 rounded-xl transition-all",
                        p.status === 'no-show' ? "bg-red-600 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"
                      )}
                      title="Mark No-Show"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Surgery List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <HospitalIcon size={20} className="text-purple-600" />
                Surgery Timeline
              </h3>
              <span className="text-xs font-bold bg-purple-100 text-purple-600 px-2 py-1 rounded-lg">
                {surgeryPatients.length} Patients
              </span>
            </div>
            <div className="space-y-3">
              {surgeryPatients.length === 0 && (
                <div className="bg-white p-8 rounded-3xl border border-dashed border-neutral-200 text-center">
                  <p className="text-neutral-400 text-sm">No surgery bookings for today.</p>
                </div>
              )}
              {surgeryPatients.map(p => (
                <div key={p.id} className="bg-white p-5 rounded-3xl shadow-sm border border-neutral-100 group hover:border-indigo-200 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
                        <HospitalIcon size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-neutral-900">{p.name}</h4>
                        <p className="text-xs text-neutral-500">{p.diagnosis}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-indigo-600 uppercase">
                        {hospitals.find(h => h.id === p.hospitalId)?.name}
                      </p>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block",
                        p.surgeryStatus === 'pre-authorization approved' ? "bg-green-100 text-green-600" :
                        p.surgeryStatus === 'awaiting preauth approval' ? "bg-yellow-100 text-yellow-600" : "bg-neutral-100 text-neutral-500"
                      )}>
                        {p.surgeryStatus}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-50">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-400">Status:</span>
                      <span className="text-xs font-bold text-neutral-700 capitalize">{p.status}</span>
                    </div>
                    <div className="flex items-center gap-2 transition-opacity">
                      <button
                        onClick={() => updateAttendance(p.id, 'attended')}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          p.status === 'attended' ? "bg-green-600 text-white" : "bg-green-50 text-green-600 hover:bg-green-100"
                        )}
                      >
                        <CheckCircle size={18} />
                      </button>
                      <button
                        onClick={() => updateAttendance(p.id, 'no-show')}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          p.status === 'no-show' ? "bg-red-600 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"
                        )}
                      >
                        <XCircle size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {eachDayOfInterval({
            start: startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }),
            end: endOfWeek(parseISO(selectedDate), { weekStartsOn: 1 })
          }).map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayPatients = patients.filter(p => p.date === dayStr);
            const isToday = isSameDay(day, new Date());

            return (
              <div key={dayStr} className={cn(
                "bg-white rounded-3xl shadow-sm border transition-all",
                isToday ? "border-indigo-600 ring-1 ring-indigo-600/10" : "border-neutral-100"
              )}>
                <div className="p-4 border-b border-neutral-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex flex-col items-center justify-center",
                      isToday ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-500"
                    )}>
                      <span className="text-[10px] font-bold uppercase leading-none">{format(day, 'EEE')}</span>
                      <span className="text-lg font-bold leading-none">{format(day, 'dd')}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900">{format(day, 'MMMM')}</h4>
                      <p className="text-xs text-neutral-500">{dayPatients.length} Bookings</p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  {dayPatients.length === 0 ? (
                    <p className="text-xs text-neutral-400 italic py-2">No bookings for this day.</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {dayPatients.map(p => (
                        <div key={p.id} className="bg-neutral-50 rounded-2xl p-3 border border-neutral-100 min-w-[200px] flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className={cn(
                              "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md",
                              p.type === 'clinic' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                            )}>
                              {p.type}
                            </span>
                            <span className="text-[10px] font-bold text-neutral-400">
                              {hospitals.find(h => h.id === p.hospitalId)?.name}
                            </span>
                          </div>
                          <h5 className="text-sm font-bold text-neutral-900 truncate">{p.name}</h5>
                          <p className="text-[10px] text-neutral-500 truncate">{p.diagnosis}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className={cn(
                              "text-[10px] font-bold capitalize",
                              p.status === 'attended' ? "text-green-600" : 
                              p.status === 'no-show' ? "text-red-600" : "text-neutral-400"
                            )}>
                              {p.status}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateAttendance(p.id, 'attended')}
                                className={cn(
                                  "p-1.5 rounded-lg transition-all",
                                  p.status === 'attended' ? "bg-green-600 text-white" : "bg-green-50 text-green-600 hover:bg-green-100"
                                )}
                              >
                                <CheckCircle size={14} />
                              </button>
                              <button
                                onClick={() => updateAttendance(p.id, 'no-show')}
                                className={cn(
                                  "p-1.5 rounded-lg transition-all",
                                  p.status === 'no-show' ? "bg-red-600 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"
                                )}
                              >
                                <XCircle size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAddingPatient && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                <Plus size={24} className="text-indigo-600" />
                Book New Patient
              </h3>
              <button onClick={() => setIsAddingPatient(false)} className="text-neutral-400 hover:text-neutral-600">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleAddPatient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Patient Name</label>
                <input
                  type="text"
                  required
                  className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                  value={newPatient.name || ''}
                  onChange={e => setNewPatient({ ...newPatient, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                  value={newPatient.phone || ''}
                  onChange={e => setNewPatient({ ...newPatient, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Hospital</label>
                <select
                  required
                  className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                  value={newPatient.hospitalId || ''}
                  onChange={e => setNewPatient({ ...newPatient, hospitalId: e.target.value })}
                >
                  <option value="">Select Hospital</option>
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Type</label>
                  <select
                    className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                    value={newPatient.type}
                    onChange={e => setNewPatient({ ...newPatient, type: e.target.value as any })}
                  >
                    <option value="clinic">Clinic</option>
                    <option value="surgery">Surgery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Date</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                    value={newPatient.date}
                    onChange={e => setNewPatient({ ...newPatient, date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Diagnosis</label>
                <textarea
                  required
                  rows={3}
                  className="w-full bg-neutral-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                  value={newPatient.diagnosis || ''}
                  onChange={e => setNewPatient({ ...newPatient, diagnosis: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingPatient(false)}
                  className="flex-1 px-6 py-3 border border-neutral-200 text-neutral-600 rounded-xl font-bold hover:bg-neutral-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main App ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('App: Setting up auth listener');
    
    // Connection test
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log('App: Firestore connection test successful');
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("App: Firestore connection failed. Please check your Firebase configuration.");
        }
        // Skip logging for other errors, as this is simply a connection test.
      }
    };
    testConnection();

    // Fallback timeout to ensure loading screen doesn't hang forever
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('App: Auth listener timeout reached, forcing loading to false');
        setLoading(false);
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(timeoutId);
      console.log('App: Auth state changed', user?.uid);
      setUser(user);
      try {
        if (user) {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('App: Error fetching profile', error);
      } finally {
        setLoading(false);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const signIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('App: Sign in error', error);
      alert('Failed to sign in. Please try again or check if popups are blocked.');
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AuthContext.Provider value={{ user, profile, loading, signIn, logout }}>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/select-role" element={user ? <RoleSelectionPage /> : <Navigate to="/login" />} />
            <Route
              path="/"
              element={
                user ? (
                  profile ? (
                    <Layout>
                      {profile.role === 'admin' ? <AdminDashboard /> : <ConsultantDashboard />}
                    </Layout>
                  ) : (
                    <Navigate to="/select-role" />
                  )
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
          </Routes>
        </Router>
      </AuthContext.Provider>
    </ErrorBoundary>
  );
}
