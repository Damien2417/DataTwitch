import React, { FC } from "react";
import { BsInfoCircle } from "react-icons/bs";

import Panel from "./Panel";

const DescriptionPanel: FC = () => {
  return (
    <Panel
      initiallyDeployed
      title={
        <>
          <BsInfoCircle className="text-muted" /> Description
        </>
      }
    >
      <p>
        Cette carte représente un <i>réseau</i> de viewers Twitch. Chaque{" "}
        <i>node</i> (point) représente un viewer ou streamer et chaque edge (liaison) représente un viewer regardant un streamer.
      </p>
      <p>
        Le jeu de données provient de l'API Twitch et est actualisé toutes les 5 minutes.
      </p>
      <p>
        La taille des nodes est directement lié au nombre de viewers regardant un streamer.{" "}
      </p>
	  <p>
        Le placement des données est basé sur des estimations grâce à un algorithme.
      </p>
	  <p>
        Un bouton est disponible en haut à droite permettant d'affiner le placement des données si besoin.{" "}
      </p>
	  
    </Panel>
  );
};

export default DescriptionPanel;
