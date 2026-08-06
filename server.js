const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'parella2026'; // ⚠️ à changer via la variable d'environnement avant tout partage
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'kpis.json');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const ALLOWED_UPLOAD_TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'application/pdf': '.pdf' };
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 Mo

function computeAdminToken() {
  return crypto.createHmac('sha256', ADMIN_PASSWORD).update('xyz-admin-session').digest('hex');
}

function isAuthorized(req) {
  const token = req.headers['x-admin-token'];
  return typeof token === 'string' && token === computeAdminToken();
}

const defaultState = {
  faqAsked: [],
  articleOpens: {},
  tabViews: {},
  contactSubmissions: [],
  visitSessions: []
};

const defaultContent = {
  branding: {
    projectName: 'Projet XYZ',
    logoUrl: '', // vide = losange géométrique par défaut
    theme: 'default' // thème visuel public : 'default' ou 'rainbow-glass'
  },
  publicContent: {
    faq: {
      eyebrow: 'Projet XYZ — Base de connaissance',
      titleLine1: 'Une réponse,',
      titleAccent: 'chaque fois.',
      desc: "Posez votre question librement. Les réponses officielles s'affichent instantanément. Pour tout ce qui reste flou, faites-le remonter à l'équipe projet via le formulaire ci-dessous — c'est comme ça que cette base s'enrichit."
    },
    actu: {
      eyebrow: 'Projet XYZ — Actualités',
      titleLine1: 'Le fil',
      titleAccent: 'du projet.',
      desc: "Retrouvez ici toutes les informations publiées par l'équipe projet, au fur et à mesure des décisions et des étapes franchies. Cette page remplace la newsletter envoyée par email."
    },
    plans: {
      eyebrow: 'Projet XYZ — Documents visuels',
      titleLine1: 'Découvrez',
      titleAccent: 'le futur site.',
      desc: "Plans de macro et micro-zoning, vues 3D des espaces, ambiances : tous les documents visuels du projet sont ici, commentés pour vous aider à vous projeter avant les ateliers."
    },
    ambassadeurs: {
      eyebrow: 'Projet XYZ — Réseau de proximité',
      titleLine1: 'Vos',
      titleAccent: 'ambassadeurs.',
      desc: "Ce sont vos collègues. Ils ont accepté volontairement de jouer un rôle de relais entre les équipes et l'équipe projet. Interpellez-les sans hésiter."
    },
    equipe: {
      eyebrow: 'Projet XYZ — Organisation',
      titleLine1: "L'équipe",
      titleAccent: 'projet.',
      desc: "Retrouvez ici les personnes qui pilotent le projet côté entreprise et les interlocuteurs du cabinet Parella qui accompagne la démarche de transformation des espaces de travail."
    }
  },
  faqEntries: [],
  faqDrafts: [],
  progress: {
    stepLine1: 'Étape 3',
    stepLine2: 'sur 6',
    percent: 42
  },
  milestones: [
    { id: 'm1', status: 'done', date: 'Oct. 2025', label: 'Lancement du projet', desc: "Décision de déménagement actée. Constitution de l'équipe projet. Premiers échanges avec les instances représentatives du personnel." },
    { id: 'm2', status: 'done', date: 'Déc. 2025 – Fév. 2026', label: 'Cadrage & choix du site', desc: "Analyse des sites candidats. Sélection du nouveau site. Validation du programme immobilier et du budget. Information des partenaires sociaux." },
    { id: 'm3', status: 'current', date: 'Mars – Juin 2026', label: 'Conception & co-construction', desc: "Ateliers de personnalisation des espaces. Finalisation des plans de micro-zoning. Lancement du réseau d'ambassadeurs. Premières visites du site." },
    { id: 'm4', status: 'future', date: 'Juil. – Sept. 2026', label: 'Préparation opérationnelle', desc: "Travaux d'aménagement intérieur. Préparation logistique des équipes. Communications de bascule. Formations à la prise en main du nouveau site." },
    { id: 'm5', status: 'future', date: 'Sem. du 14 oct. 2026', label: 'Déménagement', desc: "Bascule progressive des équipes sur le nouveau site. Accueil renforcé. Support IT et logistique en temps réel. Équipe projet disponible sur place." },
    { id: 'm6', status: 'future', date: 'Nov. 2026+', label: 'Installation & ajustements', desc: "Enquête de satisfaction post-installation. Ajustements des espaces et des règles de vie. Bilan du projet et clôture." }
  ],
  articles: [
    {
      id: '1', tag: 'Calendrier', date: '2 avril 2026 · 4 min',
      title: "Le projet entre dans sa phase active — ce qui change concrètement dans les prochaines semaines",
      chapeau: "Après plusieurs mois de cadrage et de travail en coulisses, le projet de déménagement entre dans une nouvelle phase. Voici ce qui se passe concrètement d'ici fin avril — et ce qui reste encore à confirmer.",
      body: `Vous avez été nombreux à nous poser la même question ces dernières semaines : "Quand est-ce que ça va vraiment commencer ?" La réponse, c'est maintenant.

Après plusieurs mois de cadrage, de travail technique et de consultations préalables — y compris avec les instances représentatives du personnel — le projet de déménagement entre dans sa phase opérationnelle. Les premières actions visibles pour les collaborateurs démarrent en avril, et le rythme va s'accélérer jusqu'à la semaine du 14 octobre, date prévue pour la bascule.

## Les ateliers de personnalisation démarrent mi-avril.

C'est probablement la nouveauté la plus importante de cette phase. Entre mi-avril et fin mai, chaque entité participera à un atelier dédié animé par l'équipe projet et un cabinet spécialisé en design des espaces de travail. Ces ateliers durent environ deux heures et réunissent une quinzaine de collaborateurs représentatifs de l'équipe.

L'objectif n'est pas de vous présenter un plan définitif et de recueillir vos applaudissements. L'objectif est de co-construire avec vous la micro-organisation de votre espace : implantation des postes, règles de vie, usage des zones partagées, signalétique. Les résultats de ces ateliers alimenteront directement les derniers arbitrages d'aménagement. Ça compte vraiment.

Votre manager vous communiquera la date de votre atelier dans les prochains jours. La participation est fortement encouragée — pas obligatoire, mais fortement encouragée. Ceux qui n'ont pas pu y assister pourront faire remonter leurs retours via le formulaire de la FAQ.

## Le réseau d'ambassadeurs est officiellement lancé.

Une vingtaine de collaborateurs volontaires, issus de différentes équipes et niveaux hiérarchiques, ont accepté de jouer le rôle de relais de proximité pour ce projet. Ils ont reçu une formation courte sur le projet, ses enjeux et ses grandes décisions, et ils disposent d'un canal de remontée direct vers l'équipe projet.

Leur rôle n'est pas de défendre le projet à tout prix — ce ne sont pas des communicants. Leur rôle est d'être disponibles pour leurs collègues, de faire circuler l'information dans les deux sens, et de signaler les points de friction que les canaux officiels ne captent pas toujours.

La liste complète des ambassadeurs sera diffusée avant la fin du mois d'avril. En attendant, renseignez-vous auprès de votre manager ou de votre RH.

## Les premières visites du site sont ouvertes.

Un calendrier de visites découverte est en cours de finalisation pour les mois d'avril et mai. Ces visites sont organisées en petits groupes (une dizaine de personnes), guidées par un membre de l'équipe projet et par le responsable du site. Elles durent environ une heure et demie.

Pendant la visite, vous verrez l'état actuel du chantier d'aménagement, vous découvrirez les différentes zones, et vous pourrez poser toutes vos questions à des interlocuteurs qui connaissent le projet dans le détail. Pour ceux qui ne peuvent pas se déplacer, une visite virtuelle commentée sera disponible sur ce site dans les prochaines semaines.

## Ce qui reste à confirmer — soyons honnêtes.

— Les dates précises de bascule par équipe : le phasage est en cours de finalisation. Communication prévue avant fin mai.
— Les modalités de restauration : plusieurs options à l'étude. Arbitrage attendu fin avril.
— Le dispositif de stationnement : en cours de négociation avec le gestionnaire du site. Réponse attendue début mai.
— Les règles d'occupation des espaces (flex office vs postes attribués) : sera en partie déterminé par les ateliers d'avril. Cadre général communiqué fin mai.

Ce site est mis à jour à chaque étape franchie.`
    },
    {
      id: '2', tag: 'Écoute', date: '18 mars 2026 · 5 min',
      title: "Ce que nous avons entendu — retour détaillé sur les premières remontées terrain",
      chapeau: "Depuis le lancement du projet, plusieurs centaines de questions et de préoccupations ont été collectées. Voici ce que nous en avons retenu — et ce que ça change concrètement.",
      body: `Depuis le lancement du projet, plusieurs centaines de questions, de remarques et de préoccupations ont été collectées — via ce site, via les managers, via les sessions d'écoute organisées en équipe, et via les échanges informels que les ambassadeurs ont remontés. Nous avons lu chacune d'entre elles. Cet article en est le compte-rendu fidèle.

Nous avons fait le choix de ne pas édulcorer. Ce qui suit reflète ce que vous nous avez dit — y compris les choses inconfortables.

## 1. Le trajet : la préoccupation numéro un.

C'est, de très loin, le sujet qui revient le plus. Une part significative des collaborateurs voit son temps de trajet augmenter avec le nouveau site — parfois de manière modérée, parfois de façon vraiment substantielle. Certains nous ont écrit pour dire que ce changement remet en question leur organisation familiale entière.

Ce que nous faisons avec ça : une cartographie précise des situations a été réalisée. Les collaborateurs dont le trajet augmente de plus de 30 minutes aller simple feront l'objet d'un accompagnement individualisé. Cela peut prendre plusieurs formes : prise en charge partielle d'un abonnement plus étendu, aménagement temporaire du nombre de jours sur site, ou entretien RH pour explorer les options. Ce dispositif sera formalisé et communiqué avant fin avril.

## 2. Le bureau personnel : une question d'identité autant que de confort.

"Je veux savoir où je vais m'asseoir le matin." Cette phrase est revenue dans un très grand nombre de retours. La perspective du flex office génère une anxiété qui va au-delà du confort immédiat — c'est une question de repères, de territoire, parfois d'efficacité pure.

Le flex office intégral — où personne n'a de place fixe — n'est pas le modèle retenu par défaut. Le modèle d'occupation des espaces sera discuté dans les ateliers d'avril, et différentes équipes pourront avoir des règles différentes selon leur nature de travail.

## 3. Le bruit et la concentration : une crainte légitime.

Beaucoup d'entre vous ont exprimé la crainte d'un open space bruyant, peu propice à la concentration. Le nouveau site a été pensé avec ça en tête : zones de focus silence strict, cabines phoniques insonorisées sans réservation, salles de réunion en nombre suffisant. Des ajustements seront nécessaires après l'installation, et c'est pour ça qu'un dispositif de retours post-installation est prévu.

## 4. La restauration : le silence qui agace.

Plusieurs retours ont été directs : "On nous parle de tout sauf de ce qu'on va manger." C'est compréhensible. La raison pour laquelle nous n'avons pas encore communiqué sur ce point n'est pas un oubli — les négociations avec les prestataires potentiels sont encore en cours. L'arbitrage est attendu pour fin avril, et une communication dédiée suivra dans la semaine.

## 5. L'incertitude : ce qui use le plus.

Au-delà de chaque sujet pris individuellement, beaucoup ont exprimé la fatigue de ne pas savoir. Cette incertitude prolongée use — et c'est une réaction tout à fait normale face à un changement qui touche au quotidien.

Nous ne pouvons pas tout résoudre immédiatement. Mais nous pouvons nous engager sur une chose : vous dire la vérité sur ce qu'on sait et sur ce qu'on ne sait pas encore. Ce site est l'outil de cet engagement.

Merci à tous ceux qui ont pris le temps d'écrire et de remonter des retours.`
    },
    {
      id: '3', tag: 'Espaces', date: '5 mars 2026 · 4 min',
      title: "Première plongée dans le futur site — plans, ambiances et ce qu'il faut en retenir",
      chapeau: "Pour la première fois, nous partageons des documents visuels sur le futur site. Plans, vues 3D, zones commentées : voici comment les lire et comment vous en servir avant les ateliers.",
      body: `Pour la première fois depuis le lancement du projet, nous partageons des documents visuels sur le futur site. Nous avons volontairement attendu d'avoir des éléments suffisamment avancés pour que les visuels soient représentatifs de la réalité finale. Ce moment est arrivé.

Vous trouverez dans l'onglet Plans & 3D de ce site une première série de documents : plans de macro-zoning, vues 3D des espaces principaux, et plan de détail d'une zone type. Voici un guide de lecture pour en tirer le meilleur parti.

## Comment lire un plan de macro-zoning.

Le macro-zoning, c'est la carte grande maille du site. Il montre quelles grandes familles d'usages occupent quels espaces, sans aller jusqu'au niveau du poste individuel. Sur nos plans, vous verrez des zones colorées : espaces de travail ouverts, zones de concentration, salles de réunion, espaces de convivialité, services.

Ce que le macro-zoning ne dit pas : il ne dit pas où vous allez vous asseoir. Ça, c'est le micro-zoning — et c'est précisément ce qui sera co-construit dans les ateliers d'avril. Le macro-zoning est le cadre ; le micro-zoning est le contenu.

## Comment lire les vues 3D.

Les vues 3D sont des rendus réalisés par le cabinet d'architecture à partir des plans définitifs. Elles représentent fidèlement les volumes, les matériaux, les couleurs et la luminosité des espaces. Ce n'est pas du photomontage enjolivé — les rendus ont été calibrés pour être proches de la réalité perçue.

Regardez particulièrement la vue de l'espace de convivialité central et la vue depuis l'entrée principale. Ces deux espaces donnent une bonne idée de l'intention générale du projet : des lieux généreux, lumineux, pensés pour le bien-être autant que pour l'efficacité.

## Ce que vous pouvez faire avec ces documents dès maintenant.

Si votre atelier de personnalisation est dans les prochaines semaines, nous vous encourageons à consulter ces plans avant d'y aller. Arriver avec des questions précises permet des échanges beaucoup plus riches qu'une découverte à froid le jour de l'atelier.

Si vous avez des remarques sur ce que vous voyez dans ces documents, le formulaire de la page FAQ est là pour ça. Les questions remontées avant les ateliers alimenteront directement les points de discussion.`
    },
    {
      id: '4', tag: 'Vision', date: '12 février 2026 · 4 min',
      title: "Pourquoi on déménage — et ce qu'on a voulu faire de ce projet",
      chapeau: "Avant de parler de cartons et de badges, il nous semblait important de partager le pourquoi. Ce déménagement n'est pas qu'une contrainte logistique — c'est un choix, avec une intention derrière.",
      body: `Avant de parler de cartons, de badges et de plans d'étage, il nous semblait important de partager quelque chose de plus fondamental : le pourquoi. Pas le pourquoi administratif et contractuel — même si celui-là existe — mais l'intention derrière ce projet.

## La contrainte de départ.

Soyons directs : ce déménagement n'est pas né d'une envie spontanée de changer d'air. Le bail de notre site actuel arrive à échéance, et les conditions de renouvellement n'étaient pas satisfaisantes. C'est une réalité contractuelle qui a déclenché le projet.

Mais une contrainte peut être traversée de deux façons : en faisant au minimum, ou en essayant d'en faire quelque chose. Nous avons choisi la deuxième option.

## Pourquoi ce site, et pas un autre.

Le nouveau site a été sélectionné au terme d'une analyse multicritères menée sur plusieurs mois. Les critères n'étaient pas uniquement immobiliers. L'accessibilité en transports en commun était un critère majeur. La qualité des espaces — volumes, lumière naturelle, possibilité d'aménager des zones diversifiées — était déterminante. La capacité du bâtiment à accueillir nos modes de travail hybrides actuels a aussi pesé dans la balance.

Plusieurs sites ont été visités et écartés. Celui que nous avons retenu est, selon nous, le meilleur compromis possible entre ces différentes exigences. Il n'est pas parfait — aucun site ne l'est — mais il offre une base solide pour construire quelque chose de bien.

## L'intention derrière le projet.

Au-delà du déménagement lui-même, nous avons voulu faire de ce projet une occasion de repenser notre façon de travailler ensemble. Pas de façon révolutionnaire ou imposée — mais en posant quelques questions simples : de quoi avons-nous besoin pour travailler bien ? Qu'est-ce qui use les gens et qu'on pourrait éviter dans le nouveau lieu ?

Ces questions ont alimenté les choix d'aménagement. Les espaces de concentration ne sont pas là pour cocher une case — ils sont là parce que le bruit est l'une des plaintes les plus fréquentes dans nos espaces actuels. Les espaces de convivialité ne sont pas un luxe — ils sont là parce que le lien social entre collègues est une composante réelle du bien-être au travail.

## L'engagement qui en découle.

Nous serons honnêtes : tous les arbitrages ne sont pas encore rendus. Nous aurions pu attendre d'avoir toutes les réponses avant de communiquer. Nous avons choisi de ne pas le faire.

L'engagement que nous prenons, c'est celui de la transparence progressive : vous informer au fur et à mesure que les décisions sont prises, pas quand tout est parfait. Ce site est l'outil de cet engagement. Si une information que nous avons donnée doit être corrigée, nous le dirons clairement, avec les raisons.`
    }
  ],

  // ═══════════════════════════════════════════════════
  // AMBASSADEURS — paragraphes d'intro/CTA + roster de personnes.
  // ═══════════════════════════════════════════════════
  ambassadorsContent: {
    introTitle: "Quel est leur rôle exactement ?",
    introBody: "Les ambassadeurs ne sont pas des porte-paroles officiels du projet, ni des communicants. Ce sont des collaborateurs comme vous, issus de différentes équipes et niveaux hiérarchiques, qui ont choisi de s'impliquer activement dans la transition.\n\nConcrètement, ils font trois choses : ils **relaient les informations** du projet au plus près de leurs collègues, ils **remontent les questions et préoccupations** du terrain vers l'équipe projet via un canal dédié, et ils **participent à la co-construction** des usages et des règles de vie sur le nouveau site.\n\nSi vous avez une question que vous préférez poser à un collègue plutôt qu'à votre RH, si vous avez entendu une rumeur que vous voulez vérifier, ou si vous voulez simplement comprendre où en est le projet — votre ambassadeur est la bonne personne.",
    rosterLabel: "toutes directions",
    ctaTitle: "Vous souhaitez devenir ambassadeur ?",
    ctaBody: "Le réseau est ouvert à de nouveaux volontaires jusqu'à fin avril. Si vous êtes motivé(e) pour jouer ce rôle, parlez-en à votre manager ou contactez directement l'équipe projet via le formulaire de la FAQ."
  },
  ambassadors: [
    { id: 'amb-1', initials: 'SL', name: 'Sophie Lecomte', role: 'Responsable comptabilité clients', tag: 'Finance', imageUrl: '' },
    { id: 'amb-2', initials: 'TM', name: 'Thomas Meunier', role: 'Chargé de développement RH', tag: 'Ressources humaines', imageUrl: '' },
    { id: 'amb-3', initials: 'AL', name: 'Amina Laaroussi', role: 'Chef de projet digital', tag: 'Marketing', imageUrl: '' },
    { id: 'amb-4', initials: 'PD', name: 'Pierre Dumont', role: 'Ingénieur infrastructure', tag: 'DSI', imageUrl: '' },
    { id: 'amb-5', initials: 'CR', name: 'Claire Renard', role: 'Juriste droit des affaires', tag: 'Juridique', imageUrl: '' },
    { id: 'amb-6', initials: 'JB', name: 'Julien Berger', role: 'Responsable supply chain', tag: 'Opérations', imageUrl: '' },
    { id: 'amb-7', initials: 'NF', name: 'Nathalie Ferrand', role: 'Assistante de direction', tag: 'Direction générale', imageUrl: '' },
    { id: 'amb-8', initials: 'KD', name: 'Karim Djebbar', role: 'Analyste financier senior', tag: 'Contrôle de gestion', imageUrl: '' },
    { id: 'amb-9', initials: 'MB', name: 'Marie Blanchard', role: 'Responsable formation', tag: 'Ressources humaines', imageUrl: '' },
    { id: 'amb-10', initials: 'RP', name: 'Romain Petit', role: 'Développeur back-end', tag: 'DSI', imageUrl: '' },
    { id: 'amb-11', initials: 'LV', name: 'Laura Vasseur', role: 'Chargée de communication interne', tag: 'Communication', imageUrl: '' },
    { id: 'amb-12', initials: 'FB', name: 'François Bouchard', role: 'Responsable maintenance', tag: 'Services généraux', imageUrl: '' }
  ],

  // ═══════════════════════════════════════════════════
  // ÉQUIPE PROJET — une seule liste, différenciée par le champ badge.
  // ═══════════════════════════════════════════════════
  teamContent: {
    parellaIntro: "**Parella** est le cabinet de conseil en immobilier de travail qui accompagne XYZ dans la conception des espaces, l'animation des ateliers de co-construction et la conduite du changement. Son équipe travaille en binôme avec l'équipe projet interne depuis le début du cadrage.",
    ctaTitle: "Une question pour l'équipe projet ?",
    ctaBody: "Vous pouvez contacter l'équipe via le formulaire disponible dans l'onglet FAQ. Toutes les demandes sont lues et traitées dans les meilleurs délais."
  },
  team: [
    { id: 'team-1', initials: 'SC', name: 'Stéphanie Collet', title: 'Directrice des Ressources Humaines — Cheffe de projet', badge: 'XYZ', imageUrl: '' },
    { id: 'team-2', initials: 'BM', name: 'Bruno Marchand', title: 'Directeur Immobilier & Services Généraux', badge: 'XYZ', imageUrl: '' },
    { id: 'team-3', initials: 'EG', name: 'Élodie Garnier', title: 'RRH — Accompagnement au changement & communication projet', badge: 'XYZ', imageUrl: '' },
    { id: 'team-4', initials: 'OT', name: 'Olivier Thibaut', title: 'Responsable logistique & coordination déménagement', badge: 'XYZ', imageUrl: '' },
    { id: 'team-5', initials: 'CV', name: 'Céline Vidal', title: 'DSI — Référente IT du projet', badge: 'XYZ', imageUrl: '' },
    { id: 'team-6', initials: 'LP', name: 'Laurent Peyre', title: 'Responsable travaux & coordination technique site', badge: 'XYZ', imageUrl: '' },
    { id: 'team-7', initials: 'MH', name: 'Mathieu Hernandez', title: 'Associé — Directeur de mission', badge: 'Parella', imageUrl: '' },
    { id: 'team-8', initials: 'IR', name: 'Isabelle Rousseau', title: 'Manager — Conduite du changement & communication', badge: 'Parella', imageUrl: '' },
    { id: 'team-9', initials: 'AK', name: 'Antoine Keller', title: 'Consultant senior — Design des espaces de travail', badge: 'Parella', imageUrl: '' },
    { id: 'team-10', initials: 'SN', name: 'Sara Nguyen', title: 'Consultante — Animation ateliers & diagnostic usage', badge: 'Parella', imageUrl: '' },
    { id: 'team-11', initials: 'GF', name: 'Guillaume Faure', title: 'Consultant — Programmation immobilière & zoning', badge: 'Parella', imageUrl: '' }
  ],

  // ═══════════════════════════════════════════════════
  // PLANS & 3D — un visuel par carte (image ou PDF, même champ imageUrl ;
  // le type réel est déduit de l'extension au moment de l'affichage).
  // ═══════════════════════════════════════════════════
  plans: [
    {
      id: 'plan-1', type: 'Plan', tags: 'Macro-zoning', title: 'Plan macro-zoning — vue générale niveau R+1', imageUrl: 'Plan.jpg',
      comment: "Ce plan présente la répartition grande maille des usages sur le niveau R+1, principal plateau de travail du site. Les zones colorées correspondent aux grandes familles d'usages : bleu clair pour les espaces de travail ouverts, bleu foncé pour les zones de concentration, vert pour les espaces collaboratifs, ocre pour les salles de réunion formelle, orange pour les cabines phoniques en accès libre. Le niveau est organisé autour d'une colonne vertébrale centrale qui sépare les espaces de concentration (côté nord) des espaces collaboratifs (côté sud, plus lumineux). On remarque la densité des cabines phoniques : neuf cabines réparties sur l'ensemble du plateau, soit une cabine pour environ vingt postes — un ratio volontairement généreux. L'implantation précise des équipes sur ce plateau n'est pas encore arrêtée et sera co-construite dans les ateliers d'avril."
    },
    {
      id: 'plan-2', type: '3D', tags: 'Ambiance', title: 'Vue 3D — espace de convivialité central', imageUrl: 'Vue3D.jpg',
      comment: "Cet espace de 180 m² est conçu pour être le cœur battant du site. Lumineux, ouvert, il accueillera les pauses, les déjeuners informels et les échanges spontanés entre équipes. Le mobilier est volontairement mixte : tables hautes pour les échanges debout, assises basses pour les moments détendus, coins semi-privatifs délimités par des cloisons végétalisées. L'îlot central accueille les équipements de restauration légère. Les matériaux — bois clair, béton poncé, végétation intérieure, textile acoustique — créent une ambiance chaleureuse tout en maintenant le temps de réverbération sous 0,6 seconde."
    },
    {
      id: 'plan-3', type: 'Plan', tags: 'Micro-zoning', title: 'Plan micro-zoning — équipe Finance & Contrôle de gestion (exemple)', imageUrl: '',
      comment: "Ce plan de détail est présenté à titre d'exemple pour illustrer le niveau de précision des plans de micro-zoning par équipe. Il ne reflète pas l'implantation définitive — celle-ci sera construite dans l'atelier dédié, prévu mi-avril. On distingue 24 postes organisés en îlots de 4, séparés par des cloisons basses (H.140 cm), deux cabines phoniques à moins de 15 mètres de tout poste, une salle de réunion attenante de 6 personnes, et un espace de rangement avec casiers individuels nominatifs. L'orientation des îlots, la position des cloisons et l'attribution des casiers peuvent être ajustés dans l'atelier."
    },
    {
      id: 'plan-4', type: '3D', tags: 'Concentration', title: 'Vue 3D — cabine phonique et zone de focus', imageUrl: '',
      comment: "Cette vue présente les deux dispositifs les plus attendus : les cabines phoniques individuelles et la zone de focus collective. Chaque cabine fait environ 2 m², équipée d'un siège ergonomique, d'un écran externe (USB-C), d'une ventilation silencieuse et d'un éclairage variable. Isolation acoustique : Rw 38 dB. Accès libre sans réservation, voyant vert/rouge visible depuis l'extérieur. La zone de focus adjacente est régie par des règles strictes : silence complet, pas de téléphone, pas de conversations. Délimitée par un changement de revêtement de sol et une signalétique discrète."
    },
    {
      id: 'plan-5', type: 'Plan', tags: 'Macro-zoning', title: 'Plan macro-zoning — rez-de-chaussée complet', imageUrl: '',
      comment: "Le rez-de-chaussée concentre les fonctions d'accueil et de services. On y trouve : l'accueil principal avec contrôle d'accès par badge, un espace restauration de 400 m² (120 couverts + terrasse extérieure 60 places), trois salles de réunion grandes capacités (20, 30 et 40 personnes) accessibles sans badge, le point colis (accès 24h/24), la salle de sport et les vestiaires (sous-sol), et le local vélos sécurisé (accès direct depuis la rue). Les modalités de fonctionnement de l'espace restauration — self, formule plateau, commande digitale — ne sont pas encore arrêtées."
    },
    {
      id: 'plan-6', type: '3D', tags: 'Ambiance', title: "Vue 3D — hall d'entrée depuis l'accueil", imageUrl: '',
      comment: "Le hall est traversé par une lumière naturelle zénithale provenant d'une verrière d'environ 80 m² située au-dessus de la double hauteur centrale (6,5 m). Les matériaux — pierre claire au sol, béton ciré sur les parties structurelles, panneau bois sur les cloisons légères — créent une ambiance à la fois minérale et chaleureuse. L'escalier principal, généreusement dimensionné (2,4 m de largeur), est visible depuis l'entrée pour encourager son usage. Lors des premières semaines, une équipe d'accueil renforcée sera présente en déambulation pour orienter les collaborateurs et faciliter la prise en main du site."
    }
  ]
};

