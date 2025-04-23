{
  "index": {
    "Objectif Général": "Objectif Général",
    "Structure Interface": "Structure Générale de l\'Interface",
    "Fonctionnalités Clés": "Fonctionnalités Clés",
    "Interaction IA": "Interaction avec l\'IA",
    "Interaction Diagramme": "Interaction Directe avec le Diagramme",
    "Gestion Configurations": "Gestion des Configurations",
    "Modes Application": "Modes de l\'Application",
    "Concepts Centraux": "Concepts Centraux",
    "Structure Données": "Structure des Données (Identifiée)"
  }
}

# Description de l'Application Cible "NOVA"

Basé sur l'analyse de la capture d'écran et des clarifications fournies.

## Objectif Général

Application web de type éditeur avancé permettant de créer, visualiser, modifier et gérer des documents combinant du texte **Markdown** et des diagrammes **Mermaid**, avec des fonctionnalités d'assistance IA et d'interaction directe sur les diagrammes. L'application vise à réécrire une application legacy en utilisant une stack moderne et une architecture hexagonale.

## Structure Générale de l'Interface

L'interface utilisateur est divisée en plusieurs panneaux principaux :

1.  **Panneau d'Édition :**
    *   Zone de texte principale pour saisir/modifier du contenu Markdown et le code source Mermaid. La largeur de ce panneau peut varier selon le mode d'affichage.
    *   Bouton "Générer" pour interroger une IA et injecter le script Mermaid résultant dans l'éditeur.

2.  **Panneau de Prévisualisation :**
    *   Affiche le rendu visuel du diagramme Mermaid (mis à jour en temps réel lors de la modification du code) et la prévisualisation du Markdown. La largeur de ce panneau peut varier.
    *   Permet une interaction directe avec le diagramme rendu (voir section dédiée).

3.  **Panneau de Guide/Documentation :**
    *   Contient des informations sur les fonctionnalités et le mode d'emploi, y compris l'interaction avec les prévisualisations. Accessible via une icône d'aide.

4.  **Barre d'Outils/En-tête Supérieure :**
    *   Logo "NOVA".
    *   Sélecteur de "Configuration" (liste les configurations disponibles depuis la base de données/API ou une démo locale).
    *   Boutons d'action : "Charger" (JSON local), "Sauvegarder JSON" (export local), "Exporter HTML", "Ouvrir" (vue dédiée).
    *   Sélecteurs de mode : "Normal" / "Admin".
    *   Contrôles optionnels : Thème (Sombre/Clair), Aide, Profil.

## Fonctionnalités Clés

*   **Édition Markdown:** Rédaction et formatage de texte.
*   **Édition Mermaid:** Écriture de code pour générer des diagrammes, avec prévisualisation live.
*   **Interaction avec l'IA:** Bouton "Générer" pour obtenir du code Mermaid généré par IA.
*   **Interaction Directe avec le Diagramme:** Modification des formes, couleurs, flèches via un menu contextuel sur la prévisualisation.
*   **Gestion des Configurations:** Sauvegarde/chargement de l'état complet de l'éditeur (voir section dédiée).
*   **Export HTML:** Génération d'un fichier HTML contenant le rendu combiné Markdown + Mermaid.
*   **Export/Import JSON:** Sauvegarde et chargement de la définition complète d'une configuration sur le disque local.
*   **Visualisation Dédiée ("Ouvrir"):** Affichage du diagramme dans un nouvel onglet avec contrôles de navigation (zoom, déplacement).

## Interaction avec l'IA

*   Le bouton "Générer" déclenche un appel à une API d'IA (dont l'adresse et la clé sont définies dans la configuration en mode Admin).
*   Un "preprompt" (également défini dans la configuration) est probablement utilisé pour guider l'IA.
*   Le script Mermaid retourné par l'IA remplace le contenu Mermaid dans l'éditeur.

## Interaction Directe avec le Diagramme

*   L'utilisateur peut interagir avec le diagramme rendu dans la zone de prévisualisation.
*   Un menu contextuel permet de modifier les propriétés visuelles (couleurs, formes, flèches) des éléments du diagramme.
*   La logique sous-jacente provient de modules isolés du code legacy (`mermaid-flowchart-node-color-utils.js`, `mermaid-shape-modifier.js`).

## Gestion des Configurations

*   **Définition (Mode Admin):** Une configuration est créée/gérée en mode Admin et inclut: nom, adresse API IA, clé API IA, preprompt IA, template Mermaid, template Markdown.
*   **Stockage:** Les configurations sont stockées en base de données (mode API) ou une configuration de démo est chargée (mode local).
*   **Sélection:** L'utilisateur choisit la configuration active via un menu déroulant.
*   **Sauvegarde/Chargement Fichier:**
    *   `Sauvegarder JSON`: Exporte la configuration *active* (telle que définie en base/local) vers un fichier JSON sur le disque.
    *   `Charger`: Importe une configuration depuis un fichier JSON local, écrasant potentiellement la configuration active en mémoire (comportement si non sauvegardé à préciser).

## Modes de l'Application

*   **Mode Normal:** Affiche l'interface utilisateur standard pour l'édition et la visualisation (éditeurs, sélecteur de config, previews).
*   **Mode Admin:** Affiche des champs supplémentaires pour éditer *tous les attributs* de la configuration active (y compris API IA, preprompt, templates, etc.).
*   **Modes d'Affichage (Focus):** Ajustent la largeur relative des panneaux éditeur et prévisualisation.
*   **Mode API / Mode Local:** Détermine si les configurations sont chargées depuis une base de données/API ou si une configuration de démonstration locale est utilisée.
*   **Thème Sombre/Clair:** Option d'affichage pour l'interface (impact sur l'export non spécifié mais thème sombre souhaité).

## Concepts Centraux

*   **Configuration:** L'objet de données principal contenant tous les paramètres (y compris le contenu éditable) nécessaires au fonctionnement de l'application pour un cas d'usage donné. Géré en mode Admin, stocké en base/local, exportable/importable en JSON.
*   **Document/Contenu Éditable:** La partie de la configuration contenant le texte Markdown et le code Mermaid, modifiable par l'utilisateur en mode Normal.

## Structure des Données (Identifiée)

L'analyse du fichier `configscopy.json` révèle la structure suivante pour un objet "Configuration":

```typescript
interface ConfigurationContent {
  markdown: string;       // Contenu Markdown brut
  mermaid: string;        // Code source Mermaid brut
  timestamp?: string;      // Timestamp ISO 8601 (dernière modif contenu?)
}

interface Configuration {
  _id: string;            // Identifiant unique (legacy DB)
  name: string;           // Nom de la configuration
  preprompt?: string;      // Preprompt pour l'IA
  api?: {
    url?: string;        // URL de l'API IA
    key?: string;        // Clé de l'API IA
  };
  content: string;        // !! Chaîne JSON sérialisée contenant ConfigurationContent !!
  created_at?: {           // Date de création (legacy format)
    "$$date": number;    // Timestamp millisecondes
  };
  updated_at?: {           // Date de MàJ (legacy format)
    "$$date": number;    // Timestamp millisecondes
  };
}
```

**Points importants:**

*   Le champ `content` n'est pas un objet direct mais une **chaîne JSON** qui doit être désérialisée pour accéder aux champs `markdown`, `mermaid`, et `timestamp`.
*   Les champs `_id`, `created_at`, `updated_at` utilisent des formats spécifiques (probablement de NeDB) qui devront être gérés ou adaptés lors de la migration/implémentation.
*   Certains champs comme `preprompt`, `api`, `created_at`, `updated_at` peuvent être optionnels selon les objets trouvés. 