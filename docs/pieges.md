# Pièges rencontrés

Chacun a coûté du temps pendant le montage. Les relire avant de rebrancher ou de reconfigurer
quoi que ce soit fait gagner une demi-journée.

## Alimentation du Pi depuis un port USB d'ordinateur

**Symptôme.** Le Pi disparaît du réseau au moment où on branche un Arduino sur un de ses ports
USB. Ni ping, ni SSH, ni résolution mDNS.

**Cause.** Un port USB-C d'ordinateur portable négocie 5 V / 3 A au mieux. Le Pi 5 en demande
5 A, et faute de les obtenir il plafonne le courant USB total à 600 mA pour tous les ports
réunis. Un Mega ADK suffit à faire décrocher l'ensemble.

**Solution.** Alimentation 5 V / 5 A, ou hub USB alimenté entre le Pi et les cartes. Vérifier
avec `vcgencmd get_throttled` (attendu `0x0`) et `vcgencmd get_config usb_max_current_enable`.

## RPi.GPIO ne fonctionne pas sur Pi 5

**Symptôme.** Toute bibliothèque GPIO classique échoue à l'import ou à l'exécution.

**Cause.** Le Pi 5 déporte son GPIO derrière la puce RP1. L'accès mémoire direct utilisé par
`RPi.GPIO` n'existe plus.

**Solution.** `rpi-lgpio`, un substitut qui expose la même API par-dessus `lgpio`.

## lgpio ne se compile pas depuis pip

**Symptôme.** `Failed to build installable wheels for lgpio`, même après avoir installé
`liblgpio-dev`.

**Solution.** Utiliser le paquet Debian `python3-lgpio` et le lier dans l'environnement
virtuel. Le binaire Debian est compilé pour Python 3.13, la même version que le venv, donc le
lien symbolique fonctionne directement.

## Échantillonnage trop lent pour les capteurs rapides

**Symptôme.** Un capteur de son ne réagit pas aux claquements de mains, alors qu'il fonctionne.

**Cause.** Une boucle qui lit les seize entrées analogiques puis attend ne donne qu'une
trentaine d'échantillons par seconde et par voie. Un claquement dure dix millisecondes : on le
rate systématiquement.

**Solution.** Ne lire que les voies utiles, en boucle serrée. Deux voies sur un Mega donnent
4450 Hz par voie, largement de quoi capturer un transitoire.

## SPI sur les mauvaises broches

**Symptôme.** `VERSION = 0xFF` en lisant un composant SPI. La ligne MISO reste à l'état haut
pendant tout l'échange.

**Cause.** `MOSI`, `MISO` et `SCK` sont routés en dur vers le contrôleur SPI. Sur un Mega ce
sont les broches 51, 50 et 52 ; sur un Pi les broches physiques 19, 21 et 23. Les brancher
ailleurs ne produit rien. Seuls `SS` et `RST` sont libres.

**Piège supplémentaire.** Les adaptateurs GPIO sont souvent étiquetés en numéros **BCM**, pas
en numéros de broche physique. Un « 11 » sur l'adaptateur désigne GPIO11, c'est-à-dire la
broche physique 23.

## Tensions mélangées sur une rangée d'alimentation

**Symptôme.** Un composant 3,3 V ne répond pas alors que son câblage de données est correct.

**Cause.** Partager la rangée `+` d'une breadboard entre des capteurs 5 V et un composant
3,3 V. Le RC522 est resté muet plusieurs heures pour cette raison.

**Solution.** Un fil dédié depuis la broche `3.3V` du Mega pour chaque composant 3,3 V.

## Collision de noms avec les macros Arduino

**Symptôme.** Un sketch qui définit des constantes de notes de musique ne compile pas.

**Cause.** `A4`, `A5` et les suivants sont déjà définis par le cœur Arduino comme numéros de
broches analogiques.

**Solution.** Préfixer les constantes, par exemple `NOTE_A4`.

## HAT enfiché sur un Pi allumé

**Symptôme.** Écran noir, contrôleur tactile qui répond `0xFFFF`, rétroéclairage absent.

**Cause.** Un connecteur 40 broches demande une pression ferme, impossible à appliquer sans
débrancher. Un HAT à moitié enfiché donne un affichage qui semble s'initialiser — le pilote
`fb_ili9340` écrit en aveugle et ne lit jamais rien en retour, donc il rapporte un succès même
si la dalle n'est pas connectée.

**Solution.** Éteindre, retirer complètement, réaligner, enfoncer à fond des deux côtés. Et si
l'écran reste blanc après coup, forcer la réinitialisation du contrôleur par unbind/bind.

## Accents échappés dans la grammaire Vosk

**Symptôme.** Les mots accentués sont rejetés avec `Ignoring word missing in vocabulary`.

**Cause.** `json.dumps` échappe les caractères non-ASCII par défaut : `état` devient
`état`, que le lexique ne contient évidemment pas.

**Solution.** `json.dumps(mots, ensure_ascii=False)`.

## Faux positif de détection DHT

**Symptôme.** Un scan de broches « trouve » un DHT22 qui affiche 0,0 °C et 0,0 %.

**Cause.** La bibliothèque lit quatre octets nuls dont la somme de contrôle vaut zéro, donc
elle valide. N'importe quelle broche silencieuse peut produire ce résultat.

**Solution.** Rejeter toute lecture dont la température et l'humidité valent exactement zéro.