function stripTags(value) {
  return String(value || '').replace(/<[^>]+>/g, '').trim();
}

function normalizeScopeContent(scope, raw) {
  const fallback = defaultContent.publicContent[scope] || {};
  const out = {
    eyebrow: typeof raw?.eyebrow === 'string' ? raw.eyebrow : fallback.eyebrow || '',
    titleLine1: typeof raw?.titleLine1 === 'string' ? raw.titleLine1 : '',
    titleAccent: typeof raw?.titleAccent === 'string' ? raw.titleAccent : '',
    desc: typeof raw?.desc === 'string' ? raw.desc : fallback.desc || ''
  };
  if (!out.titleLine1 && !out.titleAccent && typeof raw?.title === 'string') {
    const parts = raw.title.split(/<br\s*\/?>/i);
    out.titleLine1 = stripTags(parts[0] || '');
    out.titleAccent = stripTags(parts[1] || '');
  }
  if (!out.titleLine1 && !out.titleAccent) {
    out.titleLine1 = fallback.titleLine1 || '';
    out.titleAccent = fallback.titleAccent || '';
  }
  return out;
}

function normalizePublicContent(raw) {
  const scopes = Object.keys(defaultContent.publicContent);
  const out = {};
  scopes.forEach(scope => {
    out[scope] = normalizeScopeContent(scope, raw?.[scope]);
  });
  return out;
}

