// === FASE 5: GRÁFICOS EN DASHBOARD DEL ESTUDIANTE ===
// Archivo: js/dashboard-charts.js

class DashboardCharts {
    constructor(userId) {
        this.userId = userId;
        this.charts = {};
    }

    // === CARGAR DATOS HISTÓRICOS DESDE SUPABASE ===
    async loadMlcHistoricalData() {
        console.log('📊 Cargando datos históricos de MLC...');
        
        const { data, error } = await supabase
            .from('resultados_mlc')
            .select(`
                palabras_por_minuto,
                porcentaje_comprension,
                velocidad_efectiva,
                session_date,
                lecturas(titulo, autor)
            `)
            .eq('estudiante_id', this.userId)
            .order('session_date', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    // === CREAR GRÁFICO DE WPM HISTÓRICO ===
    async createWpmChart() {
        const data = await this.loadMlcHistoricalData();
        
        if (data.length === 0) {
            this.showNoDataMessage('chartWPM');
            return;
        }

        const labels = data.map(item => this.formatDate(item.session_date));
        const wpmData = data.map(item => item.palabras_por_minuto);

        const ctx = document.getElementById('chartWPM');
        this.charts.wpm = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Palabras por Minuto',
                    data: wpmData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Progreso de Velocidad de Lectura'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'WPM'
                        }
                    }
                }
            }
        });

        console.log('✅ Gráfico WPM creado con', data.length, 'puntos de datos');
    }

    // === CREAR GRÁFICO DE COMPRENSIÓN ===
    async createComprehensionChart() {
        const data = await this.loadMlcHistoricalData();
        
        const labels = data.map(item => this.formatDate(item.session_date));
        const comprehensionData = data.map(item => item.porcentaje_comprension);

        const ctx = document.getElementById('chartComprension');
        this.charts.comprehension = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Comprensión (%)',
                    data: comprehensionData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Progreso de Comprensión Lectora'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Porcentaje (%)'
                        }
                    }
                }
            }
        });
    }

    // === CREAR GRÁFICO DE VELOCIDAD EFECTIVA ===
    async createEffectiveSpeedChart() {
        const data = await this.loadMlcHistoricalData();
        
        const labels = data.map(item => this.formatDate(item.session_date));
        const effectiveSpeedData = data.map(item => item.velocidad_efectiva);

        const ctx = document.getElementById('chartVelocidadEfectiva');
        this.charts.effectiveSpeed = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Velocidad Efectiva',
                    data: effectiveSpeedData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Progreso de Velocidad Efectiva'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Velocidad Efectiva'
                        }
                    }
                }
            }
        });
    }

    // === CREAR GRÁFICO COMPARATIVO (TODAS LAS MÉTRICAS) ===
    async createCombinedChart() {
        const data = await this.loadMlcHistoricalData();
        
        const labels = data.map(item => this.formatDate(item.session_date));

        const ctx = document.getElementById('chartCombined');
        this.charts.combined = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'WPM',
                        data: data.map(item => item.palabras_por_minuto),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        yAxisID: 'y'
                    },
                    {
                        label: 'Comprensión (%)',
                        data: data.map(item => item.porcentaje_comprension),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Velocidad Efectiva',
                        data: data.map(item => item.velocidad_efectiva),
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        max: 100,
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });
    }

    // === CALCULAR RANKING POR GRADO ===
    async calculateGradeRanking() {
        console.log('🏆 Calculando ranking por grado...');
        
        // Obtener grado del estudiante
        const { data: userData } = await supabase
            .from('usuarios')
            .select('grupos(grado)')
            .eq('id', this.userId)
            .single();

        const grado = userData?.grupos?.grado || 5;

        // Obtener últimos resultados de estudiantes del mismo grado
        const { data: rankings, error } = await supabase
            .from('resultados_mlc')
            .select(`
                estudiante_id,
                palabras_por_minuto,
                velocidad_efectiva,
                usuarios(nombres, apellidos, instituciones(nombre))
            `)
            .eq('usuarios.grupos.grado', grado)
            .order('velocidad_efectiva', { ascending: false })
            .limit(10);

        if (error) throw error;

        this.displayRanking(rankings);
    }

    displayRanking(rankings) {
        const container = document.getElementById('rankingContainer');
        if (!container) return;

        const rankingHTML = rankings.map((item, index) => `
            <div class="ranking-item ${item.estudiante_id === this.userId ? 'current-user' : ''}">
                <div class="rank-position">${index + 1}</div>
                <div class="rank-info">
                    <div class="rank-name">${item.usuarios.nombres} ${item.usuarios.apellidos}</div>
                    <div class="rank-institution">${item.usuarios.instituciones.nombre}</div>
                </div>
                <div class="rank-metrics">
                    <div class="rank-wpm">${item.palabras_por_minuto.toFixed(1)} WPM</div>
                    <div class="rank-effective">${item.velocidad_efectiva.toFixed(1)} VE</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <h3>🏆 Top 10 - Tu Grado</h3>
            <div class="ranking-list">
                ${rankingHTML}
            </div>
        `;
    }

    // === MOSTRAR ÚLTIMO RESULTADO ===
    async displayLastResults() {
        const data = await this.loadMlcHistoricalData();
        
        if (data.length === 0) {
            document.getElementById('lastMlcResults').innerHTML = 
                '<div class="no-results">No hay resultados recientes</div>';
            return;
        }

        const lastResult = data[data.length - 1];
        
        document.getElementById('lastMlcResults').innerHTML = `
            <div style="margin-bottom: 0.5rem;">
                <strong>${lastResult.lecturas.titulo}</strong>
            </div>
            <div style="display: flex; gap: 1rem; font-size: 0.875rem; flex-wrap: wrap;">
                <span>WPM: ${lastResult.palabras_por_minuto.toFixed(1)}</span>
                <span>Comprensión: ${lastResult.porcentaje_comprension.toFixed(1)}%</span>
                <span>V. Efectiva: ${lastResult.velocidad_efectiva.toFixed(1)}</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--gray-600); margin-top: 0.5rem;">
                ${this.formatDate(lastResult.session_date)}
            </div>
        `;
    }

    // === INICIALIZAR TODOS LOS GRÁFICOS ===
    async initAllCharts() {
        console.log('📊 Inicializando todos los gráficos del dashboard...');
        
        try {
            await Promise.all([
                this.createWpmChart(),
                this.createComprehensionChart(),
                this.createEffectiveSpeedChart(),
                this.displayLastResults(),
                this.calculateGradeRanking()
            ]);
            
            console.log('✅ Todos los gráficos inicializados correctamente');
        } catch (error) {
            console.error('❌ Error inicializando gráficos:', error);
            this.showErrorMessage();
        }
    }

    // === UTILIDADES ===
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('es-CO', {
            month: 'short',
            day: 'numeric'
        });
    }

    showNoDataMessage(chartId) {
        const canvas = document.getElementById(chartId);
        if (canvas) {
            canvas.style.display = 'none';
            const container = canvas.parentElement;
            container.innerHTML += '<p style="text-align: center; color: #6b7280;">No hay datos históricos</p>';
        }
    }

    showErrorMessage() {
        console.log('⚠️ Mostrando mensaje de error en gráficos');
    }

    // === ACTUALIZAR GRÁFICOS DESPUÉS DE NUEVA SESIÓN ===
    async refreshChartsAfterSession() {
        console.log('🔄 Actualizando gráficos después de nueva sesión...');
        
        // Destruir gráficos existentes
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        
        this.charts = {};
        
        // Recrear gráficos con datos actualizados
        await this.initAllCharts();
    }
}

// === INTEGRACIÓN CON DASHBOARD EXISTENTE ===
// Agregar a js/dashboard-estudiante.js:

async function loadProgressCharts() {
    console.log('📊 Cargando gráficos de progreso - FASE 5...');
    
    // Inicializar sistema de gráficos
    const chartManager = new DashboardCharts(this.user.id);
    await chartManager.initAllCharts();
    
    // Guardar referencia para actualizaciones futuras
    this.chartManager = chartManager;
}

// === EXPORTAR PARA USO GLOBAL ===
if (typeof window !== 'undefined') {
    window.DashboardCharts = DashboardCharts;
}