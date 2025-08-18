// === TSP v2.0 - DASHBOARD ESTUDIANTE ===
// Archivo: js/dashboard-estudiante.js

class EstudianteDashboard {
    constructor() {
        this.user = null;
        this.currentAssignment = null;
        this.charts = {};
    }

    async init() {
        try {
            // Obtener usuario de la sesión
            this.user = this.getUserFromSession();
            
            if (!this.user) {
                console.warn('No hay usuario en sesión, redirigiendo al login');
                window.location.href = '../index.html';
                return;
            }

            await this.loadUserInfo();
            await this.loadCurrentAssignment();
            await this.loadLastSessionResults();
            await this.loadProgressCharts();
            this.updateDateTime();

            // Actualizar fecha/hora cada minuto
            setInterval(() => this.updateDateTime(), 60000);
            
            console.log('✅ Dashboard del estudiante inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando dashboard:', error);
            this.showError('Error al cargar el dashboard');
        }
    }

    getUserFromSession() {
        // Obtener datos del usuario desde sessionStorage
        const userData = sessionStorage.getItem('userProfile');
        if (userData) {
            return JSON.parse(userData);
        }
        
        // Datos de prueba para desarrollo
        return {
            id: 'e123456789',
            codigo_estudiante: 'E001002',
            nombres: 'Juan Carlos',
            apellidos: 'Pérez González',
            email: 'juan.perez@ejemplo.com',
            grado: 5,
            seccion: 'A',
            institucion: {
                nombre: 'Colegio San José'
            },
            grupo: {
                nombre: '5°A',
                grado: 5
            }
        };
    }

    loadUserInfo() {
        // Actualizar información del usuario en la interfaz
        document.getElementById('welcomeMessage').textContent = 
            `Bienvenido/a ${this.user.nombres} ${this.user.apellidos}`;
        
        document.getElementById('studentCode').textContent = 
            this.user.codigo_estudiante;
        
        document.getElementById('studentGrade').textContent = 
            this.user.grupo ? this.user.grupo.nombre : `${this.user.grado}°${this.user.seccion}`;
        
        document.getElementById('studentInstitution').textContent = 
            this.user.institucion ? this.user.institucion.nombre : 'No asignada';
    }

