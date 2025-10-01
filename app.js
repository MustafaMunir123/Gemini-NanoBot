import { createRxDatabase, addRxPlugin } from './lib/rxdb.mjs';
import { getRxStorageDexie } from './lib/rxdb-dexie.mjs';
import { RxDBQueryBuilderPlugin } from './lib/rxdb-query.mjs';

// Simple text embedding using a basic approach
// Note: This is a simplified embedding for demo purposes
// In production, you'd want to use a proper embedding model

// --- GLOBAL STATE ---
let db;
let embedder;
let nanoSession;
const EMBEDDING_DIMENSION = 384;
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 50;
const TOP_K = 3;

// UI elements
const loadingOverlay = document.getElementById('loading-overlay');
const loadingMessage = document.getElementById('loading-message');
const ingestionStatus = document.getElementById('ingestion-status');
const responseOutput = document.getElementById('response-output');
const contextList = document.getElementById('context-list');
const queryButton = document.getElementById('query-button');
const ingestButton = document.getElementById('ingest-button');

// --- UTILITY FUNCTIONS ---
function updateLoading(message) {
    loadingMessage.textContent = message;
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

function showLoading() {
    loadingOverlay.style.display = 'flex';
}

function cosineSimilarity(vecA, vecB) {
    let dot = 0, magA = 0, magB = 0;
    if (vecA.length !== vecB.length) return 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        magA += vecA[i] * vecA[i];
        magB += vecB[i] * vecB[i];
    }
    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);
    if (magA === 0 || magB === 0) return 0;
    return dot / (magA * magB);
}

function chunkText(text) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        let end = Math.min(i + CHUNK_SIZE, text.length);
        const chunk = text.substring(i, end).trim();
        if (chunk.length > 0) chunks.push(chunk);
        i += CHUNK_SIZE - CHUNK_OVERLAP;
        if (i >= text.length - CHUNK_OVERLAP) break;
    }
    return chunks;
}

// --- RXDB SETUP ---
const documentSchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: { id: { type: 'string', maxLength: 100 }, text: { type: 'string' }, vector: { type: 'string' } },
    required: ['id', 'text', 'vector']
};

async function initRxDB() {
    updateLoading('Initializing local database (RxDB)...');
    addRxPlugin(RxDBQueryBuilderPlugin);

    // Suppress the premium storage message
    const originalWarn = console.warn;
    console.warn = function (...args) {
        const message = args.join(' ');
        if (message.includes('RxDB Open Core RxStorage') || message.includes('premium')) {
            return; // Suppress the premium message
        }
        originalWarn.apply(console, args);
    };

    db = await createRxDatabase({ name: 'nano_rag_db', storage: getRxStorageDexie() });
    await db.addCollections({ documents: { schema: documentSchema } });

    // Restore original console.warn
    console.warn = originalWarn;

    console.log('RxDB initialized:', db.name);
}

// --- EMBEDDING & INGESTION ---
async function initEmbedder() {
    updateLoading('Initializing simple text embedding...');
    // Simple embedding function using basic text processing
    embedder = {
        async embed(text) {
            // Enhanced semantic-aware embedding
            const processedText = text.toLowerCase()
                .replace(/[^\w\s]/g, ' ') // Remove punctuation
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();

            const words = processedText.split(' ').filter(w => w.length > 1);

            // Create n-grams for better semantic capture
            const ngrams = this.createNgrams(words, 3); // 1-grams, 2-grams, 3-grams
            const allTerms = [...words, ...ngrams];

            const termCounts = {};
            allTerms.forEach(term => {
                termCounts[term] = (termCounts[term] || 0) + 1;
            });

            // Create semantic vector with better distribution
            const vector = new Array(EMBEDDING_DIMENSION).fill(0);
            const uniqueTerms = Object.keys(termCounts);
            const totalTerms = allTerms.length;

            // Use multiple hash functions with different seeds for better distribution
            uniqueTerms.forEach(term => {
                const frequency = termCounts[term] / totalTerms;
                const termWeight = this.getTermWeight(term); // Weight important terms higher

                // Use multiple hash positions with different seeds
                for (let i = 0; i < 5; i++) {
                    const hash = this.semanticHash(term, i);
                    const position = hash % EMBEDDING_DIMENSION;
                    vector[position] += frequency * termWeight;
                }
            });

            // Normalize the vector
            const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
            if (magnitude > 0) {
                for (let i = 0; i < vector.length; i++) {
                    vector[i] = vector[i] / magnitude;
                }
            }

            return { data: vector };
        },

        createNgrams(words, maxN) {
            const ngrams = [];
            for (let n = 2; n <= maxN; n++) {
                for (let i = 0; i <= words.length - n; i++) {
                    ngrams.push(words.slice(i, i + n).join(' '));
                }
            }
            return ngrams;
        },

        getTermWeight(term) {
            // Weight important terms higher
            const importantTerms = ['gemini', 'nano', 'rxdb', 'database', 'vector', 'embedding', 'rag', 'chrome', 'api', 'model', 'data', 'text', 'local', 'storage'];
            const isImportant = importantTerms.some(important => term.includes(important));
            return isImportant ? 2.0 : 1.0;
        },

        semanticHash(str, seed) {
            let hash = seed * 31;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char + seed;
                hash = hash & hash; // Convert to 32-bit integer
            }
            return Math.abs(hash);
        }
    };
    console.log('Simple embedding initialized.');
}