function normalizeProgress(raw) {
  const fallback = defaultContent.progress;
  const percentRaw = Number(raw?.percent);
  return {
    stepLine1: typeof raw?.stepLine1 === 'string' ? raw.stepLine1 : fallback.stepLine1,
    stepLine2: typeof raw?.stepLine2 === 'string' ? raw.stepLine2 : fallback.stepLine2,
    percent: Number.isFinite(percentRaw) ? Math.max(0, Math.min(100, Math.round(percentRaw))) : fallback.percent
  };
}

function normalizeMilestone(raw, index) {
  const status = ['done', 'current', 'future'].includes(raw?.status) ? raw.status : 'future';
  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : `m-${Date.now()}-${index}`,
    status,
    date: typeof raw?.date === 'string' ? raw.date : '',
    label: typeof raw?.label === 'string' ? raw.label : '',
    desc: typeof raw?.desc === 'string' ? raw.desc : ''
  };
}

function normalizeMilestones(raw) {
  if (!Array.isArray(raw)) return structuredClone(defaultContent.milestones);
  return raw.map((m, i) => normalizeMilestone(m, i));
}

function normalizeArticle(raw, index) {
  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : `a-${Date.now()}-${index}`,
    tag: typeof raw?.tag === 'string' ? raw.tag : '',
    date: typeof raw?.date === 'string' ? raw.date : '',
    title: typeof raw?.title === 'string' ? raw.title : '',
    chapeau: typeof raw?.chapeau === 'string' ? raw.chapeau : '',
    body: typeof raw?.body === 'string' ? raw.body : ''
  };
}

