import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  Menu, 
  X, 
  LayoutDashboard, 
  FileText, 
  BarChart3, 
  BookOpen, 
  Shield,
  LogOut,
  ChevronRight,
  User,
  History
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authService, type User } from '@/lib/auth'
import { toast } from 'sonner'

interface SidebarProps {
  user: User | null
}

export default function Sidebar({ user }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await authService.logout()
    toast.success('Logged out successfully')
    navigate('/login', { replace: true })
  }

  const toggleSidebar = () => setIsOpen(!isOpen)
  const closeSidebar = () => setIsOpen(false)

  const isActive = (path: string) => location.pathname === path

  const NavItem = ({ 
    icon: Icon, 
    label, 
    path, 
    onClick 
  }: { 
    icon: any
    label: string
    path?: string
    onClick?: () => void 
  }) => (
    <button
      onClick={() => {
        if (onClick) {
          onClick()
        } else if (path) {
          navigate(path)
          closeSidebar()
        }
      }}
      className={`w-full flex items-center justify-between px-4 py-3 text-left rounded-lg transition-all ${
        path && isActive(path)
          ? 'bg-primary text-white font-semibold'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5" />
        <span>{label}</span>
      </div>
      {path && <ChevronRight className="w-4 h-4 opacity-50" />}
    </button>
  )

  return (
    <>
      {/* Mobile Hamburger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 md:hidden bg-white shadow-lg rounded-full"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </Button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r w-72 z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:static`}
      >
        <div className="flex flex-col h-full">
          {/* Logo & User Info */}
          <div className="p-6 border-b">
            <div className="flex items-center gap-3 mb-4">
              {/* Yahan par humne BookOpen icon hata kar logo.png laga diya hai */}
              <img 
                src="/logo.png" 
                alt="Rankify Logo" 
                className="w-12 h-12 rounded-xl object-cover shadow-sm border border-gray-100" 
              />
              <div>
                <h1 className="text-xl font-bold text-foreground">RANKIFY</h1>
                <p className="text-xs text-muted-foreground">Quiz Platform</p>
              </div>
            </div>
            
            {user && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {user.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {user.role}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
            {/* Student Section */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-4">
                Student
              </p>
              <div className="space-y-1">
                <NavItem
                  icon={LayoutDashboard}
                  label="Student Dashboard"
                  path="/dashboard"
                />
                <NavItem
                  icon={History}
                  label="Quiz History"
                  path="/history"
                />
              </div>
            </div>

            {/* Admin Section - Only show if user is admin */}
            {user?.role === 'admin' && (
              <div>
                <div className="flex items-center gap-2 mb-3 px-4">
                  <Shield className="w-4 h-4 text-purple-600" />
                  <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
                    Admin Panel
                  </p>
                </div>
                <div className="space-y-1">
                  <NavItem
                    icon={LayoutDashboard}
                    label="Admin Dashboard"
                    path="/admin/dashboard"
                  />
                  <NavItem
                    icon={FileText}
                    label="Manage Quizzes"
                    path="/admin/quizzes"
                  />
                  <NavItem
                    icon={BookOpen}
                    label="Question Bank"
                    path="/admin/quizzes"
                  />
                  <NavItem
                    icon={BarChart3}
                    label="Analytics"
                    path="/admin/analytics"
                  />
                </div>
              </div>
            )}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t">
            <Button
              variant="outline"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}