window.ingestKnowledge = async function () {
    const text = document.getElementById('knowledge-input').value.trim();
    if (!text) {
        ingestionStatus.textContent = "Error: Please paste content into the text area.";
        ingestionStatus.style.color = '#ef4444';
        return;
    }
    ingestButton.disabled = true;
    ingestionStatus.style.color = '#4b5563';
    ingestionStatus.textContent = "Status: Clearing previous data...";
    await db.documents.find().remove();
    ingestionStatus.textContent = `Status: Chunking text (Chunk Size: ${CHUNK_SIZE})...`;
    const chunks = chunkText(text);
    const docsToSave = [];
    for (let i = 0; i < chunks.length; i++) {
        const output = await embedder.embed(chunks[i]);
        docsToSave.push({ id: crypto.randomUUID(), text: chunks[i], vector: JSON.stringify(Array.from(output.data)) });
    }
    ingestionStatus.textContent = `Status: Saving ${docsToSave.length} documents to RxDB...`;
    await db.documents.bulkInsert(docsToSave);
    ingestionStatus.textContent = `Success! ${docsToSave.length} chunks indexed locally. Ready for RAG query.`;
    ingestButton.disabled = false;
};

async function retrieveContext(query) {
    responseOutput.textContent = 'Embedding query...';
    const output = await embedder.embed(query);
    const queryVector = Array.from(output.data);
    responseOutput.textContent = 'Searching local vectors...';
    const allDocs = await db.documents.find().exec();
    if (allDocs.length === 0) return [];
    const ranked = allDocs.map(doc => ({ text: doc.text, similarity: cosineSimilarity(queryVector, JSON.parse(doc.vector)) }))
        .sort((a, b) => b.similarity - a.similarity);
    const results = ranked.slice(0, TOP_K).filter(r => r.similarity > 0.1).map(r => r.text);
    console.log('🔍 Debug: Vector search results:', {
        totalDocs: allDocs.length,
        rankedCount: ranked.length,
        filteredCount: results.length,
        similarities: ranked.slice(0, 5).map(r => ({ text: r.text.substring(0, 50), similarity: r.similarity }))
    });
    return results;
}

// Function to use AI to determine if the query should use the knowledge base
async function shouldUseKnowledgeBase(query) {
    if (!nanoSession) {
        console.log('🔍 Debug: No AI session available, defaulting to knowledge base search');
        return true;
    }

    try {
        console.log('🔍 Debug: Asking AI to classify query...');
        const prompt = `Classify this query: "${query}"

Is this asking about technical topics like RxDB, databases, vectors, embeddings, RAG, Chrome APIs, or other technical concepts that would be in a knowledge base?

Respond with JSON format: {"use_knowledge_base": true} or {"use_knowledge_base": false}`;

        const response = await nanoSession.prompt(prompt, {
            outputLanguage: 'en'
        });

        console.log('🔍 Debug: AI classification response:', response);

        // Parse JSON response
        const classification = JSON.parse(response);
        const shouldUseKB = classification.use_knowledge_base === true;
        console.log('🔍 Debug: Parsed classification result:', shouldUseKB);
        return shouldUseKB;
    } catch (error) {
        console.error('🔍 Debug: Error in AI classification:', error);
        console.log('🔍 Debug: Defaulting to knowledge base search due to error');
        return true; // Default to using knowledge base if AI classification fails
    }
}

