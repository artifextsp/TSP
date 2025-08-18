// === TSP v2.0 - MÓDULO MLC (LECTURA CRÍTICA) - FASE 2 COMPLETA ===
// Archivo: js/mlc-module.js

console.log('📚 Inicializando Módulo de Lectura Crítica TSP v2.0 - FASE 2...');

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
        
        // Estados de pasos con sistema de guardas
        this.stepStates = {
            vocabulary: 'pending',      // pending, active, completed
            testVocabulary: 'locked',   // locked, pending, active, completed
            reading: 'locked',          // locked, pending, active, completed
            comprehension: 'locked'     // locked, pending, active, completed
        };
        
        // Variables para vocabulario y test
        this.vocabularyData = null;
        this.vocabularyTestData = null;
        this.vocabularyAnswers = {};
        this.shuffleSeed = null;
        
        console.log('🎯 Módulo MLC inicializado - FASE 2');
    }

    // === INICIALIZACIÓN ===
    async init() {
        try {
            console.log('🚀 Iniciando módulo MLC FASE 2...');
            
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
            
            // Generar seed para aleatorización consistente
            this.generateShuffleSeed();
            
            // Cargar vocabulario (FASE 2)
            await this.loadVocabulary();
            
            // Inicializar el primer paso
            this.goToStep(1);
            
            // Inicializar timer
            this.initTimer();
            
            console.log('✅ Módulo MLC FASE 2 inicializado correctamente');
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

    // === SEED PARA ALEATORIZACIÓN CONSISTENTE ===
    generateShuffleSeed() {
        // Seed basado en estudiante_id + fecha del día para reproducibilidad pero no copia entre estudiantes
        const today = new Date().toDateString();
        const seedString = `${this.currentUser.id}_${today}`;
        this.shuffleSeed = this.simpleHash(seedString);
        console.log('🎲 Seed de aleatorización generado:', this.shuffleSeed);
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
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
            
            // Fallback: datos de ejemplo para FASE 2
            this.currentLecture = {
                id: 'lectura-ejemplo-fase2',
                titulo: 'El Coyote y la Tortuga',
                autor: 'Leyenda Hopi',
                palabras: 107,
                grado_minimo: 3,
                grado_maximo: 5,
                vocabulario: {
                    items: [
                        {
                            indice: 1,
                            termino: 'enojamos',
                            definicion: 'Cuando alguien se siente molesto o furioso por algo.',
                            pregunta: '¿Qué significa "enojamos" en el texto?',
                            opciones: {
                                A: 'Nos reímos mucho.',
                                B: 'Nos sentimos felices.',
                                C: 'Nos molestamos o sentimos rabia.',
                                D: 'Nos cansamos de esperar.'
                            },
                            respuesta_correcta: 'C'
                        },
                        {
                            indice: 2,
                            termino: 'río',
                            definicion: 'Corriente de agua que fluye hacia el mar.',
                            pregunta: '¿Qué es un río según el texto?',
                            opciones: {
                                A: 'Una montaña muy alta',
                                B: 'Corriente de agua que fluye hacia el mar',
                                C: 'Un animal que nada',
                                D: 'Una planta acuática'
                            },
                            respuesta_correcta: 'B'
                        },
                        {
                            indice: 3,
                            termino: 'tortuga',
                            definicion: 'Animal con caparazón que se mueve lentamente.',
                            pregunta: '¿Cómo es una tortuga?',
                            opciones: {
                                A: 'Animal con caparazón que se mueve lentamente',
                                B: 'Animal que vuela muy rápido',
                                C: 'Planta que crece en el agua',
                                D: 'Piedra que rueda por el río'
                            },
                            respuesta_correcta: 'A'
                        },
                        {
                            indice: 4,
                            termino: 'coyote',
                            definicion: 'Animal carnívoro parecido al lobo pero más pequeño.',
                            pregunta: '¿Qué tipo de animal es el coyote?',
                            opciones: {
                                A: 'Un pez de río',
                                B: 'Animal carnívoro parecido al lobo pero más pequeño',
                                C: 'Un insecto volador',
                                D: 'Una planta del desierto'
                            },
                            respuesta_correcta: 'B'
                        },
                        {
                            indice: 5,
                            termino: 'rápido',
                            definicion: 'Que se mueve o actúa con mucha velocidad.',
                            pregunta: '¿Qué significa ser rápido?',
                            opciones: {
                                A: 'Moverse muy lentamente',
                                B: 'Estar siempre quieto',
                                C: 'Que se mueve o actúa con mucha velocidad',
                                D: 'Dormir mucho tiempo'
                            },
                            respuesta_correcta: 'C'
                        },
                        {
                            indice: 6,
                            termino: 'lento',
                            definicion: 'Que se mueve o actúa sin prisa, despacio.',
                            pregunta: '¿Cómo se mueve algo lento?',
                            opciones: {
                                A: 'Con mucha velocidad',
                                B: 'Que se mueve o actúa sin prisa, despacio',
                                C: 'Saltando muy alto',
                                D: 'Gritando fuerte'
                            },
                            respuesta_correcta: 'B'
                        },
                        {
                            indice: 7,
                            termino: 'carrera',
                            definicion: 'Competencia para ver quién llega primero.',
                            pregunta: '¿Qué es una carrera?',
                            opciones: {
                                A: 'Una comida deliciosa',
                                B: 'Competencia para ver quién llega primero',
                                C: 'Un lugar para dormir',
                                D: 'Una herramienta de trabajo'
                            },
                            respuesta_correcta: 'B'
                        },
                        {
                            indice: 8,
                            termino: 'ganar',
                            definicion: 'Obtener la victoria en una competencia.',
                            pregunta: '¿Qué significa ganar?',
                            opciones: {
                                A: 'Perder siempre',
                                B: 'Estar triste',
                                C: 'Obtener la victoria en una competencia',
                                D: 'Correr hacia atrás'
                            },
                            respuesta_correcta: 'C'
                        },
                        {
                            indice: 9,
                            termino: 'orgulloso',
                            definicion: 'Que siente mucha satisfacción por algo propio.',
                            pregunta: '¿Cómo se siente alguien orgulloso?',
                            opciones: {
                                A: 'Muy triste y deprimido',
                                B: 'Que siente mucha satisfacción por algo propio',
                                C: 'Con mucho miedo',
                                D: 'Muy confundido'
                            },
                            respuesta_correcta: 'B'
                        },
                        {
                            indice: 10,
                            termino: 'burlar',
                            definicion: 'Reírse de alguien de manera cruel.',
                            pregunta: '¿Qué significa burlar?',
                            opciones: {
                                A: 'Ayudar con cariño',
                                B: 'Reírse de alguien de manera cruel',
                                C: 'Dar un regalo bonito',
                                D: 'Cantar una canción'
                            },
                            respuesta_correcta: 'B'
                        }
                    ]
                },
                preguntas_tc: {
                    preguntas: [
                        {
                            indice: 1,
                            pregunta: '¿Por qué el coyote arrojó a la tortuga al río?',
                            opciones: {
                                A: 'Porque quería verla nadar.',
                                B: 'Porque la tortuga lo ayudó.',
                                C: 'Porque estaba enojado con ella.',
                                D: 'Porque tenía miedo del río.'
                            },
                            respuesta_correcta: 'C',
                            orientacion: 'Busca en el texto cómo se sentía el coyote con la tortuga después de perder la carrera.',
                            retroalimentacion: 'La opción correcta es C porque el texto dice que el coyote estaba muy enojado después de que la tortuga ganara la carrera.'
                        }
                    ]
                }
            };
            
            console.log('🧪 Usando lectura de ejemplo para FASE 2');
            
        } catch (error) {
            console.error('❌ Error cargando lectura:', error);
            this.showError('Error al cargar la lectura asignada');
        }
    }

    // === FASE 2: VOCABULARIO ===
    async loadVocabulary() {
        console.log('📚 Cargando vocabulario FASE 2...');
        
        try {
            if (!this.currentLecture || !this.currentLecture.vocabulario) {
                throw new Error('No hay vocabulario disponible');
            }

            this.vocabularyData = this.currentLecture.vocabulario.items;
            
            // Mostrar vocabulario en la interfaz
            await this.renderVocabulary();
            
            // Preparar test de vocabulario
            this.prepareVocabularyTest();
            
            // Habilitar botón de continuar
            this.enableContinueToTest();
            
            console.log('✅ Vocabulario cargado - 10 términos disponibles');
            
        } catch (error) {
            console.error('❌ Error cargando vocabulario:', error);
            this.showError('Error al cargar el vocabulario');
        }
    }

    async renderVocabulary() {
    const container = document.getElementById('vocabularyContent');
    
    if (!this.vocabularyData || this.vocabularyData.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--error-600);">No hay vocabulario disponible</p>';
        return;
    }

    // Crear HTML para cada término
    const vocabularyHTML = this.vocabularyData.map(item => `
        <div class="vocabulary-item">
            <div class="term-number">${item.indice}</div>
            <div class="term-content">
                <h4>${item.termino}</h4>
                <p class="term-definition">${item.definicion}</p>
            </div>
        </div>
    `).join('');

    container.innerHTML = vocabularyHTML;
    
    // ✅ CORRECCIÓN: Marcar paso como completado con log claro
    console.log('📚 Marcando vocabulario como completado...');
    this.stepStates.vocabulary = 'completed';
    this.stepStates.testVocabulary = 'pending';
    
    console.log('📊 Estados actuales:', this.stepStates);
    console.log('✅ Vocabulario renderizado y marcado como completado');
}

