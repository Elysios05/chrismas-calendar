/**
 * Mise en page commune des écrans des salons (piste B « Pingou », choisie par Alexandre le 25 nov) :
 * Pingou en haut avec sa bulle, les réponses en bas. Une question par écran.
 */
import type { ReactNode } from "react";
import type { CouleursJoueur } from "../../core/contracts";
import { PenguinPortrait } from "../Mascot";
import { faceOf, textOf, type PingouLine } from "../pingou/lines";
import "./salons.css";

export function EcranPingou({ ligne, progression, grand, children, onRetour }: {
  ligne: PingouLine;
  /** 0 à 1 : barre de progression de l'assistant (absente sinon). */
  progression?: number;
  /** Pingou en grand (accueil). */
  grand?: boolean;
  onRetour?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="salon">
      <div className="login-flakes" aria-hidden="true">{Array.from({ length: 20 }, (_, i) => <span key={i}>❄</span>)}</div>
      {progression !== undefined && (
          <div className="salon-barre-ligne">
            {onRetour
              ? <button type="button" className="salon-retour" onClick={onRetour} aria-label="Revenir à la question précédente">‹</button>
              : <span className="salon-retour-vide" />}
            <div className="salon-barre" role="progressbar" aria-label="Avancement" aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={Math.round(progression * 100)}>
              <span style={{ width: `${Math.round(progression * 100)}%` }} />
            </div>
          </div>
      )}
      <div className="salon-haut">
        <div className="salon-pingou"><PenguinPortrait size={grand ? 150 : 110} expression={faceOf(ligne)} /></div>
        {/* role=status : la nouvelle question est lue par les lecteurs d'écran à chaque étape */}
        <p className="salon-bulle" role="status">{textOf(ligne)}</p>
      </div>
      <div className="salon-bas">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Personnage et nuanciers                                              */
/* ------------------------------------------------------------------ */

export const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
export const num = (h: string) => parseInt(h.slice(1), 16);

export const NUANCIER_MANTEAU = [0x2f6fb5, 0xd9354b, 0x2fa37a, 0xf2a516, 0x7b4fc4, 0x1f3d6b, 0xffffff];
export const NUANCIER_BONNET = [0x1f3d6b, 0xffffff, 0xd9354b, 0x2fa37a, 0xf2a516, 0x7b4fc4];
export const NUANCIER_POMPON = [0xffffff, 0xd9354b, 0xf2a516, 0x2fa37a, 0x1f3d6b];
export const NUANCIER_CHEVEUX = [0x2b1a10, 0x4a2e1f, 0x6b3a22, 0x8a5a2b, 0xd8b26a, 0xb5502a, 0x9a9a9a];

const NOMS: Record<number, string> = {
  0x2f6fb5: "bleu", 0xd9354b: "rouge", 0x2fa37a: "vert", 0xf2a516: "jaune", 0x7b4fc4: "violet", 0x1f3d6b: "bleu nuit",
  0xffffff: "blanc", 0x2b1a10: "noir", 0x4a2e1f: "brun foncé", 0x6b3a22: "châtain", 0x8a5a2b: "châtain clair",
  0xd8b26a: "blond", 0xb5502a: "roux", 0x9a9a9a: "gris",
};

/** Petit personnage en SVG : juste assez pour voir les couleurs choisies (le vrai vit dans le monde). */
export function Personnage({ c, taille = 110 }: { c: CouleursJoueur; taille?: number }) {
  const [manteau, bonnet, pompon, cheveux] = [hex(c.coat), hex(c.hat), hex(c.pompom), hex(c.hair)];
  return (
    <svg width={taille} height={taille * 1.25} viewBox="0 0 80 100" aria-hidden="true">
      <ellipse cx="40" cy="96" rx="22" ry="4" fill="#1b2347" opacity=".15" />
      {c.longHair && <path d="M22 40 Q20 66 30 68 L50 68 Q60 66 58 40 Z" fill={cheveux} />}
      <path d="M20 94 Q18 60 40 58 Q62 60 60 94 Z" fill={manteau} stroke="#1b2747" strokeOpacity=".15" strokeWidth="2" />
      <rect x="36" y="64" width="8" height="28" rx="3" fill="#fff" opacity=".25" />
      <circle cx="40" cy="40" r="17" fill="#f6d2b6" />
      <path d="M23 38 Q24 24 40 23 Q56 24 57 38 Q50 30 40 31 Q30 30 23 38 Z" fill={cheveux} />
      <path d="M22 34 Q24 12 40 11 Q56 12 58 34 Z" fill={bonnet} stroke="#1b2747" strokeOpacity=".2" strokeWidth="2" />
      <rect x="20" y="30" width="40" height="7" rx="3.5" fill={bonnet} stroke="#1b2747" strokeOpacity=".2" strokeWidth="2" />
      <circle cx="40" cy="9" r="6" fill={pompon} stroke="#1b2747" strokeOpacity=".2" strokeWidth="2" />
      <circle cx="34" cy="43" r="2" fill="#1b2747" />
      <circle cx="46" cy="43" r="2" fill="#1b2747" />
      <path d="M35 50 Q40 54 45 50" stroke="#1b2747" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="29" cy="48" r="3" fill="#ef8a8a" opacity=".5" />
      <circle cx="51" cy="48" r="3" fill="#ef8a8a" opacity=".5" />
    </svg>
  );
}

export function Nuancier({ nom, valeur, couleurs, onChange }: {
  nom: string; valeur: number; couleurs: number[]; onChange: (c: number) => void;
}) {
  return (
    <div className="salon-nuancier" role="radiogroup" aria-label={nom}>
      {couleurs.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={c === valeur} className={c === valeur ? "on" : ""}
          style={{ background: hex(c) }} aria-label={NOMS[c] ?? hex(c)} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

/** Le personnage et tous ses nuanciers ; « plus de choix » déplie bonnet, pompon et cheveux. */
export function ChoixCouleurs({ c, onChange, plus, onPlus }: {
  c: CouleursJoueur; onChange: (c: CouleursJoueur) => void; plus: boolean; onPlus: () => void;
}) {
  return (
    <div className={`salon-couleurs${plus ? " compact" : ""}`}>
      <div className="salon-perso"><Personnage c={c} taille={plus ? 72 : 110} /></div>
      <p className="salon-etiq salon-centre">Manteau</p>
      <Nuancier nom="Couleur du manteau" valeur={c.coat} couleurs={NUANCIER_MANTEAU} onChange={(coat) => onChange({ ...c, coat })} />
      {plus ? (
        <>
          <p className="salon-etiq salon-centre">Bonnet</p>
          <Nuancier nom="Couleur du bonnet" valeur={c.hat} couleurs={NUANCIER_BONNET} onChange={(hat) => onChange({ ...c, hat })} />
          <p className="salon-etiq salon-centre">Pompon</p>
          <Nuancier nom="Couleur du pompon" valeur={c.pompom} couleurs={NUANCIER_POMPON} onChange={(pompom) => onChange({ ...c, pompom })} />
          <p className="salon-etiq salon-centre">Cheveux</p>
          <Nuancier nom="Couleur des cheveux" valeur={c.hair} couleurs={NUANCIER_CHEVEUX} onChange={(hair) => onChange({ ...c, hair })} />
          <div className="salon-longueur" role="radiogroup" aria-label="Longueur des cheveux">
            <button type="button" role="radio" aria-checked={!c.longHair} className={!c.longHair ? "on" : ""} onClick={() => onChange({ ...c, longHair: false })}>Courts</button>
            <button type="button" role="radio" aria-checked={c.longHair} className={c.longHair ? "on" : ""} onClick={() => onChange({ ...c, longHair: true })}>Longs</button>
          </div>
        </>
      ) : (
        <p className="salon-plus">Bonnet, pompon, cheveux : <button type="button" className="salon-lien" onClick={onPlus}>plus de choix</button></p>
      )}
    </div>
  );
}

/** Champ mot de passe avec l'œil, comme sur l'écran de connexion. */
export function ChampMotDePasse({ id, valeur, onChange, visible, onVisible, erreur, label }: {
  id: string; valeur: string; onChange: (v: string) => void; visible: boolean; onVisible: () => void; erreur?: boolean; label: string;
}) {
  return (
    <div className="salon-champ-bloc">
      <label className="salon-etiq" htmlFor={id}>{label}</label>
      <div className="login-champ">
        <input id={id} className={`login-input${erreur ? " erreur" : ""}`} type={visible ? "text" : "password"}
          autoComplete="new-password" value={valeur} onChange={(e) => onChange(e.target.value)} minLength={6}
          aria-invalid={!!erreur} aria-describedby={`${id}-aide`} autoFocus />
        <button type="button" className="login-oeil" onClick={onVisible} aria-pressed={visible}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
            <circle cx="12" cy="12" r="2.8" />
            {visible && <path d="M4 20 20 4" />}
          </svg>
        </button>
      </div>
      <p className="salon-aide" id={`${id}-aide`}>6 caractères au moins.</p>
    </div>
  );
}

/** Message d'une erreur du backend (déjà en français, contrat SalonApi). */
export const messageErreur = (e: unknown) =>
  e instanceof Error && e.message ? e.message : "Quelque chose a coincé. Réessaie dans un instant.";
export const codeErreur = (e: unknown): string | undefined => (e as { code?: string } | null)?.code;