window.runRAG = async function () {
    const query = document.getElementById('user-query').value.trim();
    if (!query) return;
    queryButton.disabled = true;
    responseOutput.textContent = 'Processing...';
    contextList.innerHTML = '<li>Analyzing query...</li>';

    try {
        // Use AI to determine if this query should use the knowledge base
        const shouldUseKB = await shouldUseKnowledgeBase(query);
        console.log('🔍 Debug: Should use knowledge base?', shouldUseKB);

        if (!nanoSession) {
            responseOutput.textContent = "Error: LanguageModel session not available. Please ensure Chrome's experimental AI API is enabled.";
            return;
        }

        if (shouldUseKB) {
            // This is a knowledge-seeking query, use RAG with vector search
            console.log('🔍 Debug: Using RAG with vector search');
            contextList.innerHTML = '<li>Searching knowledge base...</li>';

            const contextChunks = await retrieveContext(query);
            if (contextChunks.length === 0) {
                responseOutput.textContent = 'No relevant info found.';
                contextList.innerHTML = '<li>No relevant chunks found.</li>';
                return;
            }

            contextList.innerHTML = contextChunks.map((c, i) => `<li>Chunk ${i + 1}: ${c.substring(0, 100)}...</li>`).join('');
            const augmentedContext = contextChunks.join('\n---\n');
            const userPrompt = `You are a knowledge base search assistant. The user is asking you to search through the provided context data. 

Your task:
1. Search through the context for the specific information requested
2. Report exactly what you found in the context
3. Quote or reference the specific parts of the context that contain the information

Context: ${augmentedContext}

User Question: ${query}

Answer based on what you actually find in the context above. If you find specific occurrences, mention them. If you don't find anything, say so.`;

            try {
                const response = await nanoSession.prompt(userPrompt, {
                    outputLanguage: 'en'
                });
                // Append the context to the AI's answer
                responseOutput.textContent = response + '\n\n---\n\n' + augmentedContext;
            } catch (aiError) {
                console.error('AI API error:', aiError);
                responseOutput.textContent = `Error with AI API: ${aiError.message}`;
            }
        } else {
            // This is a general conversation, answer directly without vector search
            console.log('🔍 Debug: Using direct AI response (no vector search)');
            contextList.innerHTML = '<li>Direct AI response (no knowledge base search)</li>';

            try {
                const response = await nanoSession.prompt(`Answer the following question in a straightforward manner and as short as possible while providing relevant information:\n\n${query}`, {
                    outputLanguage: 'en'
                });
                responseOutput.textContent = response;
            } catch (aiError) {
                console.error('AI API error:', aiError);
                responseOutput.textContent = `Error with AI API: ${aiError.message}`;
            }
        }
    } catch (e) {
        responseOutput.textContent = `Error: ${e.message}`;
        console.error(e);
    } finally {
        queryButton.disabled = false;
    }
};

async function initApp() {
    try {
        console.log('Step 1: Initialize RxDB');
        await initRxDB();
        console.log('Step 2: Initialize Embedder');
        await initEmbedder();
        console.log('Step 3: Initialize Gemini Nano session');

        console.log('🔍 Debug: typeof LanguageModel =', typeof LanguageModel);

        if (typeof LanguageModel !== undefined) {

            try {
                console.log('🔍 Debug: Checking LanguageModel availability...');
                const availability = await LanguageModel.availability(['en']);
                console.log('📊 LanguageModel availability:', availability);
                console.log('🔍 Debug: availability type =', typeof availability);

                if (availability === 'available') {
                    console.log('🔍 Debug: Creating LanguageModel session...');
                    try {
                        nanoSession = await LanguageModel.create({
                            outputLanguage: 'en',
                            monitor(m) {
                                m.addEventListener('downloadprogress', (e) => {
                                    console.log(`Downloaded ${e.loaded * 100}%`);
                                });
                            },
                        });
                        console.log('🚀 LanguageModel session created successfully');
                        console.log('🔍 Debug: nanoSession =', nanoSession);
                    } catch (sessionError) {
                        console.error('❌ Error creating LanguageModel session:', sessionError);
                        console.error('🔍 Debug: sessionError details:', {
                            name: sessionError.name,
                            message: sessionError.message,
                            stack: sessionError.stack
                        });
                    }
                } else {
                    console.warn('⚠️ LanguageModel is not readily available. Status:', availability);
                    console.log('🔍 Debug: Available statuses might be:', ['readily-available', 'backlogged', 'unavailable']);
                    updateLoading(`LanguageModel status: ${availability}. RAG system will work for embedding and storage, but AI responses may be limited.`);
                }
            } catch (availabilityError) {
                console.error('❌ Error checking LanguageModel availability:', availabilityError);
                console.error('🔍 Debug: availabilityError details:', {
                    name: availabilityError.name,
                    message: availabilityError.message,
                    stack: availabilityError.stack
                });
            }
        } else {
            console.warn('❌ Chrome experimental AI API (LanguageModel) not available');
            console.log('🔍 Debug: window object keys containing "Language":', Object.keys(window).filter(key => key.includes('Language')));
            console.log('🔍 Debug: Chrome version info:', navigator.userAgent);
            updateLoading('Chrome experimental AI API not detected. RAG system will work for embedding and storage, but AI responses will not be available.');
        }

        hideLoading();
        console.log('Initialization complete');
    } catch (err) {
        console.error('Initialization failed', err);
        updateLoading(`Initialization Failed: ${err.message}`);
    }
}


// Add event listeners for buttons
document.getElementById('ingest-button').addEventListener('click', ingestKnowledge);
document.getElementById('query-button').addEventListener('click', runRAG);

document.getElementById('knowledge-input').value = `
    Gemini Nano is Google's efficient on-device model for RAG. RxDB stores indexed text locally. Chrome Prompt API exposes 'window.ai'. Gemini have other models as well.
        `;

initApp();