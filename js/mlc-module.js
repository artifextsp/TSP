// === TSP v2.0 - MÓDULO MLC (LECTURA CRÍTICA) - FASE 2 MEJORADA ===
// Archivo: js/mlc-module.js
// MEJORAS: 1) Corrección simple en el formulario, 2) Info de lectura desde vocabulario

console.log('📚 Inicializando Módulo de Lectura Crítica TSP v2.0 - FASE 2 MEJORADA...');

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
        
        console.log('🎯 Módulo MLC inicializado - FASE 2 MEJORADA');
    }

    // === INICIALIZACIÓN ===
    async init() {
        try {
            console.log('🚀 Iniciando módulo MLC FASE 2 MEJORADA...');
            
            // Cargar usuario de la sesión
            this.currentUser = this.getUserFromSession();
            
            if (!this.currentUser) {
                console.warn('⚠️ No hay usuario en sesión');
                this.redirectToDashboard();
                return;
            }

            // Actualizar información del usuario en la interfaz
            this.updateUserInfo();
            
            // Cargar datos de la lectura asignada DESDE SUPABASE
            await this.loadAssignedLectureFromSupabase();
            
            // ✅ MEJORA 2: Mostrar información de la lectura desde el vocabulario
            this.displayLectureInfo();
            
            // Generar seed para aleatorización consistente
            this.generateShuffleSeed();
            
            // Cargar vocabulario (FASE 2) - AHORA DESDE SUPABASE
            await this.loadVocabulary();
            
            // Inicializar el primer paso
            this.goToStep(1);
            
            // Inicializar timer
            this.initTimer();
            
            console.log('✅ Módulo MLC FASE 2 MEJORADA inicializado correctamente');
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

    // ✅ MEJORA 2: MOSTRAR INFORMACIÓN DE LA LECTURA DESDE EL VOCABULARIO
    displayLectureInfo() {
        console.log('📋 Mostrando información de la lectura...');
        
        if (!this.currentLecture) {
            console.warn('⚠️ No hay lectura cargada para mostrar información');
            return;
        }

        // Buscar el contenedor de información de la lectura (lo agregaremos al HTML)
        let lectureInfoContainer = document.getElementById('lectureInfo');
        
        if (!lectureInfoContainer) {
            // Crear el contenedor si no existe y agregarlo al inicio del vocabulario
            const vocabularySection = document.getElementById('vocabularySection');
            const stepHeader = vocabularySection.querySelector('.step-header');
            
            lectureInfoContainer = document.createElement('div');
            lectureInfoContainer.id = 'lectureInfo';
            lectureInfoContainer.className = 'lecture-info-card';
            
            // Insertar después del step-header
            stepHeader.parentNode.insertBefore(lectureInfoContainer, stepHeader.nextSibling);
        }

        // ✅ CREAR HTML CON INFORMACIÓN COMPLETA DE LA LECTURA
        lectureInfoContainer.innerHTML = `
            <div class="lecture-info-content">
                <div class="lecture-info-header">
                    <span class="lecture-icon">📖</span>
                    <h3>Información de la Lectura</h3>
                </div>
                <div class="lecture-info-grid">
                    <div class="info-item">
                        <span class="info-label">Título:</span>
                        <span class="info-value">${this.currentLecture.titulo || 'No disponible'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Autor:</span>
                        <span class="info-value">${this.currentLecture.autor || 'No disponible'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Grado:</span>
                        <span class="info-value">${this.formatGradeRange()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Palabras:</span>
                        <span class="info-value">${this.currentLecture.palabras || 0} palabras</span>
                    </div>
                </div>
            </div>
        `;

        console.log('✅ Información de la lectura mostrada exitosamente');
    }

    formatGradeRange() {
        if (!this.currentLecture.grado_minimo && !this.currentLecture.grado_maximo) {
            return 'No especificado';
        }
        
        if (this.currentLecture.grado_minimo === this.currentLecture.grado_maximo) {
            return `${this.currentLecture.grado_minimo}°`;
        }
        
        return `${this.currentLecture.grado_minimo}° - ${this.currentLecture.grado_maximo}°`;
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

    // === CARGA DE DATOS DESDE SUPABASE ===
    async loadAssignedLectureFromSupabase() {
        console.log('📖 Cargando lectura asignada DESDE SUPABASE - ALGORITMO MEJORADO...');
        
        try {
            if (!supabase) {
                throw new Error('Cliente Supabase no disponible');
            }

            // PASO 1: Intentar cargar lectura específica desde asignaciones
            console.log('🎯 PASO 1: Buscando asignación específica...');
            const { data: assignmentData, error: assignmentError } = await supabase
                .from('asignaciones_ciclos')
                .select(`
                    *,
                    ciclos (
                        lectura_id,
                        lecturas (
                            id, titulo, autor, palabras, pdf_path,
                            grado_minimo, grado_maximo, vocabulario, preguntas_tc, activo
                        )
                    )
                `)
                .eq('estudiante_id', this.currentUser.id)
                .eq('activo', true)
                .order('created_at', { ascending: false })
                .limit(1);

            if (!assignmentError && assignmentData && assignmentData.length > 0 && assignmentData[0].ciclos?.lecturas) {
                this.currentLecture = assignmentData[0].ciclos.lecturas;
                console.log('✅ PASO 1 EXITOSO: Lectura específica asignada:', this.currentLecture.titulo);
                await this.validateLectureData();
                return;
            }

            // PASO 2: Obtener grado real del estudiante desde la BD
            console.log('📊 PASO 2: Obteniendo grado real del estudiante...');
            const studentGrade = await this.getStudentGradeFromDatabase();
            console.log(`👨‍🎓 Grado del estudiante: ${studentGrade || 'NO DEFINIDO'}`);

            if (studentGrade) {
                // PASO 2A: Buscar lecturas apropiadas para el grado
                console.log(`🔍 PASO 2A: Buscando lecturas para grado ${studentGrade}...`);
                
                const { data: gradeAppropriate, error: gradeError } = await supabase
                    .from('lecturas')
                    .select('*')
                    .eq('activo', true)
                    .lte('grado_minimo', studentGrade)  // grado_minimo <= 5
                    .gte('grado_maximo', studentGrade)  // grado_maximo >= 5
                    .order('grado_minimo', { ascending: true })
                    .order('created_at', { ascending: false });

                if (!gradeError && gradeAppropriate && gradeAppropriate.length > 0) {
                    const bestLecture = this.selectBestLectureForGrade(gradeAppropriate, studentGrade);
                    this.currentLecture = bestLecture;
                    console.log(`✅ PASO 2A EXITOSO: Lectura para grado ${studentGrade}:`, this.currentLecture.titulo);
                    await this.validateLectureData();
                    return;
                }
            }

            // PASO 3: Buscar lecturas generales (sin filtro de grado)
            console.log('🔍 PASO 3: Buscando lecturas generales...');
            const { data: generalLectures, error: generalError } = await supabase
                .from('lecturas')
                .select('*')
                .eq('activo', true)
                .order('grado_minimo', { ascending: true })
                .order('created_at', { ascending: false })
                .limit(10);

            if (!generalError && generalLectures && generalLectures.length > 0) {
                const defaultLecture = this.selectDefaultLecture(generalLectures, studentGrade);
                this.currentLecture = defaultLecture;
                console.log('✅ PASO 3 EXITOSO: Lectura por defecto:', this.currentLecture.titulo);
                await this.validateLectureData();
                return;
            }

            // Si llegamos aquí, no hay lecturas disponibles
            throw new Error('No hay lecturas disponibles en la base de datos');
            
        } catch (error) {
            console.error('❌ Error cargando lectura desde Supabase:', error);
            throw new Error(`Error al cargar lectura: ${error.message}`);
        }
    }

    // === FUNCIÓN PARA OBTENER GRADO REAL DEL ESTUDIANTE ===
    async getStudentGradeFromDatabase() {
        try {
            console.log('🔍 Consultando grado del estudiante en BD...');
            
            const { data: userData, error: userError } = await supabase
                .from('usuarios')
                .select(`
                    *,
                    grupos (grado, nombre)
                `)
                .eq('id', this.currentUser.id)
                .single();

            if (!userError && userData) {
                if (userData.grupos && userData.grupos.grado) {
                    console.log(`📊 Grado desde grupos: ${userData.grupos.grado}`);
                    return userData.grupos.grado;
                }
                
                if (userData.grado) {
                    console.log(`📊 Grado directo en usuario: ${userData.grado}`);
                    return userData.grado;
                }
            }

            console.warn('⚠️ No se encontró grado en la BD, usando fallback');
            return this.currentUser.grado || null;
            
        } catch (error) {
            console.error('❌ Error obteniendo grado:', error);
            return this.currentUser.grado || null;
        }
    }

    // === FUNCIÓN PARA SELECCIONAR LA MEJOR LECTURA PARA EL GRADO ===
    selectBestLectureForGrade(lectures, studentGrade) {
        console.log(`🎯 Seleccionando mejor lectura de ${lectures.length} opciones para grado ${studentGrade}`);
        
        const exactMatch = lectures.filter(l => l.grado_minimo === studentGrade && l.grado_maximo === studentGrade);
        const goodMatch = lectures.filter(l => l.grado_minimo <= studentGrade && l.grado_maximo >= studentGrade && !(l.grado_minimo === studentGrade && l.grado_maximo === studentGrade));
        const acceptable = lectures.filter(l => l.grado_minimo <= studentGrade || l.grado_maximo >= studentGrade);
        
        console.log(`📊 Opciones encontradas:`);
        console.log(`- Exactas (grado ${studentGrade}): ${exactMatch.length}`);
        console.log(`- Compatibles: ${goodMatch.length}`);
        console.log(`- Aceptables: ${acceptable.length}`);
        
        if (exactMatch.length > 0) {
            console.log('✅ Usando lectura exacta para el grado');
            return exactMatch[0];
        }
        
        if (goodMatch.length > 0) {
            console.log('✅ Usando lectura compatible');
            return goodMatch[0];
        }
        
        if (acceptable.length > 0) {
            console.log('⚠️ Usando lectura aceptable (no ideal)');
            return acceptable[0];
        }
        
        console.log('⚠️ Fallback: primera lectura disponible');
        return lectures[0];
    }

    // === FUNCIÓN PARA SELECCIONAR LECTURA POR DEFECTO ===
    selectDefaultLecture(lectures, studentGrade) {
        console.log(`🎯 Seleccionando lectura por defecto de ${lectures.length} opciones`);
        
        if (studentGrade) {
            console.log(`📊 Buscando la más cercana al grado ${studentGrade}`);
            
            const withDistance = lectures.map(lecture => {
                const avgGrade = (lecture.grado_minimo + lecture.grado_maximo) / 2;
                const distance = Math.abs(avgGrade - studentGrade);
                return { ...lecture, distance };
            });
            
            withDistance.sort((a, b) => a.distance - b.distance);
            console.log(`✅ Lectura más cercana: "${withDistance[0].titulo}" (distancia: ${withDistance[0].distance})`);
            return withDistance[0];
        }
        
        const basicGrade = lectures.find(l => l.grado_minimo <= 3);
        if (basicGrade) {
            console.log('✅ Usando lectura de grado básico');
            return basicGrade;
        }
        
        console.log('⚠️ Usando primera lectura disponible');
        return lectures[0];
    }

    // === VALIDACIÓN DE DATOS DE LECTURA ===
    async validateLectureData() {
        console.log('🔍 Validando estructura de datos de la lectura...');
        
        if (!this.currentLecture) {
            throw new Error('No hay lectura cargada');
        }

        const requiredFields = ['id', 'titulo', 'autor', 'palabras', 'vocabulario', 'preguntas_tc'];
        for (const field of requiredFields) {
            if (!this.currentLecture[field]) {
                console.warn(`⚠️ Campo faltante o vacío: ${field}`);
            }
        }

        if (!this.currentLecture.vocabulario || !this.currentLecture.vocabulario.items) {
            throw new Error('Estructura de vocabulario inválida. Se esperaba vocabulario.items[]');
        }

        if (!Array.isArray(this.currentLecture.vocabulario.items)) {
            throw new Error('vocabulario.items debe ser un array');
        }

        if (this.currentLecture.vocabulario.items.length === 0) {
            throw new Error('No hay términos de vocabulario disponibles');
        }

        if (!this.currentLecture.preguntas_tc || !this.currentLecture.preguntas_tc.preguntas) {
            throw new Error('Estructura de preguntas de comprensión inválida. Se esperaba preguntas_tc.preguntas[]');
        }

        if (!Array.isArray(this.currentLecture.preguntas_tc.preguntas)) {
            throw new Error('preguntas_tc.preguntas debe ser un array');
        }

        if (this.currentLecture.preguntas_tc.preguntas.length === 0) {
            throw new Error('No hay preguntas de comprensión disponibles');
        }

        console.log('✅ Estructura de datos validada:');
        console.log(`- Título: ${this.currentLecture.titulo}`);
        console.log(`- Autor: ${this.currentLecture.autor}`);
        console.log(`- Palabras: ${this.currentLecture.palabras}`);
        console.log(`- Términos de vocabulario: ${this.currentLecture.vocabulario.items.length}`);
        console.log(`- Preguntas de comprensión: ${this.currentLecture.preguntas_tc.preguntas.length}`);
    }

    // === VOCABULARIO ===
    async loadVocabulary() {
        console.log('📚 Cargando vocabulario DESDE SUPABASE...');
        
        try {
            if (!this.currentLecture || !this.currentLecture.vocabulario || !this.currentLecture.vocabulario.items) {
                throw new Error('No hay vocabulario disponible en la lectura cargada');
            }

            this.vocabularyData = this.currentLecture.vocabulario.items;
            
            console.log('📊 Vocabulario cargado desde Supabase:');
            console.log(`- Total de términos: ${this.vocabularyData.length}`);
            this.vocabularyData.forEach((item, index) => {
                console.log(`  ${index + 1}. ${item.termino}: ${item.definicion?.substring(0, 50)}...`);
            });
            
            await this.renderVocabulary();
            this.prepareVocabularyTest();
            this.enableContinueToTest();
            
            console.log('✅ Vocabulario cargado desde Supabase - Términos disponibles:', this.vocabularyData.length);
            
        } catch (error) {
            console.error('❌ Error cargando vocabulario desde Supabase:', error);
            this.showError(`Error al cargar el vocabulario: ${error.message}`);
        }
    }

    async renderVocabulary() {
        const container = document.getElementById('vocabularyContent');
        
        if (!this.vocabularyData || this.vocabularyData.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--error-600);">No hay vocabulario disponible</p>';
            return;
        }

        const vocabularyHTML = this.vocabularyData.map(item => `
            <div class="vocabulary-item">
                <div class="term-number">${item.indice || (this.vocabularyData.indexOf(item) + 1)}</div>
                <div class="term-content">
                    <h4>${item.termino}</h4>
                    <p class="term-definition">${item.definicion}</p>
                </div>
            </div>
        `).join('');

        container.innerHTML = vocabularyHTML;
        
        console.log('📚 Marcando vocabulario como completado...');
        this.stepStates.vocabulary = 'completed';
        this.stepStates.testVocabulary = 'pending';
        
        console.log('✅ Vocabulario renderizado desde Supabase y marcado como completado');
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

    // === TEST DE VOCABULARIO ===
    prepareVocabularyTest() {
        console.log('📝 Preparando test de vocabulario con datos de Supabase...');
        
        this.vocabularyTestData = this.vocabularyData.map(item => {
            if (!item.pregunta || !item.opciones || !item.respuesta_correcta) {
                console.warn('⚠️ Término sin pregunta completa:', item.termino);
                return null;
            }

            const shuffledOptions = this.shuffleOptionsWithSeed(item.opciones, this.shuffleSeed + (item.indice || 0));
            
            return {
                ...item,
                shuffledOptions: shuffledOptions,
                correctAnswerAfterShuffle: this.findCorrectAfterShuffle(item.opciones, item.respuesta_correcta, shuffledOptions)
            };
        }).filter(item => item !== null);
        
        console.log('✅ Test de vocabulario preparado con datos de Supabase:');
        console.log(`- Preguntas válidas: ${this.vocabularyTestData.length}`);
    }

    shuffleOptionsWithSeed(opciones, seed) {
        const letters = ['A', 'B', 'C', 'D'];
        const optionsArray = letters.map(letter => ({
            letter: letter,
            text: opciones[letter]
        })).filter(option => option.text);
        
        for (let i = optionsArray.length - 1; i > 0; i--) {
            const j = Math.floor(this.seededRandom(seed + i) * (i + 1));
            [optionsArray[i], optionsArray[j]] = [optionsArray[j], optionsArray[i]];
        }
        
        const shuffled = {};
        optionsArray.forEach((option, index) => {
            shuffled[letters[index]] = option.text;
        });
        
        return shuffled;
    }

    findCorrectAfterShuffle(originalOptions, originalCorrect, shuffledOptions) {
        const correctText = originalOptions[originalCorrect];
        
        for (const letter of ['A', 'B', 'C', 'D']) {
            if (shuffledOptions[letter] === correctText) {
                return letter;
            }
        }
        
        return 'A';
    }

    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    loadVocabularyTest() {
        console.log('📝 Cargando test de vocabulario con datos de Supabase...');
        
        const container = document.getElementById('vocabularyTestContent');
        
        if (!this.vocabularyTestData || this.vocabularyTestData.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--error-600);">Error cargando el test desde Supabase</p>';
            return;
        }

        const questionsHTML = this.vocabularyTestData.map(item => `
            <div class="question-item" data-question-id="${item.indice || this.vocabularyTestData.indexOf(item) + 1}">
                <div class="question-header">
                    <span class="question-number">Pregunta ${item.indice || this.vocabularyTestData.indexOf(item) + 1}</span>
                </div>
                <div class="question-text">
                    ${item.pregunta}
                </div>
                <div class="question-options">
                    ${Object.entries(item.shuffledOptions).map(([letter, text]) => `
                        <label class="option-label" data-letter="${letter}">
                            <input type="radio" name="question_${item.indice || this.vocabularyTestData.indexOf(item) + 1}" value="${letter}" 
                                   onchange="selectVocabularyAnswer(${item.indice || this.vocabularyTestData.indexOf(item) + 1}, '${letter}')">
                            <span class="option-text">${letter}. ${text}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `).join('');

        container.innerHTML = questionsHTML;
        
        console.log('✅ Test de vocabulario cargado con datos de Supabase y opciones aleatorizadas');
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
        
        this.checkTestProgress();
    }

    checkTestProgress() {
        const totalQuestions = this.vocabularyTestData.length;
        const answeredQuestions = Object.keys(this.vocabularyAnswers).length;
        
        console.log(`📊 Progreso del test: ${answeredQuestions}/${totalQuestions}`);
        
        const submitBtn = document.getElementById('submitTestBtn');
        if (submitBtn) {
            submitBtn.disabled = answeredQuestions < totalQuestions;
            submitBtn.style.opacity = answeredQuestions < totalQuestions ? '0.6' : '1';
        }
    }

    async submitVocabularyTest() {
        console.log('📝 Enviando test de vocabulario...');
        
        try {
            const results = this.calculateVocabularyResults();
            
            // ✅ MEJORA 1: Mostrar corrección simple directamente en el formulario
            this.showSimpleCorrection(results);
            
            // Verificar si puede continuar al siguiente paso
            if (results.score === results.total) {
                this.stepStates.testVocabulary = 'completed';
                this.stepStates.reading = 'pending';
                this.enableContinueToReading();
                console.log(`✅ Test aprobado ${results.score}/${results.total} - Lectura desbloqueada`);
            } else {
                console.log(`❌ Test no aprobado ${results.score}/${results.total} - Lectura sigue bloqueada`);
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
            const questionId = item.indice || this.vocabularyTestData.indexOf(item) + 1;
            const userAnswer = this.vocabularyAnswers[questionId];
            const isCorrect = userAnswer === item.correctAnswerAfterShuffle;
            
            if (isCorrect) correctAnswers++;
            
            details.push({
                question: questionId,
                userAnswer: userAnswer,
                correctAnswer: item.correctAnswerAfterShuffle,
                isCorrect: isCorrect,
                term: item.termino,
                originalData: item
            });
        });
        
        return {
            score: correctAnswers,
            total: this.vocabularyTestData.length,
            percentage: (correctAnswers / this.vocabularyTestData.length) * 100,
            details: details
        };
    }

    // ✅ MEJORA 1: FUNCIÓN PARA CORRECCIÓN SIMPLE DIRECTAMENTE EN EL FORMULARIO
    showSimpleCorrection(results) {
        console.log('🎨 Aplicando corrección visual simple en el formulario...');

        // Ocultar botón de enviar
        const submitBtn = document.getElementById('submitTestBtn');
        if (submitBtn) {
            submitBtn.style.display = 'none';
        }

        // Aplicar colores a cada pregunta
        results.details.forEach(detail => {
            const questionItem = document.querySelector(`[data-question-id="${detail.question}"]`);
            if (!questionItem) return;

            // Obtener todas las opciones de esta pregunta
            const options = questionItem.querySelectorAll('.option-label');
            
            options.forEach(optionLabel => {
                const letter = optionLabel.dataset.letter;
                const radio = optionLabel.querySelector('input[type="radio"]');
                
                // Si es la respuesta que eligió el usuario
                if (letter === detail.userAnswer) {
                    if (detail.isCorrect) {
                        // ✅ Respuesta correcta -> verde
                        optionLabel.style.backgroundColor = '#d1fae5';
                        optionLabel.style.borderColor = '#10b981';
                        optionLabel.style.color = '#065f46';
                        optionLabel.innerHTML = optionLabel.innerHTML.replace(letter + '.', letter + '. ✅');
                    } else {
                        // ❌ Respuesta incorrecta -> rojo
                        optionLabel.style.backgroundColor = '#fee2e2';
                        optionLabel.style.borderColor = '#ef4444';
                        optionLabel.style.color = '#991b1b';
                        optionLabel.innerHTML = optionLabel.innerHTML.replace(letter + '.', letter + '. ❌');
                    }
                }
                
                // Si es la respuesta correcta (y no la eligió el usuario)
                if (letter === detail.correctAnswer && letter !== detail.userAnswer) {
                    // ✅ Mostrar la correcta en verde
                    optionLabel.style.backgroundColor = '#d1fae5';
                    optionLabel.style.borderColor = '#10b981';
                    optionLabel.style.color = '#065f46';
                    optionLabel.innerHTML = optionLabel.innerHTML.replace(letter + '.', letter + '. ✅ (Correcta)');
                }
                
                // Deshabilitar todos los radio buttons
                radio.disabled = true;
            });

            // Agregar clase para indicar que está corregida
            questionItem.classList.add('corrected');
            questionItem.classList.add(detail.isCorrect ? 'correct' : 'incorrect');
        });

        // Mostrar resumen general al final
        this.showSummaryResults(results);

        console.log('✅ Corrección visual simple aplicada exitosamente');
    }

    // ✅ FUNCIÓN PARA MOSTRAR RESUMEN GENERAL
    showSummaryResults(results) {
        const resultsContainer = document.getElementById('testResults');
        
        const isSuccess = results.score === results.total;
        const resultClass = isSuccess ? 'success' : 'error';
        const resultMessage = isSuccess 
            ? '¡Perfecto! Has completado el vocabulario correctamente.' 
            : `Necesitas ${results.total}/${results.total} para continuar. Obtuviste ${results.score}/${results.total}.`;
        
        resultsContainer.innerHTML = `
            <div class="result-score ${resultClass}">
                ${results.score}/${results.total}
            </div>
            <div class="result-message">
                ${resultMessage}
            </div>
            <div class="result-details">
                ${isSuccess 
                    ? 'Ahora puedes continuar a la lectura del texto.' 
                    : 'Revisa las respuestas marcadas arriba y vuelve a intentarlo.'
                }
            </div>
        `;
        
        resultsContainer.style.display = 'block';
        resultsContainer.className = `test-results ${resultClass}`;
        
        console.log(`✅ Resumen de resultados mostrado: ${results.score}/${results.total}`);
    }

    enableContinueToReading() {
        const btn = document.getElementById('continueToReadingBtn');
        if (btn) {
            btn.style.display = 'inline-flex';
            btn.disabled = false;
        }
    }

    showRetryOption() {
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
        
        const retryBtn = document.querySelector('.btn-warning');
        if (retryBtn) {
            retryBtn.remove();
        }
    }

    // === NAVEGACIÓN ENTRE PASOS CON GUARDAS ===
    goToStep(stepNumber) {
        console.log(`📍 Navegando al paso ${stepNumber}`);
        
        if (stepNumber < 1 || stepNumber > 4) {
            console.error('❌ Número de paso inválido:', stepNumber);
            return;
        }

        if (!this.canAccessStep(stepNumber)) {
            console.warn(`🚫 Acceso denegado al paso ${stepNumber}`);
            this.showAccessDeniedMessage(stepNumber);
            return;
        }

        this.currentStep = stepNumber;
        
        const sections = document.querySelectorAll('.step-section');
        sections.forEach(section => {
            section.classList.remove('active');
        });
        
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
        
        this.updateProgress();
        this.executeStepActions(stepNumber);
    }

    canAccessStep(stepNumber) {
        console.log(`🔍 Verificando acceso al paso ${stepNumber}...`);
        this.logCurrentStates();
        
        let canAccess = false;
        
        switch(stepNumber) {
            case 1:
                canAccess = true;
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

    logCurrentStates() {
        console.log('🔍 ESTADO ACTUAL DE PASOS:');
        console.log('- Vocabulario:', this.stepStates.vocabulary);
        console.log('- Test Vocabulario:', this.stepStates.testVocabulary);
        console.log('- Lectura:', this.stepStates.reading);
        console.log('- Comprensión:', this.stepStates.comprehension);
    }

    showAccessDeniedMessage(stepNumber) {
        const stepNames = ['', 'Vocabulario', 'Test de Vocabulario', 'Lectura', 'Comprensión'];
        alert(`⚠️ Debes completar el paso anterior antes de acceder a "${stepNames[stepNumber]}"`);
    }

    executeStepActions(stepNumber) {
        switch(stepNumber) {
            case 1:
                console.log('📖 Activando estudio de vocabulario');
                if (this.stepStates.vocabulary !== 'completed') {
                    this.stepStates.vocabulary = 'active';
                }
                break;
            case 2:
                console.log('📝 Activando test de vocabulario');
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
        
        const elapsedMs = this.endTime - this.startTime;
        const words = this.currentLecture ? this.currentLecture.palabras : 0;
        const wpm = words > 0 ? (words * 60000) / elapsedMs : 0;
        
        console.log('📊 Métricas calculadas:');
        console.log(`- Tiempo: ${elapsedMs}ms`);
        console.log(`- Palabras: ${words}`);
        console.log(`- WPM: ${wpm.toFixed(1)}`);
        
        alert(`🎉 ¡Módulo MLC FASE 2 MEJORADA completado!\n\n📚 Vocabulario: ✅ Completado (datos de Supabase)\n📝 Test: ✅ ${this.vocabularyTestData.length}/${this.vocabularyTestData.length}\n⏱️ Tiempo de lectura: ${this.formatTime(elapsedMs)}\n📈 Velocidad: ${wpm.toFixed(1)} WPM\n🗄️ Lectura: "${this.currentLecture.titulo}"\n\n(FASE 3 y 4 próximamente)`);
        
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
let mlcModule = null;

function goToStep(stepNumber) {
    if (mlcModule) {
        mlcModule.goToStep(stepNumber);
    } else {
        console.error('❌ Módulo MLC no inicializado');
    }
}

function selectVocabularyAnswer(questionId, answer) {
    if (mlcModule) {
        mlcModule.selectVocabularyAnswer(questionId, answer);
    } else {
        console.error('❌ Módulo MLC no inicializado');
    }
}

function submitVocabularyTest() {
    if (mlcModule) {
        mlcModule.submitVocabularyTest();
    } else {
        console.error('❌ Módulo MLC no inicializado');
    }
}

function finishMLC() {
    if (mlcModule) {
        mlcModule.finishMLC();
    } else {
        console.error('❌ Módulo MLC no inicializado');
    }
}

// === INICIALIZACIÓN AUTOMÁTICA ===
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🎓 DOM cargado, inicializando módulo MLC FASE 2 MEJORADA...');
    
    try {
        mlcModule = new MlcModule();
        await mlcModule.init();
    } catch (error) {
        console.error('❌ Error fatal inicializando módulo MLC:', error);
        alert('Error al cargar el módulo. Por favor, intenta nuevamente.');
        
        setTimeout(() => {
            window.location.href = 'dashboard-estudiante.html';
        }, 2000);
    }
});

// === MANEJO DE ERRORES GLOBALES ===
window.addEventListener('error', function(event) {
    console.error('❌ Error global capturado:', event.error);
});

console.log('📚 Módulo MLC FASE 2 MEJORADA cargado exitosamente - DATOS DESDE SUPABASE + CORRECCIÓN SIMPLE + INFO LECTURA');

// === EXPORTAR PARA DEBUGGING ===
if (typeof window !== 'undefined') {
    window.mlcModule = mlcModule;
    window.goToStep = goToStep;
    window.selectVocabularyAnswer = selectVocabularyAnswer;
    window.submitVocabularyTest = submitVocabularyTest;
    window.finishMLC = finishMLC;
}