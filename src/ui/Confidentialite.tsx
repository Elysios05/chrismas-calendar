/**
 * Page « Confidentialité & mentions » (audit SEC-07, #143), ouverte depuis l'accueil et les Réglages.
 *
 * Choix d'Alexandre (27 nov) : données gardées au plus tard jusqu'au 31 janvier 2027 ; contact = son adresse,
 * lue depuis `VITE_CONTACT` pour ne pas l'écrire dans le dépôt public. Brouillon simple, pas un avis juridique.
 * Faits techniques : Supabase région eu-west-1 (Irlande), site sur GitHub Pages.
 */
import { useDialog } from "./useDialog";
import { CONTACT } from "./Soutenir";

export const FIN_CONSERVATION = "31 janvier 2027";

export function Confidentialite({ onFermer }: { onFermer: () => void }) {
  const { panneau, surFond } = useDialog<HTMLElement>(onFermer);
  const contact = CONTACT
    ? <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
    : <>l'adresse indiquée sur cette page dès qu'elle sera prête</>;

  return (
    <div className="sheet conf-fond" role="presentation" onClick={surFond}>
      <section ref={panneau} tabIndex={-1} className="sheet-panel conf" role="dialog" aria-modal="true"
        aria-labelledby="conf-titre" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <div>
            <p className="sheet-day">Calendrier de l'Avent</p>
            <h2 className="sheet-title" id="conf-titre">Confidentialité &amp; mentions</h2>
          </div>
          <button className="sheet-close" type="button" onClick={onFermer} aria-label="Fermer">✕</button>
        </header>

        <div className="conf-texte">
          <h3>Qui s'en occupe</h3>
          <p>Ce calendrier est un projet personnel, gratuit et sans publicité, fait par Alexandre.
            Pour toute question : {contact}.</p>

          <h3>Ce que nous gardons</h3>
          <ul>
            <li>vos deux prénoms et la couleur de vos personnages ;</li>
            <li>vos identifiants de connexion (le mot de passe est chiffré : personne ne peut le lire) ;</li>
            <li>ce que vous mettez dans les cases : textes, réponses aux jeux, photos ;</li>
            <li>votre avancée dans le calendrier et vos scores ;</li>
            <li>si vous activez les rappels, l'adresse technique qui permet d'envoyer une notification à votre appareil.</li>
          </ul>
          <p>Le son et les animations sont réglés sur votre appareil seulement.</p>

          <h3>Pourquoi</h3>
          <p>Uniquement pour faire marcher votre calendrier. Rien n'est vendu, rien ne sert à de la publicité,
            et il n'y a pas de traceur ni de mesure d'audience.</p>

          <h3>Où</h3>
          <p>Les données sont stockées chez Supabase, sur des serveurs en Irlande (Union européenne).
            Le site lui-même est servi par GitHub Pages, et les polices d'écriture par Google Fonts :
            comme pour tout site, ils voient l'adresse internet de votre appareil.</p>

          <h3>Combien de temps</h3>
          <p>Jusqu'à ce que vous supprimiez votre calendrier, et au plus tard le {FIN_CONSERVATION}.
            Un calendrier que personne n'a jamais rejoint est effacé plus tôt.</p>

          <h3>Vos droits</h3>
          <p>La personne qui a créé le calendrier peut tout effacer elle-même : Réglages › Notre calendrier ›
            « Supprimer notre calendrier ». Textes, photos et vos deux comptes disparaissent pour de bon.
            Pour consulter, corriger ou effacer vos données autrement, écrivez à {contact}.
            Vous pouvez aussi vous adresser à la CNIL (cnil.fr).</p>
        </div>

        <button className="btn conf-ok" type="button" onClick={onFermer}>J'ai compris</button>
      </section>
    </div>
  );
}