function normalizeArticles(raw) {
  if (!Array.isArray(raw)) return structuredClone(defaultContent.articles);
  return raw.map((a, i) => normalizeArticle(a, i));
}

// ═══════════════════════════════════════════════════
// AMBASSADEURS / ÉQUIPE / PLANS — mêmes garanties défensives que le
// reste du contenu (jamais de crash si un champ manque ou si le fichier
// content.json vient d'une version antérieure au CMS actuel).
// ═══════════════════════════════════════════════════
function normalizeAmbassadorsContent(raw) {
  const fallback = defaultContent.ambassadorsContent;
  return {
    introTitle: typeof raw?.introTitle === 'string' ? raw.introTitle : fallback.introTitle,
    introBody: typeof raw?.introBody === 'string' ? raw.introBody : fallback.introBody,
    rosterLabel: typeof raw?.rosterLabel === 'string' ? raw.rosterLabel : fallback.rosterLabel,
    ctaTitle: typeof raw?.ctaTitle === 'string' ? raw.ctaTitle : fallback.ctaTitle,
    ctaBody: typeof raw?.ctaBody === 'string' ? raw.ctaBody : fallback.ctaBody
  };
}

function normalizeAmbassador(raw, index) {
  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : `amb-${Date.now()}-${index}`,
    initials: typeof raw?.initials === 'string' ? raw.initials : '',
    name: typeof raw?.name === 'string' ? raw.name : '',
    role: typeof raw?.role === 'string' ? raw.role : '',
    tag: typeof raw?.tag === 'string' ? raw.tag : '',
    imageUrl: typeof raw?.imageUrl === 'string' ? raw.imageUrl : ''
  };
}

