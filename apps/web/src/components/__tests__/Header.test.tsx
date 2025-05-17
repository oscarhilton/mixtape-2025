import { render, screen, fireEvent } from '@testing-library/react';
import Header from '../Header';
import { AuthContext } from '@/contexts/AuthContext'; // Import the actual context
import { useRouter } from 'next/navigation'; // To get the mock router

// Mock the useAuth hook directly or provide a mock context value
// Providing a mock context value is often cleaner for component tests.

describe('<Header />', () => {
  const mockLogin = jest.fn();
  const mockLogout = jest.fn();

  afterEach(() => {
    mockLogin.mockClear();
    mockLogout.mockClear();
    // Clear router mocks from jest.setup.js if needed, though here we're more focused on AuthContext
    const router = useRouter();
    if (router.push.mockClear) router.push.mockClear();
    if (router.refresh.mockClear) router.refresh.mockClear();
  });

  it('shows loading state initially', () => {
    render(
      <AuthContext.Provider value={{ user: null, isLoading: true, login: mockLogin, logout: mockLogout }}>
        <Header />
      </AuthContext.Provider>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows login button when not authenticated and not loading', () => {
    render(
      <AuthContext.Provider value={{ user: null, isLoading: false, login: mockLogin, logout: mockLogout }}>
        <Header />
      </AuthContext.Provider>
    );
    const loginButton = screen.getByRole('button', { name: /login with spotify/i });
    expect(loginButton).toBeInTheDocument();
    fireEvent.click(loginButton);
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it('shows user display name and logout button when authenticated', () => {
    const mockUser = { id: 1, spotify_id: 'test', display_name: 'Test User', email: 'test@example.com' };
    render(
      <AuthContext.Provider value={{ user: mockUser, isLoading: false, login: mockLogin, logout: mockLogout }}>
        <Header />
      </AuthContext.Provider>
    );
    expect(screen.getByText(`Welcome, ${mockUser.display_name}!`)).toBeInTheDocument();
    const logoutButton = screen.getByRole('button', { name: /logout/i });
    expect(logoutButton).toBeInTheDocument();
    fireEvent.click(logoutButton);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('renders the site title as a link to home', () => {
    render(
      <AuthContext.Provider value={{ user: null, isLoading: false, login: mockLogin, logout: mockLogout }}>
        <Header />
      </AuthContext.Provider>
    );
    const titleLink = screen.getByRole('link', { name: /mixtape in a bottle/i });
    expect(titleLink).toBeInTheDocument();
    expect(titleLink).toHaveAttribute('href', '/');
  });
}); 