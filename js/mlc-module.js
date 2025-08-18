// === TSP v2.0 - MÓDULO MLC (LECTURA CRÍTICA) ===
// Archivo: js/mlc-module.js

console.log('📚 Inicializando Módulo de Lectura Crítica TSP v2.0...');

// === CONFIGURACIÓN SUPABASE ===
const SUPABASE_CONFIG = {
    url: 'https://kryqjsncqsopjuwymhqd.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeXFqc25jcXNvcGp1d3ltaHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMjM3MDEsImV4cCI6MjA2ODg5OTcwMX0.w5HiaFiqlFJ_3QbcprUrufsOXTDWFg1zUMl2J7kWD6Y'
};

// Inicializar Supabase si está disponible
let supabase = null;
if (typeof window !== 'undefined' && window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    console.log('✅ Cliente Supabase inicializado');
} else {
    console.warn('⚠️ Librería Supabase no encontrada, usando modo desarrollo');
}

// === CLASE PRINCIPAL DEL MÓDULO MLC ===
class MlcModule {
    constructor() {
        this.currentUser = null;
        this.currentLecture = null;
        this.currentStep = 1;
        this.startTime = null;
        this.endTime = null;
        this.timer = null;
        this.stepStates = {
            vocabulary: 'pending',     // pending, active, completed
            testVocabulary: 'pending',
            reading: 'pending',
            comprehension: 'pending'
        };
        
        console.log('🎯 Módulo MLC inicializado');
    }

    // === INICIALIZACIÓN ===
    async init() {
        try {
            console.log('🚀 Iniciando módulo MLC...');
            
            // Cargar usuario de la sesión
            this.currentUser = this.getUserFromSession();
            
            if (!this.currentUser) {
                console.warn('⚠️ No hay usuario en sesión');
                this.redirectToDashboard();
                return;
            }

            // Actualizar información del usuario en la interfaz
            this.updateUserInfo();
            
            // Cargar datos de la lectura asignada
            await this.loadAssignedLecture();
            
            // Inicializar el primer paso
            this.goToStep(1);
            
            // Inicializar timer
            this.initTimer();
            
            console.log('✅ Módulo MLC inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando módulo MLC:', error);
            this.showError('Error al cargar el módulo de lectura crítica');
        }
    }

