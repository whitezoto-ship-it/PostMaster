
import React, { useState, useEffect, useRef } from 'react';
import { generateCaption, generateImage, generateVideo } from './services/geminiService';
import { User, Post, PlanType, PostType } from './types';

// --- Constants ---
const STORAGE_USERS_KEY = 'postmaster_users';
const STORAGE_POSTS_KEY = 'postmaster_posts';
const CURRENT_USER_KEY = 'postmaster_current_user';
const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 72 hours

// --- Helper Functions ---
const getUsers = (): User[] => {
  const stored = localStorage.getItem(STORAGE_USERS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveUsers = (users: User[]) => {
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  // Dispatch event for local storage sync simulation
  window.dispatchEvent(new Event('storage'));
};

const getPosts = (): Post[] => {
  const stored = localStorage.getItem(STORAGE_POSTS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const savePosts = (posts: Post[]) => {
  localStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(posts));
  window.dispatchEvent(new Event('storage'));
};

const formatTimeLeft = (endTime: number) => {
  const now = Date.now();
  const diff = endTime - now;
  if (diff <= 0) return "Expirado";
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// --- Components ---

// Button Component
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'success' }> = ({ variant = 'primary', className = '', ...props }) => {
  const baseStyle = "px-4 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-primary text-white hover:bg-orange-600 shadow-lg shadow-orange-900/20",
    secondary: "bg-surface text-white hover:bg-white/10 border border-white/10",
    danger: "bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/20",
    success: "bg-green-500/20 text-green-500 hover:bg-green-500/30 border border-green-500/20"
  };
  return <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props} />;
};

// Input Component
const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input 
    className="w-full bg-[#2d2d2d] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
    {...props}
  />
);

// TextArea Component
const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea 
    className="w-full bg-[#2d2d2d] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
    {...props}
  />
);

// --- Main App ---

