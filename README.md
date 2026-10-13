<img src="logo/logo-clair.png" alt="Boucles" width="280">

# Boucles

Répertoire de rap français en **accords grattés** pour s'exercer à la guitare. Pas d'arpèges, pas de paroles : des grilles de mesures, des diagrammes et une rythmique.

En ligne : https://theovoneuw-cell.github.io/boucles/

Pensée pour l'iPhone 13 mini. Dans Safari : Partager → « Sur l'écran d'accueil ». Elle marche ensuite sans connexion.

## Ce qu'elle fait

- Plus de 300 morceaux au départ : 94 grilles vérifiées à la main (Orelsan, Nekfeu, PNL, Bigflo & Oli, Soprano, Jul, Lomepal, Gims, MC Solaar, IAM…) et des grilles converties automatiquement (Damso, Ninho, Gazo, Tiakola, SDM, PLK, Werenoi…). Recherche, favoris, filtre « Nouveaux ».
- **↻ Actualiser** : récupère le catalogue mis à jour par le robot (voir plus bas).
- **Chercher ailleurs** : la recherche s'étend à Ultimate Guitar, Chordify, La Boîte à chansons et Google.
- **+ Ajouter** : coller une page d'accords de n'importe quel site ; l'app ne garde que les accords et en tire les boucles. Ces morceaux restent sur le téléphone.
- Capo et transposition ; bouton « Formes faciles » qui cherche le capo donnant les accords les plus simples sans changer la hauteur.
- « Accords simples » : ramène 7, maj7, sus… à l'accord de base.
- Six rythmiques grattées (noires, ballade, posé, boom bap, afro, croches).
- Lecteur : clic et guitare synthétisée, mesure en cours surlignée, accord suivant affiché, tempo réglable, boucle sur une partie.

## Le robot de collecte

`.github/workflows/collecte.yml` tourne toutes les 6 heures (et à la demande : onglet Actions → Collecte → Run workflow) :

1. `build/collect.py` passe sur les derniers ajouts d'Ultimate Guitar, sur 30 artistes de `build/artistes.txt` à tour de rôle, et sur La Boîte à chansons. Il ne garde que les accords, jamais les paroles. Ultimate Guitar bloque si on va trop vite : au plus 120 grilles par passage, le reste attend dans `build/file.json`.
2. `build/merge.js` convertit avec `convert.js`, écarte les grilles inexploitables (`build/rejets.json`) et ajoute le reste à `data-auto.json` avec la date du jour.

Pour suivre un nouveau rappeur, ajouter son nom dans `build/artistes.txt`.

## Fichiers

- `data.js` : les grilles vérifiées à la main.
- `data-auto.json` : les grilles converties par le robot.
- `convert.js` : texte d'accords → boucles (robot et import).
- Format des grilles : une ligne par morceau, `Am Dm | G7 Am` (une barre = une mesure).
- `app.js` : moteur d'accords, diagrammes, lecteur.
- `sw.js` : cache hors ligne. **Incrémenter `CACHE` à chaque modification.**
- `build/serve.py 8796` : aperçu local.
- `logo/` : logo (signe de reprise ‖: et nom), en SVG et PNG, versions claire et sombre ; `logo/icone.svg` sert aux icônes de l'app.

Grilles établies d'après les relevés des communautés [La Boîte à chansons](https://www.boiteachansons.net) et [Ultimate Guitar](https://www.ultimate-guitar.com), ramenées à leurs boucles. Chaque fiche automatique renvoie vers son relevé d'origine.