    // === GESTIÓN DE USUARIO ===
    getUserFromSession() {
        // Intentar obtener datos del usuario desde sessionStorage
        const userData = sessionStorage.getItem('tsp_user');
        if (userData) {
            try {
                return JSON.parse(userData);
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        }
        
        // Datos de prueba para desarrollo
        console.log('🧪 Usando datos de prueba para desarrollo');
        return {
            id: 'user123',
            codigo_estudiante: 'E001002',
            nombres: 'Juan Carlos',
            apellidos: 'Pérez González',
            grado: 5
        };
    }

    updateUserInfo() {
        const studentNameEl = document.getElementById('studentName');
        if (studentNameEl && this.currentUser) {
            studentNameEl.textContent = `${this.currentUser.nombres} ${this.currentUser.apellidos}`;
        }
    }

    // === CARGA DE DATOS ===
    async loadAssignedLecture() {
        console.log('📖 Cargando lectura asignada...');
        
        try {
            if (supabase) {
                // Intentar cargar desde Supabase
                const { data, error } = await supabase
                    .from('lecturas')
                    .select('*')
                    .eq('activo', true)
                    .gte('grado_minimo', this.currentUser.grado - 1)
                    .lte('grado_maximo', this.currentUser.grado + 1)
                    .limit(1);

                if (error) throw error;

                if (data && data.length > 0) {
                    this.currentLecture = data[0];
                    console.log('✅ Lectura cargada desde Supabase:', this.currentLecture.titulo);
                    return;
                }
            }
            
            // Fallback: datos de ejemplo
            this.currentLecture = {
                id: 'lectura-ejemplo',
                titulo: 'El Principito - Capítulo 1',
                autor: 'Antoine de Saint-Exupéry',
                palabras: 450,
                grado_minimo: 4,
                grado_maximo: 6,
                vocabulario: {
                    items: [
                        {
                            indice: 1,
                            termino: 'aviador',
                            definicion: 'Persona que pilota una aeronave',
                            pregunta: '¿Qué es un aviador?',
                            opciones: {
                                A: 'Persona que pilota una aeronave',
                                B: 'Persona que repara aviones',
                                C: 'Pasajero de un avión',
                                D: 'Controlador de tráfico aéreo'
                            },
                            respuesta_correcta: 'A'
                        }
                        // Se completará en FASE 2
                    ]
                },
                preguntas_tc: {
                    preguntas: [
                        {
                            indice: 1,
                            pregunta: '¿Qué dibujó el narrador cuando tenía seis años?',
                            opciones: {
                                A: 'Una serpiente boa',
                                B: 'Un elefante',
                                C: 'Un sombrero',
                                D: 'Una casa'
                            },
                            respuesta_correcta: 'A',
                            orientacion: 'Busca en el texto la primera experiencia artística del narrador.',
                            retroalimentacion: 'El narrador dibujó una serpiente boa que se había tragado un elefante.'
                        }
                        // Se completará en FASE 4
                    ]
                }
            };
            
            console.log('🧪 Usando lectura de ejemplo para desarrollo');
            
        } catch (error) {
            console.error('❌ Error cargando lectura:', error);
            this.showError('Error al cargar la lectura asignada');
        }
    }

    // === NAVEGACIÓN ENTRE PASOS ===
    goToStep(stepNumber) {
        console.log(`📍 Navegando al paso ${stepNumber}`);
        
        // Validar rango de pasos
        if (stepNumber < 1 || stepNumber > 4) {
            console.error('❌ Número de paso inválido:', stepNumber);
            return;
        }

        // Actualizar paso actual
        this.currentStep = stepNumber;
        
        // Ocultar todas las secciones
        const sections = document.querySelectorAll('.step-section');
        sections.forEach(section => {
            section.classList.remove('active');
        });
        
        // Mostrar la sección correspondiente
        const sectionIds = [
            '',
            'vocabularySection',
            'testVocabularySection', 
            'readingSection',
            'comprehensionSection'
        ];
        
        const targetSection = document.getElementById(sectionIds[stepNumber]);
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        // Actualizar barra de progreso
        this.updateProgress();
        
        // Ejecutar acciones específicas del paso
        this.executeStepActions(stepNumber);
    }

    executeStepActions(stepNumber) {
        switch(stepNumber) {
            case 1:
                console.log('📖 Activando estudio de vocabulario');
                this.stepStates.vocabulary = 'active';
                break;
            case 2:
                console.log('📝 Activando test de vocabulario');
                this.stepStates.testVocabulary = 'active';
                break;
            case 3:
                console.log('⏱️ Activando lectura con cronómetro');
                this.stepStates.reading = 'active';
                this.startTimer();
                break;
            case 4:
                console.log('🧠 Activando test de comprensión');
                this.stepStates.comprehension = 'active';
                this.stopTimer();
                break;
        }
        
        this.updateStepIndicators();
    }

    // === ACTUALIZACIÓN DE INTERFAZ ===
    updateProgress() {
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            const percentage = (this.currentStep / 4) * 100;
            progressFill.style.width = `${percentage}%`;
        }
    }

    updateStepIndicators() {
        for (let i = 1; i <= 4; i++) {
            const stepEl = document.getElementById(`step${i}Progress`);
            if (stepEl) {
                stepEl.classList.remove('active', 'completed');
                
                if (i < this.currentStep) {
                    stepEl.classList.add('completed');
                } else if (i === this.currentStep) {
                    stepEl.classList.add('active');
                }
            }
        }
    }