    async loadCurrentAssignment() {
        try {
            // Consultar asignación actual del estudiante
            const { data, error } = await supabase
                .from('asignaciones_ciclos')
                .select(`
                    *,
                    ciclos (
                        lectura_id,
                        desafio_id,
                        ejercicios_ids,
                        lecturas (titulo, autor),
                        desafios_mentales (titulo)
                    )
                `)
                .eq('estudiante_id', this.user.id)
                .eq('activo', true)
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0) {
                this.currentAssignment = data[0];
                await this.updateModuleStatus();
            } else {
                this.showNoAssignmentMessage();
            }
        } catch (error) {
            console.error('Error cargando asignación:', error);
            // Fallback: mostrar módulos con estado pendiente
            this.updateModuleStatus(true);
        }
    }

    async updateModuleStatus(useFallback = false) {
        if (useFallback || !this.currentAssignment) {
            // Modo de desarrollo: mostrar módulos disponibles
            this.updateModuleUI('mlc', false);
            this.updateModuleUI('mdm', false);
            this.updateModuleUI('med', false);
            return;
        }

        const asignacionId = this.currentAssignment.id;

        // Verificar estado de cada módulo
        const [mlcCompleted, mdmCompleted, medCompleted] = await Promise.all([
            this.checkModuleCompletion('resultados_mlc', asignacionId),
            this.checkModuleCompletion('resultados_mdm', asignacionId),
            this.checkModuleCompletion('resultados_med', asignacionId)
        ]);

        // Actualizar UI
        this.updateModuleUI('mlc', mlcCompleted);
        this.updateModuleUI('mdm', mdmCompleted);
        this.updateModuleUI('med', medCompleted);
    }

    async checkModuleCompletion(table, asignacionId) {
        try {
            const { data, error } = await supabase
                .from(table)
                .select('id')
                .eq('estudiante_id', this.user.id)
                .eq('asignacion_id', asignacionId);

            return !error && data && data.length > 0;
        } catch (error) {
            console.error(`Error verificando completación de ${table}:`, error);
            return false;
        }
    }

    updateModuleUI(module, completed) {
        const statusElement = document.getElementById(`${module}Status`);
        const buttonElement = document.querySelector(`#${module}Module .module-btn`);

        if (completed) {
            statusElement.textContent = 'Completado';
            statusElement.className = 'module-status completed';
            buttonElement.textContent = 'Ver Resultados';
        } else {
            statusElement.textContent = 'Pendiente';
            statusElement.className = 'module-status pending';
            buttonElement.textContent = 'Iniciar';
        }
    }

    showNoAssignmentMessage() {
        const modulesGrid = document.querySelector('.modules-grid');
        modulesGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 2rem; background: var(--gray-50); border-radius: var(--radius-xl); border: 2px dashed var(--gray-400);">
                <h3 style="color: var(--gray-600); margin-bottom: 1rem;">No hay ciclo de entrenamiento asignado</h3>
                <p style="color: var(--gray-500);">Contacta a tu docente para que te asigne un ciclo de entrenamiento.</p>
            </div>
        `;
    }

    async loadLastSessionResults() {
        try {
            // Cargar último resultado MLC
            const { data: mlcData } = await supabase
                .from('resultados_mlc')
                .select('*, lecturas(titulo, autor)')
                .eq('estudiante_id', this.user.id)
                .order('created_at', { ascending: false })
                .limit(1);

            if (mlcData && mlcData.length > 0) {
                this.displayLastMlcResult(mlcData[0]);
            }

            // Cargar último resultado MDM
            const { data: mdmData } = await supabase
                .from('resultados_mdm')
                .select('*, desafios_mentales(titulo)')
                .eq('estudiante_id', this.user.id)
                .order('created_at', { ascending: false })
                .limit(1);

            if (mdmData && mdmData.length > 0) {
                this.displayLastMdmResult(mdmData[0]);
            }

            // Cargar último resultado MED
            const { data: medData } = await supabase
                .from('resultados_med')
                .select('*, ejercicios_digitales(nombre)')
                .eq('estudiante_id', this.user.id)
                .order('created_at', { ascending: false })
                .limit(1);

            if (medData && medData.length > 0) {
                this.displayLastMedResult(medData[0]);
            }

        } catch (error) {
            console.error('Error cargando últimos resultados:', error);
            // Mostrar datos de ejemplo en caso de error
            this.showSampleResults();
        }
    }

    displayLastMlcResult(result) {
        const container = document.getElementById('lastMlcResults');
        container.innerHTML = `
            <div style="margin-bottom: 0.5rem;">
                <strong>${result.lecturas.titulo}</strong>
            </div>
            <div style="display: flex; gap: 1rem; font-size: 0.875rem; flex-wrap: wrap;">
                <span>WPM: ${result.palabras_por_minuto.toFixed(1)}</span>
                <span>Comprensión: ${result.porcentaje_comprension.toFixed(1)}%</span>
                <span>V. Efectiva: ${result.velocidad_efectiva.toFixed(1)}</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--gray-600); margin-top: 0.5rem;">
                ${this.formatDate(result.session_date)}
            </div>
        `;
    }

    displayLastMdmResult(result) {
        const container = document.getElementById('lastMdmResults');
        container.innerHTML = `
            <div style="margin-bottom: 0.5rem;">
                <strong>${result.desafios_mentales.titulo}</strong>
            </div>
            <div style="font-size: 0.875rem;">
                <span>Porcentaje Alcanzado: ${result.porcentaje_alcanzado}%</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--gray-600); margin-top: 0.5rem;">
                ${this.formatDate(result.session_date)}
            </div>
        `;
    }

    displayLastMedResult(result) {
        const container = document.getElementById('lastMedResults');
        container.innerHTML = `
            <div style="margin-bottom: 0.5rem;">
                <strong>${result.ejercicios_digitales.nombre}</strong>
            </div>
            <div style="display: flex; gap: 1rem; font-size: 0.875rem;">
                <span>Nivel: ${result.nivel_alcanzado}</span>
                <span>Puntos: ${result.puntos_obtenidos.toLocaleString()}</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--gray-600); margin-top: 0.5rem;">
                ${this.formatDate(result.session_date)}
            </div>
        `;
    }

    showSampleResults() {
        // Datos de ejemplo para desarrollo
        document.getElementById('lastMlcResults').innerHTML = `
            <div style="margin-bottom: 0.5rem;"><strong>El Principito - Cap. 1</strong></div>
            <div style="display: flex; gap: 1rem; font-size: 0.875rem;">
                <span>WPM: 185.2</span>
                <span>Comprensión: 87.5%</span>
                <span>V. Efectiva: 162.1</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--gray-600); margin-top: 0.5rem;">
                Datos de ejemplo
            </div>
        `;

        document.getElementById('lastMdmResults').innerHTML = `
            <div style="margin-bottom: 0.5rem;"><strong>Creatividad Visual</strong></div>
            <div style="font-size: 0.875rem;">
                <span>Porcentaje: 80%</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--gray-600); margin-top: 0.5rem;">
                Datos de ejemplo
            </div>
        `;

        document.getElementById('lastMedResults').innerHTML = `
            <div style="margin-bottom: 0.5rem;"><strong>Memoria Espacial</strong></div>
            <div style="display: flex; gap: 1rem; font-size: 0.875rem;">
                <span>Nivel: 7</span>
                <span>Puntos: 1,250</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--gray-600); margin-top: 0.5rem;">
                Datos de ejemplo
            </div>
        `;
    }

    async loadProgressCharts() {
        // Los gráficos se implementarán en la siguiente fase con Chart.js
        console.log('📊 Gráficos de progreso preparados para Chart.js');
        
        // Por ahora, actualizar placeholders con información
        this.updateChartPlaceholders();
    }

    updateChartPlaceholders() {
        const placeholders = document.querySelectorAll('.chart-placeholder');
        placeholders.forEach(placeholder => {
            placeholder.style.opacity = '0.8';
            placeholder.style.fontStyle = 'italic';
        });
    }

    updateDateTime() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('es-CO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const timeStr = now.toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit'
        });
        document.getElementById('currentDate').textContent = `${dateStr} - ${timeStr}`;
    }

    formatDate(date) {
        if (!date) return '';
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return dateObj.toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'America/Bogota'
        });
    }

    showError(message) {
        console.error(message);
        // Implementar toast notification aquí
        alert(`Error: ${message}`);
    }

    showSuccess(message) {
        console.log(message);
        // Implementar toast notification aquí
    }
}

// === FUNCIONES GLOBALES ===

// === FUNCIÓN OPENMODULE ACTUALIZADA ===
// Reemplazar la función openModule existente en js/dashboard-estudiante.js

function openModule(moduleType) {
    console.log(`🎯 Abriendo módulo: ${moduleType}`);
    
    const urls = {
        'MLC': 'mlc-module.html',
        'MDM': 'mdm-module.html',
        'MED': 'med-module.html'
    };
    
    const url = urls[moduleType];
    
    if (url) {
        // Guardar información del usuario en sessionStorage para el módulo
        if (currentUser) {
            sessionStorage.setItem('tsp_user', JSON.stringify(currentUser));
        }
        
        console.log(`🚀 Redirigiendo a: ${url}`);
        
        // Redirigir al módulo correspondiente
        window.location.href = url;
    } else {
        console.error('❌ Módulo no reconocido:', moduleType);
        alert('Módulo no disponible');
    }
}

function logout() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        // Limpiar datos de sesión
        sessionStorage.clear();
        localStorage.clear();
        
        console.log('🚪 Cerrando sesión...');
        alert('Cerrando sesión...\nRedirigiendo al login');
        
        // En la implementación final:
        // window.location.href = '../index.html';
    }
}

// === INICIALIZACIÓN ===
let estudianteDashboard;

async function initEstudianteDashboard() {
    estudianteDashboard = new EstudianteDashboard();
    await estudianteDashboard.init();
}

// Auto-inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎓 Inicializando Dashboard del Estudiante TSP v2.0...');
    initEstudianteDashboard();
});

// === CONFIGURACIÓN SUPABASE ===
// Nota: Esta configuración debería estar en config.js en la implementación final
const SUPABASE_CONFIG = {
    url: 'https://kryqjsncqsopjuwymhqd.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeXFqc25jcXNvcGp1d3ltaHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMjM3MDEsImV4cCI6MjA2ODg5OTcwMX0.w5HiaFiqlFJ_3QbcprUrufsOXTDWFg1zUMl2J7kWD6Y'
};

// Inicializar cliente Supabase (asumiendo que la librería está cargada)
if (typeof window !== 'undefined' && window.supabase) {
    const supabase = window.supabase.createClient(
        SUPABASE_CONFIG.url,
        SUPABASE_CONFIG.anonKey
    );
    console.log('✅ Cliente Supabase inicializado');
} else {
    console.warn('⚠️ Librería Supabase no encontrada, usando modo de desarrollo');
}

console.log('📁 dashboard-estudiante.js cargado exitosamente');