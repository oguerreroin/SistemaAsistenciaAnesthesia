import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  MapPin, 
  User, 
  Clock, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Settings, 
  Search, 
  RefreshCw, 
  LogOut, 
  Map, 
  Eye, 
  PlusCircle, 
  FileText, 
  ShieldAlert,
  ArrowRightLeft,
  X,
  FileSpreadsheet,
  FileDown,
  Wifi,
  Compass,
  Activity,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  Building2
} from 'lucide-react';
import './App.css';

// Ajustar direcciones de API de forma dinámica para desarrollo y producción
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 

  ? 'http://localhost:5000/api' 
  : '/api';
const STORAGE_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000' 
  : '';

function App() {
  // --- PANTALLAS Y USUARIOS ---
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeSedeId, setActiveSedeId] = useState(() => {
    return localStorage.getItem('activeSedeId') || '';
  });
  
  // --- FORMULARIO TRABAJADOR ---
  const [dni, setDni] = useState('');
  const [pin, setPin] = useState('');
  const [focusedField, setFocusedField] = useState('dni'); // 'dni' o 'pin'
  const [loginLoading, setLoginLoading] = useState(false);

  // --- ESTADOS DE LA CÁMARA FRONTAL ---
  const [cameraActive, setCameraActive] = useState(false);
  const [markingLoading, setMarkingLoading] = useState(false);

  // --- FEEDBACK Y ERRORES ---
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState(null); // { tipo, usuario, sede, hora, distancia, fueraDeRango }
  const [countdown, setCountdown] = useState(3);
  const [toasts, setToasts] = useState([]);

  // --- TIEMPO REAL ---
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- CATÁLOGOS ---
  const [sedes, setSedes] = useState([]);

  // --- PANEL ADMINISTRATIVO PROTEGIDO ---
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [adminDni, setAdminDni] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [historial, setHistorial] = useState([]);
  const [rangoHistorial, setRangoHistorial] = useState('hoy'); // hoy, semana, mes
  const [filtroSede, setFiltroSede] = useState('');
  const [filtroTexto, setFiltroTexto] = useState('');
  const [historialLoading, setHistorialLoading] = useState(false);
  
  // Modal de visualización de foto de webcam
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Creación de nuevos usuarios (Admin)
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoDni, setNuevoDni] = useState('');
  const [nuevoRol, setNuevoRol] = useState('PERSONAL');
  const [nuevoPin, setNuevoPin] = useState('');
  const [adminSuccessMsg, setAdminSuccessMsg] = useState('');

  // Refs de video y canvas para biometría facial ligera
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const shouldCameraBeActive = useRef(false);
  const cameraRequestInProgress = useRef(false);

  // --- SISTEMA PREMIUM DE TOAST NOTIFICATIONS ---
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // --- EFECTO TIEMPO REAL ---
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- DETECTAR CARGA DE SEDES CLÍNICAS ---
  useEffect(() => {
    cargarSedes();
  }, []);

  // --- CONFIGURACIÓN AUTOMÁTICA DEL ROUTER / STATE MACHINE ---
  let currentScreen = 'LOGIN'; // Pantalla 1
  if (isAdminMode) {
    currentScreen = adminLoggedIn ? 'ADMIN_DASHBOARD' : 'ADMIN_LOGIN';
  } else if (successMessage) {
    currentScreen = 'SUCCESS'; // Pantalla 4
  } else if (currentUser) {
    currentScreen = activeSedeId ? 'CAPTURE' : 'SEDE_SELECT'; // Pantalla 3 o Pantalla 2
  }

  // --- MONTAJE AUTOMÁTICO DE CÁMARA FRONTAL EN PANTALLA 3 ---
  const mostrarPantallaCaptura = currentScreen === 'CAPTURE';
  useEffect(() => {
    if (mostrarPantallaCaptura) {
      iniciarCamara();
    } else {
      detenerCamara();
    }
    return () => detenerCamara();
  }, [mostrarPantallaCaptura]);

  // --- CONTROLES DE LA PANTALLA 4 (AUTO-LOGOUT EN 3 SEGUNDOS) ---
  useEffect(() => {
    if (successMessage) {
      setCountdown(3);
      const countdownTimer = setInterval(() => {
        setCountdown(prev => (prev > 1 ? prev - 1 : 0));
      }, 1000);

      const logoutTimer = setTimeout(() => {
        finalizarYLimpiarSesion();
      }, 3000);

      return () => {
        clearInterval(countdownTimer);
        clearTimeout(logoutTimer);
      };
    }
  }, [successMessage]);

  const finalizarYLimpiarSesion = () => {
    localStorage.clear();
    setCurrentUser(null);
    setActiveSedeId('');
    setSuccessMessage(null);
    setDni('');
    setPin('');
    setFocusedField('dni');
    setErrorMessage('');
    showToast('Sesión cerrada correctamente.', 'info');
  };

  // --- CONTROLADOR DE SEDES ---
  const cargarSedes = async () => {
    try {
      const res = await fetch(`${API_BASE}/sedes`);
      if (res.ok) {
        const data = await res.json();
        setSedes(data);
      }
    } catch (err) {
      console.error('Error al cargar sedes:', err);
      setErrorMessage('No se pudo establecer conexión para cargar las sedes.');
      showToast('Error de red al conectar con el servidor de sedes.', 'error');
    }
  };

  // --- CONTROLADORES DE ACCESO DE TRABAJADOR (PANTALLA 1) ---
  const handleUserLogin = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    if (!dni || dni.length < 8) {
      setErrorMessage('Por favor ingrese un DNI válido de 8 dígitos.');
      showToast('DNI incompleto.', 'warning');
      return;
    }
    if (!pin || pin.length < 4) {
      setErrorMessage('Por favor ingrese su PIN de marcación.');
      showToast('PIN incompleto.', 'warning');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni, pin })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        setCurrentUser(data.user);
        setErrorMessage('');
        showToast(`Bienvenido(a), ${data.user.nombre.split(' ')[0]}`, 'success');
      } else {
        setErrorMessage(data.error || 'Credenciales de acceso incorrectas.');
        showToast('Acceso denegado. Verifique sus credenciales.', 'error');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Error en el servidor al intentar iniciar sesión.');
      showToast('Error de conexión con el backend.', 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  // --- SELECCIÓN DE SEDE CLÍNICA (PANTALLA 2) ---
  const handleSedeSelect = (sedeId) => {
    localStorage.setItem('activeSedeId', sedeId);
    setActiveSedeId(sedeId);
    setErrorMessage('');
    if (sedeId) {
      const sedeName = sedes.find(s => s.id.toString() === sedeId)?.nombre || 'Sede';
      showToast(`Sede establecida: ${sedeName}`, 'info');
    }
  };

  // --- CONTROLADORES CÁMARA FRONTAL NATIVA (PANTALLA 3) CON SÓLIDO DIAGNÓSTICO ---
  const iniciarCamara = async () => {
    shouldCameraBeActive.current = true;

    if (cameraRequestInProgress.current) {
      console.log('Ya hay una solicitud de cámara en progreso. Ignorando.');
      return;
    }

    if (cameraStreamRef.current) {
      console.log('La cámara ya tiene un stream activo.');
      // Asegurar asignación al elemento de video
      if (videoRef.current && videoRef.current.srcObject !== cameraStreamRef.current) {
        videoRef.current.srcObject = cameraStreamRef.current;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn("Error playing video:", e);
        }
      }
      setCameraActive(true);
      return;
    }

    cameraRequestInProgress.current = true;
    try {
      // Validar si cuenta con APIs de MediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (window.isSecureContext === false) {
          throw new Error('SECURE_CONTEXT_ERROR');
        }
        throw new Error('NO_MEDIA_DEVICES');
      }

      showToast('Iniciando cámara...', 'info');
      let stream;
      try {
        // Intento 1: Cámara frontal nativa de alta fidelidad
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user', 
            width: { ideal: 640 }, 
            height: { ideal: 480 } 
          },
          audio: false
        });
      } catch (err) {
        console.warn('Fallo cámara frontal estricta, intentando fallback de emergencia:', err);
        showToast('Activando cámara disponible...', 'warning');
        // Fallback 1: Cualquier cámara web disponible (laptops o webcams externas)
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      // SI EL USUARIO SALIÓ DE LA PANTALLA MIENTRAS SE ESPERABA EL PERMISO, APAGAR DE INMEDIATO
      if (!shouldCameraBeActive.current) {
        console.log('La cámara se inició pero el usuario ya no está en la pantalla de captura. Deteniendo.');
        stream.getTracks().forEach(track => track.stop());
        cameraRequestInProgress.current = false;
        return;
      }
      
      cameraStreamRef.current = stream;
      setCameraActive(true);
      setErrorMessage('');
      showToast('Cámara lista.', 'success');
      
      // Asignación dual e inicio de reproducción explícito para evitar desfases en iOS/Android
      const bindStream = async (el) => {
        if (!el) return;
        el.srcObject = stream;
        try {
          await el.play();
        } catch (playErr) {
          console.warn("Error calling play() on video element, retrying:", playErr);
        }
      };

      if (videoRef.current) {
        await bindStream(videoRef.current);
      }
      setTimeout(() => {
        if (videoRef.current && shouldCameraBeActive.current) {
          bindStream(videoRef.current);
        }
      }, 50);
      setTimeout(() => {
        if (videoRef.current && shouldCameraBeActive.current) {
          bindStream(videoRef.current);
        }
      }, 150);
    } catch (err) {
      console.error('Error de acceso a camara:', err);
      setCameraActive(false);
      
      let errorText = 'No se pudo activar la cámara. Por favor, active los permisos en el navegador.';
      
      if (err.message === 'SECURE_CONTEXT_ERROR') {
        errorText = 'La cámara requiere una conexión segura (HTTPS) para funcionar.';
      } else if (err.message === 'NO_MEDIA_DEVICES') {
        errorText = 'No se detectó ninguna cámara conectada a este dispositivo.';
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorText = 'Acceso a la cámara denegado. Por favor, permita el uso de la cámara desde la configuración del navegador.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorText = 'No se encontró una cámara compatible.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorText = 'La cámara está ocupada por otra aplicación o bloqueada. Cierre otras apps e intente de nuevo.';
      }
      
      if (shouldCameraBeActive.current) {
        setErrorMessage(errorText);
        showToast('Error al iniciar cámara.', 'error');
      }
    } finally {
      cameraRequestInProgress.current = false;
    }
  };

  const detenerCamara = () => {
    shouldCameraBeActive.current = false;
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const obtenerFotoBlob = () => {
    return new Promise((resolve) => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        
        const ctx = canvas.getContext('2d');
        // Efecto espejo para el canvas biométrico
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Reset de transformaciones
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.85); // Alta calidad ideal con compresión para el VPS
      } else {
        resolve(null);
      }
    });
  };

  // --- OBTENER GEOLOCALIZACIÓN HÍBRIDA MULTI-DISPOSITIVO ---
  const obtenerGeolocalizacionHibrida = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('La geolocalización no está soportada por su navegador.'));
        return;
      }

      showToast('Verificando ubicación...', 'info');

      // Intento 1: Alta precisión satelital con timeout corto
      navigator.geolocation.getCurrentPosition(
        (position) => {
          showToast('Ubicación confirmada.', 'success');
          resolve(position);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            // Si el usuario denegó explícitamente el permiso, fallar de inmediato
            reject(err);
            return;
          }

          console.warn('Fallo GPS satelital o lento, intentando triangulación híbrida...', err);

          // Fallback 1: Baja precisión con tiempo amplio (muy rápido en interiores)
          navigator.geolocation.getCurrentPosition(
            (position) => {
              showToast('Ubicación confirmada.', 'success');
              resolve(position);
            },
            (err2) => {
              reject(err2);
            },
            { 
              enableHighAccuracy: false, 
              timeout: 10000, 
              maximumAge: 60000 // Permitir coordenadas de hasta 1 minuto
            }
          );
        },
        { 
          enableHighAccuracy: true, 
          timeout: 6000, // Esperar máximo 6 segundos por satélites
          maximumAge: 0 
        }
      );
    });
  };

  // --- REGISTRO DE ASISTENCIA UNIFICADO ---
  const procesarMarcado = async () => {
    setErrorMessage('');
    if (!currentUser) {
      setErrorMessage('Sesión expirada. Inicie sesión de nuevo.');
      showToast('Sesión inválida.', 'error');
      return;
    }
    if (!activeSedeId) {
      setErrorMessage('Seleccione una clínica.');
      showToast('Falta seleccionar clínica.', 'warning');
      return;
    }
    if (!cameraActive) {
      setErrorMessage('Se requiere acceso de cámara para registrar asistencia.');
      showToast('Cámara inactiva.', 'warning');
      return;
    }

    setMarkingLoading(true);

    try {
      const pos = await obtenerGeolocalizacionHibrida();
      const { latitude, longitude } = pos.coords;

      const fotoBlob = await obtenerFotoBlob();
      if (!fotoBlob) {
        throw new Error('Fallo la captura de la cámara frontal.');
      }

      // Crear FormData
      const formData = new FormData();
      formData.append('usuario_id', currentUser.id.toString());
      formData.append('sede_id', activeSedeId);
      formData.append('latitud', latitude.toString());
      formData.append('longitud', longitude.toString());
      formData.append('foto', fotoBlob, `captura_${currentUser.dni}.jpg`);

      showToast('Registrando su asistencia...', 'info');

      const response = await fetch(`${API_BASE}/asistencia/marcar`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const horaFormateada = new Date(result.data.fecha_hora).toLocaleTimeString('es-PE', { hour12: false });
        setSuccessMessage({
          tipo: result.data.tipo_marcado,
          usuario: result.data.usuario,
          rol: result.data.rol,
          sede: result.data.sede,
          hora: horaFormateada,
          distancia: result.data.distancia_metros,
          fueraDeRango: result.data.fuera_de_rango
        });
        showToast('Asistencia registrada con éxito.', 'success');
      } else {
        setErrorMessage(result.error || 'Error al registrar su asistencia.');
        showToast(result.error || 'Error en el registro.', 'error');
      }
    } catch (err) {
      console.error(err);
      
      let errorDesc = 'Error de conexión. No se pudo registrar la asistencia.';
      if (err.code === 1) {
        errorDesc = 'Acceso a ubicación denegado. Permita los permisos de ubicación en el navegador para marcar.';
        showToast('Ubicación bloqueada.', 'error');
      } else if (err.code === 3 || err.message?.includes('timeout')) {
        errorDesc = 'No se pudo obtener su ubicación. Conéctese a una red WiFi estable e intente nuevamente.';
        showToast('Ubicación no disponible.', 'error');
      } else {
        showToast('Error en la marcación.', 'error');
      }
      
      setErrorMessage(errorDesc);
    } finally {
      setMarkingLoading(false);
    }
  };

  // --- TECLADO VIRTUAL PIN-PAD KIOSKO TÁCTIL ---
  const presionarPinPad = (num) => {
    if (focusedField === 'dni') {
      if (dni.length < 8) {
        const nuevoDni = dni + num;
        setDni(nuevoDni);
        if (nuevoDni.length === 8) {
          setFocusedField('pin');
          showToast('DNI completo. Digite su PIN.', 'info');
        }
      }
    } else if (focusedField === 'pin') {
      if (pin.length < 6) {
        setPin(prev => prev + num);
      }
    }
  };

  const borrarPinPad = () => {
    if (focusedField === 'dni') {
      setDni(prev => prev.slice(0, -1));
    } else if (focusedField === 'pin') {
      setPin(prev => prev.slice(0, -1));
    }
  };

  const limpiarPinPad = () => {
    if (focusedField === 'dni') {
      setDni('');
    } else if (focusedField === 'pin') {
      setPin('');
    }
    showToast('Campo limpiado.', 'info');
  };

  // --- CONTROLADORES DE ACCESO ADMINISTRATIVO ---
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (!adminDni || !adminPin) {
      setErrorMessage('Complete las credenciales del Administrador.');
      showToast('Credenciales incompletas.', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: adminDni, pin: adminPin })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.user.rol !== 'ADMIN') {
          setErrorMessage('Acceso denegado. Rol administrativo no verificado.');
          showToast('Rol no autorizado.', 'error');
          return;
        }
        setAdminLoggedIn(true);
        setErrorMessage('');
        setAdminDni('');
        setAdminPin('');
        showToast('Acceso administrador autorizado.', 'success');
        cargarHistorialMarcaciones();
      } else {
        setErrorMessage(data.error || 'Credenciales administrativas inválidas.');
        showToast('Acceso administrador denegado.', 'error');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Error al conectar con la base de datos de administradores.');
      showToast('Error de conexión central.', 'error');
    }
  };

  const cargarHistorialMarcaciones = async () => {
    setHistorialLoading(true);
    try {
      let url = `${API_BASE}/asistencia/historial?rango=${rangoHistorial}`;
      if (filtroSede) url += `&sede_id=${filtroSede}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setHistorial(data);
      }
    } catch (err) {
      console.error(err);
      showToast('Fallo al obtener historial.', 'error');
    } finally {
      setHistorialLoading(false);
    }
  };

  // Recargar historial del admin al cambiar filtros
  useEffect(() => {
    if (adminLoggedIn) {
      cargarHistorialMarcaciones();
    }
  }, [rangoHistorial, filtroSede, adminLoggedIn]);

  // --- EXPORTACIONES DEL ADMINISTRADOR ---
  const exportarExcel = () => {
    showToast('Generando reporte Excel...', 'info');
    let url = `${API_BASE}/asistencia/exportar/excel?rango=${rangoHistorial}`;
    if (filtroSede) url += `&sede_id=${filtroSede}`;
    window.open(url, '_blank');
  };

  const exportarPDF = () => {
    showToast('Generando reporte PDF SUNAFIL...', 'info');
    let url = `${API_BASE}/asistencia/exportar/pdf?rango=${rangoHistorial}`;
    if (filtroSede) url += `&sede_id=${filtroSede}`;
    window.open(url, '_blank');
  };

  // --- ADMINISTRAR USUARIOS ---
  const registrarNuevoUsuario = async (e) => {
    e.preventDefault();
    setAdminSuccessMsg('');
    setErrorMessage('');

    if (!nuevoNombre || !nuevoDni || !nuevoPin) {
      setErrorMessage('Todos los campos son obligatorios para crear usuario.');
      showToast('Complete los campos.', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/crear-usuario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nuevoNombre,
          dni: nuevoDni,
          pin: nuevoPin,
          rol: nuevoRol
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAdminSuccessMsg(`¡Usuario ${data.data.nombre} creado con éxito!`);
        showToast('Médico/Colaborador registrado.', 'success');
        setNuevoNombre('');
        setNuevoDni('');
        setNuevoPin('');
        setNuevoRol('PERSONAL');
      } else {
        setErrorMessage(data.error || 'Error al crear usuario.');
        showToast('No se pudo crear el usuario.', 'error');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Error de red al intentar registrar usuario.');
      showToast('Fallo de conexión.', 'error');
    }
  };

  // Filtrado en el cliente para el buscador de texto del Admin
  const historialFiltrado = historial.filter(item => {
    const term = filtroTexto.toLowerCase().trim();
    if (!term) return true;
    return (
      item.usuario_nombre.toLowerCase().includes(term) ||
      item.usuario_dni.includes(term) ||
      item.usuario_rol.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen p-4 md:p-6 flex flex-col justify-between max-w-7xl mx-auto">
      
      {/* Contenedor de Toasts Flotantes */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`toast-notification pointer-events-auto p-4 rounded-xl shadow-lg border flex items-center gap-3 bg-slate-950/95 backdrop-blur-md transition-all duration-300 ${
              t.type === 'success' ? 'border-emerald-500/30 text-emerald-300' :
              t.type === 'error' ? 'border-red-500/30 text-red-300' :
              t.type === 'warning' ? 'border-amber-500/30 text-amber-300' :
              'border-indigo-500/30 text-indigo-300'
            }`}
          >
            {t.type === 'success' && <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />}
            {t.type === 'error' && <ShieldAlert className="h-5 w-5 shrink-0 text-red-400" />}
            {t.type === 'warning' && <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />}
            {t.type === 'info' && <Clock className="h-5 w-5 shrink-0 text-indigo-400" />}
            <span className="text-xs font-semibold flex-1">{t.message}</span>
            <button 
              onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
              className="text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* --- HEADER --- */}
      <header className="app-header flex flex-col md:flex-row justify-between items-center py-4 mb-6 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="Anesthesia Healthcare" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white m-0">
              Anesthesia Healthcare
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              <p className="text-[9px] text-slate-400 m-0 font-semibold">Sistema activo</p>
            </div>
          </div>
        </div>

        <div className="header-actions flex items-center gap-3">
          {/* Reloj */}
          <div className="flex items-center gap-3 text-slate-400 text-xs">
            <span className="font-medium">
              {currentTime.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
            <span className="text-slate-600">·</span>
            <span className="font-mono font-semibold text-slate-300">
              {currentTime.toLocaleTimeString('es-PE', { hour12: false })}
            </span>
          </div>

          {/* Botón Admin */}
          <button
            onClick={() => {
              setErrorMessage('');
              setAdminSuccessMsg('');
              if (adminLoggedIn) {
                setAdminLoggedIn(false);
                setIsAdminMode(false);
                showToast('Saliendo del panel administrativo.', 'info');
              } else {
                setIsAdminMode(!isAdminMode);
              }
            }}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer transition-colors"
          >
            {adminLoggedIn ? (
              <>
                <LogOut className="h-3.5 w-3.5 text-rose-400" />
                Cerrar
              </>
            ) : (
              <>
                <Settings className="h-3.5 w-3.5 text-slate-400" />
                {isAdminMode ? 'Kiosko' : 'Admin'}
              </>
            )}
          </button>
        </div>
      </header>

      {/* --- PANTALLA PRINCIPAL CON ENRUTADO --- */}
      <main className="flex-1 flex flex-col justify-center py-4">
        
        {/* Banner de errores del sistema */}
        {errorMessage && (
          <div className="glass-panel border-red-500/30 bg-red-950/20 text-red-300 p-4 mb-6 rounded-xl flex items-start gap-3 shadow-lg shadow-red-500/5 max-w-lg mx-auto w-full animate-scale-in">
            <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-red-200 m-0">Validación de Seguridad</h4>
              <p className="text-xs text-red-300/90 m-0 mt-1 leading-relaxed">{errorMessage}</p>
            </div>
            <button className="text-red-400 hover:text-red-200 cursor-pointer transition-colors" onClick={() => setErrorMessage('')}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ==========================================
            PANTALLA 1: LOGIN (DNI + PIN 4 DÍGITOS)
            ========================================== */}
        {currentScreen === 'LOGIN' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto w-full items-center">
            
            {/* Columna Izquierda: Mensaje de Bienvenida */}
            <div className="hidden lg:flex lg:col-span-7 flex-col gap-5 text-center lg:text-left pr-4">
              <span className="inline-flex self-center lg:self-start items-center gap-1.5 px-3 py-1 text-[10px] font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-full tracking-wide">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" /> Control de asistencia
              </span>
              <h2 className="text-4xl font-extrabold text-white leading-tight">
                Registre su asistencia en <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">Anesthesia Healthcare</span>
              </h2>
              <p className="text-sm text-slate-400 max-w-lg leading-relaxed">
                Ingrese su DNI y PIN para marcar su entrada o salida de forma segura.
              </p>
              
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start mt-2">
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <MapPin className="text-indigo-400 h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-[9px] font-semibold text-slate-500 block">Ubicación</span>
                    <span className="text-xs font-bold text-slate-200">Sede Confirmada</span>
                  </div>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Camera className="text-emerald-400 h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-[9px] font-semibold text-slate-500 block">Seguridad</span>
                    <span className="text-xs font-bold text-slate-200">Verificación Facial</span>
                  </div>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <ShieldCheck className="text-cyan-400 h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-[9px] font-semibold text-slate-500 block">Estado</span>
                    <span className="text-xs font-bold text-slate-200">Registro Oficial</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Formulario + Keypad */}
            <div className="lg:col-span-5 w-full">
              <div className="glass-panel p-6 glass-panel-primary flex flex-col gap-4">
                <div className="text-center flex flex-col items-center">
                  <div className="h-16 w-16 rounded-2xl bg-white p-1.5 mb-3 flex items-center justify-center shadow-lg shadow-cyan-500/10 overflow-hidden">
                    <img src="/logo.png" alt="Anesthesia Healthcare Logo" className="h-full w-full object-contain" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-wide m-0">Acceso de Personal</h3>
                  <p className="text-xs text-slate-400 mt-1">Identifíquese para registrar asistencia</p>
                </div>

                <form onSubmit={handleUserLogin} className="login-form flex flex-col gap-3">
                  
                  {/* Campo DNI */}
                  <div 
                    onClick={() => setFocusedField('dni')}
                    className={`kiosk-input-container ${focusedField === 'dni' ? 'focused' : ''}`}
                  >
                    <label className="text-[10px] font-semibold text-slate-400 block mb-1 tracking-wide">
                      DNI del colaborador {focusedField === 'dni' && <span className="text-indigo-400 font-bold">•</span>}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <User className={`h-4.5 w-4.5 ${focusedField === 'dni' ? 'text-indigo-400' : 'text-slate-500'}`} />
                      </div>
                      <input
                        type="text"
                        placeholder="Ingrese DNI"
                        value={dni}
                        readOnly
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white text-sm font-semibold tracking-wide placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Campo PIN */}
                  <div 
                    onClick={() => setFocusedField('pin')}
                    className={`kiosk-input-container ${focusedField === 'pin' ? 'focused' : ''}`}
                  >
                    <label className="text-[10px] font-semibold text-slate-400 block mb-1 tracking-wide">
                      PIN de marcación {focusedField === 'pin' && <span className="text-indigo-400 font-bold">•</span>}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className={`h-4.5 w-4.5 ${focusedField === 'pin' ? 'text-indigo-400' : 'text-slate-500'}`} />
                      </div>
                      <input
                        type="password"
                        placeholder="Ingrese PIN"
                        value={pin}
                        readOnly
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white text-sm font-semibold tracking-widest placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Virtual Kiosk Keypad */}
                  <div className="py-2 border-t border-slate-800/80">
                    <div className="keypad-grid">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => presionarPinPad(num)}
                          disabled={loginLoading}
                          className="keypad-btn"
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={limpiarPinPad}
                        disabled={loginLoading}
                        className="keypad-btn keypad-btn-clear text-xs text-red-400 font-bold"
                      >
                        Limpiar
                      </button>
                      <button
                        type="button"
                        onClick={() => presionarPinPad(0)}
                        disabled={loginLoading}
                        className="keypad-btn"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={borrarPinPad}
                        disabled={loginLoading}
                        className="keypad-btn keypad-btn-delete text-xs text-indigo-400 font-bold"
                      >
                        Borrar
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className={`w-full py-4 mt-2 rounded-xl text-sm font-extrabold tracking-wide uppercase transition-all duration-300 flex items-center justify-center gap-2 border shadow-lg cursor-pointer ${
                      loginLoading 
                        ? 'bg-indigo-900/50 border-indigo-700/30 text-indigo-300 cursor-wait' 
                        : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500/40 text-white shadow-indigo-600/20 active:scale-[0.98]'
                    }`}
                  >
                    {loginLoading ? (
                      <>
                        <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                        Autenticando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        Continuar
                      </>
                    )}
                  </button>

                </form>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            PANTALLA 2: SELECCIÓN DE SEDE (PANTALLA LIMPIA)
            ========================================== */}
        {currentScreen === 'SEDE_SELECT' && (
          <div className="max-w-4xl mx-auto w-full flex flex-col gap-6 animate-scale-in">
            <div className="text-center max-w-xl mx-auto">
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/25 font-semibold tracking-wide">
                Paso 2 · Seleccionar clínica
              </span>
              <h3 className="text-2xl font-extrabold text-white mt-3">¿Dónde se encuentra hoy?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Hola <strong className="text-slate-200">{currentUser?.nombre}</strong>, seleccione la clínica donde labora hoy.
              </p>
            </div>

            {/* Sede Grid Cards */}
            <div className="sede-grid">
              {sedes.length > 0 ? (
                sedes.map((s) => {
                  let desc = "Miraflores, Lima";
                  let colorClass = "from-indigo-500 to-blue-500 shadow-indigo-500/20";
                  
                  if (s.nombre.toLowerCase().includes('guardia')) {
                    desc = "San Borja, Lima";
                    colorClass = "from-teal-500 to-emerald-500 shadow-teal-500/20";
                  } else if (s.nombre.toLowerCase().includes('chiclayo')) {
                    desc = "Chiclayo, Lambayeque";
                    colorClass = "from-pink-500 to-rose-500 shadow-pink-500/20";
                  }
                  
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSedeSelect(s.id.toString())}
                      className="sede-card"
                    >
                      <div className={`h-14 w-14 rounded-2xl bg-gradient-to-tr ${colorClass} flex items-center justify-center text-white mb-2 shadow-lg`}>
                        {s.nombre.toLowerCase().includes('chiclayo') ? <MapPin className="h-6 w-6" /> : <Compass className="h-6 w-6" />}
                      </div>
                      <h4 className="text-sm font-bold text-white m-0">{s.nombre}</h4>
                      <p className="text-[10px] text-slate-400 m-0">{desc}</p>

                    </div>
                  );
                })
              ) : (
                <div className="col-span-3 text-center py-8 text-slate-400 font-medium">
                  Cargando clínicas...
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            PANTALLA 3: ACTIVACIÓN DE CÁMARA Y GEOLOCALIZACIÓN
            ========================================== */}
        {currentScreen === 'CAPTURE' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto w-full items-center">
            
            {/* Columna Izquierda: Cámara Frontal de Biometría */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="glass-panel p-5 relative">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-semibold text-slate-400 tracking-wide">
                    Paso 3 · Foto de registro
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/25 font-semibold tracking-wide">
                    Cámara
                  </span>
                </div>

                <div className="camera-container relative overflow-hidden bg-slate-950 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover scale-x-[-1] ${!cameraActive ? 'hidden' : ''}`}
                  />
                  {cameraActive ? (
                    <>
                      <div className="scanning-ring"></div>
                      
                      {/* Retícula militar de biometría */}
                      <div className="reticle-corner reticle-tl"></div>
                      <div className="reticle-corner reticle-tr"></div>
                      <div className="reticle-corner reticle-bl"></div>
                      <div className="reticle-corner reticle-br"></div>
                      
                      <div className="absolute bottom-4 left-4 bg-slate-950/80 backdrop-filter backdrop-blur-md px-3 py-1.5 rounded-lg border border-indigo-500/20 text-[10px] text-indigo-300 font-bold tracking-wider flex items-center gap-1.5 z-20">
                        <Activity className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                        CÁMARA LISTA
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-8 flex flex-col items-center gap-3">
                      <div className="h-14 w-14 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                        <Camera className="h-6 w-6 text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-300">Cámara Inactiva</p>
                        <p className="text-xs text-slate-500 mt-1">Conectando dispositivo de captura...</p>
                      </div>
                      <button 
                        onClick={iniciarCamara}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                      >
                        Iniciar Cámara
                      </button>
                    </div>
                  )}
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>

            {/* Columna Derecha: Confirmación de Marcado */}
            <div className="lg:col-span-5">
              <div className="glass-panel p-6 glass-panel-primary flex flex-col gap-4 justify-between min-h-[380px]">
                <div>
                  <div className="text-center pb-2 border-b border-slate-800">
                    <h3 className="text-base font-bold text-white tracking-wide m-0">Confirmar Marcación</h3>
                    <p className="text-xs text-slate-400 mt-1">Revise sus datos antes de marcar</p>
                  </div>

                  {/* Caja de Datos */}
                  <div className="bg-slate-950/60 rounded-xl border border-slate-850 p-4 mt-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                      <span className="text-[10px] font-semibold text-slate-500">Nombre</span>
                      <span className="text-xs font-extrabold text-slate-200">{currentUser?.nombre}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                      <span className="text-[10px] font-semibold text-slate-500">DNI</span>
                      <span className="text-xs font-mono text-slate-200">{currentUser?.dni}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-semibold text-slate-500">Sede</span>
                      <span className="text-xs font-extrabold text-indigo-400">
                        <Building2 className="h-3.5 w-3.5 inline-flex" style={{verticalAlign: 'text-bottom', marginRight: '4px'}} />{sedes.find(s => s.id.toString() === activeSedeId)?.nombre || 'Sede'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 bg-indigo-950/10 border border-indigo-500/10 p-3 rounded-lg text-[10px] text-indigo-300/90 font-medium leading-relaxed">
                    <ShieldCheck className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                    Por su seguridad, se registrará su ubicación y una foto de verificación para validar la asistencia.
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {/* Botón para Cambiar de Sede si se equivocó */}
                  <button
                    onClick={() => handleSedeSelect('')}
                    disabled={markingLoading}
                    className="w-full py-2.5 rounded-lg border border-slate-700 bg-transparent text-slate-300 text-xs font-semibold transition-colors hover:bg-slate-800 cursor-pointer"
                  >
                    Cambiar Sede
                  </button>

                  {/* Botón Principal para Marcar */}
                  <button
                    onClick={procesarMarcado}
                    disabled={markingLoading}
                    className={`w-full py-4 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 border shadow-lg cursor-pointer ${
                      markingLoading 
                        ? 'bg-emerald-900/50 border-emerald-700/30 text-emerald-300 cursor-wait' 
                        : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500/40 text-white shadow-emerald-600/20 active:scale-[0.98]'
                    }`}
                  >
                    {markingLoading ? (
                      <>
                        <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        Confirmar Registro
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ==========================================
            PANTALLA 4: PANTALLA VERDE GIGANTE DE ÉXITO (AUTO-LOGOUT)
            ========================================== */}
        {currentScreen === 'SUCCESS' && successMessage && (
          <div className="success-screen-overlay">
            <div className="success-card animate-scale-in">
              
              <div className="success-header-badge">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Registro Confirmado
              </div>

              <div className="h-20 w-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 animate-bounce" />
              </div>

              <h2 className="text-3xl font-black text-emerald-300 uppercase tracking-wide mb-1 glow-text-success">
                ¡{successMessage.tipo} Registrada!
              </h2>
              <p className="text-slate-300 text-xs font-semibold mb-6">Su hora de ingreso/salida se guardó con éxito.</p>

              {/* Ficha de Asistencia */}
              <div className="bg-slate-950/65 rounded-2xl border border-emerald-500/20 p-5 mb-8 text-left grid grid-cols-2 gap-4">
                <div className="col-span-2 border-b border-emerald-950/40 pb-2 flex justify-between items-center">
                  <span className="text-[10px] font-semibold text-slate-500 tracking-wide">Colaborador</span>
                  <span className="text-xs font-black text-white">{successMessage.usuario}</span>
                </div>
                <div className="col-span-2 border-b border-emerald-950/40 pb-2 flex justify-between items-center">
                  <span className="text-[10px] font-semibold text-slate-500 tracking-wide">Cargo</span>
                  <span className="text-xs font-bold text-slate-300">{successMessage.rol}</span>
                </div>
                <div className="border-r border-emerald-950/40 pr-2">
                  <span className="text-[10px] font-semibold text-slate-500 block tracking-wide mb-1">Sede</span>
                  <span className="text-xs font-extrabold text-white"><Building2 className="h-3.5 w-3.5 inline-flex" style={{verticalAlign: 'text-bottom', marginRight: '4px'}} />{successMessage.sede}</span>
                </div>
                <div className="pl-2">
                  <span className="text-[10px] font-semibold text-slate-500 block tracking-wide mb-1">Hora</span>
                  <span className="text-xs font-extrabold text-indigo-300"><Clock className="h-3.5 w-3.5 inline-flex" style={{verticalAlign: 'text-bottom', marginRight: '4px'}} />{successMessage.hora}</span>
                </div>
                <div className="col-span-2 border-t border-emerald-950/40 pt-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block tracking-wide">Estado de ubicación</span>
                    <span className={`text-[11px] font-bold ${successMessage.fueraDeRango ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {successMessage.fueraDeRango ? 'Fuera de Sede' : 'En Sede (Área Autorizada)'}
                    </span>
                  </div>
                  {successMessage.fueraDeRango && (
                    <div className="bg-amber-500/10 text-amber-400 rounded-lg p-1 border border-amber-500/20 text-[9px] font-semibold tracking-wide">
                      Ubicación Inexacta
                    </div>
                  )}
                </div>
              </div>

               {/* Reloj de cuenta regresiva */}
              <div className="text-xs text-slate-400 font-bold mb-4">
                El sistema volverá al inicio en <span className="text-emerald-400 font-mono text-sm">{countdown}</span> segundos...
              </div>

              {/* Botón manual para saltar espera */}
              <button
                onClick={finalizarYLimpiarSesion}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold tracking-wide shadow-lg shadow-emerald-600/10 cursor-pointer active:scale-[0.98] transition-all"
              >
                Listo
              </button>
            </div>
          </div>
        )}

        {/* ==========================================
            MODO ADMINISTRADOR (LOGIN)
            ========================================== */}
        {currentScreen === 'ADMIN_LOGIN' && (
          <div className="max-w-md mx-auto w-full">
            <form onSubmit={handleAdminLogin} className="glass-panel p-8 flex flex-col gap-5 border-indigo-500/30">
              <div className="text-center">
                <Settings className="h-10 w-10 text-indigo-400 mx-auto mb-3 animate-spin-slow" />
                <h3 className="text-xl font-extrabold text-white">Dashboard Administrativo</h3>
                <p className="text-xs text-slate-400 mt-1">Verificación obligatoria de credenciales</p>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">DNI del Administrador</label>
                  <input
                    type="text"
                    value={adminDni}
                    onChange={(e) => setAdminDni(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ingrese DNI"
                    maxLength={8}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">PIN de Seguridad</label>
                  <input
                    type="password"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ingrese PIN"
                    maxLength={6}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase cursor-pointer transition-colors shadow-lg shadow-indigo-600/20"
              >
                Ingresar al Dashboard
              </button>
            </form>
          </div>
        )}

        {/* ==========================================
            DASHBOARD ADMINISTRATIVO COMPLETO (ACCESO PERMITIDO)
            ========================================== */}
        {currentScreen === 'ADMIN_DASHBOARD' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full animate-fade-in">
            
            {/* Columna Izquierda: Alta Usuarios y Panel de Control */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Tarjeta Métricas */}
              <div className="glass-panel p-5 grid grid-cols-2 gap-4">
                <div className="col-span-2 border-b border-slate-800 pb-3 flex justify-between items-center">
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider m-0">Panel de Control</h4>
                  <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2.5 py-0.5 rounded-full border border-indigo-500/20 font-bold uppercase tracking-wider">Conectado</span>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Registros hoy</span>
                  <span className="text-xl font-black text-white">{historial.length}</span>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Total Clínicas</span>
                  <span className="text-xl font-black text-white">{sedes.length}</span>
                </div>
              </div>

              {/* Registro de Nuevos Colaboradores */}
              <div className="glass-panel p-6 border-indigo-500/20">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
                  <PlusCircle className="h-5 w-5 text-indigo-400" />
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider m-0">Alta de Médicos / Personal</h4>
                </div>

                {adminSuccessMsg && (
                  <div className="bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 p-3 rounded-lg text-xs font-semibold mb-4">
                    {adminSuccessMsg}
                  </div>
                )}

                <form onSubmit={registrarNuevoUsuario} className="flex flex-col gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Nombre Completo</label>
                    <input
                      type="text"
                      placeholder="Ej: Dr. Alejandro Ruiz"
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">DNI (Usuario)</label>
                      <input
                        type="text"
                        placeholder="Ej: 45454545"
                        maxLength={8}
                        value={nuevoDni}
                        onChange={(e) => setNuevoDni(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">PIN Marcación</label>
                      <input
                        type="password"
                        placeholder="4 a 6 dígitos"
                        maxLength={6}
                        value={nuevoPin}
                        onChange={(e) => setNuevoPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Rol Administrativo</label>
                    <select
                      value={nuevoRol}
                      onChange={(e) => setNuevoRol(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="PERSONAL">PERSONAL ASISTENCIAL / ADMINISTRATIVO</option>
                      <option value="MEDICO_INDEPENDIENTE">MÉDICO INDEPENDIENTE</option>
                      <option value="ADMIN">ADMINISTRADOR DEL SISTEMA</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold uppercase transition-colors cursor-pointer"
                  >
                    Crear y Activar Colaborador
                  </button>
                </form>
              </div>
            </div>

            {/* Columna Derecha: Historial y Descargas de Reportes (Excel / PDF) */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="glass-panel p-5 flex flex-col gap-4">
                
                {/* Filtros e Historial */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-indigo-400" />
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider m-0">Historial General de Asistencias</h3>
                  </div>

                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {/* Filtro Rango */}
                    <select
                      value={rangoHistorial}
                      onChange={(e) => setRangoHistorial(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="hoy">Hoy</option>
                      <option value="semana">Esta Semana</option>
                      <option value="mes">Este Mes</option>
                    </select>

                    {/* Filtro Sede */}
                    <select
                      value={filtroSede}
                      onChange={(e) => setFiltroSede(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="">Todas las Sedes</option>
                      {sedes.map((s) => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Acciones de Exportación de Reportes (Excel / PDF) */}
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
                  <div className="text-center sm:text-left">
                    <h4 className="text-xs font-bold text-white m-0">Exportaciones para auditoría</h4>
                    <p className="text-[10px] text-slate-500 m-0 mt-0.5">Reportes en tiempo real optimizados</p>
                  </div>
                  
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={exportarExcel}
                      className="btn-export btn-excel"
                      title="Descargar Reporte Excel"
                    >
                      <FileSpreadsheet className="h-4 w-4" /> Excel
                    </button>
                    <button
                      onClick={exportarPDF}
                      className="btn-export btn-pdf"
                      title="Descargar Reporte PDF"
                    >
                      <FileDown className="h-4 w-4" /> PDF SUNAFIL
                    </button>
                  </div>
                </div>

                {/* Buscador de Colaboradores */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por Nombre, DNI o Rol..."
                    value={filtroTexto}
                    onChange={(e) => setFiltroTexto(e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-xl py-2.5 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Tabla de Resultados */}
                <div className="admin-table-wrapper overflow-x-auto w-full border border-slate-800/80 rounded-xl bg-slate-950/40">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold text-[10px] tracking-wide">
                        <th className="p-3">Colaborador / DNI</th>
                        <th className="p-3">Sede Clínica</th>
                        <th className="p-3">Marcado</th>
                        <th className="p-3">Fecha y Hora (Lim)</th>
                        <th className="p-3">Distancia GPS</th>
                        <th className="p-3 text-center">Foto y Mapa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {historialLoading ? (
                        Array.from({ length: 5 }).map((_, idx) => (
                          <tr key={idx} className="animate-pulse">
                            <td className="p-3">
                              <div className="skeleton skeleton-text w-32 h-4 mb-2"></div>
                              <div className="skeleton skeleton-text w-20 h-3"></div>
                            </td>
                            <td className="p-3">
                              <div className="skeleton skeleton-text w-24 h-4"></div>
                            </td>
                            <td className="p-3">
                              <div className="skeleton skeleton-text w-16 h-5 rounded-full"></div>
                            </td>
                            <td className="p-3">
                              <div className="skeleton skeleton-text w-20 h-4 mb-1"></div>
                              <div className="skeleton skeleton-text w-12 h-3"></div>
                            </td>
                            <td className="p-3">
                              <div className="skeleton skeleton-text w-16 h-4"></div>
                            </td>
                            <td className="p-3">
                              <div className="flex justify-center gap-2">
                                <div className="skeleton w-12 h-6 rounded"></div>
                                <div className="skeleton w-12 h-6 rounded"></div>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : historialFiltrado.length > 0 ? (
                        historialFiltrado.map((m) => {
                          const timeStr = new Date(m.fecha_hora).toLocaleTimeString('es-PE', { hour12: false });
                          const dateStr = new Date(m.fecha_hora).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' });
                          const distFloat = parseFloat(m.distancia_metros);
                          const fuera = distFloat > parseInt(m.sede_radio, 10);
                          
                          let rolBadgeClass = 'badge-personal';
                          if (m.usuario_rol === 'ADMIN') rolBadgeClass = 'badge-admin';
                          else if (m.usuario_rol === 'MEDICO_INDEPENDIENTE') rolBadgeClass = 'badge-medico';

                          return (
                            <tr key={m.id} className="hover:bg-slate-900/40 transition-colors">
                              <td className="p-3">
                                <div className="font-bold text-white">{m.usuario_nombre}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                                  <span>{m.usuario_dni}</span>
                                  <span className={`badge ${rolBadgeClass} scale-75 origin-left py-px`}>{m.usuario_rol}</span>
                                </div>
                              </td>
                              <td className="p-3 text-slate-300 font-medium"><Building2 className="h-3.5 w-3.5 inline-flex" style={{verticalAlign: 'text-bottom', marginRight: '4px'}} />{m.sede_nombre}</td>
                              <td className="p-3">
                                <span className={`badge ${m.tipo_marcado === 'ENTRADA' ? 'badge-entrada' : 'badge-salida'}`}>
                                  {m.tipo_marcado}
                                </span>
                              </td>
                              <td className="p-3 text-slate-300 font-mono">
                                <div>{dateStr}</div>
                                <div className="text-indigo-300 font-bold mt-0.5">{timeStr}</div>
                              </td>
                              <td className="p-3">
                                <div className={`font-bold ${fuera ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {Math.round(distFloat)} m
                                </div>
                                <div className="text-[9px] text-slate-500 mt-0.5">
                                  {fuera ? 'Fuera de rango' : 'Rango óptimo'}
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex justify-center items-center gap-2">
                                  <button
                                    onClick={() => setSelectedPhoto(`${STORAGE_BASE}${m.foto_path}`)}
                                    className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/20 cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                                    title="Ver captura de webcam"
                                  >
                                    <Eye className="h-3.5 w-3.5" /> Foto
                                  </button>

                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${m.latitud_marcado},${m.longitud_marcado}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                                    title="Ver coordenadas en Google Maps"
                                  >
                                    <Map className="h-3.5 w-3.5 text-slate-400" /> Mapa
                                  </a>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                            No se encontraron registros de marcaciones en este período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* --- LIGHTBOX MODAL PARA VER FOTO --- */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
          <div className="relative glass-panel p-2 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-10 right-0 p-1.5 bg-slate-900 border border-slate-700 rounded-full text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={selectedPhoto}
              alt="Verificación Biométrica"
              className="w-full h-auto rounded-xl object-contain border border-slate-800"
            />
            <div className="text-center py-2 text-xs text-slate-400 font-semibold tracking-wide">
              Fotografía de Marcación - Servidor de Archivos Local
            </div>
          </div>
        </div>
      )}

      {/* --- FOOTER INFERIOR --- */}
      <footer className="text-center py-4 border-t border-slate-900 mt-8">
        <p className="text-[9px] text-slate-500 m-0 font-medium tracking-wide">
          Anesthesia Healthcare &copy; 2026 · Control de Asistencia
        </p>
      </footer>

    </div>
  );
}

export default App;
