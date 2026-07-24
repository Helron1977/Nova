# Nova

Un éditeur Markdown modulaire par blocs, avec l'IA intégrée directement dans le flux d'édition — pas comme un chat à côté, mais comme un agent qui insère, modifie et supprime des blocs au même titre qu'un geste humain.

Projet personnel, développé seul. Pas de compte, pas de serveur : tout tourne dans le navigateur, avec votre propre clé API (OpenAI, Anthropic, Gemini, ou un point de terminaison compatible).

## Pourquoi

La plupart des intégrations IA dans les éditeurs de texte fonctionnent comme un chat greffé à côté du document : on discute, on copie-colle le résultat. Nova part d'un principe différent — l'IA doit pouvoir agir directement sur la structure du document, bloc par bloc, avec la même fiabilité qu'un utilisateur qui clique et tape.

Trois idées portent le projet :

- **Le document reste du Markdown pur.** Pas de format propriétaire. Un fichier `.md` sauvegardé par Nova reste lisible et éditable dans n'importe quel autre outil — y compris ses blocs personnalisés, qui se dégradent gracieusement en simples blocs de code s'ils ne sont pas reconnus ailleurs.
- **Chaque type de bloc est un module autonome.** Un module déclare lui-même comment analyser son contenu, comment le restituer, comment l'exporter en HTML, et comment se présenter à l'IA. Ajouter un nouveau type de bloc ne touche jamais au cœur de l'application.
- **L'IA propose, l'application décide.** Le modèle ne dispose d'aucun chemin de mutation privilégié. Il répond avec des instructions ciblées (insérer, modifier, supprimer un bloc précis), qui passent par le même mécanisme d'état que n'importe quelle action humaine.

## Fonctionnalités

- Édition par blocs avec glisser-déposer, raccourcis clavier, menu contextuel
- Rendu Markdown complet : titres, listes, tableaux GFM, citations, code, tâches
- Diagrammes Mermaid édités visuellement (clic droit sur un nœud, pas seulement le code source)
- Blocs personnalisés extensibles : palette de couleurs, tableur CSV, dessin, carte géographique, comparaison de variantes IA, flux d'appels API
- Export HTML et PDF fidèle à l'affichage
- Assistant IA multi-fournisseur (OpenAI, Anthropic, Gemini, ou tout point de terminaison compatible) avec retour visuel en direct sur les blocs modifiés

## Architecture

Le code suit une séparation en quatre couches :

```
src/
├── domain/          # Entités métier (Document, Configuration...), indépendantes du framework
├── application/      # Logique : reducer de blocs, parseur Markdown, protocole IA, modules de blocs
├── infrastructure/    # Logging, adaptateurs externes
└── presentation/      # Composants React, rendu, interactions
```

### Le protocole de mutation

L'assistant ne renvoie jamais de JSON structuré. Il répond en Markdown libre, encadré par des balises minimales :

```
<nova:insert after="ID_BLOC">
## Nouvelle section
</nova:insert>

<nova:update id="ID_BLOC">
Contenu remplacé.
</nova:update>

<nova:delete id="ID_BLOC" />
```

Le contenu entre les balises est du Markdown que le modèle maîtrise nativement — pas de grammaire artificielle à apprendre pour le texte lui-même. Un parseur dédié (`novaProtocolParser.ts`) transforme ce flux en actions sur le reducer de blocs (`useBlocksReducer.ts`), le même reducer qui traite les actions au clavier et à la souris.

Ce choix vient d'un abandon assumé du function calling natif des API de LLM : demander à un modèle de produire du contenu long et multi-lignes encapsulé dans une valeur JSON entraîne régulièrement des erreurs d'échappement qui corrompent ou effacent silencieusement des blocs. Le protocole texte n'est pas sans défaut pour autant — il déplace le risque vers la robustesse du parseur plutôt que de l'éliminer — mais il élimine la classe d'erreurs la plus destructrice.

### Les modules de blocs

Chaque bloc personnalisé implémente une interface commune :

```ts
interface BlockModule<T> {
  type: string;
  codeBlockLanguage: string;       // ex: "palette", "apiflow"
  parseContent(raw: string): T;
  RendererComponent: React.FC;
  serializeToHTML(data: T): string;
  getAIPrompt(): string;           // sa propre grammaire, expliquée à l'IA
  getAIASTNode(block): object;     // sa propre représentation dans le contexte envoyé au modèle
}
```

Un module s'appuie sur un mécanisme Markdown déjà standard — le bloc de code à langage nommé — pour son enveloppe, et ne définit que sa grammaire interne :

````
```palette
--lemon-chiffon: #fbf8ccff;
--jordy-blue: #a3c4f3ff;
```
````

Ajouter un module se résume à l'enregistrer une fois (`registerBlockModule(...)`) : le catalogue de capacités de l'IA grandit automatiquement, sans jamais toucher au prompt système à la main.

### Le contexte envoyé au modèle

Le document est représenté sous forme d'AST XML dense avant chaque appel (`astGenerator.ts`). Les blocs volumineux (code long, Mermaid) sont élidés au-delà d'un seuil pour limiter le coût en tokens. Un mécanisme de diff (`astDiff.ts`) permet, sur les tours suivants, de n'envoyer que ce qui a changé depuis la dernière synchronisation plutôt que l'intégralité du document — avec un mécanisme de bascule qui repart d'un instantané complet au-delà d'un certain volume de changements cumulés.

## Stack technique

- React + TypeScript, Vite
- `@dnd-kit` pour le glisser-déposer
- CodeMirror pour l'édition experte des blocs (code, Mermaid)
- Mermaid.js pour les diagrammes
- Vercel AI SDK (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`) pour l'appel multi-fournisseur
- Zustand pour l'état d'interface (thème, préférences) — l'état du document lui-même passe par un reducer + Context API, pas par un store global

## Limites connues

Ce projet est un prototype personnel, pas un produit prêt pour un usage multi-utilisateur :

- La clé API est actuellement stockée côté client (`localStorage`) — adapté à un usage local, pas à un déploiement partagé sans passer par un proxy serveur.
- Pas encore de notion de classeur ou de liens entre plusieurs documents — chaque session porte sur un document unique.
- La couverture de tests reste partielle sur le pipeline IA (protocole de mutation, génération de contexte), plus complète sur le cœur de sérialisation Markdown.

## Licence

À définir. 