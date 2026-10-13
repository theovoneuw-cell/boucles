# Boucles

Répertoire de rap français en **accords grattés** pour s'exercer à la guitare. Pas d'arpèges, pas de paroles : des grilles de mesures, des diagrammes et une rythmique.

En ligne : https://theovoneuw-cell.github.io/boucles/

Pensée pour l'iPhone 13 mini. Dans Safari : Partager → « Sur l'écran d'accueil ». Elle marche ensuite sans connexion.

## Ce qu'elle fait

- 94 morceaux (Orelsan, Nekfeu, PNL, Bigflo & Oli, Soprano, Jul, Lomepal, Gims, MC Solaar, IAM…), recherche et favoris.
- Capo et transposition ; bouton « Formes faciles » qui cherche le capo donnant les accords les plus simples sans changer la hauteur.
- « Accords simples » : ramène 7, maj7, sus… à l'accord de base.
- Six rythmiques grattées (noires, ballade, posé, boom bap, afro, croches).
- Lecteur : clic et guitare synthétisée, mesure en cours surlignée, accord suivant affiché, tempo réglable, boucle sur une partie.

## Fichiers

- `data.js` : le répertoire. Une ligne par morceau, grilles en `Am Dm | G7 Am` (une barre = une mesure).
- `app.js` : moteur d'accords, diagrammes, lecteur.
- `sw.js` : cache hors ligne. **Incrémenter `CACHE` à chaque modification.**
- `build/serve.py 8796` : aperçu local. `build/icon.swift` : icônes.

Grilles établies d'après les relevés de la communauté [La Boîte à chansons](https://www.boiteachansons.net), ramenées à leurs boucles.
