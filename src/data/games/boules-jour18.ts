/**
 * Jour 18 — Bataille de boules de neige au pied de la cascade gelée (en direct, ou contre le fantôme de l'autre).
 *
 * Règles décidées avec Alexandre (26 nov) : « duel des forts ». Chacun derrière son fort de neige, vu de côté ;
 * on tire au lance-pierre (glisser le doigt : angle + force, la boule fait une cloche) ; on se baisse en restant
 * appuyé. Une boule qui touche l'autre = 1 point ; une boule sur le fort l'abîme, et il se répare quand on reste
 * baissé derrière. 3 manches de 45 s.
 *
 * ALEXANDRE : tu peux régler les valeurs et la difficulté ici, rien d'autre à écrire.
 */

export type BoulesContent = {
  manches: number;
  /** Secondes par manche */
  secondes: number;
  /** Secondes de pause entre deux manches en direct */
  pause: number;
  attenteAvantSolo: number;
  /** Même graine = même vent pour vous deux */
  graine: number;
  /** Force du vent maximale, manche par manche (0 = pas de vent) */
  vent: number[];
  /** Secondes pour refaire une boule après un tir */
  recharge: number;
  /** Rangées de neige du fort */
  rangees: number;
  /** Secondes baissé derrière le fort pour reconstruire une rangée */
  reparation: number;
  /** Points pour une boule qui touche l'autre */
  points: number;
  /**
   * Quand tu joues le premier, seul : un lutin te bombarde pour t'obliger à te cacher
   * (ses boules ne comptent pas). Une boule toutes les N secondes, environ.
   */
  lutinIntervalle: number;
};

export const BOULES_JOUR18: BoulesContent = {
  manches: 3,
  secondes: 45,
  pause: 6,
  attenteAvantSolo: 20,
  graine: 20261218,
  vent: [0, 160, 300],
  recharge: 0.7,
  rangees: 3,
  reparation: 2,
  points: 1,
  lutinIntervalle: 2.6,
};
