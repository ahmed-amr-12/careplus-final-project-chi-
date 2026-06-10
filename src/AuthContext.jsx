import { createContext, useContext, useState, useCallback } from 'react';
import { secureStorage, isTokenExpired } from './security';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = secureStorage.getToken();
    if (!token || isTokenExpired(token)) {
      secureStorage.clear();
      return null;
    }
    return secureStorage.getUser();
  });

  const [token, setToken] = useState(() => {
    const t = secureStorage.getToken();
    if (!t || isTokenExpired(t)) { secureStorage.clear(); return null; }
    return t;
  });

  const loginUser = useCallback((userData, tokenData) => {
    secureStorage.setToken(tokenData);
    secureStorage.setUser(userData);
    setUser(userData);
    setToken(tokenData);
  }, []);

  const logoutUser = useCallback(() => {
    secureStorage.clear();
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, loginUser, logoutUser,
      isAdmin: user?.role === 'admin',
      isPharmacist: user?.role === 'pharmacist',
      isCashier: user?.role === 'cashier',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