function normalizeAmbassadors(raw) {
  if (!Array.isArray(raw)) return structuredClone(defaultContent.ambassadors);
  return raw.map((a, i) => normalizeAmbassador(a, i));
}

function normalizeTeamContent(raw) {
  const fallback = defaultContent.teamContent;
  return {
    parellaIntro: typeof raw?.parellaIntro === 'string' ? raw.parellaIntro : fallback.parellaIntro,
    ctaTitle: typeof raw?.ctaTitle === 'string' ? raw.ctaTitle : fallback.ctaTitle,
    ctaBody: typeof raw?.ctaBody === 'string' ? raw.ctaBody : fallback.ctaBody
  };
}

function normalizeTeamMember(raw, index) {
  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : `team-${Date.now()}-${index}`,
    initials: typeof raw?.initials === 'string' ? raw.initials : '',
    name: typeof raw?.name === 'string' ? raw.name : '',
    title: typeof raw?.title === 'string' ? raw.title : '',
    badge: raw?.badge === 'Parella' ? 'Parella' : 'XYZ',
    imageUrl: typeof raw?.imageUrl === 'string' ? raw.imageUrl : ''
  };
}

function normalizeTeam(raw) {
  if (!Array.isArray(raw)) return structuredClone(defaultContent.team);
  return raw.map((t, i) => normalizeTeamMember(t, i));
}

