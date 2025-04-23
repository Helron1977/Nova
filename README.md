# Boilerplate React/Vite/TS/Tailwind - Architecture Hexagonale

Ce répertoire (`app_vite/`) contient un boilerplate solide pour démarrer une application web frontend moderne, en mettant l'accent sur une architecture propre (inspirée de l'Architecture Hexagonale / Clean Architecture).

## Objectif

Fournir une base de code organisée, testable et maintenable pour une application React utilisant Vite, TypeScript et Tailwind CSS.

## Stack Technique

*   **Framework UI :** React 19
*   **Build Tool :** Vite 6
*   **Langage :** TypeScript 5
*   **Styling :** Tailwind CSS 4 (intégré via `@tailwindcss/vite`)
*   **Tests :** Vitest (configuré pour l'environnement `jsdom`)
*   **Appels HTTP :** Axios
*   **Logging :** Pino (via un adaptateur)

## Structure des Dossiers (`src/`)

La structure est organisée par couches, conformément aux principes de la Clean Architecture / Hexagonale :

*   `domain/`: Contient la logique métier principale, indépendante de tout framework ou détail technique.
    *   Entités (ex: `Configuration.ts`, `Document.ts`)
    *   Value Objects
    *   Règles Métier Pures
*   `application/`: Orchestre les cas d'utilisation (Use Cases) de l'application.
    *   `ports/`: Définit les interfaces (contrats) nécessaires pour interagir avec le monde extérieur (Infrastructure) ou le domaine.
        *   `driven/` (ou `output/` ou `repositories/`) : Interfaces pour les dépendances externes (ex: `IConfigurationRepository`).
        *   `driver/` (ou `input/` ou `use_cases/`) : Interfaces pour les cas d'utilisation eux-mêmes (moins courant si les Use Cases sont des classes).
        *   `logging/`: Interface `ILogger`.
        *   `settings/`: Interface `IAppSettingsRepository`.
    *   `use_cases/`: Implémentations des cas d'utilisation (ex: `GetConfigurationUseCase.ts`).
*   `infrastructure/`: Contient les implémentations concrètes des ports définis dans l'application, interagissant avec des outils/services externes.
    *   `adapters/`: Implémentations des ports (ex: `api/`, `storage/`, `settings/`).
    *   `logging/`: Implémentation du logger (`PinoLogger.ts`).
    *   `repositories/`: Contient la factory (`RepositoryFactory.ts`) qui fournit les bonnes implémentations des repositories en fonction de la configuration.
*   `presentation/`: Couche UI (React).
    *   `components/`: Composants React réutilisables (ex: `base/`, `layout/`).
    *   `hooks/`: Hooks React personnalisés.
    *   `pages/` ou `views/`: Composants représentant des pages complètes (si le routing est ajouté).
*   `styles/`: Fichiers CSS globaux (ex: `tailwind.css`).

**Fichiers à la racine de `src/`:**

*   `main.tsx`: Point d'entrée de l'application React.
*   `App.tsx`: Composant React racine.
*   `vite-env.d.ts`: Déclarations de types pour Vite.
*   `setupTests.ts`: Fichier de configuration globale pour Vitest.

## Démarrage Rapide

1.  **Installer les dépendances :**
    ```bash
    npm install
    ```
2.  **Lancer le serveur de développement :**
    ```bash
    npm run dev
    ```
    L'application sera généralement accessible sur `http://localhost:5173` (ou un port voisin si celui-ci est occupé).

3.  **Lancer les tests :**
    ```bash
    npm run test
    ```

## Configuration

*   **Vite (`vite.config.ts`) :** Configuration principale de Vite, incluant les plugins React et Tailwind, ainsi que la configuration de Vitest.
*   **Tailwind (`tailwind.config.js`) :** Configuration de Tailwind CSS (personnalisation du thème, plugins, etc.). Les styles sont importés via `src/styles/tailwind.css`.
*   **TypeScript (`tsconfig.json`) :** Configuration du compilateur TypeScript.
*   **Variables d'Environnement (`.env`, `.env.development`, etc.) :** Utilisées pour configurer des aspects comme le niveau de log.
    *   `VITE_LOG_LEVEL`: Contrôle le niveau de verbosité du logger (`trace`, `debug`, `info`, `warn`, `error`, `silent`). La valeur dans `.env.development` est utilisée pour `npm run dev`. La valeur dans `.env` est utilisée par défaut pour la production (`npm run build`).

## Architecture & Concepts Clés

*   **Ports & Adapters (Hexagonal) :** L'application définit des *ports* (interfaces dans `src/application/ports/`) qui représentent ses besoins (ex: `ILogger`, `IConfigurationRepository`). L'infrastructure fournit des *adaptateurs* (`src/infrastructure/adapters/` et `src/infrastructure/logging/`) qui implémentent ces interfaces en utilisant des outils concrets (ex: `PinoLogger`, `LocalStorageConfigurationRepository`, `ConfigurationApiAdapter`).
*   **Injection de Dépendances (Simplifiée) :** La `RepositoryFactory` (`src/infrastructure/repositories/RepositoryFactory.ts`) agit comme un localisateur de services simple pour fournir les bonnes instances de repositories et de logger en fonction du mode de l'application (actuellement déterminé via `LocalStorageAppSettingsRepository`). Dans une application plus complexe, un véritable conteneur d'injection de dépendances pourrait être utilisé.
*   **Découplage :** Grâce aux interfaces, le code de l'application et du domaine ne dépend pas directement des bibliothèques externes ou des détails d'implémentation de l'infrastructure.

## Contribuer & Étendre

### Ajouter une Dépendance

```bash
# Pour une dépendance de runtime
npm install <nom-du-package>

# Pour une dépendance de développement (ex: outil de test, linter)
npm install -D <nom-du-package>

# Si la dépendance est en TypeScript ou si des types sont disponibles séparément
npm install -D @types/<nom-du-package>
```

*Note :* Ce boilerplate utilise des outils modernes (Vite, pino) qui gèrent bien les modules ES (ESM). Si vous ajoutez une dépendance plus ancienne utilisant principalement CommonJS, vous *pourriez* (rarement) avoir besoin d'ajuster la configuration de Vite ou Vitest (`vite.config.ts`), mais essayez d'abord sans configuration supplémentaire.

### Changer une Implémentation (ex: Remplacer le Logger)

C'est là que l'architecture Ports & Adapters montre sa force :

1.  **Identifier le Port :** Trouvez l'interface définissant le contrat dont vous voulez changer l'implémentation (ex: `src/application/ports/logging/ILogger.ts`).
2.  **Créer le Nouvel Adaptateur :** Créez une nouvelle classe dans `src/infrastructure/` (ex: `src/infrastructure/logging/WinstonLogger.ts`) qui **implémente** l'interface `ILogger` en utilisant la nouvelle bibliothèque (ex: `winston`).
3.  **Mettre à Jour la Factory/DI :** Modifiez l'endroit où l'instance est créée. Dans notre cas, allez dans `src/infrastructure/repositories/RepositoryFactory.ts` et dans la fonction `getLogger`, remplacez `new PinoLogger()` par `new WinstonLogger()`.
4.  **Adapter les Tests de l'Adaptateur :** Mettez à jour le test unitaire *spécifique* à l'ancien adaptateur (ex: `PinoLogger.test.ts` deviendrait `WinstonLogger.test.ts`) pour mocker la nouvelle bibliothèque (`winston`) et vérifier que votre nouvel adaptateur l'utilise correctement.

**Important :** Aucune modification ne devrait être nécessaire dans les *autres* parties de l'application (Use Cases, Repositories qui *utilisent* `ILogger`) car elles dépendent uniquement de l'interface, pas de l'implémentation concrète.

## Prochaines Étapes / TODO

Ce boilerplate est une base. Les prochaines étapes typiques incluent :

*   [ ] Implémenter le **Routing** (ex: avec `react-router-dom`) pour gérer plusieurs pages/vues.
*   [ ] Mettre en place une solution de **Gestion d'État Globale** (ex: Zustand, React Context, Redux Toolkit) pour partager des états comme le thème, l'état utilisateur, etc.
*   [ ] Finaliser et tester l'adaptateur API (`ConfigurationApiAdapter`).
*   [ ] Activer et écrire les tests pour les **Cas d'Utilisation** (`src/application/use_cases/`).
*   [ ] Enrichir les composants UI de base (`src/presentation/components/`).
*   [ ] Mettre en place une stratégie de **Gestion d'Erreurs** plus robuste (ex: Error Boundaries). 