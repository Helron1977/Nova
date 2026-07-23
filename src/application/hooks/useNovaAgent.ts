import { useState, useCallback } from 'react';
import { streamText } from 'ai';
import { getLanguageModel } from '../logic/aiService';
import { markdownToBlocks } from '../logic/markdownParser';
import { NovaMutation, extractFirstCompleteMutation } from '../logic/novaProtocolParser';
export function useNovaAgent(
  getSystemContext: () => { contextString: string, omittedBlockIds: string[] },
  blocksManagement: any
) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastMutations, setLastMutations] = useState<NovaMutation[]>([]);

  const applyMutations = useCallback((mutations: NovaMutation[], fallbackAfterId: string | null, omittedBlockIds: string[]) => {
    if (mutations.length === 0) return false;

    for (const mutation of mutations) {
      if (mutation.type === 'INSERT') {
        const newBlocks = markdownToBlocks(mutation.markdownContent);
        let currentAfterId = mutation.afterId ?? fallbackAfterId;
        const insertedIds: string[] = [];
        for (const block of newBlocks) {
          if (currentAfterId) {
            blocksManagement.handleAddBlockAfter({ afterId: currentAfterId, newBlock: block });
          } else {
            blocksManagement.handleAddBlockAtEnd(block);
          }
          currentAfterId = block.id;
          insertedIds.push(block.id);
        }
        (mutation as any).insertedIds = insertedIds; // Store for highlight
      }

      if (mutation.type === 'UPDATE') {
        const blockToUpdate = blocksManagement.blocksState.blocks.find((b: any) => b.id === mutation.blockId);
        
        // NOUVEAU : Garde-fou sur les blocs élidés
        if (blockToUpdate && omittedBlockIds.includes(mutation.blockId)) {
          console.warn(`[NovaAgent] Tentative de modification d'un bloc élidé (${mutation.blockId}). Rejeté.`);
          
          // Transformer silencieusement cet update en message d'alerte
          const alertMd = `\`\`\`ai-message\n⚠️ **Action refusée :** Vous (l'IA) avez tenté de modifier le bloc \`${mutation.blockId}\` dont le contenu vous a été masqué en raison de sa taille excessive. Pour éviter toute perte de données (écrasement à l'aveugle), cette modification a été annulée.\n\`\`\``;
          const warningBlocks = markdownToBlocks(alertMd);
          
          warningBlocks.forEach((warningBlock: any) => {
            blocksManagement.handleAddBlockAfter({ afterId: mutation.blockId, newBlock: warningBlock });
            (mutation as any).insertedIds = (mutation as any).insertedIds || [];
            (mutation as any).insertedIds.push(warningBlock.id);
          });
          
          // On change le type de mutation pour déclencher le highlight de l'avertissement et non du block original
          (mutation as any).type = 'INSERT'; 
          continue;
        }

        const newBlocks = markdownToBlocks(mutation.markdownContent);
        blocksManagement.requestBlockUpdate(mutation.blockId, {} as any, {
          type: 'REPLACE_WITH_BLOCKS',
          newBlocks,
        });
      } else if (mutation.type === 'DELETE') {
        blocksManagement.handleDeleteBlock(mutation.blockId);
      } else if (mutation.type === 'AI_MESSAGE') {
        // Crée un bloc Markdown ai-message pour l'afficher
        const aiBlockMd = `\`\`\`ai-message\n${mutation.content}\n\`\`\``;
        const newBlocks = markdownToBlocks(aiBlockMd);
        blocksManagement.handleAddBlockAtEnd(newBlocks[0]);
        // Note: we don't necessarily highlight ai-messages, but we can if we want.
      }
    }

    // --- NOUVEAU: Feedback Visuel ---
    // Trouver les IDs des blocs touchés par l'IA (INSERT ou UPDATE)
    const affectedBlockIds = mutations
      .filter(m => m.type === 'INSERT' || m.type === 'UPDATE')
      .map(m => m.type === 'INSERT' ? (m as any).insertedIds || [] : [m.blockId])
      .flat();

    if (affectedBlockIds.length > 0) {
      blocksManagement.setAiHighlights(affectedBlockIds);
      // Auto-scroll vers le dernier bloc modifié
      setTimeout(() => {
        const lastId = affectedBlockIds[affectedBlockIds.length - 1];
        const element = document.querySelector(`[data-block-id="${lastId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }

    return true;
  }, [blocksManagement]);

  const submitPrompt = useCallback(async (userPrompt: string) => {
    if (isGenerating) return;

    const model = getLanguageModel();
    if (!model) {
      console.error('[NovaAgent] Aucun modèle IA configuré.');
      alert('Veuillez configurer un fournisseur IA dans le panneau Admin.');
      return;
    }

    try {
      setIsGenerating(true);
    
    // NOUVEAU : Nettoyer les traces de l'ancien prompt
    blocksManagement.deleteBlocksByType('ai-message');
    blocksManagement.clearAiHighlights();

    const newUserMessage = { role: 'user', content: userPrompt };
    const currentMessages = [...messages, newUserMessage];
    setMessages(currentMessages);

      // ID du bloc cible (dernier sélectionné ou fin du doc)
      const selectedIds = blocksManagement.blocksState.selectedBlockIds as string[];
      const fallbackAfterId = selectedIds.length > 0
        ? selectedIds[selectedIds.length - 1]
        : (blocksManagement.blocksState.blocks.length > 0
            ? blocksManagement.blocksState.blocks[blocksManagement.blocksState.blocks.length - 1]?.id
            : null);

      const { contextString, omittedBlockIds } = getSystemContext();

      // Pas de tool() — l'IA répond en texte avec le protocole Nova
      const result = await streamText({
        model,
        system: contextString,
        messages: currentMessages,
      });

      // Consommer le stream au fur et à mesure
      let fullText = '';
      let buffer = '';
      let hasAppliedAnyMutation = false;
      let currentFallbackAfterId = fallbackAfterId;
      const allMutations: NovaMutation[] = [];

      for await (const chunk of result.textStream) {
        fullText += chunk;
        buffer += chunk;

        // Tant qu'on trouve des balises complètes dans le buffer, on les extrait et on les applique
        let extraction = extractFirstCompleteMutation(buffer);
        while (extraction !== null) {
          const { mutation, endIndex } = extraction;
          allMutations.push(mutation);
          
          // Appliquer la mutation individuellement
          const applied = applyMutations([mutation], currentFallbackAfterId, omittedBlockIds);
          if (applied) {
            hasAppliedAnyMutation = true;
            
            // Si c'est un INSERT, le prochain INSERT par défaut se fera après ce nouveau bloc
            if (mutation.type === 'INSERT') {
              const insertedIds = (mutation as any).insertedIds || [];
              if (insertedIds.length > 0) {
                currentFallbackAfterId = insertedIds[insertedIds.length - 1];
              }
            }
          }
          
          // Vider la portion traitée du buffer
          buffer = buffer.substring(endIndex);
          
          // Chercher s'il y a une autre balise complète dans le reste du buffer
          extraction = extractFirstCompleteMutation(buffer);
        }
      }

      setLastMutations(allMutations);

      if (!hasAppliedAnyMutation) {
        // L'IA n'a utilisé aucune balise (ou du moins aucune balise valide) — fallback
        const trimmed = fullText.trim();
        if (trimmed) {
          console.warn('[NovaAgent] Aucune balise <nova:*> détectée. Insertion du texte brut en fallback.');
          
          const warningMd = `\`\`\`ai-message\n⚠️ **Avertissement :** L'IA n'a pas utilisé le protocole attendu pour modifier le document. Voici sa réponse brute ci-dessous :\n\`\`\``;
          const warningBlocks = markdownToBlocks(warningMd);
          const newBlocks = [...warningBlocks, ...markdownToBlocks(trimmed)];
          
          let currentAfterId = fallbackAfterId;
          const insertedIds: string[] = [];
          for (const block of newBlocks) {
            if (currentAfterId) {
              blocksManagement.handleAddBlockAfter({ afterId: currentAfterId, newBlock: block });
            } else {
              blocksManagement.handleAddBlockAtEnd(block);
            }
            currentAfterId = block.id;
            insertedIds.push(block.id);
          }
          
          blocksManagement.setAiHighlights(insertedIds);
          setTimeout(() => {
            const lastId = insertedIds[insertedIds.length - 1];
            const element = document.querySelector(`[data-block-id="${lastId}"]`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
        }
      } else if (buffer.trim()) {
        // Troncature ou texte hors-protocole résiduel à la fin du stream
        console.warn('[NovaAgent] Génération interrompue ou reliquat hors-protocole détecté. Insertion en fallback.');
          
        const warningMd = `\`\`\`ai-message\n⚠️ **Génération interrompue ou tronquée :** La réponse de l'IA a été coupée avant la fin d'une balise ou contient du texte non valide à la fin. Voici le contenu brut récupéré :\n\`\`\``;
        const warningBlocks = markdownToBlocks(warningMd);
        const newBlocks = [...warningBlocks, ...markdownToBlocks(buffer.trim())];
        
        let currentAfterId = currentFallbackAfterId; // Insert at the end of whatever was being done
        const insertedIds: string[] = [];
        for (const block of newBlocks) {
          if (currentAfterId) {
            blocksManagement.handleAddBlockAfter({ afterId: currentAfterId, newBlock: block });
          } else {
            blocksManagement.handleAddBlockAtEnd(block);
          }
          currentAfterId = block.id;
          insertedIds.push(block.id);
        }
        
        // Auto-scroll vers ce bloc final
        blocksManagement.setAiHighlights(insertedIds);
        setTimeout(() => {
          const lastId = insertedIds[insertedIds.length - 1];
          const element = document.querySelector(`[data-block-id="${lastId}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }

      // NOUVEAU : Historique conversationnel allégé (Point 7)
      // Ne conserver dans l'historique que l'intention (say) et un résumé des actions.
      const conversationalText = allMutations
        .filter(m => m.type === 'AI_MESSAGE')
        .map(m => (m as any).content)
        .join('\n');
      
      const modifierMutationsCount = allMutations.filter(m => m.type !== 'AI_MESSAGE').length;
      let summary = conversationalText;
      
      if (modifierMutationsCount > 0) {
        const summaryPrefix = `[Document mis à jour : ${modifierMutationsCount} modification(s)]`;
        summary = summary ? `${summaryPrefix}\n\n${summary}` : summaryPrefix;
      }
      
      if (!summary) {
         // Si l'IA n'a utilisé aucune balise valide (ex: texte brut)
         // On ne stocke pas le texte brut complet dans l'historique pour ne pas le polluer
         summary = `[Réponse hors protocole : ${fullText.length} caractères]`;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: summary }]);

    } catch (error) {
      console.error('[NovaAgent] Erreur:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [messages, getSystemContext, blocksManagement, applyMutations, isGenerating]);

  const clearSession = useCallback(() => {
    setMessages([]);
    setLastMutations([]);
  }, []);

  return { messages, submitPrompt, isGenerating, clearSession, lastMutations };
}