export default function App() {
  // State
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [view, setView] = useState('login'); 
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [logoTaps, setLogoTaps] = useState(0);

  // Content Creation State
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [creationStep, setCreationStep] = useState(0); 
  const [loadingStep, setLoadingStep] = useState('');
  
  // Reel/Image/Carousel Specific
  const [script, setScript] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [carouselSlides, setCarouselSlides] = useState<{image: string, text: string}[]>([]);

  // Notifications
  const [notifications, setNotifications] = useState<string[]>([]);

  // Initial Load & Real-time Sync
  useEffect(() => {
    const loadData = () => {
        const loadedUsers = getUsers();
        setUsers(loadedUsers);
        setPosts(getPosts());

        const storedUser = localStorage.getItem(CURRENT_USER_KEY);
        if (storedUser) {
            const u = JSON.parse(storedUser);
            // Sync current user with latest data
            const freshUser = loadedUsers.find(lu => lu.id === u.id);
            if (freshUser) {
                // If user was blocked remotely
                if (freshUser.isBlocked && !freshUser.isAdmin) {
                    handleLogout();
                    alert("A sua conta foi bloqueada. Contacte o suporte.");
                } else {
                    setUser(freshUser);
                }
            } else {
                // User deleted
                handleLogout();
            }
        }
    };

    loadData();

    // Listen for storage events (multi-tab/real-time simulation)
    window.addEventListener('storage', loadData);
    // Polling for stricter sync
    const interval = setInterval(loadData, 2000);

    return () => {
        window.removeEventListener('storage', loadData);
        clearInterval(interval);
    };
  }, []);

  // Scheduled Posts Notification Checker
  useEffect(() => {
    const checkSchedule = () => {
        if (!user || user.isAdmin) return;
        const now = Date.now();
        const pendingPosts = posts.filter(p => p.userId === user.id && p.scheduledTime && !p.isPosted);
        
        pendingPosts.forEach(p => {
            // Check if within the last minute
            if (p.scheduledTime! <= now && p.scheduledTime! > now - 60000) {
                // Trigger notification
                if (Notification.permission === 'granted') {
                    new Notification("PostMaster MZ", { body: "A sua publicação está pronta para ser feita agora." });
                } else {
                    alert(`⏰ HORA DE POSTAR!\n\nSua publicação agendada está pronta.`);
                }
                // Mark locally as posted (conceptually, or let user do it)
            }
        });
    };
    
    // Request permission on load
    if (Notification.permission === 'default') Notification.requestPermission();

    const interval = setInterval(checkSchedule, 30000);
    return () => clearInterval(interval);
  }, [posts, user]);


  // --- Handlers ---

  const handleLogoTap = () => {
    setLogoTaps(prev => {
      const newTaps = prev + 1;
      if (newTaps === 7) {
        setView('admin-login');
        return 0;
      }
      return newTaps;
    });
  };

  const handleLogin = (isAdminLogin = false) => {
    setError('');
    const foundUser = users.find(u => u.email === email && u.password === password);
    
    if (foundUser) {
      if (foundUser.isBlocked) {
        setError('Sua conta foi bloqueada. Contate o suporte.');
        return;
      }
      if (isAdminLogin && !foundUser.isAdmin) {
         setError('Acesso negado.');
         return;
      }
      if (!isAdminLogin && foundUser.isAdmin) {
          // Admin trying to login as user
          setUser(foundUser);
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(foundUser));
          setView('admin-dashboard');
          return;
      }
      
      setUser(foundUser);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(foundUser));
      setView(foundUser.isAdmin ? 'admin-dashboard' : 'dashboard');
    } else {
      setError('Credenciais inválidas.');
    }
  };

  const handleRegister = (isAdminRegister = false) => {
    if (!name || !email || !password) {
      setError('Preencha todos os campos.');
      return;
    }
    if (users.find(u => u.email === email)) {
      setError('E-mail já cadastrado.');
      return;
    }

    const newUser: User = {
      id: Date.now().toString(),
      name,
      email,
      password,
      trialStartDate: Date.now(),
      plan: isAdminRegister ? PlanType.ANUAL : PlanType.TRIAL,
      isBlocked: false,
      isAdmin: isAdminRegister
    };

    const newUsers = [...users, newUser];
    setUsers(newUsers);
    saveUsers(newUsers);
    setUser(newUser);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
    setView(isAdminRegister ? 'admin-dashboard' : 'dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(CURRENT_USER_KEY);
    setView('login');
    setEmail('');
    setPassword('');
    setName('');
    setError('');
    setLogoTaps(0);
  };

  // --- Access Control Logic ---
  const isTrialActive = (u: User) => {
      if (u.plan !== PlanType.TRIAL) return true; // Paid plans are always active
      return Date.now() < (u.trialStartDate + TRIAL_DURATION_MS);
  };

  const checkUserAccess = () => {
      if (!user) return false;
      if (user.isAdmin) return false; // Admin shouldn't see user tools here
      if (user.isBlocked) return false;
      if (isTrialActive(user)) return true;
      
      // Expired trial
      return false;
  };

  const saveNewPost = (type: PostType, content: any, scheduledTime?: number) => {
      if (!user) return;
      const newPost: Post = {
          id: Date.now().toString(),
          userId: user.id,
          type,
          content,
          scheduledTime,
          isPosted: false,
          createdAt: Date.now()
      };
      const updatedPosts = [...posts, newPost];
      setPosts(updatedPosts);
      savePosts(updatedPosts);
      alert(scheduledTime ? "Agendado com sucesso!" : "Salvo no histórico!");
      setGeneratedContent(null);
      setUploadedImage(null);
      setScript('');
      setCarouselSlides([]);
      setView('history');
      setCreationStep(0);
  };

  // --- VIEWS ---

  // 1. LOGIN VIEW
  const LoginView = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-dark">
      <div className="w-full max-w-md space-y-8 p-8 rounded-3xl bg-surface/50 backdrop-blur-md border border-white/5 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <button 
            onClick={handleLogoTap}
            className="group relative w-24 h-24 mb-4 flex items-center justify-center transition-transform active:scale-90"
          >
             <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/30 transition-all"></div>
             <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBgyMVuLoxc9BvcMvA172tBcnaMnxbMyjjlkBPQL6Av2dv5rb4gC0auq5GK1SHsMzrcDPz4Nh7oEG1Jjlv7AVRvoV-JFdlpvzJLl2ifNOmxWTswiBghpyDjMJSzsa8-PLQvUPB9gucVu84wDG3kOs1SoAFvwT9ykNgmrWIvI0jviZNM6dGNJQF0Y0VQPqc3kjKDfN0VDa5ZH6wnoE33FYPICV_eCU6PaJ22agRqJM2bx4bAt-VnhlgCQgXb2SGDc9xHrMCuxlUKPc4" alt="PostMaster Logo" className="w-20 h-20 object-contain relative z-10 rounded-xl" />
          </button>
          <h1 className="text-3xl font-bold text-white text-center tracking-tight">PostMaster <span className="text-primary">MZ</span></h1>
          <p className="text-gray-400 text-sm mt-2">Automação Inteligente de Conteúdo</p>
        </div>
        
        <div className="space-y-5">
           {/* If user exists based on email, we show 'Welcome Back', else 'Create Account' style */}
           {/* Simplified for this demo: always show full form first time or just login */}
           <div className="space-y-4">
             {/* Simple logic: if 'Create Account' mode is toggled locally */}
             {view === 'register' && (
                 <Input 
                 placeholder="Nome Completo" 
                 value={name} 
                 onChange={e => setName(e.target.value)} 
                 />
             )}
             <Input 
               placeholder="E-mail" 
               type="email" 
               value={email} 
               onChange={e => setEmail(e.target.value)} 
             />
             <Input 
               placeholder="Senha" 
               type="password" 
               value={password} 
               onChange={e => setPassword(e.target.value)} 
             />
             
             {error && <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-red-500 text-sm text-center">{error}</div>}
             
             {view === 'login' ? (
                 <>
                    <Button onClick={() => handleLogin(false)} className="w-full h-14 text-lg shadow-primary/25">Entrar</Button>
                    <p className="text-center text-gray-400 text-sm">
                        Novo por aqui? <button onClick={() => setView('register')} className="text-primary font-bold hover:underline">Criar Conta</button>
                    </p>
                 </>
             ) : (
                 <>
                    <Button onClick={() => handleRegister(false)} className="w-full h-14 text-lg shadow-primary/25">Criar Conta</Button>
                    <p className="text-center text-gray-400 text-sm">
                        Seus dados estão seguros e serão usados para login.
                    </p>
                    <p className="text-center text-gray-400 text-sm mt-2">
                        Já tem conta? <button onClick={() => setView('login')} className="text-primary font-bold hover:underline">Entrar</button>
                    </p>
                 </>
             )}
             
             <div className="text-center mt-4">
                 <button className="text-xs text-gray-500 hover:text-gray-300">Esqueceu a senha?</button>
             </div>
           </div>
        </div>
      </div>
    </div>
  );

  const AdminLoginView = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-900 border-8 border-red-900/10">
      <div className="w-full max-w-md space-y-6 bg-black p-8 rounded-2xl border border-red-900/30 shadow-2xl shadow-red-900/20">
        <div className="flex justify-center mb-4">
            <span className="material-symbols-outlined text-5xl text-red-600">security</span>
        </div>
        <h1 className="text-2xl font-bold text-red-500 text-center uppercase tracking-widest">Painel Administrativo</h1>
        
        {users.filter(u => u.isAdmin).length === 0 ? (
           <p className="text-center text-gray-400 text-sm bg-red-900/20 p-2 rounded">Sistema sem administrador. Crie a conta root.</p>
        ) : null}
        
        <div className="space-y-4">
          {users.filter(u => u.isAdmin).length === 0 && (
             <Input placeholder="Nome Admin" value={name} onChange={e => setName(e.target.value)} />
          )}
          <Input placeholder="E-mail Admin" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <Input placeholder="Senha Admin" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          
          {error && <p className="text-red-500 text-sm text-center font-bold">{error}</p>}
          
          {users.filter(u => u.isAdmin).length === 0 ? (
             <Button onClick={() => handleRegister(true)} variant="danger" className="w-full">Criar Acesso Root</Button>
          ) : (
             <Button onClick={() => handleLogin(true)} variant="danger" className="w-full">Entrar</Button>
          )}
          
          <button onClick={() => { setView('login'); setLogoTaps(0); }} className="w-full text-center text-gray-600 text-sm hover:text-gray-400">Voltar para App</button>
        </div>
      </div>
    </div>
  );

  // 2. USER PANEL (Components)

  const UserSidebar = () => (
    <div className="fixed bottom-0 left-0 w-full md:w-64 md:top-0 md:h-screen bg-surface border-t md:border-r border-white/5 z-40 flex md:flex-col justify-between p-2 md:p-6 shadow-2xl">
       <div className="hidden md:flex flex-col items-start mb-8 px-2">
         <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">diamond</span>
            PostMaster <span className="text-primary">MZ</span>
         </h1>
         <span className="text-xs text-gray-500 mt-1 ml-8">v1.0.0</span>
       </div>
       
       <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible w-full justify-between md:justify-start md:space-y-1 no-scrollbar">
          {[
            { id: 'dashboard', icon: 'dashboard', label: 'Início' },
            { id: 'create-post', icon: 'edit_square', label: 'Post' },
            { id: 'create-carousel', icon: 'view_carousel', label: 'Carrossel' },
            { id: 'create-reel', icon: 'movie', label: 'Reel' },
            { id: 'schedule', icon: 'calendar_month', label: 'Agenda' },
            { id: 'history', icon: 'history', label: 'Histórico' },
          ].map(item => (
            <button
              key={item.id}
              disabled={!checkUserAccess() && item.id !== 'dashboard' && item.id !== 'history'}
              onClick={() => { setView(item.id); setCreationStep(0); setGeneratedContent(null); }}
              className={`flex flex-col md:flex-row items-center md:gap-3 p-2 md:px-4 md:py-3 rounded-xl transition-all whitespace-nowrap
                ${view === item.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}
                ${(!checkUserAccess() && item.id !== 'dashboard' && item.id !== 'history') ? 'opacity-30 cursor-not-allowed' : ''}
              `}
            >
              <span className="material-symbols-outlined text-2xl md:text-[20px]">{item.icon}</span>
              <span className="text-[10px] md:text-sm font-medium">{item.label}</span>
            </button>
          ))}
          
          <div className="hidden md:block w-full h-px bg-white/5 my-4"></div>
          
           {[
            { id: 'plans', icon: 'credit_card', label: 'Assinatura' },
            { id: 'socials', icon: 'link', label: 'Conexões' },
            { id: 'settings', icon: 'settings', label: 'Config' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col md:flex-row items-center md:gap-3 p-2 md:px-4 md:py-3 rounded-xl transition-all whitespace-nowrap
                ${view === item.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}
              `}
            >
              <span className="material-symbols-outlined text-2xl md:text-[20px]">{item.icon}</span>
              <span className="text-[10px] md:text-sm font-medium">{item.label}</span>
            </button>
          ))}
       </div>
    </div>
  );

  const AccessBlockedMessage = () => (
      <div className="flex flex-col items-center justify-center p-8 bg-surface border border-red-500/20 rounded-2xl text-center space-y-4 max-w-md mx-auto mt-10">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
             <span className="material-symbols-outlined text-3xl text-red-500">lock</span>
          </div>
          <h3 className="text-xl font-bold text-white">Funcionalidade Bloqueada</h3>
          <p className="text-gray-400">O seu período gratuito expirou ou você não possui um plano ativo.</p>
          <Button onClick={() => setView('plans')}>Ver Planos</Button>
      </div>
  );

  // --- USER VIEWS ---

  const DashboardView = () => {
    const active = checkUserAccess();
    
    return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold">Olá, {user?.name}</h1>
           <p className="text-gray-400">Aqui está a visão geral do seu PostMaster MZ</p>
        </div>
        <div className="flex items-center gap-3 bg-surface p-2 pr-4 rounded-full border border-white/5">
            <div className="h-10 w-10 bg-gradient-to-tr from-primary to-orange-400 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-lg">
                {user?.name.charAt(0)}
            </div>
            <div>
                <p className="text-xs text-gray-400">Plano Atual</p>
                <p className="text-sm font-bold text-primary uppercase">{user?.plan}</p>
            </div>
        </div>
      </header>

      {/* Status Cards */}
      {user?.plan === PlanType.TRIAL && (
        <div className={`p-6 rounded-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 border ${active ? 'bg-gradient-to-r from-blue-900/40 to-surface border-blue-500/30' : 'bg-red-900/10 border-red-500/30'}`}>
            <div className="flex items-center gap-4 z-10">
                <div className={`p-3 rounded-xl ${active ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                    <span className="material-symbols-outlined text-3xl">timer</span>
                </div>
                <div>
                    <h3 className="text-lg font-medium text-white">{active ? "Período Gratuito Ativo" : "Período Expirado"}</h3>
                    <p className={`text-2xl font-bold font-mono ${active ? 'text-blue-400' : 'text-red-400'}`}>
                        {active ? formatTimeLeft(user.trialStartDate + TRIAL_DURATION_MS) : "00:00:00"}
                    </p>
                </div>
            </div>
            <div className="z-10">
                <Button onClick={() => setView('plans')} variant={active ? "primary" : "danger"}>
                    {active ? "Fazer Upgrade" : "Reativar Conta"}
                </Button>
            </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button onClick={() => setView('create-post')} className="bg-surface hover:bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all group">
              <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-purple-400">edit_square</span>
              </div>
              <span className="font-medium">Novo Post</span>
          </button>
          <button onClick={() => setView('create-carousel')} className="bg-surface hover:bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all group">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-green-400">view_carousel</span>
              </div>
              <span className="font-medium">Carrossel</span>
          </button>
          <button onClick={() => setView('create-reel')} className="bg-surface hover:bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all group">
              <div className="w-12 h-12 rounded-full bg-pink-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-pink-400">movie</span>
              </div>
              <span className="font-medium">Criar Reel</span>
          </button>
          <button onClick={() => setView('schedule')} className="bg-surface hover:bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all group">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-blue-400">calendar_month</span>
              </div>
              <span className="font-medium">Agenda</span>
          </button>
      </div>

      {/* Feed Preview */}
      <div>
         <div className="flex justify-between items-end mb-4">
            <h3 className="text-lg font-bold">Publicações Recentes</h3>
            <button onClick={() => setView('history')} className="text-sm text-primary hover:underline">Ver tudo</button>
         </div>
         <div className="space-y-3">
             {posts.filter(p => p.userId === user?.id).slice(0, 3).map(post => (
                 <div key={post.id} className="bg-surface p-3 rounded-xl flex items-center gap-4 border border-white/5 hover:border-white/10 transition-colors">
                     <div className="h-14 w-14 bg-black rounded-lg overflow-hidden flex-shrink-0">
                        {post.content.images && <img src={post.content.images[0]} className="w-full h-full object-cover"/>}
                        {post.content.videoUrl && <video src={post.content.videoUrl} className="w-full h-full object-cover"/>}
                     </div>
                     <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase text-gray-500 bg-white/5 px-1.5 rounded">{post.type}</span>
                            <span className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleDateString()}</span>
                         </div>
                         <p className="font-medium truncate mt-1 text-sm">{post.content.text || post.content.script || 'Sem descrição'}</p>
                     </div>
                     <div className={`text-xs px-2 py-1 rounded-full font-bold ${post.isPosted ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                         {post.isPosted ? 'PUBLICADO' : 'RASCUNHO'}
                     </div>
                 </div>
             ))}
             {posts.filter(p => p.userId === user?.id).length === 0 && (
                 <p className="text-center text-gray-500 py-8">Nenhuma publicação encontrada.</p>
             )}
         </div>
      </div>
    </div>
  )};

  const CreatePostView = () => {
      if (!checkUserAccess()) return <AccessBlockedMessage />;
      
      const [topic, setTopic] = useState('');
      const [generatedText, setGeneratedText] = useState('');
      const [imgPrompt, setImgPrompt] = useState('');
      
      const handleGenerate = async () => {
          setIsLoading(true);
          setLoadingStep('Gerando legenda inteligente...');
          try {
              const text = await generateCaption(topic, 'Post Simples');
              setGeneratedText(text);
              
              setLoadingStep('Criando imagem com IA...');
              const promptToUse = imgPrompt || `High quality social media image for topic: ${topic}`;
              const img = await generateImage(promptToUse);
              if (img) setUploadedImage(img);

              setCreationStep(1);
          } catch (e) {
              alert("Erro ao gerar conteúdo");
          } finally {
              setIsLoading(false);
          }
      };
      
      const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (file) {
              const reader = new FileReader();
              reader.onloadend = () => setUploadedImage(reader.result as string);
              reader.readAsDataURL(file);
          }
      };

      if (creationStep === 1) {
          return (
              <div className="p-6 space-y-6 max-w-3xl mx-auto">
                  <h2 className="text-xl font-bold flex items-center gap-2"><button onClick={() => setCreationStep(0)} className="material-symbols-outlined">arrow_back</button> Revisar Post</h2>
                  <div className="bg-surface rounded-xl p-4 space-y-4 border border-white/10">
                      {uploadedImage && <img src={uploadedImage} alt="Post" className="w-full rounded-lg max-h-[400px] object-cover" />}
                      <TextArea value={generatedText} onChange={(e) => setGeneratedText(e.target.value)} rows={6} className="text-sm font-sans" />
                  </div>
                  <div className="flex gap-4">
                      <Button onClick={() => {
                          const time = prompt("Agendar para (YYYY-MM-DD HH:MM):");
                          const ts = time ? new Date(time).getTime() : undefined;
                          saveNewPost(PostType.TEXT_IMAGE, { text: generatedText, images: uploadedImage ? [uploadedImage] : [] }, ts);
                      }} className="flex-1" variant="success">
                          <span className="material-symbols-outlined">calendar_clock</span>
                          Agendar
                      </Button>
                      <Button onClick={() => saveNewPost(PostType.TEXT_IMAGE, { text: generatedText, images: uploadedImage ? [uploadedImage] : [] })} className="flex-1">
                          Salvar Rascunho
                      </Button>
                  </div>
              </div>
          );
      }

      return (
          <div className="p-6 space-y-6 max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold">Criar Publicação</h2>
              <div className="space-y-6">
                  <div className="bg-surface p-4 rounded-2xl border border-white/5 space-y-4">
                      <label className="block">
                          <span className="text-gray-400 text-sm mb-2 block">Sobre o que é o post?</span>
                          <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Ex: Promoção de Verão..." />
                      </label>
                      <label className="block">
                          <span className="text-gray-400 text-sm mb-2 block">Descrição da Imagem (Opcional)</span>
                          <Input value={imgPrompt} onChange={e => setImgPrompt(e.target.value)} placeholder="Ex: Praia ensolarada com produtos..." />
                      </label>
                  </div>

                  <div className="bg-surface p-4 rounded-2xl border border-white/5">
                      <span className="text-gray-400 text-sm mb-3 block">Imagem</span>
                      <div className="flex gap-4">
                         <div className="relative flex-1">
                             <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                             <div className="border-2 border-dashed border-white/20 rounded-xl p-4 text-center hover:bg-white/5 transition-colors h-full flex flex-col justify-center items-center gap-2">
                                 <span className="material-symbols-outlined text-3xl">upload_file</span>
                                 <span className="text-xs">Carregar</span>
                             </div>
                         </div>
                         {uploadedImage && <div className="h-24 w-24 rounded-xl overflow-hidden"><img src={uploadedImage} className="w-full h-full object-cover"/></div>}
                      </div>
                  </div>

                  <Button onClick={handleGenerate} disabled={!topic || isLoading} className="w-full">
                      {isLoading ? loadingStep : "Gerar com IA"}
                  </Button>
              </div>
          </div>
      );
  };

  const CreateCarouselView = () => {
      if (!checkUserAccess()) return <AccessBlockedMessage />;
      
      // Simplified Carousel Logic
      const addSlide = () => setCarouselSlides([...carouselSlides, { image: '', text: '' }]);
      
      return (
          <div className="p-6 space-y-6 max-w-3xl mx-auto">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Criar Carrossel</h2>
                <Button onClick={addSlide} variant="secondary" className="text-xs py-2">+ Slide</Button>
              </div>
              
              <div className="space-y-4">
                  {carouselSlides.length === 0 && (
                      <div className="text-center py-10 bg-surface rounded-2xl border border-white/5 border-dashed">
                          <p className="text-gray-500">Adicione slides para começar</p>
                          <Button onClick={addSlide} className="mt-4">Adicionar Slide 1</Button>
                      </div>
                  )}
                  
                  {carouselSlides.map((slide, idx) => (
                      <div key={idx} className="bg-surface p-4 rounded-2xl border border-white/5 flex gap-4 items-start">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold text-white shrink-0">{idx + 1}</div>
                          <div className="flex-1 space-y-3">
                              <Input 
                                placeholder="Texto do slide..." 
                                value={slide.text} 
                                onChange={(e) => {
                                    const newSlides = [...carouselSlides];
                                    newSlides[idx].text = e.target.value;
                                    setCarouselSlides(newSlides);
                                }}
                              />
                              <div className="flex items-center gap-2">
                                  <button 
                                    onClick={async () => {
                                        const img = await generateImage(slide.text || "Background abstract");
                                        if (img) {
                                            const newSlides = [...carouselSlides];
                                            newSlides[idx].image = img;
                                            setCarouselSlides(newSlides);
                                        }
                                    }}
                                    className="text-xs bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg"
                                  >
                                      Gerar Imagem IA
                                  </button>
                                  {slide.image && <span className="text-xs text-green-500">Imagem Definida</span>}
                              </div>
                          </div>
                          <button onClick={() => setCarouselSlides(carouselSlides.filter((_, i) => i !== idx))} className="text-red-500"><span className="material-symbols-outlined">delete</span></button>
                      </div>
                  ))}
              </div>
              
              {carouselSlides.length > 0 && (
                   <Button onClick={() => {
                       saveNewPost(PostType.CAROUSEL, { 
                           images: carouselSlides.map(s => s.image), 
                           text: carouselSlides.map(s => s.text).join('\n---\n') 
                       });
                   }} className="w-full">Salvar Carrossel</Button>
              )}
          </div>
      );
  };

  const CreateReelView = () => {
    if (!checkUserAccess()) return <AccessBlockedMessage />;
    
    const handleGenerateReel = async () => {
        setIsLoading(true);
        setLoadingStep('Gerando vídeo com Veo...');
        let baseImage = uploadedImage;
        try {
            if (!baseImage) {
                setLoadingStep('Criando imagem base do roteiro...');
                baseImage = await generateImage(`Cinematic scene: ${script}`);
            }
            if (baseImage) {
                 setLoadingStep('Animando vídeo (Isso pode demorar)...');
                 const videoUrl = await generateVideo(script, baseImage);
                 if (videoUrl) {
                     setGeneratedContent(videoUrl);
                     setCreationStep(1);
                 } else alert("Falha ao gerar vídeo.");
            }
        } catch (e) { alert("Erro."); } finally { setIsLoading(false); }
    };

    if (creationStep === 1) {
        return (
            <div className="p-6 space-y-6 max-w-3xl mx-auto">
                <h2 className="text-xl font-bold">Reel Gerado</h2>
                <div className="bg-surface rounded-xl p-2 border border-white/10">
                    <video src={generatedContent} controls className="w-full rounded-lg max-h-[500px]" />
                </div>
                <div className="flex gap-4">
                    <Button onClick={() => setCreationStep(0)} variant="secondary" className="flex-1">Voltar</Button>
                    <Button onClick={() => {
                        const time = prompt("Agendar (YYYY-MM-DD HH:MM)?");
                        const ts = time ? new Date(time).getTime() : undefined;
                        saveNewPost(PostType.REEL, { videoUrl: generatedContent, script }, ts);
                    }} className="flex-1">Salvar</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold">Criar Reel / Vídeo Curto</h2>
            <div className="bg-surface p-6 rounded-2xl border border-white/5 space-y-6">
                <label className="block">
                    <span className="text-gray-400 text-sm mb-2 block">Roteiro / Descrição da Cena</span>
                    <TextArea value={script} onChange={e => setScript(e.target.value)} placeholder="Descreva a ação do vídeo..." rows={4} />
                </label>
                
                <div>
                    <span className="text-gray-400 text-sm mb-2 block">Imagem de Referência (Opcional)</span>
                    <input type="file" accept="image/*" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => setUploadedImage(reader.result as string);
                            reader.readAsDataURL(file);
                        }
                    }} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"/>
                </div>

                <Button onClick={handleGenerateReel} disabled={!script || isLoading} className="w-full">
                    {isLoading ? loadingStep : "Gerar Vídeo"}
                </Button>
            </div>
        </div>
    );
  };

  const SocialsView = () => {
    const [ig, setIg] = useState(user?.instagramUrl || '');
    const [fb, setFb] = useState(user?.facebookUrl || '');

    const handleSave = () => {
        if (!user) return;
        const updated = { ...user, instagramUrl: ig, facebookUrl: fb };
        const newUsers = users.map(u => u.id === user.id ? updated : u);
        setUsers(newUsers);
        saveUsers(newUsers);
        setUser(updated);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
        alert("Salvo!");
    };

    return (
        <div className="p-6 space-y-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold">Conectar Redes Sociais</h2>
            <div className="bg-surface p-6 rounded-2xl border border-white/5 space-y-6">
                <p className="text-sm text-gray-400">Insira os links dos seus perfis para facilitar a publicação manual.</p>
                <div>
                    <label className="text-xs text-gray-400 mb-1 block">Link do Instagram</label>
                    <div className="flex gap-2">
                        <span className="bg-white/5 px-3 py-3 rounded-xl flex items-center justify-center"><img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" className="w-6 h-6"/></span>
                        <Input value={ig} onChange={e => setIg(e.target.value)} placeholder="https://instagram.com/seuusuario" />
                    </div>
                </div>
                <div>
                    <label className="text-xs text-gray-400 mb-1 block">Link do Facebook</label>
                    <div className="flex gap-2">
                        <span className="bg-white/5 px-3 py-3 rounded-xl flex items-center justify-center"><img src="https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg" className="w-6 h-6"/></span>
                        <Input value={fb} onChange={e => setFb(e.target.value)} placeholder="https://facebook.com/seuusuario" />
                    </div>
                </div>
                <Button onClick={handleSave} className="w-full">Salvar Conexões</Button>
            </div>
        </div>
    );
  };

  const PlansView = () => (
    <div className="p-6 space-y-6 pb-24 max-w-4xl mx-auto">
        <header className="text-center space-y-2 mb-8">
            <h2 className="text-3xl font-bold">Planos de Assinatura</h2>
            <p className="text-gray-400">Escolha o melhor plano para o seu negócio.</p>
        </header>
        
        <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-surface p-6 rounded-3xl border border-white/10 hover:border-primary transition-colors flex flex-col">
                <h3 className="text-xl font-bold text-gray-300">Mensal</h3>
                <p className="text-4xl font-bold mt-4 text-white">297 MZN</p>
                <p className="text-sm text-gray-500 mb-6">/mês</p>
                <ul className="text-sm text-gray-400 space-y-2 mb-8 flex-1">
                    <li>✓ Acesso total às ferramentas</li>
                    <li>✓ IA Ilimitada</li>
                    <li>✓ Suporte básico</li>
                </ul>
                <Button onClick={() => window.open(`https://wa.me/258846992260?text=Olá, quero assinar o plano Mensal (297 MZN)`, '_blank')} variant="secondary" className="w-full">Assinar</Button>
            </div>
            
            <div className="bg-surface p-6 rounded-3xl border-2 border-primary relative flex flex-col transform md:-translate-y-4 shadow-2xl shadow-primary/20">
                <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-xl">MAIS POPULAR</div>
                <h3 className="text-xl font-bold text-primary">Anual</h3>
                <p className="text-4xl font-bold mt-4 text-white">3.030 MZN</p>
                <p className="text-sm text-gray-500 mb-2">/ano</p>
                <p className="text-green-400 text-xs font-bold mb-6 bg-green-500/10 inline-block px-2 py-1 rounded">POUPE 15%</p>
                <ul className="text-sm text-gray-300 space-y-2 mb-8 flex-1">
                    <li>✓ Tudo do mensal</li>
                    <li>✓ 2 meses grátis</li>
                    <li>✓ Suporte Prioritário</li>
                    <li>✓ Acesso antecipado a novas features</li>
                </ul>
                <Button onClick={() => window.open(`https://wa.me/258846992260?text=Olá, quero assinar o plano Anual (3.030 MZN)`, '_blank')} className="w-full">Assinar Agora</Button>
            </div>

            <div className="bg-surface p-6 rounded-3xl border border-white/10 hover:border-primary transition-colors flex flex-col">
                <h3 className="text-xl font-bold text-gray-300">Trimestral</h3>
                <p className="text-4xl font-bold mt-4 text-white">846 MZN</p>
                <p className="text-sm text-gray-500 mb-2">/3 meses</p>
                <p className="text-green-400 text-xs font-bold mb-6">POUPE 5%</p>
                <ul className="text-sm text-gray-400 space-y-2 mb-8 flex-1">
                    <li>✓ Acesso total</li>
                    <li>✓ Renovação a cada 3 meses</li>
                </ul>
                <Button onClick={() => window.open(`https://wa.me/258846992260?text=Olá, quero assinar o plano Trimestral (846 MZN)`, '_blank')} variant="secondary" className="w-full">Assinar</Button>
            </div>
        </div>
        
        <div className="mt-8 text-center">
            <Button onClick={() => window.open('https://wa.me/258846992260', '_blank')} variant="secondary" className="text-sm">
                <span className="material-symbols-outlined">chat</span> Falar com Vendas
            </Button>
        </div>
    </div>
  );

  const ScheduleView = () => {
    const handlePublish = (post: Post) => {
        const url = user?.instagramUrl || user?.facebookUrl;
        if (url) window.open(url, '_blank');
        else {
            if(confirm("Você não configurou o link do perfil. Ir para configurações?")) setView('settings');
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
             <h2 className="text-2xl font-bold">Agenda de Publicações</h2>
             <div className="space-y-4">
                 {posts.filter(p => p.userId === user?.id && p.scheduledTime).length === 0 && <p className="text-gray-500">Nada agendado.</p>}
                 {posts.filter(p => p.userId === user?.id && p.scheduledTime).sort((a,b) => (a.scheduledTime||0) - (b.scheduledTime||0)).map(post => (
                     <div key={post.id} className="bg-surface p-4 rounded-xl border border-white/5 flex gap-4 items-center">
                         <div className="w-16 h-16 bg-black rounded-lg overflow-hidden shrink-0">
                             {post.content.images && <img src={post.content.images[0]} className="w-full h-full object-cover"/>}
                             {post.content.videoUrl && <video src={post.content.videoUrl} className="w-full h-full object-cover"/>}
                         </div>
                         <div className="flex-1">
                             <p className="text-sm font-bold text-gray-300">{new Date(post.scheduledTime!).toLocaleString()}</p>
                             <p className="text-xs text-gray-500 uppercase">{post.type}</p>
                         </div>
                         <Button onClick={() => handlePublish(post)} className="text-xs px-3 py-2">
                             Publicar Agora
                         </Button>
                         <button onClick={() => {
                             const newPosts = posts.filter(p => p.id !== post.id);
                             setPosts(newPosts);
                             savePosts(newPosts);
                         }} className="text-red-500 p-2"><span className="material-symbols-outlined">delete</span></button>
                     </div>
                 ))}
             </div>
        </div>
    );
  };

  const HistoryView = () => (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold">Histórico de Criações</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {posts.filter(p => p.userId === user?.id).map(post => (
                 <div key={post.id} className="bg-surface rounded-xl overflow-hidden border border-white/5 relative group aspect-square">
                     {post.content.images && <img src={post.content.images[0]} className="w-full h-full object-cover"/>}
                     {post.content.videoUrl && <video src={post.content.videoUrl} className="w-full h-full object-cover"/>}
                     <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3">
                         <p className="text-xs text-white font-bold truncate">{post.type}</p>
                         <p className="text-[10px] text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</p>
                     </div>
                     <button onClick={() => {
                             const newPosts = posts.filter(p => p.id !== post.id);
                             setPosts(newPosts);
                             savePosts(newPosts);
                     }} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><span className="material-symbols-outlined text-sm">close</span></button>
                 </div>
             ))}
          </div>
      </div>
  );

  const SettingsView = () => (
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold">Configurações</h2>
          <div className="bg-surface p-6 rounded-2xl border border-white/5 space-y-6">
              <div>
                  <label className="text-xs text-gray-400 mb-1 block">Nome</label>
                  <Input value={user?.name} readOnly className="opacity-50 cursor-not-allowed" />
              </div>
              <div>
                  <label className="text-xs text-gray-400 mb-1 block">Email</label>
                  <Input value={user?.email} readOnly className="opacity-50 cursor-not-allowed" />
              </div>
              <Button onClick={handleLogout} variant="danger" className="w-full">Terminar Sessão</Button>
          </div>
      </div>
  );

  // 3. ADMIN PANEL (Components)

  const AdminSidebar = () => (
    <div className="fixed bottom-0 left-0 w-full md:w-64 md:top-0 md:h-screen bg-[#0a0a0a] border-t md:border-r border-red-900/20 z-40 flex md:flex-col justify-between p-4">
       <div className="hidden md:block mb-8 px-2">
         <h1 className="text-xl font-bold text-red-500 uppercase tracking-widest border-b border-red-900/30 pb-4">ADMINISTRADOR</h1>
       </div>
       
       <div className="flex md:flex-col gap-2 w-full justify-around md:justify-start">
          <button onClick={() => setView('admin-dashboard')} className={`flex items-center gap-3 p-3 rounded-xl w-full text-left ${view === 'admin-dashboard' ? 'bg-red-900/20 text-red-500' : 'text-gray-500 hover:text-white'}`}>
              <span className="material-symbols-outlined">monitoring</span>
              <span className="hidden md:inline font-medium">Monitorização</span>
          </button>
          <button onClick={() => setView('admin-users')} className={`flex items-center gap-3 p-3 rounded-xl w-full text-left ${view === 'admin-users' ? 'bg-red-900/20 text-red-500' : 'text-gray-500 hover:text-white'}`}>
              <span className="material-symbols-outlined">group</span>
              <span className="hidden md:inline font-medium">Usuários</span>
          </button>
          <button onClick={() => setView('admin-settings')} className={`flex items-center gap-3 p-3 rounded-xl w-full text-left ${view === 'admin-settings' ? 'bg-red-900/20 text-red-500' : 'text-gray-500 hover:text-white'}`}>
              <span className="material-symbols-outlined">settings_suggest</span>
              <span className="hidden md:inline font-medium">Config Admin</span>
          </button>
          
          <div className="md:mt-auto">
             <button onClick={handleLogout} className="flex items-center gap-3 p-3 rounded-xl w-full text-left text-gray-500 hover:text-red-400">
                  <span className="material-symbols-outlined">logout</span>
                  <span className="hidden md:inline font-medium">Sair</span>
             </button>
          </div>
       </div>
    </div>
  );

  const AdminDashboard = () => {
      const activeUsers = users.filter(u => !u.isBlocked && !u.isAdmin).length;
      const blockedUsers = users.filter(u => u.isBlocked).length;
      const trialUsers = users.filter(u => u.plan === PlanType.TRIAL && !u.isAdmin).length;
      const monthlyUsers = users.filter(u => u.plan === PlanType.MENSAL).length;
      const yearlyUsers = users.filter(u => u.plan === PlanType.ANUAL && !u.isAdmin).length;
      
      return (
          <div className="p-8 space-y-8 max-w-7xl mx-auto">
              <header>
                  <h1 className="text-3xl font-bold text-white">Bem-vindo ao Painel Administrativo</h1>
                  <p className="text-gray-500">Visão geral do sistema PostMaster MZ</p>
              </header>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#111] p-6 rounded-2xl border border-white/5">
                      <h3 className="text-gray-400 text-sm uppercase font-bold">Total Usuários</h3>
                      <p className="text-5xl font-bold text-white mt-2">{users.length - 1}</p>
                  </div>
                  <div className="bg-[#111] p-6 rounded-2xl border border-white/5">
                      <h3 className="text-gray-400 text-sm uppercase font-bold">Usuários Ativos</h3>
                      <p className="text-5xl font-bold text-green-500 mt-2">{activeUsers}</p>
                  </div>
                  <div className="bg-[#111] p-6 rounded-2xl border border-white/5">
                      <h3 className="text-gray-400 text-sm uppercase font-bold">Bloqueados</h3>
                      <p className="text-5xl font-bold text-red-500 mt-2">{blockedUsers}</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#111] p-6 rounded-2xl border border-white/5">
                      <h3 className="text-white font-bold mb-4">Distribuição de Planos</h3>
                      <div className="space-y-4">
                          <div className="flex justify-between items-center">
                              <span className="text-gray-400">Trial (Gratuito)</span>
                              <span className="text-white font-mono">{trialUsers}</span>
                          </div>
                          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden"><div style={{width: `${(trialUsers/(users.length-1))*100}%`}} className="h-full bg-blue-500"></div></div>
                          
                          <div className="flex justify-between items-center">
                              <span className="text-gray-400">Mensal</span>
                              <span className="text-white font-mono">{monthlyUsers}</span>
                          </div>
                          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden"><div style={{width: `${(monthlyUsers/(users.length-1))*100}%`}} className="h-full bg-green-500"></div></div>
                          
                          <div className="flex justify-between items-center">
                              <span className="text-gray-400">Anual</span>
                              <span className="text-white font-mono">{yearlyUsers}</span>
                          </div>
                          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden"><div style={{width: `${(yearlyUsers/(users.length-1))*100}%`}} className="h-full bg-purple-500"></div></div>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  const AdminUserList = () => {
      const [filter, setFilter] = useState('');
      
      const updateUser = (id: string, updates: Partial<User>) => {
          const newUsers = users.map(u => u.id === id ? { ...u, ...updates } : u);
          setUsers(newUsers);
          saveUsers(newUsers);
      };

      const filteredUsers = users.filter(u => !u.isAdmin && (u.name.toLowerCase().includes(filter.toLowerCase()) || u.email.toLowerCase().includes(filter.toLowerCase())));

      return (
          <div className="p-8 space-y-6 max-w-7xl mx-auto pb-24">
              <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-white">Gestão de Usuários</h1>
                  <Input placeholder="Buscar por nome ou email..." className="max-w-xs" value={filter} onChange={e => setFilter(e.target.value)} />
              </div>
              
              <div className="space-y-4">
                  {filteredUsers.map(u => (
                      <div key={u.id} className="bg-[#111] p-6 rounded-2xl border border-white/5 flex flex-col md:flex-row justify-between gap-6">
                          <div>
                              <div className="flex items-center gap-3">
                                  <h3 className="text-lg font-bold text-white">{u.name}</h3>
                                  <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${u.isBlocked ? 'bg-red-900 text-red-500' : 'bg-green-900 text-green-500'}`}>
                                      {u.isBlocked ? 'Bloqueado' : 'Ativo'}
                                  </span>
                              </div>
                              <p className="text-gray-500 text-sm">{u.email}</p>
                              <div className="mt-2 text-sm text-gray-400">
                                  <p>Plano: <span className="text-primary font-bold">{u.plan}</span></p>
                                  {u.plan === PlanType.TRIAL && <p className="text-xs">Expira em: {formatTimeLeft(u.trialStartDate + TRIAL_DURATION_MS)}</p>}
                              </div>
                          </div>
                          
                          <div className="flex flex-col gap-2 min-w-[200px]">
                              <p className="text-xs text-gray-500 font-bold uppercase mb-1">Ações do Plano</p>
                              <div className="flex gap-2">
                                  <button onClick={() => updateUser(u.id, { plan: PlanType.MENSAL })} className="bg-white/5 hover:bg-white/10 text-xs px-3 py-2 rounded flex-1">Mensal</button>
                                  <button onClick={() => updateUser(u.id, { plan: PlanType.TRIMESTRAL })} className="bg-white/5 hover:bg-white/10 text-xs px-3 py-2 rounded flex-1">Tri</button>
                                  <button onClick={() => updateUser(u.id, { plan: PlanType.ANUAL })} className="bg-white/5 hover:bg-white/10 text-xs px-3 py-2 rounded flex-1">Anual</button>
                              </div>
                              <div className="flex gap-2 mt-2">
                                  <button onClick={() => updateUser(u.id, { plan: PlanType.TRIAL, trialStartDate: Date.now() })} className="bg-blue-900/20 text-blue-500 hover:bg-blue-900/30 text-xs px-3 py-2 rounded flex-1">Reset Trial</button>
                                  <button onClick={() => updateUser(u.id, { isBlocked: !u.isBlocked })} className={`text-xs px-3 py-2 rounded flex-1 ${u.isBlocked ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                                      {u.isBlocked ? 'Desbloquear' : 'Bloquear'}
                                  </button>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  };
  
  const AdminSettings = () => (
      <div className="p-8 space-y-6 max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-white">Configurações do Admin</h1>
          <div className="bg-[#111] p-6 rounded-2xl border border-white/5 space-y-4">
              <p>Email: {user?.email}</p>
              <Button onClick={() => alert("Funcionalidade de alterar senha em desenvolvimento")} variant="secondary" className="w-full">Alterar Senha</Button>
          </div>
      </div>
  );

  // --- RENDER LOGIC ---

  if (!user) {
      if (view === 'admin-login') return <AdminLoginView />;
      return <LoginView />;
  }

  if (user.isAdmin) {
      return (
          <div className="flex flex-col md:flex-row min-h-screen bg-black text-white">
              <AdminSidebar />
              <div className="flex-1 md:ml-64 overflow-y-auto h-screen no-scrollbar">
                  {view === 'admin-dashboard' && <AdminDashboard />}
                  {view === 'admin-users' && <AdminUserList />}
                  {view === 'admin-settings' && <AdminSettings />}
              </div>
          </div>
      );
  }

  return (
      <div className="flex flex-col md:flex-row min-h-screen bg-dark text-white pb-20 md:pb-0 font-sans">
          <UserSidebar />
          <div className="flex-1 md:ml-64 overflow-y-auto h-screen no-scrollbar">
              {view === 'dashboard' && <DashboardView />}
              {view === 'create-post' && <CreatePostView />}
              {view === 'create-carousel' && <CreateCarouselView />}
              {view === 'create-reel' && <CreateReelView />}
              {view === 'schedule' && <ScheduleView />}
              {view === 'history' && <HistoryView />}
              {view === 'socials' && <SocialsView />}
              {view === 'plans' && <PlansView />}
              {view === 'settings' && <SettingsView />}
          </div>
      </div>
  );
}
