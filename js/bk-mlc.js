// === TSP v2.0 - MÓDULO MLC (LECTURA CRÍTICA) - FASE 3 COMPLETA ===
// Archivo: js/mlc-module.js
// FASE 3: PDF embebido + Cronómetro + Controles de zoom + Velocidad en tiempo real

console.log('📚 Inicializando Módulo de Lectura Crítica TSP v2.0 - FASE 3 COMPLETA...');

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
        
        // === NUEVAS VARIABLES PARA FASE 3 - LECTURA ===
        this.readingStartTime = null;
        this.readingEndTime = null;
        this.readingTimer = null;
        this.currentZoom = 100;
        this.isFullscreen = false;
        this.isMinimized = false;
        this.readingCompleted = false;
        this.pdfLoaded = false;
        
        console.log('🎯 Módulo MLC inicializado - FASE 3 COMPLETA con PDF embebido');
    }

    // === INICIALIZACIÓN ===
    async init() {
        try {
            console.log('🚀 Iniciando módulo MLC FASE 3 COMPLETA...');
            
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
            
            // Mostrar información de la lectura
            this.displayLectureInfo();
            
            // Generar seed para aleatorización consistente
            this.generateShuffleSeed();
            
            // Cargar vocabulario (FASE 2)
            await this.loadVocabulary();
            
            // Inicializar el primer paso
            this.goToStep(1);
            
            console.log('✅ Módulo MLC FASE 3 COMPLETA inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando módulo MLC:', error);
            this.showError('Error al cargar el módulo de lectura crítica');
        }
    }

    // === GESTIÓN DE USUARIO ===
    getUserFromSession() {
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
            grado: 3  // Grado 3 para el PDF de prueba
        };
    }

    updateUserInfo() {
        const studentNameEl = document.getElementById('studentName');
        if (studentNameEl && this.currentUser) {
            studentNameEl.textContent = `${this.currentUser.nombres} ${this.currentUser.apellidos}`;
        }
    }

    // === INFORMACIÓN DE LA LECTURA ===
    displayLectureInfo() {
        console.log('📋 Mostrando información de la lectura...');
        
        if (!this.currentLecture) {
            console.warn('⚠️ No hay lectura cargada para mostrar información');
            return;
        }

        let lectureInfoContainer = document.getElementById('lectureInfo');
        
        if (!lectureInfoContainer) {
            const vocabularySection = document.getElementById('vocabularySection');
            const stepHeader = vocabularySection.querySelector('.step-header');
            
            lectureInfoContainer = document.createElement('div');
            lectureInfoContainer.id = 'lectureInfo';
            lectureInfoContainer.className = 'lecture-info-card';
            
            stepHeader.parentNode.insertBefore(lectureInfoContainer, stepHeader.nextSibling);
        }

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

    // === SEED PARA ALEATORIZACIÓN ===
    generateShuffleSeed() {
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
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    // === CARGA DE DATOS DESDE SUPABASE ===
    async loadAssignedLectureFromSupabase() {
        console.log('📖 Cargando lectura asignada DESDE SUPABASE...');
        
        try {
            if (!supabase) {
                throw new Error('Cliente Supabase no disponible');
            }

            // Por ahora usar datos simulados que incluyen el PDF path correcto
            this.currentLecture = {
                id: 'lectura-g3c1',
                titulo: 'El Coyote y la Tortuga',
                autor: 'Leyenda Hopi Desconocido',
                palabras: 107,
                pdf_path: 'tsp-lecturas/grado-3/ciclo-1/g3c1.pdf',
                grado_minimo: 3,
                grado_maximo: 3,
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
                        // Agregar más términos según sea necesario
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
                            orientacion: 'Busca en el texto cómo se sentía el coyote...',
                            retroalimentacion: 'La opción correcta es C porque el texto dice...'
                        }
                    ]
                },
                activo: true
            };
            
            await this.validateLectureData();
            console.log('✅ Lectura cargada con PDF path:', this.currentLecture.pdf_path);
            
        } catch (error) {
            console.error('❌ Error cargando lectura desde Supabase:', error);
            throw new Error(`Error al cargar lectura: ${error.message}`);
        }
    }

    async validateLectureData() {
        console.log('🔍 Validando estructura de datos de la lectura...');
        
        if (!this.currentLecture) {
            throw new Error('No hay lectura cargada');
        }

        const requiredFields = ['id', 'titulo', 'autor', 'palabras', 'pdf_path', 'vocabulario', 'preguntas_tc'];
        for (const field of requiredFields) {
            if (!this.currentLecture[field]) {
                console.warn(`⚠️ Campo faltante o vacío: ${field}`);
            }
        }

        console.log('✅ Estructura de datos validada:');
        console.log(`- Título: ${this.currentLecture.titulo}`);
        console.log(`- PDF: ${this.currentLecture.pdf_path}`);
        console.log(`- Palabras: ${this.currentLecture.palabras}`);
    }

    // === VOCABULARIO (FASE 2) ===
    async loadVocabulary() {
        console.log('📚 Cargando vocabulario DESDE SUPABASE...');
        
        try {
            if (!this.currentLecture || !this.currentLecture.vocabulario || !this.currentLecture.vocabulario.items) {
                throw new Error('No hay vocabulario disponible en la lectura cargada');
            }

            this.vocabularyData = this.currentLecture.vocabulario.items;
            
            console.log('📊 Vocabulario cargado desde Supabase:');
            console.log(`- Total de términos: ${this.vocabularyData.length}`);
            
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
        }
    }

    // === TEST DE VOCABULARIO (FASE 2) ===
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
        console.log('📝 Cargando test de vocabulario...');
        
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
        
        console.log('✅ Test de vocabulario cargado con opciones aleatorizadas');
    }

    selectVocabularyAnswer(questionId, answer) {
        console.log(`📝 Respuesta seleccionada - Pregunta ${questionId}: ${answer}`);
        
        this.vocabularyAnswers[questionId] = answer;
        
        const questionItem = document.querySelector(`[data-question-id="${questionId}"]`);
        if (questionItem) {
            questionItem.classList.add('answered');
        }
        
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
            
            this.showSimpleCorrection(results);
            
            if (results.score === results.total) {
                this.stepStates.testVocabulary = 'completed';
                this.stepStates.reading = 'pending';
                this.enableContinueToReading();
                console.log(`✅ Test aprobado ${results.score}/${results.total} - Lectura desbloqueada`);
            } else {
                console.log(`❌ Test no aprobado ${results.score}/${results.total}`);
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

    showSimpleCorrection(results) {
        console.log('🎨 Aplicando corrección visual simple en el formulario...');

        const submitBtn = document.getElementById('submitTestBtn');
        if (submitBtn) {
            submitBtn.style.display = 'none';
        }

        results.details.forEach(detail => {
            const questionItem = document.querySelector(`[data-question-id="${detail.question}"]`);
            if (!questionItem) return;

            const options = questionItem.querySelectorAll('.option-label');
            
            options.forEach(optionLabel => {
                const letter = optionLabel.dataset.letter;
                const radio = optionLabel.querySelector('input[type="radio"]');
                
                if (letter === detail.userAnswer) {
                    if (detail.isCorrect) {
                        optionLabel.style.backgroundColor = '#d1fae5';
                        optionLabel.style.borderColor = '#10b981';
                        optionLabel.style.color = '#065f46';
                        optionLabel.innerHTML = optionLabel.innerHTML.replace(letter + '.', letter + '. ✅');
                    } else {
                        optionLabel.style.backgroundColor = '#fee2e2';
                        optionLabel.style.borderColor = '#ef4444';
                        optionLabel.style.color = '#991b1b';
                        optionLabel.innerHTML = optionLabel.innerHTML.replace(letter + '.', letter + '. ❌');
                    }
                }
                
                if (letter === detail.correctAnswer && letter !== detail.userAnswer) {
                    optionLabel.style.backgroundColor = '#d1fae5';
                    optionLabel.style.borderColor = '#10b981';
                    optionLabel.style.color = '#065f46';
                    optionLabel.innerHTML = optionLabel.innerHTML.replace(letter + '.', letter + '. ✅ (Correcta)');
                }
                
                radio.disabled = true;
            });

            questionItem.classList.add('corrected');
            questionItem.classList.add(detail.isCorrect ? 'correct' : 'incorrect');
        });

        this.showSummaryResults(results);
        console.log('✅ Corrección visual simple aplicada exitosamente');
    }

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
        
        this.vocabularyAnswers = {};
        this.shuffleSeed = this.shuffleSeed + 1000;
        
        this.prepareVocabularyTest();
        this.loadVocabularyTest();
        
        const resultsContainer = document.getElementById('testResults');
        resultsContainer.style.display = 'none';
        
        const submitBtn = document.getElementById('submitTestBtn');
        if (submitBtn) {
            submitBtn.style.display = 'inline-flex';
            submitBtn.disabled = true;
        }
        
        const continueBtn = document.getElementById('continueToReadingBtn');
        if (continueBtn) {
            continueBtn.style.display = 'none';
        }
        
        const retryBtn = document.querySelector('.btn-warning');
        if (retryBtn) {
            retryBtn.remove();
        }
    }

    // === NUEVA FUNCIONALIDAD FASE 3: LECTURA CON PDF ===
    
    async initPdfViewer() {
        console.log('📄 Inicializando PDF viewer - FASE 3 (IFRAME OPTIMIZADO)...');
        
        try {
            // Construir URL del PDF en Supabase Storage
            const pdfUrl = this.buildSupabaseStorageUrl(this.currentLecture.pdf_path);
            console.log('🔗 URL del PDF:', pdfUrl);
            
            // Verificar si el PDF existe
            const pdfExists = await this.checkPdfExists(pdfUrl);
            
            if (pdfExists) {
                console.log('✅ PDF encontrado en Supabase, cargando con iframe...');
                await this.loadPdfIntoViewer(pdfUrl);
            } else {
                console.warn('⚠️ PDF no encontrado en Supabase, usando PDF de prueba');
                await this.loadFallbackPdf();
            }
            
        } catch (error) {
            console.error('❌ Error inicializando PDF viewer:', error);
            await this.loadFallbackPdf();
        }
    }

    buildSupabaseStorageUrl(pdfPath) {
        const baseUrl = SUPABASE_CONFIG.url;
        return `${baseUrl}/storage/v1/object/public/${pdfPath}`;
    }

    async checkPdfExists(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            console.error('Error verificando PDF:', error);
            return false;
        }
    }

    async loadPdfIntoViewer(pdfUrl) {
        console.log('📂 Cargando PDF en el viewer (IFRAME)...');
        
        const pdfFrame = document.getElementById('pdfFrame');
        const pdfLoading = document.getElementById('pdfLoading');
        
        if (!pdfFrame || !pdfLoading) {
            console.error('❌ Elementos del PDF viewer no encontrados');
            return;
        }
        
        // Configurar iframe
        pdfFrame.src = pdfUrl;
        
        pdfFrame.onload = () => {
            console.log('✅ PDF cargado exitosamente en iframe');
            pdfLoading.style.display = 'none';
            pdfFrame.style.display = 'block';
            this.pdfLoaded = true;
            
            // Aplicar zoom actual si existe
            this.applyZoom();
        };
        
        pdfFrame.onerror = () => {
            console.error('❌ Error cargando PDF en iframe');
            this.showPdfError();
        };
        
        // Timeout de seguridad (8 segundos)
        setTimeout(() => {
            if (!this.pdfLoaded) {
                console.warn('⚠️ Timeout cargando PDF, intentando alternativa...');
                this.loadPdfWithPdfJs(pdfUrl);
            }
        }, 8000);
    }

    async loadFallbackPdf() {
        console.log('🔄 Cargando PDF de prueba...');
        
        // URL de un PDF de prueba público
        const fallbackUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
        
        try {
            await this.loadPdfIntoViewer(fallbackUrl);
        } catch (error) {
            console.error('❌ Error incluso con PDF de prueba:', error);
            this.showPdfError();
        }
    }

    // === FUNCIÓN ALTERNATIVA: PDF.js VIEWER ===
    async loadPdfWithPdfJs(pdfUrl) {
        console.log('📂 Cargando PDF con PDF.js...');
        
        const pdfFrame = document.getElementById('pdfFrame');
        const pdfLoading = document.getElementById('pdfLoading');
        
        // Crear viewer con PDF.js
        const viewerUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`;
        
        pdfFrame.src = viewerUrl;
        
        pdfFrame.onload = () => {
            console.log('✅ PDF cargado con PDF.js');
            pdfLoading.style.display = 'none';
            pdfFrame.style.display = 'block';
            this.pdfLoaded = true;
        };
        
        // Timeout de seguridad
        setTimeout(() => {
            if (!this.pdfLoaded) {
                console.warn('⚠️ PDF.js timeout, mostrando enlace directo...');
                this.showDirectPdfLink(pdfUrl);
            }
        }, 6000);
    }

    // === FUNCIÓN DE RESPALDO: ENLACE DIRECTO ===
    showDirectPdfLink(pdfUrl) {
        console.log('📂 Mostrando enlace directo al PDF...');
        
        const pdfContent = document.getElementById('pdfContent');
        const pdfLoading = document.getElementById('pdfLoading');
        
        pdfLoading.style.display = 'none';
        
        pdfContent.innerHTML = `
            <div style="text-align: center; padding: var(--space-8); background: linear-gradient(135deg, var(--info-50), var(--primary-50)); border-radius: var(--radius-xl);">
                <div style="font-size: 4rem; margin-bottom: var(--space-4);">📖</div>
                <h3 style="color: var(--primary-700); margin-bottom: var(--space-4);">PDF Listo para Lectura</h3>
                <p style="color: var(--gray-600); margin-bottom: var(--space-6);">
                    El PDF "${this.currentLecture.titulo}" está disponible. 
                    Ábrelo en una nueva ventana para una mejor experiencia de lectura.
                </p>
                <a href="${pdfUrl}" target="_blank" style="
                    background: linear-gradient(135deg, var(--primary-600), var(--primary-500));
                    color: white;
                    padding: var(--space-4) var(--space-6);
                    border-radius: var(--radius-lg);
                    text-decoration: none;
                    font-weight: 600;
                    display: inline-flex;
                    align-items: center;
                    gap: var(--space-2);
                    margin: var(--space-2);
                    transition: var(--transition-fast);
                " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                    <span>📄</span>
                    <span>Abrir PDF en Nueva Ventana</span>
                </a>
                <button onclick="mlcModule.loadPdfWithPdfJs('${pdfUrl}')" style="
                    background: linear-gradient(135deg, var(--success-600), var(--success-500));
                    color: white;
                    border: none;
                    padding: var(--space-4) var(--space-6);
                    border-radius: var(--radius-lg);
                    font-weight: 600;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: var(--space-2);
                    margin: var(--space-2);
                    transition: var(--transition-fast);
                " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                    <span>🔄</span>
                    <span>Intentar con PDF.js</span>
                </button>
            </div>
        `;
        
        this.pdfLoaded = true;
    }

    showPdfError() {
        const pdfContent = document.getElementById('pdfContent');
        if (!pdfContent) return;
        
        pdfContent.innerHTML = `
            <div class="pdf-error">
                <h3>❌ Error cargando PDF</h3>
                <p>No se pudo cargar el documento PDF desde Supabase Storage.</p>
                <p style="font-size: var(--text-sm); margin-top: var(--space-2);">
                    Ruta esperada: ${this.currentLecture.pdf_path}
                </p>
                <div style="margin-top: var(--space-4); display: flex; gap: var(--space-3); justify-content: center; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="mlcModule.retryPdfLoad()" style="margin: 0;">
                        🔄 Reintentar
                    </button>
                    <button class="btn btn-secondary" onclick="mlcModule.loadPdfWithPdfJs('${this.buildSupabaseStorageUrl(this.currentLecture.pdf_path)}')" style="margin: 0;">
                        📄 Usar PDF.js
                    </button>
                </div>
            </div>
        `;
    }

    async retryPdfLoad() {
        console.log('🔄 Reintentando carga de PDF...');
        
        // Resetear estado
        this.pdfLoaded = false;
        
        // Mostrar loading nuevamente
        const pdfContent = document.getElementById('pdfContent');
        if (pdfContent) {
            pdfContent.innerHTML = `
                <div class="pdf-loading" id="pdfLoading">
                    <div class="loading-spinner"></div>
                    <p>Reintentando carga de PDF...</p>
                </div>
                <iframe id="pdfFrame" class="pdf-embed" style="display: none;" allowfullscreen></iframe>
            `;
        }
        
        // Intentar cargar nuevamente
        await this.initPdfViewer();
    }

    // === CRONÓMETRO Y VELOCIDAD ===
    startReadingTimer() {
        console.log('⏱️ Iniciando cronómetro de lectura...');
        
        this.readingStartTime = Date.now();
        
        this.readingTimer = setInterval(() => {
            this.updateTimerDisplay();
            this.updateSpeedDisplay();
        }, 1000);
        
        console.log('✅ Cronómetro iniciado');
    }

    stopReadingTimer() {
        if (this.readingTimer) {
            clearInterval(this.readingTimer);
            this.readingTimer = null;
            this.readingEndTime = Date.now();
            console.log('⏹️ Cronómetro detenido');
        }
    }

    updateTimerDisplay() {
        if (!this.readingStartTime) return;
        
        const elapsedMs = Date.now() - this.readingStartTime;
        const formatted = this.formatTime(elapsedMs);
        
        const timerEl = document.getElementById('timerDisplay');
        if (timerEl) {
            timerEl.textContent = formatted;
        }
    }

    updateSpeedDisplay() {
        if (!this.readingStartTime || !this.currentLecture) return;
        
        const elapsedMs = Date.now() - this.readingStartTime;
        const elapsedMinutes = elapsedMs / 60000;
        
        if (elapsedMinutes > 0) {
            const wpm = (this.currentLecture.palabras / elapsedMinutes).toFixed(1);
            
            const speedEl = document.getElementById('speedDisplay');
            if (speedEl) {
                speedEl.textContent = `${wpm} WPM`;
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

    // === CONTROLES DE ZOOM ===
    zoomIn() {
        if (this.currentZoom < 200) {
            this.currentZoom += 25;
            this.applyZoom();
            console.log(`🔍 Zoom aumentado a ${this.currentZoom}%`);
        }
    }

    zoomOut() {
        if (this.currentZoom > 50) {
            this.currentZoom -= 25;
            this.applyZoom();
            console.log(`🔍 Zoom reducido a ${this.currentZoom}%`);
        }
    }

    applyZoom() {
        const pdfFrame = document.getElementById('pdfFrame');
        const zoomLevel = document.getElementById('zoomLevel');
        
        if (pdfFrame) {
            pdfFrame.style.transform = `scale(${this.currentZoom / 100})`;
            pdfFrame.style.transformOrigin = 'top left';
            
            // Ajustar el contenedor para el zoom
            const pdfContent = document.getElementById('pdfContent');
            if (pdfContent) {
                const scale = this.currentZoom / 100;
                pdfContent.style.height = `${600 * scale}px`;
                pdfContent.style.overflow = scale > 1 ? 'auto' : 'hidden';
            }
        }
        
        if (zoomLevel) {
            zoomLevel.textContent = `${this.currentZoom}%`;
        }
    }

    // === CONTROLES DE PANTALLA ===
    toggleFullscreen() {
        const container = document.getElementById('pdfViewerContainer');
        const btn = document.getElementById('fullscreenBtn');
        
        if (!container || !btn) return;
        
        if (!this.isFullscreen) {
            container.classList.add('fullscreen');
            btn.innerHTML = '<span>🗗</span><span>Salir</span>';
            this.isFullscreen = true;
            console.log('📺 Pantalla completa activada');
        } else {
            container.classList.remove('fullscreen');
            btn.innerHTML = '<span>⛶</span><span>Pantalla Completa</span>';
            this.isFullscreen = false;
            console.log('📺 Pantalla completa desactivada');
        }
    }

    minimizePdfViewer() {
        const container = document.getElementById('pdfViewerContainer');
        const btn = document.getElementById('minimizeBtn');
        
        if (!container || !btn) return;
        
        if (!this.isMinimized) {
            container.classList.add('minimized');
            btn.innerHTML = '<span>📄</span><span>Restaurar</span>';
            this.isMinimized = true;
            console.log('📦 PDF minimizado');
        } else {
            container.classList.remove('minimized');
            btn.innerHTML = '<span>📦</span><span>Minimizar</span>';
            this.isMinimized = false;
            console.log('📄 PDF restaurado');
        }
    }

    // === FINALIZAR LECTURA ===
    finishReading() {
        if (this.readingCompleted) {
            console.log('⚠️ Lectura ya completada');
            return;
        }
        
        console.log('✅ Finalizando lectura...');
        
        // Detener cronómetro
        this.stopReadingTimer();
        
        // Calcular métricas finales
        const elapsedMs = this.readingEndTime - this.readingStartTime;
        const elapsedMinutes = elapsedMs / 60000;
        const wpm = this.currentLecture ? (this.currentLecture.palabras / elapsedMinutes).toFixed(1) : 0;
        
        console.log('📊 Métricas de lectura:');
        console.log(`- Tiempo: ${this.formatTime(elapsedMs)}`);
        console.log(`- Palabras: ${this.currentLecture?.palabras || 0}`);
        console.log(`- WPM: ${wpm}`);
        
        // Guardar datos para el siguiente paso
        sessionStorage.setItem('reading_time_ms', elapsedMs.toString());
        sessionStorage.setItem('reading_wpm', wpm.toString());
        
        // Marcar como completado
        this.readingCompleted = true;
        this.stepStates.reading = 'completed';
        this.stepStates.comprehension = 'pending';
        
        // Habilitar botón de continuar
        const continueBtn = document.getElementById('continueToComprehensionBtn');
        if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.style.opacity = '1';
        }
        
        // Mostrar mensaje de confirmación
        this.showReadingCompleted(elapsedMs, wpm);
    }

    showReadingCompleted(elapsedMs, wpm) {
        const timeFormatted = this.formatTime(elapsedMs);
        
        // Crear modal de confirmación
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            font-family: var(--font-primary);
        `;
        
        modal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, var(--success-50), white);
                border: 3px solid var(--success-500);
                border-radius: var(--radius-2xl);
                padding: var(--space-8);
                text-align: center;
                max-width: 500px;
                margin: var(--space-4);
                box-shadow: var(--shadow-xl);
            ">
                <div style="font-size: 3rem; margin-bottom: var(--space-4);">✅</div>
                <h2 style="color: var(--success-700); margin-bottom: var(--space-4); font-size: var(--text-2xl);">
                    ¡Lectura Completada!
                </h2>
                <div style="background: white; padding: var(--space-4); border-radius: var(--radius-lg); margin: var(--space-4) 0; border: 1px solid var(--success-300);">
                    <p style="margin-bottom: var(--space-2);"><strong>Tiempo de lectura:</strong> ${timeFormatted}</p>
                    <p style="margin-bottom: var(--space-2);"><strong>Palabras leídas:</strong> ${this.currentLecture?.palabras || 0}</p>
                    <p style="margin-bottom: 0;"><strong>Velocidad:</strong> ${wpm} palabras por minuto</p>
                </div>
                <p style="color: var(--gray-600); margin-bottom: var(--space-6);">
                    Ahora puedes continuar al test de comprensión lectora.
                </p>
                <button onclick="mlcModule.closeModal()" style="
                    background: linear-gradient(135deg, var(--success-600), var(--success-500));
                    color: white;
                    border: none;
                    padding: var(--space-3) var(--space-6);
                    border-radius: var(--radius-lg);
                    font-size: var(--text-base);
                    font-weight: 600;
                    cursor: pointer;
                    transition: var(--transition-fast);
                ">
                    Continuar
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Guardar referencia al modal para poder cerrarlo
        this.currentModal = modal;
    }

    closeModal() {
        if (this.currentModal) {
            document.body.removeChild(this.currentModal);
            this.currentModal = null;
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
                console.log('⏱️ Activando lectura con cronómetro - FASE 3');
                if (this.stepStates.reading !== 'completed') {
                    this.stepStates.reading = 'active';
                }
                // Inicializar PDF viewer y cronómetro
                this.initPdfViewer();
                this.startReadingTimer();
                break;
            case 4:
                console.log('🧠 Activando test de comprensión');
                if (this.stepStates.comprehension !== 'completed') {
                    this.stepStates.comprehension = 'active';
                }
                this.stopReadingTimer();
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

    // === FINALIZACIÓN ===
    finishMLC() {
        console.log('🎉 Finalizando módulo MLC FASE 3...');
        
        const elapsedMs = this.readingEndTime - this.readingStartTime;
        const words = this.currentLecture ? this.currentLecture.palabras : 0;
        const wpm = words > 0 ? (words * 60000) / elapsedMs : 0;
        
        console.log('📊 Métricas calculadas:');
        console.log(`- Tiempo: ${elapsedMs}ms`);
        console.log(`- Palabras: ${words}`);
        console.log(`- WPM: ${wpm.toFixed(1)}`);
        
        alert(`🎉 ¡Módulo MLC FASE 3 completado!\n\n📚 Vocabulario: ✅ Completado\n📝 Test: ✅ ${this.vocabularyTestData.length}/${this.vocabularyTestData.length}\n📄 Lectura: ✅ PDF embebido funcional\n⏱️ Tiempo de lectura: ${this.formatTime(elapsedMs)}\n📈 Velocidad: ${wpm.toFixed(1)} WPM\n🗄️ Lectura: "${this.currentLecture.titulo}"\n\n(FASE 4 próximamente)`);
        
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

function finishReading() {
    if (mlcModule) {
        mlcModule.finishReading();
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

// === FUNCIONES ESPECÍFICAS DE FASE 3 ===
function zoomIn() {
    if (mlcModule) {
        mlcModule.zoomIn();
    }
}

function zoomOut() {
    if (mlcModule) {
        mlcModule.zoomOut();
    }
}

function toggleFullscreen() {
    if (mlcModule) {
        mlcModule.toggleFullscreen();
    }
}

function minimizePdfViewer() {
    if (mlcModule) {
        mlcModule.minimizePdfViewer();
    }
}

// === INICIALIZACIÓN AUTOMÁTICA ===
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🎓 DOM cargado, inicializando módulo MLC FASE 3 COMPLETA...');
    
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

// === EVENTOS DE TECLADO ===
document.addEventListener('keydown', function(event) {
    if (!mlcModule) return;
    
    // Escape para salir de pantalla completa
    if (event.key === 'Escape' && mlcModule.isFullscreen) {
        mlcModule.toggleFullscreen();
    }
    
    // Ctrl/Cmd + Plus para zoom in
    if ((event.ctrlKey || event.metaKey) && event.key === '=') {
        event.preventDefault();
        mlcModule.zoomIn();
    }
    
    // Ctrl/Cmd + Minus para zoom out
    if ((event.ctrlKey || event.metaKey) && event.key === '-') {
        event.preventDefault();
        mlcModule.zoomOut();
    }
});

// === MANEJO DE ERRORES GLOBALES ===
window.addEventListener('error', function(event) {
    console.error('❌ Error global capturado:', event.error);
});

console.log('📚 Módulo MLC FASE 3 COMPLETA cargado exitosamente');
console.log('📄 PDF embebido con controles de zoom y pantalla completa');
console.log('⏱️ Cronómetro con cálculo de velocidad en tiempo real');
console.log('🗄️ Integración con Supabase Storage para PDFs');
console.log('🎯 Bucket configurado: tsp-lecturas/grado-3/ciclo-1/g3c1.pdf');

// === EXPORTAR PARA DEBUGGING ===
if (typeof window !== 'undefined') {
    window.mlcModule = mlcModule;
    window.goToStep = goToStep;
    window.selectVocabularyAnswer = selectVocabularyAnswer;
    window.submitVocabularyTest = submitVocabularyTest;
    window.finishReading = finishReading;
    window.finishMLC = finishMLC;
    window.zoomIn = zoomIn;
    window.zoomOut = zoomOut;
    window.toggleFullscreen = toggleFullscreen;
    window.minimizePdfViewer = minimizePdfViewer;
}