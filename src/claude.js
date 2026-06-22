// Generación de resúmenes de libros con la API de Claude.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export function hasApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM = `Sos un experto en aprendizaje y síntesis de libros de no-ficción.
Tu trabajo es producir un resumen accionable, en español rioplatense neutro y profesional,
pensado para que un gerente comercial aprenda algo valioso en 5-7 minutos de lectura.
Siempre devolvés JSON válido que cumpla EXACTAMENTE el formato pedido. Nada de texto fuera del JSON.`;

function buildPrompt(book) {
  return `Generá el resumen del libro:
Título: "${book.title}"
Autor: ${book.author}${book.year ? ` (${book.year})` : ''}
Categoría: ${book.category}

Devolvé SOLO un objeto JSON con esta forma exacta:
{
  "tldr": "2-3 oraciones que capturan la tesis central del libro",
  "ideasClave": [
    { "titulo": "Idea 1 (frase corta)", "detalle": "2-4 oraciones explicando la idea" }
  ],
  "aplicacion": [
    "Acción concreta 1 que el lector puede aplicar hoy en su trabajo o vida",
    "Acción concreta 2",
    "Acción concreta 3"
  ],
  "fraseDestacada": "Una cita o frase memorable representativa del libro (en español)",
  "paraQuien": "1 oración: a quién le sirve más este libro",
  "tiempoLectura": "5-7 min"
}

Reglas:
- Entre 4 y 6 "ideasClave".
- Entre 3 y 5 acciones en "aplicacion", todas concretas y accionables.
- Todo en español. Tono claro, directo, sin relleno.`;
}

export async function generateSummary(book) {
  const c = getClient();
  if (!c) throw new Error('NO_API_KEY');

  const msg = await c.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: 'user', content: buildPrompt(book) }],
  });

  const text = msg.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  const json = extractJson(text);
  // Validación mínima
  if (!json.tldr || !Array.isArray(json.ideasClave)) {
    throw new Error('BAD_SUMMARY_SHAPE');
  }
  return json;
}

function extractJson(text) {
  // Tolera fences ```json ... ``` o texto alrededor.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('NO_JSON_FOUND');
  return JSON.parse(raw.slice(start, end + 1));
}
