'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  RiDashboardLine, 
  RiMovie2Line, 
  RiMegaphoneLine, 
  RiComputerLine,
  RiFileChartLine,
  RiSettings4Line,
  RiUserLine,
  RiLogoutBoxRLine,
  RiArrowDownSLine,
  RiMenuLine,
  RiCloseLine
} from 'react-icons/ri';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState('/dashboard');

  useEffect(() => {
    const userDetails = localStorage.getItem('userDetails');
    if (!userDetails) {
      router.push('/');
      return;
    }
    setUser(JSON.parse(userDetails));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('userDetails');
    router.push('/');
  };

  const navItems = [
    { name: 'DASHBOARD', icon: RiDashboardLine, path: '/dashboard' },
    { name: 'MEDIA', icon: RiMovie2Line, path: '/dashboard/media' },
    { name: 'CAMPAIGN', icon: RiMegaphoneLine, path: '/dashboard/campaign' },
    { name: 'SCREENS', icon: RiComputerLine, path: '/dashboard/screens' },
    { name: 'REPORTS', icon: RiFileChartLine, path: '/dashboard/reports' },
    { name: 'SETTINGS', icon: RiSettings4Line, path: '/dashboard/settings' },
  ];

  const handleNavigation = (path: string) => {
    setActiveMenu(path);
    setIsMobileMenuOpen(false);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm fixed w-full top-0 z-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-blue-600">HYPER</h1>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:ml-8 md:flex md:space-x-4 flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeMenu === item.path;
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    onClick={() => handleNavigation(item.path)}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out
                      ${isActive 
                        ? 'text-blue-600 bg-blue-50' 
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                  >
                    <Icon className="w-5 h-5 mr-2" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-md text-gray-600 hover:text-blue-600 hover:bg-blue-50 focus:outline-none"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <RiCloseLine className="w-6 h-6" />
              ) : (
                <RiMenuLine className="w-6 h-6" />
              )}
            </button>

            <div className="flex items-center">
              <div className="relative">
                <button
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-150 ease-in-out ${
                    isDropdownOpen ? 'bg-blue-50 text-blue-600' : ''
                  }`}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <span>Welcome {user.name}</span>
                  <RiUserLine className="w-5 h-5" />
                  <RiArrowDownSLine className={`w-5 h-5 transition-transform duration-200 ${
                    isDropdownOpen ? 'transform rotate-180' : ''
                  }`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                    <div className="py-1">
                      <Link
                        href="/dashboard/profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <RiUserLine className="w-5 h-5 mr-2" />
                        Profile
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <RiLogoutBoxRLine className="w-5 h-5 mr-2" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          <div className={`md:hidden transition-all duration-300 ease-in-out ${
            isMobileMenuOpen 
              ? 'max-h-screen opacity-100 visible'
              : 'max-h-0 opacity-0 invisible'
          }`}>
            <nav className="px-4 pt-2 pb-3 space-y-1 bg-white shadow-lg">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeMenu === item.path;
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    onClick={() => handleNavigation(item.path)}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out
                      ${isActive 
                        ? 'text-blue-600 bg-blue-50' 
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                  >
                    <Icon className="w-5 h-5 mr-2" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto pt-20 p-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
