import { useState } from 'react'
import {
  HelpCircle, ChevronDown, ChevronRight, Download,
  ShoppingCart, Package, Warehouse, Users, Truck,
  LayoutDashboard, BarChart3, Settings, Tag, Shield,
  Wifi, FileText, Lock, ShoppingBag, RotateCcw
} from 'lucide-react'
import jsPDF from 'jspdf'

interface Section {
  id: string
  icon: typeof HelpCircle
  titre: string
  couleur: string
  etapes: { titre: string; contenu: string }[]
}

const SECTIONS: Section[] = [
  {
    id: 'demarrage',
    icon: LayoutDashboard,
    titre: 'Premiers pas',
    couleur: 'blue',
    etapes: [
      { titre: 'Créer votre compte', contenu: "Rendez-vous sur la page de connexion et cliquez sur « Créer un compte gratuitement ». Renseignez le nom de votre boutique, votre nom, votre numéro de téléphone et un mot de passe. Votre compte est créé instantanément avec 15 jours d'essai gratuit." },
      { titre: 'Se connecter', contenu: 'Sur la page de connexion, entrez votre numéro de téléphone et votre mot de passe, puis cliquez sur « Se connecter ».' },
      { titre: 'Naviguer dans l\'application', contenu: 'Le menu latéral (à gauche) vous donne accès à tous les modules : Tableau de bord, Caisse, Articles, Stock, Clients, Fournisseurs, etc. Sur mobile, appuyez sur l\'icône ☰ en haut à gauche pour ouvrir le menu.' },
      { titre: 'Configurer votre entreprise', contenu: 'Allez dans Paramètres (accessible uniquement aux administrateurs) pour renseigner le nom de votre boutique, votre téléphone et votre adresse. Ces informations apparaîtront sur vos reçus.' },
    ]
  },
  {
    id: 'tableau-bord',
    icon: BarChart3,
    titre: 'Tableau de bord',
    couleur: 'purple',
    etapes: [
      { titre: 'Lire les indicateurs', contenu: 'Le tableau de bord affiche en temps réel : le Chiffre d\'Affaires, le Bénéfice estimé, le nombre de ventes et la Valeur du stock. Ces chiffres se mettent à jour automatiquement après chaque vente ou modification d\'article.' },
      { titre: 'Filtrer par période', contenu: 'Utilisez les boutons Aujourd\'hui / Semaine / Mois / Année pour filtrer le chiffre d\'affaires. Le bouton « Personnalisée » vous permet de choisir une plage de dates exacte avec un calendrier.' },
      { titre: 'Alertes stock faible', contenu: 'Le panneau de droite affiche les articles dont le stock est inférieur ou égal au stock minimum défini. Un badge rouge « Rupture » indique un stock à zéro. Pensez à réapprovisionner rapidement.' },
      { titre: 'Exporter un rapport PDF', contenu: 'Cliquez sur le bouton bleu « Exporter PDF » pour télécharger un rapport complet de la période sélectionnée : indicateurs clés, alertes stock et détail de toutes les ventes.' },
    ]
  },
  {
    id: 'caisse',
    icon: ShoppingCart,
    titre: 'Caisse & Ventes',
    couleur: 'emerald',
    etapes: [
      { titre: 'Rechercher et ajouter un article', contenu: 'Dans la Caisse, tapez le nom d\'un article dans la barre de recherche. Les résultats apparaissent instantanément. Cliquez sur un article pour l\'ajouter au panier. Vous pouvez aussi cliquer directement sur les articles affichés en raccourci.' },
      { titre: 'Gérer le panier', contenu: 'Dans le panier (à droite), utilisez les boutons + et − pour ajuster les quantités. L\'icône corbeille retire un article. Le total se calcule automatiquement.' },
      { titre: 'Associer un client', contenu: 'Sélectionnez un client dans la liste déroulante sous le panier. Si le client n\'existe pas encore, cliquez sur le bouton + à côté pour le créer directement depuis la caisse, même sans internet.' },
      { titre: 'Appliquer une remise', contenu: 'Entrez le montant de la remise dans le champ « Remise » (en FCFA). Le total est recalculé automatiquement.' },
      { titre: 'Valider et imprimer le reçu', contenu: 'Cliquez sur « Valider la vente ». Le stock se met à jour automatiquement. Choisissez ensuite le format du reçu (Ticket 58mm, 80mm ou PDF A4) puis cliquez sur « Imprimer » ou « Télécharger PDF ».' },
      { titre: 'Réimprimer un ancien reçu', contenu: 'Allez dans « Historique ventes », cliquez sur l\'icône œil d\'une vente, choisissez le format et cliquez sur « Réimprimer ».' },
    ]
  },
  {
    id: 'commandes',
    icon: ShoppingBag,
    titre: 'Commandes',
    couleur: 'amber',
    etapes: [
      {
        titre: 'Qu\'est-ce qu\'une commande ?',
        contenu: 'Une commande est une pré-vente enregistrée avant d\'être confirmée. Elle vous permet de noter les demandes de clients (avec leurs coordonnées de livraison) sans impacter le stock immédiatement. Une fois confirmée, elle se transforme automatiquement en vente.'
      },
      {
        titre: 'Créer une commande',
        contenu: 'Allez dans le menu « Commandes » puis cliquez sur « Nouvelle commande ». Renseignez le client (depuis la liste ou manuellement avec nom, téléphone et adresse de livraison), ajoutez les articles commandés avec leurs quantités et prix, puis cliquez sur « Enregistrer la commande ». La commande est créée avec le statut « En attente ».'
      },
      {
        titre: 'Alerte de stock insuffisant',
        contenu: 'Si la quantité demandée dépasse le stock disponible, un avertissement orange s\'affiche automatiquement. Vous pouvez tout de même enregistrer la commande, mais un message vous rappelle de réapprovisionner les articles concernés avant de confirmer.'
      },
      {
        titre: 'Badge commandes en attente',
        contenu: 'Un badge orange s\'affiche à côté du menu « Commandes » dès qu\'il y a des commandes en attente. Ce compteur se met à jour en temps réel. Sur le tableau de bord, une carte amber affiche également le nombre de commandes en attente avec un lien direct.'
      },
      {
        titre: 'Confirmer une commande → Vente',
        contenu: 'Ouvrez la commande en cliquant sur l\'icône œil, puis cliquez sur « Confirmer → Vente ». La commande passe au statut « Confirmée », une vente est automatiquement créée dans l\'historique, et le stock est déduit pour chaque article. Si des articles ont un stock insuffisant, un avertissement s\'affiche avant confirmation.'
      },
      {
        titre: 'Annuler une commande',
        contenu: 'Ouvrez la commande et cliquez sur « Annuler ». La commande passe au statut « Annulée » et aucune modification de stock n\'est effectuée. Une commande annulée ne peut pas être réactivée.'
      },
      {
        titre: 'Filtrer et rechercher les commandes',
        contenu: 'Utilisez la barre de recherche pour trouver une commande par numéro (CMD-...) ou par nom de client. Les boutons de filtre permettent d\'afficher uniquement les commandes « En attente », « Confirmées » ou « Annulées ».'
      },
    ]
  },
  {
    id: 'avoirs',
    icon: RotateCcw,
    titre: 'Avoirs & Retours clients',
    couleur: 'red',
    etapes: [
      {
        titre: 'Qu\'est-ce qu\'un avoir ?',
        contenu: 'Un avoir permet d\'annuler tout ou partie d\'une vente déjà validée lorsqu\'un client retourne un ou plusieurs articles. Il réintègre automatiquement le stock, déduit le montant du chiffre d\'affaires et conserve une trace complète de l\'opération. Ce module est réservé aux Administrateurs et Gestionnaires — les Caissiers n\'y ont pas accès.'
      },
      {
        titre: 'Créer un avoir',
        contenu: 'Allez dans le menu « Avoirs / Retours » puis cliquez sur « Nouvel avoir ». Recherchez la vente concernée par son numéro (ex : VT-250618-0001). Une fois la vente trouvée, cochez les articles retournés par le client et indiquez la quantité retournée pour chacun.'
      },
      {
        titre: 'Avoir partiel ou total',
        contenu: 'Si vous ne sélectionnez qu\'une partie des articles, l\'avoir est automatiquement classé « Partiel » et la vente reste valide. Si vous cliquez sur « Tout sélectionner » ou cochez tous les articles avec leur quantité complète, l\'avoir devient « Total » et la vente originale est marquée comme annulée.'
      },
      {
        titre: 'Motif obligatoire',
        contenu: 'Avant de valider un avoir, vous devez impérativement choisir un motif parmi : Produit défectueux, Erreur de facturation, Erreur de quantité, Mauvais article livré, Changement d\'avis du client, Retour client, ou Autre. Un commentaire libre peut être ajouté en complément.'
      },
      {
        titre: 'Confirmation de sécurité',
        contenu: 'Avant validation finale, une fenêtre de confirmation récapitule l\'opération : montant de l\'avoir, nombre d\'articles réintégrés en stock, et impact sur la vente. Cette étape est obligatoire et ne peut pas être contournée.'
      },
      {
        titre: 'Impact sur le stock',
        contenu: 'Chaque article retourné est automatiquement réintégré dans le stock. Un mouvement de stock de type « Retour Client » est créé et visible dans l\'historique des mouvements et l\'inventaire.'
      },
      {
        titre: 'Impact sur le chiffre d\'affaires',
        contenu: 'Le montant de chaque avoir est automatiquement déduit du chiffre d\'affaires sur le tableau de bord (jour, semaine, mois, année) ainsi que dans le graphique d\'évolution et les rapports PDF exportés.'
      },
      {
        titre: 'Document PDF d\'avoir',
        contenu: 'Depuis l\'historique des avoirs, cliquez sur l\'icône œil pour voir le détail, puis sur « Télécharger PDF avoir ». Le document généré porte la mention « DOCUMENT D\'AVOIR » et contient le numéro d\'avoir, la référence de la vente originale, le client, les articles retournés, le motif et le montant.'
      },
      {
        titre: 'Historique et traçabilité',
        contenu: 'Tous les avoirs sont conservés définitivement — aucune suppression n\'est possible. L\'historique affiche le numéro d\'avoir, la vente de référence, le client, le motif, le type (partiel/total), le montant et l\'utilisateur ayant effectué l\'opération.'
      },
    ]
  },
  {
    id: 'articles',
    icon: Package,
    titre: 'Articles',
    couleur: 'amber',
    etapes: [
      { titre: 'Ajouter un article', contenu: 'Cliquez sur « Nouvel article ». Renseignez : le nom, la catégorie, le prix d\'achat global, le transport, la quantité et le prix de vente. Le prix de revient unitaire est calculé automatiquement : (Prix achat + Transport) ÷ Quantité.' },
      { titre: 'Prix de revient unitaire', contenu: 'C\'est le coût réel d\'une unité = (Prix d\'achat global + Frais de transport) ÷ Quantité achetée. Ce coût est figé au moment de la saisie et sert à calculer la valeur de votre stock.' },
      { titre: 'Stock minimum', contenu: 'Définissez un stock minimum pour chaque article. Quand le stock descend en dessous de ce seuil, une alerte orange apparaît dans le tableau de bord et dans la liste des articles.' },
      { titre: 'Modifier un article', contenu: 'Cliquez sur l\'icône crayon à droite de l\'article. Modifiez les informations souhaitées et cliquez sur Enregistrer. Le prix de revient sera recalculé si vous modifiez les coûts.' },
      { titre: 'Supprimer un article', contenu: 'Cliquez sur l\'icône corbeille. L\'article est marqué comme inactif (non définitivement supprimé) pour conserver l\'historique des ventes.' },
    ]
  },
  {
    id: 'stock',
    icon: Warehouse,
    titre: 'Gestion du stock',
    couleur: 'orange',
    etapes: [
      { titre: 'Voir l\'état du stock', contenu: 'L\'onglet « État du stock » affiche pour chaque article : le stock actuel, le stock minimum, le prix de revient unitaire et la valeur du stock. La ligne TOTAL en bas donne la valeur totale de votre inventaire.' },
      { titre: 'Enregistrer une entrée de stock (achat)', contenu: 'Cliquez sur « Mouvement de stock » → choisissez « Entrée — Achat fournisseur ». Sélectionnez l\'article, entrez la quantité. Si vous renseignez le prix d\'achat et le transport de cette nouvelle livraison, le prix de revient sera mis à jour automatiquement.' },
      { titre: 'Enregistrer une sortie (perte, casse)', contenu: 'Choisissez le type « Sortie — Perte » ou « Sortie — Casse ». Entrez la quantité perdue. Le stock sera déduit et le mouvement sera enregistré dans l\'historique.' },
      { titre: 'Faire un inventaire', contenu: 'Choisissez « Inventaire — Ajustement » pour corriger le stock après un comptage physique. Entrez la quantité réelle comptée. La différence sera automatiquement calculée.' },
      { titre: 'Valeur du stock', contenu: 'La valeur du stock diminue automatiquement à chaque vente : Valeur = Prix de revient unitaire × Quantité restante. Elle augmente lors des nouvelles entrées.' },
    ]
  },
  {
    id: 'clients',
    icon: Users,
    titre: 'Clients',
    couleur: 'blue',
    etapes: [
      { titre: 'Ajouter un client', contenu: 'Allez dans Clients → « Nouveau client ». Renseignez le nom (obligatoire), le téléphone, l\'email, l\'adresse et des notes. Les clients peuvent aussi être créés directement depuis la Caisse.' },
      { titre: 'Rechercher un client', contenu: 'Utilisez la barre de recherche pour trouver rapidement un client par son nom ou son numéro de téléphone.' },
      { titre: 'Voir l\'historique d\'achats', contenu: 'Dans l\'historique des ventes, filtrez par client pour voir toutes ses commandes et le montant total de ses achats.' },
    ]
  },
  {
    id: 'fournisseurs',
    icon: Truck,
    titre: 'Fournisseurs',
    couleur: 'red',
    etapes: [
      { titre: 'Ajouter un fournisseur', contenu: 'Allez dans Fournisseurs → « Nouveau fournisseur ». Renseignez le nom, le téléphone, l\'email et l\'adresse. Les fournisseurs peuvent ensuite être associés à vos articles pour un meilleur suivi.' },
      { titre: 'Associer à un article', contenu: 'Lors de la création ou modification d\'un article, sélectionnez le fournisseur dans la liste déroulante. Cela vous permet de savoir auprès de qui vous réapprovisionnez chaque produit.' },
    ]
  },
  {
    id: 'utilisateurs',
    icon: Shield,
    titre: 'Utilisateurs & Accès',
    couleur: 'purple',
    etapes: [
      { titre: 'Créer un utilisateur', contenu: 'Allez dans Utilisateurs → « Nouvel utilisateur ». Renseignez le nom, le numéro de téléphone (qui servira d\'identifiant), le rôle (Admin ou Gestionnaire) et un mot de passe. Vous pouvez aussi définir une question secrète pour la récupération de mot de passe.' },
      { titre: 'Rôle Administrateur', contenu: 'L\'Administrateur a accès à tous les modules : tableau de bord, caisse, articles, stock, clients, fournisseurs, utilisateurs, journal d\'audit et paramètres.' },
      { titre: 'Rôle Gestionnaire', contenu: 'Le Gestionnaire a un accès limité défini par l\'administrateur. Par défaut : Caisse, Ventes, Articles, Stock, Clients.' },
      { titre: 'Personnaliser les accès', contenu: 'Allez dans « Rôles & permissions » pour cocher/décocher les modules accessibles aux Gestionnaires. Les changements prennent effet à la prochaine connexion du gestionnaire.' },
      { titre: 'Suspendre ou supprimer un accès', contenu: 'Depuis la liste des utilisateurs, cliquez sur le bouton « Accès actif » pour suspendre temporairement un compte, ou sur l\'icône corbeille pour le supprimer définitivement.' },
      { titre: 'Mot de passe oublié', contenu: 'Sur la page de connexion, cliquez sur « Mot de passe oublié ? ». Entrez votre numéro de téléphone, répondez à votre question secrète et définissez un nouveau mot de passe.' },
    ]
  },
  {
    id: 'offline',
    icon: Wifi,
    titre: 'Mode hors ligne',
    couleur: 'gray',
    etapes: [
      { titre: 'Fonctionnement sans internet', contenu: 'ChezMoi fonctionne même sans connexion internet. Les articles et clients sont mis en cache localement. Vous pouvez continuer à enregistrer des ventes et créer des clients normalement.' },
      { titre: 'Indicateur de statut', contenu: 'La barre du haut affiche « En ligne » (vert) ou « Hors ligne » (orange). Si des ventes sont en attente de synchronisation, un badge orange affiche le nombre de ventes concernées.' },
      { titre: 'Synchronisation automatique', contenu: 'Dès que la connexion revient, les ventes et clients créés hors ligne sont automatiquement envoyés vers le serveur. Un message de confirmation s\'affiche.' },
      { titre: 'Synchronisation manuelle', contenu: 'Si besoin, cliquez sur l\'icône ↻ à côté du badge « ventes en attente » pour forcer la synchronisation immédiatement.' },
    ]
  },
  {
    id: 'licence',
    icon: Lock,
    titre: 'Licence & Abonnement',
    couleur: 'emerald',
    etapes: [
      { titre: 'Essai gratuit', contenu: 'À la création de votre compte, vous bénéficiez automatiquement de 15 jours d\'essai gratuit avec toutes les fonctionnalités. Aucune carte bancaire requise.' },
      { titre: 'Notifications d\'expiration', contenu: 'Une bannière s\'affiche en haut de l\'application 7 jours, puis 3 jours avant l\'expiration de votre licence, ainsi que le jour J.' },
      { titre: 'Renouveler sa licence', contenu: 'Cliquez sur « Renouveler → » dans la bannière, ou sur « Renouveler ma licence » en bas du menu. Choisissez votre offre, suivez les instructions de paiement Mobile Money et envoyez votre reçu par WhatsApp.' },
      { titre: 'Après expiration', contenu: 'Après expiration, la consultation de vos données reste possible mais les nouvelles ventes et entrées de stock sont bloquées jusqu\'au renouvellement.' },
    ]
  },
]

