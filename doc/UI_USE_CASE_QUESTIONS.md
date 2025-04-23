# Questions sur les Cas d'Usage de l'Interface "NOVA"

Ce fichier liste des questions pour clarifier le fonctionnement attendu de l'interface utilisateur, basé sur l'analyse de la capture d'écran et l'objectif de réécriture.

## Gestion des Configurations

1.  **Création/Nommage :** Comment une nouvelle "Configuration" est-elle créée ? 
Il faut aller en mode administration. saisir un nom pour la config, une adresse api, saisir un preprompt, saisir une clef api, saisir un template mermaid et markdown et sauvegarder.
Comment lui attribue-t-on un nom (visible dans le menu déroulant) ?
C'est le nom de la configuration sauvegardée
2.  **Sauvegarde ("Sauvegarder JSON") :** Que contient exactement le fichier JSON sauvegardé ? Uniquement le contenu brut (Markdown + code Mermaid) ? Des métadonnées supplémentaires (nom de la config, date, etc.) ? L'état de l'UI (mode focus, etc.) ?
Le json permet d'exporter la configuration complete sous forme d'un json sur son disque dur. La configuration est l'enregistrement en base ou en local que manipule l'application.
3.  **Chargement ("Charger") :** D'où charge-t-on ? Depuis un fichier local sélectionné par l'utilisateur ? Depuis une liste prédéfinie ou une API ? Que se passe-t-il si le contenu actuel n'est pas sauvegardé ?
le chargement permet de charger depuis un fichier json préalablement sauvegardé sur le disque dur
4.  **Ouverture ("Ouvrir") :** Quelle est la différence fonctionnelle entre "Charger" et "Ouvrir" ?
Ouvrir permet de visualiser le diagram dans un nouvel onglet avec des facilités comme le centrage auto le zoom a la molette, le deplacement par clic gauche enfoncé.
5.  **Menu Déroulant :** Comment la liste des configurations dans le menu déroulant est-elle peuplée ? Est-ce basé sur des fichiers JSON locaux, une base de données, une API ?
La liste deroulante est la liste des configuration disponible en base. il y a un mode api de l'application et un mode local. en mode local c'est une configuration de demonstration qui est cahrgé et qui apparait dans la liste.

## Fonctionnalités de l'Éditeur

6.  **Modes d'Affichage ("Normal", "Focus Édition", "Focus Aperçu") :** Quels panneaux sont affichés/cachés ou réarrangés dans chaque mode ?
Ils permettent de faire varier la largeur attribué aux editeurs et à la preview.
7.  **Génération/Prévisualisation ("Générer") :** La prévisualisation Mermaid se met-elle à jour automatiquement à la frappe, ou uniquement en cliquant sur "Générer" ? Si manuel, le bouton "Générer" est-il toujours nécessaire ?
Mise a jour de la preview a chaque modification du script contenu dans l'editeur. Générer va interroger une ia afin qui retourne du script qui sera placé dans l'editeur, ce qui mettra a jour lea preview
8.  **Interaction Diagramme :** L'interaction avec le diagramme Mermaid se fait-elle *uniquement* via l'édition du code, ou est-il prévu une interaction directe sur le diagramme rendu (ex: sélection de nœud, changement de couleur via menu contextuel comme suggéré par le code legacy `testColorContextMenu.html`) ?
Oui nous offrons la possibilité d'interagir via un menu contextuel sur la forme, les couleurs et les fleches du diagramm. cette partie du code a été isolé dans le projet source.

## Export

9.  **Export HTML ("Exporter HTML") :** Que contient le fichier HTML exporté ? Uniquement le rendu du Markdown et du diagramme ? Inclut-il des éléments de l'interface de l'éditeur ? Est-il stylisé ?
C'est tout simplement l'addition preview Mermaid et preview markdown.

## Autres Contrôles

10. **Mode "Normal" / "Admin" :** Quelles fonctionnalités ou permissions différentes ces modes activent-ils ?
le mode admin affiche tout les champ de l'objet, le mode normal n'affiche que les editeurs, le selecteur liste de config et les preview md et mmd
11. **Thème (Lune/Soleil) :** Cela affecte-t-il uniquement l'interface de l'éditeur ou aussi le rendu exporté ? theme sombre en option souhaité
12. **Icônes Aide/Profil :** Quelles fonctionnalités sont prévues derrière ces icônes ? une fenetre contenant des explications sur les focntionnalités et le fonctionnement de l'app. notemment l'interaction avec la preview mermaid et markdown

## Données Sous-jacentes

13. **Stockage Combiné :** Comment le texte Markdown et le code Mermaid sont-ils structurés et stockés ensemble au sein d'une "Configuration" (dans le JSON sauvegardé ou en mémoire) ? S'agit-il d'un seul bloc de texte avec des délimiteurs, ou de champs séparés ? 
je te fournirais un fichier json pour que tu es les reponses a ces questions.