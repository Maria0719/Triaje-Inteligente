import { useState } from 'react'; 
import { useNavigate } from 'react-router-dom'; 
import { Shield, Mail, Lock, ChevronDown } from 'lucide-react'; 
import { useApp } from '@/context/AppContext'; 
import { Button } from '@/components/ui/button'; 
import { Input } from '@/components/ui/input'; 
import { AuthApiService } from '@/infrastructure/api/AuthApiService'; 

const authApiService = new AuthApiService();

export default function LoginPage() { 
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState(''); 
  const [role, setRole] = useState('Doctor'); 
  const [emailError, setEmailError] = useState(''); 
  const [passwordError, setPasswordError] = useState(''); 
  const { setIsLoggedIn, setUserName, setUserRole } = useApp(); 
  const navigate = useNavigate(); 

  const handleLogin = async (e: React.FormEvent) => { 
    e.preventDefault(); 
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
    }
    catch (error) {
      console.warn('Backend login failed, using development fallback:', error);
      setUserName(email);
      setUserRole(role);
    }

    setIsLoggedIn(true); 
    navigate('/dashboard'); 
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

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-11"> 
              Iniciar sesión 
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-6"> 
            Hospital Universitario San José • v2.1.0 
          </p>
        </div>
      </div>
    </div>
  );
}
