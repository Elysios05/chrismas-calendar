// Les compositions TikTok (1080×1920, 30 i/s). Rendu de toutes les vidéos : ../outils/rendre.mjs (npm run rendre).
import { Composition, Folder } from "remotion";
import { Copine, DUREE_COPINE } from "./videos/Copine";
import { Demain, DUREE_DEMAIN } from "./videos/Demain";
import { DUREE_JEUX, Jeux } from "./videos/Jeux";
import { DUREE_MONDE, Monde } from "./videos/Monde";
import { DUREE_SURPRISE, Surprise } from "./videos/Surprise";

export const RemotionRoot = () => (
  <Folder name="TikTok">
    <Composition id="surprise" component={Surprise} durationInFrames={DUREE_SURPRISE} fps={30} width={1080} height={1920} />
    <Composition id="monde" component={Monde} durationInFrames={DUREE_MONDE} fps={30} width={1080} height={1920} />
    <Composition id="jeux" component={Jeux} durationInFrames={DUREE_JEUX} fps={30} width={1080} height={1920} />
    <Composition id="demain" component={Demain} durationInFrames={DUREE_DEMAIN} fps={30} width={1080} height={1920} />
    <Composition id="copine" component={Copine} durationInFrames={DUREE_COPINE} fps={30} width={1080} height={1920} />
  </Folder>
);
