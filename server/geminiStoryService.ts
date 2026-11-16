import { GoogleGenAI } from '@google/genai';

export interface ConceptGenerationInput {
  prompt: string;
  department: 'MEN' | 'KIDS';
  world: string;
  character?: string;
  designType?: string;
  placement?: string;
  mood?: string;
  colorDirection?: string;
  generationMode?: string;
  characterDetails?: {
    hair?: string;
    eyes?: string;
    outfit?: string;
    silhouette?: string;
    weaponTool?: string;
    symbol?: string;
  };
}

export interface GeneratedConceptData {
  designName: string;
  collection: string;
  department: 'MEN' | 'KIDS';
  world: string;
  character: string;
  characterPersonality: string[];
  ability: string;
  visualIdentity: string;
  story: string;
  designStory: string;
  mood: string;
  colorPalette: string[];
  typography: string;
  graphicElements: string[];
  printPlacement: string;
  garmentType: string;
  printStyle: string;
  targetAudience: string;
  marketingHook: string;
  productDescription: string;
  tags: string[];
  imagePrompt: string;
  seoTitle: string;
  seoDescription: string;
  oneLineStory: string;
  whyWearing: string;
  originalityScore: number;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Deterministic creative fallback ensuring high-fidelity TORIWEAR streetwear concepts
 * even if Gemini text generation is unavailable or experiencing temporary 503 load.
 */
function generateFallbackConcept(input: ConceptGenerationInput): GeneratedConceptData {
  const isKids = input.department === 'KIDS';
  const cleanPrompt = input.prompt.trim();
  const world = input.world || (isKids ? 'Cute Adventure' : 'Dark Shonen');
  const character = input.character || (isKids ? 'Kiki Spark' : 'Ren Kurogane');
  const mood = input.mood || (isKids ? 'Playful' : 'Dark');
  const placement = input.placement || (isKids ? 'Front' : 'Large Back');
  const garmentType = isKids ? 'Heavyweight Youth Crewneck Tee' : 'Oversized Boxy Heavyweight Hoodie (450GSM)';

  // Build clean name
  const words = cleanPrompt.split(/\s+/).slice(0, 3).map((w) => w.toUpperCase());
  const designName = words.length > 0 ? `${words.join(' ')}: ${character.toUpperCase()}` : `${character.toUpperCase()} PROTOCOL`;

  const paletteMap: Record<string, string[]> = {
    'Black / White': ['#000000', '#1a1a1a', '#ffffff', '#e0e0e0'],
    Monochrome: ['#111111', '#333333', '#777777', '#f5f5f5'],
    Neon: ['#0d0e15', '#ff0055', '#00f0ff', '#fbee00'],
    Pastel: ['#fff8f0', '#ffb5c5', '#b5d8ff', '#d1b5ff'],
    'Earth Tone': ['#1f1a16', '#4a3b32', '#8c7355', '#d9c5b2'],
    'Red / Black': ['#0a0a0a', '#1a1a1a', '#e60000', '#ff4d4d'],
    'Blue / Black': ['#080a14', '#121829', '#0070f3', '#70b5ff'],
    'Purple / Black': ['#0d0814', '#1f132b', '#8a2be2', '#d49eff'],
  };

  const palette = paletteMap[input.colorDirection || ''] || ['#0a0a0a', '#1e1e1e', '#e60000', '#ffffff'];

  const story = isKids
    ? `In the vibrant world of ${world}, ${character} sets out to explore uncharted toy dimensions, equipped with boundless curiosity and joyful energy.`
    : `Deep within the neon-drenched sectors of ${world}, ${character} navigates underground syndicate territory under the shroud of rain. Every seam carries the weight of fallen allies.`;

  const designStory = `Crafted specifically for TORIWEAR's ${world} collection, this piece translates ${character}'s narrative into a striking wearable silhouette.`;

  const imagePrompt = `Masterpiece apparel graphic, streetwear screenprint illustration of ${character} from ${world}. ${cleanPrompt}. High contrast, bold silhouette, clean vectors, sharp Japanese typography accents, isolated on pure black background, 8k resolution, suitable for high-density textile printing.`;

  return {
    designName,
    collection: `${world} Vol. 1`,
    department: input.department,
    world,
    character,
    characterPersonality: isKids
      ? ['Inquisitive', 'Loyal', 'High Energy', 'Protective']
      : ['Stoic', 'Relentless', 'Tactical', 'Guarded'],
    ability: isKids ? 'Kinetic Spark Surge' : 'Void Blade Resonance',
    visualIdentity: isKids
      ? 'Chibi action lines, candy gloss highlights, geometric badge emblems'
      : 'Monochrome ink wash splatters, brutalist kanji framing, distressed halftone gradients',
    story,
    designStory,
    mood,
    colorPalette: palette,
    typography: isKids ? 'Rounded Bold Display & Kawaii Subtext' : 'Brutalist Kanji & Distressed Sans Serif',
    graphicElements: ['Halftone Dots', 'Japanese Kanji Glyph', 'Coordinates Barcode', 'Toriwear Crest'],
    printPlacement: placement,
    garmentType,
    printStyle: 'Direct-to-Film & High-Density Puff Ink',
    targetAudience: isKids ? 'Youth Streetwear Enthusiasts & Creative Kids' : 'Anime Subculture & Underground Fashion Connoisseurs',
    marketingHook: `Defy the ordinary. Wear the lore of ${character}.`,
    productDescription: `A premium apparel statement piece engineered with ultra-heavyweight combed cotton. Features custom narrative artwork inspired by ${character}'s journey in ${world}.`,
    tags: ['streetwear', 'anime', world.toLowerCase(), character.toLowerCase(), 'limited-edition', 'toriwear'],
    imagePrompt,
    seoTitle: `${designName} — TORIWEAR Exclusive Streetwear Drop`,
    seoDescription: `Discover ${designName} from TORIWEAR. Premium ${garmentType} featuring original artwork of ${character}.`,
    oneLineStory: `The legend of ${character} begins where the concrete ends.`,
    whyWearing: `A symbol of uncompromising individuality and loyalty to the ${world} faction.`,
    originalityScore: 96,
  };
}

/**
 * Generates the full design concept using Google GenAI (gemini-3.8-flash),
 * falling back gracefully if Gemini is unavailable.
 */
export async function generateConceptWithAI(
  input: ConceptGenerationInput
): Promise<GeneratedConceptData> {
  const ai = getGeminiClient();
  if (!ai) {
    return generateFallbackConcept(input);
  }

  const systemInstruction = `You are the Lead Creative Director & Master Streetwear Designer for TORIWEAR, an original anime-inspired premium streetwear fashion house.
Your mission is to engineer 100% original, rich concept blueprints for limited apparel drops.
Always respond in strictly valid JSON with no markdown formatting.`;

  const prompt = `Generate a complete TORIWEAR apparel design concept based on the following creative specifications:
- User Prompt: "${input.prompt}"
- Department: ${input.department}
- World: ${input.world}
- Character: ${input.character || 'Original Faction Hero'}
- Mood: ${input.mood || 'Dark Streetwear'}
- Placement: ${input.placement || 'Large Back Print'}
- Color Direction: ${input.colorDirection || 'Monochrome / Accent'}
- Garment Type: ${input.department === 'KIDS' ? 'Youth Heavyweight Tee' : 'Oversized Boxy Hoodie'}

Respond with this exact JSON structure:
{
  "designName": "Short catchy apparel name (e.g., VOID WALKER: REN)",
  "collection": "Collection chapter name",
  "department": "${input.department}",
  "world": "${input.world}",
  "character": "Character name",
  "characterPersonality": ["Trait 1", "Trait 2", "Trait 3", "Trait 4"],
  "ability": "Special character ability or signature technique",
  "visualIdentity": "Detailed description of graphic style, lines, textures, and shading",
  "story": "2-3 paragraphs of deep lore backstory",
  "designStory": "Why this design was created and its significance to the collection",
  "mood": "${input.mood || 'Dark'}",
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "typography": "Typeface family and style recommendations (e.g., Brutalist Kanji & Industrial Monospace)",
  "graphicElements": ["Element 1", "Element 2", "Element 3", "Element 4"],
  "printPlacement": "${input.placement || 'Large Back'}",
  "garmentType": "Recommended blank garment",
  "printStyle": "Textile printing technique (e.g., DTF + High-density screenprint)",
  "targetAudience": "Target demographic description",
  "marketingHook": "One memorable advertising punchline",
  "productDescription": "2 paragraphs of customer-facing ecommerce product description",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "imagePrompt": "Detailed visual prompt describing the artwork composition, character pose, lighting, graphic overlays, and isolated background for AI artwork generation",
  "seoTitle": "SEO title under 60 chars",
  "seoDescription": "SEO meta description under 155 chars",
  "oneLineStory": "One punchy narrative summary line",
  "whyWearing": "Psychological reason customers wear this piece",
  "originalityScore": 95
}`;

  // List of high-speed text models for redundancy if one experiences temporary demand spikes
  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed.designName && parsed.story) {
          return {
            ...generateFallbackConcept(input),
            ...parsed,
            department: input.department,
            world: input.world,
          };
        }
      }
    } catch (err: any) {
      const is503 = err?.message?.includes('503') || err?.status === 'UNAVAILABLE' || err?.code === 503;
      if (is503 && model !== candidateModels[candidateModels.length - 1]) {
        // Temporary demand spike on current model; try next candidate model silently
        continue;
      }
      if (!is503) {
        // Non-503 error, break and fallback
        break;
      }
    }
  }

  return generateFallbackConcept(input);
}