logCurrentStates() {
    console.log('🔍 ESTADO ACTUAL DE PASOS:');
    console.log('- Vocabulario:', this.stepStates.vocabulary);
    console.log('- Test Vocabulario:', this.stepStates.testVocabulary);
    console.log('- Lectura:', this.stepStates.reading);
    console.log('- Comprensión:', this.stepStates.comprehension);
}

    enableContinueToTest() {
        const btn = document.getElementById('continueToTestBtn');
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            console.log('✅ Botón "Continuar al Test" habilitado');
        } else {
            console.warn('⚠️ Botón continueToTestBtn no encontrado');
        }
    }

    // === FASE 2: TEST DE VOCABULARIO ===
    prepareVocabularyTest() {
        console.log('📝 Preparando test de vocabulario...');
        
        // Crear datos del test con opciones aleatorizadas
        this.vocabularyTestData = this.vocabularyData.map(item => {
            // Aleatorizar opciones usando el seed
            const shuffledOptions = this.shuffleOptionsWithSeed(item.opciones, this.shuffleSeed + item.indice);
            
            return {
                ...item,
                shuffledOptions: shuffledOptions,
                correctAnswerAfterShuffle: this.findCorrectAfterShuffle(item.opciones, item.respuesta_correcta, shuffledOptions)
            };
        });
        
        console.log('✅ Test de vocabulario preparado con opciones aleatorizadas');
    }

    shuffleOptionsWithSeed(opciones, seed) {
        // Convertir opciones a array para mezclar
        const letters = ['A', 'B', 'C', 'D'];
        const optionsArray = letters.map(letter => ({
            letter: letter,
            text: opciones[letter]
        }));
        
        // Shuffle usando seed
        for (let i = optionsArray.length - 1; i > 0; i--) {
            const j = Math.floor(this.seededRandom(seed + i) * (i + 1));
            [optionsArray[i], optionsArray[j]] = [optionsArray[j], optionsArray[i]];
        }
        
        // Convertir de vuelta a objeto con nuevas letras
        const shuffled = {};
        optionsArray.forEach((option, index) => {
            shuffled[letters[index]] = option.text;
        });
        
        return shuffled;
    }

    findCorrectAfterShuffle(originalOptions, originalCorrect, shuffledOptions) {
        const correctText = originalOptions[originalCorrect];
        
        // Encontrar en qué letra quedó después del shuffle
        for (const letter of ['A', 'B', 'C', 'D']) {
            if (shuffledOptions[letter] === correctText) {
                return letter;
            }
        }
        
        return 'A'; // Fallback
    }

    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    loadVocabularyTest() {
        console.log('📝 Cargando test de vocabulario...');
        
        const container = document.getElementById('vocabularyTestContent');
        
        if (!this.vocabularyTestData) {
            container.innerHTML = '<p style="text-align: center; color: var(--error-600);">Error cargando el test</p>';
            return;
        }

        // Crear HTML para cada pregunta
        const questionsHTML = this.vocabularyTestData.map(item => `
            <div class="question-item" data-question-id="${item.indice}">
                <div class="question-header">
                    <span class="question-number">Pregunta ${item.indice}</span>
                </div>
                <div class="question-text">
                    ${item.pregunta}
                </div>
                <div class="question-options">
                    ${Object.entries(item.shuffledOptions).map(([letter, text]) => `
                        <label class="option-label" data-letter="${letter}">
                            <input type="radio" name="question_${item.indice}" value="${letter}" 
                                   onchange="selectVocabularyAnswer(${item.indice}, '${letter}')">
                            <span class="option-text">${letter}. ${text}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `).join('');

        container.innerHTML = questionsHTML;
        
        console.log('✅ Test de vocabulario cargado con opciones aleatorizadas');
    }

    selectVocabularyAnswer(questionId, answer) {
        console.log(`📝 Respuesta seleccionada - Pregunta ${questionId}: ${answer}`);
        
        this.vocabularyAnswers[questionId] = answer;
        
        // Marcar visualmente la pregunta como respondida
        const questionItem = document.querySelector(`[data-question-id="${questionId}"]`);
        if (questionItem) {
            questionItem.classList.add('answered');
        }
        
        // Marcar opción como seleccionada
        const options = document.querySelectorAll(`input[name="question_${questionId}"]`);
        options.forEach(option => {
            const label = option.closest('.option-label');
            label.classList.toggle('selected', option.checked);
        });
        
        // Verificar si se pueden habilitar los botones
        this.checkTestProgress();
    }

    checkTestProgress() {
        const totalQuestions = this.vocabularyTestData.length;
        const answeredQuestions = Object.keys(this.vocabularyAnswers).length;
        
        console.log(`📊 Progreso del test: ${answeredQuestions}/${totalQuestions}`);
        
        // Habilitar botón de enviar si todas las preguntas están respondidas
        const submitBtn = document.getElementById('submitTestBtn');
        if (submitBtn) {
            submitBtn.disabled = answeredQuestions < totalQuestions;
            submitBtn.style.opacity = answeredQuestions < totalQuestions ? '0.6' : '1';
        }
    }

    async submitVocabularyTest() {
        console.log('📝 Enviando test de vocabulario...');
        
        try {
            // Calcular resultados
            const results = this.calculateVocabularyResults();
            
            // Mostrar resultados
            this.showVocabularyResults(results);
            
            // Verificar si puede continuar al siguiente paso
            if (results.score === 10) {
                this.stepStates.testVocabulary = 'completed';
                this.stepStates.reading = 'pending';
                this.enableContinueToReading();
                console.log('✅ Test aprobado 10/10 - Lectura desbloqueada');
            } else {
                console.log(`❌ Test no aprobado ${results.score}/10 - Lectura sigue bloqueada`);
                this.showRetryOption();
            }
            
        } catch (error) {
            console.error('❌ Error enviando test:', error);
            this.showError('Error al procesar las respuestas');
        }
    }

    calculateVocabularyResults() {
        let correctAnswers = 0;
        const details = [];
        
        this.vocabularyTestData.forEach(item => {
            const userAnswer = this.vocabularyAnswers[item.indice];
            const isCorrect = userAnswer === item.correctAnswerAfterShuffle;
            
            if (isCorrect) correctAnswers++;
            
            details.push({
                question: item.indice,
                userAnswer: userAnswer,
                correctAnswer: item.correctAnswerAfterShuffle,
                isCorrect: isCorrect,
                term: item.termino
            });
        });
        
        return {
            score: correctAnswers,
            total: this.vocabularyTestData.length,
            percentage: (correctAnswers / this.vocabularyTestData.length) * 100,
            details: details
        };
    }

    showVocabularyResults(results) {
        const resultsContainer = document.getElementById('testResults');
        
        const isSuccess = results.score === 10;
        const resultClass = isSuccess ? 'success' : 'error';
        const resultMessage = isSuccess 
            ? '¡Perfecto! Has completado el vocabulario correctamente.' 
            : `Necesitas 10/10 para continuar. Obtuviste ${results.score}/10.`;
        
        resultsContainer.innerHTML = `
            <div class="result-score ${resultClass}">
                ${results.score}/10
            </div>
            <div class="result-message">
                ${resultMessage}
            </div>
            <div class="result-details">
                ${isSuccess 
                    ? 'Ahora puedes continuar a la lectura del texto.' 
                    : 'Revisa los términos y vuelve a intentarlo.'
                }
            </div>
        `;
        
        resultsContainer.style.display = 'block';
        resultsContainer.className = `test-results ${resultClass}`;
        
        // Ocultar botón de enviar
        const submitBtn = document.getElementById('submitTestBtn');
        if (submitBtn) {
            submitBtn.style.display = 'none';
        }
    }

    enableContinueToReading() {
        const btn = document.getElementById('continueToReadingBtn');
        if (btn) {
            btn.style.display = 'inline-flex';
            btn.disabled = false;
        }
    }

    showRetryOption() {
        // Agregar botón de reintentar
        const actions = document.querySelector('#testVocabularySection .step-actions');
        
        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn btn-warning';
        retryBtn.onclick = () => this.retryVocabularyTest();
        retryBtn.innerHTML = '🔄 Intentar de Nuevo';
        
        actions.appendChild(retryBtn);
    }

    retryVocabularyTest() {
        console.log('🔄 Reintentando test de vocabulario...');
        
        // Limpiar respuestas
        this.vocabularyAnswers = {};
        
        // Generar nuevo seed para diferentes opciones
        this.shuffleSeed = this.shuffleSeed + 1000;
        
        // Preparar nuevo test
        this.prepareVocabularyTest();
        this.loadVocabularyTest();
        
        // Ocultar resultados
        const resultsContainer = document.getElementById('testResults');
        resultsContainer.style.display = 'none';
        
        // Restaurar botón de enviar
        const submitBtn = document.getElementById('submitTestBtn');
        if (submitBtn) {
            submitBtn.style.display = 'inline-flex';
            submitBtn.disabled = true;
        }
        
        // Ocultar botón de continuar y quitar retry
        const continueBtn = document.getElementById('continueToReadingBtn');
        if (continueBtn) {
            continueBtn.style.display = 'none';
        }
        
        // Remover botón de retry
        const retryBtn = document.querySelector('.btn-warning');
        if (retryBtn) {
            retryBtn.remove();
        }
    }

    // === NAVEGACIÓN ENTRE PASOS CON GUARDAS ===
    goToStep(stepNumber) {
        console.log(`📍 Navegando al paso ${stepNumber}`);
        
        // Validar rango de pasos
        if (stepNumber < 1 || stepNumber > 4) {
            console.error('❌ Número de paso inválido:', stepNumber);
            return;
        }

        // Verificar guardas antes de permitir navegación
        if (!this.canAccessStep(stepNumber)) {
            console.warn(`🚫 Acceso denegado al paso ${stepNumber}`);
            this.showAccessDeniedMessage(stepNumber);
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

    canAccessStep(stepNumber) {
    console.log(`🔍 Verificando acceso al paso ${stepNumber}...`);
    this.logCurrentStates();
    
    let canAccess = false;
    
    switch(stepNumber) {
        case 1:
            canAccess = true; // Siempre accesible
            break;
        case 2:
            canAccess = this.stepStates.vocabulary === 'completed';
            console.log(`📝 Paso 2 - Vocabulario completado? ${canAccess}`);
            break;
        case 3:
            canAccess = this.stepStates.testVocabulary === 'completed';
            console.log(`📖 Paso 3 - Test completado? ${canAccess}`);
            break;
        case 4:
            canAccess = this.stepStates.reading === 'completed';
            console.log(`🧠 Paso 4 - Lectura completada? ${canAccess}`);
            break;
        default:
            canAccess = false;
    }
    
    console.log(`${canAccess ? '✅' : '❌'} Acceso al paso ${stepNumber}: ${canAccess ? 'PERMITIDO' : 'DENEGADO'}`);
    return canAccess;
}

    showAccessDeniedMessage(stepNumber) {
        const stepNames = ['', 'Vocabulario', 'Test de Vocabulario', 'Lectura', 'Comprensión'];
        alert(`⚠️ Debes completar el paso anterior antes de acceder a "${stepNames[stepNumber]}"`);
    }

    executeStepActions(stepNumber) {
    switch(stepNumber) {
        case 1:
            console.log('📖 Activando estudio de vocabulario');
            // ✅ CORRECCIÓN: No sobrescribir si ya está completado
            if (this.stepStates.vocabulary !== 'completed') {
                this.stepStates.vocabulary = 'active';
            }
            break;
        case 2:
            console.log('📝 Activando test de vocabulario');
            // ✅ CORRECCIÓN: No sobrescribir si ya está completado
            if (this.stepStates.testVocabulary !== 'completed') {
                this.stepStates.testVocabulary = 'active';
            }
            this.loadVocabularyTest();
            break;
        case 3:
            console.log('⏱️ Activando lectura con cronómetro');
            if (this.stepStates.reading !== 'completed') {
                this.stepStates.reading = 'active';
            }
            this.startTimer();
            break;
        case 4:
            console.log('🧠 Activando test de comprensión');
            if (this.stepStates.comprehension !== 'completed') {
                this.stepStates.comprehension = 'active';
            }
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
        const words = this.currentLecture ? this.currentLecture.palabras : 107;
        const wpm = words > 0 ? (words * 60000) / elapsedMs : 0;
        
        console.log('📊 Métricas calculadas:');
        console.log(`- Tiempo: ${elapsedMs}ms`);
        console.log(`- Palabras: ${words}`);
        console.log(`- WPM: ${wpm.toFixed(1)}`);
        
        // Mostrar mensaje de finalización
        alert(`🎉 ¡Módulo MLC FASE 2 completado!\n\n📚 Vocabulario: ✅ Completado\n📝 Test: ✅ 10/10\n⏱️ Tiempo de lectura: ${this.formatTime(elapsedMs)}\n📈 Velocidad: ${wpm.toFixed(1)} WPM\n\n(FASE 3 y 4 próximamente)`);
        
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

// Función para seleccionar respuesta de vocabulario
function selectVocabularyAnswer(questionId, answer) {
    if (mlcModule) {
        mlcModule.selectVocabularyAnswer(questionId, answer);
    } else {
        console.error('❌ Módulo MLC no inicializado');
    }
}

// Función para enviar test de vocabulario
function submitVocabularyTest() {
    if (mlcModule) {
        mlcModule.submitVocabularyTest();
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
    console.log('🎓 DOM cargado, inicializando módulo MLC FASE 2...');
    
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

console.log('📚 Módulo MLC FASE 2 cargado exitosamente');

// === EXPORTAR PARA DEBUGGING ===
if (typeof window !== 'undefined') {
    window.mlcModule = mlcModule;
    window.goToStep = goToStep;
    window.selectVocabularyAnswer = selectVocabularyAnswer;
    window.submitVocabularyTest = submitVocabularyTest;
    window.finishMLC = finishMLC;
}