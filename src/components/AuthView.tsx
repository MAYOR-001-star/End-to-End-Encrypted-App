import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { generateRSAKeyPair, exportPublicKey, wrapPrivateKey, arrayBufferToBase64, deriveWrappingKey } from '../lib/crypto';
import { Lock, User, AtSign, Loader2, Eye, EyeOff } from 'lucide-react';

export const AuthView: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, register } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await login(formData.username, formData.password);
      } else {
        if (formData.password !== formData.confirmPassword) {
          throw new Error("Passwords do not match");
        }
        
        const keyPair = await generateRSAKeyPair();
        const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const saltBase64 = arrayBufferToBase64(salt);
        const wrappingKey = await deriveWrappingKey(formData.password, saltBase64);
        const wrappedPrivateKey = await wrapPrivateKey(keyPair.privateKey, wrappingKey);
        
        await register(formData.username, formData.displayName, formData.password, {
          publicKey: publicKeyBase64,
          wrappedPrivateKey,
          salt: saltBase64
        });
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let message = "An unexpected error occurred";
      
      if (err.name === 'OperationError') {
        message = "Incorrect password or corrupted secure key. If you recently updated the app, please try creating a new account.";
      } else {
        message = err?.message || (typeof err === 'string' ? err : message);
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[100dvh] bg-bg-primary relative overflow-hidden p-4">
      {/* Green Banner */}
      <div className="absolute top-0 left-0 right-0 h-[220px] bg-accent z-0" />
      
      <div className="w-full max-w-[480px] p-6 sm:p-12 bg-bg-secondary shadow-[0_17px_50px_0_rgba(0,0,0,0.19),0_12px_15px_0_rgba(0,0,0,0.24)] z-10 animate-fade rounded-lg">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="WhisperBox Logo" className="w-20 h-20" />
          </div>
          <h1 className="text-3xl font-light text-text-primary mb-3">WhisperBox</h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            {isLogin ? 'Welcome back, secure and private.' : 'Create your encrypted account.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex items-center bg-bg-tertiary rounded-lg px-4 border-b-2 border-transparent focus-within:border-accent transition-all duration-200">
            <User size={18} className="text-text-dim mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Username"
              className="w-full py-4 text-sm bg-transparent outline-none text-text-primary placeholder:text-text-dim"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />
          </div>

          {!isLogin && (
            <div className="flex items-center bg-bg-tertiary rounded-lg px-4 border-b-2 border-transparent focus-within:border-accent transition-all duration-200">
              <AtSign size={18} className="text-text-dim mr-3 shrink-0" />
              <input
                type="text"
                placeholder="Display Name"
                className="w-full py-4 text-sm bg-transparent outline-none text-text-primary placeholder:text-text-dim"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                required
              />
            </div>
          )}

          <div className="flex items-center bg-bg-tertiary rounded-lg px-4 border-b-2 border-transparent focus-within:border-accent transition-all duration-200">
            <Lock size={18} className="text-text-dim mr-3 shrink-0" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full py-4 text-sm bg-transparent outline-none text-text-primary placeholder:text-text-dim"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="text-text-dim hover:text-text-secondary transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {!isLogin && (
            <div className="flex items-center bg-bg-tertiary rounded-lg px-4 border-b-2 border-transparent focus-within:border-accent transition-all duration-200">
              <Lock size={18} className="text-text-dim mr-3 shrink-0" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                className="w-full py-4 text-sm bg-transparent outline-none text-text-primary placeholder:text-text-dim"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
              />
              <button 
                type="button" 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="text-text-dim hover:text-text-secondary transition-colors"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}

          {error && (
            <div className="text-text-danger text-xs text-center bg-text-danger/10 p-2.5 rounded">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="bg-accent hover:bg-accent-light text-white py-4 rounded font-semibold text-sm uppercase tracking-wider mt-3 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center transition-all"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'Login' : 'Create Account')}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-border-main pt-6">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-accent text-sm font-medium hover:underline"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  );
};