    // === CRONÓMETRO ===
    initTimer() {
        this.startTime = null;
        this.endTime = null;
        this.updateTimerDisplay('00:00:00');
    }

    startTimer() {
        if (!this.startTime) {
            this.startTime = Date.now();
            console.log('⏱️ Cronómetro iniciado');
            
            this.timer = setInterval(() => {
                this.updateTimerDisplay();
            }, 1000);
        }
    }

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.endTime = Date.now();
            console.log('⏹️ Cronómetro detenido');
            
            const elapsedMs = this.endTime - this.startTime;
            console.log(`📊 Tiempo de lectura: ${elapsedMs}ms`);
        }
    }

    updateTimerDisplay(timeString = null) {
        const timerEl = document.getElementById('timerDisplay');
        if (timerEl) {
            if (timeString) {
                timerEl.textContent = timeString;
            } else if (this.startTime) {
                const elapsedMs = Date.now() - this.startTime;
                const formatted = this.formatTime(elapsedMs);
                timerEl.textContent = formatted;
            }
        }
    }

    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // === FINALIZACIÓN ===
    finishMLC() {
        console.log('🎉 Finalizando módulo MLC...');
        
        // Calcular métricas básicas
        const elapsedMs = this.endTime - this.startTime;
        const words = this.currentLecture ? this.currentLecture.palabras : 450;
        const wpm = words > 0 ? (words * 60000) / elapsedMs : 0;
        
        console.log('📊 Métricas calculadas:');
        console.log(`- Tiempo: ${elapsedMs}ms`);
        console.log(`- Palabras: ${words}`);
        console.log(`- WPM: ${wpm.toFixed(1)}`);
        
        // Mostrar mensaje de finalización
        alert(`¡Módulo MLC completado!\n\nTiempo de lectura: ${this.formatTime(elapsedMs)}\nVelocidad: ${wpm.toFixed(1)} WPM\n\n(Los resultados se guardarán en FASE 5)`);
        
        // Regresar al dashboard
        this.redirectToDashboard();
    }

    // === NAVEGACIÓN ===
    redirectToDashboard() {
        console.log('🔄 Redirigiendo al dashboard...');
        window.location.href = 'dashboard-estudiante.html';
    }

    // === UTILIDADES ===
    showError(message) {
        console.error('❌', message);
        alert(`Error: ${message}`);
    }

    showSuccess(message) {
        console.log('✅', message);
        // Implementar toast notification en el futuro
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'America/Bogota'
        });
    }
}

// === FUNCIONES GLOBALES ===

// Instancia global del módulo
let mlcModule = null;

// Función para ir a un paso específico
function goToStep(stepNumber) {
    if (mlcModule) {
        mlcModule.goToStep(stepNumber);
    } else {
        console.error('❌ Módulo MLC no inicializado');
    }
}

// Función para finalizar el módulo
function finishMLC() {
    if (mlcModule) {
        mlcModule.finishMLC();
    } else {
        console.error('❌ Módulo MLC no inicializado');
    }
}

// === INICIALIZACIÓN AUTOMÁTICA ===
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🎓 DOM cargado, inicializando módulo MLC...');
    
    try {
        mlcModule = new MlcModule();
        await mlcModule.init();
    } catch (error) {
        console.error('❌ Error fatal inicializando módulo MLC:', error);
        alert('Error al cargar el módulo. Por favor, intenta nuevamente.');
        
        // Redirigir al dashboard en caso de error crítico
        setTimeout(() => {
            window.location.href = 'dashboard-estudiante.html';
        }, 2000);
    }
});

// === MANEJO DE ERRORES GLOBALES ===
window.addEventListener('error', function(event) {
    console.error('❌ Error global capturado:', event.error);
});

console.log('📚 Módulo MLC cargado exitosamente');

// === EXPORTAR PARA DEBUGGING ===
if (typeof window !== 'undefined') {
    window.mlcModule = mlcModule;
    window.goToStep = goToStep;
    window.finishMLC = finishMLC;
}