function normalizePlan(raw, index) {
  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : `plan-${Date.now()}-${index}`,
    type: typeof raw?.type === 'string' ? raw.type : 'Plan',
    tags: typeof raw?.tags === 'string' ? raw.tags : '',
    title: typeof raw?.title === 'string' ? raw.title : '',
    imageUrl: typeof raw?.imageUrl === 'string' ? raw.imageUrl : '',
    comment: typeof raw?.comment === 'string' ? raw.comment : ''
  };
}

function normalizePlans(raw) {
  if (!Array.isArray(raw)) return structuredClone(defaultContent.plans);
  return raw.map((p, i) => normalizePlan(p, i));
}

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultState, null, 2), 'utf8');
  }
  if (!fs.existsSync(CONTENT_FILE)) {
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(defaultContent, null, 2), 'utf8');
  }
}

function normalizeBranding(raw) {
  const theme = raw?.theme === 'rainbow-glass' ? 'rainbow-glass' : 'default';
  return {
    projectName: typeof raw?.projectName === 'string' && raw.projectName.trim() ? raw.projectName : defaultContent.branding.projectName,
    logoUrl: typeof raw?.logoUrl === 'string' ? raw.logoUrl : '',
    theme
  };
}

function readKpiState() {
  ensureDataStore();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      faqAsked: Array.isArray(parsed.faqAsked) ? parsed.faqAsked : [],
      articleOpens: parsed.articleOpens && typeof parsed.articleOpens === 'object' ? parsed.articleOpens : {},
      tabViews: parsed.tabViews && typeof parsed.tabViews === 'object' ? parsed.tabViews : {},
      contactSubmissions: Array.isArray(parsed.contactSubmissions) ? parsed.contactSubmissions : [],
      visitSessions: Array.isArray(parsed.visitSessions) ? parsed.visitSessions : []
    };
  } catch (error) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultState, null, 2), 'utf8');
    return structuredClone(defaultState);
  }
}

