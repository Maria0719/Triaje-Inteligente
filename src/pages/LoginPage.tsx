import { useState } from 'react'; // Imports state hook
import { useNavigate } from 'react-router-dom'; // Imports navigation hook
import { Shield, Mail, Lock, ChevronDown } from 'lucide-react'; // Imports form icons
import { useApp } from '@/context/AppContext'; // Imports app context
import { Button } from '@/components/ui/button'; // Imports button component
import { Input } from '@/components/ui/input'; // Imports input component

export default function LoginPage() { // Declares login page
  const [email, setEmail] = useState(''); // Stores email state
  const [password, setPassword] = useState(''); // Stores password state
  const [role, setRole] = useState('Doctor'); // Stores selected role
  const [emailError, setEmailError] = useState(''); // Stores email error
  const [passwordError, setPasswordError] = useState(''); // Stores password error
  const { setIsLoggedIn, setUserName, setUserRole } = useApp(); // Reads context setters
  const navigate = useNavigate(); // Stores navigate function

  const handleLogin = (e: React.FormEvent) => { // Handles submit event
    e.preventDefault(); // Prevents default submit
    const nextEmailError = email.trim() ? '' : 'El correo electrónico es obligatorio'; // Evalua correo obligatorio
    const nextPasswordError = password.trim() ? '' : 'La contraseña es obligatoria'; // Evalua clave obligatoria

    setEmailError(nextEmailError); // Guarda error de correo
    setPasswordError(nextPasswordError); // Guarda error de clave

    if (nextEmailError || nextPasswordError) { // Verifica errores actuales
      return; // Detiene envio invalido
    }

    setUserName(email); // Sets user name
    setUserRole(role); // Sets user role
    setIsLoggedIn(true); // Marks session logged
    navigate('/dashboard'); // Redirects to dashboard
  };

  return ( // Renders login content
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary to-border px-4"> {/* Contenedor principal */}
      <div className="w-full max-w-md"> {/* Limita ancho del formulario */}
        <div className="bg-card rounded-xl shadow-lg border border-border p-8"> {/* Tarjeta de acceso */}
          {/* Logo */}
          <div className="text-center mb-8"> {/* Encabezado del formulario */}
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-primary/10 mb-4"> {/* Contenedor del icono */}
              <Shield className="h-8 w-8 text-primary" /> {/* Muestra icono principal */}
            </div>
            <h1 className="text-2xl font-bold text-primary">TriageAI</h1> {/* Muestra titulo del sistema */}
            <p className="text-muted-foreground text-sm mt-1">Sistema de Triaje Inteligente</p> {/* Muestra subtitulo del sistema */}
          </div>

          <form onSubmit={handleLogin} className="space-y-4"> {/* Formulario de ingreso */}
            {/* Email */}
            <div className="relative"> {/* Campo de correo */}
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /> {/* Icono del correo */}
              <Input /* Campo correo */
                type="email" /* Tipo de entrada */
                placeholder="Correo electrónico" /* Texto del placeholder */
                value={email} /* Valor de correo */
                onChange={(e) => { /* Maneja cambio correo */
                  setEmail(e.target.value); // Actualiza valor de correo
                  if (emailError) setEmailError(''); // Limpia error de correo
                }}
                className="pl-10" /* Agrega espacio icono */
              />
              {emailError && <span className="mt-1 block text-xs text-red-600">{emailError}</span>} {/* Muestra error del correo */}
            </div>

            {/* Password */}
            <div className="relative"> {/* Campo de clave */}
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /> {/* Icono de clave */}
              <Input /* Campo clave */
                type="password" /* Tipo de entrada */
                placeholder="Contraseña" /* Texto del placeholder */
                value={password} /* Valor de clave */
                onChange={(e) => { /* Maneja cambio clave */
                  setPassword(e.target.value); // Actualiza valor de clave
                  if (passwordError) setPasswordError(''); // Limpia error de clave
                }}
                className="pl-10" /* Agrega espacio icono */
              />
              {passwordError && <span className="mt-1 block text-xs text-red-600">{passwordError}</span>} {/* Muestra error de clave */}
            </div>

            {/* Role selector */}
            <div className="relative"> {/* Selector de rol */}
              <select /* Selector de usuario */
                value={role} /* Valor de rol */
                onChange={(e) => setRole(e.target.value)} /* Actualiza rol elegido */
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring" /* Estilo del selector */
              >
                <option value="Doctor">Doctor</option> {/* Opcion rol doctor */}
                <option value="Enfermero">Enfermero</option> {/* Opcion rol enfermero */}
                <option value="Administrador">Administrador</option> {/* Opcion rol administrador */}
              </select>
              <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" /> {/* Icono de desplegable */}
            </div>

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-11"> {/* Boton de acceso */}
              Iniciar sesión {/* Texto boton acceso */}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-6"> {/* Pie informativo */}
            Hospital Universitario San José • v2.1.0 {/* Muestra version del sistema */}
          </p>
        </div>
      </div>
    </div>
  );
}
