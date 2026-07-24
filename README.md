# Nova : Éditeur Markdown Modulaire Assisté par IA

Nova est un éditeur Markdown modulaire, organisé en blocs — un paragraphe, un titre, une liste, un tableau, un diagramme sont autant d'unités indépendantes qu'on peut éditer, déplacer, transformer. Rien d'original jusque-là : c'est le principe qu'on retrouve dans Notion, dans Confluence, dans beaucoup d'éditeurs modernes. Je le développe seul, sur mon temps libre.

Ce qui m'intéressait en le construisant, c'était la couche suivante : brancher un assistant IA capable de lire ce document, comprendre sa structure, et le modifier de façon fiable — insérer une section, reformuler un paragraphe, générer un diagramme — sans jamais corrompre l'ensemble ni passer par une interface de chat externe déconnectée du canevas.

Ma première tentative a suivi la voie standard : le function calling natif des API de LLM (Gemini, dans mon cas, via Vertex AI). Le modèle répond avec un objet JSON structuré, l'application l'interprète, tout est propre sur le papier. Sauf que dans la pratique, dès qu'on demande à un modèle de produire du contenu long et multi-lignes — un paragraphe entier, du code, un tableau — encapsulé dans une valeur JSON, les guillemets et les sauts de ligne mal échappés finissent régulièrement par casser la structure ou, pire, effacer silencieusement des blocs entiers du document.

Ce n'est pas une anecdote isolée. C'est un problème documenté dans l'écosystème des outils d'édition assistée par IA — plusieurs agents de code réputés sont passés par le même constat et ont fini par préférer des formats texte à délimiteurs plutôt que du JSON strict, précisément pour cette raison.

## Le protocole de mutation

J'ai donc abandonné le function calling natif au profit d'un protocole texte maison. Le modèle répond en Markdown libre, mais encadré par des balises légères qui indiquent l'intention :

- `nova:insert after="ID_BLOC"` — insérer du contenu après un bloc existant
- `nova:update id="ID_BLOC"` — remplacer le contenu d'un bloc
- `nova:delete id="ID_BLOC"` — supprimer un bloc

Entre ces balises, le modèle écrit du Markdown pur — celui qu'il maîtrise le mieux, celui sur lequel il a été massivement entraîné. Pas de grammaire artificielle à respecter pour le contenu lui-même, seulement pour son enveloppe. Ce point mérite d'être précisé : la sortie du LLM n'est jamais interprétée comme du texte libre qu'on essaierait de comprendre après coup. C'est une **intention d'action typée** — insérer, mettre à jour, supprimer — ciblée sur l'identifiant précis d'un bloc du document. Le modèle ne génère pas un nouveau document, il décrit une mutation à appliquer à un document existant.

Un parseur côté application lit ce flux et déclenche les mutations correspondantes sur l'état réel du document, géré par un `useReducer` classique et distribué dans l'arbre React via le Context API — le même chemin de mutation que celui qui traite les actions de l'utilisateur au clavier ou à la souris. C'est un point auquel je tiens : le LLM ne dispose d'aucun chemin de mutation privilégié. Il propose des actions ; l'application les valide et les applique exactement comme si elles venaient d'un clic humain. La frontière entre le raisonnement probabiliste du modèle et l'exécution déterministe de l'application reste nette, à un seul endroit du code.

Ce protocole texte n'est pas pour autant sans défaut. Il élimine les erreurs de formatage bloquantes qu'on rencontre avec du JSON strict, mais il déplace le risque ailleurs : une balise mal fermée par une génération interrompue, ou un contenu qui contiendrait accidentellement la séquence de fermeture d'une balise, restent des cas à gérer explicitement côté parseur plutôt que résolus par construction.

## Le cœur du système : la boucle parseur, rendu, état, portée par le bloc

S'il y a une décision d'architecture dont je suis particulièrement fier dans ce projet, c'est celle-ci, et elle est plus structurante que le protocole de mutation lui-même : chaque type de bloc, y compris les blocs "custom" ajoutés après coup, porte l'intégralité de son propre cycle de vie. Un module déclare en un seul endroit comment analyser son contenu Markdown brut, comment le restituer visuellement en React, comment le sérialiser en HTML pour l'export, et comment expliquer sa propre grammaire à l'IA.

Ajouter un nouveau type de bloc à Nova ne demande jamais de modifier le cœur de l'application, ni de patcher le prompt système à la main. Le catalogue de capacités de l'IA grandit automatiquement avec le catalogue de modules, puisque chaque module contribue lui-même ses instructions, agrégées dynamiquement à l'exécution. C'est une application directe du principe ouvert/fermé : le système est ouvert à l'extension, fermé à la modification.

Concrètement, ces blocs custom s'appuient sur un mécanisme Markdown déjà standard, le bloc de code à langage nommé. Un module "palette de couleurs" se présente ainsi :

