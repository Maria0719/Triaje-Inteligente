import { useState } from 'react'; 
import { useNavigate } from 'react-router-dom'; 
import { Shield, Mail, Lock, User, ChevronDown } from 'lucide-react'; 
import { useApp } from '@/context/AppContext'; 
import { Button } from '@/components/ui/button'; 
import { Input } from '@/components/ui/input'; 
import { AuthApiService } from '@/infrastructure/api/AuthApiService'; 

const authApiService = new AuthApiService();

export default function LoginPage() { 
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState(''); 
  const [role, setRole] = useState('Doctor'); 
  const [emailError, setEmailError] = useState(''); 
  const [passwordError, setPasswordError] = useState(''); 
  const [authError, setAuthError] = useState('');
  
  // Register mode fields
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameError, setNameError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  
  const { setIsLoggedIn, setUserName, setUserRole } = useApp(); 
  const navigate = useNavigate(); 

  const handleLogin = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    setAuthError('');
    const nextEmailError = email.trim() ? '' : 'El correo electrónico es obligatorio'; 
    const nextPasswordError = password.trim() ? '' : 'La contraseña es obligatoria'; 

    setEmailError(nextEmailError); 
    setPasswordError(nextPasswordError); 

    if (nextEmailError || nextPasswordError) { 
      return; 
    }

    try {
      const user = await authApiService.login(email, password, role);
      setUserName(user.name || user.email);
      setUserRole(user.role || role);
      setIsLoggedIn(true); 
      navigate('/dashboard');
    }
    catch (error) {
      setAuthError('Correo o contraseña incorrectos');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const nextNameError = name.trim() ? '' : 'El nombre completo es obligatorio';
    const nextEmailError = email.trim() ? '' : 'El correo electrónico es obligatorio';
    const nextPasswordError = password.trim() ? '' : 'La contraseña es obligatoria';
    const nextConfirmPasswordError = 
      confirmPassword.trim() ? (password === confirmPassword ? '' : 'Las contraseñas no coinciden') : 'Confirmar contraseña es obligatorio';

    setNameError(nextNameError);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setConfirmPasswordError(nextConfirmPasswordError);

    if (nextNameError || nextEmailError || nextPasswordError || nextConfirmPasswordError) {
      return;
    }

    try {
      await authApiService.register(email, password, name, role);
      // Auto-login after successful registration
      const user = await authApiService.login(email, password, role);
      setUserName(user.name || user.email);
      setUserRole(user.role || role);
      setIsLoggedIn(true);
      navigate('/dashboard');
    }
    catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Error al registrarse');
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setAuthError('');
    setEmailError('');
    setPasswordError('');
    setNameError('');
    setConfirmPasswordError('');
  };

  return ( 
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary to-border px-4"> 
      <div className="w-full max-w-md"> 
        <div className="bg-card rounded-xl shadow-lg border border-border p-8"> 
          
          <div className="text-center mb-8"> 
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-primary/10 mb-4"> 
              <Shield className="h-8 w-8 text-primary" /> 
            </div>
            <h1 className="text-2xl font-bold text-primary">TriageAI</h1> 
            <p className="text-muted-foreground text-sm mt-1">Sistema de Triaje Inteligente</p> 
          </div>

          {isRegisterMode ? (
            // Register Form
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Nombre completo"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError('');
                  }}
                  className="pl-10"
                />
                {nameError && <span className="mt-1 block text-xs text-red-600">{nameError}</span>}
              </div>

              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  className="pl-10"
                />
                {emailError && <span className="mt-1 block text-xs text-red-600">{emailError}</span>}
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  className="pl-10"
                />
                {passwordError && <span className="mt-1 block text-xs text-red-600">{passwordError}</span>}
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Confirmar contraseña"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmPasswordError) setConfirmPasswordError('');
                  }}
                  className="pl-10"
                />
                {confirmPasswordError && <span className="mt-1 block text-xs text-red-600">{confirmPasswordError}</span>}
              </div>

              <div className="relative">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="Doctor">Doctor</option>
                  <option value="Enfermero">Enfermero</option>
                  <option value="Administrador">Administrador</option>
                </select>
                <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>

              {authError && <div className="text-sm text-red-600 text-center">{authError}</div>}

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-11">
                Crear cuenta
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-sm text-primary hover:underline"
                >
                  ¿Ya tienes cuenta? Iniciar sesión
                </button>
              </div>
            </form>
          ) : (
            // Login Form
            <form onSubmit={handleLogin} className="space-y-4"> 
            
              <div className="relative"> 
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /> 
                <Input 
                  type="email" 
                  placeholder="Correo electrónico" 
                  value={email} 
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError)
                      setEmailError('');
                  }}
                  className="pl-10" 
                />
                {emailError && <span className="mt-1 block text-xs text-red-600">{emailError}</span>} 
              </div>

              
              <div className="relative"> 
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /> 
                <Input 
                  type="password" 
                  placeholder="Contraseña" 
                  value={password} 
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError)
                      setPasswordError('');
                  }}
                  className="pl-10" 
                />
                {passwordError && <span className="mt-1 block text-xs text-red-600">{passwordError}</span>} 
              </div>

              
              <div className="relative"> 
                <select 
                  value={role} 
                  onChange={(e) => setRole(e.target.value)} 
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring" 
                >
                  <option value="Doctor">Doctor</option> 
                  <option value="Enfermero">Enfermero</option> 
                  <option value="Administrador">Administrador</option> 
                </select>
                <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" /> 
              </div>

              {authError && <div className="text-sm text-red-600 text-center">{authError}</div>}

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-11"> 
                Iniciar sesión 
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-sm text-primary hover:underline"
                >
                  ¿No tienes cuenta? Crear cuenta
                </button>
              </div>
            </form>
          )}

          <p className="text-xs text-center text-muted-foreground mt-6"> 
            Hospital Universitario San José • v2.1.0 
          </p>
        </div>
      </div>
    </div>
  );
}