function writeKpiState(state) {
  ensureDataStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function readContentState() {
  ensureDataStore();
  try {
    const raw = fs.readFileSync(CONTENT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      branding: normalizeBranding(parsed.branding),
      publicContent: normalizePublicContent(parsed.publicContent),
      faqEntries: Array.isArray(parsed.faqEntries) ? parsed.faqEntries : [],
      faqDrafts: Array.isArray(parsed.faqDrafts) ? parsed.faqDrafts : [],
      progress: normalizeProgress(parsed.progress),
      milestones: normalizeMilestones(parsed.milestones),
      articles: normalizeArticles(parsed.articles),
      ambassadorsContent: normalizeAmbassadorsContent(parsed.ambassadorsContent),
      ambassadors: normalizeAmbassadors(parsed.ambassadors),
      teamContent: normalizeTeamContent(parsed.teamContent),
      team: normalizeTeam(parsed.team),
      plans: normalizePlans(parsed.plans)
    };
  } catch (error) {
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(defaultContent, null, 2), 'utf8');
    return structuredClone(defaultContent);
  }
}

function writeContentState(contentState) {
  ensureDataStore();
  const safe = {
    branding: normalizeBranding(contentState.branding),
    publicContent: normalizePublicContent(contentState.publicContent),
    faqEntries: Array.isArray(contentState.faqEntries) ? contentState.faqEntries : [],
    faqDrafts: Array.isArray(contentState.faqDrafts) ? contentState.faqDrafts : [],
    progress: normalizeProgress(contentState.progress),
    milestones: normalizeMilestones(contentState.milestones),
    articles: normalizeArticles(contentState.articles),
    ambassadorsContent: normalizeAmbassadorsContent(contentState.ambassadorsContent),
    ambassadors: normalizeAmbassadors(contentState.ambassadors),
    teamContent: normalizeTeamContent(contentState.teamContent),
    team: normalizeTeam(contentState.team),
    plans: normalizePlans(contentState.plans)
  };
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(safe, null, 2), 'utf8');
  return safe;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg': return 'image/jpeg';
    case '.jpeg': return 'image/jpeg';
    case '.ico': return 'image/x-icon';
    default: return 'text/plain; charset=utf-8';
  }
}

function serveStaticFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { ok: false, error: 'Fichier introuvable' });
      return;
    }
    res.writeHead(200, { 'Content-Type': getMimeType(filePath), 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, status: 'healthy' });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/kpi') {
    sendJson(res, 200, readKpiState());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/content') {
    sendJson(res, 200, readContentState());
    return;
  }

  // ── Routes protégées par jeton admin ──────────────────
  if (req.method === 'POST' && url.pathname === '/api/content') {
    if (!isAuthorized(req)) { sendJson(res, 401, { ok: false, error: 'Non autorisé' }); return; }
    try {
      const parsed = await readBody(req);
      const saved = writeContentState({
        branding: parsed.branding,
        publicContent: parsed.publicContent,
        faqEntries: parsed.faqEntries,
        faqDrafts: parsed.faqDrafts,
        progress: parsed.progress,
        milestones: parsed.milestones,
        articles: parsed.articles,
        ambassadorsContent: parsed.ambassadorsContent,
        ambassadors: parsed.ambassadors,
        teamContent: parsed.teamContent,
        team: parsed.team,
        plans: parsed.plans
      });
      sendJson(res, 200, { ok: true, content: saved });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: 'Payload invalide' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/upload') {
    if (!isAuthorized(req)) { sendJson(res, 401, { ok: false, error: 'Non autorisé' }); return; }
    try {
      const parsed = await readBody(req);
      const mimeType = String(parsed.mimeType || '');
      const ext = ALLOWED_UPLOAD_TYPES[mimeType];
      if (!ext) {
        sendJson(res, 400, { ok: false, error: 'Type de fichier non autorisé (png, jpg ou pdf uniquement).' });
        return;
      }
      const dataBase64 = String(parsed.dataBase64 || '');
      const buffer = Buffer.from(dataBase64, 'base64');
      if (!buffer.length) {
        sendJson(res, 400, { ok: false, error: 'Fichier vide ou illisible.' });
        return;
      }
      if (buffer.length > MAX_UPLOAD_BYTES) {
        sendJson(res, 413, { ok: false, error: `Fichier trop volumineux (max ${Math.round(MAX_UPLOAD_BYTES/1024/1024)} Mo).` });
        return;
      }
      ensureDataStore();
      const safeName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, safeName), buffer);
      sendJson(res, 200, { ok: true, url: `/uploads/${safeName}` });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: "Échec de l'envoi du fichier." });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/kpi/reset') {
    if (!isAuthorized(req)) { sendJson(res, 401, { ok: false, error: 'Non autorisé' }); return; }
    writeKpiState(structuredClone(defaultState));
    sendJson(res, 200, { ok: true, state: defaultState });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/login') {
    try {
      const parsed = await readBody(req);
      const password = String(parsed.password || '');
      if (password === ADMIN_PASSWORD) {
        sendJson(res, 200, { ok: true, token: computeAdminToken() });
      } else {
        sendJson(res, 401, { ok: false, message: 'Mot de passe incorrect.' });
      }
    } catch (error) {
      sendJson(res, 400, { ok: false, error: 'Payload invalide' });
    }
    return;
  }

  // ── Suivi KPI — ouvert (déclenché par les collaborateurs, pas l'admin) ──
  if (req.method === 'POST' && url.pathname === '/api/kpi/track') {
    try {
      const parsed = await readBody(req);
      const state = readKpiState();

      if (parsed.type === 'faq') {
        state.faqAsked.push({
          q: String(parsed.question || ''),
          matched: Boolean(parsed.matched),
          entryId: parsed.entryId || null,
          ts: Number(parsed.ts || Date.now())
        });
      } else if (parsed.type === 'article') {
        state.articleOpens[parsed.articleId] = (state.articleOpens[parsed.articleId] || 0) + 1;
      } else if (parsed.type === 'tab') {
        state.tabViews[parsed.pageId] = (state.tabViews[parsed.pageId] || 0) + 1;
      } else if (parsed.type === 'visit') {
        const sessionId = String(parsed.sessionId || '');
        if (sessionId && !state.visitSessions.includes(sessionId)) state.visitSessions.push(sessionId);
      } else if (parsed.type === 'contact') {
        state.contactSubmissions.push({
          name: String(parsed.name || ''),
          email: String(parsed.email || ''),
          message: String(parsed.message || ''),
          ts: Number(parsed.ts || Date.now())
        });
      }

      writeKpiState(state);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: 'Payload invalide' });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/') {
    serveStaticFile(res, path.join(ROOT, 'index.html'));
    return;
  }

  if (req.method === 'GET') {
    const requested = path.normalize(path.join(ROOT, url.pathname));
    if (requested.startsWith(ROOT) && fs.existsSync(requested) && fs.statSync(requested).isFile()) {
      serveStaticFile(res, requested);
      return;
    }
  }

  sendJson(res, 404, { ok: false, error: 'Route introuvable' });
});

server.listen(PORT, () => {
  console.log(`Serveur local démarré sur http://localhost:${PORT}`);
});