```palette
--lemon-chiffon: #fbf8ccff;
--jordy-blue: #a3c4f3ff;
```

Le modèle n'a besoin d'apprendre qu'une seule chose nouvelle : la syntaxe interne du langage palette. La structure d'enveloppe, un bloc de code délimité par trois accents graves, il la connaît déjà parfaitement. C'est un choix qui paie doublement : la fiabilité de génération augmente, et la dégradation reste gracieuse. Si ce document est un jour ouvert dans un autre éditeur Markdown qui ne connaît pas ce module, le bloc palette ne casse rien, il s'affiche simplement comme un bloc de code brut, lisible, jamais comme une erreur.

Deux exemples récents illustrent cette logique. Un bloc "variantes" permet à l'IA de proposer plusieurs versions d'un même passage, plusieurs tons, plusieurs longueurs, sans jamais écraser l'original ; l'utilisateur compare puis adopte la version qui lui convient. Un bloc "flux API" permet de représenter, en conception, une séquence d'appels d'endpoints avec les liaisons d'attributs entre eux : quel champ retourné par un appel devient le paramètre d'un appel suivant. Dans les deux cas, le rendu visuel est entièrement calculé côté application à partir d'une grammaire texte simple, sans dépendre d'un outil de diagramme externe, et sans qu'aucune ligne du cœur de l'éditeur n'ait eu à être modifiée pour les accueillir.

## Le vrai défi : le contexte, pas le rendu

Une fois qu'on a résolu la génération et le rendu, le problème le plus difficile de tout le projet apparaît ailleurs : comment faire comprendre à chaque nouvel appel du modèle l'état exact du document, sans reconstituer et renvoyer l'intégralité de son contenu à chaque échange ?

La réponse évidente, un historique de conversation classique qui accumule les échanges, pose un problème de fond : le contenu d'un bloc peut avoir été modifié entre deux tours, à la main, sans que le LLM en soit informé. S'appuyer sur une mémoire conversationnelle du contenu, c'est risquer de raisonner sur un état obsolète.

La solution que j'ai retenue repose sur un compteur de révision, incrémenté à chaque mutation du document, qu'elle vienne de l'IA ou d'une édition manuelle. L'application garde en mémoire la dernière révision effectivement envoyée au modèle. À l'appel suivant, elle calcule elle-même, en code, la différence entre cet état et l'état courant, et n'envoie que ce différentiel, avec un mécanisme de bascule : au-delà d'un certain volume de changements cumulés, on repart d'un instantané complet plutôt que d'accumuler indéfiniment des diffs. L'historique de conversation, lui, reste volontairement léger : il conserve l'intention exprimée par l'utilisateur, jamais le contenu du document lui-même. C'est cette séparation stricte entre intention et contenu qui donne à l'ensemble sa traçabilité : à tout instant, on sait ce qui a changé, quand, et à quelle initiative, humaine ou IA.

## Ce que j'en retiens

L'exercice de conception m'a appris quelque chose que je n'attendais pas au départ : les meilleures décisions n'ont presque jamais consisté à inventer un format nouveau. Elles ont consisté à identifier, à chaque étape, ce que le modèle savait déjà faire nativement, du Markdown, un bloc de code, un diagramme Mermaid, un tableau GFM, et à construire l'architecture tout autour, en réservant la nouveauté au strict minimum nécessaire, tout en gardant l'humain seul décisionnaire de ce qui est effectivement appliqué au document.

C'est probablement la seule vraie règle de conception que je retiendrais d'un projet comme celui-ci : **plus l'IA doit apprendre une convention artificielle pour interagir avec votre système, plus vous introduisez de risque d'erreur. La fiabilité ne vient pas d'un protocole plus strict, mais d'un protocole qui exige le moins possible du modèle, et d'une architecture où chaque brique sait, par elle-même, se présenter à l'IA sans qu'on ait à le lui apprendre de l'extérieur.**

---

## 🚀 Démarrage Rapide

### Stack Technique
* **Frontend** : React 19, TypeScript, TailwindCSS 4, Vite
* **State** : Zustand (UI) + Context API / useReducer (Document)
* **Édition** : CodeMirror, dnd-kit (Drag&Drop)
* **LLM** : Vertex AI / Gemini API
* **Backend as a Service** : Firebase (Auth, Hosting)

### Prérequis
* Node.js (v18+)

### Installation
```bash
npm install
```

### Configuration
Créez un fichier `.env.development` à la racine :
```env
VITE_LOG_LEVEL=warn
VITE_FIREBASE_API_KEY=votre_cle_api
VITE_FIREBASE_AUTH_DOMAIN=votre_domaine
VITE_FIREBASE_PROJECT_ID=votre_projet
VITE_FIREBASE_STORAGE_BUCKET=votre_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=votre_id
VITE_FIREBASE_APP_ID=votre_app_id
```

### Lancement
```bash
npm run dev
```

### Tests
```bash
npm run test
``` 