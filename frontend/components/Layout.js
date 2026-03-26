import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { FiBook, FiUser, FiTag, FiLogOut, FiMenu, FiX, FiChevronLeft, FiChevronRight, FiSettings, FiUsers } from 'react-icons/fi';
import { useAuth } from '../contexts/auth';
import { ROLES } from '../lib/roles';

export default function Layout({ children }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  useEffect(() => {
    // Fechar o menu mobile quando mudar de rota
    setIsMobileMenuOpen(false);
    
    // Recuperar o estado do sidebar do localStorage
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState !== null) {
      setIsSidebarCollapsed(savedState === 'true');
    }
  }, [router.pathname]);

  // Guard global de navegação por role (evita acesso ao CMS por aluno/professor)
  useEffect(() => {
    if (!user?.role) return;
    const isAppOnly = user.role === ROLES.aluno || user.role === ROLES.professor;
    if (!isAppOnly) return;

    const allowed = router.pathname === '/app' || router.pathname.startsWith('/app/') || router.pathname.startsWith('/profile');
    if (!allowed) {
      router.replace('/app');
    }
  }, [user?.role, router.pathname]);
  
  // Salvar o estado do sidebar no localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      alert('Falha ao fazer logout. Por favor, tente novamente.');
    }
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const NavigationLinks = ({ collapsed }) => (
    <>
      <Link href="/books" className={`flex items-center ${collapsed ? 'justify-center' : 'px-3'} p-3 rounded-lg ${router.pathname.startsWith('/books') ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}>
        <FiBook className={collapsed ? "mx-auto" : "mr-2"} size={collapsed ? 26 : 20} />
        {!collapsed && <span className="truncate">Livros</span>}
      </Link>

      {(user?.role === ROLES.admin) && (
        <>
          <Link href="/authors" className={`flex items-center ${collapsed ? 'justify-center' : 'px-3'} p-3 rounded-lg ${router.pathname.startsWith('/authors') ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}>
            <FiUser className={collapsed ? "mx-auto" : "mr-2"} size={collapsed ? 26 : 20} />
            {!collapsed && <span className="truncate">Autores</span>}
          </Link>
          
          <Link href="/categories" className={`flex items-center ${collapsed ? 'justify-center' : 'px-3'} p-3 rounded-lg ${router.pathname.startsWith('/categories') ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}>
            <FiTag className={collapsed ? "mx-auto" : "mr-2"} size={collapsed ? 26 : 20} />
            {!collapsed && <span className="truncate">Categorias</span>}
          </Link>

          <Link href="/admin/users" className={`flex items-center ${collapsed ? 'justify-center' : 'px-3'} p-3 rounded-lg ${router.pathname.startsWith('/admin/users') ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}>
            <FiUsers className={collapsed ? "mx-auto" : "mr-2"} size={collapsed ? 26 : 20} />
            {!collapsed && <span className="truncate">Usuários</span>}
          </Link>
        </>
      )}
      
      <Link href="/profile" className={`flex items-center ${collapsed ? 'justify-center' : 'px-3'} p-3 rounded-lg ${router.pathname.startsWith('/profile') ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}>
        <FiSettings className={collapsed ? "mx-auto" : "mr-2"} size={collapsed ? 26 : 20} />
        {!collapsed && <span className="truncate">Meu Perfil</span>}
      </Link>
    </>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar - Desktop */}
      <div className={`hidden md:flex md:flex-col ${isSidebarCollapsed ? 'md:w-20' : 'md:w-52'} md:fixed md:inset-y-0 bg-white border-r transition-all duration-300`}>
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} flex-shrink-0 px-4 mb-5`}>
            {!isSidebarCollapsed && <h1 className="text-lg font-bold text-blue-600">UniverseTeca</h1>}
            <button 
              onClick={toggleSidebar}
              className="p-2 rounded-full hover:bg-gray-200 focus:outline-none"
              title={isSidebarCollapsed ? "Expandir" : "Recolher"}
            >
              {isSidebarCollapsed ? <FiChevronRight size={22} /> : <FiChevronLeft size={22} />}
            </button>
          </div>
          
          <div className="flex-grow px-2 mt-5 space-y-4">
            <NavigationLinks collapsed={isSidebarCollapsed} />
          </div>
          
          <div className={`px-2 pt-4 border-t ${isSidebarCollapsed ? 'text-center' : ''}`}>
            {!isSidebarCollapsed ? (
              <div className="flex items-center p-2">
                <div className="flex-shrink-0">
                  {user?.user_metadata?.avatar_url ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden shadow-sm">
                      <img 
                        src={user.user_metadata.avatar_url} 
                        alt={user.email} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium shadow-sm">
                      {user && user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                </div>
                <div className="ml-2 truncate">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {user?.user_metadata?.name || user?.email || 'Usuário'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-2 flex justify-center">
                {user?.user_metadata?.avatar_url ? (
                  <div className="w-12 h-12 rounded-full overflow-hidden shadow-sm">
                    <img 
                      src={user.user_metadata.avatar_url} 
                      alt={user.email} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-medium shadow-sm">
                    {user && user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
            )}
            
            <button
              onClick={handleLogout}
              className={`flex ${isSidebarCollapsed ? 'justify-center w-full' : 'w-full'} items-center p-2 mt-1 text-red-600 rounded-lg hover:bg-red-50`}
              title="Sair"
            >
              <FiLogOut className={isSidebarCollapsed ? "" : "mr-2"} size={isSidebarCollapsed ? 26 : 20} />
              {!isSidebarCollapsed && <span className="truncate">Sair</span>}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Header */}
      <div className="fixed inset-x-0 top-0 z-10 flex items-center h-14 bg-white border-b md:hidden">
        <div className="flex items-center justify-between w-full px-4">
          <div className="flex items-center">
            <button
              type="button"
              className="text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <FiX size={24} />
              ) : (
                <FiMenu size={24} />
              )}
            </button>
            <h1 className="ml-3 text-lg font-bold text-blue-600">UniverseTeca</h1>
          </div>
        </div>
      </div>
      
      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-20 bg-gray-600 bg-opacity-75" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="fixed inset-y-0 left-0 z-30 w-full max-w-xs bg-white" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col h-full">
              <div className="h-14 flex items-center px-4 border-b">
                <button
                  type="button"
                  className="text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <FiX size={24} />
                </button>
                <h1 className="ml-3 text-lg font-bold text-blue-600">UniverseTeca CMS</h1>
              </div>
              
              <div className="flex-grow px-4 mt-5 space-y-2 overflow-y-auto">
                <NavigationLinks collapsed={false} />
              </div>
              
              <div className="px-4 py-4 border-t">
                <div className="flex items-center p-3">
                  <div className="flex-shrink-0">
                    {user?.user_metadata?.avatar_url ? (
                      <div className="w-8 h-8 rounded-full overflow-hidden shadow-sm">
                        <img 
                          src={user.user_metadata.avatar_url} 
                          alt={user.email} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium shadow-sm">
                        {user && user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                  </div>
                  <div className="ml-3 truncate">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {user?.user_metadata?.name || user?.email || 'Usuário'}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center p-3 mt-2 text-red-600 rounded-lg hover:bg-red-50"
                >
                  <FiLogOut className="mr-3" size={20} />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className={`flex flex-col flex-1 ${isSidebarCollapsed ? 'md:pl-20' : 'md:pl-52'} transition-all duration-300`}>
        <main className="flex-1 pt-16 md:pt-4">
          {children}
        </main>
      </div>
    </div>
  );
} 