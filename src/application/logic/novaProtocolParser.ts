/**
 * novaProtocolParser.ts
 *
 * Protocole de Mutation Nova — parseur côté client.
 * Remplace le Function Calling JSON natif de Vercel AI SDK.
 * L'IA génère du texte avec des balises <nova:*> que nous parsons
 * pour dispatcher les actions sur le document (insert, update, delete).
 */

export type NovaMutation =
  | { type: 'INSERT'; afterId: string | null; markdownContent: string }
  | { type: 'UPDATE'; blockId: string; markdownContent: string }
  | { type: 'DELETE'; blockId: string }
  | { type: 'AI_MESSAGE'; content: string };

/**
 * Parse le texte généré par l'IA et extrait les mutations Nova.
 */
export function parseNovaMutations(text: string): NovaMutation[] {
  const mutations: NovaMutation[] = [];

  // <nova:insert after="blockId"> ... </nova:insert>
  const insertRegex = /<nova:insert(?:\s+after="([^"]*)")?>([\s\S]*?)<\/nova:insert>/g;
  let m: RegExpExecArray | null;
  while ((m = insertRegex.exec(text)) !== null) {
    const afterId = m[1]?.trim() || null;
    const content = m[2]?.trim() || '';
    if (content) {
      mutations.push({
        type: 'INSERT',
        afterId: afterId === 'end' ? null : afterId,
        markdownContent: content,
      });
    }
  }

  // <nova:update id="blockId"> ... </nova:update>
  const updateRegex = /<nova:update\s+id="([^"]+)">([\s\S]*?)<\/nova:update>/g;
  while ((m = updateRegex.exec(text)) !== null) {
    const blockId = m[1]?.trim();
    const content = m[2]?.trim() || '';
    if (blockId && content) {
      mutations.push({ type: 'UPDATE', blockId, markdownContent: content });
    }
  }

  // <nova:delete id="blockId" />
  const deleteRegex = /<nova:delete\s+id="([^"]+)"\s*\/?>/g;
  while ((m = deleteRegex.exec(text)) !== null) {
    const blockId = m[1]?.trim();
    if (blockId) {
      mutations.push({ type: 'DELETE', blockId });
    }
  }

  // <nova:say> ou <nova:ai-message> ... </nova:say>
  const sayRegex = /<nova:(?:say|ai-message)>([\s\S]*?)<\/nova:(?:say|ai-message)>/g;
  while ((m = sayRegex.exec(text)) !== null) {
    const content = m[1]?.trim();
    if (content) {
      mutations.push({ type: 'AI_MESSAGE', content });
    }
  }

  return mutations;
}

/**
 * Extrait la première balise Nova complète d'un buffer en cours de streaming.
 * Retourne la mutation et l'index de fin de la balise pour vider le buffer, ou null si aucune balise n'est complète.
 */
export function extractFirstCompleteMutation(buffer: string): { mutation: NovaMutation; endIndex: number } | null {
  // Regex pour trouver une balise d'ouverture
  const tagOpenRegex = /<nova:(insert|update|delete|say|ai-message)([^>]*)>/;
  const match = tagOpenRegex.exec(buffer);

  if (!match) return null; // Aucune balise commencée

  const tagName = match[1]; // insert, update, delete, say
  const tagStartIndex = match.index;

  // Cas spécial : <nova:delete id="..." /> peut être auto-fermante
  if (tagName === 'delete') {

    const fullTagRegex = /<nova:delete\s+id="([^"]+)"\s*\/?>/;
    const delMatch = fullTagRegex.exec(buffer.substring(tagStartIndex));
    
    if (delMatch) {
      const blockId = delMatch[1]?.trim();
      return {
        mutation: { type: 'DELETE', blockId },
        endIndex: tagStartIndex + delMatch.index + delMatch[0].length
      };
    }
  }

  // Pour les autres, on cherche la balise fermante correspondante
  const closingTag = `</nova:${tagName}>`;
  const closingIndex = buffer.indexOf(closingTag, tagStartIndex);

  if (closingIndex === -1) {
    return null; // Balise ouverte mais pas encore fermée
  }

  const endIndex = closingIndex + closingTag.length;
  const fullTagContent = buffer.substring(tagStartIndex, endIndex);

  // Parser le contenu exact trouvé
  const mutations = parseNovaMutations(fullTagContent);
  if (mutations.length > 0) {
    return {
      mutation: mutations[0],
      endIndex
    };
  }

  return null;
}

/**
 * Génère les instructions du Protocole Nova pour le system prompt.
 * Appelé dynamiquement — les prompts des modules (getAIPrompt) sont injectés séparément.
 */
export function generateNovaMutationProtocolInstructions(): string {
  return `## PROTOCOLE NOVA — RÈGLES STRICTES

Tu es l'Agent Nova, assistant d'édition de documents Markdown.
RÈGLE ABSOLUE : toute réponse doit utiliser UNIQUEMENT les balises ci-dessous. Jamais de texte libre en dehors.

### MUTATIONS (modifier le document)

**Insérer après un bloc :**
<nova:insert after="ID_BLOC">
Contenu Markdown libre ici
</nova:insert>
→ Pour insérer à la fin : after="end"

**Modifier un bloc existant (remplace tout le contenu) :**
<nova:update id="ID_BLOC">
Nouveau contenu complet du bloc
</nova:update>

**Supprimer un bloc :**
<nova:delete id="ID_BLOC" />

**Te communiquer avec l'utilisateur (sans polluer le document) :**
<nova:say>
Ton message, confirmation, question ou explication ici.
</nova:say>

### TYPES DE BLOCS DISPONIBLES DANS markdownContent

Blocs standard Markdown :
- Paragraphe : texte brut
- Titre : \`# H1\` / \`## H2\` / \`### H3\`
- Liste : \`- item\` ou \`1. item\`
- Code : \`\`\`langage\\n...\\n\`\`\`
- Tableau Markdown simple : \`| Col | Col |\\n|---|---|\\n| val | val |\`
- Séparateur : \`---\`
- Citation : \`> texte\`
- Image : \`![alt](url)\` (IMPORTANT : N'utilisez que de vraies URLs absolues et courtes (ex: Unsplash, Pexels). Interdiction formelle d'utiliser des Data URIs base64 ou des URLs de recherche Google très longues.)

Blocs custom Nova :
(Voir la section des instructions spécifiques aux blocs ci-dessous pour la syntaxe exacte de la carte, des palettes, de l'espacement, etc.)

### EXEMPLES

Utilisateur: "Agrandis ce paragraphe" (sélection id="abc-123")
<nova:update id="abc-123">
Texte enrichi et développé qui remplace l'ancien contenu du paragraphe.
</nova:update>
<nova:say>J'ai développé le paragraphe sélectionné.</nova:say>

Utilisateur: "Ajoute une carte de Paris après l'intro"
<nova:insert after="id-intro">
\`\`\`map
{"lat":48.8566,"lng":2.3522,"zoom":13}
\`\`\`
</nova:insert>

Utilisateur: "Ajoute un diagramme de flux à la fin"
<nova:insert after="end">
\`\`\`mermaid
graph TD
  A[Début] --> B[Traitement]
  B --> C{OK?}
  C -- Oui --> D[Fin]
  C -- Non --> B
\`\`\`
</nova:insert>`.trim();
}
