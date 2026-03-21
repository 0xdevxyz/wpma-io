'use strict';

/**
 * Unified LLM Service
 *
 * Priority: Groq (fast, free) → Anthropic (reliable) → OpenRouter (fallback)
 *
 * Groq models:
 *   - llama-3.1-8b-instant   → schnelle strukturierte Tasks (Agent-Analyse, JSON)
 *   - llama-3.3-70b-versatile → komplexe Tasks (Content, Revenue-Korrelation)
 *
 * Drop-in usage:
 *   const { chat, chatJSON } = require('./llmService');
 *   const text = await chat({ system, prompt, model: 'fast' | 'smart' });
 *   const obj  = await chatJSON({ system, prompt, model: 'fast' });
 */

const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

// ─── Clients ─────────────────────────────────────────────────────────────────

let groqClient = null;
let anthropicClient = null;
let openrouterClient = null;

function getGroq() {
    if (!groqClient && process.env.GROQ_API_KEY) {
        groqClient = new OpenAI({
            baseURL: 'https://api.groq.com/openai/v1',
            apiKey: process.env.GROQ_API_KEY,
        });
    }
    return groqClient;
}

function getAnthropic() {
    if (!anthropicClient && process.env.ANTHROPIC_API_KEY) {
        anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return anthropicClient;
}

function getOpenRouter() {
    if (!openrouterClient && process.env.OPENROUTER_API_KEY) {
        openrouterClient = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.OPENROUTER_API_KEY,
        });
    }
    return openrouterClient;
}

// ─── Model mapping ────────────────────────────────────────────────────────────

const GROQ_MODELS = {
    fast:  'llama-3.1-8b-instant',    // ~150ms — für JSON-Analyse, kurze Tasks
    smart: 'llama-3.3-70b-versatile', // ~400ms — für Content, Korrelationen
};

const ANTHROPIC_MODELS = {
    fast:  'claude-haiku-4-5-20251001',
    smart: 'claude-sonnet-4-6',
};

const OPENROUTER_MODELS = {
    fast:  'meta-llama/llama-3.1-8b-instruct:free',
    smart: 'meta-llama/llama-3.3-70b-instruct:free',
};

// ─── Core chat function ───────────────────────────────────────────────────────

/**
 * Send a chat prompt and return the text response.
 * @param {object} opts
 * @param {string} opts.prompt      - User message
 * @param {string} [opts.system]    - System prompt
 * @param {'fast'|'smart'} [opts.model='fast'] - Model tier
 * @param {number} [opts.maxTokens=1024]
 * @returns {Promise<string>}
 */
async function chat({ prompt, system = '', model = 'fast', maxTokens = 1024 }) {
    const errors = [];

    // 1. Groq (primary)
    const groq = getGroq();
    if (groq) {
        try {
            const messages = [];
            if (system) messages.push({ role: 'system', content: system });
            messages.push({ role: 'user', content: prompt });

            const res = await groq.chat.completions.create({
                model: GROQ_MODELS[model] || GROQ_MODELS.fast,
                messages,
                max_tokens: maxTokens,
                temperature: 0.3,
            });
            return res.choices[0]?.message?.content || '';
        } catch (err) {
            errors.push(`Groq: ${err.message}`);
            console.warn('[LLM] Groq failed, falling back:', err.message);
        }
    }

    // 2. Anthropic (fallback)
    const anthropic = getAnthropic();
    if (anthropic) {
        try {
            const res = await anthropic.messages.create({
                model: ANTHROPIC_MODELS[model] || ANTHROPIC_MODELS.fast,
                max_tokens: maxTokens,
                system: system || undefined,
                messages: [{ role: 'user', content: prompt }],
            });
            return res.content[0]?.text || '';
        } catch (err) {
            errors.push(`Anthropic: ${err.message}`);
            console.warn('[LLM] Anthropic failed, falling back:', err.message);
        }
    }

    // 3. OpenRouter (last resort)
    const openrouter = getOpenRouter();
    if (openrouter) {
        try {
            const messages = [];
            if (system) messages.push({ role: 'system', content: system });
            messages.push({ role: 'user', content: prompt });

            const res = await openrouter.chat.completions.create({
                model: OPENROUTER_MODELS[model] || OPENROUTER_MODELS.fast,
                messages,
                max_tokens: maxTokens,
            });
            return res.choices[0]?.message?.content || '';
        } catch (err) {
            errors.push(`OpenRouter: ${err.message}`);
        }
    }

    throw new Error(`Alle LLM-Provider fehlgeschlagen: ${errors.join(' | ')}`);
}

/**
 * Like chat(), but parses the response as JSON.
 * Extracts first JSON block from response if needed.
 */
async function chatJSON(opts) {
    const raw = await chat({ ...opts, maxTokens: opts.maxTokens || 1024 });
    try {
        return JSON.parse(raw);
    } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error(`LLM returned non-JSON: ${raw.slice(0, 200)}`);
    }
}

/**
 * Returns which providers are configured
 */
function getStatus() {
    return {
        groq:        !!process.env.GROQ_API_KEY,
        anthropic:   !!process.env.ANTHROPIC_API_KEY,
        openrouter:  !!process.env.OPENROUTER_API_KEY,
        primary:     process.env.GROQ_API_KEY ? 'groq' :
                     process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openrouter',
    };
}

module.exports = { chat, chatJSON, getStatus };