const COULEURS: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  gray: 'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

function genererNoticePDF() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const checkPage = (needed: number) => {
    if (y + needed > 282) { doc.addPage(); y = margin + 5 }
  }

  const h1 = (txt: string) => {
    checkPage(14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(27, 43, 75)
    doc.text(txt, margin, y)
    y += 8
    doc.setDrawColor(27, 43, 75)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 5
  }

  const h2 = (txt: string) => {
    checkPage(14)
    y += 3
    doc.setFillColor(37, 99, 235)
    doc.rect(margin, y - 4, contentWidth, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    doc.text(txt, margin + 3, y + 0.5)
    doc.setTextColor(0, 0, 0)
    y += 8
  }

  const h3 = (num: number, txt: string) => {
    checkPage(8)
    y += 2
    doc.setFillColor(239, 246, 255)
    doc.rect(margin + 3, y - 3.5, contentWidth - 3, 6.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(30, 64, 175)
    doc.text(`${num}.`, margin + 5, y)
    doc.setTextColor(20, 20, 20)
    doc.text(txt, margin + 11, y)
    y += 5
  }

  const para = (txt: string) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    const lines = doc.splitTextToSize(txt, contentWidth - 10)
    checkPage(lines.length * 4.8 + 2)
    doc.text(lines, margin + 8, y)
    y += lines.length * 4.8 + 1
  }

  // ===== PAGE DE COUVERTURE =====
  doc.setFillColor(27, 43, 75)
  doc.rect(0, 0, 210, 297, 'F')

  // Logo text
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(36)
  doc.setTextColor(255, 255, 255)
  doc.text('ChezMoi Pro', pageWidth / 2, 110, { align: 'center' })

  doc.setFontSize(15)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(147, 197, 253)
  doc.text('Notice d\'utilisation complete', pageWidth / 2, 126, { align: 'center' })

  doc.setFontSize(11)
  doc.setTextColor(191, 219, 254)
  doc.text('Gestion commerciale simplifiee pour commercants et PME', pageWidth / 2, 142, { align: 'center' })

  doc.setDrawColor(59, 130, 246)
  doc.setLineWidth(0.5)
  doc.line(margin + 20, 152, pageWidth - margin - 20, 152)

  doc.setFontSize(9)
  doc.setTextColor(148, 163, 184)
  doc.text(`Version 1.0  -  ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 162, { align: 'center' })

  // Table des matières
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Sommaire', pageWidth / 2, 185, { align: 'center' })

  const sommaire = [
    '1. Premiers pas',
    '2. Tableau de bord',
    '3. Caisse et Ventes',
    '4. Commandes',
    '5. Avoirs et Retours',
    '6. Articles',
    '7. Gestion du stock',
    '8. Clients',
    '9. Fournisseurs',
    '10. Utilisateurs et Acces',
    '11. Mode hors ligne',
    '12. Licence et Abonnement',
  ]

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(186, 230, 253)
  sommaire.forEach((item, i) => {
    const col = i < 6 ? pageWidth / 2 - 50 : pageWidth / 2 + 5
    const row = 193 + (i % 6) * 8
    doc.text(item, col, row)
  })

  // Nouvelle page pour le contenu
  doc.addPage()
  y = margin + 5
  doc.setTextColor(0, 0, 0)

  // Introduction
  h1('Introduction')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(60, 60, 60)
  const intro1 = doc.splitTextToSize('ChezMoi est une application web progressive (PWA) de gestion commerciale concue pour les commercants, boutiques, magasins, grossistes et PME. Elle fonctionne sur PC, tablette et smartphone, et meme sans connexion internet.', contentWidth)
  doc.text(intro1, margin, y)
  y += intro1.length * 5 + 3
  const intro2 = doc.splitTextToSize('Ce guide vous explique pas a pas comment utiliser toutes les fonctionnalites de ChezMoi Pro.', contentWidth)
  doc.text(intro2, margin, y)
  y += intro2.length * 5 + 5

  // Sections — inclut automatiquement le module Commandes
  for (const section of SECTIONS) {
    checkPage(16)
    h2(section.titre)
    section.etapes.forEach((etape, idx) => {
      h3(idx + 1, etape.titre)
      const texteNettoye = etape.contenu
        .replace(/['']/g, "'")
        .replace(/[""]/g, '"')
        .replace(/[«»]/g, '"')
        .replace(/[→←↑↓]/g, '->')
        .replace(/[☰]/g, '[menu]')
        .replace(/[↻]/g, '[sync]')
      para(texteNettoye)
    })
    y += 3
  }

  // Offres
  checkPage(60)
  h2('Nos offres de licence')
  y += 2

  const offres = [
    { nom: 'Essai gratuit', prix: '0 FCFA', duree: '15 jours', users: '3 utilisateurs', couleur: [16, 185, 129] as [number,number,number] },
    { nom: 'Mensuelle', prix: '4 500 FCFA', duree: '1 mois', users: '3 utilisateurs', couleur: [37, 99, 235] as [number,number,number] },
    { nom: 'Semestrielle', prix: '25 500 FCFA', duree: '6 mois', users: '5 utilisateurs', couleur: [124, 58, 237] as [number,number,number] },
    { nom: 'Annuelle', prix: '50 000 FCFA', duree: '1 an', users: '10 utilisateurs', couleur: [217, 119, 6] as [number,number,number] },
    { nom: 'A vie', prix: '150 000 FCFA', duree: 'Illimitee', users: '15 utilisateurs', couleur: [220, 38, 38] as [number,number,number] },
  ]

  offres.forEach(offre => {
    checkPage(18)
    const [r, g, b] = offre.couleur
    doc.setFillColor(r, g, b)
    doc.rect(margin + 3, y, 3, 12, 'F')
    doc.setFillColor(248, 250, 252)
    doc.rect(margin + 6, y, contentWidth - 6, 12, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(r, g, b)
    doc.text(offre.nom, margin + 10, y + 5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(20, 20, 20)
    doc.text(offre.prix, margin + 10, y + 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(100, 100, 100)
    doc.text(`Duree: ${offre.duree}  |  ${offre.users}`, pageWidth - margin - 5, y + 7.5, { align: 'right' })
    y += 15
  })

  // Pied de page
  const nbPages = doc.getNumberOfPages()
  for (let i = 1; i <= nbPages; i++) {
    doc.setPage(i)
    if (i === 1) continue // Pas de pied de page sur la couverture
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(150, 150, 150)
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.line(margin, 287, pageWidth - margin, 287)
    doc.text('ChezMoi Pro  -  Notice d\'utilisation', margin, 292)
    doc.text(`Page ${i - 1} / ${nbPages - 1}`, pageWidth - margin, 292, { align: 'right' })
  }

  doc.save('Notice-ChezMoi-Pro.pdf')
}

export default function AidePage() {
  const [ouvert, setOuvert] = useState<string | null>('demarrage')
  const [etapeOuverte, setEtapeOuverte] = useState<string | null>(null)

  const toggleSection = (id: string) => {
    setOuvert(prev => prev === id ? null : id)
    setEtapeOuverte(null)
  }

  const toggleEtape = (key: string) => {
    setEtapeOuverte(prev => prev === key ? null : key)
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <HelpCircle size={22} className="text-blue-600" /> Centre d'aide
          </h1>
          <p className="text-sm text-gray-500 mt-1">Tout ce qu'il faut savoir pour utiliser ChezMoi Pro.</p>
        </div>
        <button
          onClick={genererNoticePDF}
          className="btn-primary flex items-center gap-2"
        >
          <Download size={16} /> Télécharger la notice PDF
        </button>
      </div>

      <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 flex items-start gap-3">
        <FileText size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Notice d'utilisation complète</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
            Téléchargez la notice PDF pour l'avoir toujours à portée de main, même sans internet.
            Elle couvre tous les modules de l'application.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {SECTIONS.map(section => {
          const Icon = section.icon
          const estOuvert = ouvert === section.id
          return (
            <div key={section.id} className="card overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${COULEURS[section.couleur]}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{section.titre}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{section.etapes.length} sujet{section.etapes.length > 1 ? 's' : ''}</p>
                </div>
                {estOuvert ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
              </button>

              {estOuvert && (
                <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                  {section.etapes.map((etape, idx) => {
                    const key = `${section.id}-${idx}`
                    const etapeEstOuverte = etapeOuverte === key
                    return (
                      <div key={key}>
                        <button
                          onClick={() => toggleEtape(key)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        >
                          <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-500 flex-shrink-0">
                            {idx + 1}
                          </div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{etape.titre}</p>
                          {etapeEstOuverte
                            ? <ChevronDown size={14} className="text-gray-400" />
                            : <ChevronRight size={14} className="text-gray-400" />
                          }
                        </button>
                        {etapeEstOuverte && (
                          <div className="px-4 pb-4 ml-9">
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                              {etape.contenu}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="card p-5 text-center space-y-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Besoin d'aide supplémentaire ?</p>
        <p className="text-xs text-gray-400">Contactez notre support via WhatsApp pour toute question.</p>
        <button
          onClick={() => window.open('https://wa.me/2250700000000?text=Bonjour, j\'ai besoin d\'aide avec ChezMoi Pro.', '_blank')}
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Contacter le support WhatsApp
        </button>
      </div>
    </div>
  )
}
