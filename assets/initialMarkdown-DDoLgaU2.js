const e=`# 📝 Bienvenue sur Nova – Éditeur Markdown Interactif


***

***

Bonjour et bienvenue sur **Nova**, votre nouvel éditeur Markdown modulaire et interactif. Cet éditeur a été conçu pour rendre la création de documents riches aussi intuitive que possible.

***

***

## 🎯 Comment utiliser cet éditeur

### 🧱 Les blocs : concept fondamental

Nova fonctionne en **blocs** : chaque élément (paragraphe, titre, liste, code...) est un bloc indépendant que vous pouvez :

- **Éditer** : cliquez directement sur un bloc pour le modifier
- **Déplacer** : utilisez le glisser-déposer pour réorganiser vos blocs
- **Formater** : utilisez le menu contextuel (clic droit) ou les raccourcis clavier
- **Multiplier** : saisir du markdown sur une nouvelle ligne génére de novueaux blocs

L'application s'enrichie de nouveaux type de bloc comme la palette ou la table des matière tout en permettant de sauvegarder en marldown et d'exporter en html ou pdf

## Ajout de bloc

La marge de gauche contient un bouton + vous permettant d'explorer les types de blocs deja present dans l'éditeur. L'un de mes préférés est le bloc glisser/déposer. Vous selectionnez un morceau de page internet et le texte et les images sont récupés



\`\`\`palette
--lemon-chiffon: #fbf8ccff;
--champagne-pink: #fde4cfff;
--tea-rose-red: #ffcfd2ff;
--pink-lavender: #f1c0e8ff;
--mauve: #cfbaf0ff;
--jordy-blue: #a3c4f3ff;
--non-photo-blue: #90dbf4ff;
--electric-blue: #8eecf5ff;
--aquamarine: #98f5e1ff;
--celadon: #b9fbc0ff;
\`\`\`

\`\`\`space
h=50
\`\`\`

\`\`\`csv
1,2,3
4,5,6
7,8,9
\`\`\`


### ⌨️ Raccourcis essentiels

***

## 💫 Exemples de formatage

### Formatage de texte

Ce texte contient du **gras**, de l'*italique*, du \`code inline\` et du ~~texte barré~~.
Vous pouvez aussi créer des [liens](https://example.com "Exemple de lien") facilement !

Pour appliquer un formatage :

1. **Sélectionnez** le texte que vous souhaitez formater
2. **Clic droit** pour ouvrir le menu contextuel
3. **Choisissez** le format désiré

### Les listes

#### Liste à puces

- Item 1
- Item 2
  - Sous-item (indentez avec Tab)
  - Autre sous-item

#### Liste numérotée

1. Premier élément
2. Deuxième élément
3. Sous-élément (indentez avec Tab)

#### Liste de tâches

- [ ] Tâche à faire
- [x] Tâche terminée

### Citations

> Les citations sont créées avec le symbole ">" au début de la ligne.
> Elles peuvent contenir plusieurs lignes et du **formatage**.

### Code

\`\`\`javascript
// Bloc de code avec coloration syntaxique
function hello() {
  console.log("Bonjour Nova !");
}
\`\`\`

### Tableaux

| Nom | Type | Description |
| --- | --- | --- |
| Paragraphe | Texte | Bloc de texte basique |
| En-tête | H1-H6 | Titres de différents niveaux |
| Liste | UL/OL | Liste à puces ou numérotée |
| Code | Code | Bloc de code avec syntaxe |

***

## 🔍 Fonctionnalités avancées

### 🎨 Les diagrammes Mermaid

Nova intègre Mermaid pour créer des diagrammes interactifs. Voici un exemple :

\`\`\`mermaid
graph TD
    A[Commencer ici] --> B{Décision}
    B -- Oui --> C[Action 1]
    B -- Non --> D[Action 2]
    C --> E[Résultat]
    D --> E
\`\`\`

Vous pouvez **personnaliser** les nœuds et les flèches en faisant un **clic droit** dessus !

### 📊 Images interactives

Les images peuvent être redimensionnées et positionnées selon vos besoins.

***

## 🏗️ Architecture de Nova

Voici un aperçu de l'architecture technique de l'application :

\`\`\`mermaid
graph TD
    subgraph User Interface Presentation Layer
        UI[Browser Events: Clic, Dnd, Input, Ctrl+S] --> App
        App[App.tsx] -- blocks/callbacks --> NovaEditor[NovaEditor.tsx]
        NovaEditor -- blocks/callbacks --> MDRenderer[MarkdownRenderer.tsx]
        MDRenderer -- block/callbacks --> SortableItem[SortableBlockItem.tsx]
        SortableItem -- block/callbacks --> CustomRenderers[Custom*Renderer.tsx]
        CustomRenderers -- User Edits --> CallbacksRenderers(onUpdateBlockContent, etc.)
        SortableItem -- Menu/Dnd Actions --> CallbacksSortable(onAddBlockAfter, onDelete, onIncrease/DecreaseIndentation)

        subgraph Mermaid Interaction
            CMR[CustomMermaidRenderer.tsx] -- Right-click --> CMenu[MermaidContextMenu.tsx]
            CMenu -- Action Selection --> CMAction{handleMenuAction in CMR}
            CMAction -- Modif. Request --> MUtils[mermaidUtils.ts]
            MUtils -- New Code --> CMAction
            CMAction -- onUpdateBlockContent --> CallbacksRenderers
        end

        Header[Header.tsx] -- onLoadMarkdown --> AppLoad(App.handleLoadMarkdown)
        App -- Ctrl+S / Button --> AppSave(App.triggerSave)

        App -- theme --> ThemeUpdate[Update DOM Class]
        App -- Initialize --> MermaidInit[Mermaid.initialize]
    end

    subgraph State & Business Logic Application Layer
        AppLoad -- markdown string --> Parser[markdownParser.ts]
        Parser -- blocks[] --> SetBlocks(BlocksMgmt.setExternalBlocks)

        CallbacksRenderers --> BlocksMgmtUpdate(BlocksMgmt.handleBlockContentChange)
        CallbacksSortable --> BlocksMgmtActions(BlocksMgmt.handle*)

        BlocksMgmtUpdate --> DispatchUpdate{Dispatch UPDATE_BLOCK_CONTENT}
        DispatchUpdate -- blockId, newText --> Reducer[blocksReducer]

        BlocksMgmtActions --> DispatchAction{Dispatch ADD/DELETE/REORDER/INDENT}
        DispatchAction -- payload --> Reducer

        BlocksMgmt[useBlocksManagement.ts] -- Initial Blocks --> Reducer
        Reducer -- New blocks[] state --> BlocksMgmt
        BlocksMgmt -- blocks[] --> App

        AppSave -- blocks[] --> Serializer[markdownSerializer.ts]
        AppSave -- external image URLs --> ImageDownloader{handleImageDownload in App.tsx}
        ImageDownloader -- Fetched images --> AppSave
        Serializer -- markdown string --> AppSave
        AppSave --> FileSaver[Blob & Link Download]

        App -- Get theme --> UIStore[useUiStore]
        UIStore -- theme value --> App
    end

    subgraph Infrastructure Layer
        Parser -- Log --> Logger[PinoLogger]
        Serializer -- Log --> Logger
        BlocksMgmt -- Log --> Logger
        App -- Log --> Logger
        CMR -- Log --> Logger
    end

    %% Styling
    classDef presentation fill:#f9f,stroke:#333,stroke-width:2px;
    classDef application fill:#ccf,stroke:#333,stroke-width:2px;
    classDef infrastructure fill:#cfc,stroke:#333,stroke-width:2px;

    class App,NovaEditor,MDRenderer,SortableItem,CustomRenderers,CMR,CMenu,CMAction,Header,ThemeUpdate,MermaidInit presentation;
    class CallbacksRenderers,CallbacksSortable presentation;
    class AppLoad,AppSave,ImageDownloader,FileSaver presentation; 

    class BlocksMgmt,Reducer,Parser,Serializer,UIStore application;
    class SetBlocks,BlocksMgmtUpdate,BlocksMgmtActions,DispatchUpdate,DispatchAction application; 

    class Logger,MUtils infrastructure; 
\`\`\`

***

## 🚀 Commencer à utiliser Nova

Pour débuter avec Nova :

1. **Créez** vos blocs en appuyant sur Entrée à la fin d'un bloc existant
2. **Modifiez** leur contenu en cliquant dessus
3. **Réorganisez** vos blocs par glisser-déposer
4. **Exportez** votre document avec Ctrl+S

### Astuce pour les débutants

Pour les débutants en Markdown, utilisez les menus contextuels plutôt que de mémoriser la syntaxe. Avec le temps, vous apprendrez naturellement les raccourcis et les commandes.

***

## 🔮 Fonctionnalités à venir

- Synchronisation avec le cloud
- Collaboration en temps réel
- ~~Exportation en PDF, HTML et autres formats~~ déjà fait ^^
- Bibliothèque de modèles

***

## 🧠 Aide-mémoire des commandes Markdown

| Syntaxe | Résultat |
| --- | --- |
| \`# Titre\` | # Titre |
| \`**Texte**\` | **Texte** |
| \`*Texte*\` | *Texte* |
| \`[Lien](url)\` | [Lien](url) |
| \`![Alt](url)\` | Image |
| \`code\` | 'Bloc de code' |
| \`> Citation\` | > Citation |
| \`- Liste\` | • Liste |
| \`1. Liste\` | 1. Liste |
| \`- [ ] Tâche\` | ☐ Tâche |
| \`---\` | Ligne horizontale |

N'hésitez pas à explorer et à expérimenter avec Nova. L'édition structurée en blocs rend l'apprentissage du Markdown beaucoup plus intuitif !

### Bon travail
`;export{e as initialMarkdown};
